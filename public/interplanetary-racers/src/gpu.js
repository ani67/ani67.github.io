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
  let quality = window.matchMedia?.('(pointer: coarse)').matches ? 'eco' : 'balanced';
  try { const saved = localStorage.getItem('ir.quality'); if (presets[saved]) quality = saved; } catch (_) {}
  let lost = false, timestampSet, timestampResolve, timestampRead, timestampPending = false;
  let renderScale = 1, shadowSize = -1, captureState, captureDimensions;
  const metrics = { frames: 0, width: 0, height: 0, sceneTriangles: 0, shadowTriangles: 0, drawCalls: 0, passes: 0, cpuSubmitMs: 0 };
  function getQuality() { return quality; }
  function setQuality(name) {
    if (!presets[name]) return;
    quality = name; renderScale = 1;
    if (captureState) captureState.W = 0;
    try { localStorage.setItem('ir.quality', name); } catch (_) {}
    if (device) { syncShadow(); W = 0; resize(); }
  }
  function setRenderScale(scale) { if (Number.isFinite(scale)) renderScale = Math.max(0.5, Math.min(1, scale)); }
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
    const profile = new URLSearchParams(window.location.search).get('profile') === '1' && adapter.features.has('timestamp-query');
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
    const scenePipe = (vs, buffers, shadows = true, write = true, compare = 'less') => device.createRenderPipeline({
      layout: sceneLayout,
      vertex: { module: sceneMod, entryPoint: vs, buffers },
      fragment: { module: sceneMod, entryPoint: 'fsScene', constants: { WITH_SHADOWS: shadows }, targets },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: depth(write, compare),
    });
    const shadowPipe = (vs, buffers) => device.createRenderPipeline({
      layout: shadowLayout,
      vertex: { module: sceneMod, entryPoint: vs, buffers },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2.5 },
    });
    pipes.sky = device.createRenderPipeline({
      layout: sceneLayout,
      vertex: { module: skyMod, entryPoint: 'vsFull' },
      fragment: { module: skyMod, entryPoint: 'fsSky', targets },
      primitive: { topology: 'triangle-list' },
      depthStencil: depth(false, 'always'),
    });
    pipes.static = scenePipe('vsStatic', [vertLayout]);
    pipes.prop = scenePipe('vsProp', [vertLayout, propInstLayout]);
    pipes.car = scenePipe('vsCar', [vertLayout, carInstLayout]);
    pipes.staticEco = scenePipe('vsStatic', [vertLayout], false);
    pipes.propEco = scenePipe('vsProp', [vertLayout, propInstLayout], false);
    pipes.carEco = scenePipe('vsCar', [vertLayout, carInstLayout], false);
    pipes.water = device.createRenderPipeline({
      layout: sceneLayout,
      vertex: { module: sceneMod, entryPoint: 'vsStatic', buffers: [vertLayout] },
      fragment: { module: sceneMod, entryPoint: 'fsWater', targets: [
        { format: 'rgba16float', blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' } } },
        { format: 'rgba16float' },
      ] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' },
    });
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
    const partPipe = (fs, blendColor) => device.createRenderPipeline({
      layout: sceneLayout,
      vertex: { module: partMod, entryPoint: 'vsParticle', buffers: [partLayout] },
      fragment: { module: partMod, entryPoint: fs, targets: [
        { format: 'rgba16float', blend: { color: blendColor, alpha: keepAlpha } },
        { format: 'rgba16float', blend: keepAll },
      ] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' },
    });
    pipes.partAdd = partPipe('fsParticleAdd', { srcFactor: 'one', dstFactor: 'one', operation: 'add' });
    pipes.partAlpha = partPipe('fsParticleAlpha', { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' });
    pipes.staticShadow = shadowPipe('vsStaticShadow', [vertLayout]);
    pipes.propShadow = shadowPipe('vsPropShadow', [vertLayout, propInstLayout]);
    pipes.carShadow = shadowPipe('vsCarShadow', [vertLayout, carInstLayout]);
    pipes.bloom = device.createRenderPipeline({
      layout: postLayout,
      vertex: { module: postMod, entryPoint: 'vsFull' },
      fragment: { module: postMod, entryPoint: 'fsBloom', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-list' },
    });
    const compositePipe = effects => device.createRenderPipeline({
      layout: postLayout,
      vertex: { module: postMod, entryPoint: 'vsFull' },
      fragment: { module: postMod, entryPoint: 'fsComposite', constants: { WITH_EFFECTS: effects, WITH_BLOOM: effects }, targets: [{ format }] },
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
    ndTex = device.createTexture({ size: [w, h], format: 'rgba16float', usage });
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
    return { vb, ib, count: m.idx.length, bounds, lods: (m.lods || []).map(createMesh) };
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
    if (!mesh.lods?.length || quality === 'high') return mesh;
    let distanceSquared = 0;
    for (let axis = 0; axis < 3; axis++) {
      const p = frame[16 + axis], d = Math.max(mesh.bounds.min[axis] - p, 0, p - mesh.bounds.max[axis]);
      distanceSquared += d * d;
    }
    const near = quality === 'eco' ? 250 : 450, far = quality === 'eco' ? 650 : 1000;
    return distanceSquared > far * far ? (mesh.lods[1] || mesh.lods[0]) : distanceSquared > near * near ? mesh.lods[0] : mesh;
  }

  // scene = { frame: Float32Array(FRAME_FLOATS), statics: [mesh], propGroups: [{mesh, inst, count, bounds}], carGroups: [...] }
  function render(scene) {
    if (lost) return;
    const started = performance.now(), settings = presets[quality];
    resize();
    scene.frame[72] = W; scene.frame[73] = H;
    device.queue.writeBuffer(frameBuf, 0, scene.frame);
    const enc = device.createCommandEncoder();
    const measure = timestampSet && !timestampPending && !captureDimensions;
    const stamps = pass => measure ? { querySet: timestampSet, beginningOfPassWriteIndex: pass * 2, endOfPassWriteIndex: pass * 2 + 1 } : undefined;
    const propList = [...(scene.props && scene.props.count ? [scene.props] : []), ...(scene.propGroups || [])];
    const cameraStatics = scene.statics.filter(m => visible(m.bounds, scene.frame)).map(m => chooseLod(m, scene.frame));
    const lightStatics = settings.shadowSize ? scene.statics.filter(m => visible(m.bounds, scene.frame, 84)).map(m => chooseLod(m, scene.frame)) : [];
    const cameraProps = propList.filter(g => g.count && visible(g.bounds, scene.frame));
    const lightProps = settings.shadowSize ? propList.filter(g => g.count && visible(g.bounds, scene.frame, 84)) : [];
    const cars = (scene.carGroups || []).filter(g => g.count);
    const triangles = (statics, props) => statics.reduce((n, m) => n + m.count / 3, 0) + [...props, ...cars].reduce((n, g) => n + g.mesh.count / 3 * g.count, 0);
    metrics.sceneTriangles = triangles(cameraStatics, cameraProps) + (scene.water?.count || 0) / 3;
    metrics.shadowTriangles = settings.shadowSize ? triangles(lightStatics, lightProps) : 0;
    metrics.drawCalls = cameraStatics.length + cameraProps.length + cars.length + 2 + (scene.water ? 1 : 0) + (settings.bloom ? 1 : 0) + (settings.shadowSize ? lightStatics.length + lightProps.length + cars.length : 0);
    metrics.culledGroups = scene.statics.length + propList.length - cameraStatics.length - cameraProps.length;
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
        for (const g of scene.carGroups) {
          if (!g.count) continue;
          p0.setVertexBuffer(0, g.mesh.vb); p0.setVertexBuffer(1, g.inst);
          p0.setIndexBuffer(g.mesh.ib, 'uint32'); p0.drawIndexed(g.mesh.count, g.count);
        }
      }
      p0.end();
    }
    const p1 = enc.beginRenderPass({
      timestampWrites: stamps(1),
      colorAttachments: [
        { view: sceneTex.createView(), loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' },
        { view: ndTex.createView(), loadOp: 'clear', clearValue: [0, 0, 0, 100000], storeOp: 'store' },
      ],
      depthStencilAttachment: { view: depthTex.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    p1.setBindGroup(0, sceneBG);
    p1.setPipeline(pipes.sky); p1.draw(3);
    p1.setPipeline(settings.shadowSize ? pipes.static : pipes.staticEco);
    for (const m of cameraStatics) { p1.setVertexBuffer(0, m.vb); p1.setIndexBuffer(m.ib, 'uint32'); p1.drawIndexed(m.count); }
    if (propList.length) {
      p1.setPipeline(settings.shadowSize ? pipes.prop : pipes.propEco);
      for (const g of cameraProps) { p1.setVertexBuffer(0, g.mesh.vb); p1.setVertexBuffer(1, g.inst); p1.setIndexBuffer(g.mesh.ib, 'uint32'); p1.drawIndexed(g.mesh.count, g.count); }
    }
    if (scene.carGroups) {
      p1.setPipeline(settings.shadowSize ? pipes.car : pipes.carEco);
      for (const g of scene.carGroups) {
        if (!g.count) continue;
        p1.setVertexBuffer(0, g.mesh.vb); p1.setVertexBuffer(1, g.inst);
        p1.setIndexBuffer(g.mesh.ib, 'uint32'); p1.drawIndexed(g.mesh.count, g.count);
      }
    }
    if (scene.water) {
      p1.setPipeline(pipes.water);
      p1.setVertexBuffer(0, scene.water.vb); p1.setIndexBuffer(scene.water.ib, 'uint32'); p1.drawIndexed(scene.water.count);
    }
    if (typeof Particles !== 'undefined' && Particles.fill && scene.particles !== false) {
      const pg = Particles.fill(scene.frame);
      if (pg.alpha.count) { p1.setPipeline(pipes.partAlpha); p1.setVertexBuffer(0, pg.alpha.inst); p1.draw(6, pg.alpha.count); metrics.drawCalls++; metrics.sceneTriangles += pg.alpha.count * 2; }
      if (pg.add.count) { p1.setPipeline(pipes.partAdd); p1.setVertexBuffer(0, pg.add.inst); p1.draw(6, pg.add.count); metrics.drawCalls++; metrics.sceneTriangles += pg.add.count * 2; }
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
        metrics.gpuMs = { scene: ms(1), composite: ms(3), shadow: settings.shadowSize ? ms(0) : 0, bloom: settings.bloom ? ms(2) : 0 };
        timestampRead.unmap();
      }).catch(() => {}).finally(() => { timestampPending = false; });
    }
    metrics.frames++; metrics.cpuSubmitMs = performance.now() - started;
  }

  return { init, resize, capture, setQuality, getQuality, setRenderScale, metrics, get qualitySettings() { return presets[quality]; }, get renderScale() { return renderScale; }, createMesh, createInstances, updateInstances, destroyGroups, destroyScene, render, FRAME_FLOATS, CAR_FLOATS };
})();
