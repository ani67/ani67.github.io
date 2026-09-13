// Seed -> world descriptor (track curve, palette, theme) and curve evaluation.
const World = (() => {
  const { TAU, clamp, mix, mulberry32, hashStr, fbm, norm, cross, sub, add, scale, dot } = M;

  const WORDS_A = ['Amber', 'Neon', 'Velvet', 'Cobalt', 'Ivory', 'Crimson', 'Lunar', 'Solar', 'Glass', 'Onyx', 'Coral', 'Jade', 'Violet', 'Copper', 'Frost', 'Ember'];
  const WORDS_B = ['Trefoil', 'Ribbon', 'Helix', 'Meridian', 'Bloom', 'Circuit', 'Drift', 'Spire', 'Orbit', 'Vector', 'Lattice', 'Prism', 'Delta', 'Halo', 'Mirage', 'Vertex'];

  // Curve families: ranges for radial/height harmonics.
  const FAMILIES = [
    { name: 'oval', radAmp: [0.02, 0.10], radK: [2, 3], hAmp: [4, 10], hK: [1, 2], R: [200, 260] },
    { name: 'flow', radAmp: [0.08, 0.20], radK: [2, 5], hAmp: [8, 20], hK: [2, 4], R: [220, 300] },
    { name: 'rose', radAmp: [0.18, 0.32], radK: [3, 6], hAmp: [6, 18], hK: [3, 5], R: [240, 320] },
    { name: 'mountain', radAmp: [0.05, 0.15], radK: [2, 4], hAmp: [25, 55], hK: [1, 3], R: [240, 320] },
  ];
  // Prop vocabularies: 0 columns, 1 shards, 2 rings, 3 blades.
  const THEMES = [
    { name: 'neon', sky: [[0.02, 0.01, 0.06], [0.25, 0.05, 0.4]], sun: [0.3, 0.5, 0.8], fog: 0.0022, prop: 0, emis: [0.2, 1.0, 1.4], grid: 1, stars: 1 },
    { name: 'sunset', sky: [[0.9, 0.45, 0.2], [0.25, 0.1, 0.35]], sun: [0.6, 0.2, 0.75], fog: 0.0028, prop: 1, emis: [1.4, 0.6, 0.2], grid: 0, stars: 0 },
    { name: 'crystal', sky: [[0.02, 0.05, 0.08], [0.02, 0.2, 0.3]], sun: [-0.4, 0.7, 0.5], fog: 0.0032, prop: 2, emis: [0.3, 1.2, 1.2], grid: 0, stars: 1 },
    { name: 'meadow', sky: [[0.75, 0.85, 1.0], [0.2, 0.45, 0.9]], sun: [0.4, 0.8, 0.3], fog: 0.0018, prop: 3, emis: [1.3, 1.1, 0.3], grid: 0, stars: 0 },
  ];

  function nameFor(seed) {
    return WORDS_A[seed % 16] + ' ' + WORDS_B[(seed >>> 4) % 16];
  }

  // Palette statistics for planet filters (hue weighted by saturation, mean saturation, mean lightness).
  let PSTATS = null;
  function palStats() {
    if (PSTATS) return PSTATS;
    PSTATS = PALETTES.map(str => {
      let sat = 0, light = 0; const hues = [];
      for (const h of str.split(',')) {
        const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
        let hue = 0;
        if (d > 1e-4) { if (mx === r) hue = ((g - b) / d) % 6; else if (mx === g) hue = (b - r) / d + 2; else hue = (r - g) / d + 4; hue = (hue / 6 + 1) % 1; }
        const sv = mx > 0 ? d / mx : 0;
        hues.push({ hue, sat: sv }); sat += sv / 5; light += (mx + mn) / 2 / 5;
      }
      return { hues, sat, light };
    });
    return PSTATS;
  }
  function pickPalette(rnd, filt) {
    if (!filt) return Math.floor(rnd() * PALETTES.length);
    const st = palStats();
    const inHue = h => { const [a, b] = filt.hue; return a <= b ? (h >= a && h <= b) : (h >= a || h <= b); };
    const ok = [];
    for (let i = 0; i < st.length; i++) {
      const p = st[i];
      // Every saturated colour must sit in the hue range; greys are free.
      const colored = p.hues.filter(h => h.sat > 0.18);
      if (colored.length < 2 || !colored.every(h => inHue(h.hue))) continue;
      if (p.sat >= filt.sat[0] && p.sat <= filt.sat[1] && p.light >= filt.light[0] && p.light <= filt.light[1]) ok.push(i);
    }
    if (!ok.length) return Math.floor(rnd() * PALETTES.length);
    return ok[Math.floor(rnd() * ok.length)];
  }

  function generate(seedInput, P = null, overrides = null) {
    const seed = typeof seedInput === 'number' ? seedInput >>> 0 : hashStr(String(seedInput));
    const rnd = mulberry32(seed);
    const rr = (a, b) => mix(a, b, rnd());
    const ri = (a, b) => Math.floor(rr(a, b + 0.999));
    const rng = r => rr(r[0], r[1]);
    const famName = P ? P.family[ri(0, P.family.length - 1)] : null;
    const fam = P ? (FAMILIES.find(f => f.name === famName) || FAMILIES[1]) : FAMILIES[ri(0, 3)];
    const theme = THEMES[ri(0, 3)];

    // Radial harmonics: r(t) = R * (1 + sum a_i cos(k_i t + p_i)).
    const rad = [];
    const nRad = ri(1, 3);
    let ampBudget = rr(fam.radAmp[0], fam.radAmp[1]);
    for (let i = 0; i < nRad; i++) {
      const a = ampBudget * (i === 0 ? 1 : rr(0.25, 0.6));
      rad.push({ k: ri(fam.radK[0], fam.radK[1]) + (i > 0 ? i : 0), a, p: rr(0, TAU) });
    }
    const hgt = [];
    const nH = ri(1, 3);
    for (let i = 0; i < nH; i++) hgt.push({ k: ri(fam.hK[0], fam.hK[1]) + i, a: rr(fam.hAmp[0], fam.hAmp[1]) / (i + 1), p: rr(0, TAU) });

    // Cosine palette: col(t) = a + b * cos(TAU * (c t + d)).
    const pal = {
      a: [rr(0.35, 0.6), rr(0.35, 0.6), rr(0.35, 0.6)],
      b: [rr(0.3, 0.5), rr(0.3, 0.5), rr(0.3, 0.5)],
      c: [rr(0.5, 1.2), rr(0.5, 1.2), rr(0.5, 1.2)],
      d: [rnd(), rnd(), rnd()],
    };

    // Five-colour palette from the curated table (same set the cables.gl pieces use), sorted dark to light.
    const palIdx = pickPalette(rnd, P ? P.palette : null);
    const hex = PALETTES[palIdx].split(',');
    const rgb = hex.map(h => [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]);
    const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    rgb.sort((a, b) => lum(a) - lum(b));
    const sat = c => Math.max(...c) - Math.min(...c);
    let emisIdx = 1; for (let i = 1; i < 5; i++) if (sat(rgb[i]) > sat(rgb[emisIdx])) emisIdx = i;
    const em = rgb[emisIdx], emMax = Math.max(...em, 0.05);
    const emis = em.map(v => v / emMax * 1.5 + 0.1);
    const bright = P ? !!P.bright : rnd() < 0.45; // light world (fog to the lightest colour) vs dark world
    const skyH = bright ? rgb[4].map(v => v * 0.93) : rgb[1].map(v => v * 0.6), skyZ = bright ? rgb[3].map(v => v * 0.9) : rgb[0].map(v => v * 0.5);
    const look = P ? { colormap: rng(P.look.colormap), dither: rng(P.look.dither), edge: rng(P.look.edge), posterize: Math.round(rng(P.look.posterize)) } : {
      colormap: rr(0.08, 0.25), dither: rnd() < 0.6 ? rr(0.08, 0.3) : 0, edge: rr(0.25, 0.6),
      posterize: rnd() < 0.3 ? ri(4, 8) : 0,
    };
    const desc = {
      seed, name: nameFor(seed), family: fam.name, theme: theme.name, palIdx, pal5: rgb, bright, look,
      blocky: P ? rng(P.terrain.blocky) : (rnd() < 0.55 ? rr(0.3, 1.0) : 0), blockCell: P ? rng(P.terrain.cell) : rr(22, 70),
      ridged: P ? rng(P.terrain.ridged || [0, 0]) : (rnd() < 0.5 ? rr(0.3, 0.9) : 0),
      groundPattern: P ? P.groundPattern : (bright ? (rnd() < 0.4 ? 2 : 0) : (rnd() < 0.5 ? 1 : (rnd() < 0.5 ? 2 : 0))),
      bandFreq: P ? rng(P.bands) : rr(2, 7), bandPow: P ? rng(P.bandPow) : rr(2, 9), bandAmt: rr(0.2, 0.6),
      // Lane size floors: planets defined in other files (biomes.js) keep their character but never sit below the
      // global lane scale, so raising Planets.LANE widens every lane and spaces every gate at once.
      planetId: P ? P.id : null, mode: P ? P.mode : 'surface',
      corridor: (P && P.corridor)
        ? { ...P.corridor, radius: Math.max(P.corridor.radius, Planets.LANE.radius), gate: Math.max(P.corridor.gate, Planets.LANE.gate) }
        : { ...Planets.LANE },
      flight: true, laneStyle: P ? (P.mode === 'corridor' ? (P.noTerrain ? 'space' : 'sky') : 'terrain') : 'terrain',
      physics: { ...Planets.GROUND, ...(P ? P.physics : {}) }, water: !!(P && P.water), noTerrain: !!(P && P.noTerrain), terrainDrop: P ? P.terrainDrop || 0 : 0,
      R: P ? rng(P.R) : rr(fam.R[0], fam.R[1]), rad, hgt,
      width: rr(11, 15), widthVar: rr(0.1, 0.3), widthK: ri(2, 4), widthP: rr(0, TAU),
      bank: rr(0.25, 0.55),
      terrainAmp: P ? rng(P.terrain.amp) : rr(18, 45), terrainFreq: P ? rng(P.terrain.freq) : rr(0.004, 0.009), warp: P ? rng(P.terrain.warp) : rr(0.5, 2.0),
      propDensity: P ? rng(P.propDensity) : rr(0.5, 1.0), propScale: P ? rng(P.propScale) : rr(0.8, 1.6), propType: P ? P.props : theme.prop,
      twist: rr(-0.03, 0.03), quantize: rnd() < 0.3 ? rr(1.5, 4) : 0,
      pal, sky: [skyH, skyZ], sunDir: norm(P ? P.sun : theme.sun), fog: P ? rng(P.fog) : theme.fog * (bright ? 0.7 : 1), emis,
      grid: 0, stars: P ? P.stars : (bright ? 0 : 1),
      dayTime: rnd(),
    };
    // Biome dressing (flora, water, clouds, colour ramps) from the planet's biome block.
    const B = P && P.biome ? JSON.parse(JSON.stringify(P.biome)) : null;
    const minTrackY = -hgt.reduce((s, h) => s + h.a, 0);
    desc.biome = B;
    desc.waterRel = B && B.waterLevel ? rng(B.waterLevel) : undefined;
    desc.waterLevel = desc.waterRel !== undefined ? minTrackY + desc.waterRel : -1e4;
    desc.floraDensity = B && B.density ? rng(B.density) : 0;
    if (desc.floraDensity > 0 && desc.physics) desc.physics.laneAlt = Math.max(desc.physics.laneAlt || 9, 16); // lanes clear the canopy
    desc.floraScale = B && B.scale ? rng(B.scale) : 1;
    desc.cloudDensity = B && B.clouds ? rng(B.clouds) : 0;
    desc.cloudHeight = B && B.cloudHeight !== undefined ? B.cloudHeight : 90;
    desc.shoulder = B && B.shoulder ? B.shoulder : 170;
    desc.terrace = B && B.terrace ? rng(B.terrace) : 0;
    if (B && B.colors) {
      const hx = h => [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
      if (B.colors.skyH) desc.sky = [hx(B.colors.skyH), B.colors.skyZ ? hx(B.colors.skyZ) : hx(B.colors.skyH).map(v => v * 0.85)];
      if (B.colors.emis) desc.emis = hx(B.colors.emis).map(v => v * 1.6 + 0.1);
    }
    if (overrides) for (const k of Object.keys(overrides)) {
      if (desc[k] && typeof desc[k] === 'object' && !Array.isArray(desc[k]) && typeof overrides[k] === 'object' && !Array.isArray(overrides[k])) Object.assign(desc[k], overrides[k]);
      else desc[k] = overrides[k];
    }
    if (overrides && overrides.palIdx !== undefined) {
      const hex2 = PALETTES[overrides.palIdx % PALETTES.length].split(',');
      const rgb2 = hex2.map(h => [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]);
      rgb2.sort((a, b) => lum(a) - lum(b)); desc.pal5 = rgb2;
      desc.sky = desc.bright ? [rgb2[4], rgb2[3]] : [rgb2[1].map(v => v * 0.6), rgb2[0].map(v => v * 0.5)];
    }
    // Track construction: grammar, figure eight, spiral, oval or the Fourier loop (Tracks fills desc.poly for polyline kinds).
    desc.hillsH = (P && P.terrain && P.terrain.amp) ? (P.terrain.amp[0] + P.terrain.amp[1]) * 0.35 : 30;
    desc.track = (typeof Tracks !== 'undefined') ? Tracks.plan(desc, rnd, P, overrides) : { kind: 'fourier' };
    if (desc.poly) {
      let minY = 1e9; for (const q of desc.poly.pts) minY = Math.min(minY, q[1]);
      if (desc.poly.waterLevel !== undefined) desc.waterLevel = desc.poly.waterLevel;
      else if (desc.waterRel !== undefined) desc.waterLevel = minY + desc.waterRel;
    }
    return desc;
  }

  // Curve position at parameter t in [0,1).
  function pos(d, t) {
    if (d.poly) return Tracks.polyPos(d.poly, t);
    const th = t * TAU;
    let r = 1;
    for (const h of d.rad) r += h.a * Math.cos(h.k * th + h.p);
    r *= d.R;
    let y = 0;
    for (const h of d.hgt) y += h.a * Math.sin(h.k * th + h.p);
    return [r * Math.cos(th), y, r * Math.sin(th)];
  }
  function width(d, t) {
    if (d.poly) return Tracks.polyAttr(d.poly, d.poly.w, t);
    return d.width * (1 + d.widthVar * Math.sin(d.widthK * t * TAU + d.widthP));
  }

  // Build a dense sample table with frame vectors for physics and meshing.
  function buildSamples(d, N = 720) {
    const S = [];
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const p = pos(d, t);
      const p1 = pos(d, (i + 1) / N), p0 = pos(d, (i - 1 + N) / N);
      const tan = norm(sub(p1, p0));
      const flatTan = norm([tan[0], 0, tan[2]]);
      const right = norm(cross([0, 1, 0], flatTan)); // points to the right of travel
      // Signed curvature in XZ (positive = turning left).
      const t0 = norm(sub(p, p0)), t1 = norm(sub(p1, p));
      const curv = (t0[0] * t1[2] - t0[2] * t1[0]) / (M.len(sub(p1, p0)) * 0.5 + 1e-6);
      const tag = d.poly ? Tracks.polyAttr(d.poly, d.poly.tag, t, true) : 0;
      const ground = d.poly ? Tracks.polyAttr(d.poly, d.poly.ground, t, true) : -1e4;
      const bankO = d.poly ? Tracks.polyAttr(d.poly, d.poly.bank, t, true) : -1;
      S.push({ t, p, tan, right, curv, w: width(d, t), bank: 0, tag, ground, bankO });
    }
    // Smooth curvature, then derive banking (outer edge raised) and width narrowing.
    const k = S.map(s => s.curv);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < N; i++) k[i] = (k[(i - 1 + N) % N] + k[i] * 2 + k[(i + 1) % N]) * 0.25;
    }
    for (let i = 0; i < N; i++) {
      S[i].curv = k[i];
      S[i].bank = clamp(k[i] * 40, -1, 1) * d.bank; // radians-ish tilt around tangent
      if (S[i].bankO >= 0) S[i].bank = Math.sign(k[i] || 1) * S[i].bankO * d.bank * 1.6; // designed bowls
      if (!S[i].tag) S[i].w *= 1 - clamp(Math.abs(k[i]) * 25, 0, 0.3);
    }
    // Smooth designed bank changes so bowls ramp in.
    const bk = S.map(s => s.bank);
    for (let pass = 0; pass < 6; pass++) for (let i = 0; i < N; i++) bk[i] = (bk[(i - 1 + N) % N] + bk[i] * 2 + bk[(i + 1) % N]) * 0.25;
    for (let i = 0; i < N; i++) S[i].bank = bk[i];
    // Flight lanes: lift the lane above terrain and water with clearance, smooth it, then rebuild tangents.
    if (d.flight && !d.noTerrain) {
      const alt = (d.physics && d.physics.laneAlt) || 9, R = (d.corridor && d.corridor.radius) || 32, wl = d.waterLevel > -1e3 ? d.waterLevel : -1e4;
      const g = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const s = S[i]; let gm = -1e4;
        for (const k of [-0.7, -0.35, 0, 0.35, 0.7]) gm = Math.max(gm, terrainRaw(d, s.p[0] + s.right[0] * k * R, s.p[2] + s.right[2] * k * R));
        g[i] = Math.max(gm, wl);
      }
      const am = i => (d.poly && d.poly.alt) ? clamp(Tracks.polyAttr(d.poly, d.poly.alt, S[i].t, false), 0.35, 3) : 1;
      let y = new Float64Array(N);
      for (let i = 0; i < N; i++) y[i] = Math.max(S[i].p[1], g[i] + alt * am(i));
      const win = Math.max(2, Math.round(N / 70));
      for (let pass = 0; pass < 3; pass++) {
        const y2 = new Float64Array(N);
        for (let i = 0; i < N; i++) { let a = 0; for (let j = -win; j <= win; j++) a += y[(i + j + N) % N]; y2[i] = a / (2 * win + 1); }
        for (let i = 0; i < N; i++) y2[i] = Math.max(y2[i], g[i] + alt * 0.65 * am(i));
        y = y2;
      }
      for (let i = 0; i < N; i++) { S[i].p[1] = y[i]; S[i].ground = g[i]; }
      for (let i = 0; i < N; i++) S[i].tan = norm(sub(S[(i + 1) % N].p, S[(i - 1 + N) % N].p));
      for (let i = 0; i < N; i++) S[i].bank *= 0.5;
    }
    let maxR = 0, length = 0; for (let i = 0; i < N; i++) { maxR = Math.max(maxR, Math.hypot(S[i].p[0], S[i].p[2])); length += M.len(sub(S[(i + 1) % N].p, S[i].p)); }
    // Designed boost gates (after hairpins and bowls, before jump lips); fallback keeps the six evenly spaced pads the shader draws.
    const boostTs = d.poly && d.poly.boostTs && d.poly.boostTs.length ? d.poly.boostTs.slice() : [0, 1, 2, 3, 4, 5].map(k => (k + 0.5) / 6);
    const gateTs = d.poly && d.poly.gateTs ? d.poly.gateTs.slice() : null;
    return { S, N, maxR, length, boostTs, gateTs, pieces: d.poly && d.poly.pieces ? d.poly.pieces : {}, kind: d.track ? d.track.kind : 'fourier' };
  }

  // Interpolated sample at fractional t (wraps).
  function sampleAt(tab, t) {
    const { S, N } = tab;
    if (!isFinite(t)) t = 0;
    const f = ((t % 1) + 1) % 1 * N;
    const i = Math.floor(f), u = f - i;
    const a = S[i % N], b = S[(i + 1) % N];
    return {
      t: ((t % 1) + 1) % 1,
      p: M.lerp3(a.p, b.p, u), tan: norm(M.lerp3(a.tan, b.tan, u)), right: norm(M.lerp3(a.right, b.right, u)),
      w: mix(a.w, b.w, u), bank: mix(a.bank, b.bank, u), curv: mix(a.curv, b.curv, u), tag: u < 0.5 ? a.tag : b.tag,
    };
  }

  // Nearest t to a world XZ point, searching near a previous guess.
  function nearestT(tab, x, z, prevT, window = 40) {
    const { S, N } = tab;
    let best = -1, bd = Infinity;
    const c = Math.floor(((prevT % 1) + 1) % 1 * N);
    for (let j = -window; j <= window; j++) {
      const i = (c + j + N * 4) % N;
      const dx = S[i].p[0] - x, dz = S[i].p[2] - z;
      const dd = dx * dx + dz * dz;
      if (dd < bd) { bd = dd; best = i; }
    }
    // Refine by projecting onto the segment toward the next/prev sample.
    const a = S[best], b = S[(best + 1) % N], pr = S[(best - 1 + N) % N];
    const proj = (p0, p1) => {
      const ex = p1.p[0] - p0.p[0], ez = p1.p[2] - p0.p[2];
      const l2 = ex * ex + ez * ez || 1;
      return clamp(((x - p0.p[0]) * ex + (z - p0.p[2]) * ez) / l2, 0, 1);
    };
    const uf = proj(a, b), ub = proj(pr, a);
    if (uf > 0) return (best + uf) / N;
    return (best - 1 + ub) / N;
  }

  // Terrain height field (before track flattening) in world XZ.
  function terrainRaw(d, x, z) {
    if (d.terrainFn) return d.terrainFn(d, x, z, fbm) - (d.terrainDrop || 0);
    const f = d.terrainFreq;
    const wx = fbm(x * f * 0.5 + 3.1, z * f * 0.5) * d.warp * 60;
    const wz = fbm(x * f * 0.5 - 7.7, z * f * 0.5 + 2.2) * d.warp * 60;
    const n = fbm((x + wx) * f, (z + wz) * f, 5);
    const big = fbm(x * f * 0.15, z * f * 0.15, 2) * 2.5;
    let h = n * d.terrainAmp + big * d.terrainAmp;
    if (d.ridged > 0) {
      // Ridged multifractal: sharp crests from inverted absolute noise.
      let r = 0, a = 0.55, fr = f * 1.3, wsum = 0, weight = 1;
      for (let o = 0; o < 4; o++) {
        const v = 1 - Math.abs(M.vnoise((x + wx * 0.6) * fr + 31.7 * o, (z + wz * 0.6) * fr - 12.3 * o));
        const s = v * v * weight; weight = clamp(s * 2, 0, 1);
        r += s * a; wsum += a; a *= 0.5; fr *= 2.1;
      }
      r = r / wsum;
      h = mix(h, (r * 2 - 1) * d.terrainAmp * 1.4 + big * d.terrainAmp, d.ridged);
    }
    if (d.blocky > 0) {
      // Blocky plateaus: quantised cell noise, the "pixel noise" displacement look.
      const cx = Math.floor((x + wx * 0.5) / d.blockCell), cz = Math.floor((z + wz * 0.5) / d.blockCell);
      const bh = M.hash2(cx * 3 + 11, cz * 7 + 5);
      const bh2 = M.hash2(Math.floor(cx / 3), Math.floor(cz / 3));
      const plateau = Math.max(0, bh - 0.5) * 2 * (bh2 > 0.4 ? 1 : 0.3);
      h += plateau * d.terrainAmp * 1.8 * d.blocky;
    }
    if (d.terrace > 0) {
      // Layered terraces: pull heights toward steps, stronger higher up.
      const st = 9, q = Math.round(h / st) * st;
      h = mix(h, q + (h - q) * 0.15, d.terrace * M.smoothstep(-6, 14, h));
    }
    return h - (d.terrainDrop || 0);
  }

  return { generate, pos, width, buildSamples, sampleAt, nearestT, terrainRaw, nameFor, pickPalette, FAMILIES };
})();
