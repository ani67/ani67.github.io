// Interplanetary Racers content: planets (designed parameter ranges), vehicle families, and races.
// A planet is a set of ranges; the seed rolls inside them. Physics constants describe the medium.
const Planets = (() => {
  // Flight constants: every planet is flown. gravity is the sink rate pull, lift comes from ground effect near terrain.
  // SPD is the global speed scale. Lanes, gates, weapons and the speed-relative thresholds in game.js all derive from it,
  // so raising it here moves the whole game together instead of leaving physics thresholds behind.
  const SPD = 1.75;
  const MAX_RACERS = 8;
  const GROUND = { accel: 62, maxSpeed: 124, grip: 8.2, driftGrip: 1.7, drag: 0.15, gravity: 7, hover: 0, bob: 0.06, boost: 1.0, bank: 0.55, offroad: 0.6, pitchRate: 1.35, jump: 32, laneAlt: 11 };
  const LANE = { radius: 38, gate: 300 };
  const PLANETS = [
    {
      id: 'vantera', name: 'Vantera', tagline: 'Canyon highways under a copper sun', mode: 'surface', medium: 'ground',
      family: ['flow', 'oval'], R: [220, 300],
      terrain: { amp: [16, 34], freq: [0.004, 0.007], warp: [0.6, 1.4], blocky: [0, 0.25], cell: [30, 60], ridged: [0.6, 0.95] },
      props: 1, propDensity: [0.5, 0.9], propScale: [0.9, 1.6],
      palette: { hue: [0.02, 0.13], sat: [0.25, 1], light: [0.35, 0.75] }, bright: true,
      look: { colormap: [0.08, 0.2], dither: [0, 0.12], edge: [0.2, 0.45], posterize: [0, 0] },
      fog: [0.0008, 0.0014], bands: [2, 4], bandPow: [3, 7], groundPattern: 0, stars: 0, sun: [0.6, 0.25, 0.75],
      corridor: { radius: 38, gate: 300 },
      physics: { ...GROUND },
    },
    {
      id: 'nereid', name: 'Nereid', tagline: 'Drowned cities, slow light', mode: 'surface', medium: 'water',
      family: ['flow', 'rose'], R: [200, 280],
      terrain: { amp: [20, 45], freq: [0.004, 0.008], warp: [0.8, 1.8], blocky: [0.5, 1.0], cell: [25, 55], ridged: [0, 0.25] },
      props: 0, propDensity: [0.7, 1.0], propScale: [1.2, 2.2],
      palette: { hue: [0.48, 0.66], sat: [0.2, 1], light: [0.25, 0.7] }, bright: false,
      look: { colormap: [0.08, 0.2], dither: [0.05, 0.2], edge: [0, 0.25], posterize: [0, 0] },
      fog: [0.004, 0.006], bands: [3, 6], bandPow: [2, 5], groundPattern: 0, stars: 0, sun: [0.2, 0.9, 0.3],
      corridor: { radius: 36, gate: 280 },
      physics: { ...GROUND, accel: 45, maxSpeed: 101, grip: 5.0, driftGrip: 1.2, drag: 0.34, gravity: 4, bob: 0.18, boost: 0.85, bank: 0.7, offroad: 0.8, laneAlt: 13 },
      water: true,
    },
    {
      id: 'kestrel', name: 'Kestrel Reach', tagline: 'Sky islands and thermal rings', mode: 'corridor', medium: 'air',
      family: ['mountain', 'flow'], R: [240, 320],
      terrain: { amp: [40, 70], freq: [0.003, 0.005], warp: [1.0, 2.0], blocky: [0.6, 1.0], cell: [40, 90], ridged: [0.3, 0.6] }, terrainDrop: 90,
      props: 3, propDensity: [0.3, 0.6], propScale: [3, 6],
      palette: { hue: [0.5, 0.64], sat: [0.25, 0.9], light: [0.35, 0.7] }, bright: true,
      look: { colormap: [0.08, 0.2], dither: [0, 0.1], edge: [0.1, 0.3], posterize: [0, 0] },
      fog: [0.0005, 0.0009], bands: [3, 6], bandPow: [2, 4], groundPattern: 0, stars: 0, sun: [0.4, 0.7, 0.4],
      corridor: { radius: 44, gate: 360 },
      physics: { ...GROUND, accel: 55, maxSpeed: 146, grip: 3.6, driftGrip: 1.5, drag: 0.12, gravity: 5, hover: 0, bob: 0.1, boost: 1.1, bank: 0.9, pitchRate: 1.45 },
    },
    {
      id: 'nullsector', name: 'Null Sector', tagline: 'Asteroid lanes in dead space', mode: 'corridor', medium: 'space',
      family: ['rose', 'flow'], R: [230, 320],
      terrain: { amp: [10, 20], freq: [0.004, 0.006], warp: [0.5, 1.0], blocky: [0, 0], cell: [30, 60], ridged: [0, 0] }, noTerrain: true,
      props: 1, propDensity: [0.6, 1.0], propScale: [2, 8],
      palette: { hue: [0.6, 0.85], sat: [0.15, 1], light: [0.15, 0.5] }, bright: false,
      look: { colormap: [0.08, 0.2], dither: [0.05, 0.25], edge: [0, 0.2], posterize: [0, 0] },
      fog: [0.0003, 0.0007], bands: [1, 2], bandPow: [6, 12], groundPattern: 0, stars: 1, sun: [-0.5, 0.3, 0.8],
      corridor: { radius: 48, gate: 420 },
      physics: { ...GROUND, accel: 71, maxSpeed: 179, grip: 2.1, driftGrip: 1.0, drag: 0.05, gravity: 0, hover: 0, bob: 0, boost: 1.3, bank: 1.1, pitchRate: 1.6 },
    },
    {
      id: 'sablewaste', name: 'Sablewaste', tagline: 'Dune fields and buried machines', mode: 'surface', medium: 'ground',
      family: ['oval', 'flow'], R: [240, 320],
      terrain: { amp: [26, 50], freq: [0.003, 0.005], warp: [1.2, 2.2], blocky: [0.2, 0.6], cell: [45, 90], ridged: [0.5, 0.9] },
      props: 1, propDensity: [0.25, 0.5], propScale: [1.5, 3],
      palette: { hue: [0.07, 0.16], sat: [0.2, 0.9], light: [0.4, 0.8] }, bright: true,
      look: { colormap: [0.08, 0.2], dither: [0.05, 0.2], edge: [0.1, 0.3], posterize: [0, 0] },
      fog: [0.0009, 0.0016], bands: [2, 3], bandPow: [4, 9], groundPattern: 0, stars: 0, sun: [0.7, 0.35, 0.6],
      corridor: { radius: 42, gate: 340 },
      physics: { ...GROUND, grip: 7.2, driftGrip: 1.9, offroad: 0.9, bob: 0.08, laneAlt: 12 },
    },
    {
      id: 'glasshold', name: 'Glasshold', tagline: 'Neon crystal circuit', mode: 'surface', medium: 'ground',
      family: ['rose', 'flow'], R: [210, 280],
      terrain: { amp: [14, 30], freq: [0.005, 0.009], warp: [0.4, 1.0], blocky: [0.6, 1.0], cell: [20, 40], ridged: [0.2, 0.5] },
      props: 2, propDensity: [0.7, 1.0], propScale: [0.9, 1.8],
      palette: { hue: [0.75, 1.0], sat: [0.35, 1], light: [0.2, 0.6] }, bright: false,
      look: { colormap: [0.08, 0.2], dither: [0.1, 0.3], edge: [0.2, 0.5], posterize: [0, 0] },
      fog: [0.002, 0.0032], bands: [4, 8], bandPow: [2, 5], groundPattern: 1, stars: 1, sun: [0.3, 0.5, 0.8],
      corridor: { radius: 36, gate: 270 },
      physics: { ...GROUND, accel: 66, maxSpeed: 132, grip: 9.2, driftGrip: 1.6, bob: 0.04, laneAlt: 10 },
    },
  ];

  // Vehicle families: parametric hover craft silhouettes. All values are multipliers around 1.
  const VEHICLES = {
    falcon: { name: 'Falcon', length: 1.0, width: 0.9, height: 0.55, nose: 1.2, wingSpan: 1.3, wingSweep: 0.55, wingPos: -0.2, wingThick: 0.08, fins: 2, finHeight: 0.6, canopy: 0.8, pods: 2, podSize: 0.42, glow: 1.0 },
    manta: { name: 'Manta', length: 0.85, width: 1.4, height: 0.4, nose: 0.7, wingSpan: 2.2, wingSweep: 0.9, wingPos: 0.1, wingThick: 0.12, fins: 0, finHeight: 0.4, canopy: 0.6, pods: 3, podSize: 0.32, glow: 1.2 },
    needle: { name: 'Needle', length: 1.35, width: 0.6, height: 0.45, nose: 2.0, wingSpan: 0.8, wingSweep: 0.3, wingPos: -0.5, wingThick: 0.06, fins: 1, finHeight: 0.9, canopy: 0.5, pods: 1, podSize: 0.55, glow: 1.4 },
    hulk: { name: 'Hulk', length: 1.1, width: 1.2, height: 0.9, nose: 0.5, wingSpan: 0.9, wingSweep: 0.1, wingPos: 0.0, wingThick: 0.2, fins: 2, finHeight: 0.4, canopy: 1.0, pods: 4, podSize: 0.38, glow: 0.8 },
    dune: { name: 'Dune Skiff', length: 1.0, width: 1.1, height: 0.5, nose: 0.9, wingSpan: 1.0, wingSweep: 0.2, wingPos: 0.3, wingThick: 0.15, fins: 3, finHeight: 0.5, canopy: 0.7, pods: 2, podSize: 0.5, glow: 0.9 },
    prism: { name: 'Prism', length: 0.9, width: 0.8, height: 0.7, nose: 1.4, wingSpan: 1.1, wingSweep: 0.7, wingPos: -0.3, wingThick: 0.05, fins: 2, finHeight: 0.8, canopy: 0.9, pods: 2, podSize: 0.36, glow: 1.5 },
  };

  // Part-grammar recipes (see src/craft.js). Local space: +Z forward, +Y up, +X starboard; rot = [yaw, pitch, roll].
  const PI = Math.PI;
  // Hand-authored archetypes per family. make(j) returns a concrete recipe; j(a, b) jitters inside authored ranges.
  // Parts sit on named sockets: nose, spine, flank, belly, tail, wingtip. u runs tail (-1) to nose (1); v is lateral (or height on the flank).
  const A = (name, make) => ({ name, make });
  const RECIPES = {
    falcon: { family: 'falcon', role: 'racer', asym: 0, archetypes: [
      A('Dart', j => ({
        hull: { type: 'capsule', len: j(4.4, 5.2), r: j(0.5, 0.6), squash: 0.75, noseTaper: j(0.3, 0.4), at: [0, 0.75, 0], twoTone: 'bottom', stripe: 'band', stripePos: j(-0.3, 0.1), stripeW: 0.2 },
        parts: [
          { type: 'dome', socket: 'spine', u: 0.35, r: 0.42, squash: 0.7 },
          { type: 'wing', socket: 'flank', u: -0.15, v: -0.1, span: j(1.3, 1.7), chord: 1.4, thick: 0.1, sweep: j(0.6, 0.9), taper: 0.45, mirror: true },
          { type: 'bell', socket: 'tail', w: 0.45, v: 0, r: 0.3, len: 0.9, mirror: true },
          { type: 'fin', socket: 'spine', u: -0.7, v: 0.35, h: 0.7, chord: 0.8, thick: 0.06, sweep: 0.45, tilt: [0, 0, 0.35], mirror: true, tone: 1 },
          { type: 'intake', socket: 'flank', u: 0.3, v: 0.1, w: 0.3, h: 0.28, len: 0.9, mirror: true },
          { type: 'skid', socket: 'belly', u: -0.05, v: 0.55, out: 0.08, len: 2.4, mirror: true },
        ], greebles: { antennae: 2, rivets: 1, vents: 2, hatches: 2 } })),
      A('Canard', j => ({
        hull: { type: 'capsule', len: j(5.2, 5.8), r: j(0.45, 0.55), squash: 0.8, noseTaper: 0.3, at: [0, 0.75, 0], twoTone: 'nose', stripe: 'spine', stripeW: 0.12 },
        parts: [
          { type: 'dome', socket: 'spine', u: 0.3, r: 0.38, squash: 0.65 },
          { type: 'wing', socket: 'flank', u: -0.4, v: -0.2, span: j(1.1, 1.4), chord: 1.6, thick: 0.1, sweep: j(0.9, 1.2), taper: 0.35, mirror: true },
          { type: 'wing', socket: 'flank', u: 0.55, v: 0.1, span: 0.6, chord: 0.6, thick: 0.06, sweep: 0.3, taper: 0.6, mirror: true, tone: 1 },
          { type: 'bell', socket: 'tail', w: 0, v: 0, r: j(0.42, 0.5), len: 1.1 },
          { type: 'fin', socket: 'spine', u: -0.75, v: 0.4, h: 0.6, chord: 0.9, thick: 0.06, sweep: 0.5, tilt: [0, 0, 0.5], mirror: true, tone: 1 },
          { type: 'skid', socket: 'belly', u: 0, v: 0.5, out: 0.08, len: 2.6, mirror: true },
        ], greebles: { antennae: 1, rivets: 1, vents: 2, hatches: 1 } })),
      A('Sabre', j => ({
        hull: { type: 'box', len: j(4.4, 4.9), w: j(1.3, 1.5), h: 0.6, bevel: 0.2, front: 0.6, rear: 0.9, at: [0, 0.72, 0], twoTone: 'bottom', stripe: 'diagonal' },
        parts: [
          { type: 'dome', socket: 'spine', u: 0.4, r: 0.4, squash: 0.6 },
          { type: 'wing', socket: 'flank', u: -0.35, v: 0, span: j(1.6, 2.0), chord: 2.0, thick: 0.12, sweep: j(1.2, 1.5), taper: 0.2, mirror: true },
          { type: 'bell', socket: 'tail', w: 0.4, v: 0, r: 0.32, len: 0.9, mirror: true },
          { type: 'fin', socket: 'spine', u: -0.8, v: 0, h: 0.9, chord: 1.0, thick: 0.06, sweep: 0.7, tone: 1 },
          { type: 'intake', socket: 'spine', u: -0.1, v: 0.5, out: 0.05, w: 0.3, h: 0.25, len: 0.9, mirror: true },
          { type: 'skid', socket: 'belly', u: 0, v: 0.5, out: 0.08, len: 2.4, mirror: true },
        ], greebles: { antennae: 2, rivets: 2, vents: 3, hatches: 2 } })),
      A('Rapier', j => ({
        hull: { type: 'capsule', len: j(5.0, 5.6), r: j(0.38, 0.46), squash: 0.7, noseTaper: 0.22, at: [0, 0.75, 0], twoTone: 'nose', stripe: 'diagonal' },
        parts: [
          { type: 'dome', socket: 'spine', u: 0.4, r: 0.34, squash: 0.6 },
          { type: 'wing', socket: 'flank', u: -0.25, v: -0.1, span: j(0.9, 1.2), chord: 1.1, thick: 0.07, sweep: 1.1, taper: 0.3, mirror: true },
          { type: 'bell', socket: 'tail', w: 0, v: 0, r: j(0.5, 0.58), len: 1.3 },
          { type: 'fin', socket: 'spine', u: -0.8, v: 0, h: 0.85, chord: 0.9, thick: 0.05, sweep: 0.6, tone: 1 },
          { type: 'skid', socket: 'belly', u: 0, v: 0.45, out: 0.07, len: 2.2, mirror: true },
        ], greebles: { antennae: 1, rivets: 0, vents: 1, hatches: 1 } })),
      A('Harrier', j => ({
        hull: { type: 'box', len: j(4.8, 5.3), w: j(1.5, 1.7), h: 0.68, bevel: 0.18, front: 0.7, rear: 0.95, at: [0, 0.74, 0], twoTone: 'bottom', stripe: 'chevron' },
        parts: [
          { type: 'dome', socket: 'spine', u: 0.35, r: 0.44, squash: 0.65 },
          { type: 'wing', socket: 'flank', u: -0.2, v: 0, span: j(1.8, 2.2), chord: 1.8, thick: 0.13, sweep: 0.7, taper: 0.5, mirror: true },
          { type: 'bell', socket: 'tail', w: 0.5, v: 0, r: 0.34, len: 1.0, mirror: true },
          { type: 'intake', socket: 'flank', u: 0.35, v: 0.15, w: 0.34, h: 0.3, len: 1.0, mirror: true },
          { type: 'plate', socket: 'flank', u: -0.1, v: 0.1, out: 0.02, w: 1.1, h: 0.34, t: 0.05, mirror: true, tone: 1 },
          { type: 'skid', socket: 'belly', u: 0, v: 0.5, out: 0.08, len: 2.5, mirror: true },
        ], greebles: { antennae: 2, rivets: 2, vents: 3, hatches: 2 } })),
    ] },
    manta: { family: 'manta', role: 'drifter', asym: 1, archetypes: [
      A('Tin Saucer', j => ({
        hull: { type: 'saucer', R: j(1.9, 2.3), h: 0.75, at: [0, 0.75, 0], twoTone: 'bottom' },
        parts: [
          { type: 'dome', socket: 'spine', u: 0.1, r: j(0.65, 0.8), squash: 0.75, seg: 16 },
          { type: 'ringLights', socket: 'spine', u: 0, out: -0.33, n: 8, R: 1.9 },
          { type: 'fin', socket: 'spine', u: -0.75, v: 0, h: 0.9, chord: 0.9, thick: 0.06, sweep: 0.6, tone: 1 },
          { type: 'fin', socket: 'spine', u: -0.6, v: 0.5, h: 0.75, chord: 0.8, thick: 0.06, sweep: 0.5, tilt: [0, 0, 0.55], mirror: true, tone: 1 },
          { type: 'bell', socket: 'tail', w: 0.3, v: -0.2, r: 0.28, len: 0.8, mirror: true },
          { type: 'sphere', socket: 'flank', u: 0.2, v: 0.4, r: 0.18, mirror: true },
          { type: 'intake', socket: 'nose', v: 0.3, w: 0.5, h: 0.2, len: 0.6 },
          { type: 'pad', socket: 'belly', u: 0.4, v: 0, r: 0.3 }, { type: 'pad', socket: 'belly', u: -0.4, v: 0.5, r: 0.3, mirror: true },
        ], greebles: { antennae: 1, rivets: 2, vents: 0, hatches: 3 } })),
      A('Disc Racer', j => ({
        hull: { type: 'saucer', R: j(2.2, 2.5), h: 0.5, at: [0, 0.7, 0], stripe: 'band', stripePos: 0.3, stripeW: 0.3 },
        parts: [
          { type: 'dome', socket: 'spine', u: 0.3, r: 0.55, squash: 0.7, seg: 14 },
          { type: 'bell', socket: 'tail', w: 0, v: 0, r: j(0.38, 0.45), len: 1.0 },
          { type: 'fin', socket: 'spine', u: -0.55, v: 0.35, h: 0.7, chord: 0.8, thick: 0.05, sweep: 0.5, tilt: [0, 0, 0.7], mirror: true, tone: 1 },
          { type: 'mast', socket: 'spine', u: -0.2, v: 0.75, h: 0.8, dish: 0.25 },
          { type: 'pad', socket: 'belly', u: 0.45, v: 0, r: 0.3 }, { type: 'pad', socket: 'belly', u: -0.35, v: 0.5, r: 0.3, mirror: true },
        ], greebles: { antennae: 2, rivets: 1, vents: 2, hatches: 2 } })),
      A('Lantern', j => ({
        hull: { type: 'saucer', R: j(1.7, 1.9), h: 1.0, at: [0, 0.8, 0], twoTone: 'top' },
        parts: [
          { type: 'dome', socket: 'spine', u: 0, r: j(0.75, 0.9), squash: 0.8, seg: 16 },
          { type: 'ringLights', socket: 'spine', u: 0, out: -0.45, n: 10, R: 1.7 },
          { type: 'bell', socket: 'tail', w: 0.25, v: -0.3, r: 0.24, len: 0.7, mirror: true },
          { type: 'fin', socket: 'spine', u: -0.7, v: 0, h: 0.6, chord: 0.7, thick: 0.05, sweep: 0.4, tone: 1 },
          { type: 'pad', socket: 'belly', u: 0.45, v: 0, r: 0.28 }, { type: 'pad', socket: 'belly', u: -0.35, v: 0.5, r: 0.28, mirror: true },
        ], greebles: { antennae: 3, rivets: 2, vents: 1, hatches: 2 } })),
      A('Wide Disc', j => ({
        hull: { type: 'saucer', R: j(2.6, 2.9), h: 0.42, at: [0, 0.7, 0], twoTone: 'bottom', stripe: 'band', stripePos: 0, stripeW: 0.4 },
        parts: [
          { type: 'dome', socket: 'spine', u: 0.15, r: 0.5, squash: 0.6, seg: 14 },
          { type: 'ringLights', socket: 'spine', u: 0, out: -0.3, n: 12, R: 2.5 },
          { type: 'bell', socket: 'tail', w: 0.35, v: -0.15, r: 0.26, len: 0.8, mirror: true },
          { type: 'fin', socket: 'spine', u: -0.65, v: 0.45, h: 0.55, chord: 0.7, thick: 0.05, sweep: 0.45, tilt: [0, 0, 0.8], mirror: true, tone: 1 },
          { type: 'pad', socket: 'belly', u: 0.45, v: 0, r: 0.3 }, { type: 'pad', socket: 'belly', u: -0.4, v: 0.5, r: 0.3, mirror: true },
        ], greebles: { antennae: 2, rivets: 3, vents: 1, hatches: 3 } })),
      A('Bellhop', j => ({
        hull: { type: 'saucer', R: j(1.8, 2.0), h: 1.15, at: [0, 0.82, 0], twoTone: 'top', stripe: 'checker' },
        parts: [
          { type: 'dome', socket: 'spine', u: 0, r: j(0.8, 0.95), squash: 0.85, seg: 16 },
          { type: 'bell', socket: 'tail', w: 0, v: 0, r: j(0.48, 0.56), len: 1.1 },
          { type: 'tank', socket: 'flank', u: -0.15, v: 0.3, out: 0.3, r: 0.4, mirror: true, tone: 1 },
          { type: 'fin', socket: 'spine', u: -0.7, v: 0, h: 0.75, chord: 0.8, thick: 0.06, sweep: 0.45, tone: 1 },
          { type: 'pad', socket: 'belly', u: 0.4, v: 0, r: 0.3 }, { type: 'pad', socket: 'belly', u: -0.4, v: 0.5, r: 0.3, mirror: true },
        ], greebles: { antennae: 3, rivets: 2, vents: 2, hatches: 2 } })),
    ] },
    needle: { family: 'needle', role: 'scout', asym: 1, archetypes: [
      A('Lance', j => ({
        hull: { type: 'capsule', len: j(6.4, 7.2), r: 0.42, squash: 0.9, noseTaper: 0.25, at: [0, 0.75, 0], twoTone: 'nose', stripe: 'diagonal' },
        parts: [
          { type: 'bell', socket: 'tail', w: 0, v: 0, r: j(0.45, 0.55), len: 1.2 },
          { type: 'mast', socket: 'spine', u: -0.45, v: 0.15, h: j(1.1, 1.4), dish: 0.35 },
          { type: 'wing', socket: 'flank', u: 0.55, v: 0, span: 0.6, chord: 0.6, thick: 0.06, sweep: 0.35, taper: 0.6, mirror: true },
          { type: 'sphere', socket: 'flank', u: -0.2, v: -0.3, out: 0.1, r: 0.42, tone: 1 },
          { type: 'intake', socket: 'flank', u: 0, v: 0.3, w: 0.25, h: 0.35, len: 1.0, mirror: true },
          { type: 'fin', socket: 'spine', u: -0.85, v: 0, h: 0.6, chord: 1.0, thick: 0.05, sweep: 0.7, tone: 1 },
          { type: 'dome', socket: 'spine', u: 0.4, r: 0.3, squash: 0.6 },
          { type: 'skid', socket: 'belly', u: -0.1, v: 0.5, out: 0.08, len: 3.0, mirror: true },
        ], greebles: { antennae: 5, rivets: 1, vents: 3, hatches: 2 } })),
      A('Javelin', j => ({
        hull: { type: 'capsule', len: j(5.8, 6.4), r: 0.45, squash: 0.85, noseTaper: 0.2, at: [0, 0.75, 0], stripe: 'band', stripePos: -0.5, stripeW: 0.25 },
        parts: [
          { type: 'bell', socket: 'tail', w: 0.5, v: 0, r: 0.3, len: 1.0, mirror: true },
          { type: 'wing', socket: 'flank', u: 0.5, v: 0, span: 0.7, chord: 0.7, thick: 0.06, sweep: 0.4, taper: 0.5, mirror: true, tone: 1 },
          { type: 'fin', socket: 'spine', u: -0.8, v: 0.35, h: 0.7, chord: 0.9, thick: 0.05, sweep: 0.6, tilt: [0, 0, 0.6], mirror: true, tone: 1 },
          { type: 'tank', socket: 'flank', u: -0.35, v: -0.2, out: 0.2, r: 0.3, mirror: true },
          { type: 'dome', socket: 'spine', u: 0.45, r: 0.3, squash: 0.6 },
          { type: 'mast', socket: 'flank', u: -0.05, v: 0.6, h: 0.9 },
          { type: 'skid', socket: 'belly', u: -0.1, v: 0.5, out: 0.08, len: 2.8, mirror: true },
        ], greebles: { antennae: 4, rivets: 1, vents: 2, hatches: 2 } })),
      A('Spindle', j => ({
        hull: { type: 'capsule', len: j(5.6, 6.2), r: 0.5, squash: 1.0, noseTaper: 0.3, at: [0, 0.8, 0], twoTone: 'rear' },
        parts: [
          { type: 'bell', socket: 'tail', w: 0, v: 0, r: 0.5, len: 1.1 },
          { type: 'fin', socket: 'spine', u: -0.8, v: 0, h: 0.7, chord: 0.9, thick: 0.05, sweep: 0.6, tone: 1 },
          { type: 'fin', socket: 'flank', u: -0.8, v: -0.1, h: 0.7, chord: 0.9, thick: 0.05, sweep: 0.6, mirror: true, tone: 1 },
          { type: 'intake', socket: 'flank', u: 0.15, v: 0.2, w: 0.28, h: 0.3, len: 0.9, mirror: true },
          { type: 'dome', socket: 'spine', u: 0.45, r: 0.32, squash: 0.6 },
          { type: 'plate', socket: 'flank', u: -0.3, v: 0.2, w: 0.7, h: 0.35, t: 0.05, mirror: true, tone: 1 },
          { type: 'skid', socket: 'belly', u: -0.05, v: 0.5, out: 0.08, len: 2.6, mirror: true },
        ], greebles: { antennae: 3, rivets: 2, vents: 4, hatches: 3 } })),
      A('Stiletto', j => ({
        hull: { type: 'capsule', len: j(7.0, 7.8), r: 0.34, squash: 0.95, noseTaper: 0.18, at: [0, 0.75, 0], stripe: 'spine', stripeW: 0.1 },
        parts: [
          { type: 'bell', socket: 'tail', w: 0, v: 0, r: j(0.48, 0.58), len: 1.4 },
          { type: 'fin', socket: 'spine', u: -0.85, v: 0.3, h: 0.55, chord: 0.8, thick: 0.04, sweep: 0.7, tilt: [0, 0, 0.7], mirror: true, tone: 1 },
          { type: 'wing', socket: 'flank', u: 0.35, v: 0, span: 0.45, chord: 0.5, thick: 0.05, sweep: 0.3, taper: 0.6, mirror: true },
          { type: 'dome', socket: 'spine', u: 0.5, r: 0.26, squash: 0.55 },
          { type: 'skid', socket: 'belly', u: -0.1, v: 0.45, out: 0.07, len: 3.2, mirror: true },
        ], greebles: { antennae: 6, rivets: 0, vents: 2, hatches: 1 } })),
      A('Pilum', j => ({
        hull: { type: 'capsule', len: j(6.0, 6.6), r: 0.55, squash: 0.8, noseTaper: 0.35, at: [0, 0.78, 0], twoTone: 'rear', stripe: 'chevron' },
        parts: [
          { type: 'bell', socket: 'tail', w: 0.55, v: 0, r: 0.34, len: 1.1, mirror: true },
          { type: 'wing', socket: 'flank', u: -0.3, v: -0.05, span: j(1.0, 1.3), chord: 1.2, thick: 0.08, sweep: 0.8, taper: 0.4, mirror: true },
          { type: 'mast', socket: 'spine', u: -0.4, v: 0.2, h: 1.2, dish: 0.3 },
          { type: 'plate', socket: 'flank', u: 0.1, v: 0.15, out: 0.02, w: 1.0, h: 0.4, t: 0.06, mirror: true, tone: 1 },
          { type: 'dome', socket: 'spine', u: 0.45, r: 0.32, squash: 0.6 },
          { type: 'skid', socket: 'belly', u: -0.05, v: 0.5, out: 0.08, len: 2.8, mirror: true },
        ], greebles: { antennae: 4, rivets: 2, vents: 3, hatches: 2 } })),
    ] },
    hulk: { family: 'hulk', role: 'hauler', asym: 2, archetypes: [
      A('Tanker', j => ({
        hull: { type: 'box', len: j(5.6, 6.4), w: 1.1, h: 0.55, bevel: 0.1, at: [0, 0.6, 0], stripe: 'band', stripePos: 0.8, stripeW: 0.35 },
        parts: [
          { type: 'tank', socket: 'spine', u: -0.55, v: 0, out: 0.6, r: j(0.8, 0.9), tone: 1 }, { type: 'tank', socket: 'spine', u: 0, v: 0, out: 0.6, r: j(0.8, 0.9), tone: 1 }, { type: 'tank', socket: 'spine', u: 0.55, v: 0, out: 0.6, r: j(0.8, 0.9), tone: 1 },
          { type: 'strut', socket: 'spine', u: -1, v: 1.2, out: 1.4, len: 5.6, r: 0.05, mirror: true }, { type: 'strut', socket: 'spine', u: -1, v: 1.2, out: 0.2, len: 5.6, r: 0.05, mirror: true },
          { type: 'strut', socket: 'spine', u: -0.8, v: 1.2, out: 0.2, tilt: [0, -Math.PI / 2, 0], len: 1.25, r: 0.04, mirror: true }, { type: 'strut', socket: 'spine', u: -0.28, v: 1.2, out: 0.2, tilt: [0, -Math.PI / 2, 0], len: 1.25, r: 0.04, mirror: true },
          { type: 'strut', socket: 'spine', u: 0.28, v: 1.2, out: 0.2, tilt: [0, -Math.PI / 2, 0], len: 1.25, r: 0.04, mirror: true }, { type: 'strut', socket: 'spine', u: 0.8, v: 1.2, out: 0.2, tilt: [0, -Math.PI / 2, 0], len: 1.25, r: 0.04, mirror: true },
          { type: 'box', socket: 'nose', v: 0.9, out: -0.7, len: 1.4, w: 1.3, h: 0.9, bevel: 0.15 },
          { type: 'plate', socket: 'nose', v: 1.1, out: 0.02, w: 1.0, h: 0.5, t: 0.04, part: 4 },
          { type: 'bell', socket: 'tail', w: 0.5, v: -1.0, r: 0.32, len: 1.0, mirror: true }, { type: 'bell', socket: 'tail', w: 0.5, v: 1.6, r: 0.32, len: 1.0, mirror: true },
          { type: 'mast', socket: 'spine', u: -0.7, v: 0.9, out: 1.45, h: 1.6, dish: 0.4 }, { type: 'mast', socket: 'spine', u: 0.3, v: -1.0, out: 1.45, h: 0.9 },
          { type: 'pad', socket: 'belly', u: 0.6, v: 0.5, r: 0.28, mirror: true }, { type: 'pad', socket: 'belly', u: -0.6, v: 0.5, r: 0.28, mirror: true },
        ], greebles: { antennae: 6, rivets: 1, vents: 5, hatches: 4 } })),
      A('Barge', j => ({
        hull: { type: 'box', len: j(5.4, 6.0), w: j(1.7, 2.0), h: 0.9, bevel: 0.15, front: 0.8, rear: 1, at: [0, 0.75, 0], twoTone: 'bottom', stripe: 'band', stripePos: -0.6, stripeW: 0.3 },
        parts: [
          { type: 'tank', socket: 'spine', u: -0.2, v: 0.5, out: 0.5, r: 0.65, mirror: true, tone: 1 },
          { type: 'box', socket: 'nose', v: 0.6, out: -0.6, len: 1.2, w: 1.5, h: 0.9, bevel: 0.15 },
          { type: 'plate', socket: 'nose', v: 0.85, out: 0.02, w: 1.1, h: 0.45, t: 0.04, part: 4 },
          { type: 'bell', socket: 'tail', w: 0.5, v: 0, r: 0.4, len: 1.1, mirror: true },
          { type: 'mast', socket: 'spine', u: 0.45, v: 0.75, h: 1.4, dish: 0.35 },
          { type: 'intake', socket: 'flank', u: 0.15, v: 0.3, w: 0.45, h: 0.35, len: 1.1, mirror: true },
          { type: 'pad', socket: 'belly', u: 0.55, v: 0.55, r: 0.32, mirror: true }, { type: 'pad', socket: 'belly', u: -0.55, v: 0.55, r: 0.32, mirror: true },
        ], greebles: { antennae: 4, rivets: 2, vents: 4, hatches: 5 } })),
      A('Crane', j => ({
        hull: { type: 'capsule', len: j(5.4, 6.0), r: 0.75, squash: 0.8, noseTaper: 0.7, at: [0, 0.85, 0], stripe: 'band', stripePos: 0.5, stripeW: 0.3 },
        parts: [
          { type: 'box', socket: 'spine', u: -0.35, v: 0, out: 0.35, len: 2.2, w: 1.4, h: 0.7, bevel: 0.1, tone: 1 },
          { type: 'mast', socket: 'spine', u: 0.1, v: 0.55, out: 0.8, h: 1.8, dish: 0.5 },
          { type: 'strut', socket: 'spine', u: 0.1, v: 0.55, out: 2.4, tilt: [0.3, 0, 0], len: 2.2, r: 0.05 },
          { type: 'dome', socket: 'spine', u: 0.55, r: 0.45, squash: 0.6 },
          { type: 'bell', socket: 'tail', w: 0.45, v: 0, r: 0.36, len: 1.0, mirror: true },
          { type: 'tank', socket: 'flank', u: -0.5, v: -0.2, out: 0.35, r: 0.5, tone: 1 },
          { type: 'pad', socket: 'belly', u: 0.5, v: 0.5, r: 0.3, mirror: true }, { type: 'pad', socket: 'belly', u: -0.5, v: 0.5, r: 0.3, mirror: true },
        ], greebles: { antennae: 5, rivets: 1, vents: 3, hatches: 4 } })),
      A('Freighter', j => ({
        hull: { type: 'box', len: j(6.2, 7.0), w: j(2.1, 2.4), h: 1.1, bevel: 0.12, front: 0.9, rear: 1, at: [0, 0.85, 0], twoTone: 'bottom', stripe: 'chevron' },
        parts: [
          { type: 'box', socket: 'spine', u: -0.3, v: 0, out: 0.45, len: 3.0, w: 1.8, h: 0.9, bevel: 0.1, tone: 1 },
          { type: 'box', socket: 'nose', v: 0.7, out: -0.6, len: 1.3, w: 1.6, h: 1.0, bevel: 0.15 },
          { type: 'plate', socket: 'nose', v: 0.95, out: 0.02, w: 1.2, h: 0.5, t: 0.04, part: 4 },
          { type: 'bell', socket: 'tail', w: 0.55, v: 0, r: 0.42, len: 1.2, mirror: true },
          { type: 'plate', socket: 'flank', u: 0, v: 0, out: 0.02, w: 3.0, h: 0.7, t: 0.1, mirror: true, part: 5 },
          { type: 'mast', socket: 'spine', u: 0.3, v: 0.8, h: 1.5, dish: 0.4 },
          { type: 'pad', socket: 'belly', u: 0.6, v: 0.55, r: 0.34, mirror: true }, { type: 'pad', socket: 'belly', u: -0.6, v: 0.55, r: 0.34, mirror: true },
        ], greebles: { antennae: 5, rivets: 3, vents: 5, hatches: 6 } })),
      A('Tug', j => ({
        hull: { type: 'capsule', len: j(4.6, 5.2), r: j(0.9, 1.05), squash: 0.9, noseTaper: 0.8, at: [0, 0.9, 0], stripe: 'band', stripePos: -0.2, stripeW: 0.45 },
        parts: [
          { type: 'bell', socket: 'tail', w: 0.5, v: 0, r: j(0.44, 0.52), len: 1.3, mirror: true },
          { type: 'tank', socket: 'flank', u: -0.1, v: 0.1, out: 0.5, r: 0.62, mirror: true, tone: 1 },
          { type: 'dome', socket: 'spine', u: 0.45, r: 0.5, squash: 0.7 },
          { type: 'plate', socket: 'flank', u: 0.2, v: 0.1, out: 0.02, w: 1.2, h: 0.6, t: 0.09, mirror: true, part: 5 },
          { type: 'mast', socket: 'spine', u: -0.5, v: 0.6, h: 1.3, dish: 0.45 },
          { type: 'pad', socket: 'belly', u: 0.5, v: 0.5, r: 0.32, mirror: true }, { type: 'pad', socket: 'belly', u: -0.5, v: 0.5, r: 0.32, mirror: true },
        ], greebles: { antennae: 4, rivets: 2, vents: 4, hatches: 4 } })),
    ] },
    dune: { family: 'dune', role: 'brute', asym: 1, archetypes: [
      A('Speeder', j => ({
        hull: { type: 'box', len: j(4.5, 5.0), w: j(1.8, 2.1), h: 0.75, bevel: 0.2, front: 0.9, rear: 1, at: [0, 0.7, 0], stripe: 'band', stripePos: 0.15, stripeW: 0.55 },
        parts: [
          { type: 'grille', socket: 'nose', v: 0, out: -0.05, w: 1.6, h: 0.55, n: 11 },
          { type: 'cockpitFrame', socket: 'spine', u: 0.1, v: 0, out: -0.03, w: 1.1, h: 0.45 },
          { type: 'box', socket: 'spine', u: -0.75, v: 0, out: 0.22, len: 1.2, w: 1.6, h: 0.5, bevel: 0.1, tone: 1 },
          { type: 'bell', socket: 'tail', w: 0.45, v: -0.3, r: 0.3, len: 0.9, mirror: true }, { type: 'bell', socket: 'tail', w: 0, v: 1.5, r: 0.28, len: 0.9 },
          { type: 'intake', socket: 'flank', u: 0.4, v: 0.3, w: 0.4, h: 0.3, len: 1.0 },
          { type: 'fin', socket: 'spine', u: -0.75, v: 0.45, out: 0.48, h: 0.45, chord: 0.6, thick: 0.05, sweep: 0.3, tilt: [0, 0, 0.4], mirror: true, tone: 1 },
          { type: 'skid', socket: 'belly', u: 0, v: 0.55, out: 0.1, len: 2.6, mirror: true },
        ], greebles: { antennae: 2, rivets: 2, vents: 3, hatches: 2 } })),
      A('Cargo Skiff', j => ({
        hull: { type: 'box', len: j(5.2, 5.8), w: 1.9, h: 0.7, bevel: 0.15, front: 0.85, rear: 1, at: [0, 0.7, 0], twoTone: 'rear', stripe: 'spine', stripeW: 0.15 },
        parts: [
          { type: 'grille', socket: 'nose', v: 0, out: -0.05, w: 1.5, h: 0.5, n: 9 },
          { type: 'cockpitFrame', socket: 'spine', u: 0.35, v: 0, out: -0.03, w: 1.0, h: 0.45 },
          { type: 'box', socket: 'spine', u: -0.45, v: 0, out: 0.3, len: 2.2, w: 1.5, h: 0.6, bevel: 0.1, tone: 1 },
          { type: 'bell', socket: 'tail', w: 0.4, v: 0, r: 0.34, len: 0.9, mirror: true },
          { type: 'mast', socket: 'spine', u: -0.9, v: 0.6, out: 0.05, h: 0.9 },
          { type: 'pad', socket: 'belly', u: 0.55, v: 0.55, r: 0.3, mirror: true }, { type: 'pad', socket: 'belly', u: -0.55, v: 0.55, r: 0.3, mirror: true },
        ], greebles: { antennae: 2, rivets: 2, vents: 4, hatches: 4 } })),
      A('Bruiser', j => ({
        hull: { type: 'box', len: j(4.6, 5.0), w: j(2.2, 2.5), h: 0.85, bevel: 0.25, front: 0.75, rear: 0.95, at: [0, 0.75, 0], twoTone: 'bottom', stripe: 'diagonal' },
        parts: [
          { type: 'grille', socket: 'nose', v: -0.1, out: -0.05, w: 1.9, h: 0.6, n: 13 },
          { type: 'cockpitFrame', socket: 'spine', u: 0.15, v: 0, out: -0.03, w: 1.2, h: 0.5 },
          { type: 'plate', socket: 'flank', u: 0, v: 0, out: 0.02, w: 2.4, h: 0.5, t: 0.08, mirror: true, part: 5 },
          { type: 'bell', socket: 'tail', w: 0.4, v: 0.1, r: j(0.38, 0.44), len: 1.0, mirror: true },
          { type: 'fin', socket: 'spine', u: -0.8, v: 0.5, h: 0.5, chord: 0.7, thick: 0.06, sweep: 0.3, tilt: [0, 0, 0.5], mirror: true, tone: 1 },
          { type: 'skid', socket: 'belly', u: 0, v: 0.55, out: 0.1, len: 2.8, mirror: true },
        ], greebles: { antennae: 3, rivets: 3, vents: 5, hatches: 3 } })),
      A('Rampart', j => ({
        hull: { type: 'box', len: j(4.8, 5.2), w: j(2.4, 2.7), h: 1.0, bevel: 0.22, front: 0.7, rear: 0.9, at: [0, 0.78, 0], twoTone: 'bottom', stripe: 'chevron' },
        parts: [
          { type: 'grille', socket: 'nose', v: -0.05, out: -0.05, w: 2.1, h: 0.7, n: 15 },
          { type: 'cockpitFrame', socket: 'spine', u: 0.1, v: 0, out: -0.03, w: 1.3, h: 0.5 },
          { type: 'plate', socket: 'flank', u: 0, v: 0, out: 0.03, w: 2.8, h: 0.7, t: 0.12, mirror: true, part: 5 },
          { type: 'plate', socket: 'nose', v: 0.5, out: 0.03, w: 1.6, h: 0.4, t: 0.1, part: 5 },
          { type: 'bell', socket: 'tail', w: 0.45, v: 0.1, r: 0.4, len: 1.0, mirror: true },
          { type: 'skid', socket: 'belly', u: 0, v: 0.55, out: 0.1, len: 3.0, mirror: true },
        ], greebles: { antennae: 2, rivets: 4, vents: 4, hatches: 3 } })),
      A('Sandcat', j => ({
        hull: { type: 'box', len: j(4.2, 4.6), w: j(1.6, 1.8), h: 0.6, bevel: 0.18, front: 0.95, rear: 1, at: [0, 0.68, 0], stripe: 'diagonal' },
        parts: [
          { type: 'grille', socket: 'nose', v: 0, out: -0.05, w: 1.3, h: 0.45, n: 8 },
          { type: 'cockpitFrame', socket: 'spine', u: 0.2, v: 0, out: -0.03, w: 0.95, h: 0.42 },
          { type: 'bell', socket: 'tail', w: 0.4, v: 0, r: 0.36, len: 1.0, mirror: true },
          { type: 'wing', socket: 'flank', u: -0.35, v: 0.1, span: 1.0, chord: 1.0, thick: 0.1, sweep: 0.4, taper: 0.5, mirror: true, tone: 1 },
          { type: 'intake', socket: 'flank', u: 0.35, v: 0.25, w: 0.35, h: 0.3, len: 0.9, mirror: true },
          { type: 'skid', socket: 'belly', u: 0, v: 0.5, out: 0.09, len: 2.4, mirror: true },
        ], greebles: { antennae: 3, rivets: 2, vents: 3, hatches: 2 } })),
    ] },
    prism: { family: 'prism', role: 'junker', asym: 4, archetypes: [
      A('Twin Hull', j => ({
        hull: { type: 'capsule', len: j(4.0, 4.6), r: 0.5, squash: 0.9, noseTaper: 0.5, at: [0, 0.75, 0], twoTone: 'rear', stripe: 'band', stripePos: -0.4, stripeW: 0.3 },
        parts: [
          { type: 'capsule', socket: 'flank', u: -0.1, v: 0.6, out: 0.55, len: j(2.8, 3.4), r: 0.36, squash: 1, noseTaper: 0.6, tone: 1 },
          { type: 'strut', socket: 'flank', u: 0.3, v: 0.6, out: -0.1, tilt: [Math.PI / 2, 0.2, 0], len: 0.8, r: 0.05 }, { type: 'strut', socket: 'flank', u: -0.5, v: 0.6, out: -0.1, tilt: [Math.PI / 2, 0.2, 0], len: 0.8, r: 0.05 },
          { type: 'dome', socket: 'spine', u: 0.45, v: -0.4, r: 0.4, squash: 0.7 },
          { type: 'fin', socket: 'spine', u: -0.75, v: 0.3, h: 0.8, chord: 0.8, thick: 0.05, sweep: 0.5, tilt: [0, 0, 0.5] },
          { type: 'fin', socket: 'flank', u: -0.7, v: 0.4, h: 0.55, chord: 0.6, thick: 0.05, sweep: 0.3, tone: 1 },
          { type: 'bell', socket: 'tail', w: 0, v: 0, r: 0.4, len: 1.0 }, { type: 'bell', socket: 'tail', w: 0.95, v: 1.3, r: 0.26, len: 0.8 },
          { type: 'intake', socket: 'flank', u: 0.2, v: 0.1, w: 0.3, h: 0.3, len: 0.9 },
          { type: 'skid', socket: 'belly', u: 0, v: 0.5, out: 0.08, len: 2.2, mirror: true },
        ], greebles: { antennae: 4, rivets: 1, vents: 4, hatches: 4 } })),
      A('Scrapper', j => ({
        hull: { type: 'box', len: j(4.2, 4.8), w: 1.4, h: 0.8, bevel: 0.1, front: 0.7, rear: 1, at: [0, 0.75, 0], stripe: 'band', stripePos: 0.5, stripeW: 0.2 },
        parts: [
          { type: 'tank', socket: 'flank', u: -0.2, v: 0.2, out: 0.45, r: 0.55, tone: 1 },
          { type: 'bell', socket: 'tail', w: -0.35, v: 0, r: 0.42, len: 1.0 }, { type: 'bell', socket: 'tail', w: 0.5, v: 0.3, r: 0.24, len: 0.8 },
          { type: 'mast', socket: 'spine', u: -0.5, v: -0.5, h: 1.3, dish: 0.3 },
          { type: 'dome', socket: 'spine', u: 0.45, v: 0.2, r: 0.38, squash: 0.65 },
          { type: 'plate', socket: 'flank', u: 0.3, v: 0.2, out: 0.02, w: 0.9, h: 0.5, t: 0.06, mirror: true, tone: 1 },
          { type: 'fin', socket: 'spine', u: -0.8, v: 0.4, h: 0.6, chord: 0.7, thick: 0.05, sweep: 0.4, tilt: [0, 0, 0.6] },
          { type: 'skid', socket: 'belly', u: 0, v: 0.5, out: 0.08, len: 2.4, mirror: true },
        ], greebles: { antennae: 5, rivets: 2, vents: 5, hatches: 4 } })),
      A('Kitbash', j => ({
        hull: { type: 'saucer', R: j(1.6, 1.9), h: 0.7, at: [0, 0.75, 0], twoTone: 'top' },
        parts: [
          { type: 'capsule', socket: 'spine', u: 0, v: -0.3, out: 0.3, len: j(3.0, 3.6), r: 0.35, squash: 1, noseTaper: 0.5, tone: 1 },
          { type: 'dome', socket: 'spine', u: 0.35, v: 0.45, r: 0.35, squash: 0.7 },
          { type: 'bell', socket: 'tail', w: -0.3, v: 0.5, r: 0.34, len: 0.9 }, { type: 'bell', socket: 'tail', w: 0.4, v: -0.2, r: 0.26, len: 0.8 },
          { type: 'fin', socket: 'spine', u: -0.7, v: 0.5, h: 0.7, chord: 0.7, thick: 0.05, sweep: 0.5, tilt: [0, 0, 0.4] },
          { type: 'mast', socket: 'flank', u: 0.1, v: 0.5, h: 0.9 },
          { type: 'pad', socket: 'belly', u: 0.4, v: 0, r: 0.28 }, { type: 'pad', socket: 'belly', u: -0.4, v: 0.5, r: 0.28, mirror: true },
        ], greebles: { antennae: 4, rivets: 1, vents: 3, hatches: 3 } })),
      A('Bodge', j => ({
        hull: { type: 'box', len: j(4.4, 5.0), w: 1.7, h: 0.9, bevel: 0.08, front: 0.8, rear: 1, at: [0, 0.78, 0], twoTone: 'top', stripe: 'checker' },
        parts: [
          { type: 'capsule', socket: 'spine', u: 0.1, v: -0.35, out: 0.35, len: j(2.6, 3.2), r: 0.4, squash: 1, noseTaper: 0.55, tone: 1 },
          { type: 'bell', socket: 'tail', w: -0.4, v: 0, r: 0.44, len: 1.0 }, { type: 'bell', socket: 'tail', w: 0.45, v: 0.4, r: 0.28, len: 0.85 },
          { type: 'tank', socket: 'flank', u: -0.3, v: 0.25, out: 0.4, r: 0.48, tone: 1 },
          { type: 'dome', socket: 'spine', u: 0.4, v: 0.3, r: 0.36, squash: 0.7 },
          { type: 'mast', socket: 'flank', u: -0.1, v: 0.55, h: 1.1, dish: 0.28 },
          { type: 'skid', socket: 'belly', u: 0, v: 0.5, out: 0.08, len: 2.4, mirror: true },
        ], greebles: { antennae: 5, rivets: 3, vents: 5, hatches: 5 } })),
      A('Splice', j => ({
        hull: { type: 'capsule', len: j(4.8, 5.4), r: 0.46, squash: 0.85, noseTaper: 0.4, at: [0, 0.76, 0], twoTone: 'nose', stripe: 'band', stripePos: 0.2, stripeW: 0.25 },
        parts: [
          { type: 'saucer', socket: 'spine', u: -0.25, v: 0.3, out: 0.3, R: j(1.3, 1.6), h: 0.4, tone: 1 },
          { type: 'bell', socket: 'tail', w: 0.5, v: -0.2, r: 0.32, len: 0.95, mirror: true },
          { type: 'fin', socket: 'spine', u: -0.75, v: 0.4, h: 0.85, chord: 0.8, thick: 0.05, sweep: 0.55, tilt: [0, 0, 0.45] },
          { type: 'wing', socket: 'flank', u: 0.1, v: -0.1, span: 1.2, chord: 1.0, thick: 0.07, sweep: 0.6, taper: 0.45, mirror: true },
          { type: 'dome', socket: 'spine', u: 0.45, v: -0.2, r: 0.34, squash: 0.65 },
          { type: 'skid', socket: 'belly', u: 0, v: 0.5, out: 0.08, len: 2.3, mirror: true },
        ], greebles: { antennae: 4, rivets: 2, vents: 4, hatches: 3 } })),
    ] },
  };
  for (const k of Object.keys(RECIPES)) VEHICLES[k].recipe = RECIPES[k];

  const RACES = [
    { id: 'vantari', name: 'Vantari', planet: 'vantera', vehicle: 'falcon', hue: 0.07, ability: { name: 'Overdrive', desc: 'Stronger boosts', boostMul: 1.3 } },
    { id: 'nereids', name: 'Nereids', planet: 'nereid', vehicle: 'manta', hue: 0.55, ability: { name: 'Slipstream', desc: 'Drift charges faster', driftCharge: 1.6 } },
    { id: 'kestrels', name: 'Kestrels', planet: 'kestrel', vehicle: 'needle', hue: 0.13, ability: { name: 'Thermal', desc: 'Boost pads and gates give more', padMul: 1.5 } },
    { id: 'voidborn', name: 'Voidborn', planet: 'nullsector', vehicle: 'hulk', hue: 0.72, ability: { name: 'Bulwark', desc: 'Half wipeout time', crashResist: 0.5 } },
    { id: 'sablekin', name: 'Sablekin', planet: 'sablewaste', vehicle: 'dune', hue: 0.1, ability: { name: 'Dustrunner', desc: 'Full speed off road', offroad: 1.0 } },
    { id: 'glassmind', name: 'Glassmind', planet: 'glasshold', vehicle: 'prism', hue: 0.85, ability: { name: 'Refract', desc: 'Sharper steering', steer: 1.25 } },
  ];

  const byId = (list, id) => list.find(x => x.id === id);
  return { PLANETS, VEHICLES, RACES, RECIPES, planet: id => byId(PLANETS, id), race: id => byId(RACES, id), GROUND, LANE, SPD, MAX_RACERS };
})();
