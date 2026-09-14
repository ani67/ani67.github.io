// Galactic Racers game: hover craft physics (surface + corridor), bots, camera, race flow, HUD.
const Game = (() => {
  const { TAU, clamp, mix, smoothstep, mulberry32, norm, cross, sub, add, scale, dot, len } = M;
  const SPD = (typeof Planets !== 'undefined' && Planets.SPD) || 1; // global speed scale; speed-relative thresholds derive from it
  const NUM_CARS = Planets.MAX_RACERS; let LAPS = 3;
  let desc, tab, terrain, cars = [], player, scene, planet = null, raceDef = null, seedText, overrides = null, craftOverride = null;
  let coverMesh = null;
  let showcaseDirection = 0, showcaseStarted = -Infinity;
  let showcaseView = null, showcaseEntering = false, previewSnap = false;
  let terrainZoom = 1, terrainZoomFrom = 1, terrainZoomStarted = -Infinity;
  let showcasePaints = {}, dockMesh = null, dockDesc = null, showcaseGroups = [];
  let carGroups = [], gateGroup = null, boostGates = [], routeRings = [], routePrevious = null;
  let input = { steer: 0, throttle: 0, brake: 0, drift: false, pitch: 0 };
  let cam = { pos: [0, 30, 0], look: [0, 0, 0], fov: 52, up: [0, 1, 0] };
  let camMode = 'chase';
  const menuOrbit = { showcase: { yaw: 2.4, pitch: 0.22 }, gallery: { yaw: 0, pitch: 0.3 }, pointer: null, holdUntil: 0, speed: 1 };

  const camCfg = { back: 9, up: 3.6, ahead: 6 };
  let rs = { state: 'countdown', timer: 3.5, results: null, elapsed: 0 };
  let hud = {}, minimap, mmCtx, spCtx;
  let app = { state: 'cover' }, craftSeed = null, spectate = { idx: 1, timer: 0 }, playerName = null;
  const listeners = {}; const emit = (ev, ...a) => (listeners[ev] || []).forEach(f => f(...a));
  const frame = new Float32Array(Gpu.FRAME_FLOATS);
  const A = fn => { try { if (typeof Audio !== 'undefined' && Audio && Audio.sfx) return fn(Audio); } catch (e) {} };
  let lastCount = -1;
  let speedWarp = 0, warpSpeed = 0, warpValue = '';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let resetClock = () => {}, invalidate = () => {};

  // ---------------------------------------------------------------- setup
  async function start(canvasEl) {
    hud.canvas = canvasEl;
    hud.root = document.getElementById('hud');
    for (const id of ['lap', 'pos', 'msg', 'life', 'item', 'hitmark', 'vignette', 'hudPlanet', 'hudWhere', 'speedo', 'laneArrow']) hud[id] = document.getElementById(id);
    minimap = document.getElementById('minimap'); mmCtx = minimap.getContext('2d'); spCtx = hud.speedo.getContext('2d');
    await Gpu.init(canvasEl);
    bindInput();
    applyHash();
    let last = performance.now(), lastDraw = last, accumulator = 0;
    let sampleAt = last, sampleFrames = 0, slowFor = 0, healthyFor = 0;
    let wasSuspended = false, pendingFrame = null, pausedDirty = false;
    let sampleKey = `${rs.state}:${quality()}`;
    const requestFrame = () => {
      const netPaused = typeof MP !== 'undefined' && MP.paused && MP.paused();
      if (pendingFrame === null && !document.hidden && ((!paused && !netPaused) || pausedDirty)) pendingFrame = requestAnimationFrame(loop);
    };
    resetClock = () => {
      last = lastDraw = sampleAt = performance.now(); accumulator = 0;
      sampleFrames = slowFor = healthyFor = 0; perf.fps = 0;
      sampleKey = `${rs.state}:${quality()}`;
      requestFrame();
    };
    invalidate = () => {
      if (paused || (typeof MP !== 'undefined' && MP.paused && MP.paused())) pausedDirty = true;
      if (rs.state === 'idle') resetClock(); else requestFrame();
    };
    const STEP = 1 / 60, MAX_CATCHUP = 0.1;
    const loop = now => {
      pendingFrame = null;
      const wallDt = Math.max(0, (now - last) / 1000); last = now;
      const netPaused = typeof MP !== 'undefined' && MP.paused && MP.paused();
      const suspended = document.hidden || paused || netPaused;
      if (suspended || wasSuspended) {
        accumulator = 0; lastDraw = now; sampleAt = now; sampleFrames = 0;
        slowFor = healthyFor = 0;
        wasSuspended = suspended;
        if (suspended) {
          if (pausedDirty && !document.hidden) { draw(0); perf.renderedFrames++; pausedDirty = false; }
          return;
        }
      }
      requestFrame();
      const dt = Math.min(MAX_CATCHUP, wallDt);
      if (rs.state !== 'idle') {
        perf.droppedSeconds += Math.max(0, wallDt - MAX_CATCHUP);
        accumulator += dt;
        // Keep the original 60 Hz update and its three 1/180 s flight/collision
        // substeps, independently of display refresh rate or graphics preset.
        while (accumulator + 1e-9 >= STEP) {
          update(STEP); accumulator -= STEP; perf.simulationSteps++;
        }
      } else accumulator = 0;
      // Visible menus orbit continuously at 30 FPS, without running race simulation.
      const fps = rs.state === 'idle' ? 30 : (Gpu.qualitySettings?.fps || (quality() === 'eco' ? 30 : 60));
      const nextSampleKey = `${rs.state}:${quality()}:${fps}`;
      if (nextSampleKey !== sampleKey) {
        sampleAt = now; sampleFrames = slowFor = healthyFor = 0;
        sampleKey = nextSampleKey; perf.fps = 0;
      }
      const interval = 1000 / fps, elapsed = now - lastDraw;
      if (elapsed < interval - 0.5) return;
      // Retain the fractional frame remainder without trying to render missed frames.
      lastDraw = now - (elapsed % interval);
      if (elapsed < interval) lastDraw = now;
      const drawDt = Math.min(0.1, elapsed / 1000);
      if (rs.state === 'idle') updateCamera(drawDt);
      else { updateHud(); }
      draw(drawDt);
      perf.renderedFrames++; sampleFrames++;
      perf.targetFps = fps;
      if (now - sampleAt >= 3000) {
        const seconds = (now - sampleAt) / 1000;
        perf.fps = sampleFrames / seconds;
        if (rs.state !== 'idle') {
          // Frame pacing is a load signal, not a temperature measurement. Lower
          // resolution after sustained misses; recover slowly below preset ceiling.
          const ratio = perf.fps / fps;
          slowFor = ratio < 0.88 ? slowFor + seconds : 0;
          healthyFor = ratio > 0.97 ? healthyFor + seconds : 0;
          const scale = Gpu.renderScale || 1;
          if (slowFor >= 3 && scale > 0.5 && Gpu.setRenderScale) {
            Gpu.setRenderScale(Math.max(0.5, scale - 0.1)); slowFor = healthyFor = 0;
          } else if (healthyFor >= 30 && quality() !== 'eco' && scale < 1 && Gpu.setRenderScale) {
            Gpu.setRenderScale(Math.min(1, scale + 0.05)); healthyFor = 0;
          }
        }
        sampleAt = now; sampleFrames = 0;
      }
    };
    document.addEventListener('visibilitychange', () => {
      resetClock();
      emit('visibility', { hidden: document.hidden, multiplayer: typeof MP !== 'undefined' && MP.active() });
    });
    window.addEventListener('resize', () => invalidate());
    window.addEventListener('pointerdown', () => { if (rs.state === 'idle') invalidate(); });
    if (typeof MP !== 'undefined' && MP.onChange) MP.onChange(() => resetClock());
    requestFrame();
  }
  let paused = false;
  const perf = { renderedFrames: 0, simulationSteps: 0, droppedSeconds: 0, fps: 0, targetFps: 12 };
  const quality = () => Gpu.getQuality ? Gpu.getQuality() : 'balanced';
  function setQuality(name) {
    if (!['eco', 'balanced', 'high'].includes(name)) return;
    if (Gpu.setQuality) Gpu.setQuality(name);
    resetClock();
    emit('quality', quality());
  }
  function setPaused(value) {
    paused = !!value && !(typeof MP !== 'undefined' && MP.active());
    resetClock();
    emit('pause', paused);
  }

  function randomSeedName() { return World.nameFor((Math.random() * 4294967296) >>> 0).replace(' ', '-') + '-' + Math.floor(Math.random() * 900 + 100); }

  // Hash: #p=planet&r=race&s=seed&o=<b64 json world overrides>&v=<b64 json craft>. A bare hash is a seed.
  const b64e = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))), b64d = s => JSON.parse(decodeURIComponent(escape(atob(s))));
  function parseHash() {
    const h = location.hash.slice(1);
    if (!h) return {};
    if (!h.includes('=')) return { s: h };
    const q = new URLSearchParams(h), o = {};
    for (const [k, v] of q) o[k] = v;
    return o;
  }
  function applyHash() {
    const q = parseHash();
    // A link with a seed, a craft or overrides opens the race directly; a bare load shows the cover.
    const direct = q.skip === '1' || !!q.s || !!q.v || !!q.o;
    planet = q.p ? Planets.planet(q.p) || null : null;
    raceDef = q.r ? Planets.race(q.r) || null : null;
    if (!planet) planet = direct ? (q.s ? null : Planets.PLANETS[0]) : Planets.PLANETS[Math.floor(Math.random() * Planets.PLANETS.length)];
    if (!raceDef) raceDef = planet ? Planets.RACES.find(r => r.planet === planet.id) || Planets.RACES[0] : Planets.RACES[0];
    try { overrides = q.o ? b64d(q.o) : null; } catch (e) { overrides = null; }
    try { craftOverride = q.v ? b64d(q.v) : null; } catch (e) { craftOverride = null; }
    app.state = direct ? 'race' : 'cover';
    loadWorld(q.s || randomSeedName());
  }
  function writeHash() {
    if (app.state !== 'race' && app.state !== 'results') { if (location.hash) history.replaceState(null, '', location.pathname + location.search); return; }
    const q = new URLSearchParams();
    if (planet) q.set('p', planet.id);
    if (raceDef) q.set('r', raceDef.id);
    q.set('s', seedText);
    if (overrides) q.set('o', b64e(overrides));
    if (craftOverride) q.set('v', b64e(craftOverride));
    const h = '#' + q.toString();
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  function loadWorld(seedInput, sharedDescriptor = null) {
    Gpu.destroyScene(scene);
    // Terrain changes retain the selected craft and its GPU buffers.
    if (app.state !== 'gallery') { Gpu.destroyGroups(showcaseGroups); showcaseGroups = []; }
    if (dockMesh) Gpu.destroyGroups([{mesh:dockMesh}]); dockMesh = null; dockDesc = null;
    scene = null; carGroups = []; gateGroup = null;
    if (coverMesh) Gpu.destroyGroups([{mesh:coverMesh}]); coverMesh = null;
    seedText = String(seedInput);
    desc = sharedDescriptor ? JSON.parse(JSON.stringify(sharedDescriptor)) : World.generate(seedText, planet, overrides);
    tab = World.buildSamples(desc, 800);
    if (!tab.length) { let L = 0; for (let i = 0; i < tab.N; i++) L += len(sub(tab.S[(i + 1) % tab.N].p, tab.S[i].p)); tab.length = L; }
    const corridor = desc.mode === 'corridor', terrainLane = desc.laneStyle === 'terrain';
    const statics = [];
    if (desc.noTerrain) terrain = { heightAt: () => -600, ext: tab.maxR * 2 };
    else {
      terrain = Geo.buildTerrain(desc, tab, 300, { flatten: false }); // flight only: no road deck, no shoulders
      for (const chunk of Geo.terrainChunks(terrain)) statics.push(Gpu.createMesh(chunk));
    }
    const propMesh = Geo.buildPropMesh(desc.propType);
    const propInst = clearLane(terrainLane ? Geo.buildPropInstances(desc, tab, terrain) : Geo.buildVolumeProps(desc, tab), 0.5, 1);
    propGrid = new Map();
    const pt = desc.propType;
    addPropGrid(propInst, pt === 2 ? 0.25 : pt === 3 ? 0.3 : 0.5, 1, pt === 3);
    scene = { frame, statics, props: null, carGroups: [], propGroups: [], water: null };
    const addVisibleProps = (mesh, instances) => {
      if (!instances.length) return;
      const gpuMesh = Gpu.createMesh(Geo.withLods(mesh));
      for (const chunk of Geo.instanceChunks(mesh, instances)) {
        scene.propGroups.push({ mesh: gpuMesh, inst: Gpu.createInstances(chunk.data), count: chunk.data.length / 8, bounds: chunk.bounds, lodThresholds: [220, 500] });
      }
    };
    addVisibleProps(propMesh, propInst);
    const t0 = performance.now();
    const env = Flora.buildScene(desc, tab, terrain);
    let floraCount = 0;
    for (const g of env.groups) {
      const inst = g.collide ? clearLane(g.inst, g.r || 0.5, g.h || 1) : g.inst;
      if (!inst.length) continue;
      addVisibleProps(g.mesh, inst);
      if (g.collide) addPropGrid(inst, g.r, g.h, g.soft);
      floraCount += inst.length / 8;
    }
    if (env.water) scene.water = Gpu.createMesh(env.water);
    console.log(`biome: ${floraCount} instances in ${(performance.now() - t0).toFixed(0)} ms`);
    buildGates();
    setupCars();
    beginPhase();
    hud.hudPlanet.textContent = planet ? planet.name : desc.name;
    hud.hudWhere.textContent = `${desc.name} · ${desc.laneStyle} lane · seed ${seedText}`;
    writeHash();
    drawMinimapBase();
    A(a => a.planet(desc));   // retune the generative music to this world
    cam.pos = [player.x, player.y + 24, player.z - 36]; cam.look = [player.x, player.y, player.z];
    if (app.state === 'gallery') previewSnap = true;
    resetClock();
  }
  // Race state and camera for the current app state (cover, showcase, gallery, race).
  function beginPhase() {
    paused = false;
    if (app.state === 'race') { rs = { state: 'countdown', timer: 3.5, results: null, elapsed: 0 }; camMode = 'chase'; lastCount = -1; A(a => { a.init(); a.race('countdown'); }); }
    else { rs = { state: 'idle', timer: 0, results: null, elapsed: 0 }; camMode = (app.state === 'showcase' || app.state === 'gallery') ? 'showcase' : 'gallery'; A(a => { a.engineStopAll(); a.wind(0); a.race('menu'); }); }
    resetClock();
  }

  // Remove prop instances whose footprint intersects the lane tube (plus a margin) so lanes never pass through scenery.
  function clearLane(inst, rFactor, hFactor) {
    if (!inst || !inst.length) return inst;
    // Faster craft need more room to react, so the cleared tube grows with the speed scale.
    const { S, N } = tab, R = desc.corridor.radius, margin = 6 * SPD;
    const out = [];
    for (let i = 0; i < inst.length; i += 8) {
      const x = inst[i], y = inst[i + 1], z = inst[i + 2], r = inst[i + 3] * rFactor, h = inst[i + 4] * hFactor;
      let best = Infinity, bi = 0;
      for (let j = 0; j < N; j += 4) { const dx = S[j].p[0] - x, dz = S[j].p[2] - z, dd = dx * dx + dz * dz; if (dd < best) { best = dd; bi = j; } }
      for (let j = bi - 4; j <= bi + 4; j++) { const q = S[(j + N) % N]; const dx = q.p[0] - x, dz = q.p[2] - z, dd = dx * dx + dz * dz; if (dd < best) { best = dd; bi = (j + N) % N; } }
      const ly = S[bi].p[1], dh = Math.sqrt(best);
      const hit = dh < R + r + margin && ly - R - margin < y + h && ly + R + margin > y;
      if (!hit) for (let k = 0; k < 8; k++) out.push(inst[i + k]);
    }
    return new Float32Array(out);
  }

  // Corridor gates: rings along the spline, every 6th is a boost gate. Uses the craft instance layout.
  function buildGates() {
    gateGroup = null; boostGates = []; routeRings = []; routePrevious = null;
    const { S, N } = tab, R = desc.corridor.radius;
    let length = 0; for (let i = 0; i < N; i++) length += len(sub(S[(i + 1) % N].p, S[i].p));
    // Rings at the entries of interesting pieces, filled so no gap exceeds the planet's gate spacing.
    const gap = desc.corridor.gate / Math.max(1, length);
    let ts = (tab.gateTs && tab.gateTs.length ? tab.gateTs.slice() : [0]).map(t => ((t % 1) + 1) % 1).sort((a, b) => a - b);
    const filled = [];
    for (let k = 0; k < ts.length; k++) {
      const a = ts[k], b = k + 1 < ts.length ? ts[k + 1] : ts[0] + 1;
      filled.push(a);
      const span = b - a, m = Math.floor(span / (gap * 1.15));
      for (let j = 1; j <= m; j++) filled.push((a + span * j / (m + 1)) % 1);
    }
    ts = filled.sort((a, b) => a - b);
    const n = ts.length;
    const MARK = 14;
    const data = new Float32Array(Gpu.CAR_FLOATS * (n + Math.floor(length / MARK)));
    let o = 0;
    const put = (s, sc, col, glow) => {
      const up = norm(cross(s.tan, s.right));
      data.set(s.right, o); data.set(up, o + 3); data.set(s.tan, o + 6); data.set(s.p, o + 9); data.set(col, o + 12);
      data[o + 15] = 0; data[o + 16] = 0; data.set([sc, sc, sc], o + 17); data[o + 20] = glow; o += Gpu.CAR_FLOATS;
    };
    // Designed boost gates snap to the nearest ring; otherwise every third ring boosts.
    const designed = tab.boostTs && tab.boostTs.length ? tab.boostTs : null;
    for (let k = 0; k < n; k++) {
      const t = ts[k], s = World.sampleAt(tab, t);
      const boost = designed ? designed.some(g => { let e = t - g; e -= Math.round(e); return Math.abs(e) < gap * 0.5; }) : k % 3 === 1;
      if (boost) boostGates.push(t);
      put(s, R, boost ? [1, 0.48, 0.06] : [0.04, 0.65, 0.95], 0.35);
      routeRings.push({ t, p: s.p, tan: s.tan, radius: R, boost, flash: 0 });
    }
    if (!boostGates.length) boostGates.push(1 / n);
    const ringCount = n;
    const m = Math.floor(length / MARK);
    for (let k = 0; k < m; k++) {
      put(World.sampleAt(tab, k / m), 0.65, [0.06, 0.72, 1], 0.4);
      data[o - Gpu.CAR_FLOATS + 15] = k / m * length / 112; // phase along the route, not world axes
    }
    const routeMesh = (mesh, part) => { for (let i = 9; i < mesh.verts.length; i += Geo.STRIDE) mesh.verts[i] = part; return mesh; };
    const ring = Gpu.createMesh(routeMesh(Geo.buildRing(1, 0.032, 48, 6), 8)), cube = Gpu.createMesh(routeMesh(Geo.buildCube(), 9));
    const ringData = data.slice(0, ringCount * Gpu.CAR_FLOATS);
    const buf = Gpu.createInstances(ringData);
    gateGroup = [
      { mesh: ring, inst: buf, count: ringCount, data: ringData },
      { mesh: cube, inst: Gpu.createInstances(data.subarray(ringCount * Gpu.CAR_FLOATS)), count: m },
    ];
  }

  // Only the small ring buffer changes on the CPU. The travelling dot wave is
  // evaluated in the existing vertex shader, with no particles or extra passes.
  function updateRouteCues(dt) {
    if (!gateGroup || !player) return;
    const active = rs.state === 'racing' || rs.state === 'countdown';
    const position = [player.x, player.y, player.z];
    let nearest = -1, ahead = Infinity;
    for (let i = 0; i < routeRings.length; i++) {
      const distance = (routeRings[i].t - player.t + 1) % 1;
      if (distance < ahead) { ahead = distance; nearest = i; }
    }
    const moved = routePrevious && len(sub(position, routePrevious)) < 100;
    const data = gateGroup[0].data;
    for (let i = 0; i < routeRings.length; i++) {
      const ring = routeRings[i], offset = sub(position, ring.p), along = dot(offset, ring.tan);
      if (active && moved && player.wrecked <= 0 && dot(sub(routePrevious, ring.p), ring.tan) < 0 && along >= 0 && along < 100) {
        const radial = len(sub(offset, scale(ring.tan, along)));
        if (radial < ring.radius * 0.94) {
          ring.flash = 1;
          if (!ring.boost) A(a => a.sfx.routePassed());
        }
      }
      if (!active) ring.flash = 0;
      else ring.flash = Math.max(0, ring.flash - Math.min(dt, 0.1) * 1.8);
      const o = i * Gpu.CAR_FLOATS;
      const target = active && i === nearest ? 1 : 0;
      const ease = 1 - Math.exp(-Math.max(0, Math.min(dt, 0.1)) * 3);
      ring.focus = (ring.focus || 0) + (target - (ring.focus || 0)) * ease;
      data[o + 20] = 0.12 + ring.focus * (1.08 + 1.2 * (1 - smoothstep(20, 260, len(offset))));
      data[o + 21] = ring.focus;
      data[o + 22] = reducedMotion.matches ? 0 : ring.flash;
    }
    Gpu.updateInstances(gateGroup[0].inst, data);
    routePrevious = active ? position : null;
  }

  function craftParams(race) {
    const e=Fleet.forRace(race);
    const paint=race===raceDef?(craftOverride?.paint||craftSeed||1):(app.state === 'showcase' ? showcasePaints[e.id] || e.defaultPaint : 2+Planets.RACES.indexOf(race)%Planets.PLANETS.length);
    return {recipe:Fleet.recipe(e.id,paint),seed:1};
  }
  function getPlayerName() {
    if (playerName) return playerName;
    try { playerName = localStorage.getItem('ir.name'); } catch (e) {}
    if (!playerName) { playerName = Names.pick(); try { localStorage.setItem('ir.name', playerName); } catch (e) {} }
    return playerName;
  }
  const cssColor = c => `rgb(${c.map(v => Math.round(clamp(v, 0, 1) * 255)).join(',')})`;
  // In a room the roster decides who sits in which slot; in single player slot 0 is the local craft and the rest are bots.
  function craftParamsFor(e) {
    const race = Planets.race(e.raceId) || Planets.RACES[0];
    return {recipe:Fleet.recipe(Fleet.forRace(race).id,e.archSeed||1),seed:1};
  }
  // Reuse CPU meshes across setup screens and restarts. GPU buffers still follow
  // scene ownership, so changing worlds cannot leave stale/destroyed handles.
  const craftMeshes = new Map();
  let craftMeshBytes = 0;
  function preparedCraft(params) {
    const key = JSON.stringify([params.recipe, params.seed]);
    const cached = craftMeshes.get(key);
    if (cached) { craftMeshes.delete(key); craftMeshes.set(key, cached); return cached.mesh; }
    const mesh = Geo.withLods(params.recipe.fleetId ? Fleet.build(params.recipe) : Craft.build(params.recipe, params.seed));
    const arrays = new Set([mesh, ...(mesh.lods || [])].flatMap(m => [m.verts, m.idx]));
    const bytes = [...arrays].reduce((sum, a) => sum + a.byteLength, 0);
    const budget = 16 * 1024 * 1024;
    while (craftMeshes.size && (craftMeshes.size >= 24 || craftMeshBytes + bytes > budget)) {
      const oldest = craftMeshes.keys().next().value;
      craftMeshBytes -= craftMeshes.get(oldest).bytes; craftMeshes.delete(oldest);
    }
    if (bytes <= budget) { craftMeshes.set(key, { mesh, bytes }); craftMeshBytes += bytes; }
    return mesh;
  }
  function setupCars() {
    routePrevious = null; for (const ring of routeRings) { ring.flash = 0; ring.focus = 0; }
    // The environment and gates survive craft changes, but craft and weapon buffers do not.
    Gpu.destroyGroups(carGroups);
    const persistentShip = app.state === 'gallery' ? showcaseGroups.find(g => !g.outgoing) : null;
    const outgoing = app.state === 'showcase' && showcaseDirection && !reducedMotion.matches ? showcaseGroups.find(g => !g.outgoing) : null;
    Gpu.destroyGroups(showcaseGroups.filter(g => g !== outgoing && g !== persistentShip));
    showcaseGroups = persistentShip ? [persistentShip] : outgoing ? [outgoing] : [];
    if (outgoing) outgoing.outgoing = true;
    if (typeof Weapons !== 'undefined') Gpu.destroyGroups(Weapons.groups());
    cars = []; carGroups = [];
    const rnd = mulberry32(desc.seed ^ 0x51A7);
    const roster = (typeof MP !== 'undefined' && MP.roster) ? MP.roster() : null;
    const localSlot = roster ? MP.localSlot() : 0;
    const others = Planets.RACES.filter(r => r !== raceDef).sort(() => rnd() - 0.5);
    const groups = new Map();
    for (let i = 0; i < NUM_CARS; i++) {
      const r = roster ? (Planets.race(roster[i].raceId) || Planets.RACES[0]) : (i === 0 ? raceDef : others[(i - 1) % others.length]);
      const s = World.sampleAt(tab, 1 - (i * 0.012 + 0.01));
      const lane = (i % 2 === 0 ? -1 : 1) * 0.45;
      const up = norm(cross(s.tan, s.right));
      const p = add(s.p, scale(s.right, lane * desc.corridor.radius * 0.45));
      const key = roster ? 'mp' + i : r.vehicle + (i === 0 && craftOverride ? '#custom' : '');
      if (!groups.has(key)) groups.set(key, { key, params: roster ? craftParamsFor(roster[i]) : craftParams(r), ids: [] });
      groups.get(key).ids.push(i);
      const ph = desc.physics;
      const gp = groups.get(key).params;
      const st = Stats.compute(gp.recipe, gp.seed, r.ability);
      const hb = (() => { try { return Craft.hullBounds(gp.recipe.hull); } catch (e) { return null; } })();
      const wingSpan = (gp.recipe.parts || []).filter(pt => pt.type === 'wing').reduce((m, pt) => Math.max(m, (pt.span || 1) + Math.abs((pt.at || [0])[0])), 0);
      const box = { hw: Math.max(0.9, hb ? hb.halfW : 0.9, wingSpan * 0.6), hl: Math.max(1.6, hb ? hb.len / 2 : 2.2) };
      // Hue: the local craft keeps its chosen colour; in a room each slot is nudged so two of the same race still differ.
      const hue = roster ? r.hue + i * 0.031
        : (i === 0 && craftOverride && craftOverride.hue !== undefined ? craftOverride.hue : r.hue) + (i === 0 ? 0 : (rnd() - 0.5) * 0.06);
      cars.push({
        stats: st, recipe: gp.recipe, box, mass: st.massMul, life: st.life, lifeMax: st.life, dmg: 0, wrecked: 0, wrecks: 0, shield: 0, item: null, useItem: false, itemCd: 0, hitMark: 0, padPitch: 0, padRoll: 0,
        // Stats includes bounded faction/role bonuses and the actual selected craft seed.
        id: i, isBot: roster ? roster[i].bot : i !== 0, race: r, ab: st.ability, x: p[0], z: p[2], y: p[1], heading: Math.atan2(s.tan[0], s.tan[2]), pitch: 0, jumpCd: 0, outLane: 0, outTime: 0, alt: 99, camPitch: 0, stunEvents: 0,
        vx: 0, vz: 0, vy: 0, t: s.t, lap: 0, half: false, prog: 0, spin: 0, steer: 0, boost: 0, charge: 0, drifting: false, glow: 0,
        color: hsl(((hue % 1) + 1) % 1, 0.75, 0.55), body: [1, 1, 1],
        lane: (rnd() - 0.5) * 1.2, laneY: (rnd() - 0.5), laneT: rnd() * 10, skill: 0.75 + rnd() * 0.25, finished: false, finishTime: 0,
        maxSpeed: ph.maxSpeed * st.speedMul, speed: 0, lat: 0, sample: s, yaw: 0, air: false, onRoad: true, stun: 0, shake: 0, flash: 0, offTime: 0, hits: 0, roll: 0, lastGate: -1,
      });
    }
    player = cars[roster ? localSlot : 0];
    const pick = Names.picker(mulberry32(desc.seed ^ 0xBEEF));
    for (const c of cars) { c.isPlayer = c === player; c.name = c.isBot ? pick() : (c === player ? getPlayerName() : pick()); }
    if (roster) MP.assignCars(cars);
    document.documentElement.style.setProperty('--accent', cssColor(player.color));
    for (const g of groups.values()) {
      const raw = preparedCraft(g.params);
      let ext = 1, radius = 1, ylo = 1e9, yhi = -1e9;
      for (let k = 0; k < raw.verts.length; k += Geo.STRIDE) { radius = Math.max(radius, Math.hypot(raw.verts[k], raw.verts[k + 1], raw.verts[k + 2])); ext = Math.max(ext, Math.hypot(raw.verts[k], raw.verts[k + 2])); const y = raw.verts[k + 1]; if (y < ylo) ylo = y; if (y > yhi) yhi = y; }
      const vcen = ylo < yhi ? (ylo + yhi) / 2 : 0.8;   // hull mid-height, so the showcase camera can centre the craft
      for (const ci of g.ids) { cars[ci].extent = ext; cars[ci].previewRadius = radius; cars[ci].vcen = vcen; }
      const mesh = Gpu.createMesh(raw);
      const data = new Float32Array(Gpu.CAR_FLOATS * g.ids.length);
      carGroups.push({ mesh, inst: Gpu.createInstances(data), data, count: g.ids.length, ids: g.ids });
    }
    // In a room only the host decides damage; a client's weapons run for the visuals and take life from snapshots.
    const authoritative = () => !(typeof MP !== 'undefined' && MP.active() && MP.isClient());
    Weapons.build({
      cars, tab, desc, terrain, corridor: true, seed: desc.seed,
      damage: (c, a, s) => { if (authoritative()) damage(c, a, s); },
      hit: (c, s, sp) => { if (authoritative()) hit(c, s, sp); },
    });
    scene.carGroups = [...carGroups, ...(gateGroup || []), ...Weapons.groups()];
    if ((app.state === 'showcase' || app.state === 'gallery')) {
      const selected = Fleet.forRace(raceDef).raceIndex;
      showcaseStarted = outgoing || showcaseEntering ? performance.now() : -Infinity;
      for (const slot of persistentShip ? [] : [0]) {
        const entry = Fleet.entries[(selected+slot+Fleet.entries.length)%Fleet.entries.length];
        const paint = slot === 0 ? (craftOverride?.paint || craftSeed || 1) : (showcasePaints[entry.id] || entry.defaultPaint);
        const raw = preparedCraft({recipe:Fleet.recipe(entry.id,paint),seed:1});
        const data = new Float32Array(Gpu.CAR_FLOATS);
        showcaseGroups.push({mesh:Gpu.createMesh(raw),inst:Gpu.createInstances(data),data,count:1,slot,lodDistance:0});
      }
    }
  }
  function hsl(h, s, l) {
    const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0), f(8), f(4)];
  }

  // ---------------------------------------------------------------- input
  const keys = {};
  function bindInput() {
    window.addEventListener('keydown', e => {
      if (app.state !== 'race' || paused || document.querySelector('#settings.on')) return; // menus own the keyboard elsewhere
      if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      keys[e.code] = true;
      const sharedMap = typeof MP !== 'undefined' && MP.connected();
      if (!sharedMap && e.code === 'KeyN') loadWorld(randomSeedName());
      if (e.code === 'KeyR') respawn(player);
      if ((e.code === 'KeyE' || e.code === 'Enter') && rs.state === 'racing') { player.useItem = true; if (typeof MP !== 'undefined' && MP.active() && MP.isClient()) MP.useItem(); }
      if (!sharedMap && /^Digit[0-9]$/.test(e.code)) { const d = +e.code[5]; const p = Planets.PLANETS[d === 0 ? 9 : d - 1]; if (p) { planet = p; overrides = null; loadWorld(randomSeedName()); } }
      if (e.code === 'KeyM') { const m = A(a => a.mute()); const el = document.getElementById('muted'); if (el) el.hidden = !m; }
      if (e.code === 'KeyC') camMode = camMode === 'cockpit' ? 'chase' : 'cockpit';
      if (e.code === 'KeyG') camMode = camMode === 'gallery' ? 'chase' : 'gallery';
      if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    // Drag the open preview area; buttons, paint controls and scrolling rails retain their gestures.
    const orbitScreen = () => document.querySelector('#ship.on, #planet.on');
    window.addEventListener('pointerdown', e => {
      const screen = orbitScreen();
      if (!screen || paused || e.button !== 0 || menuOrbit.pointer !== null || !screen.contains(e.target) || e.target.closest('button,a,input,select,label,.rail,.tile')) return;
      menuOrbit.pointer = e.pointerId; menuOrbit.x = e.clientX; menuOrbit.y = e.clientY;
      menuOrbit.speed = 0; screen.setPointerCapture(e.pointerId); screen.style.cursor = 'grabbing';
    });
    window.addEventListener('pointermove', e => {
      if (menuOrbit.pointer !== e.pointerId) return;
      if (rs.state !== 'idle' || !orbitScreen()) { menuOrbit.pointer = null; return; }
      const orbit = menuOrbit[camMode];
      if (!orbit) return;
      orbit.yaw -= (e.clientX-menuOrbit.x)*0.007;
      orbit.pitch = clamp(orbit.pitch+(e.clientY-menuOrbit.y)*0.005,-0.3,1.25);
      menuOrbit.x=e.clientX; menuOrbit.y=e.clientY;
      e.preventDefault();
    });
    const endOrbit = e => {
      if (e && menuOrbit.pointer !== e.pointerId) return;
      menuOrbit.pointer = null; menuOrbit.holdUntil = performance.now()+2200;
      for (const screen of document.querySelectorAll('#ship, #planet')) screen.style.cursor = '';
    };
    window.addEventListener('pointerup',endOrbit);
    window.addEventListener('pointercancel',endOrbit);
    window.addEventListener('blur',()=>endOrbit());

    window.addEventListener('hashchange', () => { const q = parseHash(); if ((q.s || '') !== seedText || (q.p || '') !== (planet ? planet.id : '')) applyHash(); });
    const touches = new Map(), tc = hud.canvas;
    const clearInput = () => { for (const key of Object.keys(keys)) delete keys[key]; touches.clear(); readInput(); };
    window.addEventListener('blur', clearInput);
    window.addEventListener('ir:clear-input', clearInput);
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
    const upd = () => {
      let steer = 0, gas = 0, drift = false;
      for (const [, t] of touches) { const fx = t.x / window.innerWidth; if (fx < 0.3) steer -= 1; else if (fx > 0.7) steer += 1; gas = 1; }
      if (touches.size >= 2) drift = true;
      keys.touchSteer = steer; keys.touchGas = gas; keys.touchDrift = drift;
    };
    tc.addEventListener('touchstart', e => { for (const t of e.changedTouches) touches.set(t.identifier, { x: t.clientX }); upd(); e.preventDefault(); }, { passive: false });
    tc.addEventListener('touchmove', e => { for (const t of e.changedTouches) touches.set(t.identifier, { x: t.clientX }); upd(); e.preventDefault(); }, { passive: false });
    tc.addEventListener('touchend', e => { for (const t of e.changedTouches) touches.delete(t.identifier); upd(); }, { passive: false });
    tc.addEventListener('touchcancel', e => { for (const t of e.changedTouches) touches.delete(t.identifier); upd(); }, { passive: false });
  }
  function readInput() {
    // Flight controls: A/D or left/right yaw, W throttle, S brake, up/down pitch, Space vertical thrust, Shift drift.
    input.steer = (keys.ArrowLeft || keys.KeyA ? 1 : 0) + (keys.ArrowRight || keys.KeyD ? -1 : 0) - (keys.touchSteer || 0);
    input.throttle = (keys.KeyW ? 1 : 0) || (keys.touchGas || 0);
    input.brake = keys.KeyS ? 1 : 0;
    input.pitch = (keys.ArrowUp ? 1 : 0) + (keys.ArrowDown ? -1 : 0);
    input.jump = !!keys.Space;
    input.drift = !!(keys.ShiftLeft || keys.ShiftRight || keys.touchDrift);
  }

  // ---------------------------------------------------------------- physics
  function hit(c, strength, spin) {
    const resist = c.ab.crashResist || 1;
    c.shake = Math.max(c.shake, Math.min(1.5, strength / 12));
    c.flash = Math.max(c.flash, Math.min(1, strength / 15));
    c.hits = (c.hits || 0) + (strength > 6 ? 1 : 0);
    if (strength > 7) damage(c, (strength - 6) * 0.45, null);
    // Wipeouts only from hard collisions with props and ships (spin === 0 marks terrain contact: never a spin).
    if (strength > 18 && spin !== 0) { c.stun = Math.max(c.stun, (0.3 + Math.min(0.8, strength / 40)) * resist); c.stunEvents = (c.stunEvents || 0) + 1; const dir = spin || (Math.random() < 0.5 ? -1 : 1); c.yaw += dir * Math.min(7, strength * 0.25); }
  }
  function damage(c, amount, src) {
    if (c.wrecked > 0 || amount <= 0) return;
    if (c.shield > 0) { c.shield = 0; c.flash = Math.max(c.flash, 0.5); return; }
    c.life -= amount * c.stats.armour;
    c.flash = Math.max(c.flash, Math.min(1, amount / 40));
    c.dmg = clamp(1 - c.life / c.lifeMax, 0, 1);
    if (c.life <= 0) wreck(c);
  }
  function wreck(c) {
    c.botDecision = null; c.botDecisionAge = 0;
    c.life = 0; c.dmg = 1; c.wrecked = 1.5; c.wrecks = (c.wrecks || 0) + 1; c.stun = 1.7; c.item = null;
    c.yaw += (Math.random() < 0.5 ? -1 : 1) * 10; c.flash = 1; c.shake = 1.5; c.stunEvents = (c.stunEvents || 0) + 1;
  }
  function respawn(c) {
    c.botDecision = null; c.botDecisionAge = 0;
    const s = World.sampleAt(tab, c.t);
    c.x = s.p[0]; c.z = s.p[2]; c.y = s.p[1]; c.vx = c.vz = c.vy = 0; c.yaw = 0; c.pitch = 0; c.air = false; c.onRoad = true; c.offTime = 0; c.outTime = 0; c.outLane = 0; c.stun = 0.4;
    c.heading = Math.atan2(s.tan[0], s.tan[2]); c.flash = 1;
    if (c.life <= 0) { c.life = c.lifeMax * 0.6; c.dmg = 0.4; }
    c.wrecked = 0; c.respawnT = 3; c.offRadT = 0; c.offHeadT = 0; c.offLane = false; c.offHide = 0;
  }
  function driftLogic(c, ctl, vf, dt, allowed) {
    const wantDrift = ctl.drift && allowed && Math.abs(vf) > 18 * SPD && Math.abs(ctl.steer) > 0.2;
    if (wantDrift && !c.drifting) c.drifting = true;
    if (c.drifting && (!ctl.drift || Math.abs(vf) < 10 * SPD || !allowed)) {
      c.drifting = false;
      if (c.charge > 0.5) c.boost = Math.max(c.boost, (0.35 + Math.min(c.charge, 2.2) * 0.45) * (c.ab.boostMul || 1));
      c.charge = 0;
    }
    if (c.drifting) c.charge += dt * (c.ab.driftCharge || 1);
  }

  // One flight model for every planet. Lanes are soft: leaving them slows you and points you back; terrain is a bounce, never a spin.
  function stepFlight(c, ctl, dt) {
    const ph = desc.physics, R = desc.corridor.radius, st = c.stats, terrainLane = desc.laneStyle !== 'space';
    if (c.stun > 0) { c.stun -= dt; ctl = { steer: 0, throttle: 0, brake: 0, drift: false, pitch: 0, jump: false }; }
    const sp = Math.hypot(c.vx, c.vy, c.vz);
    const speedK = clamp(sp / (14 * SPD), 0, 1);
    const yawRate = (c.drifting ? 2.4 : 1.7) * speedK * (c.ab.steer || 1) * st.steerMul;
    c.heading += ctl.steer * yawRate * dt + c.yaw * dt;
    c.yaw -= c.yaw * Math.min(1, 2.5 * dt);
    c.pitch = clamp(c.pitch + (ctl.pitch || 0) * ph.pitchRate * dt, -0.9, 0.9);
    if (!ctl.pitch) c.pitch -= c.pitch * Math.min(1, 1.8 * dt);
    c.steer = mix(c.steer, ctl.steer * 0.45, Math.min(1, dt * 12));
    const cp = Math.cos(c.pitch);
    const fwd = [cp * Math.sin(c.heading), Math.sin(c.pitch), cp * Math.cos(c.heading)];
    let v = [c.vx, c.vy, c.vz];
    const boosting = c.boost > 0;
    // Ground reference: terrain or water under the craft.
    const wl = desc.waterLevel > -1e3 ? desc.waterLevel : -1e4;
    const lava = !!(desc.biome && desc.biome.flags & 16);
    const groundY = desc.noTerrain ? -1e4 : Math.max(terrain.heightAt(c.x, c.z), wl);
    const alt = c.y - groundY; c.alt = alt;
    const ge = terrainLane ? clamp(1 - alt / 13, 0, 1) : 0; // ground effect: lift and a speed bonus skimming the surface
    const maxS = c.maxSpeed * (boosting ? 1.35 : 1) * (1 + ge * 0.12);
    const thr = ctl.brake ? 0 : ctl.throttle;
    v = add(v, scale(fwd, ph.accel * st.accelMul * thr * (1 + ge * 0.2) * Math.max(0, 1 - sp / maxS) * dt));
    if (boosting) { v = add(v, scale(fwd, 25 * SPD * ph.boost * dt)); c.boost -= dt; }
    if (ctl.brake) v = sub(v, scale(v, 1.3 * dt));
    v = sub(v, scale(v, ph.drag * dt));
    const lift = rs.elapsed < 3 ? 1.0 : clamp(sp / (22 * SPD), 0, 1) * 0.92; // wings: hold altitude at cruise, sink when slow; no sink during the launch
    v[1] -= ph.gravity * Math.max(-0.15, 1 - lift - ge * 1.15) * dt;
    if (ge > 0 && v[1] < 0) v[1] *= 1 - Math.min(1, ge * 3 * dt);
    // Vertical thrust: a strong hop with a short cooldown, usable anywhere.
    c.jumpCd = Math.max(0, (c.jumpCd || 0) - dt);
    if (ctl.jump && c.jumpCd <= 0) { v[1] += ph.jump * (1 + ge * 0.3); c.jumpCd = 1.1; c.jumpFlash = 0.3; c.shake = Math.max(c.shake, 0.15); }
    c.jumpFlash = Math.max(0, (c.jumpFlash || 0) - dt);
    const vAlong = dot(v, fwd);
    driftLogic(c, ctl, vAlong, dt, true);
    if (c.drifting) v = sub(v, scale(v, 0.1 * dt));
    // Cornering drag: turning hard at speed scrubs velocity, and how much depends on the hull's cornering hold.
    // This is what stops raw top speed from deciding every race: a fast, loose craft runs wide and pays for it.
    const turnLoss = Math.abs(ctl.steer || 0) * sp * 0.055 / Math.max(0.5, (st.cornerMul || 1) * (c.drifting ? 1.35 : 1));
    if (turnLoss > 0) v = sub(v, scale(fwd, Math.min(sp * 0.5, turnLoss) * dt));
    const grip = c.drifting ? ph.driftGrip * st.driftMul : ph.grip * st.gripMul;
    const lateral = sub(v, scale(fwd, vAlong));
    v = add(scale(fwd, vAlong), scale(lateral, 1 - Math.min(1, grip * dt)));
    c.x += v[0] * dt; c.y += v[1] * dt; c.z += v[2] * dt;
    c.vx = v[0]; c.vy = v[1]; c.vz = v[2];
    // Terrain is a solid: resolve along the terrain normal (cliffs push you back, floors push you up), bounce and scrape, never a spin.
    if (!desc.noTerrain) {
      const clr = 2.2, e = 2.5;
      const hAt = (x, z) => Math.max(terrain.heightAt(x, z), wl);
      const resolve = (px, pz, isNose) => {
        const g2 = hAt(px, pz);
        const pen = g2 + clr - c.y;
        if (pen <= 0) return false;
        const n = norm([hAt(px - e, pz) - hAt(px + e, pz), 2 * e, hAt(px, pz - e) - hAt(px, pz + e)]);
        const depth = pen * n[1];
        c.x += n[0] * depth; c.y += n[1] * depth; c.z += n[2] * depth;
        const vn = c.vx * n[0] + c.vy * n[1] + c.vz * n[2];
        const hard = -vn;
        if (vn < 0) { c.vx -= n[0] * vn * 1.35; c.vy -= n[1] * vn * 1.35; c.vz -= n[2] * vn * 1.35; }
        c.vy = Math.max(c.vy, 1.2 * n[1]);
        c.vx *= 1 - Math.min(0.6, 1.4 * dt); c.vz *= 1 - Math.min(0.6, 1.4 * dt);
        if (n[1] > 0.7) c.pitch = Math.max(c.pitch, 0.15);
        c.shake = Math.max(c.shake, 0.2);
        if (hard > 14 * SPD && !(c.scrapeCd > 0)) { hit(c, Math.min(17, 6 + (hard - 14 * SPD) * 0.4 / SPD), 0); c.scrapeCd = 0.6; }
        if (!isNose) {
          const inWater = terrain.heightAt(px, pz) < wl - 0.2;
          if (inWater) { c.vx *= 1 - Math.min(1, (lava ? 2.5 : 1.2) * dt); c.vz *= 1 - Math.min(1, (lava ? 2.5 : 1.2) * dt); if (lava) { c.flash = Math.max(c.flash, 0.4); damage(c, 12 * dt, null); } }
        }
        return true;
      };
      resolve(c.x, c.z, false);
      // Nose: catch walls a craft length ahead before the nose enters them.
      const nl = (c.box ? c.box.hl : 2.5) * 1.2;
      resolve(c.x + fwd[0] * nl, c.z + fwd[2] * nl, true);
      if (c.y < hAt(c.x, c.z) + 0.5) c.insideT = (c.insideT || 0) + 1;
      c.scrapeCd = Math.max(0, (c.scrapeCd || 0) - dt);
    }
    // Lane frame.
    const prevT = c.t;
    c.t = World.nearestT(tab, c.x, c.z, c.t, 24);
    const s = World.sampleAt(tab, c.t);
    const off = sub([c.x, c.y, c.z], s.p);
    const along = dot(off, s.tan);
    const rad = sub(off, scale(s.tan, along));
    const r = len(rad);
    // Soft boundary: outside the lane you slow down gradually; far outside for long, or lost below the world, you return.
    const out = Math.max(0, r - R);
    c.outLane = out;
    if (out > 0) { const dragK = Math.min(1, out / (60 * SPD)) * 0.9; c.vx *= 1 - dragK * dt; c.vy *= 1 - dragK * dt * 0.5; c.vz *= 1 - dragK * dt; }
    c.outTime = out > R * 0.5 ? (c.outTime || 0) + dt : 0;
    // Off-route detection for the route indicator: far outside the lane for 2 s, or flying the wrong way for 1.5 s.
    // Target is a lane point ahead in the racing direction; laneDir is the world-space unit vector to it (vertical included).
    c.laneTargetT = ((c.t + 0.03) % 1 + 1) % 1;
    const tgt = World.sampleAt(tab, c.laneTargetT).p;
    c.laneDir = norm(sub(tgt, [c.x, c.y, c.z]));
    c.respawnT = Math.max(0, (c.respawnT || 0) - dt);
    const wrongWay = dot(fwd, s.tan) < -0.17; // more than 100 degrees off the lane tangent
    c.offRadT = out > R * 1.5 ? (c.offRadT || 0) + dt : 0;
    c.offHeadT = wrongWay ? (c.offHeadT || 0) + dt : 0;
    const offNow = rs.state === 'racing' && c.respawnT <= 0 && (c.offRadT > 2 || c.offHeadT > 1.5);
    if (offNow) { c.offHide = 1; if (!c.offLane) (c.offLog = c.offLog || []).push({ t: +rs.elapsed.toFixed(2), on: true }); c.offLane = true; }
    else if (c.offLane) { c.offHide = (c.offHide || 0) - dt; if (c.offHide <= 0) { c.offLane = false; c.offLog.push({ t: +rs.elapsed.toFixed(2), on: false }); } }
    if (c.outTime > 12 || r > R * 9 || c.y < groundY - 60 * SPD || !isFinite(c.x + c.y + c.z)) respawn(c);
    for (const tg of boostGates) {
      let d = c.t - tg; d -= Math.round(d);
      if (Math.abs(d) < 0.003 && r < R * 0.75 && c.lastGate !== tg) { c.boost = Math.max(c.boost, 1.0 * (c.ab.padMul || 1)); c.lastGate = tg; c.flash = Math.max(c.flash, 0.3); }
    }
    c.onRoad = r <= R; c.air = alt > 6;
    const upB = norm(cross(s.tan, s.right));
    c.vert = dot(rad, upB);
    // Engine glow follows input: high when accelerating or boosting, flare when drifting, off when coasting or braking.
    c.glowTarget = boosting ? 1 : (thr > 0 ? 0.6 : 0) + (c.drifting ? 0.35 : 0) + (c.jumpFlash > 0 ? 0.6 : 0);
    finishStep(c, prevT, s, vAlong, dot(rad, s.right));
  }

  function finishStep(c, prevT, s, vf, lat) {
    c.spin += vf * 0.02;
    const boosting = c.boost > 0;
    c.glow = mix(c.glow, clamp(c.glowTarget !== undefined ? c.glowTarget : (boosting ? 1 : 0), 0, 1), Math.min(1, 0.08));
    c.shake -= c.shake * 0.03; c.flash -= c.flash * 0.04;
    if (c.t > 0.45 && c.t < 0.55) c.half = true;
    if (prevT > 0.85 && c.t < 0.15 && c.half) { c.lap++; c.half = false; if (c.lap >= LAPS && !c.finished) { c.finished = true; c.finishTime = rs.elapsed; if (typeof MP !== 'undefined' && MP.active() && MP.isHost()) MP.finished(c.id, c.finishTime); } }
    c.prog = c.lap + c.t;
    c.sample = s; c.lat = lat; c.speed = vf;
  }

  // Steering plans are reused for 1/15 s; flight, lane phase and collision
  // integration retain their fixed 180 Hz cadence. Recovery invalidates the plan.
  function botInput(c, dt) {
    c.laneT += dt * 0.15;
    c.botDecisionAge = (c.botDecisionAge || 0) + dt;
    const state = `${c.wrecked > 0}:${c.stun > 0}:${!!c.offLane}:${c.alt < 4 && c.jumpCd <= 0}`;
    if (!c.botDecision || c.botDecisionState !== state || c.botDecisionAge >= 1 / 15 - 1e-9) {
      c.botDecision = botControl(c);
      c.botDecisionAge = 0; c.botDecisionState = state;
      perf.botDecisions = (perf.botDecisions || 0) + 1;
    }
    return c.botDecision;
  }
  function botControl(c) {
    const look = 0.012 + clamp(Math.abs(c.speed) / (60 * SPD), 0, 1) * 0.02;
    const s = World.sampleAt(tab, c.t + look);
    const R = desc.corridor.radius, up = norm(cross(s.tan, s.right));
    // Personal lane offset, pulled toward the centre when the bot has drifted out.
    const outK = c.outLane > 0 ? clamp(1 - c.outLane / 30, 0.2, 1) : 1;
    let tp = add(add(s.p, scale(s.right, c.lane * Math.sin(c.laneT) * R * 0.4 * outK)), scale(up, c.laneY * Math.cos(c.laneT * 0.7) * R * 0.35 * outK));
    // Separation: nudge sideways from any craft close ahead.
    for (const o of cars) {
      if (o === c) continue;
      const dx = o.x - c.x, dy = o.y - c.y, dz = o.z - c.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < (14 * SPD) * (14 * SPD)) { const side = (dx * Math.cos(c.heading) - dz * Math.sin(c.heading)) > 0 ? -1 : 1; tp = add(tp, scale(s.right, side * 6)); tp[1] += dy > 0 ? -3 : 3; }
    }
    // Prop avoidance: look a second or so ahead and steer around anything solid on the line, or climb over it.
    // Without this, bots fly straight into towers and asteroids now that the lanes are quick.
    tp = avoidProps(c, tp, Math.max(40, Math.abs(c.speed) * 1.3));
    const dy = tp[1] - c.y, dh = Math.hypot(tp[0] - c.x, tp[2] - c.z);
    const wantPitch = Math.atan2(dy, dh);
    const pitch = clamp((wantPitch - c.pitch) * 4, -1, 1);
    const want = Math.atan2(tp[0] - c.x, tp[2] - c.z);
    let d = want - c.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    const steer = clamp(d * 3.5, -1, 1);
    const drift = Math.abs(steer) > 0.6 && Math.abs(c.speed) > 30 * SPD;
    const jump = (c.alt < 4 && c.jumpCd <= 0) || (dy > 12 && c.jumpCd <= 0 && c.vy < 2);
    const gap = player.prog - c.prog;
    // Corner speed limit: a craft can only carry so much speed through a bend, and how much is its cornering hold.
    // This is what turns drift, grip and defense into lap time, so top speed alone does not decide every race.
    const ahead = World.sampleAt(tab, c.t + 0.02);
    const curv = Math.max(Math.abs(s.curv || 0), Math.abs(ahead.curv || 0));
    const radius = curv > 1e-5 ? 1 / curv : 1e5;
    const cornerCap = 25 * SPD * Math.sqrt(Math.max(1, radius) / 45) * (c.stats.cornerMul || 1);
    const base = desc.physics.maxSpeed * c.stats.speedMul * (0.8 + c.skill * 0.2) * (1 + clamp(gap * 0.6, -0.12, 0.25));
    c.maxSpeed = Math.min(base, Math.max(base * 0.42, cornerCap));
    if (c.propNear) c.maxSpeed = Math.min(c.maxSpeed, 34 * SPD * (c.stats.cornerMul || 1));
    const over = Math.abs(c.speed) > c.maxSpeed * 1.06;
    return { steer, throttle: over ? 0.15 : 1, brake: Math.abs(c.speed) > c.maxSpeed * 1.22 ? 1 : 0, drift, pitch, jump };
  }

  // Nudge a bot's target point clear of solid props within `reach` metres ahead. Cheap: one grid ring around the probe.
  function avoidProps(c, tp, reach) {
    const cp = Math.cos(c.pitch || 0), fwd = [cp * Math.sin(c.heading), Math.sin(c.pitch || 0), cp * Math.cos(c.heading)];
    const px = c.x + fwd[0] * reach, py = c.y + fwd[1] * reach, pz = c.z + fwd[2] * reach;
    const half = (c.box ? (c.box.hw + c.box.hl) * 0.45 : 1.6) + 10;
    const cx = Math.floor(px / PCELL), cz = Math.floor(pz / PCELL);
    let best = null, bestD = 1e9;
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
      const arr = propGrid.get((cx + ox) * 65536 + (cz + oz)); if (!arr) continue;
      for (const p of arr) {
        if (p.soft) continue;
        const top = p.y + p.h;
        if (py < p.y - 4 || py > top + 4) continue;
        const dx = px - p.x, dz = pz - p.z, rr = p.r + half, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        if (d2 < bestD) { bestD = d2; best = p; }
      }
    }
    if (!best) { c.propNear = 0; return tp; }
    c.propNear = 1;
    const dx = c.x - best.x, dz = c.z - best.z, d = Math.hypot(dx, dz) || 1;
    const side = (dx / d) * Math.cos(c.heading) - (dz / d) * Math.sin(c.heading);
    const push = best.r + half + 6;
    const out = [tp[0] + (dx / d) * push * (side >= 0 ? 1 : 1), tp[1], tp[2] + (dz / d) * push];
    // If the prop is short enough, going over it is cleaner than around.
    if (best.y + best.h < c.y + 26) out[1] = Math.max(out[1], best.y + best.h + 12);
    return out;
  }

  let propGrid = new Map();
  const PCELL = 24;
  function addPropGrid(inst, rFactor, hFactor, soft) {
    for (let i = 0; i < inst.length; i += 8) {
      const r = inst[i + 3] * rFactor;
      const p = { x: inst[i], y: inst[i + 1], z: inst[i + 2], r, h: inst[i + 4] * hFactor, soft };
      const key = Math.floor(p.x / PCELL) * 65536 + Math.floor(p.z / PCELL);
      if (!propGrid.has(key)) propGrid.set(key, []);
      propGrid.get(key).push(p);
    }
  }
  // Props are vertical cylinders in 3D (footprint radius, base height, height): side contact pushes out and bounces,
  // top contact lands you on it. The nose point is tested too so walls are caught before the craft enters them.
  function collideProps(c) {
    const cp = Math.cos(c.pitch || 0), fwd = [cp * Math.sin(c.heading), Math.sin(c.pitch || 0), cp * Math.cos(c.heading)];
    const nl = (c.box ? c.box.hl : 2.5) * 1.1;
    const half = c.box ? (c.box.hw + c.box.hl) * 0.45 : 1.6;
    for (const [px0, py0, pz0, nose] of [[c.x, c.y, c.z, false], [c.x + fwd[0] * nl, c.y + fwd[1] * nl, c.z + fwd[2] * nl, true]]) {
      const cx = Math.floor(px0 / PCELL), cz = Math.floor(pz0 / PCELL);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const arr = propGrid.get((cx + ox) * 65536 + (cz + oz)); if (!arr) continue;
        for (const p of arr) {
          const top = p.y + p.h;
          if (py0 < p.y - 1.5 || py0 > top + 1.5) continue;
          const dx = px0 - p.x, dz = pz0 - p.z, rr = p.r + half, d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr) continue;
          if (p.soft) { c.vx *= 0.97; c.vz *= 0.97; c.shake = Math.max(c.shake, 0.1); continue; }
          if (!nose) c.insideP = (c.insideP || 0) + 1;
          const d = Math.sqrt(Math.max(d2, 1e-6)), nx = dx / d, nz = dz / d;
          const sidePen = rr - d, topPen = top + 1.5 - py0;
          if (topPen < sidePen && topPen < 4 && c.vy <= 0.5) {
            // Land on top of it.
            c.y += topPen; if (c.vy < 0) c.vy = -c.vy * 0.3 + 1; c.vx *= 0.9; c.vz *= 0.9; c.shake = Math.max(c.shake, 0.15);
            continue;
          }
          c.x += nx * sidePen; c.z += nz * sidePen;
          const vn = c.vx * nx + c.vz * nz;
          if (vn < 0) {
            c.vx -= nx * vn * 1.4; c.vz -= nz * vn * 1.4;
            const side = nx * Math.cos(c.heading) - nz * Math.sin(c.heading);
            // Vegetation and small props scrape, only big props (rocks, towers, wrecks) can wipe you out.
            hit(c, Math.min(p.r > 3 ? 40 : 15, -vn * 0.7 / Math.max(0.6, c.mass)), side > 0 ? 1 : -1);
          }
        }
      }
    }
  }
  // Is a point free of terrain and props (for the camera)?
  function pointFree(x, y, z) {
    if (!desc.noTerrain && y < Math.max(terrain.heightAt(x, z), desc.waterLevel > -1e3 ? desc.waterLevel : -1e4) + 1.5) return false;
    const arr = propGrid.get(Math.floor(x / PCELL) * 65536 + Math.floor(z / PCELL)); if (!arr) return true;
    for (const p of arr) { if (p.soft) continue; if (y >= p.y - 1 && y <= p.y + p.h + 1) { const dx = x - p.x, dz = z - p.z; if (dx * dx + dz * dz < (p.r + 1) * (p.r + 1)) return false; } }
    return true;
  }
  // Oriented boxes in the ground plane, mass-weighted impulses with a yaw kick from the contact point.
  function collide() {
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (Math.abs(a.y - b.y) > 2.5) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const reach = a.box.hl + b.box.hl + 0.5;
      if (dx * dx + dz * dz > reach * reach) continue;
      const axA = [Math.cos(a.heading), -Math.sin(a.heading)], azA = [Math.sin(a.heading), Math.cos(a.heading)];
      const axB = [Math.cos(b.heading), -Math.sin(b.heading)], azB = [Math.sin(b.heading), Math.cos(b.heading)];
      let best = Infinity, nx = 0, nz = 0;
      for (const L of [axA, azA, axB, azB]) {
        const d = dx * L[0] + dz * L[1];
        const ra = a.box.hw * Math.abs(axA[0] * L[0] + axA[1] * L[1]) + a.box.hl * Math.abs(azA[0] * L[0] + azA[1] * L[1]);
        const rb = b.box.hw * Math.abs(axB[0] * L[0] + axB[1] * L[1]) + b.box.hl * Math.abs(azB[0] * L[0] + azB[1] * L[1]);
        const overlap = ra + rb - Math.abs(d);
        if (overlap <= 0) { best = -1; break; }
        if (overlap < best) { best = overlap; const sg = d < 0 ? -1 : 1; nx = L[0] * sg; nz = L[1] * sg; }
      }
      if (best <= 0) continue;
      const ma = a.mass, mb = b.mass, wa = mb / (ma + mb), wb = ma / (ma + mb);
      a.x -= nx * best * wa; a.z -= nz * best * wa; b.x += nx * best * wb; b.z += nz * best * wb;
      const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rv < 0) {
        const e = 0.35, jn = -(1 + e) * rv / (1 / ma + 1 / mb);
        a.vx -= nx * jn / ma; a.vz -= nz * jn / ma; b.vx += nx * jn / mb; b.vz += nz * jn / mb;
        // Contact roughly at the midpoint between centres; torque from lever arm cross impulse.
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        const lever = (r, f) => r[0] * f[1] - r[1] * f[0];
        const Ia = ma * (a.box.hw * a.box.hw + a.box.hl * a.box.hl), Ib = mb * (b.box.hw * b.box.hw + b.box.hl * b.box.hl);
        a.yaw += lever([mx - a.x, mz - a.z], [-nx * jn, -nz * jn]) / Ia * 0.6;
        b.yaw += lever([mx - b.x, mz - b.z], [nx * jn, nz * jn]) / Ib * 0.6;
        const impact = -rv;
        a.shake = Math.max(a.shake, impact / 20); b.shake = Math.max(b.shake, impact / 20);
        if (impact > 6) {
          // Heavier ship rams the lighter one: the ram counts as a weapon hit.
          if (ma >= mb * 1.3 && impact > 12) { damage(b, impact * (a.ab.ramMul || 1), a); hit(b, impact * 0.7, null); a.hitMark = 1; damage(a, impact * 0.1, null); }
          else if (mb >= ma * 1.3 && impact > 12) { damage(a, impact * (b.ab.ramMul || 1), b); hit(a, impact * 0.7, null); b.hitMark = 1; damage(b, impact * 0.1, null); }
          else { damage(a, impact * 0.28 * (mb / ma), b); damage(b, impact * 0.28 * (ma / mb), a); if (impact > 16) { hit(a, impact * 0.45, null); hit(b, impact * 0.45, null); } }
        }
      }
    }
    for (const c of cars) collideProps(c);
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    if (rs.state === 'idle') { updateCamera(dt); return; }
    readInput();
    const net = typeof MP !== 'undefined' && MP.active();
    if (net) { MP.beforeUpdate(dt); MP.syncRace(rs); }
    if (rs.state === 'countdown') {
      rs.timer -= dt;
      const n = Math.max(0, Math.ceil(rs.timer - 0.5));
      if (n !== lastCount) { lastCount = n; A(a => a.sfx.count(n)); }
      if (rs.timer <= 0) { rs.state = 'racing'; A(a => a.race('racing')); }
    }
    if (rs.state !== 'countdown') rs.elapsed += dt;
    const sub = 3, h = dt / sub;
    let localCtl = input;
    for (let k = 0; k < sub; k++) {
      for (const c of cars) {
        if (net && MP.skip(c)) { MP.interpolate(c); continue; }   // a client plays remote craft back from snapshots
        let ctl = (net && MP.control(c)) || ((c.isBot || camCfg.autopilot) ? botInput(c, h) : input);
        if (c === player) localCtl = ctl;
        if (rs.state === 'countdown') { ctl = { steer: 0, throttle: 0, brake: 0, drift: false, pitch: 0, jump: false }; c.vx = c.vz = 0; c.vy = 0; const s0 = World.sampleAt(tab, c.t); c.y = Math.max(c.y, s0.p[1] - 2); }
        if (c.finished && c.isBot) ctl = { ...ctl, throttle: 0.4 };
        c.autopilot = !!camCfg.autopilot;
        if (c.wrecked > 0) { c.wrecked -= h; if (c.wrecked <= 0) respawn(c); }
        stepFlight(c, ctl, h);
      }
      collide();
      if (rs.state === 'racing') {
        // Tell the room who is firing before the weapon system consumes the flag, so clients spawn the same visual.
        if (net && MP.isHost()) for (const c of cars) if (c.useItem && c.item && c.itemCd <= 0 && c.wrecked <= 0 && c.stun <= 0) MP.fired(c.id, c.item);
        Weapons.update(h);
      }
    }
    if (net) MP.afterUpdate(dt, localCtl);
    for (const c of cars) c.hitMark = Math.max(0, c.hitMark - dt * 2);
    if (rs.state === 'racing' && player.finished) {
      rs.state = 'finished';
      rs.results = finalOrder().indexOf(player) + 1;
      app.state = 'results'; camMode = 'spectate'; spectate = { idx: pickSpectate(), timer: 0 };
      A(a => a.race('finished'));
      emit('finished');
    }
    if (rs.state === 'finished') { spectate.timer += dt; if (spectate.timer > 4.5) { spectate = { idx: pickSpectate(), timer: 0 }; } }
    updateCamera(dt);
    audioFrame(dt);
  }

  // Engine, wind and event sounds. The player's craft is full volume and centred; others are quieter and panned by
  // where they sit relative to the camera, and fade out with distance.
  function audioFrame(dt) {
    A(a => {
      const ear = (camMode === 'spectate' && cars[spectate.idx]) ? cars[spectate.idx] : player;
      const fwd = [Math.sin(ear.heading), 0, Math.cos(ear.heading)], right = [fwd[2], 0, -fwd[0]];
      for (const c of cars) {
        const sp = clamp(Math.abs(c.speed || 0) / 90, 0, 1);
        const thr = clamp(c.glowTarget || 0, 0, 1);
        if (c === ear) { a.engine(c.id, sp, thr, rs.state === 'idle' ? 0 : 0.16, 0); continue; }
        const d = sub([c.x, c.y, c.z], [ear.x, ear.y, ear.z]), dist = len(d);
        const near = clamp(1 - dist / 150, 0, 1);
        a.engine(c.id, sp, thr, 0.075 * near * near, dot(d, right) / Math.max(8, dist));
      }
      a.wind(rs.state === 'idle' ? 0 : clamp(Math.abs(ear.speed || 0) / 110, 0, 1));
      // Event edges: boost, hop, drift, gate, wreck, shield, water.
      for (const c of cars) {
        const pan = c === ear ? 0 : clamp((c.x - ear.x) * right[0] + (c.z - ear.z) * right[2], -60, 60) / 60;
        const gain = c === ear ? 1 : clamp(1 - len(sub([c.x, c.y, c.z], [ear.x, ear.y, ear.z])) / 150, 0, 1);
        if (gain < 0.06) { c.aBoost = c.boost > 0; c.aDrift = c.drifting; continue; }
        if (c.boost > 0 && !c.aBoost) a.sfx.boost(pan);
        c.aBoost = c.boost > 0;
        if ((c.jumpFlash || 0) > 0.25 && !c.aJump) a.sfx.thrust(pan);
        c.aJump = (c.jumpFlash || 0) > 0.25;
        if (c.drifting) { c.aDriftT = (c.aDriftT || 0) + dt; if (c.aDriftT > 0.22) { c.aDriftT = 0; a.sfx.drift(clamp(Math.abs(c.speed) / 60, 0, 1), pan); } }
        c.aDrift = c.drifting;
        if (c.lastGate !== undefined && c.lastGate !== c.aGate) { if (c.aGate !== undefined) a.sfx.gate(pan); c.aGate = c.lastGate; }
        if (c.wrecked > 0 && !c.aWreck) a.sfx.wreck(pan);
        c.aWreck = c.wrecked > 0;
        if (c === ear) { if (c.item && !c.aItem) a.sfx.pickup(); else if (!c.item && c.aItem) a.sfx.itemReady(); }
        c.aItem = c.item;
        if (c.life < (c.aLife === undefined ? c.life : c.aLife) - 0.5) a.sfx.impact((c.aLife - c.life) * 2.2, pan);
        c.aLife = c.life;
        // Same test the physics uses: skimming the surface where the ground under you is below the water line.
        const inWater = desc.waterLevel > -1e3 && !desc.noTerrain && (c.alt || 99) < 3
          && terrain.heightAt(c.x, c.z) < desc.waterLevel - 0.2;
        if (inWater && !c.aWet) a.sfx.splash(pan);
        c.aWet = inWater;
      }
    });
  }

  function pickSpectate() {
    const others = cars.filter(c => c !== player && !(c.wrecked > 0));
    if (!others.length) return 0;
    const pick = others[Math.floor(Math.random() * others.length)];
    return cars.indexOf(pick);
  }
  function finalOrder() {
    return [...cars].sort((a, b) => (a.finished && b.finished) ? a.finishTime - b.finishTime : a.finished ? -1 : b.finished ? 1 : b.prog - a.prog);
  }
  function updateCamera(dt) {
    const c = (camMode === 'spectate' && cars[spectate.idx]) ? cars[spectate.idx] : player, s = c.sample || World.sampleAt(tab, c.t);
    const speed01 = clamp(Math.abs(c.speed || 0) / (80 * SPD), 0, 1);
    const k = 1 - Math.exp(-dt * 6);
    let target, lookT;
    const tNow = performance.now() / 1000;
    if (rs.state === 'idle') {
      const orbit = menuOrbit[camMode];
      const moving = menuOrbit.pointer === null && performance.now() > menuOrbit.holdUntil;
      menuOrbit.speed = mix(menuOrbit.speed,moving?1:0,1-Math.exp(-dt*2));
      if (orbit && camMode !== 'showcase') orbit.yaw += dt*.035*menuOrbit.speed;
    }
    if (app.state === 'cover' || app.state === 'showcase' || app.state === 'gallery') {
      // Match the first starting-grid slot and its stationary chase-camera heading.
      const start = World.sampleAt(tab, .99);
      const origin = add(start.p, scale(start.right, -.45 * desc.corridor.radius * .45));
      const heading = Math.atan2(start.tan[0], start.tan[2]);
      const forward = [Math.sin(heading), 0, Math.cos(heading)];
      const back = camCfg.back + 3;
      target = [origin[0] - forward[0] * back, origin[1] + 2.6, origin[2] - forward[2] * back];
      if (!desc.noTerrain && terrain?.heightAt) {
        target[1] = Math.max(target[1], terrain.heightAt(target[0], target[2]) + 1.5, desc.waterLevel + 1.5);
      }
      for (let step = 1; step <= 10; step++) {
        const u = step / 10;
        const q = [mix(origin[0], target[0], u), mix(origin[1] + 1.5, target[1], u), mix(origin[2], target[2], u)];
        if (!pointFree(q[0], q[1], q[2])) {
          const safe = Math.max(0, (step - 1.5) / 10);
          target = [mix(origin[0], target[0], safe), mix(origin[1] + 1.5, target[1], safe), mix(origin[2], target[2], safe)];
          break;
        }
      }
      lookT = [origin[0] + forward[0] * camCfg.ahead, origin[1] + .6, origin[2] + forward[2] * camCfg.ahead];
      const zoomProgress = reducedMotion.matches ? 1 : clamp((performance.now()-terrainZoomStarted)/1300,0,1);
      terrainZoom = mix(terrainZoomFrom, app.state === 'gallery' ? 3.4 : 1, zoomProgress*zoomProgress*(3-2*zoomProgress));
      if ((app.state === 'showcase' || app.state === 'gallery')) {
        const direction = norm(sub(lookT, target));
        const distance = 14 / Math.min(1, innerWidth / Math.max(1, innerHeight));
        const pivot = add(target, scale(direction, distance));
        const orbitDistance = distance * terrainZoom;
        showcaseView = { pivot, heading };
        const orbit = menuOrbit.showcase;
        const yaw = Math.atan2(-direction[0], -direction[2]) + orbit.yaw;
        const pitch = clamp(Math.asin(-direction[1]) + orbit.pitch, -.35, 1.25);
        target = [pivot[0] + Math.sin(yaw) * Math.cos(pitch) * orbitDistance, pivot[1] + Math.sin(pitch) * orbitDistance, pivot[2] + Math.cos(yaw) * Math.cos(pitch) * orbitDistance];
        if (app.state !== 'gallery' && !desc.noTerrain && terrain?.heightAt) target[1] = Math.max(target[1], terrain.heightAt(target[0], target[2]) + 1.5);
        lookT = pivot;
      }
      const previewEase = app.state === 'showcase' && performance.now() - showcaseStarted < 1800 && menuOrbit.pointer === null ? 1 - Math.exp(-dt * 2.3) : k;
      cam.pos = M.lerp3(cam.pos, target, previewSnap ? 1 : previewEase); cam.look = M.lerp3(cam.look, lookT, previewSnap ? 1 : previewEase); previewSnap = false;
      cam.fov = mix(cam.fov, 56, k); cam.speed01 = 0;
      return;
    }
    if (camMode === 'gallery') {
      // Wide scenic orbit on the cover and planet screens, tighter during a race.
      const wide = app.state !== 'race' && app.state !== 'results';
      const az = wide ? menuOrbit.gallery.yaw : tNow * 0.12, el = wide ? menuOrbit.gallery.pitch : 0.62, r = wide ? 120 : 42;
      const ahead = wide ? World.sampleAt(tab, c.t + 0.03).p : [c.x, c.y, c.z];
      target = [ahead[0] + Math.cos(az) * Math.cos(el) * r, ahead[1] + Math.sin(el) * r, ahead[2] + Math.sin(az) * Math.cos(el) * r];
      lookT = [ahead[0], ahead[1] + 1, ahead[2]];
      if (app.state === 'cover' && terrain?.heightAt) {
        target[1] = Math.max(target[1],terrain.heightAt(target[0],target[2])+28);
      }
      cam.pos = M.lerp3(cam.pos, target, k); cam.look = M.lerp3(cam.look, lookT, 1 - Math.exp(-dt * 10));
      cam.fov = mix(cam.fov, wide ? 34 : 26, k); cam.speed01 = speed01 * 0.3;
      return;
    }
    if (camMode === 'cockpit') {
      const cp = Math.cos(c.pitch || 0), fwd = [cp * Math.sin(c.heading), Math.sin(c.pitch || 0), cp * Math.cos(c.heading)];
      const sway = Math.sin(tNow * 2.1) * 0.15 * speed01;
      target = [c.x + fwd[0] * 2.3, c.y + 1.1 + fwd[1] * 2.3, c.z + fwd[2] * 2.3];
      lookT = [c.x + fwd[0] * 40, c.y + 1.1 + fwd[1] * 40 + sway, c.z + fwd[2] * 40];
      cam.pos = M.lerp3(cam.pos, target, 1 - Math.exp(-dt * 30)); cam.look = M.lerp3(cam.look, lookT, 1 - Math.exp(-dt * 14));
      cam.fov = mix(cam.fov, 66 + (reducedMotion.matches ? 0 : speed01 * 4), k); cam.speed01 = speed01;
      return;
    }
    {
      // Chase: behind and slightly above, pitch follows with a lag so climbs and dives read.
      c.camPitch = mix(c.camPitch || 0, c.pitch * 0.6, 1 - Math.exp(-dt * 3));
      const cp = Math.cos(c.camPitch), fwd = [cp * Math.sin(c.heading), Math.sin(c.camPitch), cp * Math.cos(c.heading)];
      const back = camCfg.back + 3 + speed01 * 3, up = 2.6 + speed01 * 0.6;
      target = [c.x - fwd[0] * back, c.y - fwd[1] * back + up, c.z - fwd[2] * back];
      if (!desc.noTerrain) target[1] = Math.max(target[1], Math.max(terrain.heightAt(target[0], target[2]), desc.waterLevel > -1e3 ? desc.waterLevel : -1e4) + 1.5);
      // Keep the camera out of terrain and props: march from the craft and stop short of the first blocked point.
      { const K = 10; let last = [c.x, c.y + 1.5, c.z];
        for (let k = 1; k <= K; k++) { const u = k / K, q = [c.x + (target[0] - c.x) * u, c.y + 1.5 + (target[1] - c.y - 1.5) * u, c.z + (target[2] - c.z) * u]; if (!pointFree(q[0], q[1], q[2])) { const w = Math.max(0, (k - 1.5) / K); target = [c.x + (target[0] - c.x) * w, c.y + 1.5 + (target[1] - c.y - 1.5) * w, c.z + (target[2] - c.z) * w]; break; } last = q; } }
      lookT = [c.x + fwd[0] * camCfg.ahead, c.y + fwd[1] * camCfg.ahead + 0.6, c.z + fwd[2] * camCfg.ahead];
    }
    cam.pos = M.lerp3(cam.pos, target, k);
    const t = performance.now() / 1000;
    let sh = c.shake * 0.35;
    if (desc.water) { target[1] += Math.sin(t * 0.8) * 0.4; sh += 0.05; }
    cam.pos = [cam.pos[0] + (Math.random() - 0.5) * sh, cam.pos[1] + (Math.random() - 0.5) * sh, cam.pos[2] + (Math.random() - 0.5) * sh];
    cam.look = M.lerp3(cam.look, lookT, 1 - Math.exp(-dt * 10));
    cam.fov = mix(cam.fov, 56 + (reducedMotion.matches ? 0 : speed01 * 8 + (c.boost > 0 ? 2 : 0)), k);
    cam.speed01 = speed01;
  }

  function updateHud() {
    if (rs.state === 'idle') return;
    const c = player;
    hud.lap.textContent = `Lap ${Math.min(c.lap + 1, LAPS)} / ${LAPS}`;
    const order = [...cars].sort((a, b) => b.prog - a.prog);
    hud.pos.textContent = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][order.indexOf(c)];
    let msg = '';
    if (rs.state === 'countdown') msg = rs.timer > 0.5 ? String(Math.ceil(rs.timer - 0.5)) : 'Go';
    else if (rs.state === 'racing' && c.wrecked > 0) msg = 'Wrecked';
    else if (rs.state === 'racing' && c.stun > 0.3) msg = 'Wipeout';
    hud.msg.textContent = msg;
    if (hud.laneArrow) {
      const show = rs.state === 'racing' && !!c.offLane && !!c.laneDir;
      hud.laneArrow.hidden = !show;
      if (show) {
        // Place the indicator where the lane target projects on screen; when it is behind the camera, pin it to the edge.
        const tgt = World.sampleAt(tab, c.laneTargetT).p;
        const cf = norm(sub(cam.look, cam.pos)), cr = norm(cross(cf, [0, 1, 0])), cu = cross(cr, cf);
        const v = sub(tgt, cam.pos), vx = dot(v, cr), vy = dot(v, cu), vz = dot(v, cf);
        const th = Math.tan(cam.fov * Math.PI / 360), aspect = hud.canvas.clientWidth / hud.canvas.clientHeight;
        let sx, sy;
        if (vz > 1) { sx = 0.5 + vx / (vz * th * aspect) * 0.5; sy = 0.5 - vy / (vz * th) * 0.5; }
        else { const a = Math.atan2(vy, vx); sx = 0.5 + Math.cos(a) * 0.42; sy = 0.5 - Math.sin(a) * 0.42; }
        sx = clamp(sx, 0.06, 0.94); sy = clamp(sy, 0.1, 0.86);
        hud.laneArrow.style.left = `${(sx * 100).toFixed(1)}%`; hud.laneArrow.style.top = `${(sy * 100).toFixed(1)}%`;
        const ang = Math.atan2(dot(c.laneDir, cr), dot(c.laneDir, cu));
        hud.laneArrow.firstElementChild.style.transform = `rotate(${(ang * 180 / Math.PI).toFixed(1)}deg)`;
      }
    }
    hud.msg.classList.toggle('big', rs.state === 'countdown');
    const lifeF = clamp(c.life / c.lifeMax, 0, 1);
    hud.life.style.width = `${Math.round(lifeF * 100)}%`;
    hud.life.parentElement.classList.toggle('low', lifeF < 0.34);
    hud.item.textContent = c.item ? c.item : (c.shield > 0 ? 'shield' : 'no item');
    hud.item.classList.toggle('has', !!c.item);
    hud.hitmark.style.opacity = c.hitMark > 0 ? '1' : '0';
    const hurt = Math.max(c.flash * 0.7, (1 - lifeF) * 0.55);
    hud.vignette.style.boxShadow = `inset 0 0 160px 40px rgba(255,40,20,${hurt.toFixed(2)})`;
    drawSpeedo(c);
    drawMinimap();
  }

  // A shared scene/HUD lens response, driven by speed and an acceleration push.
  // Update with rendered frames only; no extra canvas, shader pass or animation loop.
  function updateSpeedWarp(dt) {
    const speed = Math.abs(player.speed || 0), h = Math.min(Math.max(dt, 0), 0.1);
    const racing = rs.state === 'racing' && !reducedMotion.matches && player.wrecked <= 0;
    const acceleration = h > 0 ? clamp((speed - warpSpeed) / (h * 80 * SPD), 0, 1) : 0;
    warpSpeed = speed;
    const target = racing ? clamp(smoothstep(0.03, 0.8, speed / (80 * SPD)) * 0.8 + acceleration * 0.35 + (player.boost > 0 ? 0.2 : 0), 0, 1) : 0;
    speedWarp = racing ? mix(speedWarp, target, 1 - Math.exp(-h * (target > speedWarp ? 7 : 4))) : 0;
    const value = speedWarp.toFixed(3);
    if (value !== warpValue) { hud.root.style.setProperty('--speed-warp', value); warpValue = value; }
  }

  // ---------------------------------------------------------------- speedometer
  function drawSpeedo(c) {
    const g = spCtx, W = hud.speedo.width, H = hud.speedo.height;
    const kph = Math.abs(c.speed || 0) * 3.2;
    const fraction = clamp(kph / (320 * SPD), 0, 1);
    const charge = clamp(c.drifting ? c.charge / 2.2 : (c.boost > 0 ? c.boost / 1.4 : 0), 0, 1);
    const accent = cssColor(c.color);
    g.clearRect(0, 0, W, H);
    g.font = '400 100px Kilo, sans-serif';
    g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.lineJoin = 'round'; g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.fillStyle = 'rgba(255,255,255,.85)';
    const value = String(Math.round(kph));
    g.strokeText(value, W - 10, 100, W - 24);
    g.fillText(value, W - 10, 100, W - 24);
    g.font = '600 18px Mori, sans-serif';
    g.fillStyle = 'rgba(255,255,255,.65)'; g.fillText('KPH', W - 12, 125);
    const bar = (y, height, progress, colour) => {
      g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.roundRect(10,y,W-20,height,height/2); g.fill();
      if (progress > .001) { g.fillStyle = colour; g.beginPath(); g.roundRect(10,y,(W-20)*progress,height,height/2); g.fill(); }
    };
    bar(H-32, 10, fraction, 'rgba(255,255,255,.8)');
    bar(H-13, 5, charge, accent);
  }

  // ---------------------------------------------------------------- local 3D route map
  let mapLastDraw = -Infinity, mapHeading = null, mapRange = 230;
  function drawMinimapBase() {
    // No full-world terrain sampling: this map only needs the existing route samples.
    mapLastDraw = -Infinity; mapHeading = null; mapRange = 230;
  }
  function drawMinimap() {
    const now = performance.now();
    if (now - mapLastDraw < 1000 / 15) return;
    const dt = Math.min(.2, (now - mapLastDraw) / 1000 || .067);
    mapLastDraw = now;
    if (mapHeading === null) mapHeading = player.heading;
    const turn = Math.atan2(Math.sin(player.heading-mapHeading),Math.cos(player.heading-mapHeading));
    mapHeading += turn * (1-Math.exp(-dt*7));
    mapRange = mix(mapRange, clamp(Math.abs(player.speed || 0)*3.5,180,420),1-Math.exp(-dt*2));
    const g = mmCtx, W = minimap.width, H = minimap.height;
    const sn = Math.sin(mapHeading), cs = Math.cos(mapHeading), sc = H*.95/mapRange;
    const project = p => {
      const dx=p[0]-player.x, dz=p[2]-player.z, up=p[1]-player.y;
      // Match the right-handed chase camera: screen-right is forward × world-up.
      const x=-dx*cs+dz*sn, ahead=dx*sn+dz*cs;
      const perspective=clamp(1/(1+ahead/mapRange*.42),.55,1.5);
      return [W*.5+x*sc*perspective,H*.73-(ahead*.65+up*.8)*sc*perspective];
    };
    g.clearRect(0,0,W,H); g.save();
    g.beginPath(); g.roundRect(0,0,W,H,24); g.clip();
    g.fillStyle='rgba(8,16,24,.72)'; g.fillRect(0,0,W,H);
    // Stable reference plane beneath the ship makes route altitude visible.
    const plane=player.y-25;
    g.strokeStyle='rgba(130,205,255,.12)';g.lineWidth=1;
    const line=(a,b)=>{g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();};
    const local=(x,z)=>[player.x+x*cs+z*sn,plane,player.z-x*sn+z*cs];
    for(let n=-2;n<=2;n++)line(project(local(n*mapRange/4,-mapRange/4)),project(local(n*mapRange/4,mapRange)));
    for(let n=0;n<=4;n++)line(project(local(-mapRange/2,n*mapRange/4)),project(local(mapRange/2,n*mapRange/4)));
    const start=((Math.floor(player.t*tab.N)%tab.N)+tab.N)%tab.N;
    const collect=(direction,distance)=>{
      const pts=[tab.S[start].p];let travelled=0,last=pts[0];
      for(let k=1;k<tab.N&&travelled<distance;k++){
        const p=tab.S[(start+direction*k+tab.N)%tab.N].p;
        travelled+=len(sub(p,last));pts.push(p);last=p;
      }return pts;
    };
    const ahead=collect(1,mapRange*1.55), behind=collect(-1,mapRange*.3);
    const path=(pts,flat=false)=>{g.beginPath();pts.forEach((p,i)=>{const q=project(flat?[p[0],plane,p[2]]:p);g[i?'lineTo':'moveTo'](...q);});};
    g.lineCap='round';g.lineJoin='round';
    g.setLineDash([5,7]);g.strokeStyle='rgba(130,205,255,.28)';g.lineWidth=2;path(ahead,true);g.stroke();g.setLineDash([]);
    const stride=Math.max(1,Math.floor(ahead.length/9));
    g.strokeStyle='rgba(130,205,255,.28)';
    for(let i=0;i<ahead.length;i+=stride){const p=ahead[i];line(project([p[0],plane,p[2]]),project(p));}
    g.lineWidth=4;g.strokeStyle='rgba(220,239,255,.25)';path(behind);g.stroke();
    g.lineWidth=11;g.strokeStyle='rgba(120,205,255,.18)';path(ahead);g.stroke();
    g.lineWidth=4;g.strokeStyle='rgba(242,250,255,.95)';path(ahead);g.stroke();
    // Only nearby opponents and upcoming gates, to avoid full-course clutter.
    for(const t of tab.gateTs || []){
      if(((t-player.t+1)%1)*(tab.length||2000)>mapRange*1.5)continue;
      const q=project(World.sampleAt(tab,t).p);g.strokeStyle=cssColor(player.color);g.lineWidth=2;g.beginPath();g.arc(...q,7,0,TAU);g.stroke();
    }
    for(const c of cars){if(c===player||Math.hypot(c.x-player.x,c.y-player.y,c.z-player.z)>mapRange)continue;
      const q=project([c.x,c.y,c.z]);g.fillStyle='rgba(180,210,230,.8)';g.beginPath();g.arc(...q,4,0,TAU);g.fill();}
    if(player.offLane){g.setLineDash([5,5]);g.strokeStyle=cssColor(player.color);g.lineWidth=2;line(project([player.x,player.y,player.z]),project(World.sampleAt(tab,player.laneTargetT??player.t).p));g.setLineDash([]);}
    const x=W*.5,y=H*.73;
    g.fillStyle='#fff';g.strokeStyle='rgba(0,0,0,.7)';g.lineWidth=2;
    g.beginPath();g.moveTo(x,y-13);g.lineTo(x+9,y+8);g.lineTo(x,y+4);g.lineTo(x-9,y+8);g.closePath();g.fill();g.stroke();
    const next=ahead[Math.min(ahead.length-1,Math.max(1,Math.floor(ahead.length*.4)))];
    const altitude=next[1]-player.y;
    g.font='600 18px Mori,sans-serif';g.textAlign='left';g.fillStyle='rgba(225,240,255,.85)';
    g.fillText(Math.abs(altitude)>8?(altitude>0?'↑ Climb':'↓ Dive'):'→ Level',18,28);
    g.textAlign='right';g.fillStyle='rgba(225,240,255,.55)';g.fillText(Math.round(mapRange)+' m',W-18,28);
    g.restore();
  }

  // ---------------------------------------------------------------- draw
  function right0(u, f) { return norm(cross(u, f)); }
  function rotAround(v, axis, a) { // Rodrigues
    const c = Math.cos(a), s = Math.sin(a);
    return add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, dot(axis, v) * (1 - c)));
  }
  function craftBasis(c, t) {
    const s = c.sample || World.sampleAt(tab, c.t), ph = desc.physics;
    // Stable basis: world up, pitch clamped to about 35 degrees for the visual, never below the horizon.
    const vp = clamp(c.pitch, -0.61, 0.61), cp = Math.cos(vp);
    let fwd = [cp * Math.sin(c.heading), Math.sin(vp), cp * Math.cos(c.heading)];
    let upB = norm(sub([0, 1, 0], scale(fwd, fwd[1])));
    // Roll: lean into steering and drift, clamped to about 35 degrees.
    const targetRoll = clamp(c.steer * ph.bank * 1.6 + (c.drifting ? c.steer * 0.6 : 0), -0.61, 0.61);
    // A visual smoothing constant should not change with the graphics FPS cap.
    // Weapons may request this basis again in the same frame; do not smooth twice.
    const rollDt = Math.min(0.1, Math.max(0, t - (c.rollAt ?? t - 1 / 60)));
    c.roll = mix(c.roll, targetRoll, 1 - Math.exp(-rollDt * 6.32163));
    c.rollAt = t;
    upB = rotAround(upB, fwd, c.roll);
    const right = norm(cross(upB, fwd));
    if (c.wrecked > 0) { const w = (1.5 - c.wrecked) * 6; upB = rotAround(upB, fwd, w * 0.7); fwd = rotAround(fwd, right0(upB, fwd), Math.sin(w) * 0.5); }
    const bob = Math.sin(t * 2.6 + c.id * 1.7) * ph.bob;
    return { right, up: upB, fwd, pos: [c.x + upB[0] * bob, c.y + upB[1] * bob, c.z + upB[2] * bob] };
  }
  function draw(dt) {
    updateSpeedWarp(dt);
    updateRouteCues(dt);
    const t = performance.now() / 1000;
    const showcasing = (app.state === 'showcase' || app.state === 'gallery');
    if (showcasing) {
      const viewForward = norm(sub(cam.look, cam.pos));
      const az = showcaseView?.heading ?? Math.atan2(viewForward[0], viewForward[2]), tilt = 0;
      const distance = 14 / Math.min(1, innerWidth / Math.max(1, innerHeight));
      const elapsed = (performance.now()-showcaseStarted)/1000;
      if (elapsed >= .8 && showcaseGroups.some(g => g.outgoing)) {
        Gpu.destroyGroups(showcaseGroups.filter(g => g.outgoing));
        showcaseGroups = showcaseGroups.filter(g => !g.outgoing);
      }
      for (const g of showcaseGroups) {
        const bounds = g.mesh.bounds;
        // Fleet dimensions carry the same visual proportions into both selectors.
        const size = 1.4;
        const center = bounds.min.map((value, axis) => (value + bounds.max[axis]) / 2);
        const right = [Math.cos(az)*size,0,-Math.sin(az)*size];
        const up = [Math.sin(az)*Math.sin(tilt)*size,Math.cos(tilt)*size,Math.cos(az)*Math.sin(tilt)*size];
        const fwd = [Math.sin(az)*Math.cos(tilt)*size,-Math.sin(tilt)*size,Math.cos(az)*Math.cos(tilt)*size];
        g.data.set(right,0); g.data.set(up,3); g.data.set(fwd,6);
        const sideAxis = norm(cross(norm(sub(cam.look,cam.pos)),[0,1,0]));
        const phase = app.state === 'gallery' ? 1 : showcaseEntering ? clamp(elapsed/1.2,0,1) : g.outgoing ? clamp(elapsed/.36,0,1) : clamp((elapsed-.36)/.44,0,1);
        const eased = phase*phase*(3-2*phase);
        const opacity = g.outgoing ? 1-eased : eased;
        const offset = app.state === 'gallery' || reducedMotion.matches ? 0 : (g.outgoing ? -eased : 1-eased)*showcaseDirection*8;
        const position = add(showcaseView?.pivot || add(cam.pos, scale(viewForward, distance)), scale(sideAxis, offset));
        for (let axis = 0; axis < 3; axis++) position[axis] -= right[axis] * center[0] + up[axis] * center[1] + fwd[axis] * center[2];
        position[1] += reducedMotion.matches ? 0 : Math.sin(t*1.1)*.1;
        g.data[22] = -(1-opacity);
        g.fade = opacity < .999;
        g.data.set(position,9); g.data.set([1,1,1],12); g.data.set([1,1,1],17);
        Gpu.updateInstances(g.inst,g.data);
      }
    }
    for (const g of app.state === 'cover' || showcasing ? [] : carGroups) {
      // A shared craft group retains detail if any instance is nearby. Keep the
      // player's craft full quality, including cockpit and selection views.
      let distance = Infinity;
      for (const ci of g.ids) {
        const c = cars[ci];
        distance = Math.min(distance, c.isPlayer ? 0 : Math.max(0, Math.hypot(c.x - cam.pos[0], c.y - cam.pos[1], c.z - cam.pos[2]) - c.extent * 2));
      }
      g.lodDistance = distance; g.lodThresholds = [100, 240];
      g.ids.forEach((ci, k) => {
        const c = cars[ci], b = craftBasis(showcasing ? player : c, t), o = k * Gpu.CAR_FLOATS;
        g.data.set(b.right, o); g.data.set(b.up, o + 3); g.data.set(b.fwd, o + 6); g.data.set(b.pos, o + 9); g.data.set(c.color, o + 12);
        g.data[o + 15] = c.spin; g.data[o + 16] = c.steer; g.data.set(c.body, o + 17); g.data[o + 20] = c.glow; g.data[o + 21] = c.dmg; g.data[o + 22] = c.shield > 0 ? 1 : 0;
      });
      Gpu.updateInstances(g.inst, g.data);
    }
    Weapons.fill(t, c => craftBasis(c, t));
    const aspect = hud.canvas.clientWidth / hud.canvas.clientHeight;
    Frame.fill(frame, desc, { pos: cam.pos, look: cam.look, fov: cam.fov, aspect, time: t, shadowCenter: [player.x, player.y, player.z], shadowSize: 180 },
      { routeTime: reducedMotion.matches ? 0 : t, speed01: speedWarp, drift: player.drifting, glow: player.glow, flash: player.flash });
    // Show the generated environment on home, excluding all craft, rings and route markers.
    Gpu.render(app.state === 'cover' ? { ...scene, carGroups:[], particles:false } : showcasing ? { ...scene, carGroups:showcaseGroups, particles:false } : scene);
  }

  // ---------------------------------------------------------------- flow API for the UI
  function worldConfig(planetId = planet?.id || null, seed = seedText) {
    seed = String(seed);
    const samePlanet = planetId === (planet?.id || null);
    const settings = samePlanet ? overrides : null;
    const descriptor = samePlanet && seed === seedText ? desc : World.generate(seed, Planets.planet(planetId) || null, settings);
    return JSON.parse(JSON.stringify({ planetId, seed, overrides: settings, descriptor }));
  }
  function select(o) {
    if (o.mode && o.mode !== app.state && ['showcase','gallery'].includes(o.mode)) { terrainZoomFrom = terrainZoom; terrainZoomStarted = performance.now(); }
    showcaseEntering = o.mode === 'showcase' && !['showcase','gallery'].includes(app.state);
    if (showcaseEntering) { menuOrbit.showcase.yaw = -2.2; menuOrbit.showcase.pitch = .48; showcaseView = null; }
    const stayingInShowcase = ['showcase','gallery','cover'].includes(app.state) && ['showcase','gallery'].includes(o.mode);
    showcaseDirection = Math.sign(o.showcaseDirection || 0);
    if (o.showcasePaints) showcasePaints = { ...o.showcasePaints };
    if (o.world) {
      // A room snapshot replaces all local world settings, even with the same seed.
      const w = o.world;
      planet = Planets.planet(w.planetId) || null;
      overrides = w.overrides ? JSON.parse(JSON.stringify(w.overrides)) : null;
      if (o.mode) app.state = o.mode;
      loadWorld(w.seed, w.descriptor);
      if (app.state === 'race') emit('race');
      return;
    }
    let reload = false;
    if (o.planetId && (!planet || planet.id !== o.planetId)) { planet = Planets.planet(o.planetId) || planet; overrides = null; reload = true; }
    if (o.seed !== undefined && o.seed !== seedText) reload = true;
    if (o.raceId) { const r = Planets.race(o.raceId); if (r) { raceDef = r; craftOverride = null; } }
    if (o.craft !== undefined) craftOverride = o.craft;
    if (o.craftSeed !== undefined) craftSeed = o.craftSeed;
    if (o.mode) app.state = o.mode;
    if (reload) loadWorld(o.seed !== undefined ? o.seed : seedText);
    else { setupCars(); beginPhase(); writeHash(); if (!stayingInShowcase) cam.pos = [player.x + 6, player.y + 8, player.z - 12]; }
    if (app.state === 'race') emit('race');
  }
  const ui = {
    invalidate: () => invalidate(), quality, setQuality, setPaused, paused: () => paused,
    performance: () => ({ ...perf, quality: quality(), renderScale: Gpu.renderScale || 1, renderer: Gpu.metrics || null }),
    on: (ev, f) => { (listeners[ev] = listeners[ev] || []).push(f); },
    showcaseBusy: () => app.state === 'showcase' && performance.now()-showcaseStarted < 800,
    state: () => app.state, planet: () => planet, desc: () => desc, seed: () => seedText, race: () => raceDef,
    randomSeed: randomSeedName, hashQuery: parseHash, playerName: getPlayerName,
    setPlayerName: n => { if (!n) return; playerName = n; try { localStorage.setItem('ir.name', n); } catch (e) {} if (player) player.name = n; },
    order: () => [...cars].sort((a, b) => b.prog - a.prog), finalOrder, trackLength: () => tab.length || 2000,
    trackOutline: () => tab.S.filter((_,i) => i % 4 === 0).map(s => s.p.slice()),
    worldConfig, select, restart: () => { app.state = 'race'; setupCars(); beginPhase(); writeHash(); emit('race'); },
    home: () => { app.state = 'cover'; beginPhase(); writeHash(); },
    setLook: o => { if (desc && desc.look) Object.assign(desc.look, o); invalidate(); },
    // Thumbnails borrow the canvas for one render; this puts the real scene back in the same task.
    redraw: () => { if (document.hidden || paused) return; try { draw(0); } catch (e) {} },
  };
  return {
    start, loadWorld, ui,
    // Hooks for the multiplayer layer: it needs the race clock, the flight step for prediction, and the track table.
    mp: { race: () => rs, step: stepFlight, tab: () => tab, cars: () => cars, respawn },
    tweak: o => {
      if (o.laps) LAPS = o.laps;
      if (o.autopilot && app.state !== 'race') { app.state = 'race'; beginPhase(); writeHash(); emit('race'); }
      // Test hooks: pushOff displaces the player sideways by N metres; turnAround reverses its heading.
      if (o.pushOff && player && player.sample) { player.x += player.sample.right[0] * o.pushOff; player.z += player.sample.right[2] * o.pushOff; delete o.pushOff; }
      if (o.turnAround && player) { player.heading += Math.PI; player.vx = -player.vx; player.vz = -player.vz; delete o.turnAround; }
      Object.assign(camCfg, o);
    }, frameData: () => Array.from(frame), desc: () => desc, hasWater: () => !!(scene && scene.water), groups: () => scene.propGroups.map(g => g.count),
    debug: () => ({ planet: planet && planet.id, mode: desc.mode, ahead: [0.015, 0.03, 0.05].map(o => { const q = World.sampleAt(tab, player.t + o); return { p: q.p, w: q.w, curv: q.curv }; }), w: player.sample ? player.sample.w : 0,
      cars: cars.map(c => [c.x, c.y, c.z, c.t, c.speed].map(v => +v.toFixed(2))), cam,
      weapons: Weapons.stats(), lives: cars.map(c => [+c.life.toFixed(0), c.item, c.wrecks]),
      stuns: cars.map(c => c.stunEvents || 0), insideT: cars.map(c => c.insideT || 0), insideP: cars.map(c => c.insideP || 0),
      offLane: !!player.offLane, offLog: player.offLog || [], laneTargetT: player.laneTargetT, laneDir: player.laneDir, elapsed: +rs.elapsed.toFixed(2), pieces: tab.pieces, kind: tab.kind, gates: boostGates.length, outLane: +player.outLane.toFixed(1), alt: +player.alt.toFixed(1), glow: +player.glow.toFixed(2),
      player: { life: +player.life.toFixed(1), item: player.item, wrecks: player.wrecks, stats: player.stats, lap: player.lap, finished: player.finished, onRoad: player.onRoad, air: player.air, hits: player.hits || 0, shake: +player.shake.toFixed(2), stun: +player.stun.toFixed(2), vy: +player.vy.toFixed(2), x: player.x, y: player.y, z: player.z, t: player.t, speed: player.speed, boost: player.boost, heading: player.heading, pitch: player.pitch, lat: player.lat, vert: player.vert, sp: player.sample && player.sample.p }, race: rs }),
  };
})();
