// Kitbash generator: hundreds of craft from hull kinds x styles x paint schemes, built on the Craft part kit.
// Kitbash.generate(seed, { style, hull, role, race }) -> concrete recipe (Craft.build accepts it). Same seed, same ship.
// Kitbash.random(rnd), Kitbash.forRace(raceId, seed), Kitbash.wreck(seed, scale), Kitbash.station(seed, scale).
const Kitbash = (() => {
  const TAU = Math.PI * 2, STRIDE = 12;
  const mulberry32 = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hashStr = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

  const HULLS = ['capsule', 'box', 'saucer', 'twin', 'ring', 'lifting', 'cluster', 'spine', 'wedge', 'stack', 'catamaran', 'blob'];
  // Style: hull preferences, role, asymmetry budget, part vocabulary with weights, greeble ranges, paint schemes.
  const STYLES = {
    sleek: { role: 'racer', asym: 0, hulls: ['capsule', 'wedge', 'lifting', 'twin', 'capsule'], count: [3, 5],
      parts: { wing: 1.2, fin: 1.0, intake: 0.7, nacelle: 0.5, plate: 0.2, antenna: 0.2, visor: 0.2, decal: 0.4, number: 0.3 },
      cockpit: ['dome', 'bubble', 'visor'], engines: ['bell2', 'bell1', 'nacelle2'], greebles: [[0, 2], [0, 1], [0, 3], [0, 2]],
      twoTone: ['bottom', 'nose', 'none', 'bottom'], stripe: ['band', 'spine', 'diagonal', 'none'] },
    industrial: { role: 'hauler', asym: 2, hulls: ['box', 'spine', 'stack', 'catamaran', 'ring', 'box'], count: [4, 8],
      parts: { cargoPod: 1.2, tank: 1.0, cageFrame: 0.7, turret: 0.5, radar: 0.6, armourPlate: 0.8, grille: 0.4, hatch: 0.6, vent: 0.6, mast: 0.5, number: 0.7, intake: 0.3, strutFin: 0.2, plate: 0.4 },
      cockpit: ['cockpitFrame', 'dome', 'visor'], engines: ['cluster2', 'bell2', 'cluster1', 'bell3'], greebles: [[2, 6], [1, 3], [2, 6], [2, 6]],
      twoTone: ['bottom', 'rear', 'top', 'none'], stripe: ['chevron', 'band', 'checker', 'none'] },
    toy: { role: 'drifter', asym: 1, hulls: ['saucer', 'cluster', 'blob', 'capsule', 'saucer'], count: [3, 6],
      parts: { fin: 1.0, ringLights: 0.8, rotor: 0.5, antenna: 0.7, radar: 0.5, bubble: 0.3, decal: 0.8, number: 0.5, sphere: 0.6, plate: 0.2, intake: 0.3 },
      cockpit: ['dome', 'dome', 'bubble'], engines: ['bell2', 'bell1', 'cluster1'], greebles: [[1, 3], [1, 3], [0, 2], [1, 4]],
      twoTone: ['bottom', 'top', 'bottom'], stripe: ['band', 'band', 'checker', 'spine'] },
    junker: { role: 'junker', asym: 4, hulls: ['twin', 'spine', 'box', 'stack', 'catamaran', 'cluster'], count: [5, 9],
      parts: { tank: 1.0, cageFrame: 0.6, mast: 0.8, nacelle: 0.6, armourPlate: 0.9, sail: 0.4, hatch: 0.6, vent: 0.7, number: 0.8, cargoPod: 0.5, turret: 0.4, sphere: 0.4, antenna: 0.5, plate: 0.6, radar: 0.4 },
      cockpit: ['cockpitFrame', 'dome', 'visor', 'bubble'], engines: ['mismatch', 'cluster2', 'bell2', 'cluster1'], greebles: [[3, 8], [1, 3], [3, 8], [3, 7]],
      twoTone: ['rear', 'nose', 'none', 'bottom'], stripe: ['chevron', 'none', 'band', 'checker'] },
    organic: { role: 'brute', asym: 3, hulls: ['blob', 'cluster', 'capsule', 'ring', 'blob'], count: [4, 8],
      parts: { tentacle: 1.4, sail: 0.6, sphere: 0.8, bubble: 0.4, rotor: 0.3, fin: 0.5, torus: 0.3, dome: 0.3, plate: 0.1 },
      cockpit: ['bubble', 'dome'], engines: ['bell3', 'bell2', 'cluster1'], greebles: [[0, 2], [0, 0], [0, 2], [0, 1]],
      twoTone: ['top', 'bottom', 'nose', 'none'], stripe: ['spine', 'none', 'none', 'diagonal'], blobOk: true },
  };
  const STYLE_NAMES = Object.keys(STYLES);
  const RACE_STYLE = { falcon: ['sleek', 'sleek', 'toy'], manta: ['toy', 'toy', 'organic'], needle: ['sleek', 'industrial'], hulk: ['industrial', 'industrial', 'junker'], dune: ['junker', 'industrial'], prism: ['junker', 'junker', 'organic'] };
  const ADJ = ['Rust', 'Iron', 'Glass', 'Ember', 'Void', 'Salt', 'Copper', 'Dusk', 'Hollow', 'Blue', 'Feral', 'Quiet', 'Loud', 'Brass', 'Pale', 'Grim', 'Sunny', 'Neon', 'Tidal', 'Ash'];
  const NOUN = ['Gull', 'Mule', 'Wasp', 'Kite', 'Barge', 'Otter', 'Comet', 'Anvil', 'Heron', 'Moth', 'Lantern', 'Falcon', 'Dredge', 'Piston', 'Halo', 'Prawn', 'Viper', 'Ox', 'Skipper', 'Drift'];

  // ---------------------------------------------------------------- hull kinds -> primary hull + structural parts
  function makeHull(kind, j, pick) {
    const S = p => ({ ...p, structural: true });
    switch (kind) {
      case 'box': return { hull: { type: 'box', len: j(3.8, 5.5), w: j(1.2, 2.0), h: j(0.55, 1.0), bevel: j(0.05, 0.3), front: j(0.5, 0.9), rear: j(0.8, 1), at: [0, 0.8, 0] }, parts: [] };
      case 'saucer': return { hull: { type: 'saucer', R: j(1.7, 2.4), h: j(0.6, 0.9), at: [0, 0.8, 0] }, parts: [] };
      case 'twin': { const len = j(3.6, 4.8), r = j(0.32, 0.46); return { hull: { type: 'capsule', len: len * 0.9, r: 0.34, squash: 1, noseTaper: 0.6, at: [0, 0.85, 0] }, parts: [
        S({ type: 'capsule', socket: 'flank', u: 0, v: -0.1, out: r * 1.6, len, r, squash: 0.85, noseTaper: j(0.4, 0.7), mirror: true }),
        S({ type: 'wing', socket: 'flank', u: 0.4, v: 0, span: r * 1.7, chord: 0.5, thick: 0.14, sweep: 0, taper: 1, mirror: true, tone: 1 }),
        S({ type: 'wing', socket: 'flank', u: -0.5, v: 0, span: r * 1.7, chord: 0.5, thick: 0.14, sweep: 0, taper: 1, mirror: true, tone: 1 })] }; }
      case 'ring': { const R = j(1.7, 2.3); return { hull: { type: 'box', len: j(2.2, 2.8), w: j(1.0, 1.3), h: j(0.7, 0.9), bevel: 0.2, front: 0.7, rear: 0.9, at: [0, 0.9, 0] }, parts: [
        S({ type: 'torus', socket: 'spine', u: 0, v: 0, out: -0.45, R, r: j(0.14, 0.22), seg: 24, tone: 1 }),
        S({ type: 'wing', socket: 'flank', u: 0, v: 0, span: R - 0.5, chord: 0.45, thick: 0.16, sweep: 0, taper: 1, mirror: true })] }; }
      case 'lifting': return { hull: { type: 'box', len: j(4, 5.2), w: j(2.0, 2.7), h: j(0.45, 0.7), bevel: 0.3, front: 0.35, rear: 0.9, at: [0, 0.75, 0] }, parts: [] };
      case 'cluster': { const r = j(0.8, 1.05); return { hull: { type: 'capsule', len: r * 2 + 0.02, r, squash: 1, noseTaper: 1, at: [0, 0.95, 0] }, parts: [
        S({ type: 'sphere', socket: 'flank', u: -0.2, v: 0, out: -r * 0.25, r: r * j(0.55, 0.75), mirror: true, tone: pick([0, 1]) }),
        S({ type: 'sphere', socket: 'tail', w: 0, v: 0.1, out: -r * 0.3, r: r * j(0.5, 0.7), tone: 1 })] }; }
      case 'spine': { const len = j(5, 6.5); return { hull: { type: 'capsule', len, r: j(0.26, 0.34), squash: 1, noseTaper: 0.8, at: [0, 0.9, 0] }, parts: [
        S({ type: 'cageFrame', socket: 'spine', u: -0.35, v: 0, out: -0.2, len: len * 0.28, w: j(0.8, 1.1), h: j(0.6, 0.8) }),
        S({ type: 'cageFrame', socket: 'spine', u: 0.2, v: 0, out: -0.2, len: len * 0.24, w: j(0.7, 1.0), h: j(0.55, 0.8) }),
        S({ type: 'box', socket: 'belly', u: -0.35, v: 0, out: 0.32, len: len * 0.22, w: 0.7, h: 0.55, bevel: 0.1, tone: 1 })] }; }
      case 'wedge': return { hull: { type: 'box', len: j(4, 5.2), w: j(1.6, 2.2), h: j(0.5, 0.8), bevel: 0.08, front: 0.2, rear: 1, at: [0, 0.75, 0] }, parts: [] };
      case 'stack': { const len = j(4.2, 5.2), r = j(0.42, 0.55); return { hull: { type: 'capsule', len, r, squash: 1, noseTaper: 0.9, at: [0, 0.85, 0] }, parts: [
        S({ type: 'capsule', socket: 'spine', u: -0.1, v: 0, out: -0.12, len: len * 0.72, r: r * 0.85, squash: 1, noseTaper: 0.9, tone: 1 }),
        S({ type: 'capsule', socket: 'belly', u: 0.05, v: 0, out: 0.1, len: len * 0.6, r: r * 0.7, squash: 1, noseTaper: 0.9 })] }; }
      case 'catamaran': { const len = j(3.6, 4.6); return { hull: { type: 'box', len, w: j(1.8, 2.4), h: 0.36, bevel: 0.08, front: 0.8, rear: 0.95, at: [0, 0.95, 0] }, parts: [
        S({ type: 'capsule', socket: 'belly', u: 0, v: 0.75, out: 0.28, len: len * 1.08, r: j(0.3, 0.4), squash: 0.9, noseTaper: 0.5, mirror: true, tone: 1 })] }; }
      case 'blob': return { hull: { type: 'capsule', len: j(2.6, 3.4), r: j(0.85, 1.15), squash: j(0.85, 1), noseTaper: j(0.6, 0.9), at: [0, 0.95, 0] }, parts: [] };
      default: return { hull: { type: 'capsule', len: j(3.8, 6), r: j(0.4, 0.68), squash: j(0.7, 0.9), noseTaper: j(0.3, 0.7), at: [0, 0.78, 0] }, parts: [] };
    }
  }

  // ---------------------------------------------------------------- part factory: type -> socketed part with sized spec
  function makePart(type, j, pick, hullLen) {
    const L = hullLen;
    switch (type) {
      case 'wing': return { type, socket: 'flank', u: j(-0.5, 0.1), v: j(-0.2, 0.1), span: j(1.0, 2.0), chord: j(1.0, 1.8), thick: 0.1, sweep: j(0.4, 1.3), taper: j(0.25, 0.6), mirror: true };
      case 'fin': return { type, socket: 'spine', u: j(-0.85, -0.5), v: pick([0, 0, 0.4]), h: j(0.5, 1.0), chord: j(0.7, 1.0), thick: 0.06, sweep: j(0.3, 0.7), tilt: [0, 0, pick([0, 0, 0.35, 0.55])], mirror: pick([true, false]), tone: 1 };
      case 'strutFin': return { type: 'fin', socket: 'flank', u: -0.7, v: 0.3, h: 0.5, chord: 0.7, thick: 0.06, sweep: 0.3, tilt: [0, 0, -0.9], mirror: true };
      case 'intake': return { type, socket: pick(['flank', 'spine']), u: j(0.0, 0.5), v: j(0.0, 0.4), out: 0.03, w: j(0.25, 0.45), h: j(0.2, 0.3), len: j(0.7, 1.0), mirror: true };
      case 'nacelle': return { type, socket: pick(['flank', 'flank', 'wingtip']), u: j(-0.3, 0.1), v: j(-0.3, 0.2), out: j(0.25, 0.45), len: j(1.2, Math.min(2.2, L * 0.45)), r: j(0.22, 0.36), mirror: true };
      case 'plate': return { type, socket: 'flank', u: j(-0.6, 0.6), v: j(-0.2, 0.4), w: j(0.4, 0.8), h: j(0.3, 0.5), mirror: pick([true, false]), tone: pick([0, 1]) };
      case 'armourPlate': return { type, socket: pick(['flank', 'flank', 'nose', 'spine']), u: j(-0.6, 0.6), v: j(-0.2, 0.4), w: j(0.5, 0.9), h: j(0.35, 0.6), t: 0.1, mirror: pick([true, true, false]), tone: pick([0, 1]) };
      case 'antenna': return { type, socket: 'spine', u: j(-0.8, 0.6), v: j(-0.5, 0.5), len: j(0.4, 1.0) };
      case 'visor': return { type, socket: 'spine', u: j(0.35, 0.6), v: 0, w: j(0.7, 1.0), h: j(0.3, 0.45) };
      case 'decal': return { type, socket: 'flank', u: j(-0.5, 0.5), v: j(0.1, 0.4), w: j(0.3, 0.6), h: j(0.3, 0.6), kind: pick([0, 1, 2, 3]), mirror: true };
      case 'number': return { type, socket: pick(['flank', 'flank', 'spine']), u: j(-0.6, 0.3), v: j(0.05, 0.35), n: Math.floor(j(1, 99)), size: j(0.28, 0.4), mirror: true };
      case 'cargoPod': return { type, socket: pick(['belly', 'flank', 'flank']), u: j(-0.5, 0.2), v: j(-0.1, 0.5), out: j(0.2, 0.4), len: j(1.0, Math.min(2.4, L * 0.45)), r: j(0.28, 0.42), mirror: true, tone: pick([0, 1]) };
      case 'tank': return { type, socket: pick(['flank', 'belly', 'spine']), u: j(-0.6, 0.2), v: j(-0.1, 0.5), out: j(0.15, 0.4), r: j(0.35, 0.6), mirror: pick([true, true, false]), tone: pick([0, 1]) };
      case 'cageFrame': return { type, socket: pick(['spine', 'belly']), u: j(-0.6, 0.3), v: 0, out: -0.15, len: j(0.9, 1.6), w: j(0.6, 1.0), h: j(0.5, 0.8) };
      case 'turret': return { type, socket: pick(['spine', 'spine', 'belly']), u: j(-0.5, 0.5), v: pick([0, 0, 0.5]), r: j(0.22, 0.34), barrels: pick([1, 2, 2]), len: j(0.5, 0.9), mirror: pick([false, false, true]) };
      case 'radar': return { type, socket: 'spine', u: j(-0.8, 0.2), v: j(-0.5, 0.5), h: j(0.3, 0.6), dish: j(0.3, 0.55), tone: pick([0, 1]) };
      case 'grille': return { type, socket: 'nose', v: j(-0.2, 0.3), w: j(0.7, 1.2), h: j(0.35, 0.55), n: Math.floor(j(6, 12)) };
      case 'hatch': return { type, socket: pick(['flank', 'spine']), u: j(-0.7, 0.6), v: j(-0.2, 0.4), w: j(0.3, 0.5), h: j(0.25, 0.4), mirror: pick([true, false]) };
      case 'vent': return { type, socket: 'flank', u: j(-0.8, 0.5), v: j(-0.2, 0.3), w: j(0.25, 0.45), n: Math.floor(j(2, 5)), mirror: true };
      case 'mast': return { type, socket: 'spine', u: j(-0.8, 0.4), v: j(-0.5, 0.5), h: j(0.8, 1.6), r: 0.05, dish: pick([0, 0, 0.25, 0.4]) };
      case 'sail': return { type, socket: pick(['spine', 'spine', 'flank']), u: j(-0.7, -0.2), v: j(-0.4, 0.4), h: j(1.0, 1.8), base: j(0.6, 1.1), top: j(0.15, 0.4), tone: 1, mirror: pick([false, true]) };
      case 'tentacle': return { type, socket: pick(['flank', 'belly', 'tail', 'flank']), u: j(-0.8, 0.4), v: j(-0.3, 0.6), w: j(-0.7, 0.7), len: j(1.0, 2.2), r: j(0.12, 0.22), curl: j(0.2, 0.9), tilt: [j(-0.5, 0.5), j(-0.3, 0.3), 0], mirror: pick([true, false]), tone: pick([0, 1]) };
      case 'sphere': return { type, socket: pick(['flank', 'spine']), u: j(-0.6, 0.4), v: j(-0.2, 0.5), out: -0.05, r: j(0.2, 0.45), mirror: pick([true, false]), tone: pick([0, 1]) };
      case 'torus': return { type, socket: 'spine', u: j(-0.4, 0.2), v: 0, out: j(-0.4, 0.2), R: j(0.6, 1.2), r: j(0.08, 0.14), seg: 18, tone: 1 };
      case 'rotor': return { type, socket: pick(['spine', 'spine', 'wingtip']), u: j(-0.7, 0.1), v: j(-0.5, 0.5), out: j(0.2, 0.6), R: j(0.6, 1.1), blades: pick([2, 3, 4]), mirror: pick([false, true]) };
      case 'ringLights': return { type, socket: 'spine', u: 0, out: -0.33, n: pick([6, 8, 10, 12]), R: 1.9 };
      case 'dome': return { type, socket: 'spine', u: j(-0.3, 0.3), v: j(-0.5, 0.5), r: j(0.2, 0.4), squash: 0.7, part: 0, tone: 1 };
      case 'bubble': return { type, socket: 'spine', u: j(-0.4, 0.2), v: j(-0.5, 0.5), r: j(0.25, 0.4), len: j(0.6, 1.0), squash: 0.7 };
      case 'ramProw': return { type, socket: 'nose', v: j(-0.2, 0.2), out: -0.1, len: j(0.8, 1.5), w: j(0.6, 1.0), h: j(0.35, 0.6) };
      default: return null;
    }
  }
  function makeCockpit(kind, j, hull) {
    const u = hull.type === 'saucer' ? j(-0.1, 0.2) : j(0.25, 0.5);
    if (kind === 'bubble') return { type: 'bubble', socket: 'spine', u, r: j(0.35, 0.5), len: j(0.9, 1.4), squash: 0.7 };
    if (kind === 'visor') return { type: 'visor', socket: 'spine', u: u + 0.1, w: j(0.7, 1.1), h: j(0.3, 0.45) };
    if (kind === 'cockpitFrame') return { type: 'cockpitFrame', socket: 'spine', u, out: 0.05, w: j(0.8, 1.1), h: j(0.4, 0.55) };
    return { type: 'dome', socket: 'spine', u, r: hull.type === 'saucer' ? j(0.6, 0.8) : j(0.36, 0.5), squash: j(0.6, 0.8), seg: hull.type === 'saucer' ? 16 : 12 };
  }
  function makeEngines(kind, j, pick) {
    switch (kind) {
      case 'bell1': return [{ type: 'bell', socket: 'tail', w: 0, v: j(-0.1, 0.1), r: j(0.42, 0.55), len: j(0.9, 1.2) }];
      case 'bell3': return [{ type: 'bell', socket: 'tail', w: 0, v: j(0.1, 0.3), r: j(0.3, 0.38), len: 0.9 }, { type: 'bell', socket: 'tail', w: j(0.45, 0.6), v: j(-0.2, 0), r: j(0.26, 0.33), len: 0.85, mirror: true }];
      case 'cluster1': return [{ type: 'thrusterCluster', socket: 'tail', w: 0, v: j(-0.1, 0.1), r: j(0.16, 0.22), n: pick([3, 4, 5, 6]), len: j(0.5, 0.8) }];
      case 'cluster2': return [{ type: 'thrusterCluster', socket: 'tail', w: j(0.4, 0.6), v: j(-0.1, 0.1), r: j(0.13, 0.18), n: pick([3, 4]), len: j(0.5, 0.7), mirror: true }];
      case 'nacelle2': return [{ type: 'nacelle', socket: 'flank', u: -0.25, v: -0.1, out: 0.3, len: j(1.4, 2.0), r: j(0.26, 0.34), mirror: true }, { type: 'bell', socket: 'tail', w: 0, v: 0, r: 0.3, len: 0.8 }];
      case 'mismatch': return [{ type: 'bell', socket: 'tail', w: j(0.3, 0.5), v: j(-0.1, 0.2), r: j(0.4, 0.5), len: 1.0 }, { type: 'thrusterCluster', socket: 'tail', w: -j(0.35, 0.6), v: j(-0.2, 0.1), r: 0.15, n: 3, len: 0.6 }];
      default: return [{ type: 'bell', socket: 'tail', w: j(0.35, 0.6), v: j(-0.1, 0.1), r: j(0.28, 0.36), len: j(0.8, 1.0), mirror: true }];
    }
  }

  // ---------------------------------------------------------------- generator
  function generate(seed = 1, opts = {}) {
    const seedNum = typeof seed === 'number' ? seed : hashStr(String(seed));
    const rnd = mulberry32((seedNum * 2654435761 + 12345) >>> 0);
    const j = (a, b) => a + (b - a) * rnd();
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const styleName = STYLES[opts.style] ? opts.style : pick(STYLE_NAMES);
    const st = STYLES[styleName];
    const hullKind = HULLS.includes(opts.hull) ? opts.hull : pick(st.hulls);
    const { hull, parts } = makeHull(hullKind, j, pick);
    const L = hull.type === 'saucer' ? hull.R * 2 : hull.len;
    hull.twoTone = pick(st.twoTone); hull.stripe = pick(st.stripe); hull.stripePos = j(-0.6, 0.6); hull.stripeW = j(0.12, 0.35);
    parts.push(makeCockpit(pick(st.cockpit), j, hull));
    for (const e of makeEngines(pick(st.engines), j, pick)) parts.push(e);
    // Vocabulary draw: weighted, without repeating a type more than twice, skipping parts that fight the hull kind.
    const vocab = Object.entries(st.parts);
    const n = Math.round(j(st.count[0], st.count[1]));
    const used = {};
    for (let k = 0; k < n * 3 && Object.values(used).reduce((a, b) => a + b, 0) < n; k++) {
      let total = vocab.reduce((a, [, w]) => a + w, 0), r = rnd() * total, type = vocab[0][0];
      for (const [t, w] of vocab) { r -= w; if (r <= 0) { type = t; break; } }
      if ((used[type] || 0) >= 2) continue;
      if (hull.type === 'saucer' && (type === 'wing' || type === 'grille' || type === 'nacelle')) continue;
      if (hull.type !== 'saucer' && type === 'ringLights') continue;
      const p = makePart(type, j, pick, L); if (!p) continue;
      used[type] = (used[type] || 0) + 1;
      parts.push(p);
    }
    if (hullKind === 'wedge' && rnd() < 0.5) parts.push(makePart('ramProw', j, pick, L));
    if (st.role === 'hauler' || styleName === 'junker') parts.push({ type: 'skid', socket: 'belly', u: 0, v: 0.55, out: 0.08, len: Math.min(2.8, L * 0.5), mirror: true });
    else parts.push({ type: 'pad', socket: 'belly', u: 0.35, v: 0.45, out: 0.02, r: 0.3, mirror: true }, { type: 'pad', socket: 'belly', u: -0.45, v: 0.45, out: 0.02, r: 0.3, mirror: true });
    const g = st.greebles.map(([a, b]) => Math.round(j(a, b)));
    const name = `${pick(ADJ)} ${pick(NOUN)} Mk ${1 + Math.floor(rnd() * 9)}`;
    return {
      family: 'kitbash', style: styleName, hullKind, role: opts.role || st.role, asym: st.asym, archetype: name, blobOk: !!st.blobOk || hullKind === 'blob' || hullKind === 'cluster' || hull.type === 'saucer',
      hull, parts, greebles: { antennae: g[0], rivets: g[1], vents: g[2], hatches: g[3] }, seed: seedNum,
    };
  }
  const random = rnd => generate(Math.floor(rnd() * 1e6) + 1);
  function forRace(raceId, seed = 1) {
    const race = (typeof Planets !== 'undefined' && Planets.race) ? Planets.race(raceId) : null;
    const styles = (race && RACE_STYLE[race.vehicle]) || STYLE_NAMES;
    const r = mulberry32((hashStr(String(raceId)) + seed * 7919) >>> 0);
    return generate(seed * 131 + hashStr(String(raceId)) % 977, { style: styles[Math.floor(r() * styles.length)] });
  }

  // ---------------------------------------------------------------- wrecks and stations (prop material: ex = [2, 0, 0, 0], uv.x = height)
  function toProp(mesh, scale, rot) {
    const v = mesh.verts, out = new Float32Array(v.length);
    let yMin = 1e9, yMax = -1e9;
    for (let i = 0; i < v.length; i += STRIDE) { yMin = Math.min(yMin, v[i + 1]); yMax = Math.max(yMax, v[i + 1]); }
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0), tilt = Math.cos((rot || 0) * 1.7) * 0.25, ct = Math.cos(tilt), stt = Math.sin(tilt);
    for (let i = 0; i < v.length; i += STRIDE) {
      let x = v[i] * scale, y = (v[i + 1] - yMin) * scale, z = v[i + 2] * scale;
      let nx = v[i + 3], ny = v[i + 4], nz = v[i + 5];
      // tilt around x, then yaw around y
      [y, z] = [ct * y - stt * z, stt * y + ct * z]; [ny, nz] = [ct * ny - stt * nz, stt * ny + ct * nz];
      [x, z] = [c * x + s * z, -s * x + c * z]; [nx, nz] = [c * nx + s * nz, -s * nx + c * nz];
      out[i] = x; out[i + 1] = y; out[i + 2] = z; out[i + 3] = nx; out[i + 4] = ny; out[i + 5] = nz;
      out[i + 6] = (v[i + 1] - yMin) / Math.max(1e-3, yMax - yMin); out[i + 7] = 0;
      out[i + 8] = 2; out[i + 9] = 0; out[i + 10] = 0; out[i + 11] = 0;
    }
    return { verts: out, idx: mesh.idx };
  }
  function wreck(seed = 1, scale = 1) {
    const rnd = mulberry32((seed * 40503 + 99) >>> 0);
    const recipe = generate(seed + 5000, { style: rnd() < 0.5 ? 'industrial' : 'junker' });
    recipe.lights = false;
    const m = Craft.build(recipe, seed);
    // Tear: drop triangles on the far side of a jagged plane, plus a few random chunks.
    const v = m.verts, n = [rnd() - 0.5, (rnd() - 0.5) * 0.4, rnd() - 0.5], nl = Math.hypot(...n); n[0] /= nl; n[1] /= nl; n[2] /= nl;
    let dMin = 1e9, dMax = -1e9;
    for (let i = 0; i < v.length; i += STRIDE) { const d = v[i] * n[0] + v[i + 1] * n[1] + v[i + 2] * n[2]; dMin = Math.min(dMin, d); dMax = Math.max(dMax, d); }
    const cut = dMin + (dMax - dMin) * (0.55 + rnd() * 0.25);
    const keep = [];
    for (let t = 0; t < m.idx.length; t += 3) {
      const a = m.idx[t] * STRIDE, b = m.idx[t + 1] * STRIDE, c = m.idx[t + 2] * STRIDE;
      const cx = (v[a] + v[b] + v[c]) / 3, cy = (v[a + 1] + v[b + 1] + v[c + 1]) / 3, cz = (v[a + 2] + v[b + 2] + v[c + 2]) / 3;
      const d = cx * n[0] + cy * n[1] + cz * n[2] + Math.sin(cx * 7.1 + cz * 5.3) * 0.25 + Math.sin(cy * 9.7) * 0.15;
      if (d > cut) continue;
      if (rnd() < 0.04) continue; // random missing plates
      keep.push(m.idx[t], m.idx[t + 1], m.idx[t + 2]);
    }
    return toProp({ verts: m.verts, idx: new Uint32Array(keep) }, scale, rnd() * TAU);
  }
  function station(seed = 1, scale = 1) {
    const rnd = mulberry32((seed * 7877 + 3) >>> 0);
    const j = (a, b) => a + (b - a) * rnd();
    const mb = new Craft.MB(), ex = [2, 0, 0, 0], dark = [2, 0, 0, 0];
    const add = (type, spec, socket) => Craft.addPart(mb, type, spec, socket);
    if (rnd() < 0.5) { // ring station: torus, hub, spokes, modules on the ring
      const R = j(3.5, 5), r = j(0.45, 0.7);
      add('torus', { R, r, seg: 32, sides: 10 }, { at: [0, 0, 0], rot: [0, -Math.PI / 2, 0] });
      add('sphere', { r: j(0.9, 1.3), seg: 14, rings: 8 }, { at: [0, 0, 0] });
      const spokes = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < spokes; k++) { const a = k / spokes * TAU; Craft.bar(mb, [0, 0, 0], [Math.cos(a) * R, 0, Math.sin(a) * R], 0.12, dark); }
      const mods = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < mods; k++) { const a = rnd() * TAU; add('box', { len: j(1.0, 1.8), w: j(0.8, 1.2), h: j(0.7, 1.0), bevel: 0.1 }, { at: [Math.cos(a) * R, j(-0.3, 0.6), Math.sin(a) * R], rot: [-a, 0, 0] }); }
      add('radar', { h: 0.8, dish: 0.9 }, { at: [0, 1.0, 0], rot: [0, -Math.PI / 2, 0] });
      for (const s of [-1, 1]) add('plate', { w: 3.2, h: 1.1, t: 0.05 }, { at: [0, s * 1.4, 0], rot: [0, s * Math.PI / 2, 0] });
    } else { // spine station: long capsule, module boxes, tanks, solar arrays, dishes
      const len = j(9, 14);
      add('capsule', { len, r: j(0.6, 0.85), squash: 1, noseTaper: 0.9 }, { at: [0, 0, 0] });
      const mods = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < mods; k++) { const z = -len * 0.4 + k / mods * len * 0.8; add('box', { len: j(1.2, 2.2), w: j(1.4, 2.2), h: j(1.0, 1.6), bevel: 0.15 }, { at: [0, 0, z] }); }
      for (const s of [-1, 1]) { add('plate', { w: j(4, 7), h: 1.6, t: 0.06 }, { at: [s * 4.5, 0, j(-2, 2)], rot: [0, 0, 0] }); Craft.bar(mb, [s * 0.8, 0, 0], [s * 4.5, 0, 0], 0.1, dark); }
      for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) add('tank', { r: j(0.5, 0.9) }, { at: [(rnd() - 0.5) * 2.5, j(-1.4, 1.4), j(-len * 0.35, len * 0.35)] });
      add('radar', { h: 0.6, dish: 1.0 }, { at: [0, 0.9, len * 0.3], rot: [0, -Math.PI / 2, 0] });
      add('thrusterCluster', { r: 0.35, n: 4, len: 1.2 }, { at: [0, 0, -len / 2 - 0.4], rot: [Math.PI, 0, 0] });
    }
    return toProp(mb.finish(), scale, rnd() * TAU);
  }

  return { generate, random, forRace, wreck, station, STYLES: STYLE_NAMES, HULLS, RACE_STYLE };
})();
