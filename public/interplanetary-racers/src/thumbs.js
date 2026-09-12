// Small offscreen thumbnails share the GPU device without redrawing the game canvas.
const Thumbs = (() => {
  const TW = 336, TH = 180;                 // thumbnail pixels, matching the tile's picture area
  const cache = new Map();                  // key -> dataURL
  const queued = new Set();                 // keys already in the queue
  const jobs = [];                          // pending work, cheapest first
  const listeners = [];
  let canvas = null, lastRun = 0, budgetMs = 0;

  function init(cv) { canvas = cv; }
  function onReady(fn) { listeners.push(fn); }
  function ready(key) { for (const f of listeners) { try { f(key); } catch (e) {} } }
  function get(key) { return cache.get(key) || null; }
  function has(key) { return cache.has(key); }

  // A neutral studio descriptor: dark backdrop, no fog, no palette mapping, so the craft reads as itself.
  function studioDesc() {
    let base = null;
    try { base = Game.desc(); } catch (e) {}
    const d = base ? JSON.parse(JSON.stringify({
      sunDir: base.sunDir, dayTime: base.dayTime, pal5: base.pal5, emis: base.emis,
      twist: 0, quantize: 0, propType: base.propType, bandFreq: 2, bandPow: 6, bandAmt: 0, bright: false,
      groundPattern: 0, stars: 0,
    })) : { sunDir: [0.4, 0.7, 0.5], dayTime: 0.5, pal5: [[0.1, 0.1, 0.12], [0.3, 0.3, 0.34], [0.5, 0.5, 0.55], [0.7, 0.7, 0.74], [0.9, 0.9, 0.94]], emis: [1, 1, 1], twist: 0, quantize: 0, propType: 0, bandFreq: 2, bandPow: 6, bandAmt: 0, bright: false, groundPattern: 0, stars: 0 };
    d.sunDir = M.norm([0.45, 0.72, 0.53]);
    d.sky = [[0.085, 0.088, 0.105], [0.028, 0.030, 0.042]];
    d.fog = 0.00035;
    d.look = { colormap: 0, dither: 0, edge: 0.4, posterize: 0 };
    d.waterLevel = -1e4; d.biome = {};
    return d;
  }

  function bounds(mesh) {
    const v = mesh.verts, n = v.length / 12;
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const x = v[i * 12 + k]; if (x < lo[k]) lo[k] = x; if (x > hi[k]) hi[k] = x; }
    const c = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2);
    const r = Math.max(1e-3, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2);
    return { c, r };
  }

  // Distance that just fits the mesh in frame from a given direction, so every craft fills its tile equally.
  function fitDistance(mesh, centre, dir, fovV, aspect) {
    const right = M.norm(M.cross([0, 1, 0], dir)), up = M.cross(dir, right);
    const v = mesh.verts, n = v.length / 12;
    let maxU = 0, maxV = 0, near = 0;
    for (let i = 0; i < n; i++) {
      const p = [v[i * 12] - centre[0], v[i * 12 + 1] - centre[1], v[i * 12 + 2] - centre[2]];
      maxU = Math.max(maxU, Math.abs(M.dot(p, right)));
      maxV = Math.max(maxV, Math.abs(M.dot(p, up)));
      near = Math.max(near, M.dot(p, dir));
    }
    const tv = Math.tan(fovV * Math.PI / 360);
    return Math.max(maxV / tv, maxU / (tv * aspect)) * 1.07 + near;
  }

  function shoot(scene, desc, cam) {
    const frame = new Float32Array(Gpu.FRAME_FLOATS);
    Frame.fill(frame, desc, { ...cam, aspect: TW / TH }, { speed01: 0 });
    scene.frame = frame;
    scene.particles = false;
    try { return Gpu.capture(scene, { width: TW, height: TH }).toDataURL('image/png'); }
    catch (e) { console.warn('thumbnail capture failed', e); return null; }
  }

  function freeScene(scene) {
    const drop = m => { try { m.vb.destroy(); m.ib.destroy(); } catch (e) {} };
    for (const m of scene.statics || []) drop(m);
    if (scene.props && scene.props.mesh) { drop(scene.props.mesh); try { scene.props.inst.destroy(); } catch (e) {} }
    for (const g of scene.propGroups || []) { drop(g.mesh); try { g.inst.destroy(); } catch (e) {} }
    for (const g of scene.carGroups || []) { drop(g.mesh); try { g.inst.destroy(); } catch (e) {} }
    if (scene.water) drop(scene.water);
  }

  // ---------------------------------------------------------------- craft
  function craftJob(key, recipe, seedN, hue) {
    const mesh = Craft.build(recipe, seedN);
    const b = bounds(mesh);
    const gpuMesh = Gpu.createMesh(mesh);
    const data = new Float32Array(Gpu.CAR_FLOATS);
    const col = hsl(hue, 0.72, 0.56);
    data.set([1, 0, 0], 0); data.set([0, 1, 0], 3); data.set([0, 0, 1], 6);
    data.set([-b.c[0], -b.c[1], -b.c[2]], 9);            // centre the craft on the origin
    data.set(col, 12);
    data[15] = 0; data[16] = 0; data.set([1, 1, 1], 17); data[20] = 0.75; data[21] = 0; data[22] = 0;
    const scene = { statics: [], props: null, propGroups: [], carGroups: [{ mesh: gpuMesh, inst: Gpu.createInstances(data), count: 1 }], water: null };
    const fov = 26, az = 0.95, el = 0.30;
    const dir = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    const D = fitDistance(mesh, b.c, dir, fov, TW / TH);
    const pos = [dir[0] * D, dir[1] * D, dir[2] * D];
    const url = shoot(scene, studioDesc(), { pos, look: [0, 0, 0], fov, aspect: canvas.clientWidth / canvas.clientHeight, time: 0, shadowCenter: [0, 0, 0], shadowSize: Math.max(6, b.r * 2.2) });
    freeScene(scene);
    if (url) { cache.set(key, url); ready(key); }
  }
  function hsl(h, s, l) {
    const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0), f(8), f(4)];
  }

  // ---------------------------------------------------------------- planet
  // A cut-down build of the real world: same generators, coarser terrain, so the card shows the actual place.
  function planetJob(key, planet) {
    const desc = World.generate('thumb-' + planet.id, planet, null);
    const tab = World.buildSamples(desc, 420);
    const statics = [];
    let terrain = { heightAt: () => -600, ext: tab.maxR * 2 };
    if (!desc.noTerrain) { terrain = Geo.buildTerrain(desc, tab, 120, { flatten: false }); statics.push(Gpu.createMesh(terrain)); }
    const scene = { statics, props: null, propGroups: [], carGroups: [], water: null };
    const terrainLane = desc.laneStyle === 'terrain';
    try {
      const inst = terrainLane ? Geo.buildPropInstances(desc, tab, terrain) : Geo.buildVolumeProps(desc, tab);
      if (inst && inst.length) scene.props = { mesh: Gpu.createMesh(Geo.buildPropMesh(desc.propType)), inst: Gpu.createInstances(inst), count: inst.length / 8 };
    } catch (e) {}
    try {
      const env = Flora.buildScene(desc, tab, terrain);
      for (const g of env.groups) { if (!g.inst || !g.inst.length) continue; scene.propGroups.push({ mesh: Gpu.createMesh(g.mesh), inst: Gpu.createInstances(g.inst), count: g.inst.length / 8 }); }
      if (env.water) scene.water = Gpu.createMesh(env.water);
    } catch (e) {}
    // A handful of lane rings so the card reads as a race course, not just scenery.
    try {
      const R = desc.corridor.radius, ts = (tab.gateTs && tab.gateTs.length ? tab.gateTs : [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9]).slice(0, 40);
      const data = new Float32Array(Gpu.CAR_FLOATS * ts.length);
      ts.forEach((t, i) => {
        const s = World.sampleAt(tab, t), up = M.norm(M.cross(s.tan, s.right)), o = i * Gpu.CAR_FLOATS;
        data.set(s.right, o); data.set(up, o + 3); data.set(s.tan, o + 6); data.set(s.p, o + 9);
        data.set(desc.bright ? desc.pal5[1] : desc.pal5[3], o + 12);
        data[o + 15] = 0; data[o + 16] = 0; data.set([R, R, R], o + 17); data[o + 20] = desc.bright ? 0.25 : 0.7;
      });
      scene.carGroups.push({ mesh: Gpu.createMesh(Geo.buildRing(1, 0.05, 28, 6)), inst: Gpu.createInstances(data), count: ts.length });
    } catch (e) {}
    // Camera: sitting behind the lane looking down it, so the card shows the course the way you fly it.
    const t0 = 0.12, back = World.sampleAt(tab, t0 - 0.035), look0 = World.sampleAt(tab, t0 + 0.055);
    const side = 0.55, up = 26;
    const pos = [back.p[0] + back.right[0] * desc.corridor.radius * side, back.p[1] + up, back.p[2] + back.right[2] * desc.corridor.radius * side];
    const look = [look0.p[0], look0.p[1] + 4, look0.p[2]];
    let floor = -1e5;
    try { for (let i = 0; i <= 10; i++) { const u = i / 10, x = pos[0] + (look[0] - pos[0]) * u, z = pos[2] + (look[2] - pos[2]) * u; floor = Math.max(floor, terrain.heightAt(x, z)); } } catch (e) {}
    pos[1] = Math.max(pos[1], floor + 18);   // never end up inside a dune or a ridge
    const url = shoot(scene, desc, { pos, look, fov: 46, aspect: canvas.clientWidth / canvas.clientHeight, time: 0, shadowCenter: look, shadowSize: 200 });
    freeScene(scene);
    if (url) { cache.set(key, url); ready(key); }
  }

  // ---------------------------------------------------------------- queue
  function request(key, fn, cost) {
    if (cache.has(key) || queued.has(key)) return cache.get(key) || null;
    queued.add(key);
    jobs.push({ key, fn, cost: cost || 1 });
    jobs.sort((a, b) => a.cost - b.cost);
    return null;
  }
  function craft(key, recipe, seedN, hue) { return request(key, () => craftJob(key, recipe, seedN, hue), 1); }
  function planet(p) { const key = 'p:' + p.id; return request(key, () => planetJob(key, p), 5); }

  // Runs at most one small offscreen job per frame, only while a selector is on screen,
  // so a race never pays for thumbnail work.
  function pump(active) {
    if (document.hidden || !active || !jobs.length || !canvas) return;
    const now = performance.now();
    if (now - lastRun < 90) return;          // leave the UI room to breathe between builds
    const job = jobs.shift();
    lastRun = now;
    const t0 = performance.now();
    try { job.fn(); } catch (e) { console.warn('thumb failed', job.key, e); }
    budgetMs = performance.now() - t0;
    queued.delete(job.key);
    lastRun = performance.now();
  }

  return { init, craft, planet, get, has, onReady, pump, size: TW + 'x' + TH, stats: () => ({ cached: cache.size, pending: jobs.length, lastMs: +budgetMs.toFixed(0) }) };
})();
