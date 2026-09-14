// WebGPU renderer: scene pass (sky, terrain, track, props, cars) -> bloom -> composite.
const Gpu = (() => {
  let device, ctx, format, canvas;
  let frameBuf, sampler, pipes = {}, sceneBG, shadowBG, postBG, bloomBG;
  let sceneTex, ndTex, depthTex, bloomTex, shadowTex, shadowSampler, W = 0, H = 0;
  const FRAME_FLOATS = 144;
  const presets = Object.freeze({
    eco: Object.freeze({ fps: 30, maxPixels: 1280 * 720, dpr: 1, shadowSize: 0, bloom: false, effects: false }),
    balanced: Object.freeze({ fps: 60, maxPixels: 1600 * 900, dpr: 1.25, shadowSize: 1024, bloom: true, effects: true }),
    high: Object.freeze({ fps: 60, maxPixels: 2560 * 1440, dpr: 1.5, shadowSize: 2048, bloom: true, effects: true }),
  });
  let frameRate = 'auto';
  try { const saved = localStorage.getItem('ir.frameRate'); if (['auto','30','60'].includes(saved)) frameRate = saved; } catch (_) {}
  function setFrameRate(value) {
    if (!['auto','30','60'].includes(String(value))) return;
    frameRate = String(value);
    try { localStorage.setItem('ir.frameRate', frameRate); } catch (_) {}
  }
  let quality = window.matchMedia?.('(pointer: coarse)').matches ? 'eco' : 'balanced';
  try { const saved = localStorage.getItem('ir.quality'); if (presets[saved]) quality = saved; } catch (_) {}
  let profileEveryFrame = false, timingEpoch = 0;
  const gpuSamples = {};
  let lost = false, timestampSet, timestampResolve, timestampRead, timestampPending = false;
  let renderScale = 1, shadowSize = -1, captureState, captureDimensions;
  const metrics = { frames: 0, width: 0, height: 0, sceneTriangles: 0, shadowTriangles: 0, drawCalls: 0, passes: 0, cpuSubmitMs: 0 };
  function getQuality() { return quality; }
  function setQuality(name) {
    if (!presets[name]) return;
    quality = name; renderScale = 1; resetTiming();
    if (captureState) captureState.W = 0;
    try { localStorage.setItem('ir.quality', name); } catch (_) {}
    if (device) { syncShadow(); W = 0; resize(); }
  }
  function resetTiming() { timingEpoch++; delete metrics.gpuMs; delete metrics.gpuMedianMs; for (const sample of Object.values(gpuSamples)) sample.clear(); }
  function setRenderScale(scale) {
    if (!Number.isFinite(scale)) return;
    const next = Math.max(0.5, Math.min(1, scale));
    if (next !== renderScale) { renderScale = next; resetTiming(); }
  }
  function syncShadow() {
    const size = Math.max(1, presets[quality].shadowSize);
    if (size === shadowSize) return;
    shadowTex?.destroy(); shadowSize = size;
    shadowTex = device.createTexture({ size: [size, size], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    sceneBG = device.createBindGroup({ layout: pipes.sceneBGL, entries: [
      { binding: 0, resource: { buffer: frameBuf } }, { binding: 1, resource: shadowTex.createView() }, { binding: 2, resource: shadowSampler },
    ] });
  }

  const vertLayout = {
    arrayStride: Geo.STRIDE * 4, stepMode: 'vertex',
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' },
      { shaderLocation: 2, offset: 24, format: 'float32x2' }, { shaderLocation: 3, offset: 32, format: 'float32x4' },
    ],
  };
  const propInstLayout = {
    arrayStride: 32, stepMode: 'instance',
    attributes: [
      { shaderLocation: 4, offset: 0, format: 'float32x3' }, { shaderLocation: 5, offset: 12, format: 'float32x3' },
      { shaderLocation: 6, offset: 24, format: 'float32' }, { shaderLocation: 7, offset: 28, format: 'float32' },
    ],
  };
  const CAR_FLOATS = 24;
  const carInstLayout = {
    arrayStride: CAR_FLOATS * 4, stepMode: 'instance',
    attributes: [
      { shaderLocation: 4, offset: 0, format: 'float32x3' }, { shaderLocation: 5, offset: 12, format: 'float32x3' },
      { shaderLocation: 6, offset: 24, format: 'float32x3' }, { shaderLocation: 7, offset: 36, format: 'float32x3' },
      { shaderLocation: 8, offset: 48, format: 'float32x3' }, { shaderLocation: 9, offset: 60, format: 'float32' },
      { shaderLocation: 10, offset: 64, format: 'float32' }, { shaderLocation: 11, offset: 68, format: 'float32x3' },
      { shaderLocation: 12, offset: 80, format: 'float32' }, { shaderLocation: 13, offset: 84, format: 'float32' }, { shaderLocation: 14, offset: 88, format: 'float32' },
    ],
  };

  async function init(cv) {
    canvas = cv;
    if (!navigator.gpu) throw new Error('WebGPU is not available in this browser.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' }) || await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter found.');
    profileEveryFrame = new URLSearchParams(window.location.search).get('profile') === '1';
    const profile = adapter.features.has('timestamp-query');
    device = await adapter.requestDevice(profile ? { requiredFeatures: ['timestamp-query'] } : {});
    if (profile) {
      timestampSet = device.createQuerySet({ type: 'timestamp', count: 8 });
      timestampResolve = device.createBuffer({ size: 1024, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
      timestampRead = device.createBuffer({ size: 1024, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    }
    device.lost.then(info => { lost = true; console.error('WebGPU device lost', info); window.dispatchEvent(new CustomEvent('ir:device-lost', { detail: info })); });
    ctx = canvas.getContext('webgpu');
    format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: 'opaque' });
    frameBuf = device.createBuffer({ size: FRAME_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });

    const mkModule = (label, code) => {
      const m = device.createShaderModule({ label, code });
      m.getCompilationInfo().then(info => { for (const msg of info.messages) if (msg.type === 'error') console.error(label, msg.lineNum, msg.message); });
      return m;
    };
    const sceneMod = mkModule('scene', Shaders.scene), skyMod = mkModule('sky', Shaders.sky), postMod = mkModule('post', Shaders.post);

    // Shadow map resources: depth texture rendered from the sun, sampled with a comparison sampler.
    shadowSampler = device.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });
    const sceneBGL = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
    ] });
    const shadowBGL = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }] });
    const postBGL = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ] });
    pipes.sceneBGL = sceneBGL; syncShadow();
    shadowBG = device.createBindGroup({ layout: shadowBGL, entries: [{ binding: 0, resource: { buffer: frameBuf } }] });
    const sceneLayout = device.createPipelineLayout({ bindGroupLayouts: [sceneBGL] });
    const shadowLayout = device.createPipelineLayout({ bindGroupLayouts: [shadowBGL] });
    const postLayout = device.createPipelineLayout({ bindGroupLayouts: [postBGL] });
    const depth = (write, compare) => ({ format: 'depth24plus', depthWriteEnabled: write, depthCompare: compare });
    const targets = [{ format: 'rgba16float' }, { format: 'rgba16float' }];
    const scenePipe = (vs, buffers, shadows = true, write = true, compare = 'less', fade = false) => device.createRenderPipeline({
      layout: sceneLayout,
      vertex: { module: sceneMod, entryPoint: vs, buffers },
      fragment: { module: sceneMod, entryPoint: shadows ? 'fsScene' : 'fsSceneEco', constants: { WITH_SHADOWS: shadows, PICKER_FADE: fade }, targets: (shadows ? targets : targets.slice(0, 1)).map((target,i) => fade && i === 0 ? {...target,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}} : target) },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: depth(write, compare),
    });
    const shadowPipe = (vs, buffers, fade = false) => device.createRenderPipeline({
      layout: shadowLayout,
      vertex: { module: sceneMod, entryPoint: vs, buffers },
      ...(fade ? { fragment: { module: sceneMod, entryPoint: 'fsCarShadowFade', targets: [] } } : {}),
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2.5 },
    });
    const skyPipe = eco => device.createRenderPipeline({
      layout: sceneLayout,
      vertex: { module: skyMod, entryPoint: 'vsFull' },
      fragment: { module: skyMod, entryPoint: eco ? 'fsSkyEco' : 'fsSky', targets: eco ? targets.slice(0, 1) : targets },
      primitive: { topology: 'triangle-list' },
      depthStencil: depth(false, 'always'),
    });
    pipes.sky = skyPipe(false); pipes.skyEco = skyPipe(true);
    pipes.static = scenePipe('vsStatic', [vertLayout]);
    pipes.prop = scenePipe('vsProp', [vertLayout, propInstLayout]);
    pipes.car = scenePipe('vsCar', [vertLayout, carInstLayout]);
    pipes.staticEco = scenePipe('vsStatic', [vertLayout], false);
    pipes.propEco = scenePipe('vsProp', [vertLayout, propInstLayout], false);
    pipes.carEco = scenePipe('vsCar', [vertLayout, carInstLayout], false);
    pipes.carFade = scenePipe('vsCar', [vertLayout, carInstLayout], true, true, 'less', true);
    pipes.carFadeEco = scenePipe('vsCar', [vertLayout, carInstLayout], false, true, 'less', true);
    const waterPipe = eco => device.createRenderPipeline({
      layout: sceneLayout,
      vertex: { module: sceneMod, entryPoint: 'vsStatic', buffers: [vertLayout] },
      fragment: { module: sceneMod, entryPoint: eco ? 'fsWaterEco' : 'fsWater', targets: [
        { format: 'rgba16float', blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' } } },
        ...(eco ? [] : [{ format: 'rgba16float' }]),
      ] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' },
    });
    pipes.water = waterPipe(false); pipes.waterEco = waterPipe(true);
    // Particles: instance-only quads, two blend modes, depth tested, no depth or normal writes.
    const partMod = mkModule('particles', Shaders.particles);
    const partLayout = { arrayStride: 64, stepMode: 'instance', attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32' },
      { shaderLocation: 2, offset: 16, format: 'float32x3' }, { shaderLocation: 3, offset: 28, format: 'float32' },
      { shaderLocation: 4, offset: 32, format: 'float32x3' }, { shaderLocation: 5, offset: 44, format: 'float32' },
      { shaderLocation: 6, offset: 48, format: 'float32' }, { shaderLocation: 7, offset: 52, format: 'float32' },
    ] };
    const keepAlpha = { srcFactor: 'zero', dstFactor: 'one', operation: 'add' };
    const keepAll = { color: keepAlpha, alpha: keepAlpha };
    const partPipe = (fs, blendColor, eco = false) => device.createRenderPipeline({
      layout: sceneLayout,
      vertex: { module: partMod, entryPoint: 'vsParticle', buffers: [partLayout] },
      fragment: { module: partMod, entryPoint: eco ? fs + 'Eco' : fs, targets: [
        { format: 'rgba16float', blend: { color: blendColor, alpha: keepAlpha } },
        ...(eco ? [] : [{ format: 'rgba16float', blend: keepAll }]),
      ] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' },
    });
    pipes.partAdd = partPipe('fsParticleAdd', { srcFactor: 'one', dstFactor: 'one', operation: 'add' });
    pipes.partAlpha = partPipe('fsParticleAlpha', { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' });
    pipes.partAddEco = partPipe('fsParticleAdd', { srcFactor: 'one', dstFactor: 'one', operation: 'add' }, true);
    pipes.partAlphaEco = partPipe('fsParticleAlpha', { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, true);
    pipes.staticShadow = shadowPipe('vsStaticShadow', [vertLayout]);
    pipes.propShadow = shadowPipe('vsPropShadow', [vertLayout, propInstLayout]);
    pipes.carShadow = shadowPipe('vsCarShadow', [vertLayout, carInstLayout]);
    pipes.carShadowFade = shadowPipe('vsCarShadowFade', [vertLayout, carInstLayout], true);
    pipes.bloom = device.createRenderPipeline({
      layout: postLayout,
      vertex: { module: postMod, entryPoint: 'vsFull' },
      fragment: { module: postMod, entryPoint: 'fsBloom', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-list' },
    });
    const compositePipe = effects => device.createRenderPipeline({
      layout: postLayout,
      vertex: { module: postMod, entryPoint: 'vsFull' },
      fragment: { module: postMod, entryPoint: effects ? 'fsComposite' : 'fsCompositeEco', constants: effects ? { WITH_EFFECTS: true, WITH_BLOOM: true } : {}, targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    pipes.composite = compositePipe(true);
    pipes.compositeEco = compositePipe(false);
    pipes.postBGL = postBGL;
    resize();
    return device;
  }

  function resize(scale) {
    if (scale !== undefined) setRenderScale(scale);
    const settings = presets[quality];
    let dpr = Math.min(window.devicePixelRatio || 1, settings.dpr);
    const pixels = canvas.clientWidth * canvas.clientHeight * dpr * dpr;
    if (pixels > settings.maxPixels) dpr *= Math.sqrt(settings.maxPixels / pixels);
    dpr *= renderScale;
    const w = captureDimensions?.width || Math.max(8, Math.floor(canvas.clientWidth * dpr)), h = captureDimensions?.height || Math.max(8, Math.floor(canvas.clientHeight * dpr));
    if (w === W && h === H) return;
    W = w; H = h; canvas.width = w; canvas.height = h;
    metrics.width = w; metrics.height = h;
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    sceneTex?.destroy(); ndTex?.destroy(); depthTex?.destroy(); bloomTex?.destroy();
    sceneTex = device.createTexture({ size: [w, h], format: 'rgba16float', usage });
    ndTex = device.createTexture({ size: presets[quality].effects ? [w, h] : [1, 1], format: 'rgba16float', usage });
    depthTex = device.createTexture({ size: [w, h], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    bloomTex = device.createTexture({ size: presets[quality].bloom ? [Math.max(1, w >> 2), Math.max(1, h >> 2)] : [1, 1], format: 'rgba16float', usage });
    const mk = (a, b) => device.createBindGroup({ layout: pipes.postBGL, entries: [
      { binding: 0, resource: { buffer: frameBuf } }, { binding: 1, resource: sampler },
      { binding: 2, resource: a.createView() }, { binding: 3, resource: b.createView() }, { binding: 4, resource: ndTex.createView() },
    ] });
    bloomBG = mk(sceneTex, sceneTex);
    postBG = mk(sceneTex, bloomTex);
  }

  // A separate small WebGPU canvas and cached targets avoid resizing or redrawing the game.
  // Copy synchronously before returning; the browser handles the GPU/2D dependency.
  function capture(scene, { width = 336, height = 180 } = {}) {
    const save = () => ({ canvas, ctx, W, H, sceneTex, ndTex, depthTex, bloomTex, bloomBG, postBG });
    const restore = state => ({ canvas, ctx, W, H, sceneTex, ndTex, depthTex, bloomTex, bloomBG, postBG } = state);
    const main = save(), stats = { ...metrics };
    if (!captureState) {
      const target = document.createElement('canvas'), targetCtx = target.getContext('webgpu');
      targetCtx.configure({ device, format, alphaMode: 'opaque' });
      captureState = { canvas: target, ctx: targetCtx, W: 0, H: 0 };
    }
    restore(captureState);
    captureDimensions = { width: Math.max(8, Math.floor(width)), height: Math.max(8, Math.floor(height)) };
    try {
      render(scene);
      const result = document.createElement('canvas'); result.width = W; result.height = H;
      result.getContext('2d').drawImage(canvas, 0, 0);
      return result;
    } finally {
      captureState = save(); captureDimensions = undefined; restore(main); Object.assign(metrics, stats);
    }
  }

  function createMesh(m) {
    const vb = device.createBuffer({ size: m.verts.byteLength, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
    new Float32Array(vb.getMappedRange()).set(m.verts); vb.unmap();
    const ib = device.createBuffer({ size: m.idx.byteLength, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
    new Uint32Array(ib.getMappedRange()).set(m.idx); ib.unmap();
    const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (let i = 0; i < m.verts.length; i += Geo.STRIDE) for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], m.verts[i + axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], m.verts[i + axis]);
    }
    // Include shader animation in conservative instance bounds: rotating wheels,
    // expanding route dots and the gate ripple must not disappear at view edges.
    let cullRadius = 0;
    for (let i = 0; i < m.verts.length; i += Geo.STRIDE) {
      const p = m.verts.subarray(i, i + 3), part = m.verts[i + 9];
      let radius = Math.hypot(...p);
      if (part === 1 || part === 2) {
        const pivot = [m.verts[i + 6], m.verts[i + 7], m.verts[i + 10]];
        radius = Math.hypot(...pivot) + Math.hypot(...p.map((v, a) => v - pivot[a]));
      }
      cullRadius = Math.max(cullRadius, radius * (part === 9 ? 3 : part === 8 ? 1.12 : 1));
    }
    return { vb, ib, count: m.idx.length, bounds, cullRadius, lods: (m.lods || []).map(createMesh) };
  }
  function createInstances(data) {
    const buf = device.createBuffer({ size: Math.max(32, data.byteLength), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buf, 0, data);
    return buf;
  }
  function updateInstances(buf, data) { device.queue.writeBuffer(buf, 0, data); }

  // Release all GPU buffers owned by a set of render groups. Sets avoid double-destroying
  // meshes or instance buffers shared by more than one group.
  function destroyGroups(groups) {
    const meshes = new Set(), instances = new Set();
    for (const g of groups || []) {
      if (g && g.mesh) meshes.add(g.mesh);
      if (g && g.inst) instances.add(g.inst);
    }
    const destroyMesh = m => { try { m.vb.destroy(); m.ib.destroy(); } catch (_) {} for (const lod of m.lods || []) destroyMesh(lod); };
    for (const m of meshes) destroyMesh(m);
    for (const b of instances) { try { b.destroy(); } catch (e) {} }
  }
  function destroyScene(scene) {
    if (!scene) return;
    const groups = [];
    for (const m of scene.statics || []) groups.push({ mesh: m });
    if (scene.props) groups.push(scene.props);
    groups.push(...(scene.propGroups || []), ...(scene.carGroups || []));
    if (scene.water) groups.push({ mesh: scene.water });
    destroyGroups(groups);
  }

  // AABB support-point test against WebGPU clip planes (z is 0..w).
  // Camera and light use independent planes: off-camera objects can still cast shadows.
  function visible(bounds, matrix, offset = 0) {
    if (!bounds) return true;
    for (let plane = 0; plane < 6; plane++) {
      const axis = plane >> 1, sign = plane & 1 ? -1 : 1;
      let distance = 0;
      for (let column = 0; column < 4; column++) {
        const a = matrix[offset + column * 4 + axis] * sign + (plane === 4 ? 0 : matrix[offset + column * 4 + 3]);
        distance += a * (column === 3 ? 1 : (a >= 0 ? bounds.max[column] : bounds.min[column]));
      }
      if (distance < -0.001) return false;
    }
    return true;
  }
  function chooseLod(mesh, frame) {
    if (!mesh.lods?.length) return mesh;
    let distanceSquared = 0;
    for (let axis = 0; axis < 3; axis++) {
      const p = frame[16 + axis], d = Math.max(mesh.bounds.min[axis] - p, 0, p - mesh.bounds.max[axis]);
      distanceSquared += d * d;
    }
    const near = quality === 'eco' ? 250 : quality === 'high' ? 700 : 450, far = quality === 'eco' ? 650 : quality === 'high' ? 1400 : 1000;
    return distanceSquared > far * far ? (mesh.lods[1] || mesh.lods[0]) : distanceSquared > near * near ? mesh.lods[0] : mesh;
  }

  function groupLod(group, frame) {
    if (!group.mesh.lods?.length) return group;
    let distance = group.lodDistance;
    const bounds = group.worldBounds || group.bounds;
    if (!Number.isFinite(distance) && bounds) {
      let squared = 0;
      for (let axis = 0; axis < 3; axis++) {
        const p = frame[16 + axis], d = Math.max(bounds.min[axis] - p, 0, p - bounds.max[axis]); squared += d * d;
      }
      distance = Math.sqrt(squared);
    }
    if (!Number.isFinite(distance)) return group;
    const thresholds = group.lodThresholds || (quality === 'eco' ? [150, 450] : [300, 750]);
    const detail = quality === 'high' ? 2 : 1;
    const near = thresholds[0] * detail, far = thresholds[1] * detail;
    const mesh = distance > far ? (group.mesh.lods[1] || group.mesh.lods[0]) : distance > near ? group.mesh.lods[0] : group.mesh;
    return mesh === group.mesh ? group : { ...group, mesh };
  }

  function instanceBounds(mesh, data, offset) {
    const radius = mesh.cullRadius * Math.max(1, Math.abs(data[offset + 17]), Math.abs(data[offset + 18]), Math.abs(data[offset + 19]));
    const min = [], max = [];
    for (let axis = 0; axis < 3; axis++) {
      const extent = radius * Math.hypot(data[offset + axis], data[offset + 3 + axis], data[offset + 6 + axis]);
      min[axis] = data[offset + 9 + axis] - extent;
      max[axis] = data[offset + 9 + axis] + extent;
    }
    return { min, max };
  }

  function visibleInstances(groups, frame, shadow = false) {
    const result = [];
    for (const group of groups) {
      if (!group.count || (shadow && group.castShadow === false)) continue;
      if (!group.data || !Number.isFinite(group.mesh.cullRadius)) {
        if (visible(group.worldBounds || group.bounds, frame, shadow ? 84 : 0)) result.push(groupLod(group, frame));
        continue;
      }
      let run = null;
      for (let i = 0; i < group.count; i++) {
        const bounds = instanceBounds(group.mesh, group.data, i * CAR_FLOATS);
        if (!visible(bounds, frame, shadow ? 84 : 0)) { run = null; continue; }
        const selected = groupLod({ ...group, bounds, worldBounds: bounds, lodDistance: group.lodDistances?.[i] ?? group.lodDistance }, frame);
        if (run && run.mesh === selected.mesh) run.count++;
        else { run = { ...selected, firstInstance: i, count: 1 }; result.push(run); }
      }
    }
    return result;
  }

  // scene = { frame: Float32Array(FRAME_FLOATS), statics: [mesh], propGroups: [{mesh, inst, count, bounds}], carGroups: [...] }
  function render(scene) {
    if (lost) return;
    const started = performance.now(), settings = presets[quality];
    resize();
    scene.frame[72] = W; scene.frame[73] = H;
    device.queue.writeBuffer(frameBuf, 0, scene.frame);
    const enc = device.createCommandEncoder();
    const measure = timestampSet && !timestampPending && !captureDimensions && (profileEveryFrame || metrics.frames % 30 === 0);
    const epoch = timingEpoch;
    const stamps = pass => measure ? { querySet: timestampSet, beginningOfPassWriteIndex: pass * 2, endOfPassWriteIndex: pass * 2 + 1 } : undefined;
    const propList = [...(scene.props && scene.props.count ? [scene.props] : []), ...(scene.propGroups || [])];
    const cameraStatics = scene.statics.filter(m => visible(m.bounds, scene.frame)).map(m => chooseLod(m, scene.frame));
    const lightStatics = settings.shadowSize ? scene.statics.filter(m => visible(m.bounds, scene.frame, 84)).map(m => chooseLod(m, scene.frame)) : [];
    const cameraProps = propList.filter(g => g.count && visible(g.worldBounds || g.bounds, scene.frame)).map(g => groupLod(g, scene.frame));
    const lightProps = settings.shadowSize ? propList.filter(g => g.count && visible(g.worldBounds || g.bounds, scene.frame, 84)).map(g => groupLod(g, scene.frame)) : [];
    const cars = visibleInstances(scene.carGroups || [], scene.frame);
    const shadowCars = settings.shadowSize ? visibleInstances(scene.carGroups || [], scene.frame, true) : [];
    const triangles = (statics, props, instances) => statics.reduce((n, m) => n + m.count / 3, 0) + [...props, ...instances].reduce((n, g) => n + g.mesh.count / 3 * g.count, 0);
    metrics.sceneTriangles = triangles(cameraStatics, cameraProps, cars) + (scene.water?.count || 0) / 3;
    metrics.shadowTriangles = settings.shadowSize ? triangles(lightStatics, lightProps, shadowCars) : 0;
    metrics.drawCalls = cameraStatics.length + cameraProps.length + cars.length + 2 + (scene.water ? 1 : 0) + (settings.bloom ? 1 : 0) + (settings.shadowSize ? lightStatics.length + lightProps.length + shadowCars.length : 0);
    metrics.totalRaceInstances = (scene.carGroups || []).reduce((n, g) => n + g.count, 0);
    metrics.visibleRaceInstances = cars.reduce((n, g) => n + g.count, 0);
    metrics.shadowRaceInstances = shadowCars.reduce((n, g) => n + g.count, 0);
    metrics.culledGroups = scene.statics.length + propList.length - cameraStatics.length - cameraProps.length;
    metrics.colorAttachments = settings.effects ? 2 : 1;
    metrics.normalTargetPixels = settings.effects ? W * H : 1;
    metrics.passes = 2 + (settings.shadowSize ? 1 : 0) + (settings.bloom ? 1 : 0);
    // Shadow pass is entirely omitted in Eco; its pipelines also omit sampling.
    if (settings.shadowSize) {
      const p0 = enc.beginRenderPass({ timestampWrites: stamps(0), colorAttachments: [], depthStencilAttachment: { view: shadowTex.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
      p0.setBindGroup(0, shadowBG);
      p0.setPipeline(pipes.staticShadow);
      for (const m of lightStatics) { p0.setVertexBuffer(0, m.vb); p0.setIndexBuffer(m.ib, 'uint32'); p0.drawIndexed(m.count); }
      if (propList.length) {
        p0.setPipeline(pipes.propShadow);
        for (const g of lightProps) { p0.setVertexBuffer(0, g.mesh.vb); p0.setVertexBuffer(1, g.inst); p0.setIndexBuffer(g.mesh.ib, 'uint32'); p0.drawIndexed(g.mesh.count, g.count); }
      }
      if (scene.carGroups) {
        p0.setPipeline(pipes.carShadow);
        for (const g of shadowCars) {
          if (!g.count) continue;
          p0.setPipeline(g.fade ? pipes.carShadowFade : pipes.carShadow);
          p0.setVertexBuffer(0, g.mesh.vb); p0.setVertexBuffer(1, g.inst);
          p0.setIndexBuffer(g.mesh.ib, 'uint32'); p0.drawIndexed(g.mesh.count, g.count, 0, 0, g.firstInstance || 0);
        }
      }
      p0.end();
    }
    const p1 = enc.beginRenderPass({
      timestampWrites: stamps(1),
      colorAttachments: [
        { view: sceneTex.createView(), loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' },
        ...(settings.effects ? [{ view: ndTex.createView(), loadOp: 'clear', clearValue: [0, 0, 0, 100000], storeOp: 'store' }] : []),
      ],
      depthStencilAttachment: { view: depthTex.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' },
    });
    p1.setBindGroup(0, sceneBG);
    p1.setPipeline(settings.effects ? pipes.sky : pipes.skyEco); p1.draw(3);
    p1.setPipeline(settings.shadowSize ? pipes.static : pipes.staticEco);
    for (const m of cameraStatics) { p1.setVertexBuffer(0, m.vb); p1.setIndexBuffer(m.ib, 'uint32'); p1.drawIndexed(m.count); }
    if (propList.length) {
      p1.setPipeline(settings.shadowSize ? pipes.prop : pipes.propEco);
      for (const g of cameraProps) { p1.setVertexBuffer(0, g.mesh.vb); p1.setVertexBuffer(1, g.inst); p1.setIndexBuffer(g.mesh.ib, 'uint32'); p1.drawIndexed(g.mesh.count, g.count); }
    }
    if (scene.carGroups) {
      p1.setPipeline(settings.shadowSize ? pipes.car : pipes.carEco);
      for (const g of cars) {
        if (!g.count) continue;
        p1.setPipeline(g.fade ? (settings.shadowSize ? pipes.carFade : pipes.carFadeEco) : (settings.shadowSize ? pipes.car : pipes.carEco));
        p1.setVertexBuffer(0, g.mesh.vb); p1.setVertexBuffer(1, g.inst);
        p1.setIndexBuffer(g.mesh.ib, 'uint32'); p1.drawIndexed(g.mesh.count, g.count, 0, 0, g.firstInstance || 0);
      }
    }
    if (scene.water) {
      p1.setPipeline(settings.effects ? pipes.water : pipes.waterEco);
      p1.setVertexBuffer(0, scene.water.vb); p1.setIndexBuffer(scene.water.ib, 'uint32'); p1.drawIndexed(scene.water.count);
    }
    if (typeof Particles !== 'undefined' && Particles.fill && scene.particles !== false) {
      const pg = Particles.fill(scene.frame);
      if (pg.alpha.count) { p1.setPipeline(settings.effects ? pipes.partAlpha : pipes.partAlphaEco); p1.setVertexBuffer(0, pg.alpha.inst); p1.draw(6, pg.alpha.count); metrics.drawCalls++; metrics.sceneTriangles += pg.alpha.count * 2; }
      if (pg.add.count) { p1.setPipeline(settings.effects ? pipes.partAdd : pipes.partAddEco); p1.setVertexBuffer(0, pg.add.inst); p1.draw(6, pg.add.count); metrics.drawCalls++; metrics.sceneTriangles += pg.add.count * 2; }
    }
    p1.end();
    if (settings.bloom) {
      const p2 = enc.beginRenderPass({ timestampWrites: stamps(2), colorAttachments: [{ view: bloomTex.createView(), loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' }] });
      p2.setPipeline(pipes.bloom); p2.setBindGroup(0, bloomBG); p2.draw(3); p2.end();
    }
    const p3 = enc.beginRenderPass({ timestampWrites: stamps(3), colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' }] });
    p3.setPipeline(settings.effects ? pipes.composite : pipes.compositeEco); p3.setBindGroup(0, postBG); p3.draw(3); p3.end();
    if (measure) {
      // Resolve only written queries: Eco omits shadow and bloom entirely.
      for (const pass of [1, 3, ...(settings.shadowSize ? [0] : []), ...(settings.bloom ? [2] : [])]) enc.resolveQuerySet(timestampSet, pass * 2, 2, timestampResolve, pass * 256);
      enc.copyBufferToBuffer(timestampResolve, 0, timestampRead, 0, 1024);
    }
    device.queue.submit([enc.finish()]);
    if (measure) {
      timestampPending = true;
      timestampRead.mapAsync(GPUMapMode.READ).then(() => {
        const times = new BigUint64Array(timestampRead.getMappedRange());
        const ms = pass => Number(times[pass * 32 + 1] - times[pass * 32]) / 1e6;
        if (epoch === timingEpoch) {
          metrics.gpuMs = { scene: ms(1), composite: ms(3), shadow: settings.shadowSize ? ms(0) : 0, bloom: settings.bloom ? ms(2) : 0 };
          for (const [pass, value] of Object.entries(metrics.gpuMs)) {
            (gpuSamples[pass] ||= Timing.samples(60)).add(value);
          }
          metrics.gpuMedianMs = Object.fromEntries(Object.entries(gpuSamples).map(([pass, sample]) => [pass, sample.summary().p50]));
        }
        timestampRead.unmap();
      }).catch(() => {}).finally(() => { timestampPending = false; });
    }
    metrics.frames++; metrics.cpuSubmitMs = performance.now() - started;
  }

  return { init, resize, capture, resetTiming, setFrameRate, get frameRate() { return frameRate; }, get targetFps() { return frameRate === 'auto' ? presets[quality].fps : Number(frameRate); }, setQuality, getQuality, setRenderScale, metrics, get qualitySettings() { return presets[quality]; }, get renderScale() { return renderScale; }, createMesh, createInstances, updateInstances, destroyGroups, destroyScene, render, FRAME_FLOATS, CAR_FLOATS };
})();
