// Track constructions: segment grammar, figure eight, spiral climb, oval, plus the Fourier loop.
// Output is a dense closed polyline (d.poly) with per-point width, bank, feature tag and ground hint.
// Tags: 0 plain, 1 gap (jump chasm), 2 bridge deck, 3 pylons (raised deck), 4 tunnel, 5 banked bowl, 6 plaza, 7 narrow, 8 lip (jump ramp), 9 hairpin exit
const Tracks = (() => {
  const { TAU, clamp, mix, smoothstep, norm } = M;
  const TAG = { plain: 0, gap: 1, bridge: 2, pylons: 3, tunnel: 4, bowl: 5, plaza: 6, narrow: 7, lip: 8, exit: 9, weave: 10, skim: 11, pass: 12, corkscrew: 13, climb: 14, dive: 15, crossing: 16 };
  const M_PTS = 1400; // polyline resolution

  // Per-planet track personality. kinds are weights; pieces are grammar weights.
  const BASE = { kinds: { grammar: 0.4, fourier: 0.3, figure8: 0.1, spiral: 0.1, oval: 0.1 }, len: [1500, 2100], width: [11, 15], hills: [6, 18],
    pieces: { straight: 1, sweeper: 1.4, hairpin: 0.5, chicane: 0.7, esses: 0.6, bowl: 0.3, jump: 0.3, drop: 0.3, plaza: 0.3, narrow: 0.3, tunnel: 0.2 }, follow: 'none', bank: 0.5 };
  const PERSONALITY = {
    vantera: { kinds: { grammar: 0.6, fourier: 0.15, oval: 0.25 }, len: [1600, 2200], width: [11, 15], hills: [8, 22], pieces: { straight: 1.2, sweeper: 1.6, chicane: 0.8, hairpin: 0.3, jump: 0.5, drop: 0.4, plaza: 0.3, narrow: 0.2, tunnel: 0.35, bowl: 0.2, esses: 0.5 }, follow: 'valley' },
    nereid: { kinds: { fourier: 0.45, grammar: 0.35, figure8: 0.2 }, len: [1300, 1800], width: [10, 14], hills: [4, 12], pieces: { straight: 0.6, sweeper: 1.2, hairpin: 0.9, esses: 1.0, bowl: 0.7, chicane: 0.6, jump: 0.05, plaza: 0.4, narrow: 0.3, drop: 0.2, tunnel: 0.1 }, follow: 'none' },
    kestrel: { kinds: { fourier: 0.5, spiral: 0.5 }, len: [1600, 2200], hills: [30, 60] },
    nullsector: { kinds: { fourier: 0.4, figure8: 0.3, spiral: 0.3 }, hills: [20, 50] },
    sablewaste: { kinds: { grammar: 0.55, oval: 0.3, fourier: 0.15 }, len: [1800, 2400], width: [12, 16], hills: [10, 26], pieces: { straight: 1.6, sweeper: 1.2, jump: 0.8, plaza: 0.6, drop: 0.5, chicane: 0.4, hairpin: 0.2, esses: 0.4, bowl: 0.2, narrow: 0.1, tunnel: 0.1 }, follow: 'ridge' },
    glasshold: { kinds: { grammar: 0.6, figure8: 0.4 }, len: [1300, 1800], width: [9, 13], hills: [4, 12], pieces: { chicane: 1.4, hairpin: 1.0, esses: 1.0, narrow: 0.8, sweeper: 0.8, straight: 0.5, jump: 0.35, bowl: 0.4, plaza: 0.2, drop: 0.2, tunnel: 0.2 }, follow: 'none' },
    verdance: { kinds: { grammar: 0.5, fourier: 0.5 }, len: [1500, 2000], width: [10, 14], hills: [8, 20], pieces: { esses: 1.3, sweeper: 1.4, straight: 0.7, tunnel: 0.6, chicane: 0.5, hairpin: 0.4, jump: 0.25, drop: 0.3, plaza: 0.2, narrow: 0.4, bowl: 0.2 }, follow: 'valley' },
    halcyon: { kinds: { fourier: 0.4, grammar: 0.4, oval: 0.2 }, len: [1500, 2000], width: [10, 14], hills: [3, 9], pieces: { sweeper: 1.5, straight: 1.0, narrow: 0.9, chicane: 0.5, esses: 0.6, jump: 0.2, plaza: 0.4, hairpin: 0.3, bowl: 0.2, drop: 0.1, tunnel: 0.05 }, follow: 'causeway' },
    embervale: { kinds: { grammar: 0.5, spiral: 0.3, fourier: 0.2 }, len: [1400, 1900], width: [10, 14], hills: [12, 30], pieces: { hairpin: 1.2, drop: 1.0, tunnel: 0.8, sweeper: 1.0, esses: 0.7, straight: 0.6, chicane: 0.5, jump: 0.3, narrow: 0.4, bowl: 0.3, plaza: 0.2 }, follow: 'ridge' },
    cinder: { kinds: { grammar: 0.6, figure8: 0.2, fourier: 0.2 }, len: [1400, 2000], width: [10, 15], hills: [8, 22], pieces: { jump: 0.9, bowl: 0.8, drop: 0.7, sweeper: 1.0, straight: 0.8, chicane: 0.6, hairpin: 0.4, esses: 0.4, plaza: 0.3, narrow: 0.3, tunnel: 0.3 }, follow: 'none' },
  };
  function personality(id) { return { ...BASE, ...(PERSONALITY[id] || {}), pieces: { ...BASE.pieces, ...((PERSONALITY[id] || {}).pieces || {}) } }; }

  // Lanes are scaled up after planning so corners stay flyable at the raised craft speeds (see Planets.SPD).
  const LANE_SCALE = 1.55;
  // Flight lanes: every planet is flown, so the 3D lane grammar is the default construction. Weights per lane piece.
  const LANE_BASE = { straight: 1.0, sweeper: 1.4, hairpin: 0.35, chicane: 0.6, esses: 0.7, climb: 0.6, dive: 0.6, corkscrew: 0.35, weave: 0.5, skim: 0.5, pass: 0.4, crossing: 0.4, barrel: 0.4 };
  const LANE_STYLE = {
    space: { straight: 1.6, weave: 1.3, corkscrew: 1.1, sweeper: 1.3, climb: 0.5, dive: 0.5, crossing: 0.8, barrel: 0.8, skim: 0, pass: 0.3, hairpin: 0.2, esses: 0.6, chicane: 0.4 },
    canyon: { skim: 1.2, dive: 0.9, climb: 0.9, sweeper: 1.2, hairpin: 0.5, esses: 0.8, weave: 0.4, corkscrew: 0.25, pass: 0.5, crossing: 0.3, straight: 0.8, barrel: 0.3 },
    forest: { skim: 1.3, weave: 1.1, esses: 1.3, sweeper: 1.2, straight: 0.6, climb: 0.5, dive: 0.5, corkscrew: 0.3, pass: 0.4, crossing: 0.4, hairpin: 0.3, barrel: 0.3 },
    city: { weave: 1.5, crossing: 1.1, chicane: 1.0, straight: 1.0, sweeper: 0.9, climb: 0.6, dive: 0.6, corkscrew: 0.3, pass: 0.5, skim: 0.6, hairpin: 0.3, barrel: 0.4 },
    ice: { sweeper: 1.7, pass: 1.1, straight: 1.3, climb: 0.7, dive: 0.7, esses: 0.6, corkscrew: 0.3, weave: 0.3, skim: 0.5, crossing: 0.4, hairpin: 0.2, barrel: 0.5 },
    water: { skim: 1.4, sweeper: 1.4, esses: 0.9, straight: 0.9, weave: 0.6, climb: 0.5, dive: 0.5, pass: 0.4, corkscrew: 0.3, crossing: 0.3, hairpin: 0.3, barrel: 0.4 },
  };
  const LANE_STYLE_OF = { nullsector: 'space', vantera: 'canyon', redrock: 'canyon', sablewaste: 'canyon', verdance: 'forest', embervale: 'forest', lumen: 'forest', halcyon: 'water', nereid: 'water', meridian: 'city', glasshold: 'city', vitrine: 'ice', kestrel: 'ice', cinder: 'canyon' };
  function lanePersonality(id) {
    const style = LANE_STYLE_OF[id] || 'canyon';
    const base = personality(id);
    return { ...base, style, lane: { ...LANE_BASE, ...(LANE_STYLE[style] || {}) }, len: [Math.max(1800, base.len[0]), Math.max(2600, base.len[1])] };
  }

  // Designer presets: the old Fourier ones plus construction-based ones.
  const PRESETS = {
    sprint: { name: 'Sprint Oval', R: 260, width: 15, widthVar: 0.1, widthK: 2, bank: 0.4, rad: [{ k: 2, a: 0.08, p: 0 }, { k: 4, a: 0.02, p: 1 }], hgt: [{ k: 1, a: 8, p: 0 }, { k: 3, a: 3, p: 2 }] },
    mountain: { name: 'Mountain Loop', R: 300, width: 12, widthVar: 0.25, widthK: 3, bank: 0.6, rad: [{ k: 3, a: 0.15, p: 0.5 }, { k: 5, a: 0.06, p: 2 }], hgt: [{ k: 2, a: 50, p: 0 }, { k: 3, a: 20, p: 1 }] },
    clover: { name: 'Clover', R: 280, width: 11, widthVar: 0.2, widthK: 4, bank: 0.7, rad: [{ k: 3, a: 0.32, p: 0 }, { k: 6, a: 0.05, p: 0 }], hgt: [{ k: 3, a: 14, p: 0 }, { k: 6, a: 5, p: 1 }] },
    ribbon: { name: 'Ribbon', R: 320, width: 13, widthVar: 0.15, widthK: 2, bank: 0.5, rad: [{ k: 2, a: 0.22, p: 1.2 }, { k: 5, a: 0.1, p: 3 }], hgt: [{ k: 1, a: 30, p: 0 }, { k: 4, a: 12, p: 2 }] },
    canyon: { name: 'Canyon Run (grammar)', track: { kind: 'grammar', personality: 'vantera' } },
    technical: { name: 'Technical (grammar)', track: { kind: 'grammar', personality: 'glasshold' } },
    dunes: { name: 'Dune Jumps (grammar)', track: { kind: 'grammar', personality: 'sablewaste' } },
    lane: { name: 'Flight Lane (3D grammar)', track: { kind: 'lane' } },
    figure8: { name: 'Figure Eight', track: { kind: 'figure8' } },
    spiral: { name: 'Spiral Climb', track: { kind: 'spiral' } },
    oval: { name: 'Long Oval', track: { kind: 'oval' } },
  };

  // ---------------------------------------------------------------- helpers
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function weightedPick(rnd, table) {
    const keys = Object.keys(table); let tot = 0; for (const k of keys) tot += table[k];
    let r = rnd() * tot; for (const k of keys) { r -= table[k]; if (r <= 0) return k; } return keys[keys.length - 1];
  }
  // Planar self intersection test on a closed polyline; allowed = set of point indices where crossing is designed.
  function selfIntersects(P, allowed) {
    const n = P.length, cell = 30, grid = new Map();
    const key = (x, z) => (Math.floor(x / cell) * 73856093) ^ (Math.floor(z / cell) * 19349663);
    const seg = i => [P[i], P[(i + 1) % n]];
    for (let i = 0; i < n; i++) {
      const [a, b] = seg(i);
      const xs = [Math.floor(Math.min(a[0], b[0]) / cell), Math.floor(Math.max(a[0], b[0]) / cell)], zs = [Math.floor(Math.min(a[2], b[2]) / cell), Math.floor(Math.max(a[2], b[2]) / cell)];
      for (let gx = xs[0]; gx <= xs[1]; gx++) for (let gz = zs[0]; gz <= zs[1]; gz++) { const k = (gx * 73856093) ^ (gz * 19349663); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
    }
    const cross2 = (ax, az, bx, bz) => ax * bz - az * bx;
    for (const list of grid.values()) {
      for (let u = 0; u < list.length; u++) for (let v = u + 1; v < list.length; v++) {
        const i = list[u], j = list[v];
        const di = Math.min(Math.abs(i - j), n - Math.abs(i - j));
        if (di < 4) continue;
        if (allowed && allowed.has(i) && allowed.has(j)) continue;
        const [a, b] = seg(i), [c, d] = seg(j);
        const r = [b[0] - a[0], b[2] - a[2]], s = [d[0] - c[0], d[2] - c[2]];
        const den = cross2(r[0], r[1], s[0], s[1]); if (Math.abs(den) < 1e-9) continue;
        const qp = [c[0] - a[0], c[2] - a[2]];
        const t = cross2(qp[0], qp[1], s[0], s[1]) / den, w = cross2(qp[0], qp[1], r[0], r[1]) / den;
        if (t > 0 && t < 1 && w > 0 && w < 1) return true;
      }
    }
    return false;
  }
  // Resample a closed polyline (with per point attributes) to M equal arc length points.
  function resample(P, attrs, Mn) {
    const n = P.length, cum = [0];
    for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
    const total = cum[n], out = [], oa = attrs.map(() => []);
    let j = 0;
    for (let k = 0; k < Mn; k++) {
      const s = k / Mn * total;
      while (j < n - 1 && cum[j + 1] < s) j++;
      const u = clamp((s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), 0, 1);
      const a = P[j], b = P[(j + 1) % n];
      out.push([mix(a[0], b[0], u), mix(a[1], b[1], u), mix(a[2], b[2], u)]);
      attrs.forEach((A, q) => { const va = A[j], vb = A[(j + 1) % n]; oa[q].push(typeof va === 'number' && q > 0 ? (u < 0.5 ? va : vb) : mix(va, vb, u)); });
    }
    return { pts: out, attrs: oa, total };
  }
  function smoothXZ(P, passes, keep) {
    const n = P.length;
    for (let p = 0; p < passes; p++) {
      const Q = P.map((v, i) => keep && keep[i] ? v : [(P[(i - 1 + n) % n][0] + v[0] * 2 + P[(i + 1) % n][0]) / 4, v[1], (P[(i - 1 + n) % n][2] + v[2] * 2 + P[(i + 1) % n][2]) / 4]);
      for (let i = 0; i < n; i++) P[i] = Q[i];
    }
  }
  function smooth1(A, passes) {
    const n = A.length;
    for (let p = 0; p < passes; p++) { const B = A.slice(); for (let i = 0; i < n; i++) A[i] = (B[(i - 1 + n) % n] + B[i] * 2 + B[(i + 1) % n]) / 4; }
  }
  // Wide circular box blur (radius r points), repeated; approximates a Gaussian for road profiles.
  function boxSmooth(A, r, passes) {
    const n = A.length;
    for (let p = 0; p < passes; p++) {
      const B = A.slice(); let acc = 0; for (let k = -r; k <= r; k++) acc += B[(k + n) % n];
      for (let i = 0; i < n; i++) { A[i] = acc / (2 * r + 1); acc += B[(i + r + 1) % n] - B[(i - r + n) % n]; }
    }
  }
  function recenter(P) {
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
    for (const p of P) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mnz = Math.min(mnz, p[2]); mxz = Math.max(mxz, p[2]); }
    const cx = (mnx + mxx) / 2, cz = (mnz + mxz) / 2;
    for (const p of P) { p[0] -= cx; p[2] -= cz; }
  }

  // ---------------------------------------------------------------- grammar
  function planGrammar(d, rnd, pers) {
    const rr = (a, b) => a + (b - a) * rnd();
    const targetLen = rr(pers.len[0], pers.len[1]);
    // Guide loop: a Fourier loop scaled to the target circumference gives the overall shape; pieces add the rhythm.
    const guideR = targetLen / TAU / 1.06;
    const gh = [{ k: 2 + Math.floor(rnd() * 2), a: rr(0.06, 0.2), p: rnd() * TAU }, { k: 3 + Math.floor(rnd() * 3), a: rr(0.03, 0.1), p: rnd() * TAU }];
    const guide = th => { let r = 1; for (const h of gh) r += h.a * Math.cos(h.k * th + h.p); return [guideR * r * Math.cos(th), guideR * r * Math.sin(th)]; };
    for (let attempt = 0; attempt < 16; attempt++) {
      const P = [], wm = [], bk = [], tg = [], dy = [], exits = [];
      let h = 0, turned = 0, len = 0, lastKind = 'straight', lastJumpLen = -1e9, lastTurnLen = -1e9;
      const g0 = guide(0), g1 = guide(0.01);
      let x = g0[0], z = g0[1]; h = Math.atan2(g1[1] - g0[1], g1[0] - g0[0]);
      const startX = x, startZ = z, startH = h;
      const ds = 2;
      const push = (kappa, L, wmul, bank, tag, dyf) => {
        const steps = Math.max(1, Math.round(L / ds));
        for (let k = 0; k < steps; k++) {
          h += kappa * ds; x += Math.cos(h) * ds; z += Math.sin(h) * ds; turned += kappa * ds; len += ds;
          P.push([x, 0, z]); wm.push(wmul); bk.push(bank); tg.push(tag); dy.push(dyf ? dyf(k / steps) : 0);
        }
      };
      const sweep = (sign, R, ang, wmul = 1, bank = -1, tag = 0) => push(sign / R, R * ang, wmul, bank, tag);
      // Heading error against the guide: tangent of the guide at our arc position plus a pull toward the guide point.
      const headingError = () => {
        const th = len / targetLen * TAU;
        const g = guide(th), gn = guide(th + 0.01);
        const tanA = Math.atan2(gn[1] - g[1], gn[0] - g[0]);
        const ex = g[0] - x, ez = g[1] - z, dist = Math.hypot(ex, ez);
        const pull = clamp(dist / 60, 0, 1.2);
        const want = wrap(tanA + wrap(Math.atan2(ez, ex) - tanA) * Math.min(1, pull));
        return { err: wrap(want - h), dist };
      };
      push(0, 70, 1, -1, 0);
      let guard = 0;
      while (len < targetLen * 1.25 && guard++ < 200) {
        const { err, dist } = headingError();
        const prog = len / targetLen;
        // Try to close once we are most of the way round and near the start.
        const toStart = Math.hypot(startX - x, startZ - z);
        if (prog > 0.8 && toStart < 140 && Math.abs(wrap(Math.atan2(startZ - z, startX - x) - h)) < 0.9) break;
        const ae = Math.abs(err), sign = err >= 0 ? 1 : -1;
        let kind;
        if (ae > 1.3 && len - lastTurnLen > 40) kind = rnd() < pers.pieces.bowl / (pers.pieces.bowl + pers.pieces.hairpin + 0.01) ? 'bowl' : 'hairpin';
        else if (ae > 0.35) kind = 'sweeper';
        else {
          const rhythm = { straight: pers.pieces.straight, chicane: pers.pieces.chicane, esses: pers.pieces.esses, jump: pers.pieces.jump, drop: pers.pieces.drop, plaza: pers.pieces.plaza, narrow: pers.pieces.narrow, tunnel: pers.pieces.tunnel, sweeper: pers.pieces.sweeper * 0.5, switchback: pers.pieces.hairpin * 0.7 };
          kind = weightedPick(rnd, rhythm);
          if (kind === lastKind && kind !== 'straight' && rnd() < 0.7) kind = 'straight';
          if (kind === 'jump' && (len - lastJumpLen < 260 || dist > 90)) kind = 'straight';
        }
        if (kind === 'straight') push(0, rr(40, 120), 1, -1, 0);
        else if (kind === 'sweeper') { const R = rr(55, 150), ang = clamp(ae * rr(0.8, 1.15), 0.25, 1.9); sweep(sign, R, ang); lastTurnLen = len; }
        else if (kind === 'hairpin') { sweep(sign, rr(22, 34), clamp(ae * rr(0.9, 1.1), 2.2, 3.2), 0.85, -1, 0); push(0, 24, 1, -1, TAG.exit); exits.push(P.length - 6); lastTurnLen = len; }
        else if (kind === 'bowl') { sweep(sign, rr(42, 62), clamp(ae + rr(0.6, 1.4), 2.4, 4.4), 1.6, 0.95, TAG.bowl); exits.push(P.length - 4); lastTurnLen = len; }
        else if (kind === 'chicane') { const s2 = rnd() < 0.5 ? 1 : -1; sweep(s2, 38, 0.8, 0.9, -1, 0); sweep(-s2, 38, 0.8, 0.9, -1, 0); }
        else if (kind === 'switchback') { // paperclip: hairpin out, short straight, hairpin back; net heading unchanged
          const s2 = rnd() < 0.5 ? 1 : -1, R = rr(22, 30);
          sweep(s2, R, Math.PI, 0.85, -1, 0); push(0, 22, 1, -1, TAG.exit); exits.push(P.length - 6);
          push(0, rr(20, 60), 1, -1, 0);
          sweep(-s2, R, Math.PI, 0.85, -1, 0); push(0, 22, 1, -1, TAG.exit); exits.push(P.length - 6);
          lastTurnLen = len;
        }
        else if (kind === 'esses') { const n = 3 + (rnd() < 0.5 ? 1 : 0), s2 = rnd() < 0.5 ? 1 : -1; for (let i = 0; i < n; i++) sweep(i % 2 ? -s2 : s2, rr(45, 70), rr(0.5, 0.75)); }
        else if (kind === 'jump') {
          push(0, 30, 1, -1, 0);
          push(0, 26, 1, -1, TAG.lip, u => 6 * u * u);                       // ramp rises 6 m
          push(0, 16, 1, -1, TAG.gap, u => 6 - 24 * Math.sin(u * Math.PI));    // chasm dips
          push(0, 46, 1, -1, 0, u => 6 - 8.5 * smoothstep(0, 1, Math.min(1, u * 1.6)) + 2.5 * smoothstep(0.6, 1, u)); // landing lower, then recover
          lastJumpLen = len;
        }
        else if (kind === 'drop') push(0, rr(60, 100), 1, -1, 0, u => -12 * smoothstep(0, 1, u));
        else if (kind === 'plaza') push(0, rr(50, 90), 2.2, -1, TAG.plaza);
        else if (kind === 'narrow') { const R = rr(120, 260); sweep(sign, R, rr(0.3, 0.7), 0.55, -1, TAG.narrow); }
        else if (kind === 'tunnel') push(0, rr(60, 110), 0.9, -1, TAG.tunnel);
        lastKind = kind;
      }
      // Close the loop with a cubic Hermite from the end pose to the start pose.
      const dist = Math.hypot(startX - x, startZ - z);
      if (dist > 220 || dist < 4) continue;
      const L = Math.max(dist * 1.1, 60);
      const p0 = [x, z], m0 = [Math.cos(h) * L, Math.sin(h) * L], p1 = [startX, startZ], m1 = [Math.cos(startH) * L, Math.sin(startH) * L];
      const steps = Math.max(8, Math.round((dist * 1.3) / ds));
      let ok = true, prev = [x, z], prevDir = [Math.cos(h), Math.sin(h)];
      for (let k = 1; k <= steps; k++) {
        const u = k / steps, u2 = u * u, u3 = u2 * u;
        const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
        const px = h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0], pz = h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1];
        const segLen = Math.hypot(px - prev[0], pz - prev[1]);
        if (segLen > 0.3) {
          const dir = [(px - prev[0]) / segLen, (pz - prev[1]) / segLen];
          const turn = Math.abs(wrap(Math.atan2(dir[1], dir[0]) - Math.atan2(prevDir[1], prevDir[0])));
          if (turn / segLen > 1 / 20) ok = false; // too tight for the closing curve
          prevDir = dir;
        }
        prev = [px, pz];
        if (k < steps) { P.push([px, 0, pz]); wm.push(1); bk.push(-1); tg.push(0); dy.push(0); }
      }
      if (!ok) continue;
      if (selfIntersects(P, null)) continue;
      return { P, wm, bk, tg, dy, exits };
    }
    return null;
  }

  // ---------------------------------------------------------------- 3D lane grammar
  // Walks a lane in 3D: heading curvature and vertical excursions per piece, closed in XZ with a Hermite and in Y with a blend.
  // dy is an altitude offset above the terrain-following base; alt scales the lane's clearance (skims fly low, passes fly high).
  function planLane(d, rnd, pers) {
    const rr = (a, b) => a + (b - a) * rnd();
    const targetLen = rr(pers.len[0], pers.len[1]);
    const R = (d.corridor && d.corridor.radius) || 32;
    const guideR = targetLen / TAU / 1.06;
    const gh = [{ k: 2 + Math.floor(rnd() * 2), a: rr(0.05, 0.14), p: rnd() * TAU }, { k: 3 + Math.floor(rnd() * 3), a: rr(0.02, 0.07), p: rnd() * TAU }];
    const guide = th => { let r = 1; for (const h of gh) r += h.a * Math.cos(h.k * th + h.p); return [guideR * r * Math.cos(th), guideR * r * Math.sin(th)]; };
    const space = d.laneStyle === 'space';
    const rejects = { close: 0, far: 0, bend: 0 }, picks = {};
    for (let attempt = 0; attempt < 22; attempt++) {
      const P = [], wm = [], bk = [], tg = [], dy = [], al = [], gates = [], exits = [], kinds = [];
      let h = 0, len = 0, y = 0, lastKind = 'straight', lastTurnLen = -1e9, lastBig = -1e9;
      const g0 = guide(0), g1 = guide(0.01);
      let x = g0[0], z = g0[1]; h = Math.atan2(g1[1] - g0[1], g1[0] - g0[0]);
      const startX = x, startZ = z, startH = h;
      const ds = 2;
      let kc = 0; // gentle pull toward the guide, applied to straight-ish pieces
      const push = (kappa, L, wmul, bank, tag, dyf, altf) => {
        const steps = Math.max(1, Math.round(L / ds));
        for (let k = 0; k < steps; k++) {
          const u = k / steps;
          h += (kappa + (kappa === 0 ? kc : 0)) * ds; x += Math.cos(h) * ds; z += Math.sin(h) * ds; len += ds;
          P.push([x, 0, z]); wm.push(wmul); bk.push(bank); tg.push(tag); dy.push(dyf ? dyf(u) : 0); al.push(altf ? altf(u) : 1);
        }
      };
      const sweep = (sign, Rs, ang, wmul = 1, bank = -1, tag = 0, dyf, altf) => push(sign / Rs, Rs * ang, wmul, bank, tag, dyf, altf);
      let swept = 0, thPrev = Math.atan2(z, x);
      const headingError = () => {
        // Guide position from our angle around the loop centre, advanced a little, so long pieces never desync it.
        const thNow = Math.atan2(z, x); swept += wrap(thNow - thPrev); thPrev = thNow;
        const th = thNow + 0.12;
        const g = guide(th), gn = guide(th + 0.01);
        const tanA = Math.atan2(gn[1] - g[1], gn[0] - g[0]);
        const ex = g[0] - x, ez = g[1] - z, dist = Math.hypot(ex, ez);
        const pull = clamp(dist / 70, 0, 1.2);
        let want = wrap(tanA + wrap(Math.atan2(ez, ex) - tanA) * Math.min(1, pull));
        const progNow = Math.abs(swept) / TAU;
        if (progNow > 0.78) { const home = Math.atan2(startZ - z, startX - x); want = wrap(want + wrap(home - want) * clamp((progNow - 0.78) / 0.1, 0, 1)); }
        return { err: wrap(want - h), dist };
      };
      const gate = () => gates.push(P.length);
      push(0, 80, 1, -1, 0);
      let guard = 0;
      while (len < targetLen * 2.4 && guard++ < 340) {
        const { err, dist } = headingError();
        const prog = Math.abs(swept) / TAU;
        const toStart = Math.hypot(startX - x, startZ - z);
        if (prog > 0.82 && toStart > 90 && toStart < 260 && Math.abs(wrap(Math.atan2(startZ - z, startX - x) - h)) < 0.7 && Math.abs(wrap(startH - h)) < 1.2) break;
        const ae = Math.abs(err), sign = err >= 0 ? 1 : -1;
        kc = clamp(err / 180, -1 / 110, 1 / 110);
        let kind;
        if (ae > 2.0 && len - lastTurnLen > 60) kind = 'hairpin';
        else if (ae > 0.8) kind = 'sweeper';
        else {
          kind = weightedPick(rnd, pers.lane);
          if (kind === lastKind && kind !== 'straight' && rnd() < 0.7) kind = 'straight';
          if ((kind === 'corkscrew' || kind === 'crossing' || kind === 'pass') && (len - lastBig < 320 || prog > 0.6)) kind = 'straight';
          if (kind === 'skim' && space) kind = 'weave';
          if (dist > 150 && kind !== 'sweeper') kind = 'sweeper';
        }
        const H = rr(30, 54);
        if (kind === 'straight') push(0, rr(60, 160), 1, -1, 0);
        else if (kind === 'sweeper') { const Rs = rr(90, 220), ang = clamp(ae * rr(0.8, 1.15), 0.25, 1.9); sweep(sign, Rs, ang); lastTurnLen = len; }
        else if (kind === 'hairpin') { gate(); sweep(sign, rr(45, 70), clamp(ae * rr(0.9, 1.1), 2.2, 3.2), 0.9, -1, 0, u => 8 * Math.sin(u * Math.PI)); push(0, 40, 1, -1, TAG.exit); exits.push(P.length - 8); lastTurnLen = len; }
        else if (kind === 'chicane') { const s2 = rnd() < 0.5 ? 1 : -1; sweep(s2, 70, 0.7, 0.9); sweep(-s2, 70, 0.7, 0.9); }
        else if (kind === 'esses') { const n = 3 + (rnd() < 0.5 ? 1 : 0), s2 = rnd() < 0.5 ? 1 : -1; for (let i = 0; i < n; i++) sweep(i % 2 ? -s2 : s2, rr(80, 130), rr(0.45, 0.7), 1, -1, 0, u => 5 * Math.sin(u * Math.PI) * (i % 2 ? -1 : 1)); }
        else if (kind === 'climb') { gate(); push(0, rr(120, 200), 1, -1, TAG.climb, u => H * smoothstep(0, 1, u)); push(0, rr(60, 120), 1, -1, 0, () => H); push(0, rr(120, 200), 1, -1, 0, u => H * (1 - smoothstep(0, 1, u))); }
        else if (kind === 'dive') { gate(); push(0, rr(60, 100), 1, -1, 0, () => 0); push(0, rr(120, 200), 1, -1, TAG.dive, u => -H * 0.6 * smoothstep(0, 1, u), u => 1 - 0.5 * u); push(0, rr(80, 140), 1, -1, 0, u => -H * 0.6 * (1 - smoothstep(0, 1, u)), u => 0.5 + 0.5 * u); }
        else if (kind === 'corkscrew') { // helix, then hold height until clear of the helix footprint, then descend ahead
          gate(); const s2 = rnd() < 0.5 ? 1 : -1, turns = rnd() < 0.6 ? 1 : 2, Rs = Math.max(R * 2.5 + 12, rr(92, 118)); const rise = rr(52, 66) * turns;
          sweep(s2, Rs, TAU * turns, 0.9, -1, TAG.corkscrew, u => rise * u); push(0, Rs * 1.4, 1, -1, TAG.exit, () => rise); exits.push(P.length - 8);
          push(0, rr(160, 240), 1, -1, 0, u => rise * (1 - smoothstep(0, 1, u))); lastTurnLen = len; lastBig = len;
        }
        else if (kind === 'weave') { gate(); const n = 4 + Math.floor(rnd() * 3), s2 = rnd() < 0.5 ? 1 : -1; for (let i = 0; i < n; i++) sweep(i % 2 ? -s2 : s2, rr(60, 90), rr(0.35, 0.55), 0.7, -1, TAG.weave); push(0, 30, 1, -1, TAG.exit); exits.push(P.length - 6); }
        else if (kind === 'skim') { gate(); push(0, rr(160, 280), 0.8, -1, TAG.skim, () => 0, u => 0.45 + 0.55 * Math.pow(Math.abs(u * 2 - 1), 2)); }
        else if (kind === 'pass') { gate(); push(0, rr(180, 300), 1.1, -1, TAG.pass, u => 60 * Math.sin(u * Math.PI)); lastBig = len; }
        else if (kind === 'crossing') { // a full loop that climbs, so it crosses over its own entry 50 m higher, then descends ahead
          gate(); const s2 = rnd() < 0.5 ? 1 : -1, Rs = Math.max(R * 2.5 + 12, rr(85, 110));
          sweep(s2, Rs, TAU, 1, -1, TAG.crossing, u => 52 * smoothstep(0, 0.6, u)); push(0, Rs * 1.4, 1, -1, 0, () => 52); push(0, rr(160, 240), 1, -1, 0, u => 52 * (1 - smoothstep(0, 1, u)));
          lastTurnLen = len; lastBig = len;
        }
        else if (kind === 'barrel') { const n = 3, s2 = rnd() < 0.5 ? 1 : -1; for (let i = 0; i < n; i++) push(0, rr(50, 70), 1, -1, 0, u => (i % 2 ? -1 : 1) * s2 * 14 * Math.sin(u * Math.PI)); }
        lastKind = kind; kinds.push(kind); picks[kind] = (picks[kind] || 0) + 1;
      }
      // Close the loop with a cubic Hermite in XZ; dy blends back to zero over the closing segment.
      const dist = Math.hypot(startX - x, startZ - z);
      if (dist > 400 || dist < 4) { rejects.far++; continue; }
      const L = Math.max(dist * 1.1, 80);
      const p0 = [x, z], m0 = [Math.cos(h) * L, Math.sin(h) * L], p1 = [startX, startZ], m1 = [Math.cos(startH) * L, Math.sin(startH) * L];
      const steps = Math.max(8, Math.round((dist * 1.3) / ds));
      let ok = true, prev = [x, z], prevDir = [Math.cos(h), Math.sin(h)];
      const dyEnd = dy[dy.length - 1] || 0;
      for (let k = 1; k <= steps; k++) {
        const u = k / steps, u2 = u * u, u3 = u2 * u;
        const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
        const px = h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0], pz = h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1];
        const segLen = Math.hypot(px - prev[0], pz - prev[1]);
        if (segLen > 0.3) {
          const dir = [(px - prev[0]) / segLen, (pz - prev[1]) / segLen];
          const turn = Math.abs(wrap(Math.atan2(dir[1], dir[0]) - Math.atan2(prevDir[1], prevDir[0])));
          if (turn / segLen > 1 / 35) ok = false;
          prevDir = dir;
        }
        prev = [px, pz];
        if (k < steps) { P.push([px, 0, pz]); wm.push(1); bk.push(-1); tg.push(0); dy.push(dyEnd * (1 - u)); al.push(1); }
      }
      if (!ok) { rejects.bend++; continue; }
      if (laneTooClose(P, dy, R)) { rejects.close++; continue; }
      return { P, wm, bk, tg, dy, al, gates, exits, lane: true, kinds, attempts: attempt + 1, rejects, picks };
    }
    return null;
  }
  // Two far-apart passes of a lane must be either 2.5 radii apart horizontally or clearly stacked (40 m vertical).
  function laneTooClose(P, dy, R) {
    const n = P.length, cell = 60, grid = new Map();
    const key = (x, z) => (Math.floor(x / cell) * 73856093) ^ (Math.floor(z / cell) * 19349663);
    for (let i = 0; i < n; i += 2) { const k = key(P[i][0], P[i][2]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
    const minD = R * 2.5;
    for (let i = 0; i < n; i += 2) {
      const cx = Math.floor(P[i][0] / cell), cz = Math.floor(P[i][2] / cell);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const list = grid.get(((cx + ox) * 73856093) ^ ((cz + oz) * 19349663)); if (!list) continue;
        for (const j of list) {
          const di = Math.min(Math.abs(i - j), n - Math.abs(i - j));
          if (di < 120) continue;
          const dh = Math.hypot(P[i][0] - P[j][0], P[i][2] - P[j][2]);
          if (dh < minD && Math.abs((dy[i] || 0) - (dy[j] || 0)) < 30) return true;
        }
      }
    }
    return false;
  }
  // Heights for lanes: a smoothed terrain profile across the lane tube plus the piece offsets. Space lanes float on their offsets.
  function applyLaneHeights(d, plan) {
    const n = plan.P.length, R = (d.corridor && d.corridor.radius) || 32;
    const Y = new Array(n).fill(0), G = new Array(n).fill(-1e4);
    if (!d.noTerrain && typeof World !== 'undefined' && World.terrainRaw) {
      const Hs = [];
      for (let i = 0; i < n; i++) {
        const p = plan.P[i], q = plan.P[(i + 1) % n], pr = plan.P[(i - 1 + n) % n];
        const tx = q[0] - pr[0], tz = q[2] - pr[2], tl = Math.hypot(tx, tz) || 1, rx = -tz / tl, rz = tx / tl;
        let m = -1e4;
        for (const o of [-1, -0.5, 0, 0.5, 1]) m = Math.max(m, World.terrainRaw(d, p[0] + rx * o * R, p[2] + rz * o * R));
        if (d.waterLevel > -1e3) m = Math.max(m, d.waterLevel);
        Hs.push(m);
      }
      boxSmooth(Hs, 30, 3);
      const cum = [0]; for (let i = 0; i < n; i++) { const a = plan.P[i], b = plan.P[(i + 1) % n]; cum.push(cum[i] + Math.max(0.05, Math.hypot(b[0] - a[0], b[2] - a[2]))); }
      const lim = 0.3;
      for (let pass = 0; pass < 3; pass++) {
        for (let k = 1; k <= 2 * n; k++) { const i = k % n, pr = (k - 1) % n; const ds = cum[pr + 1] - cum[pr]; Hs[i] = clamp(Hs[i], Hs[pr] - lim * ds, Hs[pr] + lim * ds); }
        for (let k = 2 * n - 1; k >= 0; k--) { const i = k % n, nx = (k + 1) % n; const ds = cum[i + 1] - cum[i]; Hs[i] = clamp(Hs[i], Hs[nx] - lim * ds, Hs[nx] + lim * ds); }
      }
      for (let i = 0; i < n; i++) { Y[i] = Hs[i]; G[i] = Hs[i]; }
    }
    const D = plan.dy.slice(); smooth1(D, 3);
    const A = plan.al.slice(); boxSmooth(A, 12, 2);
    for (let i = 0; i < n; i++) plan.P[i][1] = Y[i] + D[i];
    plan.G = G; plan.alt = A;
  }

  // ---------------------------------------------------------------- analytic constructions
  function planFigure8(d, rnd) {
    const a = d.R * 1.05, ph = rnd() * TAU, P = [], wm = [], bk = [], tg = [], dy = [], bridge = new Set();
    const n = 1200;
    for (let i = 0; i < n; i++) {
      const t = i / n * TAU;
      const den = 1 + Math.sin(t) * Math.sin(t);
      const mod = 1 + 0.12 * Math.sin(2 * t + ph) + 0.05 * Math.sin(3 * t - ph);
      const x = a * mod * Math.cos(t) / den, z = a * mod * Math.sin(t) * Math.cos(t) / den;
      // The second pass through the centre (t near 3pi/2) is lifted into a bridge.
      const near2 = Math.exp(-Math.pow(wrap(t - 1.5 * Math.PI) / 0.42, 2) * 2.2);
      const y = 13 * near2;
      P.push([x, y, z]); wm.push(near2 > 0.35 ? 0.8 : 1); bk.push(-1); tg.push(near2 > 0.35 ? TAG.bridge : 0); dy.push(0);
      if (near2 > 0.05 || Math.abs(wrap(t - 0.5 * Math.PI)) < 0.45) bridge.add(i);
    }
    return { P, wm, bk, tg, dy, exits: [], allowed: bridge, hillsScale: 0.4 };
  }
  function planSpiral(d, rnd) {
    const P = [], wm = [], bk = [], tg = [], dy = [], bridge = new Set(), n = 1300, R = d.R * 1.1, H = Math.max(26, d.hillsH || 30);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const th = t * TAU * 2;
      const r = R * (1 - 0.5 * Math.sin(Math.PI * t));
      const climb = smoothstep(0.02, 0.62, t), fall = smoothstep(0.86, 1.0, t);
      const y = H * (climb - fall);
      P.push([r * Math.cos(th), y, r * Math.sin(th)]); wm.push(1); bk.push(-1); dy.push(0);
      const isCross = Math.abs(t - 0.75) < 0.05;
      tg.push(isCross ? TAG.bridge : (t > 0.86 ? 0 : 0));
      if (Math.abs(t - 0.25) < 0.06 || Math.abs(t - 0.75) < 0.06) bridge.add(i);
    }
    return { P, wm, bk, tg, dy, exits: [], allowed: bridge, hillsScale: 0.25 };
  }
  function planOval(d, rnd) {
    const P = [], wm = [], bk = [], tg = [], dy = [], n = 1200, a = d.R * 1.35, b = d.R * 0.62, ph = rnd() * TAU;
    for (let i = 0; i < n; i++) {
      const t = i / n * TAU;
      // Superellipse-ish oval with two long straights and banked ends.
      const cx = Math.cos(t), sz = Math.sin(t);
      const x = a * Math.sign(cx) * Math.pow(Math.abs(cx), 0.75), z = b * Math.sign(sz) * Math.pow(Math.abs(sz), 0.75) * (1 + 0.08 * Math.sin(3 * t + ph));
      P.push([x, 0, z]); wm.push(Math.abs(cx) > 0.8 ? 1.2 : 1); bk.push(Math.abs(cx) > 0.8 ? 0.8 : -1); tg.push(Math.abs(cx) > 0.8 ? TAG.bowl : 0); dy.push(0);
    }
    return { P, wm, bk, tg, dy, exits: [], hillsScale: 0.35 };
  }

  // ---------------------------------------------------------------- heights and terrain following
  function applyHeights(d, rnd, plan, pers, follow) {
    const n = plan.P.length;
    const hills = (pers.hills[0] + rnd() * (pers.hills[1] - pers.hills[0])) * (plan.hillsScale || 1);
    const k1 = 1 + Math.floor(rnd() * 3), k2 = k1 + 1 + Math.floor(rnd() * 3), p1 = rnd() * TAU, p2 = rnd() * TAU;
    const Y = new Array(n), G = new Array(n).fill(null);
    let mode = follow;
    if (mode !== 'none' && typeof World !== 'undefined' && World.terrainRaw) {
      // Sample the raw terrain along the plan; ridge/valley modes nudge sideways toward high/low ground.
      const T = [];
      for (let i = 0; i < n; i++) {
        const p = plan.P[i], q = plan.P[(i + 1) % n], pr = plan.P[(i - 1 + n) % n];
        const tx = q[0] - pr[0], tz = q[2] - pr[2], tl = Math.hypot(tx, tz) || 1, rx = -tz / tl, rz = tx / tl;
        let best = 0, bh = World.terrainRaw(d, p[0], p[2]);
        if (mode === 'ridge' || mode === 'valley') {
          for (const o of [-14, -7, 7, 14]) { const hh = World.terrainRaw(d, p[0] + rx * o, p[2] + rz * o); if (mode === 'ridge' ? hh > bh : hh < bh) { bh = hh; best = o; } }
        }
        T.push({ off: best, h: bh });
      }
      const off = T.map(t => t.off); boxSmooth(off, 24, 3);
      const backup = plan.P.map(p => p.slice());
      for (let i = 0; i < n; i++) {
        const p = backup[i], q = backup[(i + 1) % n], pr = backup[(i - 1 + n) % n];
        const tx = q[0] - pr[0], tz = q[2] - pr[2], tl = Math.hypot(tx, tz) || 1, rx = -tz / tl, rz = tx / tl;
        plan.P[i][0] += rx * off[i] * 0.45; plan.P[i][2] += rz * off[i] * 0.45;
      }
      smoothXZ(plan.P, 4);
      if (selfIntersects(plan.P, plan.allowed || null)) for (let i = 0; i < n; i++) plan.P[i] = backup[i]; // nudge made a crossing: keep the planned line
      const Hs = plan.P.map(p => World.terrainRaw(d, p[0], p[2]));
      boxSmooth(Hs, 14, 3); // ~40 m wide profile smoothing: no crests that launch the craft
      // Slope limit along the track.
      const cum = [0]; for (let i = 0; i < n; i++) { const a = plan.P[i], b = plan.P[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
      const maxSlope = 0.16;
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 1; i < n; i++) { const ds = cum[i] - cum[i - 1]; Hs[i] = clamp(Hs[i], Hs[i - 1] - maxSlope * ds, Hs[i - 1] + maxSlope * ds); }
        for (let i = n - 2; i >= 0; i--) { const ds = cum[i + 1] - cum[i]; Hs[i] = clamp(Hs[i], Hs[i + 1] - maxSlope * ds, Hs[i + 1] + maxSlope * ds); }
      }
      // Seam: blend the wrap.
      const gap = Hs[0] - Hs[n - 1]; for (let i = 0; i < n; i++) Hs[i] -= gap * (i / n);
      for (let i = 0; i < n; i++) { Y[i] = Hs[i] + 0.8; G[i] = Hs[i]; }
      // Causeways: where the terrain drops below water, lift the deck and set pylons.
      if (mode === 'causeway' || d.waterRel !== undefined) {
        const sorted = Hs.slice().sort((a, b) => a - b);
        const wl = sorted[Math.floor(n * (mode === 'causeway' ? 0.3 : 0.12))] + (d.waterRel || -2);
        plan.waterLevel = wl;
        for (let i = 0; i < n; i++) if (G[i] < wl + 1.2 && plan.tg[i] !== TAG.gap && plan.tg[i] !== TAG.lip) { Y[i] = Math.max(Y[i], wl + 2.4); if (plan.tg[i] === 0) plan.tg[i] = TAG.pylons; }
        // Ramp onto causeways: slope limit the deck again after lifting.
        const lim = 0.22;
        for (let pass = 0; pass < 3; pass++) {
          for (let i = 1; i < n; i++) { const ds = cum[i] - cum[i - 1]; Y[i] = Math.max(Y[i], Y[i - 1] - lim * ds); }
          for (let i = n - 2; i >= 0; i--) { const ds = cum[i + 1] - cum[i]; Y[i] = Math.max(Y[i], Y[i + 1] - lim * ds); }
        }
        const g2 = Y[0] - Y[n - 1]; if (Math.abs(g2) > 0.5) for (let i = 0; i < n; i++) Y[i] -= g2 * (i / n) * 0.5, Y[(n - 1 - i)] += 0;
      }
    } else {
      const cum = [0]; for (let i = 0; i < n; i++) { const a = plan.P[i], b = plan.P[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
      const total = cum[n];
      for (let i = 0; i < n; i++) {
        const s = cum[i] / total * TAU;
        Y[i] = plan.P[i][1] + hills * (Math.sin(k1 * s + p1) + 0.45 * Math.sin(k2 * s + p2)) / 1.45;
      }
    }
    // Final circular slope limit on the deck (designed features are added afterwards and may be steeper).
    {
      const cum = [0]; for (let i = 0; i < n; i++) { const a = plan.P[i], b = plan.P[(i + 1) % n]; cum.push(cum[i] + Math.max(0.05, Math.hypot(b[0] - a[0], b[2] - a[2]))); }
      const lim = follow !== 'none' ? 0.2 : 0.3;
      const wl = plan.waterLevel;
      const lifted = i => wl !== undefined && plan.tg[i] === TAG.pylons;
      for (let pass = 0; pass < 4; pass++) {
        for (let k = 1; k <= 2 * n; k++) { const i = k % n, pr = (k - 1) % n; const ds = cum[pr + 1] - cum[pr]; Y[i] = clamp(Y[i], Y[pr] - lim * ds, Y[pr] + lim * ds); }
        for (let k = 2 * n - 1; k >= 0; k--) { const i = k % n, nx = (k + 1) % n; const ds = cum[i + 1] - cum[i]; Y[i] = clamp(Y[i], Y[nx] - lim * ds, Y[nx] + lim * ds); }
        // Causeways are hard constraints: restore their deck height and ramp neighbours up to it (raise only).
        if (wl !== undefined) {
          for (let i = 0; i < n; i++) if (lifted(i)) Y[i] = Math.max(Y[i], wl + 2.4);
          for (let k = 1; k <= 2 * n; k++) { const i = k % n, pr = (k - 1) % n; const ds = cum[pr + 1] - cum[pr]; Y[i] = Math.max(Y[i], Y[pr] - lim * ds); }
          for (let k = 2 * n - 1; k >= 0; k--) { const i = k % n, nx = (k + 1) % n; const ds = cum[i + 1] - cum[i]; Y[i] = Math.max(Y[i], Y[nx] - lim * ds); }
        }
      }
      if (follow !== 'none') { boxSmooth(Y, 6, 2); if (wl !== undefined) for (let i = 0; i < n; i++) if (lifted(i)) Y[i] = Math.max(Y[i], wl + 2.4); }
    }
    // Feature offsets (jump lips, chasms, drops) and smoothing that respects features.
    const D = plan.dy.slice(); smooth1(D, 2);
    for (let i = 0; i < n; i++) plan.P[i][1] = Y[i] + D[i];
    // Final water guard: no deck under water except designed chasms; ramp neighbours up to lifted points.
    if (plan.waterLevel !== undefined) {
      const wl = plan.waterLevel, skip = i => plan.tg[i] === TAG.gap || plan.tg[i] === TAG.lip;
      const cum = [0]; for (let i = 0; i < n; i++) { const a = plan.P[i], b = plan.P[(i + 1) % n]; cum.push(cum[i] + Math.max(0.05, Math.hypot(b[0] - a[0], b[2] - a[2]))); }
      for (let i = 0; i < n; i++) if (!skip(i) && plan.P[i][1] < wl + 2.2) { plan.P[i][1] = wl + 2.2; if (plan.tg[i] === 0) plan.tg[i] = TAG.pylons; }
      for (let pass = 0; pass < 2; pass++) {
        for (let k = 1; k <= 2 * n; k++) { const i = k % n, pr = (k - 1) % n; if (skip(i)) continue; const ds = cum[pr + 1] - cum[pr]; plan.P[i][1] = Math.max(plan.P[i][1], plan.P[pr][1] - 0.25 * ds); }
        for (let k = 2 * n - 1; k >= 0; k--) { const i = k % n, nx = (k + 1) % n; if (skip(i)) continue; const ds = cum[i + 1] - cum[i]; plan.P[i][1] = Math.max(plan.P[i][1], plan.P[nx][1] - 0.25 * ds); }
      }
    }
    // Pylons where the deck sits well above the terrain hint.
    if (G[0] !== null) for (let i = 0; i < n; i++) if (plan.tg[i] === 0 && plan.P[i][1] - G[i] > 5) plan.tg[i] = TAG.pylons;
    plan.G = G;
  }

  // ---------------------------------------------------------------- main entry
  // Returns a spec; fills d.poly for polyline kinds. Fourier kind leaves d.poly undefined.
  function plan(d, rnd, P, overrides) {
    const pers = personality(P ? P.id : null);
    const spec = (overrides && overrides.track) || (d.track && d.track.kind ? d.track : null);
    let kind = spec ? spec.kind : null;
    const fourierForced = overrides && (overrides.rad || overrides.hgt || overrides.R) && !spec;
    if (!kind) kind = fourierForced ? 'fourier' : (d.flight ? weightedPick(rnd, { lane: 0.85, fourier: 0.05, figure8: 0.05, spiral: 0.05 }) : weightedPick(rnd, pers.kinds));
    if (d.flight && kind === 'grammar') kind = 'lane';
    if (!d.flight && d.mode === 'corridor' && kind === 'grammar') kind = 'fourier';
    const persUsed = spec && spec.personality ? personality(spec.personality) : pers;
    let result = null;
    if (kind === 'lane') result = planLane(d, rnd, lanePersonality(spec && spec.personality ? spec.personality : (P ? P.id : null)));
    if (kind === 'lane' && !result) { kind = 'fourier'; }
    if (kind === 'grammar') result = planGrammar(d, rnd, persUsed);
    else if (kind === 'figure8') result = planFigure8(d, rnd);
    else if (kind === 'spiral') result = planSpiral(d, rnd);
    else if (kind === 'oval') result = planOval(d, rnd);
    if (!result) { d.poly = undefined; return { kind: 'fourier', personality: persUsed.follow }; }
    // Geometry finish: recentre, smooth joints, heights, resample.
    recenter(result.P);
    // Lane scale: the grammar lays pieces at a readable size, then the whole plan is scaled up in XZ so every radius
    // and straight grows together with craft speed. Uniform scaling keeps the shape and the closure exactly as planned.
    if (result.lane && LANE_SCALE !== 1) for (const p of result.P) { p[0] *= LANE_SCALE; p[2] *= LANE_SCALE; }
    smoothXZ(result.P, kind === 'grammar' ? 2 : 0);
    const follow = (d.mode === 'corridor' || kind === 'figure8' || kind === 'spiral') ? 'none' : (spec && spec.follow) || persUsed.follow || 'none';
    if (result.lane) applyLaneHeights(d, result); else applyHeights(d, rnd, result, persUsed, follow);
    if (!result.lane && selfIntersects(result.P, result.allowed || null)) { d.poly = undefined; return { kind: 'fourier', rejected: kind }; }
    const gateIdx = result.gates || [];
    const rs = resample(result.P, [result.wm, result.bk, result.tg, result.G ? result.G.map(g => g === null ? -1e4 : g) : result.P.map(() => -1e4), result.alt || result.P.map(() => 1)], M_PTS);
    const wBase = persUsed.width[0] + rnd() * (persUsed.width[1] - persUsed.width[0]);
    d.width = wBase;
    d.poly = { n: M_PTS, pts: rs.pts, w: rs.attrs[0].map(v => v * wBase), bank: rs.attrs[1], tag: rs.attrs[2].map(v => Math.round(v)), ground: rs.attrs[3], alt: rs.attrs[4], length: rs.total };
    // Ring gates at the entries of interesting pieces (arc fraction of the planned points).
    if (gateIdx.length) { const cumP = [0]; for (let i = 0; i < result.P.length; i++) { const a = result.P[i], b = result.P[(i + 1) % result.P.length]; cumP.push(cumP[i] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); } d.poly.gateTs = gateIdx.map(i => cumP[Math.min(i, result.P.length)] / cumP[result.P.length]); }
    // Bridge floors: the terrain under a bridge should follow the lower deck. Store the lower pass height near each bridge point.
    for (let i = 0; i < M_PTS; i++) if (d.poly.tag[i] === TAG.bridge) {
      let low = d.poly.pts[i][1];
      for (let j = 0; j < M_PTS; j += 3) { const dj = Math.min(Math.abs(i - j), M_PTS - Math.abs(i - j)); if (dj < 40) continue; const q = d.poly.pts[j]; if (Math.hypot(q[0] - d.poly.pts[i][0], q[2] - d.poly.pts[i][2]) < d.width * 2.5) low = Math.min(low, q[1]); }
      d.poly.ground[i] = low;
    }
    if (result.waterLevel !== undefined) d.poly.waterLevel = result.waterLevel;
    // Designed boost gate positions: after hairpin and bowl exits, before jump lips.
    const boost = [];
    for (let i = 0; i < M_PTS; i++) {
      const tg = d.poly.tag[i], prev = d.poly.tag[(i - 1 + M_PTS) % M_PTS];
      if (tg === TAG.exit && prev !== TAG.exit) boost.push(i / M_PTS);
      if (tg === TAG.lip && prev !== TAG.lip) boost.push(((i - 25 + M_PTS) % M_PTS) / M_PTS);
      if (tg === TAG.bowl && prev !== TAG.bowl) boost.push(i / M_PTS);
      if ((tg === TAG.skim || tg === TAG.dive) && prev !== tg) boost.push(((i - 20 + M_PTS) % M_PTS) / M_PTS); // reward the low line
    }
    d.poly.boostTs = boost;
    d.poly.laneKinds = result.kinds || null; d.poly.attempts = result.attempts || 1; d.poly.rejects = result.rejects || null; d.poly.picks = result.picks || null;
    d.poly.pieces = {}; for (let i = 0; i < M_PTS; i++) { const tg = d.poly.tag[i], prev = d.poly.tag[(i - 1 + M_PTS) % M_PTS]; if (tg && tg !== prev) d.poly.pieces[tg] = (d.poly.pieces[tg] || 0) + 1; }
    return { kind, follow };
  }

  // Interpolated position on the polyline (Catmull-Rom), t in [0,1).
  function polyPos(poly, t) {
    const n = poly.n, f = ((t % 1) + 1) % 1 * n, i = Math.floor(f), u = f - i;
    const p0 = poly.pts[(i - 1 + n) % n], p1 = poly.pts[i % n], p2 = poly.pts[(i + 1) % n], p3 = poly.pts[(i + 2) % n];
    const out = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      out[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
    }
    return out;
  }
  function polyAttr(poly, arr, t, nearestOnly) {
    const n = poly.n, f = ((t % 1) + 1) % 1 * n, i = Math.floor(f), u = f - i;
    return nearestOnly ? arr[(u < 0.5 ? i : i + 1) % n] : mix(arr[i % n], arr[(i + 1) % n], u);
  }

  return { TAG, PERSONALITY, PRESETS, personality, lanePersonality, LANE_STYLE_OF, plan, polyPos, polyAttr, selfIntersects };
})();
