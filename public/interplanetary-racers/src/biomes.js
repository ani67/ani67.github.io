// Biome content: four new planets with races, and biome dressing for the original planets.
// Loaded after planets.js; appends to Planets.PLANETS / RACES and mutates existing planets in place.
// biome.flags bits: 1 colour ramp, 2 farmland patchwork, 4 striated rock bands, 8 waterfall streaks, 16 lava.
(() => {
  const G = Planets.GROUND;
  const NEW = [
    {
      id: 'verdance', name: 'Verdance', tagline: 'Red-trunk jungle over drowned valleys', mode: 'surface', medium: 'ground',
      family: ['flow', 'rose'], R: [220, 300],
      terrain: { amp: [22, 40], freq: [0.004, 0.006], warp: [1.0, 1.8], blocky: [0, 0], cell: [30, 60], ridged: [0.2, 0.5] }, terrainDrop: 7,
      props: 3, propDensity: [0.08, 0.15], propScale: [1.5, 2.5],
      palette: { hue: [0.2, 0.46], sat: [0.25, 0.9], light: [0.3, 0.65] }, bright: true,
      look: { colormap: [0, 0.05], dither: [0, 0.1], edge: [0.3, 0.5], posterize: [0, 0] },
      fog: [0.0011, 0.0018], bands: [2, 4], bandPow: [3, 6], groundPattern: 0, stars: 0, sun: [0.5, 0.7, 0.3],
      physics: { ...G, grip: 7, offroad: 0.55 },
      biome: {
        flags: 1, propsets: ['forest'], flora: { palm: 1.2, round: 1.4, puff: 0.5, pine: 0.3, boulder: 0.3, grass: 1.5, flower: 0.6, log: 0.15, reed: 0.6, lily: 0.5 },
        density: [0.75, 1.0], scale: [1.0, 1.3], waterLevel: [-4, -1.5], shoulder: 55, clumpFreq: 0.006, clouds: [0.15, 0.35], cloudHeight: 110,
        colors: { grass: '4a9a3c', rock: '7a4a3c', high: 'b6d46a', shore: 'c9b26a', trunk: 'c8352a', canopyA: '2f9a52', canopyB: '9ad84a', rockF: '7a746a', flowerHue: 0.92, skyH: 'eaf3d6', skyZ: '7fc0b8', emis: 'ff6a3a', waterDeep: '1f5a6a', waterShallow: '3fa8a0' },
        ramp: { highStart: 24, slope: 0.5, shoreBand: 2.5 },
      },
    },
    {
      id: 'halcyon', name: 'Halcyon', tagline: 'Atolls and causeways in turquoise shallows', mode: 'surface', medium: 'ground',
      family: ['oval', 'flow'], R: [240, 320],
      terrain: { amp: [12, 20], freq: [0.005, 0.008], warp: [0.5, 1.2], blocky: [0, 0], cell: [30, 60], ridged: [0, 0] }, terrainDrop: 9,
      props: 3, propDensity: [0.05, 0.1], propScale: [1, 2],
      palette: { hue: [0.45, 0.58], sat: [0.3, 1], light: [0.45, 0.8] }, bright: true,
      look: { colormap: [0, 0.05], dither: [0, 0.08], edge: [0.25, 0.45], posterize: [0, 0] },
      fog: [0.0008, 0.0014], bands: [2, 4], bandPow: [3, 6], groundPattern: 0, stars: 0, sun: [0.5, 0.8, 0.3],
      physics: { ...G, offroad: 0.7, hover: 1.0, bob: 0.1 },
      biome: {
        flags: 1, propsets: ['forest', 'rocks'], flora: { palm: 1.6, grass: 0.8, boulder: 0.35, flower: 0.3, reed: 0.5, lily: 0.2 },
        density: [0.6, 0.9], scale: [1.0, 1.2], waterLevel: [-2.5, -1.2], shoulder: 30, clumpFreq: 0.009, clouds: [0.2, 0.4], cloudHeight: 90,
        colors: { grass: 'd9c98a', rock: '8a7a63', high: '6fa85a', shore: 'efe2b0', trunk: '8a6a48', canopyA: '4f9a4a', canopyB: '86c25a', rockF: '8a8a80', flowerHue: 0.05, skyH: 'e8f2f4', skyZ: '5fa8d8', emis: '3ad0ff', waterDeep: '1a7fa8', waterShallow: '5fe0d8' },
        ramp: { highStart: 8, slope: 0.55, shoreBand: 3.5 },
      },
    },
    {
      id: 'embervale', name: 'Ember Vale', tagline: 'Autumn terraces and white falls', mode: 'surface', medium: 'ground',
      family: ['mountain', 'flow'], R: [240, 320],
      terrain: { amp: [30, 50], freq: [0.0035, 0.0055], warp: [0.8, 1.5], blocky: [0.2, 0.4], cell: [40, 70], ridged: [0.25, 0.5] }, terrainDrop: 6,
      props: 3, propDensity: [0.05, 0.1], propScale: [1, 2],
      palette: { hue: [0.05, 0.12], sat: [0.35, 1], light: [0.35, 0.7] }, bright: true,
      look: { colormap: [0, 0.05], dither: [0, 0.1], edge: [0.3, 0.5], posterize: [0, 0] },
      fog: [0.0012, 0.002], bands: [2, 3], bandPow: [4, 8], groundPattern: 0, stars: 0, sun: [0.6, 0.45, 0.5],
      physics: { ...G, grip: 7.2, offroad: 0.6 },
      biome: {
        flags: 1 | 8, propsets: ['forest', 'rocks'], flora: { puff: 1.6, pine: 0.5, round: 0.4, boulder: 0.5, grass: 1.0, log: 0.3, flower: 0.2, reed: 0.3, lily: 0.2 },
        density: [0.65, 0.9], scale: [1.0, 1.25], waterLevel: [-3, -1.5], shoulder: 60, terrace: [0.5, 0.8], clumpFreq: 0.007, clouds: [0.1, 0.25], cloudHeight: 120,
        colors: { grass: 'e2a63c', rock: '8a7a66', high: 'f1e6cc', shore: 'd4bc8c', trunk: '6f4c33', canopyA: 'f29a2a', canopyB: 'd9462a', rockF: '948c7e', flowerHue: 0.12, skyH: 'f6ead6', skyZ: '78b4dc', emis: 'ffb03a', waterDeep: '2a5f78', waterShallow: '6fb8c8' },
        ramp: { highStart: 30, slope: 0.45, shoreBand: 2 },
      },
    },
    {
      id: 'cinder', name: 'Cinder', tagline: 'Black rock, lava seams, ash sky', mode: 'surface', medium: 'ground',
      family: ['rose', 'flow'], R: [220, 300],
      terrain: { amp: [20, 35], freq: [0.005, 0.008], warp: [1.0, 2.0], blocky: [0.1, 0.3], cell: [25, 50], ridged: [0.5, 0.8] }, terrainDrop: 5,
      props: 1, propDensity: [0.2, 0.4], propScale: [1.5, 3],
      palette: { hue: [0.0, 1.0], sat: [0.0, 0.3], light: [0.08, 0.35] }, bright: false,
      look: { colormap: [0, 0.05], dither: [0.05, 0.2], edge: [0.3, 0.5], posterize: [0, 0] },
      fog: [0.0025, 0.004], bands: [1, 2], bandPow: [4, 8], groundPattern: 0, stars: 0, sun: [0.3, 0.4, 0.85],
      physics: { ...G, grip: 7.5, offroad: 0.5 },
      biome: {
        flags: 1 | 16, propsets: ['lava'], flora: { boulder: 1.5 }, density: [0.35, 0.55], scale: [1.2, 1.6], waterLevel: [-3, -1.5], shoulder: 70, clouds: [0.1, 0.2], cloudHeight: 70, cloudScale: 1.3,
        colors: { grass: '2b2724', rock: '1c1a19', high: '4a4441', shore: '3a2420', trunk: '333333', canopyA: '444444', canopyB: '555555', rockF: '2e2a28', flowerHue: 0, skyH: '5a4a44', skyZ: '2a2426', emis: 'ff5a1a' },
        ramp: { highStart: 20, slope: 0.5, shoreBand: 3, lava: 1 },
      },
    },
    {
      id: 'redrock', name: 'Redrock', tagline: 'Mesas, arches and slot canyons', mode: 'surface', medium: 'ground',
      family: ['flow', 'oval'], R: [260, 340],
      terrain: { amp: [55, 85], freq: [0.0028, 0.004], warp: [0.8, 1.4], blocky: [0, 0], cell: [40, 70], ridged: [0.5, 0.8] }, terrainDrop: 30,
      props: 1, propDensity: [0, 0], propScale: [1, 1],
      palette: { hue: [0.02, 0.1], sat: [0.45, 1], light: [0.35, 0.7] }, bright: true,
      look: { colormap: [0, 0.05], dither: [0, 0.1], edge: [0.3, 0.5], posterize: [0, 0] },
      fog: [0.0006, 0.001], bands: [2, 3], bandPow: [4, 8], groundPattern: 0, stars: 0, sun: [0.55, 0.5, 0.65],
      corridor: { radius: 34, gate: 220 },
      physics: { ...G, grip: 7, offroad: 0.8 },
      biome: {
        flags: 1 | 4, propsets: ['canyon'], flora: { boulder: 0.6, grass: 0.5 }, density: [0.25, 0.4], scale: [1.4, 2.0], shoulder: 18, clouds: [0.05, 0.15], cloudHeight: 160, nearBoost: 1.2,
        colors: { grass: 'd8a468', rock: '8f3d22', high: 'efd3a0', shore: 'd9b07a', trunk: '5a3a2a', canopyA: '7f8a44', canopyB: 'a09a4c', rockF: 'b8552f', flowerHue: 0.08, skyH: 'f3dcc0', skyZ: '78a8d8', emis: 'ff8a3a' },
        ramp: { highStart: 60, slope: 0.4, shoreBand: 2 },
        terrainKind: 'canyon',
      },
    },
    {
      id: 'vitrine', name: 'Vitrine', tagline: 'Frozen ridges under a thin sun', mode: 'surface', medium: 'ground',
      family: ['mountain', 'flow'], R: [240, 320],
      terrain: { amp: [45, 70], freq: [0.0035, 0.005], warp: [0.6, 1.2], blocky: [0, 0], cell: [40, 70], ridged: [0.7, 0.95] }, terrainDrop: 22,
      props: 1, propDensity: [0, 0], propScale: [1, 1],
      palette: { hue: [0.5, 0.64], sat: [0.15, 0.6], light: [0.55, 0.85] }, bright: true,
      look: { colormap: [0, 0.05], dither: [0.05, 0.15], edge: [0.3, 0.5], posterize: [0, 0] },
      fog: [0.0009, 0.0015], bands: [2, 4], bandPow: [3, 6], groundPattern: 0, stars: 0, sun: [0.3, 0.35, 0.85],
      corridor: { radius: 32, gate: 200 },
      physics: { ...G, grip: 5.5, driftGrip: 1.2, offroad: 0.7 },
      biome: {
        flags: 1, propsets: ['frozen'], flora: { pine: 0.6, boulder: 0.3 }, density: [0.15, 0.3], scale: [1.2, 1.8], shoulder: 22, treeLine: 30, clouds: [0.2, 0.4], cloudHeight: 150, nearBoost: 1.2,
        colors: { grass: 'e8eef4', rock: '7d8aa0', high: 'ffffff', shore: 'cfd8e0', trunk: '3f4a5a', canopyA: 'f4f8ff', canopyB: 'dbe8f5', rockF: 'a9d6ee', flowerHue: 0.55, skyH: 'e9f0f8', skyZ: '9ec0e8', emis: '7ae0ff' },
        ramp: { highStart: 18, slope: 0.35, shoreBand: 2 },
        terrainKind: 'frozen',
      },
    },
    {
      id: 'meridian', name: 'Meridian', tagline: 'A city at dusk, lights coming on', mode: 'surface', medium: 'ground',
      family: ['oval', 'flow'], R: [260, 340],
      terrain: { amp: [6, 12], freq: [0.004, 0.006], warp: [0.3, 0.8], blocky: [0, 0], cell: [40, 70], ridged: [0, 0] }, terrainDrop: 4,
      props: 1, propDensity: [0, 0], propScale: [1, 1],
      palette: { hue: [0.72, 0.98], sat: [0.3, 0.9], light: [0.3, 0.6] }, bright: false,
      look: { colormap: [0, 0.05], dither: [0.05, 0.15], edge: [0.3, 0.5], posterize: [0, 0] },
      fog: [0.0012, 0.002], bands: [3, 5], bandPow: [3, 6], groundPattern: 1, stars: 1, sun: [0.7, 0.18, 0.6],
      corridor: { radius: 30, gate: 190 },
      physics: { ...G, grip: 8, offroad: 0.9 },
      biome: {
        flags: 1, propsets: ['city'], flora: { round: 1, grass: 0.6 }, density: [0.15, 0.25], scale: [1.0, 1.3], shoulder: 40, cell: 9, clouds: [0.1, 0.2], cloudHeight: 140, nearBoost: 0.8,
        colors: { grass: '4d4a58', rock: '3a3746', high: '6e6a7c', shore: '4a4655', trunk: '2a2830', canopyA: '3f7a5a', canopyB: '5c9a66', rockF: '5a5866', flowerHue: 0.1, skyH: 'f0a070', skyZ: '3a2a5a', emis: 'ffb060' },
        ramp: { highStart: 40, slope: 0.6, shoreBand: 2 },
        terrainKind: 'city',
      },
    },
    {
      id: 'lumen', name: 'Lumen', tagline: 'Floating islands and crystal groves', mode: 'surface', medium: 'ground',
      family: ['rose', 'flow'], R: [240, 320],
      terrain: { amp: [18, 30], freq: [0.004, 0.006], warp: [1.2, 2.2], blocky: [0, 0], cell: [40, 70], ridged: [0.1, 0.3] }, terrainDrop: 8,
      props: 1, propDensity: [0, 0], propScale: [1, 1],
      palette: { hue: [0.7, 0.95], sat: [0.25, 0.8], light: [0.5, 0.85] }, bright: true,
      look: { colormap: [0, 0.05], dither: [0, 0.1], edge: [0.25, 0.45], posterize: [0, 0] },
      fog: [0.0007, 0.0012], bands: [3, 6], bandPow: [2, 5], groundPattern: 0, stars: 0, sun: [0.4, 0.75, 0.4],
      corridor: { radius: 34, gate: 210 },
      physics: { ...G, grip: 6.5, offroad: 0.75, hover: 1.2, bob: 0.12 },
      biome: {
        flags: 1, propsets: ['weird'], flora: { puff: 0.6, round: 0.4, grass: 1.2, flower: 1.5, boulder: 0.2 }, density: [0.5, 0.8], scale: [1.0, 1.4], waterLevel: [-3, -1.5], shoulder: 30, clouds: [0.25, 0.45], cloudHeight: 120, nearBoost: 1.0,
        colors: { grass: 'b7d9a6', rock: '8a6fa8', high: 'f2e9ff', shore: 'e8d6c0', trunk: '7a4f8a', canopyA: 'e07ab8', canopyB: '9fd6e8', rockF: 'a48ac4', flowerHue: 0.85, skyH: 'f6e6f2', skyZ: '9fb6ee', emis: 'ff7ad0', waterDeep: '5a3f8a', waterShallow: 'b58ad8' },
        ramp: { highStart: 22, slope: 0.5, shoreBand: 2.5 },
        terrainKind: 'weird',
      },
    },
  ];
  for (const p of NEW) Planets.PLANETS.push(p);
  Planets.RACES.push(
    { id: 'verdani', name: 'Verdani', planet: 'verdance', vehicle: 'manta', hue: 0.33, ability: { name: 'Canopy', desc: 'Grip off road', offroad: 0.85 } },
    { id: 'halcyonites', name: 'Halcyonites', planet: 'halcyon', vehicle: 'falcon', hue: 0.5, ability: { name: 'Tidal', desc: 'Stronger boosts', boostMul: 1.25 } },
    { id: 'emberkin', name: 'Emberkin', planet: 'embervale', vehicle: 'dune', hue: 0.08, ability: { name: 'Emberdrift', desc: 'Drift charges faster', driftCharge: 1.4 } },
    { id: 'cindral', name: 'Cindral', planet: 'cinder', vehicle: 'hulk', hue: 0.98, ability: { name: 'Slagplate', desc: 'Half wipeout time', crashResist: 0.5 } },
    { id: 'redrunners', name: 'Redrunners', planet: 'redrock', vehicle: 'dune', hue: 0.05, ability: { name: 'Thermal', desc: 'Boost pads and gates give more', padMul: 1.5 } },
    { id: 'vitrines', name: 'Vitrines', planet: 'vitrine', vehicle: 'needle', hue: 0.55, ability: { name: 'Glide', desc: 'Sharper steering', steer: 1.2 } },
    { id: 'meridians', name: 'Meridians', planet: 'meridian', vehicle: 'prism', hue: 0.78, ability: { name: 'Gridlock', desc: 'Drift charges faster', driftCharge: 1.5 } },
    { id: 'lumenari', name: 'Lumenari', planet: 'lumen', vehicle: 'manta', hue: 0.9, ability: { name: 'Uplift', desc: 'Stronger boosts', boostMul: 1.3 } },
  );

  // Custom terrain per biome kind: canyon terraces, frozen ridges, flat city, weird hollows. Heights before terrainDrop.
  const TERRAIN = {
    canyon(d, x, z, fbm) {
      const f = d.terrainFreq;
      const wx = fbm(x * f * 0.4 + 3.1, z * f * 0.4) * d.warp * 70, wz = fbm(x * f * 0.4 - 7.7, z * f * 0.4 + 2.2) * d.warp * 70;
      const n = fbm((x + wx) * f, (z + wz) * f, 5) * 0.5 + 0.5;               // 0..1 plateau relief
      const ridge = 1 - Math.abs(fbm((x - wx) * f * 1.7 + 11, (z + wz) * f * 1.7, 4));
      // Terraced plateau everywhere, then a network of narrow winding canyons carved where a low-frequency noise crosses zero.
      const L = 5, lv = n * L, fl = Math.floor(lv), fr = lv - fl;
      const step = (fl + M.smoothstep(0.42, 0.58, fr)) / L;
      const plateau = 0.55 + step * 0.45 + ridge * 0.12 * step;
      const c1 = Math.abs(fbm((x + wx * 0.5) * f * 0.55 + 21, (z - wz * 0.5) * f * 0.55 - 8, 3));
      const c2 = Math.abs(fbm((x - wx * 0.3) * f * 0.9 - 4, (z + wz * 0.3) * f * 0.9 + 17, 3));
      // Canyons wide enough for a 40 m lane between the walls (about 120 to 180 m at the floor).
      const canyon = Math.min(M.smoothstep(0.04, 0.26, c1), M.smoothstep(0.03, 0.18, c2) * 0.6 + 0.4);
      const floorBumps = fbm(x * f * 3 + 5, z * f * 3, 2) * 0.03;
      const h = plateau * canyon + (0.06 + floorBumps) * (1 - canyon);
      return h * d.terrainAmp * 1.5 - d.terrainAmp * 0.15;
    },
    frozen(d, x, z, fbm) {
      const f = d.terrainFreq;
      const wx = fbm(x * f * 0.5 + 3.1, z * f * 0.5) * d.warp * 40, wz = fbm(x * f * 0.5 - 7.7, z * f * 0.5 + 2.2) * d.warp * 40;
      const base = fbm((x + wx) * f, (z + wz) * f, 4);
      const r1 = 1 - Math.abs(fbm(x * f * 1.3 + 5, z * f * 1.3 - 9, 3)), r2 = 1 - Math.abs(fbm(x * f * 2.6 - 2, z * f * 2.6 + 4, 3));
      const ridge = Math.pow(r1, 2.2) * 0.75 + Math.pow(r2, 3) * 0.25;
      const big = fbm(x * f * 0.15, z * f * 0.15, 2);
      return (base * 0.3 + ridge * 0.95 + big * 0.5) * d.terrainAmp;
    },
    city(d, x, z, fbm) {
      const f = d.terrainFreq;
      const base = fbm(x * f, z * f, 3) * 0.35 + fbm(x * f * 0.2, z * f * 0.2, 2) * 0.65;
      const hill = Math.max(0, fbm(x * f * 0.3 + 9, z * f * 0.3 - 4, 2)) * 2.2;
      return (base + hill) * d.terrainAmp;
    },
    weird(d, x, z, fbm) {
      const f = d.terrainFreq;
      const wx = fbm(x * f * 0.5 + 3.1, z * f * 0.5) * d.warp * 60, wz = fbm(x * f * 0.5 - 7.7, z * f * 0.5 + 2.2) * d.warp * 60;
      const n = fbm((x + wx) * f, (z + wz) * f, 4);
      const cells = fbm(x * f * 0.6 + 21, z * f * 0.6 - 13, 2);
      const hollow = -M.smoothstep(0.25, 0.6, cells) * 1.1;   // scooped bowls
      const bump = Math.pow(Math.max(0, fbm(x * f * 1.4, z * f * 1.4, 3)), 2) * 1.6;
      return (n * 0.7 + hollow + bump) * d.terrainAmp;
    },
  };
  for (const p of NEW) if (p.biome && p.biome.terrainKind) p.biome.terrainFn = TERRAIN[p.biome.terrainKind];
  // The world descriptor is a JSON copy of the biome block, so functions do not survive; hand the terrain
  // function in through the overrides channel (merged before the track planner samples the terrain).
  const hookWorld = () => {
    if (typeof World === 'undefined' || World.__biomeHooked) return;
    const orig = World.generate;
    World.generate = (seed, P, o) => orig(seed, P, (P && P.biome && P.biome.terrainFn) ? Object.assign({}, o || {}, { terrainFn: P.biome.terrainFn }) : o);
    World.__biomeHooked = true;
  };
  hookWorld();
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', hookWorld);
  Planets.__hookWorld = hookWorld;

  // Dress the original planets.
  const v = Planets.planet('vantera');
  if (v) {
    v.palette.sat[0] = 0.45;
    v.biome = {
      flags: 1 | 4, propsets: ['rocks'], flora: { boulder: 1.0, grass: 0.7, flower: 0.1 }, density: [0.25, 0.4], scale: [1.1, 1.5], settlements: 5, shoulder: 150, nearBoost: 1.0,
      colors: { grass: 'c8834e', rock: '7c3f2c', high: 'e7c49a', shore: 'd9b07a', trunk: '5a4030', canopyA: '8a7a3a', canopyB: 'a08a44', rockF: '8f5c44', flowerHue: 0.1 },
      ramp: { highStart: 22, slope: 0.42, shoreBand: 2 },
    };
  }
  const k = Planets.planet('kestrel');
  if (k) k.propDensity = [0, 0];
  if (k) k.biome = {
    flags: 1 | 2, propsets: ['sky'], clouds: [0.7, 1.0], cloudHeight: -38, cloudSpread: 50, cloudScale: 1.4,
    colors: { grass: '6f9a4a', rock: '6a6a72', high: 'e8ecf0', shore: 'a8a890', trunk: '5a4a3a', canopyA: '4f8a4a', canopyB: '7fb04a', rockF: '7a7a80', flowerHue: 0.5 },
    ramp: { highStart: 20, slope: 0.5, shoreBand: 2 },
  };
  const n = Planets.planet('nullsector');
  if (n) {
    n.propDensity = [0, 0];
    n.tagline = 'Debris lanes through a dead fleet';
    n.biome = { flags: 0, limb: 1, nebula: 0.9, propsets: ['space'],
      colors: { grass: '4a4658', rock: '2f2c3a', high: '7a7590', shore: '3a3646', trunk: '2e3138', canopyA: '2f5aa8', canopyB: '4d86d8', rockF: '6b625a', flowerHue: 0.08, emis: 'ff7a3a' } };
  }
  const g = Planets.planet('glasshold');
  if (g) g.biome = { flags: 0, nebula: 0.35, propsets: ['crystal'], colors: { trunk: '3a1f4a', canopyA: 'ff5fd0', canopyB: '8a3fff', rockF: '5a2a7a', flowerHue: 0.9 } };
  const sb = Planets.planet('sablewaste');
  if (sb) sb.biome = { flags: 1 | 4, propsets: ['rocks', 'canyon'], flora: { boulder: 0.6, grass: 0.5 }, density: [0.2, 0.35], scale: [1.2, 1.8], shoulder: 40, nearBoost: 1.0,
    colors: { grass: 'e2bd7a', rock: '9a6a44', high: 'f4e2b4', shore: 'e8cc90', trunk: '6a5038', canopyA: '8a8a44', canopyB: 'b0a055', rockF: 'c48a5a', flowerHue: 0.1 },
    ramp: { highStart: 30, slope: 0.5, shoreBand: 2 } };

})();
