// Vehicle part grammar: a kit of low-poly parametric parts assembled from a recipe into one mesh.
// Vertex layout (12 floats): pos3, nrm3, uv2, ex4. ex = [3, partId, secondaryTone, stripe].
// Part ids used: 0 body tint, 3 lights (ex3: 0 white, 1 red tail), 4 dark glass, 5 dark metal, 6 engine glow.
// uv.y is a wear hint for every vertex: 0 at the top of the craft, 1 at the bottom.
// Local space: +Z forward, +Y up, +X starboard. A socket is { at:[x,y,z], rot:[yaw,pitch,roll], scale, mirror, tone }.
const Craft = (() => {
  const TAU = Math.PI * 2, STRIDE = 12;
  const v3 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  class MB {
    constructor() { this.v = []; this.i = []; }
    vert(p, n, uv, ex) { this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], ex[0], ex[1], ex[2], ex[3]); return this.v.length / STRIDE - 1; }
    tri(a, b, c) { this.i.push(a, b, c); }
    // Flat-shaded polygon (3 or 4 points) with an outward hint point.
    face(pts, ex, hint, uv = [0, 0]) {
      const n0 = cross(sub(pts[1], pts[0]), sub(pts[pts.length - 1], pts[0]));
      if (len(n0) < 1e-9) return;
      let n = norm(n0);
      const c = pts.reduce((s, p) => v3(s, p, 1 / pts.length), [0, 0, 0]);
      if (hint && dot(n, sub(c, hint)) < 0) n = [-n[0], -n[1], -n[2]];
      const ids = pts.map(p => this.vert(p, n, uv, ex));
      for (let k = 1; k < pts.length - 1; k++) this.tri(ids[0], ids[k], ids[k + 1]);
    }
    finish() { return { verts: new Float32Array(this.v), idx: new Uint32Array(this.i) }; }
  }

  // ---------------------------------------------------------------- primitives (local +Z axis)
  const circle = (n, r = 1) => Array.from({ length: n }, (_, k) => [Math.cos(k / n * TAU) * r, Math.sin(k / n * TAU) * r]);
  function roundRect(w, h, b) {
    const x = w / 2, y = h / 2, c = Math.min(b, x, y);
    return [[x - c, -y], [x, -y + c], [x, y - c], [x - c, y], [-x + c, y], [-x, y - c], [-x, -y + c], [-x + c, -y]];
  }
  // Loft a polygon through slices { z, sx, sy, cx, cy }. Flat faces. Optional end caps. Per-face flag callback -> [ex2, ex3].
  function loft(mb, poly, slices, ex, o = {}) {
    const rings = slices.map(s => poly.map(([x, y]) => [x * (s.sx ?? 1) + (s.cx || 0), y * (s.sy ?? s.sx ?? 1) + (s.cy || 0), s.z]));
    const center = rings.reduce((acc, r) => v3(acc, r.reduce((a, p) => v3(a, p, 1 / r.length), [0, 0, 0]), 1 / rings.length), [0, 0, 0]);
    const flagged = pts => { if (!o.flag) return ex; const c = pts.reduce((s, p) => v3(s, p, 1 / pts.length), [0, 0, 0]); const f = o.flag(c); return [ex[0], ex[1], f[0], f[1]]; };
    for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < poly.length; k++) {
      const k2 = (k + 1) % poly.length;
      const a = rings[i][k], b = rings[i][k2], c = rings[i + 1][k2], d = rings[i + 1][k];
      const pts = [a, b, c, d].filter((p, j, arr) => j === 0 || len(sub(p, arr[j - 1])) > 1e-6);
      if (pts.length >= 3) mb.face(pts, flagged(pts), center, [k / poly.length, 0]);
    }
    if (o.capStart !== false) { const r = rings[0]; if (len(sub(r[0], r[1])) > 1e-6) mb.face([...r].reverse(), flagged(r), center); }
    if (o.capEnd !== false) { const r = rings[rings.length - 1]; if (len(sub(r[0], r[1])) > 1e-6) mb.face(r, flagged(r), center); }
  }
  // Prism between two points (struts in any direction) and an axis-aligned box, both flat shaded.
  function bar(mb, a, b, r, ex, sides = 4) {
    const d = sub(b, a); const L = len(d); if (L < 1e-6) return;
    const dn = [d[0] / L, d[1] / L, d[2] / L];
    const up = Math.abs(dn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(dn, up)), v = cross(dn, u);
    const ring = z => Array.from({ length: sides }, (_, k) => { const t = (k + 0.5) / sides * TAU; return v3(v3(z, u, Math.cos(t) * r), v, Math.sin(t) * r); });
    const r0 = ring(a), r1 = ring(b), mid = v3(a, b, 1); mid[0] /= 2; mid[1] /= 2; mid[2] /= 2;
    for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; mb.face([r0[k], r0[k2], r1[k2], r1[k]], ex, mid); }
    mb.face([...r0].reverse(), ex, mid); mb.face(r1, ex, mid);
  }
  function boxAt(mb, c, size, ex) {
    const h = [size[0] / 2, size[1] / 2, size[2] / 2];
    const P8 = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(s => [c[0] + s[0] * h[0], c[1] + s[1] * h[1], c[2] + s[2] * h[2]]);
    for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]]) mb.face(f.map(i => P8[i]), ex, c);
  }
  const P = {
    capsule(mb, ex, { len = 4, r = 0.5, squash = 0.8, seg = 12, noseTaper = 1 } = {}, o) {
      const sl = [], caps = [0, 0.35, 0.7];
      for (const a of caps) sl.push({ z: -(len / 2 - r) - r * Math.cos(a * Math.PI / 2), sx: r * Math.sin(a * Math.PI / 2), sy: r * Math.sin(a * Math.PI / 2) * squash });
      sl.push({ z: -(len / 2 - r), sx: r, sy: r * squash });
      sl.push({ z: (len / 2 - r), sx: r * noseTaper, sy: r * squash * noseTaper });
      for (const a of [...caps].reverse()) sl.push({ z: (len / 2 - r) + r * Math.cos(a * Math.PI / 2), sx: r * Math.sin(a * Math.PI / 2) * noseTaper, sy: r * Math.sin(a * Math.PI / 2) * squash * noseTaper });
      loft(mb, circle(seg), sl, ex, { ...o, capStart: false, capEnd: false });
    },
    box(mb, ex, { len = 4, w = 1.6, h = 0.8, bevel = 0.15, front = 0.85, rear = 0.95 } = {}, o) {
      loft(mb, roundRect(w, h, bevel), [{ z: -len / 2, sx: rear }, { z: -len / 2 + 0.35, sx: 1 }, { z: len / 2 - 0.45, sx: 1 }, { z: len / 2, sx: front }], ex, o);
    },
    saucer(mb, ex, { R = 2.2, h = 0.7, seg = 24 } = {}, o) { // axis is local Z; place with pitch -90 to stand it up
      loft(mb, circle(seg), [{ z: -h * 0.5, sx: 0.15 * R }, { z: -h * 0.25, sx: 0.7 * R }, { z: 0, sx: R }, { z: h * 0.3, sx: 0.75 * R }, { z: h * 0.5, sx: 0.4 * R }], ex, o);
    },
    sphere(mb, ex, { r = 0.8, seg = 12, rings = 7 } = {}, o) {
      const sl = []; for (let i = 0; i <= rings; i++) { const a = i / rings * Math.PI; sl.push({ z: -Math.cos(a) * r, sx: Math.sin(a) * r }); }
      loft(mb, circle(seg), sl, ex, { ...o, capStart: false, capEnd: false });
    },
    bell(mb, ex, { r = 0.35, len = 0.9, seg = 12 } = {}) { // exhaust faces +Z
      loft(mb, circle(seg), [{ z: -len / 2, sx: r * 0.6 }, { z: -len * 0.2, sx: r * 0.85 }, { z: len * 0.15, sx: r * 0.95 }, { z: len / 2, sx: r * 1.15 }], [3, 5, 0, 0]);
      loft(mb, circle(seg), [{ z: len / 2 - 0.12, sx: r * 0.8 }, { z: len / 2 + 0.01, sx: r * 0.85 }], [3, 6, 0, 0]);
      loft(mb, circle(6), [{ z: -len / 2 - 0.15, sx: r * 0.3 }, { z: -len / 2 + 0.05, sx: r * 0.3 }], [3, 5, 0, 0]);
    },
    intake(mb, ex, { w = 0.4, h = 0.3, len = 0.9 } = {}) {
      loft(mb, roundRect(w, h, 0.06), [{ z: -len / 2, sx: 0.85 }, { z: len / 2 - 0.1, sx: 1 }, { z: len / 2, sx: 1 }], ex);
      loft(mb, roundRect(w * 0.8, h * 0.75, 0.04), [{ z: len / 2 - 0.02, sx: 1 }, { z: len / 2 + 0.03, sx: 1 }], [3, 5, 0, 0]);
    },
    wing(mb, ex, { span = 1.5, chord = 1.3, thick = 0.1, sweep = 0.7, taper = 0.5 } = {}) { // spans along +Z, chord along local X (+x = trailing after a +90 yaw)
      loft(mb, roundRect(chord, thick, 0.03), [{ z: 0, sx: 1 }, { z: span, sx: taper, sy: 0.4, cx: sweep }], ex);
      const tx = sweep + chord * taper / 2;
      mb.face([[tx - 0.25, -0.03, span], [tx, -0.03, span], [tx, 0.03, span + 0.02], [tx - 0.25, 0.03, span + 0.02]], [3, 3, 0, 1], null);
    },
    fin(mb, ex, { h = 0.7, chord = 0.8, thick = 0.06, sweep = 0.4, taper = 0.5 } = {}) { // rises along +Z, chord along local Y (+y = trailing)
      loft(mb, roundRect(thick, chord, 0.02), [{ z: 0, sx: 1 }, { z: h, sx: 0.5, sy: taper, cy: sweep }], ex);
    },
    mast(mb, ex, { h = 1.2, r = 0.05, dish = 0 } = {}) { // rises along +Z
      loft(mb, circle(6), [{ z: 0, sx: r }, { z: h, sx: r * 0.7 }], [3, 5, 0, 0]);
      loft(mb, roundRect(0.16, 0.16, 0.03), [{ z: h - 0.08, sx: 1 }, { z: h + 0.08, sx: 1 }], ex);
      if (dish > 0) loft(mb, circle(12), [{ z: h + 0.08, sx: dish * 0.2 }, { z: h + 0.14, sx: dish }, { z: h + 0.2, sx: dish * 0.85 }], ex);
    },
    strut(mb, ex, { len = 1, r = 0.05 } = {}) { loft(mb, circle(6), [{ z: 0, sx: r }, { z: len, sx: r }], [3, 5, 0, 0]); },
    grille(mb, ex, { w = 1.2, h = 0.5, n = 9 } = {}) { // faces +Z
      loft(mb, roundRect(w, h, 0.05), [{ z: -0.15, sx: 1 }, { z: 0, sx: 1 }], [3, 5, 0, 0]);
      for (let k = 0; k < n; k++) { const x = -w / 2 + (k + 0.5) / n * w; loft(mb, roundRect(0.05, h * 0.9, 0.01), [{ z: 0, sx: 1, cx: x }, { z: 0.09, sx: 0.8, cx: x }], ex); }
    },
    hatch(mb, ex, { w = 0.4, h = 0.3 } = {}) { loft(mb, roundRect(w, h, 0.04), [{ z: 0, sx: 1 }, { z: 0.04, sx: 0.92 }], [ex[0], ex[1], 1, ex[3]]); },
    vent(mb, ex, { w = 0.3, h = 0.14, n = 3 } = {}) {
      loft(mb, roundRect(w, h, 0.01), [{ z: 0, sx: 1 }, { z: 0.03, sx: 1 }], [3, 5, 0, 0]);
      for (let k = 0; k < n; k++) loft(mb, roundRect(w * 0.9, h / n * 0.5, 0.005), [{ z: 0.03, sx: 1, cy: -h / 2 + (k + 0.5) / n * h }, { z: 0.05, sx: 1, cy: -h / 2 + (k + 0.5) / n * h }], ex);
    },
    antenna(mb, ex, { len = 0.6 } = {}) { loft(mb, circle(4), [{ z: 0, sx: 0.025 }, { z: len, sx: 0.012 }], [3, 5, 0, 0]); loft(mb, circle(4), [{ z: len, sx: 0.035 }, { z: len + 0.06, sx: 0.035 }], [3, 3, 0, 0]); },
    rivet(mb, ex) { loft(mb, circle(4, 0.035), [{ z: 0, sx: 1 }, { z: 0.035, sx: 0.7 }], [3, 5, 0, 0]); },
    light(mb, ex, { w = 0.3, h = 0.1, red = 0 } = {}) { loft(mb, roundRect(w, h, 0.02), [{ z: -0.03, sx: 1 }, { z: 0.03, sx: 1 }], [3, 3, 0, red]); },
    dome(mb, ex, { r = 0.5, squash = 0.7, seg = 12 } = {}) { // half sphere rising along +Z, place with pitch -90
      const sl = []; for (let i = 0; i <= 4; i++) { const a = i / 4 * Math.PI / 2; sl.push({ z: Math.sin(a) * r * squash, sx: Math.cos(a) * r }); }
      loft(mb, circle(seg), sl, [3, 4, 0, 0], { capEnd: false });
    },
    cockpitFrame(mb, ex, { w = 1.0, h = 0.5 } = {}) { // open cockpit: dark well plus a raked windshield, faces +Z
      loft(mb, roundRect(w, 0.5, 0.05), [{ z: -0.9, sx: 1 }, { z: 0.3, sx: 1 }], [3, 5, 0, 0]);
      mb.face([[-w / 2, 0.25, 0.3], [w / 2, 0.25, 0.3], [w / 2 * 0.9, 0.25 + h, 0.75], [-w / 2 * 0.9, 0.25 + h, 0.75]], [3, 4, 0, 0], null);
      for (const x of [-w / 2, w / 2]) loft(mb, circle(4, 0.03), [{ z: 0, sx: 1, cx: x, cy: 0.25 }, { z: 0.5, sx: 1, cx: x * 0.9, cy: 0.25 + h }], [3, 5, 0, 0]);
    },
    tank(mb, ex, o = {}) { P.sphere(mb, ex, { r: o.r || 0.9, seg: 14, rings: 8 }); loft(mb, circle(12), [{ z: -(o.r || 0.9) * 0.55, sx: (o.r || 0.9) * 0.86 }, { z: (o.r || 0.9) * 0.55, sx: (o.r || 0.9) * 0.86 }], [3, 5, 0, 0], { capStart: false, capEnd: false }); },
    ringLights(mb, ex, { n = 8, R = 1.9, w = 0.22, h = 0.12 } = {}) { // small lights around a ring in the local XZ plane, facing outward
      for (let k = 0; k < n; k++) {
        const a = k / n * TAU, c = Math.cos(a), s = Math.sin(a), cx = c * R, cz = s * R, tx = -s, tz = c;
        const p = (u, v, d) => [cx + tx * u + c * d, v, cz + tz * u + s * d];
        mb.face([p(-w / 2, -h / 2, 0), p(w / 2, -h / 2, 0), p(w / 2, h / 2, 0), p(-w / 2, h / 2, 0)], [3, 3, 0, 0], [0, 0, 0]);
        mb.face([p(-w / 2, -h / 2, -0.06), p(-w / 2, h / 2, -0.06), p(w / 2, h / 2, -0.06), p(w / 2, -h / 2, -0.06)], [3, 5, 0, 0], null);
      }
    },
    skid(mb, ex, { len = 2.4, w = 0.22, h = 0.1 } = {}) { loft(mb, roundRect(w, h, 0.03), [{ z: -len / 2, sx: 0.6 }, { z: -len / 2 + 0.3, sx: 1 }, { z: len / 2 - 0.3, sx: 1 }, { z: len / 2, sx: 0.6 }], [3, 5, 0, 0]); },
    pad(mb, ex, { r = 0.32 } = {}) { loft(mb, circle(10), [{ z: 0, sx: r * 0.7 }, { z: 0.12, sx: r }, { z: 0.2, sx: r * 0.9 }], [3, 5, 0, 0]); loft(mb, circle(10), [{ z: 0.2, sx: r * 0.6 }, { z: 0.24, sx: r * 0.6 }], [3, 6, 0, 0]); },
    plate(mb, ex, { w = 0.6, h = 0.4, t = 0.06 } = {}) { loft(mb, roundRect(w, h, 0.03), [{ z: -t / 2, sx: 1 }, { z: t / 2, sx: 1 }], ex); },
    // ---- kitbash additions
    torus(mb, ex, { R = 1.6, r = 0.18, seg = 20, sides = 8 } = {}) { // ring in the local XY plane around +Z
      const pt = (k, j) => { const a = k / seg * TAU, b = j / sides * TAU; return [Math.cos(a) * (R + r * Math.cos(b)), Math.sin(a) * (R + r * Math.cos(b)), r * Math.sin(b)]; };
      for (let k = 0; k < seg; k++) { const a = (k + 0.5) / seg * TAU, hint = [Math.cos(a) * R, Math.sin(a) * R, 0]; for (let j = 0; j < sides; j++) mb.face([pt(k, j), pt(k + 1, j), pt(k + 1, j + 1), pt(k, j + 1)], ex, hint); }
    },
    turret(mb, ex, { r = 0.3, barrels = 1, len = 0.7 } = {}) { // rises along +Z, barrels point local -Y (forward on the spine)
      loft(mb, circle(10), [{ z: 0, sx: r }, { z: 0.12, sx: r }], [3, 5, 0, 0]);
      loft(mb, circle(10), [{ z: 0.12, sx: r * 0.8 }, { z: 0.3, sx: r * 0.78 }, { z: 0.44, sx: r * 0.45 }], ex);
      for (let b = 0; b < barrels; b++) { const x = (b - (barrels - 1) / 2) * r * 0.55; boxAt(mb, [x, -len / 2 - r * 0.3, 0.3], [r * 0.18, len, r * 0.18], [3, 5, 0, 0]); boxAt(mb, [x, -len - r * 0.3 + 0.06, 0.3], [r * 0.26, 0.12, r * 0.26], [3, 5, 0, 0]); }
    },
    cargoPod(mb, ex, { len = 1.6, r = 0.35 } = {}) {
      loft(mb, roundRect(r * 2, r * 2, r * 0.6), [{ z: -len / 2, sx: 0.7 }, { z: -len / 2 + 0.15, sx: 1 }, { z: len / 2 - 0.15, sx: 1 }, { z: len / 2, sx: 0.7 }], ex);
      for (const z of [-len * 0.28, len * 0.28]) loft(mb, roundRect(r * 2.12, r * 2.12, r * 0.6), [{ z, sx: 1 }, { z: z + 0.08, sx: 1 }], [3, 5, 0, 0]);
    },
    radar(mb, ex, { h = 0.45, dish = 0.45 } = {}) {
      loft(mb, circle(6), [{ z: 0, sx: 0.06 }, { z: h, sx: 0.045 }], [3, 5, 0, 0]);
      loft(mb, circle(14), [{ z: h, sx: dish * 0.15 }, { z: h + 0.12, sx: dish }, { z: h + 0.2, sx: dish * 0.92 }], ex);
      loft(mb, circle(4), [{ z: h + 0.2, sx: 0.02 }, { z: h + 0.5, sx: 0.02 }], [3, 5, 0, 0]);
      loft(mb, circle(6), [{ z: h + 0.5, sx: 0.06 }, { z: h + 0.56, sx: 0.05 }], [3, 3, 0, 0]);
    },
    rotor(mb, ex, { R = 0.9, blades = 3, hub = 0.12 } = {}) {
      loft(mb, circle(8), [{ z: 0, sx: hub }, { z: 0.2, sx: hub * 0.85 }], [3, 5, 0, 0]);
      for (let b = 0; b < blades; b++) { const a = b / blades * TAU, c = Math.cos(a), s = Math.sin(a), w = 0.13; const p = (rr, side, z) => [c * rr - s * side * w, s * rr + c * side * w, z]; mb.face([p(hub * 0.9, -1, 0.1), p(R, -0.6, 0.13), p(R, 0.6, 0.13), p(hub * 0.9, 1, 0.1)], ex, [c * R * 0.5, s * R * 0.5, -1]); }
    },
    sail(mb, ex, { h = 1.4, base = 0.9, top = 0.3 } = {}) { // rises along +Z, trailing edge along +Y
      loft(mb, circle(4), [{ z: 0, sx: 0.035 }, { z: h, sx: 0.02 }], [3, 5, 0, 0]);
      loft(mb, roundRect(0.03, base, 0.01), [{ z: 0.02, sx: 1, cy: base / 2 }, { z: h * 0.97, sx: 1, sy: top / base, cy: top / 2 + 0.05 }], ex);
    },
    tentacle(mb, ex, { len = 1.6, r = 0.16, curl = 0.6, seg = 7 } = {}) { // rises off the surface then curls toward local +Y
      const sl = []; for (let k = 0; k <= seg; k++) { const t = k / seg; sl.push({ z: t * len, sx: r * (1 - t * 0.85) + 0.01, cy: curl * t * t * len * 0.6, cx: Math.sin(t * 5) * r * 0.5 }); }
      loft(mb, circle(7), sl, ex, { capStart: false });
    },
    thrusterCluster(mb, ex, { r = 0.18, n = 4, len = 0.6 } = {}) { // exhaust faces +Z like a bell
      loft(mb, roundRect(r * 3.4, r * 3.4, r), [{ z: -len / 2 - 0.08, sx: 1 }, { z: -len / 2, sx: 1 }], [3, 5, 0, 0]);
      for (let k = 0; k < n; k++) { const a = k / n * TAU, cx = n === 1 ? 0 : Math.cos(a) * r * 1.25, cy = n === 1 ? 0 : Math.sin(a) * r * 1.25; loft(mb, circle(8), [{ z: -len / 2, sx: r * 0.7, cx, cy }, { z: len * 0.1, sx: r * 0.9, cx, cy }, { z: len / 2, sx: r * 1.05, cx, cy }], [3, 5, 0, 0]); loft(mb, circle(8), [{ z: len / 2 - 0.06, sx: r * 0.75, cx, cy }, { z: len / 2 + 0.01, sx: r * 0.8, cx, cy }], [3, 6, 0, 0]); }
    },
    bubble(mb, ex, { r = 0.45, len = 1.1, squash = 0.7 } = {}) { // elongated canopy rising along +Z, long axis along local Y
      loft(mb, roundRect(r * 2, len, r * 0.8), [{ z: 0, sx: 1 }, { z: r * squash * 0.55, sx: 0.88 }, { z: r * squash * 0.9, sx: 0.55 }, { z: r * squash, sx: 0.2 }], [3, 4, 0, 0], { capStart: false });
    },
    visor(mb, ex, { w = 0.9, h = 0.35 } = {}) { // raked window slab rising along +Z, leaning toward local -Y (forward)
      loft(mb, roundRect(w, 0.5, 0.05), [{ z: 0, sx: 1 }, { z: h, sx: 0.8, sy: 0.55, cy: -0.28 }], [3, 4, 0, 0]);
    },
    armourPlate(mb, ex, { w = 0.8, h = 0.5, t = 0.1 } = {}) {
      loft(mb, roundRect(w, h, 0.06), [{ z: 0, sx: 1 }, { z: t * 0.7, sx: 0.96 }, { z: t, sx: 0.85 }], ex);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) loft(mb, circle(4, 0.03), [{ z: t, sx: 1, cx: sx * w * 0.38, cy: sy * h * 0.36 }, { z: t + 0.03, sx: 0.7, cx: sx * w * 0.38, cy: sy * h * 0.36 }], [3, 5, 0, 0]);
    },
    cageFrame(mb, ex, { len = 1.4, w = 0.9, h = 0.7, r = 0.04 } = {}) { // box cage of twelve struts, centred, along +Z
      const c = [[-w / 2, -h / 2, -len / 2], [w / 2, -h / 2, -len / 2], [w / 2, h / 2, -len / 2], [-w / 2, h / 2, -len / 2], [-w / 2, -h / 2, len / 2], [w / 2, -h / 2, len / 2], [w / 2, h / 2, len / 2], [-w / 2, h / 2, len / 2]];
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) bar(mb, c[a], c[b], r, [3, 5, 0, 0]);
    },
    nacelle(mb, ex, { len = 1.4, r = 0.3 } = {}) { // engine pod along +Z: intake forward (+Z), glow aft (-Z)
      loft(mb, circle(10), [{ z: -len / 2, sx: r * 0.75 }, { z: -len / 2 + 0.3, sx: r }, { z: len / 2 - 0.25, sx: r }, { z: len / 2, sx: r * 0.8 }], ex);
      loft(mb, circle(10), [{ z: len / 2 - 0.02, sx: r * 0.68 }, { z: len / 2 + 0.03, sx: r * 0.7 }], [3, 5, 0, 0]);
      loft(mb, circle(10), [{ z: -len / 2 - 0.02, sx: r * 0.6 }, { z: -len / 2 + 0.05, sx: r * 0.62 }], [3, 6, 0, 0]);
    },
    ramProw(mb, ex, { len = 1.2, w = 0.9, h = 0.5 } = {}) { // wedge pointing +Z
      loft(mb, roundRect(w, h, 0.04), [{ z: 0, sx: 1 }, { z: len * 0.7, sx: 0.5, sy: 0.6 }, { z: len, sx: 0.08, sy: 0.15 }], ex);
    },
    number(mb, ex, { n = 42, size = 0.3 } = {}) { // two seven-segment digits as light plates in the local XY plane
      const SEG = { 0: [1, 1, 1, 1, 1, 1, 0], 1: [0, 1, 1, 0, 0, 0, 0], 2: [1, 1, 0, 1, 1, 0, 1], 3: [1, 1, 1, 1, 0, 0, 1], 4: [0, 1, 1, 0, 0, 1, 1], 5: [1, 0, 1, 1, 0, 1, 1], 6: [1, 0, 1, 1, 1, 1, 1], 7: [1, 1, 1, 0, 0, 0, 0], 8: [1, 1, 1, 1, 1, 1, 1], 9: [1, 1, 1, 1, 0, 1, 1] };
      const w = size * 0.55, h = size, t = size * 0.14;
      const pos = [[0, h / 2, 1], [w / 2, h / 4, 0], [w / 2, -h / 4, 0], [0, -h / 2, 1], [-w / 2, -h / 4, 0], [-w / 2, h / 4, 0], [0, 0, 1]];
      const digits = String(Math.abs(Math.floor(n)) % 100).padStart(2, '0');
      digits.split('').forEach((d, i) => { const ox = (i - 0.5) * w * 1.5; SEG[d].forEach((on, k) => { if (!on) return; const [x, y, horiz] = pos[k]; loft(mb, roundRect(horiz ? w * 0.8 : t, horiz ? t : h / 2 * 0.8, 0.01), [{ z: 0, sx: 1, cx: ox + x, cy: y }, { z: 0.02, sx: 1, cx: ox + x, cy: y }], [3, 3, 0, 0]); }); });
    },
    decal(mb, ex, { w = 0.5, h = 0.5, kind = 0 } = {}) { // flat emissive plate: 0 square, 1 triangle, 2 disc, 3 bar
      const e = [3, 6, 0, 0];
      if (kind === 1) { mb.face([[-w / 2, -h / 2, 0.02], [w / 2, -h / 2, 0.02], [0, h / 2, 0.02]], e, [0, 0, -1]); }
      else if (kind === 2) loft(mb, circle(10), [{ z: 0, sx: w / 2 }, { z: 0.02, sx: w / 2 }], e);
      else loft(mb, roundRect(w, kind === 3 ? h * 0.3 : h, 0.02), [{ z: 0, sx: 1 }, { z: 0.02, sx: 1 }], e);
    },
  };

  // ---------------------------------------------------------------- placement
  function rotP(p, rot) {
    let [x, y, z] = p; const [yaw = 0, pitch = 0, roll = 0] = rot || [];
    if (roll) { const c = Math.cos(roll), s = Math.sin(roll); [x, y] = [c * x - s * y, s * x + c * y]; }
    if (pitch) { const c = Math.cos(pitch), s = Math.sin(pitch); [y, z] = [c * y - s * z, s * y + c * z]; }
    if (yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); [x, z] = [c * x + s * z, -s * x + c * z]; }
    return [x, y, z];
  }
  function addPart(mb, type, spec, socket) {
    const fn = P[type]; if (!fn) return;
    const tone = socket.tone || 0;
    const ex = [3, socket.part ?? 0, tone, socket.stripe || 0];
    const tmp = new MB();
    fn(tmp, ex, spec, socket.opts);
    const sc = Array.isArray(socket.scale) ? socket.scale : [socket.scale || 1, socket.scale || 1, socket.scale || 1];
    const copies = socket.mirror ? [1, -1] : [1];
    for (const m of copies) {
      const base = mb.v.length / STRIDE;
      const rot = [socket.rot?.[0] || 0, socket.rot?.[1] || 0, socket.rot?.[2] || 0];
      for (let i = 0; i < tmp.v.length; i += STRIDE) {
        let p = [tmp.v[i] * sc[0], tmp.v[i + 1] * sc[1], tmp.v[i + 2] * sc[2]];
        let n = [tmp.v[i + 3] / sc[0], tmp.v[i + 4] / sc[1], tmp.v[i + 5] / sc[2]];
        p = rotP(p, rot); n = norm(rotP(n, rot));
        p = [p[0] + (socket.at?.[0] || 0), p[1] + (socket.at?.[1] || 0), p[2] + (socket.at?.[2] || 0)];
        if (m < 0) { p[0] = -p[0]; n[0] = -n[0]; }
        mb.v.push(p[0], p[1], p[2], n[0], n[1], n[2], tmp.v[i + 6], tmp.v[i + 7], tmp.v[i + 8], tmp.v[i + 9], tmp.v[i + 10], tmp.v[i + 11]);
      }
      for (let i = 0; i < tmp.i.length; i++) mb.i.push(tmp.i[i] + base);
    }
  }

  // ---------------------------------------------------------------- hull + paint flags
  function hullBounds(h) {
    const at = h.at || [0, 0.7, 0];
    let b;
    if (h.type === 'capsule') {
      const sq = h.squash || 0.8;
      b = { top: at[1] + h.r * sq, bottom: at[1] - h.r * sq, halfW: h.r, len: h.len, cy: at[1], cz: at[2], ring: false };
      b.surfX = (y, z) => { const dy = (y - b.cy) / (h.r * sq); if (Math.abs(dy) >= 1) return 0; const dz = Math.abs(z - b.cz) - (h.len / 2 - h.r); const endf = dz > 0 ? Math.sqrt(Math.max(0, 1 - (dz / h.r) ** 2)) : 1; return h.r * Math.sqrt(1 - dy * dy) * endf * (z - b.cz > 0 ? 1 - (1 - (h.noseTaper ?? 1)) * Math.max(0, (z - b.cz) / (h.len / 2)) : 1); };
    } else if (h.type === 'saucer') {
      b = { top: at[1] + h.h * 0.5, bottom: at[1] - h.h * 0.5, halfW: h.R, len: h.R * 2, cy: at[1], cz: at[2], ring: true };
      b.surfX = (y, z) => { const rz = Math.sqrt(Math.max(0, h.R * h.R - (z - b.cz) ** 2)); const f = y > b.cy ? 1 - 0.6 * (y - b.cy) / (b.top - b.cy) : 1 - 0.85 * (b.cy - y) / (b.cy - b.bottom); return rz * Math.max(0.05, f); };
    } else {
      b = { top: at[1] + h.h / 2, bottom: at[1] - h.h / 2, halfW: h.w / 2, len: h.len, cy: at[1], cz: at[2], ring: false };
      b.surfX = (y, z) => { const dz = z - b.cz, L = h.len; const fr = h.front ?? 0.85, re = h.rear ?? 0.95; const t = dz > L / 2 - 0.45 ? 1 - (1 - fr) * (dz - (L / 2 - 0.45)) / 0.45 : dz < -L / 2 + 0.35 ? 1 - (1 - re) * (-L / 2 + 0.35 - dz) / 0.35 : 1; return h.w / 2 * t; };
    }
    // Upper and lower surface height at (x, z), used by sockets.
    if (h.type === 'capsule') {
      const sq = h.squash || 0.8;
      const endf = z => { const dz = Math.abs(z - b.cz) - (h.len / 2 - h.r); return dz > 0 ? Math.sqrt(Math.max(0, 1 - (dz / h.r) ** 2)) : 1; };
      const taper = z => (z - b.cz > 0 ? 1 - (1 - (h.noseTaper ?? 1)) * Math.max(0, (z - b.cz) / (h.len / 2)) : 1);
      b.surfY = (x, z, side = 1) => { const rr = h.r * endf(z) * taper(z); const q = Math.max(0, 1 - (x / Math.max(1e-3, rr)) ** 2); return b.cy + side * rr * sq * Math.sqrt(q); };
    } else if (h.type === 'saucer') {
      b.surfY = (x, z, side = 1) => { const rr = Math.hypot(x, z - b.cz) / h.R; return b.cy + side * h.h * 0.5 * (rr < 0.15 ? 1 : rr < 0.7 ? 0.75 : Math.max(0.05, 1 - rr)); };
    } else {
      b.surfY = (x, z, side = 1) => b.cy + side * h.h / 2;
    }
    return b;
  }
  // Named sockets on the hull. A part gives { socket, u (-1..1 along length), v (-1..1 lateral or height), out (offset along the normal) }.
  const AXIS = { capsule: 'axial', box: 'axial', saucer: 'rise', sphere: 'axial', tank: 'axial', bell: 'back', intake: 'axial', wing: 'span', fin: 'rise', mast: 'rise', strut: 'axial', grille: 'axial', hatch: 'rise', vent: 'rise', antenna: 'rise', rivet: 'rise', light: 'axial', dome: 'rise', cockpitFrame: 'axial', ringLights: 'flat', plate: 'rise', skid: 'axial', pad: 'rise',
    torus: 'rise', turret: 'rise', cargoPod: 'axial', radar: 'rise', rotor: 'rise', sail: 'rise', tentacle: 'rise', thrusterCluster: 'back', bubble: 'rise', visor: 'rise', armourPlate: 'rise', cageFrame: 'axial', nacelle: 'axial', ramProw: 'axial', number: 'rise', decal: 'rise' };
  const SOCKETS = ['nose', 'spine', 'flank', 'belly', 'tail', 'wingtip'];
  function resolveSocket(b, hull, part, wingTip) {
    const u = part.u ?? 0, v = part.v ?? 0, w = part.w ?? 0, out = part.out ?? -0.04;
    const z = b.cz + u * b.len / 2 * 0.92;
    let at, normal;
    switch (part.socket) { // nose and tail: v is the height fraction, w the lateral fraction
      case 'nose': at = [w * b.halfW * 0.3, b.cy + v * (b.top - b.cy), b.cz + b.len / 2 * (hull.type === 'saucer' ? 0.9 : 0.98)]; normal = [0, 0, 1]; break;
      case 'tail': at = [w * b.halfW * 1.4, b.cy + v * (b.top - b.cy), b.cz - b.len / 2 * (hull.type === 'saucer' ? 0.85 : 0.96)]; normal = [0, 0, -1]; break;
      case 'belly': { const x = v * b.halfW * 0.7; at = [x, b.surfY(x, z, -1), z]; normal = [0, -1, 0]; break; }
      case 'flank': { const y = b.cy + v * (b.top - b.cy) * 0.8; const x = Math.max(0.05, b.surfX(y, z)); at = [x, y, z]; normal = [1, 0, 0]; break; }
      case 'wingtip': { at = wingTip ? [wingTip[0], wingTip[1], wingTip[2] + u * 0.3] : [b.halfW + 1, b.cy, z]; normal = [1, 0, 0]; break; }
      default: { const x = v * b.halfW * 0.7; at = [x, b.surfY(x, z, 1), z]; normal = [0, 1, 0]; } // spine
    }
    at = v3(at, normal, out);
    const axis = AXIS[part.type] || 'axial';
    let rot;
    if (axis === 'axial' || axis === 'flat') rot = [0, 0, 0];
    else if (axis === 'back') rot = [Math.PI, 0, 0];
    else if (axis === 'span') rot = [Math.PI / 2, 0, 0];
    else { // rise: map +Z to the socket normal, keeping local +Y (a fin's trailing edge) pointing aft
      rot = normal[1] > 0 ? [0, -Math.PI / 2, 0] : normal[1] < 0 ? [Math.PI, Math.PI / 2, 0] : normal[0] > 0 ? [Math.PI / 2, 0, Math.PI / 2] : normal[2] > 0 ? [0, 0, 0] : [Math.PI, 0, 0];
    }
    const tilt = part.tilt || [0, 0, 0];
    rot = [rot[0] + tilt[0], rot[1] + tilt[1], rot[2] + tilt[2]];
    return { at, rot, normal };
  }
  function paintFlag(h, b) {
    const tt = h.twoTone || 'none', st = h.stripe || 'none', sp = (h.stripePos || 0) * b.len / 2 + b.cz, sw = h.stripeW || 0.25;
    return c => {
      let tone = 0, stripe = 0;
      if (tt === 'bottom' && c[1] < b.cy - 0.04) tone = 1;
      if (tt === 'top' && c[1] > b.cy + 0.04) tone = 1;
      if (tt === 'nose' && c[2] > b.cz + b.len * 0.18) tone = 1;
      if (tt === 'rear' && c[2] < b.cz - b.len * 0.18) tone = 1;
      if (st === 'band' && Math.abs(c[2] - sp) < sw) stripe = 1;
      if (st === 'diagonal' && ((c[0] + c[2] * 0.9 + 100) % 1.3) < 0.55) stripe = 1;
      if (st === 'spine' && Math.abs(c[0]) < sw && c[1] > b.cy) stripe = 1;
      if (st === 'chevron' && (((Math.abs(c[0]) * 1.6 + (c[2] - sp) * 2.4 + 100) % 0.9) < 0.42)) stripe = 1;
      if (st === 'checker' && ((Math.floor((c[2] - sp) / 0.45) + Math.floor((c[1] - b.cy) / 0.35) + 200) % 2 === 0)) stripe = 1;
      return [tone, stripe];
    };
  }
  function buildHull(mb, h) {
    const b = hullBounds(h), flag = paintFlag(h, b);
    if (h.type === 'capsule') addPart(mb, 'capsule', { len: h.len, r: h.r, squash: h.squash, seg: h.seg, noseTaper: h.noseTaper }, { at: h.at, rot: h.rot, opts: { flag: c => flag(v3(c, h.at || [0, 0.7, 0])) } });
    else if (h.type === 'saucer') addPart(mb, 'saucer', { R: h.R, h: h.h, seg: h.seg }, { at: h.at, rot: [0, -Math.PI / 2, 0], opts: { flag: c => flag([c[0], (h.at?.[1] || 0) + c[2], c[1] + (h.at?.[2] || 0)]) } });
    else addPart(mb, 'box', { len: h.len, w: h.w, h: h.h, bevel: h.bevel, front: h.front, rear: h.rear }, { at: h.at, rot: h.rot, opts: { flag: c => flag(v3(c, h.at || [0, 0.7, 0])) } });
    return b;
  }

  // ---------------------------------------------------------------- greebles
  function greebles(mb, g, b, rnd, hull) {
    const top = b.top, half = b.halfW, L = b.len, cz = b.cz;
    const zr = () => cz + (rnd() - 0.5) * L * 0.8;
    for (let k = 0; k < (g.antennae || 0); k++) {
      const side = rnd() < 0.5 ? -1 : 1, z = zr();
      const x = b.ring ? side * half * (0.3 + rnd() * 0.5) : side * half * rnd() * 0.5;
      addPart(mb, 'antenna', { len: 0.35 + rnd() * 0.7 }, { at: [x, top - 0.02, z], rot: [(rnd() - 0.5) * 0.6, -Math.PI / 2 + (rnd() - 0.5) * 0.7, 0] });
    }
    const sx = (y, z) => b.surfX ? b.surfX(y, z) : half;
    for (let r = 0; r < (g.rivets || 0); r++) {
      const y = b.cy + (top - b.cy) * (0.45 - r * 0.3), n = Math.floor(L / 0.32);
      for (let side of [-1, 1]) for (let k = 0; k < n; k++) {
        const z = cz - L * 0.42 + k * 0.32, x = sx(y, z);
        if (x < 0.05) continue;
        addPart(mb, 'rivet', {}, { at: [side * x, y, z], rot: [side * Math.PI / 2, 0, 0] });
      }
    }
    for (let k = 0; k < (g.vents || 0); k++) {
      const side = rnd() < 0.5 ? -1 : 1, z = zr(), y = b.cy + (rnd() - 0.3) * (top - b.cy) * 0.6, x = sx(y, z);
      if (x < 0.1) continue;
      addPart(mb, 'vent', { w: 0.25 + rnd() * 0.2, n: 2 + Math.floor(rnd() * 3) }, { at: [side * x, y, z], rot: [side * Math.PI / 2, 0, 0] });
    }
    for (let k = 0; k < (g.hatches || 0); k++) {
      const onTop = rnd() < 0.5, side = rnd() < 0.5 ? -1 : 1, z = zr();
      if (onTop) { const xt = (rnd() - 0.5) * half * 0.5, yt = b.ring ? b.cy + (top - b.cy) * 0.6 : top - (hull.type === 'capsule' ? (top - b.cy) * (1 - Math.sqrt(Math.max(0, 1 - (xt / half) ** 2))) : 0); addPart(mb, 'hatch', { w: 0.3 + rnd() * 0.3, h: 0.25 + rnd() * 0.25 }, { at: [xt, yt, z], rot: [0, -Math.PI / 2, 0] }); }
      else { const y = b.cy + (rnd() - 0.5) * (top - b.cy) * 0.5, x = sx(y, z); if (x > 0.1) addPart(mb, 'hatch', { w: 0.35 + rnd() * 0.3, h: 0.2 + rnd() * 0.2 }, { at: [side * x, y, z], rot: [side * Math.PI / 2, 0, 0] }); }
    }
  }

  // ---------------------------------------------------------------- build
  // An archetype family { family, role, asym, archetypes: [{ name, make(j) }] } becomes one concrete recipe: the seed picks the
  // archetype and jitters it inside its authored ranges. Concrete recipes pass through unchanged.
  function resolve(recipe, seed = 1) {
    if (!recipe || !recipe.archetypes) return recipe;
    const rnd = mulberry32(((seed + 7) * 2246822519) >>> 0);
    const arch = recipe.archetypes[Math.floor(rnd() * recipe.archetypes.length)];
    const j = (a, b) => a + (b - a) * rnd();
    const out = arch.make(j);
    out.family = recipe.family; out.role = recipe.role || out.role; out.asym = recipe.asym ?? out.asym; out.archetype = arch.name;
    return out;
  }
  const ASYM_TYPES = new Set(['wing', 'fin', 'bell', 'tank', 'sphere', 'capsule', 'box', 'intake', 'mast', 'nacelle', 'cargoPod', 'turret', 'sail', 'tentacle', 'thrusterCluster', 'rotor']);
  const SECONDARY = new Set(['capsule', 'box', 'sphere', 'tank', 'bell', 'intake', 'wing', 'fin', 'mast', 'grille', 'cockpitFrame', 'dome', 'plate', 'cargoPod', 'nacelle', 'cageFrame', 'torus', 'ramProw', 'sail', 'tentacle', 'turret', 'rotor', 'radar', 'thrusterCluster', 'bubble', 'armourPlate']);
  const ENGINES = new Set(['bell', 'thrusterCluster']);
  const COCKPITS = new Set(['dome', 'cockpitFrame', 'bubble', 'visor']);
  function partSize(part) { // rough largest dimension of a part spec, for the 40 percent rule
    const sc = Array.isArray(part.scale) ? Math.max(...part.scale) : (part.scale || 1);
    const t = part.type; let d = 1;
    if (t === 'capsule' || t === 'box' || t === 'strut' || t === 'intake' || t === 'bell' || t === 'skid') d = part.len || 1;
    else if (t === 'wing') d = (part.span || 1.5) + (part.chord || 1.3) * 0.5;
    else if (t === 'fin') d = Math.max(part.h || 0.7, part.chord || 0.8);
    else if (t === 'mast') d = part.h || 1.2;
    else if (t === 'sphere' || t === 'tank') d = (part.r || 0.8) * 2;
    else if (t === 'dome') d = (part.r || 0.5) * 2;
    else if (t === 'grille' || t === 'cockpitFrame' || t === 'plate' || t === 'armourPlate') d = part.w || 1;
    else if (t === 'cargoPod' || t === 'nacelle' || t === 'cageFrame' || t === 'ramProw') d = part.len || 1.4;
    else if (t === 'torus') d = (part.R || 1.6) * 2;
    else if (t === 'sail') d = part.h || 1.4;
    else if (t === 'tentacle') d = part.len || 1.6;
    else if (t === 'turret') d = (part.r || 0.3) * 3;
    else if (t === 'rotor') d = (part.R || 0.9) * 2;
    else if (t === 'radar') d = (part.h || 0.45) + (part.dish || 0.45) * 2;
    else if (t === 'thrusterCluster') d = (part.r || 0.18) * 4;
    else if (t === 'bubble') d = part.len || 1.1;
    return d * sc;
  }
  // Grounding rules, applied to a concrete recipe before building. Returns a new recipe plus a list of fixes made.
  function ground(recipe) {
    const r = JSON.parse(JSON.stringify(recipe));
    const fixes = [];
    const b = hullBounds(r.hull);
    const asymBudget = r.asym ?? 0;
    let asymUsed = 0;
    for (const part of r.parts) {
      if (!part.socket && !part.at) { part.socket = 'flank'; part.u = 0; part.v = 0.2; fixes.push('socketed ' + part.type); }
      // Secondary parts no bigger than 40 percent of the hull (wings may reach 65 percent of the hull length in span).
      if (SECONDARY.has(part.type) && !part.structural) {
        const roleCap = r.role === 'junker' ? 0.8 : r.role === 'hauler' ? 0.6 : 0.4;
        const cap = (part.type === 'wing' ? 0.65 : part.type === 'dome' ? 0.6 : roleCap) * b.len;
        const size = partSize(part);
        if (size > cap) { const f = cap / size; part.scale = (Array.isArray(part.scale) ? part.scale.map(x => x * f) : (part.scale || 1) * f); fixes.push(`capped ${part.type} x${f.toFixed(2)}`); }
      }
      // Engines live at the tail on the centre line, pointing back; intakes forward of engines.
      if (ENGINES.has(part.type)) {
        if (part.socket !== 'tail' && part.socket !== 'wingtip') { part.socket = 'tail'; fixes.push(part.type + ' moved to tail'); }
        part.w = Math.max(-0.8, Math.min(0.8, part.w ?? 0));
        // A mirrored pair must clear the centre line by its own radius.
        const rr = (part.type === 'thrusterCluster' ? (part.r || 0.18) * 2.2 : (part.r || 0.35)) * (part.scale || 1), minW = rr * 1.08 / (b.halfW * 1.4);
        if (part.mirror && Math.abs(part.w) < minW) { part.w = Math.sign(part.w || 1) * minW; fixes.push('spread engines'); }
      }
      if (part.type === 'intake' && (part.u ?? 0) < -0.2) { part.u = 0.1; fixes.push('intake moved forward'); }
      // Asymmetry budget: extra one-sided major parts get mirrored.
      const lateral = part.socket === 'nose' || part.socket === 'tail' ? (part.w ?? 0) : (part.v ?? 0);
      if (ASYM_TYPES.has(part.type) && !part.mirror && lateral !== 0 && part.socket !== 'nose' && part.socket !== 'spine') {
        if (asymUsed < asymBudget) asymUsed++; else { part.mirror = true; fixes.push('mirrored ' + part.type); }
      }
    }
    // One dominant engine or matched pairs: an unmirrored pair on opposite sides counts as a pair.
    const bells = r.parts.filter(p => ENGINES.has(p.type));
    const single = bells.filter(p => !p.mirror);
    if (single.length > 1 && r.role !== 'junker') { for (const p of single.slice(1)) { if (Math.abs(p.w ?? 0) > 0.05) p.mirror = true; else p.w = 0; } fixes.push('paired engines'); }
    // Something under the belly.
    if (!r.parts.some(p => p.socket === 'belly' || (p.at && p.at[1] < b.bottom + 0.05))) {
      r.parts.push({ type: 'skid', socket: 'belly', u: -0.05, v: 0.55, out: 0.08, len: Math.min(2.8, b.len * 0.5), mirror: true });
      fixes.push('added skids');
    }
    // Cockpit forward and on top.
    const cockpit = r.parts.find(p => COCKPITS.has(p.type) || p.part === 4);
    if (!cockpit) { r.parts.push({ type: 'dome', socket: 'spine', u: 0.35, v: 0, r: Math.min(0.45, b.halfW * 0.6), squash: 0.7 }); fixes.push('added cockpit'); }
    else if (cockpit.socket === 'spine' && (cockpit.u ?? 0) < 0) { cockpit.u = 0.3; fixes.push('cockpit moved forward'); }
    return { recipe: r, fixes };
  }
  // Side silhouette fill ratio and aspect from the mesh, to reject blobs.
  function silhouette(mesh) {
    const W = 48, H = 24, grid = new Uint8Array(W * H);
    let zMin = 1e9, zMax = -1e9, yMin = 1e9, yMax = -1e9;
    for (let i = 0; i < mesh.verts.length; i += STRIDE) { const y = mesh.verts[i + 1], z = mesh.verts[i + 2]; if (y < yMin) yMin = y; if (y > yMax) yMax = y; if (z < zMin) zMin = z; if (z > zMax) zMax = z; }
    const sz = (zMax - zMin) || 1, sy = (yMax - yMin) || 1;
    const idx = mesh.idx, v = mesh.verts;
    for (let t = 0; t < idx.length; t += 3) {
      const P = [idx[t], idx[t + 1], idx[t + 2]].map(k => [(v[k * STRIDE + 2] - zMin) / sz * (W - 1), (v[k * STRIDE + 1] - yMin) / sy * (H - 1)]);
      const x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const e = (a, b, c) => (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);
        const q = [x + 0.5, y + 0.5], w0 = e(P[1], P[2], q), w1 = e(P[2], P[0], q), w2 = e(P[0], P[1], q);
        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) grid[y * W + x] = 1;
      }
    }
    let fill = 0; for (let i = 0; i < grid.length; i++) fill += grid[i];
    return { fill: fill / (W * H), aspect: sz / sy };
  }
  function validate(recipe, mesh, b) {
    const problems = [];
    // Engines must not overlap.
    const bells = [];
    for (const p of recipe.parts) if (ENGINES.has(p.type) && p._at) { const rr = (p.type === 'thrusterCluster' ? (p.r || 0.18) * 2.2 : (p.r || 0.35)) * (p.scale || 1); bells.push({ at: p._at, r: rr }); if (p.mirror) bells.push({ at: [-p._at[0], p._at[1], p._at[2]], r: rr }); }
    for (let i = 0; i < bells.length; i++) for (let j = i + 1; j < bells.length; j++) if (len(sub(bells[i].at, bells[j].at)) < (bells[i].r + bells[j].r) * 0.9) problems.push('engines overlap');
    // Parts must stay inside the hull envelope times a factor (span parts get more room).
    for (const p of recipe.parts) {
      if (!p._at) continue;
      const lim = p.type === 'wing' ? 2.2 : 1.6;
      if (Math.abs(p._at[2] - b.cz) > b.len / 2 * lim || Math.abs(p._at[0]) > b.halfW * 4 + 1.5 || p._at[1] > b.top + b.len * 0.5 || p._at[1] < b.bottom - 1.0) problems.push(p.type + ' outside envelope');
    }
    const sil = silhouette(mesh);
    if (!recipe.blobOk && (sil.fill > 0.86 || sil.aspect < 1.25)) problems.push(`blob silhouette fill ${sil.fill.toFixed(2)} aspect ${sil.aspect.toFixed(2)}`);
    return { problems, sil };
  }

  function build(recipe0, seed = 1) {
    const concrete = resolve(recipe0, seed);
    let rejections = 0, last = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const m = buildOnce(concrete, seed + attempt * 101, attempt);
      last = m;
      if (!m.problems.length) break;
      rejections++;
    }
    last.rejections = rejections;
    return last;
  }
  function buildOnce(recipe0, seed, attempt) {
    const rnd = mulberry32((seed * 2654435761) >>> 0);
    const { recipe, fixes } = ground(recipe0);
    if (attempt > 0) { // retry: nudge socketed part positions and greeble seed
      for (const p of recipe.parts) if (p.socket && p.type !== 'bell') { p.u = Math.max(-1, Math.min(1, (p.u ?? 0) + (rnd() - 0.5) * 0.25)); }
    }
    const mb = new MB();
    const b = buildHull(mb, recipe.hull);
    // Engines on the tail: separate overlapping exhausts by shrinking then spreading before anything is built.
    const eng = recipe.parts.filter(p => ENGINES.has(p.type) && p.socket === 'tail');
    const eRad = p => (p.type === 'thrusterCluster' ? (p.r || 0.18) * 2.2 : (p.r || 0.35)) * (p.scale || 1);
    for (let iter = 0; iter < 9; iter++) {
      const pts = [];
      for (const p of eng) { const at = resolveSocket(b, recipe.hull, p, null).at; pts.push({ p, at, r: eRad(p), m: 1 }); if (p.mirror) pts.push({ p, at: [-at[0], at[1], at[2]], r: eRad(p), m: -1 }); }
      let moved = false;
      for (let i = 0; i < pts.length; i++) for (let k = i + 1; k < pts.length; k++) {
        const A = pts[i], B = pts[k], d = len(sub(A.at, B.at)), need = (A.r + B.r) * 0.95;
        if (d >= need) continue;
        moved = true;
        if (A.p === B.p) { A.p.w = Math.sign(A.p.w || 1) * Math.min(0.9, Math.abs(A.p.w || 0) + (need - d) / (2 * b.halfW * 1.4) + 0.02); continue; }
        const small = A.r <= B.r ? A.p : B.p, big = small === A.p ? B.p : A.p;
        if ((small.r || 0.3) * (small.scale || 1) > 0.11) small.r = (small.r || 0.3) * 0.82;
        else if ((big.r || 0.3) * (big.scale || 1) > 0.11) big.r = (big.r || 0.3) * 0.82;
        else { const sgn = Math.sign((small.w ?? 0) - (big.w ?? 0)) || (small === A.p ? 1 : -1); small.w = Math.max(-0.9, Math.min(0.9, (small.w ?? 0) + sgn * ((need - d) / (b.halfW * 1.4) + 0.03))); }
      }
      if (!moved) break;
    }
    let wingTip = null;
    for (const part of recipe.parts) {
      let { type, mirror, at, rot, scale, tone, stripe, part: pid, socket, u, v, w, out, tilt, _at, ...spec } = part;
      if (socket) { const rs = resolveSocket(b, recipe.hull, part, wingTip); at = rs.at; rot = rs.rot; }
      part._at = at;
      if (type === 'wing' && !wingTip) { const sc = scale || 1; wingTip = [at[0] + (spec.span || 1.5) * sc, at[1], at[2] - (spec.sweep || 0.7) * sc]; }
      addPart(mb, type, spec, { at, rot, scale, tone, stripe, part: pid, mirror: mirror ?? false });
    }
    if (recipe.greebles) greebles(mb, recipe.greebles, b, rnd, recipe.hull);
    if (recipe.lights !== false) {
      addPart(mb, 'light', { w: b.halfW * 0.6, h: 0.08 }, { at: [0, b.cy + (b.top - b.cy) * 0.2, b.cz + b.len / 2 * (recipe.hull.type === 'saucer' ? 0.95 : 0.97)] });
      addPart(mb, 'light', { w: b.halfW * 0.9, h: 0.07, red: 1 }, { at: [0, b.top - 0.1, b.cz - b.len / 2 * 0.98] });
    }
    // Wear hint: uv.y from 0 at the top to 1 at the bottom of the whole craft.
    let yMin = Infinity, yMax = -Infinity;
    for (let i = 1; i < mb.v.length; i += STRIDE) { yMin = Math.min(yMin, mb.v[i]); yMax = Math.max(yMax, mb.v[i]); }
    for (let i = 0; i < mb.v.length; i += STRIDE) mb.v[i + 7] = (yMax - mb.v[i + 1]) / Math.max(1e-3, yMax - yMin);
    const mesh = mb.finish();
    mesh.tris = mesh.idx.length / 3; mesh.bounds = { yMin, yMax };
    const vr = validate(recipe, mesh, b);
    mesh.problems = vr.problems; mesh.silhouette = vr.sil; mesh.fixes = fixes; mesh.recipe = recipe;
    return mesh;
  }

  // Tweakable recipe values for a designer UI: path, label, min, max, step.
  const SCHEMA = [
    ['hull.len', 'hull length', 2, 8, 0.1], ['hull.r', 'hull radius', 0.25, 1.2, 0.01], ['hull.w', 'hull width', 0.8, 3, 0.05], ['hull.h', 'hull height', 0.3, 1.6, 0.05], ['hull.R', 'saucer radius', 1, 3.5, 0.05],
    ['hull.squash', 'hull squash', 0.4, 1.2, 0.01], ['hull.noseTaper', 'nose taper', 0.2, 1, 0.01], ['hull.bevel', 'bevel', 0, 0.4, 0.01],
    ['hull.stripePos', 'stripe position', -1, 1, 0.01], ['hull.stripeW', 'stripe width', 0.05, 1, 0.01],
    ['greebles.antennae', 'antennae', 0, 10, 1], ['greebles.rivets', 'rivet rows', 0, 3, 1], ['greebles.vents', 'vents', 0, 10, 1], ['greebles.hatches', 'hatches', 0, 8, 1],
  ];
  // Hull volume and part measures for the stats module.
  function measure(recipe0, seed = 1) {
    const r = ground(resolve(recipe0, seed)).recipe, h = r.hull;
    const hullVol = h.type === 'capsule' ? Math.PI * h.r * h.r * (h.squash || 0.8) * h.len : h.type === 'saucer' ? Math.PI * h.R * h.R * h.h * 0.55 : h.len * h.w * h.h;
    const thick = h.type === 'capsule' ? h.r * (h.squash || 0.8) / h.len : h.type === 'saucer' ? h.h / (h.R * 2) : h.h / h.len;
    let partVol = 0, thrust = 0, liftArea = 0, plates = 0, engines = 0, turrets = 0, sails = 0, limbs = 0;
    for (const p of r.parts) {
      const sc = Array.isArray(p.scale) ? p.scale[0] : (p.scale || 1), n = p.mirror ? 2 : 1;
      if (p.type === 'bell') { thrust += n * Math.pow((p.r || 0.35) * sc, 2) * ((p.len || 0.9) * sc); engines += n; }
      else if (p.type === 'wing') liftArea += n * (p.span || 1.5) * (p.chord || 1.3) * (1 + (p.taper ?? 0.5)) / 2 * sc * sc;
      else if (p.type === 'fin') liftArea += n * 0.5 * (p.h || 0.7) * (p.chord || 0.8) * sc * sc;
      else if (p.type === 'tank' || p.type === 'sphere') partVol += n * 4.19 * Math.pow((p.r || 0.8) * sc, 3);
      else if (p.type === 'capsule') partVol += n * Math.PI * Math.pow((p.r || 0.4) * sc, 2) * (p.len || 3) * sc;
      else if (p.type === 'box') partVol += n * (p.len || 1) * (p.w || 1) * (p.h || 0.6) * sc * sc * sc;
      else if (p.type === 'plate' || p.type === 'grille') plates += n;
      else if (p.type === 'armourPlate') plates += n * 2;
      else if (p.type === 'thrusterCluster') { thrust += n * (p.n || 4) * Math.pow((p.r || 0.18) * sc, 2) * ((p.len || 0.6) * sc) * 1.4; engines += n; }
      else if (p.type === 'nacelle') { thrust += n * Math.pow((p.r || 0.3) * sc, 2) * ((p.len || 1.4) * sc) * 0.6; partVol += n * Math.PI * Math.pow((p.r || 0.3) * sc, 2) * (p.len || 1.4) * sc; engines += n; }
      else if (p.type === 'cargoPod') partVol += n * Math.pow((p.r || 0.35) * 2 * sc, 2) * (p.len || 1.6) * sc;
      else if (p.type === 'torus') partVol += n * 2 * Math.PI * Math.PI * (p.R || 1.6) * Math.pow((p.r || 0.18) * sc, 2);
      else if (p.type === 'cageFrame') partVol += n * 0.15 * (p.len || 1.4) * sc;
      else if (p.type === 'turret') { turrets += n; partVol += n * 0.2 * sc; }
      else if (p.type === 'sail') { sails += n; liftArea += n * 0.3 * (p.h || 1.4) * (p.base || 0.9) * sc * sc; }
      else if (p.type === 'tentacle') limbs += n;
      else if (p.type === 'rotor') liftArea += n * 0.4 * Math.pow((p.R || 0.9) * sc, 2);
    }
    return { hullVol, partVol, thick, thrust, liftArea, plates, engines, turrets, sails, limbs, len: h.type === 'saucer' ? h.R * 2 : h.len, recipe: r };
  }
  return { build, resolve, ground, measure, addPart, P, MB, SCHEMA, hullBounds, SOCKETS, AXIS, loft, circle, roundRect, bar, boxAt, mulberry32 };
})();
