// Design pages: parametric editors for craft, planets (terrain + look) and tracks, with a live WebGPU preview.
// URL: design.html?mode=vehicle|terrain|track&preset=<id>#<base64 json state>
const Design = (() => {
  const { TAU, clamp, mix, norm, cross, sub, add, scale } = M;
  const b64e = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))), b64d = s => JSON.parse(decodeURIComponent(escape(atob(s))));
  const frame = new Float32Array(Gpu.FRAME_FLOATS);
  let mode, state, scene = null, desc, tab, orbit = { az: 0.8, el: 0.45, dist: 12, center: [0, 0.6, 0], auto: true }, canvas, dirty = true, building = false, rebuildTimer = null;
  let craftGroup = null;

  // ---------------------------------------------------------------- schemas
  const V = (key, label, min, max, step = 0.01) => ({ key, label, min, max, step });
  const CRAFT = [V('length', 'length', 0.6, 1.6), V('width', 'width', 0.5, 1.8), V('height', 'height', 0.3, 1.2), V('nose', 'nose', 0.3, 2.5), V('wingSpan', 'wing span', 0, 2.5), V('wingSweep', 'wing sweep', 0, 1.2), V('wingPos', 'wing position', -0.6, 0.6), V('wingThick', 'wing thickness', 0.03, 0.3), V('fins', 'fins', 0, 3, 1), V('finHeight', 'fin height', 0.2, 1.2), V('canopy', 'canopy', 0, 1.2), V('pods', 'engine pods', 1, 4, 1), V('podSize', 'pod size', 0.2, 0.8), V('glow', 'engine glow', 0.3, 2), V('hue', 'hue', 0, 1)];
  const TERRAIN = [V('terrainAmp', 'height', 4, 90, 1), V('terrainFreq', 'frequency', 0.002, 0.012, 0.0005), V('warp', 'domain warp', 0, 3), V('blocky', 'blocky', 0, 1), V('blockCell', 'block size', 15, 100, 1), V('propType', 'prop kind', 0, 3, 1), V('propDensity', 'prop density', 0.1, 1.5), V('propScale', 'prop scale', 0.5, 8, 0.1), V('twist', 'prop twist', -0.06, 0.06, 0.005), V('quantize', 'quantize', 0, 5, 0.5),
    V('palIdx', 'palette', 0, 999, 1), V('bright', 'light world', 0, 1, 1), V('fog', 'fog', 0.0002, 0.008, 0.0001), V('groundPattern', 'ground pattern', 0, 2, 1), V('bandFreq', 'sky bands', 1, 10, 0.1), V('bandPow', 'band sharpness', 1, 12, 0.1), V('bandAmt', 'band amount', 0, 1),
    V('look.colormap', 'palette map', 0, 1), V('look.dither', 'dither', 0, 0.4), V('look.edge', 'edge lines', 0, 0.8), V('look.posterize', 'posterize', 0, 8, 1)];
  const TRACK = [V('R', 'radius', 150, 400, 1), V('width', 'width', 8, 20, 0.5), V('widthVar', 'width variation', 0, 0.5), V('widthK', 'width waves', 1, 6, 1), V('bank', 'banking', 0, 1),
    V('rad.0.k', 'shape waves A', 1, 7, 1), V('rad.0.a', 'shape amount A', 0, 0.4), V('rad.0.p', 'shape phase A', 0, 6.28, 0.05), V('rad.1.k', 'shape waves B', 1, 9, 1), V('rad.1.a', 'shape amount B', 0, 0.3), V('rad.1.p', 'shape phase B', 0, 6.28, 0.05),
    V('hgt.0.k', 'hill waves A', 1, 5, 1), V('hgt.0.a', 'hill height A', 0, 70, 1), V('hgt.0.p', 'hill phase A', 0, 6.28, 0.05), V('hgt.1.k', 'hill waves B', 1, 7, 1), V('hgt.1.a', 'hill height B', 0, 40, 1), V('hgt.1.p', 'hill phase B', 0, 6.28, 0.05)];
  const TRACK_PRESETS = {
    sprint: { name: 'Sprint Oval', R: 260, width: 15, widthVar: 0.1, widthK: 2, bank: 0.4, rad: [{ k: 2, a: 0.08, p: 0 }, { k: 4, a: 0.02, p: 1 }], hgt: [{ k: 1, a: 8, p: 0 }, { k: 3, a: 3, p: 2 }] },
    mountain: { name: 'Mountain Loop', R: 300, width: 12, widthVar: 0.25, widthK: 3, bank: 0.6, rad: [{ k: 3, a: 0.15, p: 0.5 }, { k: 5, a: 0.06, p: 2 }], hgt: [{ k: 2, a: 50, p: 0 }, { k: 3, a: 20, p: 1 }] },
    clover: { name: 'Clover', R: 280, width: 11, widthVar: 0.2, widthK: 4, bank: 0.7, rad: [{ k: 3, a: 0.32, p: 0 }, { k: 6, a: 0.05, p: 0 }], hgt: [{ k: 3, a: 14, p: 0 }, { k: 6, a: 5, p: 1 }] },
    ribbon: { name: 'Ribbon', R: 320, width: 13, widthVar: 0.15, widthK: 2, bank: 0.5, rad: [{ k: 2, a: 0.22, p: 1.2 }, { k: 5, a: 0.1, p: 3 }], hgt: [{ k: 1, a: 30, p: 0 }, { k: 4, a: 12, p: 2 }] },
  };
  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  const set = (o, path, v) => { const ks = path.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; };

  // ---------------------------------------------------------------- state
  function defaultState() {
    const q = new URLSearchParams(location.search);
    mode = q.get('mode') || 'vehicle';
    const preset = q.get('preset');
    const s = { planet: 'vantera', race: 'vantari', seed: 'Amber-Trefoil-1', craft: null, over: null, track: null, hue: 0.07 };
    if (mode === 'vehicle') { const r = Planets.RACES.find(r => r.vehicle === preset) || Planets.race(preset) || Planets.RACES[0]; s.race = r.id; s.planet = r.planet; const seed = 1 + Planets.RACES.indexOf(r); if (preset === 'kitbash') { const ks = +(q.get('seed') || seed); s.craft = Kitbash.generate(ks, { style: q.get('style') || undefined }); s.craft.seed = ks; s.hue = Math.random(); } else { s.craft = Craft.resolve(Planets.RECIPES[r.vehicle], seed); s.craft.seed = seed; s.hue = r.hue; } }
    if (mode === 'terrain') { const p = Planets.planet(preset) || Planets.PLANETS[0]; s.planet = p.id; s.race = Planets.RACES.find(r => r.planet === p.id).id; s.over = {}; }
    if (mode === 'track') { const t = Tracks.PRESETS[preset] || TRACK_PRESETS[preset] || Tracks.PRESETS.sprint || TRACK_PRESETS.sprint; s.track = JSON.parse(JSON.stringify(t)); delete s.track.name; s.planet = q.get('planet') || 'vantera'; }
    if (location.hash.length > 1) { try { Object.assign(s, b64d(location.hash.slice(1))); } catch (e) {} }
    return s;
  }
  function writeHash() { history.replaceState(null, '', location.pathname + location.search + '#' + b64e(state)); document.getElementById('link').textContent = raceLink(); }
  function raceLink() {
    const q = new URLSearchParams();
    q.set('p', state.planet); q.set('r', state.race); q.set('s', state.seed);
    if (mode === 'vehicle') q.set('v', b64e({ ...state.craft, hue: state.hue }));
    if (mode === 'vehicle' && state.hue !== undefined) q.set('h', String(state.hue));
    if (mode === 'terrain' && state.over && Object.keys(state.over).length) q.set('o', b64e(state.over));
    if (mode === 'track') q.set('o', b64e(state.track));
    return location.href.replace(/design\.html.*$/, 'index.html#' + q.toString());
  }

  // ---------------------------------------------------------------- ui
  function buildUi() {
    const c = document.getElementById('controls'); c.innerHTML = '';
    const title = document.getElementById('title'), sub = document.getElementById('subtitle');
    const sel = (label, opts, cur, onch) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<label>${label}</label>`; const s = document.createElement('select'); s.style.gridColumn = '2 / span 2';
      for (const [v, n] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = n; if (v === cur) o.selected = true; s.appendChild(o); }
      s.onchange = () => onch(s.value); row.appendChild(s); c.appendChild(row);
    };
    const text = (label, cur, onch) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<label>${label}</label>`; const i = document.createElement('input'); i.type = 'text'; i.value = cur; i.style.gridColumn = '2 / span 2';
      i.onchange = () => onch(i.value); row.appendChild(i); c.appendChild(row);
    };
    const h3 = t => { const h = document.createElement('h3'); h.textContent = t; c.appendChild(h); };
    const d0 = makeDesc();
    const slider = (schema, obj) => {
      const row = document.createElement('div'); row.className = 'row';
      let v = get(obj, schema.key);
      if (v === undefined || v === null) v = get(d0, schema.key);
      if (typeof v === 'boolean') v = v ? 1 : 0;
      if (v === undefined || v === null || isNaN(v)) v = schema.min;
      row.innerHTML = `<label title="${schema.key}">${schema.label}</label><input type="range" min="${schema.min}" max="${schema.max}" step="${schema.step}" value="${v}"><output>${fmt(v)}</output>`;
      const inp = row.querySelector('input'), out = row.querySelector('output');
      inp.oninput = () => { const val = +inp.value; set(obj, schema.key, val); out.textContent = fmt(val); schedule(); };
      c.appendChild(row);
    };
    const fmt = v => { const s = Math.abs(v) >= 100 ? (+v).toFixed(0) : Math.abs(v) >= 1 ? (+v).toFixed(2) : (+v).toFixed(3); return s.includes('.') ? s.replace(/\.?0+$/, '') : s; };
    const planetOpts = Planets.PLANETS.map(p => [p.id, p.name]), raceOpts = Planets.RACES.map(r => [r.id, `${r.name} (${Planets.VEHICLES[r.vehicle].name})`]);
    if (mode === 'vehicle') {
      title.textContent = 'Craft designer'; sub.textContent = 'Every craft is a recipe of proportions. Pick a family, drag the sliders, then race it.';
      const fam = state.craft.family || Planets.RACES.find(r => r.id === state.race)?.vehicle || 'falcon';
      const pickArch = (family, name, seed) => { const rec = Planets.RECIPES[family]; const idx = Math.max(0, rec.archetypes.findIndex(a => a.name === name)); let s0 = seed; for (let k = 0; k < 64; k++) { const c = Craft.resolve(rec, s0); if (c.archetype === rec.archetypes[idx].name) { c.seed = s0; return c; } s0++; } const c = Craft.resolve(rec, seed); c.seed = seed; return c; };
      const isKit = fam === 'kitbash';
      sel('family', [...Object.entries(Planets.VEHICLES).map(([k, v]) => [k, v.name]), ['kitbash', 'Kitbash (generated)']], fam, v => { if (v === 'kitbash') { state.craft = Kitbash.generate(1, {}); state.craft.seed = 1; } else { state.craft = Craft.resolve(Planets.RECIPES[v], 1); state.craft.seed = 1; } buildUi(); schedule(true); });
      if (isKit) {
        const regen = (seed, style, hull) => { state.craft = Kitbash.generate(seed, { style: style || undefined, hull: hull || undefined }); state.craft.seed = seed; state.craft.styleLock = style; state.craft.hullLock = hull; buildUi(); schedule(); };
        sel('style', [['', 'any'], ...Kitbash.STYLES.map(x => [x, x])], state.craft.styleLock || '', v => regen(state.craft.seed || 1, v, state.craft.hullLock));
        sel('hull kind', [['', 'any'], ...Kitbash.HULLS.map(x => [x, x])], state.craft.hullLock || '', v => regen(state.craft.seed || 1, state.craft.styleLock, v));
        const row = document.createElement('div'); row.className = 'row';
        row.innerHTML = `<label>kitbash seed</label>`;
        const inp = document.createElement('input'); inp.type = 'number'; inp.value = state.craft.seed || 1; inp.style.gridColumn = '2';
        inp.onchange = () => regen(+inp.value || 1, state.craft.styleLock, state.craft.hullLock);
        const btn = document.createElement('button'); btn.textContent = 'reroll'; btn.style.padding = '3px 6px'; btn.onclick = () => regen(Math.floor(Math.random() * 99999) + 1, state.craft.styleLock, state.craft.hullLock);
        row.appendChild(inp); row.appendChild(btn); c.appendChild(row);
        const nm = document.createElement('div'); nm.style.cssText = 'font-size:11px;opacity:.6;margin:2px 0 6px'; nm.textContent = `${state.craft.archetype} · ${state.craft.style} · ${state.craft.hullKind}`; c.appendChild(nm);
      } else {
        sel('archetype', Planets.RECIPES[fam].archetypes.map(a => [a.name, a.name]), state.craft.archetype, v => { state.craft = pickArch(fam, v, state.craft.seed || 1); buildUi(); schedule(); });
      }
      sel('race as', raceOpts, state.race, v => { state.race = v; schedule(); });
      sel('preview planet', planetOpts, state.planet, v => { state.planet = v; schedule(true); });
      // Stat bars: derived from the geometry, capped by the budget.
      const statBox = document.createElement('div'); statBox.id = 'statbars'; statBox.style.margin = '10px 0';
      c.appendChild(statBox);
      h3('hull and paint');
      sel('two tone', ['none', 'bottom', 'top', 'nose', 'rear'].map(x => [x, x]), state.craft.hull.twoTone || 'none', v => { state.craft.hull.twoTone = v; schedule(); });
      sel('stripe', ['none', 'band', 'diagonal', 'spine', 'chevron', 'checker'].map(x => [x, x]), state.craft.hull.stripe || 'none', v => { state.craft.hull.stripe = v; schedule(); });
      for (const [key, label, min, max, step] of Craft.SCHEMA) { if (key.startsWith('hull.') && get(state.craft, key) !== undefined) slider(V(key, label, min, max, step), state.craft); }
      if (!isKit) slider(V('seed', 'greeble seed', 1, 99, 1), state.craft);
      h3('greebles'); for (const [key, label, min, max, step] of Craft.SCHEMA) { if (key.startsWith('greebles.')) { if (get(state.craft, key) === undefined) set(state.craft, key, 0); slider(V(key, label, min, max, step), state.craft); } }
      h3('parts (socket · along · across)');
      const types = Object.keys(Craft.P).filter(t => !['rivet', 'light', 'skid', 'pad'].includes(t));
      state.craft.parts.forEach((part, idx) => {
        if (part.type === 'skid' || part.type === 'pad' || part.type === 'rivet') return;
        const row = document.createElement('div'); row.className = 'row';
        row.innerHTML = `<label title="${part.type}">${idx + 1} ${part.type}</label>`;
        const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.gap = '3px'; wrap.style.gridColumn = '2 / span 2'; wrap.style.alignItems = 'center';
        const mk = (txt, on, fn, title) => { const b = document.createElement('button'); b.textContent = txt; b.title = title || ''; b.style.padding = '2px 5px'; if (on) { b.style.background = '#fff'; b.style.color = '#000'; } b.onclick = fn; return b; };
        const sock = document.createElement('select'); sock.style.width = '64px'; for (const t of Craft.SOCKETS) { const o = document.createElement('option'); o.value = t; o.textContent = t; if (t === (part.socket || 'flank')) o.selected = true; sock.appendChild(o); }
        sock.onchange = () => { part.socket = sock.value; delete part.at; schedule(); };
        const num = (key, min, max, title) => { const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = 0.05; i.value = part[key] ?? 0; i.title = title; i.style.width = '52px'; i.oninput = () => { part[key] = +i.value; delete part.at; schedule(); }; return i; };
        wrap.appendChild(sock); wrap.appendChild(num('u', -1, 1, 'along the hull, tail to nose'));
        wrap.appendChild(num(part.socket === 'tail' || part.socket === 'nose' ? 'w' : 'v', -1, 1, 'across'));
        wrap.appendChild(mk('M', part.mirror, () => { part.mirror = !part.mirror; buildUi(); schedule(); }, 'mirror'));
        wrap.appendChild(mk('2', part.tone === 1, () => { part.tone = part.tone === 1 ? 0 : 1; buildUi(); schedule(); }, 'second tone'));
        wrap.appendChild(mk('+', false, () => { part.scale = (part.scale || 1) * 1.15; schedule(); }, 'bigger'));
        wrap.appendChild(mk('-', false, () => { part.scale = (part.scale || 1) / 1.15; schedule(); }, 'smaller'));
        wrap.appendChild(mk('x', false, () => { state.craft.parts.splice(idx, 1); buildUi(); schedule(); }, 'remove'));
        row.appendChild(wrap); c.appendChild(row);
      });
      sel('add part', [['', '…'], ...types.map(t => [t, t])], '', v => { if (!v) return; state.craft.parts.push({ type: v, socket: ['bell', 'thrusterCluster'].includes(v) ? 'tail' : ['grille', 'ramProw'].includes(v) ? 'nose' : ['fin', 'mast', 'dome', 'hatch', 'vent', 'antenna', 'turret', 'radar', 'rotor', 'sail', 'bubble', 'visor', 'torus', 'cageFrame', 'number'].includes(v) ? 'spine' : 'flank', u: 0, v: 0.3, w: 0.45, mirror: !['mast', 'radar', 'torus', 'cageFrame', 'bubble', 'visor', 'ramProw'].includes(v) }); buildUi(); schedule(); });
      const fixes = document.createElement('div'); fixes.id = 'fixes'; fixes.style.cssText = 'font-size:10px;opacity:.5;margin-top:6px'; c.appendChild(fixes);
      h3('colour'); slider(V('hue', 'hue', 0, 1, 0.01), state);
    } else if (mode === 'terrain') {
      title.textContent = 'Planet designer'; sub.textContent = 'Terrain, props, palette and the print look. Values here override the planet\'s seeded ranges.';
      sel('planet base', planetOpts, state.planet, v => { state.planet = v; state.race = Planets.RACES.find(r => r.planet === v).id; state.over = {}; buildUi(); schedule(true); });
      text('seed', state.seed, v => { state.seed = v; schedule(true); });
      h3('terrain'); for (const s of TERRAIN.slice(0, 10)) slider(s, state.over);
      h3('atmosphere'); for (const s of TERRAIN.slice(10, 17)) slider(s, state.over);
      h3('look'); for (const s of TERRAIN.slice(17)) slider(s, state.over);
    } else {
      title.textContent = 'Track designer'; sub.textContent = 'A track is a closed curve: a base circle with waves on its radius and height. Two waves each is plenty.';
      sel('preset', Object.entries(Tracks.PRESETS).map(([k, v]) => [k, v.name]), null, v => { state.track = JSON.parse(JSON.stringify(Tracks.PRESETS[v])); delete state.track.name; buildUi(); schedule(true); });
      if (!state.track.track) state.track.track = { kind: 'fourier' };
      sel('construction', ['fourier', 'grammar', 'figure8', 'spiral', 'oval'].map(x => [x, x]), state.track.track.kind || 'fourier', v => { state.track.track.kind = v; schedule(true); });
      sel('follow terrain', ['none', 'valley', 'ridge', 'causeway'].map(x => [x, x]), state.track.track.follow || 'none', v => { state.track.track.follow = v === 'none' ? undefined : v; schedule(true); });
      sel('personality', [['', 'planet default'], ...Planets.PLANETS.map(p => [p.id, p.name])], state.track.track.personality || '', v => { state.track.track.personality = v || undefined; schedule(true); });
      sel('planet', planetOpts, state.planet, v => { state.planet = v; state.race = Planets.RACES.find(r => r.planet === v).id; schedule(true); });
      text('seed', state.seed, v => { state.seed = v; schedule(true); });
      h3('shape'); for (const s of TRACK.slice(0, 11)) slider(s, state.track);
      h3('hills'); for (const s of TRACK.slice(11)) slider(s, state.track);
    }
    document.getElementById('race').onclick = () => { location.href = raceLink(); };
    document.getElementById('copy').onclick = () => { writeHash(); navigator.clipboard?.writeText(location.href); document.getElementById('status').textContent = 'link copied'; setTimeout(() => document.getElementById('status').textContent = '', 1500); };
    document.getElementById('rand').onclick = () => {
      const r = Math.random;
      if (mode === 'vehicle') { if (state.craft.family === 'kitbash') { const seed = Math.floor(r() * 99999) + 1; state.craft = Kitbash.generate(seed, {}); state.craft.seed = seed; } else { const fams = Object.keys(Planets.RECIPES); const seed = Math.floor(r() * 99) + 1; state.craft = Craft.resolve(Planets.RECIPES[fams[Math.floor(r() * fams.length)]], seed); state.craft.seed = seed; } state.hue = r(); }
      else if (mode === 'terrain') { state.seed = World.nameFor((r() * 4294967296) >>> 0).replace(' ', '-'); state.over = {}; }
      else { for (const s of TRACK) set(state.track, s.key, s.step >= 1 ? Math.round(mix(s.min, s.max, r())) : mix(s.min, s.max, r())); }
      buildUi(); schedule(true);
    };
  }

  // ---------------------------------------------------------------- build preview
  function schedule(heavy) {
    dirty = true; writeHash();
    if (mode === 'vehicle' && !heavy) { rebuildCraft(); return; }
    if (mode === 'terrain' && !heavy) {
      // Light changes (palette, look, props) only need a new descriptor; terrain only when its keys changed.
      const k = Object.keys(state.over || {});
      const terrainKeys = ['terrainAmp', 'terrainFreq', 'warp', 'blocky', 'blockCell', 'propType', 'propDensity', 'propScale'];
      if (!k.some(x => terrainKeys.includes(x)) || lastTerrainSig() === terrainSig()) { rebuildDescOnly(); return; }
    }
    clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 350);
  }
  let lastSig = '';
  const terrainSig = () => JSON.stringify([state.seed, state.planet, ...['terrainAmp', 'terrainFreq', 'warp', 'blocky', 'blockCell', 'propType', 'propDensity', 'propScale'].map(k => state.over && state.over[k])]);
  const lastTerrainSig = () => lastSig;
  function makeDesc() {
    const planet = Planets.planet(state.planet);
    const over = mode === 'terrain' ? state.over : mode === 'track' ? state.track : null;
    const d = World.generate(state.seed, planet, over);
    if (mode === 'vehicle') { d.noTerrain = true; }
    return d;
  }
  function rebuildDescOnly() {
    desc = makeDesc();
    if (mode === 'terrain' && scene && scene.props) {
      // props depend on density/scale/type: rebuild them cheaply
      Gpu.destroyGroups([scene.props]);
      const inst = desc.mode === 'corridor' ? Geo.buildVolumeProps(desc, tab) : Geo.buildPropInstances(desc, tab, scene.terrain);
      scene.props = { mesh: Gpu.createMesh(Geo.buildPropMesh(desc.propType)), inst: Gpu.createInstances(inst), count: inst.length / 8 };
    }
  }
  function rebuild() {
    building = true; document.getElementById('status').textContent = 'building…';
    setTimeout(() => {
      Gpu.destroyScene(scene);
      scene = null; craftGroup = null;
      desc = makeDesc();
      tab = World.buildSamples(desc, 800);
      const statics = [];
      let terrain = { heightAt: () => -600 };
      if (mode !== 'vehicle' && !desc.noTerrain) { terrain = Geo.buildTerrain(desc, tab, 300, { flatten: desc.mode !== 'corridor' }); statics.push(Gpu.createMesh(terrain)); }
      if (mode !== 'vehicle' && desc.mode !== 'corridor') statics.push(Gpu.createMesh(Geo.buildTrack(tab)));
      let props = null;
      if (mode !== 'vehicle') {
        const inst = desc.mode === 'corridor' ? Geo.buildVolumeProps(desc, tab) : Geo.buildPropInstances(desc, tab, terrain);
        props = { mesh: Gpu.createMesh(Geo.buildPropMesh(desc.propType)), inst: Gpu.createInstances(inst), count: inst.length / 8 };
      }
      scene = { frame, statics, props, carGroups: [], terrain, propGroups: [], water: null };
      if (mode !== 'vehicle') {
        const env = Flora.buildScene(desc, tab, terrain);
        for (const g of env.groups) scene.propGroups.push({ mesh: Gpu.createMesh(g.mesh), inst: Gpu.createInstances(g.inst), count: g.count });
        if (env.water) scene.water = Gpu.createMesh(env.water);
      }
      if (mode === 'vehicle') { rebuildCraft(); orbit.center = [0, 0.7, 0]; orbit.dist = 11; }
      else {
        let avgY = 0; for (const s of tab.S) avgY += s.p[1] / tab.N;
        orbit.center = [0, avgY, 0]; orbit.dist = tab.maxR * 1.9; orbit.el = 0.7;
      }
      lastSig = terrainSig();
      building = false; document.getElementById('status').textContent = `${desc.name} · palette ${desc.palIdx}`;
    }, 10);
  }
  function rebuildCraft() {
    if (!scene) return;
    Gpu.destroyGroups(scene.carGroups);
    const built = Craft.build(state.craft, state.craft.seed || 1);
    const mesh = Gpu.createMesh(built);
    const data = new Float32Array(Gpu.CAR_FLOATS);
    craftGroup = { mesh, inst: Gpu.createInstances(data), data, count: 1 };
    scene.carGroups = [craftGroup];
    // Stat bars and grounding notes.
    const st = Stats.compute(state.craft, state.craft.seed || 1);
    const box = document.getElementById('statbars');
    if (box) {
      const bar = (label, v) => `<div class="row" style="margin:3px 0"><label>${label}</label><div style="grid-column:2 / span 2;height:8px;background:#222;border-radius:4px;overflow:hidden"><div style="width:${Math.round(v * 100)}%;height:100%;background:${v > 0.75 ? '#fff' : '#9cf'}"></div></div></div>`;
      box.innerHTML = bar('speed', st.bars.speed) + bar('acceleration', st.bars.accel) + bar('drift', st.bars.drift) + bar('defense', st.bars.defense) + bar('life', st.bars.life) +
        `<div style="font-size:10px;opacity:.6;margin-top:4px">${st.role || ''} · ${st.archetype || ''} · mass x${st.massMul.toFixed(2)} · grip x${st.gripMul.toFixed(2)} · budget ${Math.round(st.budget * 100)}%${st.budget > 1 ? ' (scaled to fit)' : ''} · ${built.tris} tris</div>`;
    }
    const fx = document.getElementById('fixes');
    if (fx) fx.textContent = (built.fixes.length ? 'grounding: ' + built.fixes.join(', ') : '') + (built.rejections ? ` · ${built.rejections} rejected builds` : '') + (built.problems.length ? ' · unresolved: ' + built.problems.join(', ') : '');
  }
  function hsl(h, s, l) { const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }

  // ---------------------------------------------------------------- loop
  function bindOrbit() {
    let drag = null;
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; orbit.auto = false; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!drag) return; orbit.az += (e.clientX - drag.x) * 0.006; orbit.el = clamp(orbit.el + (e.clientY - drag.y) * 0.006, -0.2, 1.4); drag = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('wheel', e => { orbit.dist *= Math.exp(e.deltaY * 0.001); e.preventDefault(); }, { passive: false });
  }
  function drawFrame(t) {
    if (!scene || !desc) return;
    if (orbit.auto) orbit.az += 0.004;
    const c = orbit.center, d = orbit.dist;
    const pos = [c[0] + Math.cos(orbit.az) * Math.cos(orbit.el) * d, c[1] + Math.sin(orbit.el) * d, c[2] + Math.sin(orbit.az) * Math.cos(orbit.el) * d];
    if (craftGroup) {
      const o = 0, g = craftGroup.data, col = hsl(state.hue, 0.75, 0.55);
      const bob = Math.sin(t * 2.2) * 0.08;
      g.set([1, 0, 0], o); g.set([0, 1, 0], o + 3); g.set([0, 0, 1], o + 6); g.set([0, bob, 0], o + 9); g.set(col, o + 12);
      g[o + 15] = 0; g[o + 16] = Math.sin(t) * 0.3; g.set([1, 1, 1], o + 17); g[o + 20] = 0.6 + Math.sin(t * 3) * 0.2;
      Gpu.updateInstances(craftGroup.inst, g);
    }
    Frame.fill(frame, desc, { pos, look: c, fov: mode === 'vehicle' ? 40 : 55, aspect: canvas.clientWidth / canvas.clientHeight, time: t, shadowCenter: c, shadowSize: mode === 'vehicle' ? 12 : (tab ? tab.maxR * 1.6 : 400) }, { speed01: 0 });
    Gpu.render(scene);
  }
  async function start() {
    canvas = document.getElementById('gl');
    await Gpu.init(canvas);
    state = defaultState();
    buildUi(); bindOrbit(); writeHash();
    rebuild();
    const loop = now => { drawFrame(now / 1000); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  return { start, state: () => state, presets: TRACK_PRESETS };
})();
