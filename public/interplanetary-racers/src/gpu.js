// WebGPU renderer: scene pass (sky, terrain, track, props, cars) -> bloom -> composite.
const Gpu = (() => {
  let device, ctx, format, canvas;
  let frameBuf, sampler, pipes = {}, sceneBG, shadowBG, postBG, bloomBG;
  let sceneTex, ndTex, depthTex, bloomTex, shadowTex, shadowSampler, W = 0, H = 0;
  const FRAME_FLOATS = 144, SHADOW_SIZE = 2048;

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
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter found.');
    device = await adapter.requestDevice();
    device.lost.then(info => console.error('WebGPU device lost', info));
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
    shadowTex = device.createTexture({ size: [SHADOW_SIZE, SHADOW_SIZE], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
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
    sceneBG = device.createBindGroup({ layout: sceneBGL, entries: [
      { binding: 0, resource: { buffer: frameBuf } }, { binding: 1, resource: shadowTex.createView() }, { binding: 2, resource: shadowSampler },
    ] });
    shadowBG = device.createBindGroup({ layout: shadowBGL, entries: [{ binding: 0, resource: { buffer: frameBuf } }] });
    const sceneLayout = device.createPipelineLayout({ bindGroupLayouts: [sceneBGL] });
    const shadowLayout = device.createPipelineLayout({ bindGroupLayouts: [shadowBGL] });
    const postLayout = device.createPipelineLayout({ bindGroupLayouts: [postBGL] });
    const depth = (write, compare) => ({ format: 'depth24plus', depthWriteEnabled: write, depthCompare: compare });
    const targets = [{ format: 'rgba16float' }, { format: 'rgba16float' }];
    const scenePipe = (vs, buffers, write = true, compare = 'less') => device.createRenderPipeline({
      layout: sceneLayout,
      vertex: { module: sceneMod, entryPoint: vs, buffers },
      fragment: { module: sceneMod, entryPoint: 'fsScene', targets },
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
    pipes.composite = device.createRenderPipeline({
      layout: postLayout,
      vertex: { module: postMod, entryPoint: 'vsFull' },
      fragment: { module: postMod, entryPoint: 'fsComposite', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    pipes.postBGL = postBGL;
    resize();
    return device;
  }

  function resize(scale = 1) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
    const w = Math.max(8, Math.floor(canvas.clientWidth * dpr)), h = Math.max(8, Math.floor(canvas.clientHeight * dpr));
    if (w === W && h === H) return;
    W = w; H = h; canvas.width = w; canvas.height = h;
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    sceneTex?.destroy(); ndTex?.destroy(); depthTex?.destroy(); bloomTex?.destroy();
    sceneTex = device.createTexture({ size: [w, h], format: 'rgba16float', usage });
    ndTex = device.createTexture({ size: [w, h], format: 'rgba16float', usage });
    depthTex = device.createTexture({ size: [w, h], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    bloomTex = device.createTexture({ size: [Math.max(1, w >> 2), Math.max(1, h >> 2)], format: 'rgba16float', usage });
    const mk = (a, b) => device.createBindGroup({ layout: pipes.postBGL, entries: [
      { binding: 0, resource: { buffer: frameBuf } }, { binding: 1, resource: sampler },
      { binding: 2, resource: a.createView() }, { binding: 3, resource: b.createView() }, { binding: 4, resource: ndTex.createView() },
    ] });
    bloomBG = mk(sceneTex, sceneTex);
    postBG = mk(sceneTex, bloomTex);
  }

  function createMesh(m) {
    const vb = device.createBuffer({ size: m.verts.byteLength, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
    new Float32Array(vb.getMappedRange()).set(m.verts); vb.unmap();
    const ib = device.createBuffer({ size: m.idx.byteLength, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
    new Uint32Array(ib.getMappedRange()).set(m.idx); ib.unmap();
    return { vb, ib, count: m.idx.length };
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
    for (const m of meshes) { try { m.vb.destroy(); m.ib.destroy(); } catch (e) {} }
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

  // scene = { frame: Float32Array(72), statics: [mesh], props: {mesh, inst, count}, cars: {mesh, inst, count} }
  function render(scene) {
    resize();
    scene.frame[72] = W; scene.frame[73] = H;
    device.queue.writeBuffer(frameBuf, 0, scene.frame);
    const enc = device.createCommandEncoder();
    // Shadow pass: depth only, from the sun.
    const p0 = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: shadowTex.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    p0.setBindGroup(0, shadowBG);
    p0.setPipeline(pipes.staticShadow);
    for (const m of scene.statics) { p0.setVertexBuffer(0, m.vb); p0.setIndexBuffer(m.ib, 'uint32'); p0.drawIndexed(m.count); }
    const propList = [...(scene.props && scene.props.count ? [scene.props] : []), ...(scene.propGroups || [])];
    if (propList.length) {
      p0.setPipeline(pipes.propShadow);
      for (const g of propList) { if (!g.count) continue; p0.setVertexBuffer(0, g.mesh.vb); p0.setVertexBuffer(1, g.inst); p0.setIndexBuffer(g.mesh.ib, 'uint32'); p0.drawIndexed(g.mesh.count, g.count); }
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
    const p1 = enc.beginRenderPass({
      colorAttachments: [
        { view: sceneTex.createView(), loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' },
        { view: ndTex.createView(), loadOp: 'clear', clearValue: [0, 0, 0, 100000], storeOp: 'store' },
      ],
      depthStencilAttachment: { view: depthTex.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    p1.setBindGroup(0, sceneBG);
    p1.setPipeline(pipes.sky); p1.draw(3);
    p1.setPipeline(pipes.static);
    for (const m of scene.statics) { p1.setVertexBuffer(0, m.vb); p1.setIndexBuffer(m.ib, 'uint32'); p1.drawIndexed(m.count); }
    if (propList.length) {
      p1.setPipeline(pipes.prop);
      for (const g of propList) { if (!g.count) continue; p1.setVertexBuffer(0, g.mesh.vb); p1.setVertexBuffer(1, g.inst); p1.setIndexBuffer(g.mesh.ib, 'uint32'); p1.drawIndexed(g.mesh.count, g.count); }
    }
    if (scene.carGroups) {
      p1.setPipeline(pipes.car);
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
      if (pg.alpha.count) { p1.setPipeline(pipes.partAlpha); p1.setVertexBuffer(0, pg.alpha.inst); p1.draw(6, pg.alpha.count); }
      if (pg.add.count) { p1.setPipeline(pipes.partAdd); p1.setVertexBuffer(0, pg.add.inst); p1.draw(6, pg.add.count); }
    }
    p1.end();
    const p2 = enc.beginRenderPass({ colorAttachments: [{ view: bloomTex.createView(), loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' }] });
    p2.setPipeline(pipes.bloom); p2.setBindGroup(0, bloomBG); p2.draw(3); p2.end();
    const p3 = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' }] });
    p3.setPipeline(pipes.composite); p3.setBindGroup(0, postBG); p3.draw(3); p3.end();
    device.queue.submit([enc.finish()]);
  }

  return { init, resize, createMesh, createInstances, updateInstances, destroyGroups, destroyScene, render, FRAME_FLOATS, CAR_FLOATS };
})();
