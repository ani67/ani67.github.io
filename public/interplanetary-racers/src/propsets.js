// Per-biome prop sets: mesh kinds plus placement rules, layered on top of Flora.
// Colour slots are the flora part ids the prop shader already knows:
//   0 trunk/dark (flora0)   1 canopy A/B mix (flora1, flora2)   2 rock (flora3 = rockF)   3 emissive palette (flowerHue)
//   5 building (palette light tones + window lights)   6 grass (canopy mix, brighter)   7 cloud (white, bobs)   8 reed (trunk colour)
// Big rigid pieces use parts 2 and 5 only: the prop vertex shader sways other parts with height squared.
// Each planet lists biome.propsets = ['space', ...]; Flora.buildScene calls Propsets.build.
const Propsets = (() => {
  const { TAU, clamp, mix, smoothstep, mulberry32, fbm, norm, cross, sub, add, scale } = M;
  let P, reg, cone, cyl, blob, box, blade, hashf, ex, ready = false;
  function init() {
    if (ready) return true;
    if (typeof Flora === 'undefined') return false;
    P = Flora.prim; reg = Flora.register; ({ cone, cyl, blob, box, blade, hashf, ex } = P);
    defineKinds(); ready = true; return true;
  }

  // ---- mesh helpers ---------------------------------------------------------
  // Rotate every vertex added after `from` about the origin (radians, applied as X then Z then Y).
  function rotFrom(b, from, ax = 0, az = 0, ay = 0, off = [0, 0, 0]) {
    const cx = Math.cos(ax), sx = Math.sin(ax), cz = Math.cos(az), sz = Math.sin(az), cy = Math.cos(ay), sy = Math.sin(ay);
    for (let i = from * 12; i < b.v.length; i += 12) {
      for (const o of [0, 3]) { // position, normal
        let x = b.v[i + o], y = b.v[i + o + 1], z = b.v[i + o + 2];
        let y1 = cx * y - sx * z, z1 = sx * y + cx * z; y = y1; z = z1;
        let x1 = cz * x - sz * y; y1 = sz * x + cz * y; x = x1; y = y1;
        x1 = cy * x + sy * z; z1 = -sy * x + cy * z; x = x1; z = z1;
        if (o === 0) { x += off[0]; y += off[1]; z += off[2]; }
        b.v[i + o] = x; b.v[i + o + 1] = y; b.v[i + o + 2] = z;
      }
    }
  }
  const vcount = b => b.v.length / 12;
  // Horizontal pipe along X.
  function pipeX(b, c, r, len, seg, part) { const f = vcount(b); cyl(b, [0, -len / 2, 0], r, r, len, seg, part); rotFrom(b, f, 0, Math.PI / 2, 0, c); }
  // Torus in the XZ plane (or vertical when up = true), centre c.
  function torus(b, c, R, r, seg, sides, part, up = false) {
    const f = vcount(b);
    const pt = (k, j) => { const a = k / seg * TAU, bb = j / sides * TAU; return [Math.cos(a) * (R + Math.cos(bb) * r), Math.sin(bb) * r, Math.sin(a) * (R + Math.cos(bb) * r)]; };
    for (let k = 0; k < seg; k++) for (let j = 0; j < sides; j++) b.quad(pt(k, j), pt(k + 1, j), pt(k + 1, j + 1), pt(k, j + 1), ex(part));
    rotFrom(b, f, up ? Math.PI / 2 : 0, 0, 0, c);
  }
  // Flat-topped jittered mesa: side ring quads plus a cap.
  function mesa(b, c, r0, r1, h, seg, part, jit = 0.25, seedOff = 0) {
    const ring = (y, r) => { const out = []; for (let k = 0; k < seg; k++) { const a = k / seg * TAU, j = 1 + (hashf(k + seedOff, y * 7.1, 2.2) - 0.5) * jit; out.push([c[0] + Math.cos(a) * r * j, c[1] + y, c[2] + Math.sin(a) * r * j]); } return out; };
    const levels = 4, rings = [];
    for (let l = 0; l <= levels; l++) rings.push(ring(h * l / levels, mix(r0, r1, l / levels) * (1 + 0.12 * Math.sin(l * 2.3 + seedOff))));
    for (let l = 0; l < levels; l++) for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg; b.quad(rings[l][k], rings[l][k2], rings[l + 1][k2], rings[l + 1][k], ex(part)); }
    const top = rings[levels], cen = [c[0], c[1] + h, c[2]];
    for (let k = 0; k < seg; k++) b.tri(cen, top[(k + 1) % seg], top[k], ex(part));
  }
  // Banded sphere: alternating colour parts by latitude (gas giant).
  function bandedSphere(b, r, seg, rings, partA, partB) {
    const pt = (i, k) => { const th = i / rings * Math.PI, ph = k / seg * TAU; return [Math.sin(th) * Math.cos(ph) * r, Math.cos(th) * r, Math.sin(th) * Math.sin(ph) * r]; };
    for (let i = 0; i < rings; i++) for (let k = 0; k < seg; k++) {
      const part = (Math.floor(i * 1.7 + (i % 3)) % 2) ? partA : partB;
      const a = pt(i, k), bq = pt(i + 1, k), cq = pt(i + 1, k + 1), d = pt(i, k + 1);
      if (i === 0) b.tri(a, bq, cq, ex(part)); else if (i === rings - 1) b.tri(a, bq, d, ex(part)); else b.quad(a, bq, cq, d, ex(part));
    }
  }
  // Floating island: grass disc on top, jittered rock underside tapering to a point, hanging roots.
  function island(b, seedOff) {
    const seg = 9, rTop = 1.0, levels = 4;
    const ring = (y, r) => { const out = []; for (let k = 0; k < seg; k++) { const a = k / seg * TAU, j = 1 + (hashf(k + seedOff, y * 5.3, 1.7) - 0.5) * 0.35; out.push([Math.cos(a) * r * j, y, Math.sin(a) * r * j]); } return out; };
    const rings = []; for (let l = 0; l <= levels; l++) rings.push(ring(0.9 - l * 0.9 / levels, rTop * (1 - l / levels) * (1 - 0.15 * l / levels)));
    for (let l = 0; l < levels; l++) for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg; if (l === levels - 1) b.tri(rings[l][k], rings[l][k2], [0, -0.05, 0], ex(2)); else b.quad(rings[l][k], rings[l][k2], rings[l + 1][k2], rings[l + 1][k], ex(2)); }
    const top = rings[0], cen = [0, 0.95, 0];
    for (let k = 0; k < seg; k++) { b.tri(cen, top[k], top[(k + 1) % seg], ex(6)); b.quad(top[k], top[(k + 1) % seg], [top[(k + 1) % seg][0], 0.9, top[(k + 1) % seg][2]], [top[k][0], 0.9, top[k][2]], ex(6)); }
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + seedOff, r = 0.25 + 0.4 * hashf(k, seedOff, 9); blade(b, [Math.cos(a) * r, 0.35, Math.sin(a) * r], [Math.cos(a) * r * 1.3, -0.35 - 0.3 * hashf(k, 2, seedOff), Math.sin(a) * r * 1.3], 0.05, 0.01, 0); }
    blob(b, [0.3, 1.05, -0.2], 0.22, 6, 3, 0.3, 1, 0.8, -9, seedOff); blob(b, [-0.35, 1.0, 0.25], 0.18, 6, 3, 0.3, 1, 0.8, -9, seedOff + 3);
  }

  // ---- kinds ----------------------------------------------------------------
  const K = {};
  const def = (name, build, size, opts = {}) => { K[name] = reg(name, { build, size, r: opts.r === undefined ? 0.5 : opts.r, h: opts.h === undefined ? 1 : opts.h, soft: !!opts.soft, collide: opts.collide !== false }); };
  function defineKinds() {

  // Space
  def('sp_asteroid', b => blob(b, [0, 0.5, 0], 0.5, 8, 5, 0.7, 2, 0.85), 14, { r: 0.42, h: 1 });
  def('sp_asteroidBig', b => { blob(b, [0, 0.5, 0], 0.5, 12, 7, 0.45, 2, 0.9); blob(b, [0.35, 0.7, 0.2], 0.16, 5, 3, 0.3, 2, 1, -9, 4); blob(b, [-0.3, 0.35, -0.3], 0.13, 5, 3, 0.3, 2, 1, -9, 8); }, 90, { r: 0.45, h: 1 });
  def('sp_plate', b => { const f = vcount(b); box(b, [0, 0, 0], [1, 0.05, 0.7], 5); box(b, [0.2, 0.05, -0.1], [0.4, 0.06, 0.3], 5); rotFrom(b, f, 0.6, 0.3, 0, [0, 0.5, 0]); }, 10, { r: 0.4, h: 0.8 });
  def('sp_strut', b => { const f = vcount(b); box(b, [0, 0, 0], [0.08, 1.4, 0.08], 5); box(b, [0, 0.35, 0], [0.16, 0.05, 0.16], 5); rotFrom(b, f, 1.1, 0.4, 0, [0, 0.5, 0]); }, 16, { r: 0.2, h: 0.8 });
  def('sp_pipe', b => { pipeX(b, [0, 0.5, 0], 0.12, 1.6, 7, 5); torus(b, [0.5, 0.5, 0], 0.16, 0.03, 8, 4, 5, true); torus(b, [-0.5, 0.5, 0], 0.16, 0.03, 8, 4, 5, true); }, 12, { r: 0.5, h: 0.8 });
  def('sp_container', b => { box(b, [0, 0.3, 0], [1, 0.6, 0.6], 5); for (let k = -2; k <= 2; k++) box(b, [k * 0.2, 0.3, 0], [0.04, 0.64, 0.64], 0); }, 9, { r: 0.5, h: 0.6 });
  def('sp_satellite', b => { box(b, [0, 0.5, 0], [0.5, 0.4, 0.5], 5); box(b, [0.85, 0.5, 0], [1.1, 0.02, 0.35], 1); box(b, [-0.85, 0.5, 0], [1.1, 0.02, 0.35], 1); const f = vcount(b); blob(b, [0, 0, 0], 0.3, 8, 3, 0, 2, 0.35, 0.02); rotFrom(b, f, -1.2, 0, 0, [0, 0.85, 0.15]); box(b, [0, 0.9, -0.2], [0.03, 0.5, 0.03], 5); blob(b, [0, 1.15, -0.2], 0.05, 4, 2, 0, 3); }, 12, { r: 0.7, h: 1.2 });
  def('sp_station', b => { torus(b, [0, 0.5, 0], 1.0, 0.11, 24, 8, 5); blob(b, [0, 0.5, 0], 0.22, 8, 4, 0, 5, 1.4); for (let k = 0; k < 4; k++) { const f = vcount(b); box(b, [0, 0, 0], [0.05, 1.0, 0.05], 5); rotFrom(b, f, 0, Math.PI / 2, k / 4 * TAU, [Math.cos(k / 4 * TAU) * 0.5, 0.5, Math.sin(k / 4 * TAU) * 0.5]); } for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; blob(b, [Math.cos(a) * 1.0, 0.62, Math.sin(a) * 1.0], 0.035, 4, 2, 0, 3); } box(b, [0, 1.1, 0], [0.03, 0.8, 0.03], 5); }, 110, { r: 1.0, h: 1.2 });
  def('sp_wreck', b => {
    if (typeof Kitbash !== 'undefined' && Kitbash.wreck) { try { const m = Kitbash.wreck(7, 1); if (m && m.verts) { const base = vcount(b); for (let i = 0; i < m.verts.length; i += 12) { b.v.push(m.verts[i], m.verts[i + 1] + 0.5, m.verts[i + 2], m.verts[i + 3], m.verts[i + 4], m.verts[i + 5], m.verts[i + 6], m.verts[i + 7], 2, 10, 5, 0); } for (let i = 0; i < m.idx.length; i++) b.i.push(m.idx[i] + base); return; } } catch (e) {} }
    const f = vcount(b); cyl(b, [0, -0.7, 0], 0.35, 0.3, 1.4, 9, 5); rotFrom(b, f, 0, Math.PI / 2 + 0.2, 0, [0, 0.5, 0]);
    box(b, [0.6, 0.55, 0.1], [0.5, 0.35, 0.4], 5); box(b, [-0.75, 0.4, -0.2], [0.4, 0.5, 0.3], 5);
    for (let k = 0; k < 6; k++) { const f2 = vcount(b); box(b, [0, 0, 0], [0.04, 0.6, 0.04], 5); rotFrom(b, f2, hashf(k, 1, 1) * 2, hashf(k, 2, 2) * 2, 0, [0.7 - k * 0.3, 0.7 + 0.2 * hashf(k, 3, 3), 0.3 - 0.2 * hashf(k, 4, 4)]); }
    box(b, [0.2, 0.9, 0], [0.9, 0.03, 0.5], 1); blob(b, [-0.4, 0.75, 0.2], 0.06, 4, 2, 0, 3);
  }, 60, { r: 0.9, h: 1.0 });
  def('sp_gasgiant', b => bandedSphere(b, 0.5, 20, 12, 1, 2), 900, { collide: false, r: 0, h: 0 });
  def('sp_beacon', b => { box(b, [0, 0.35, 0], [0.06, 0.7, 0.06], 5); blob(b, [0, 0.8, 0], 0.13, 5, 3, 0, 3); }, 7, { r: 0.2, h: 0.9 });

  // Canyon
  def('cn_mesa', b => mesa(b, [0, 0, 0], 1.0, 0.72, 1, 10, 2, 0.3, 1), 70, { r: 0.85, h: 1 });
  def('cn_mesaWide', b => mesa(b, [0, 0, 0], 1.3, 1.05, 0.55, 12, 2, 0.35, 5), 110, { r: 1.1, h: 0.55 });
  def('cn_hoodoo', b => { cyl(b, [0, 0, 0], 0.3, 0.2, 0.5, 7, 2); cyl(b, [0.02, 0.5, 0], 0.22, 0.16, 0.35, 7, 2); blob(b, [0.03, 0.95, 0.02], 0.26, 7, 4, 0.3, 2, 0.75); }, 18, { r: 0.3, h: 1.2 });
  def('cn_arch', b => { mesa(b, [-0.7, 0, 0], 0.32, 0.26, 1, 7, 2, 0.25, 2); mesa(b, [0.7, 0, 0], 0.3, 0.24, 1, 7, 2, 0.25, 3); box(b, [0, 1.05, 0], [1.8, 0.28, 0.5], 2); blob(b, [0, 1.25, 0], 0.5, 8, 3, 0.35, 2, 0.4); }, 45, { r: 0.9, h: 1.3 });
  def('cn_balanced', b => { cyl(b, [0, 0, 0], 0.18, 0.12, 0.8, 7, 2); blob(b, [0.05, 1.1, 0], 0.45, 8, 4, 0.4, 2, 0.8); }, 20, { r: 0.4, h: 1.5 });
  def('cn_stone', b => blob(b, [0, 0.25, 0], 0.4, 6, 3, 0.45, 2, 0.6), 3, { r: 0.35, h: 0.5 });
  def('cn_shrub', b => { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; blade(b, [0, 0, 0], [Math.cos(a) * 0.4, 0.45 + 0.15 * hashf(k, 1, 2), Math.sin(a) * 0.4], 0.03, 0.01, 0); } }, 3.5, { soft: true, r: 0.2, h: 0.5 });
  def('cn_wall', b => mesa(b, [0, 0, 0], 1, 0.9, 1, 12, 2, 0.4, 9), 60, { r: 0.9, h: 1 });
  def('cn_spire', b => { mesa(b, [0, 0, 0], 0.5, 0.15, 1.6, 7, 2, 0.35, 4); }, 55, { r: 0.5, h: 1.6 });

  // Frozen
  def('ic_spire', b => { cone(b, [0, 0, 0], 0.45, 1.6, 6, 2); cone(b, [0.3, 0, 0.1], 0.25, 0.9, 5, 2); cone(b, [-0.25, 0, -0.2], 0.2, 0.7, 5, 2); }, 40, { r: 0.45, h: 1.6 });
  def('ic_slab', b => { const f = vcount(b); box(b, [0, 0, 0], [1.4, 0.25, 0.9], 2); rotFrom(b, f, 0.25, 0.4, 0, [0, 0.35, 0]); }, 30, { r: 0.7, h: 0.6 });
  def('ic_crevasse', b => { box(b, [-0.35, 0.08, 0], [0.5, 0.16, 2.2], 2); box(b, [0.35, 0.08, 0], [0.5, 0.16, 2.2], 2); box(b, [0, 0.02, 0], [0.22, 0.02, 2.2], 0); }, 35, { collide: false, r: 0, h: 0.2 });
  def('ic_wave', b => { const f = vcount(b); blob(b, [0, 0, 0], 0.6, 10, 5, 0.1, 2, 1, 0.1); rotFrom(b, f, 0, 0, 0, [0, 0.55, 0]); box(b, [0.3, 0.3, 0], [0.8, 0.5, 1.0], 2); }, 25, { r: 0.6, h: 0.9 });
  def('ic_drift', b => blob(b, [0, 0, 0], 0.6, 8, 3, 0.12, 1, 0.35, 0.02), 14, { collide: false, r: 0, h: 0.3 });
  def('ic_shard', b => { cone(b, [0, 0, 0], 0.14, 0.8, 5, 3); cone(b, [0.15, 0, 0.05], 0.09, 0.5, 5, 3); }, 6, { soft: true, r: 0.1, h: 0.8 });
  def('ic_ridge', b => mesa(b, [0, 0, 0], 0.9, 0.2, 1.4, 8, 2, 0.5, 11), 90, { r: 0.8, h: 1.4 });

  // City
  def('ct_tower', b => { box(b, [0, 0.6, 0], [0.5, 1.2, 0.5], 5); box(b, [0, 1.35, 0], [0.34, 0.3, 0.34], 5); box(b, [0.12, 1.62, 0.1], [0.05, 0.25, 0.05], 5); blob(b, [0.12, 1.77, 0.1], 0.03, 4, 2, 0, 3); }, 40, { r: 0.3, h: 1.6 });
  def('ct_towerTall', b => { box(b, [0, 0.9, 0], [0.4, 1.8, 0.4], 5); box(b, [0, 1.95, 0], [0.28, 0.3, 0.28], 5); cyl(b, [0, 2.1, 0], 0.05, 0.02, 0.5, 5, 5); blob(b, [0, 2.6, 0], 0.03, 4, 2, 0, 3); }, 48, { r: 0.25, h: 2.6 });
  def('ct_block', b => { box(b, [0, 0.3, 0], [1.2, 0.6, 0.9], 5); box(b, [0.25, 0.75, -0.15], [0.5, 0.3, 0.45], 5); box(b, [-0.3, 0.65, 0.2], [0.4, 0.1, 0.3], 5); }, 24, { r: 0.6, h: 0.9 });
  def('ct_bridge', b => { box(b, [0, 1.0, 0], [2.4, 0.08, 0.3], 5); box(b, [0, 1.08, 0.12], [2.4, 0.06, 0.03], 5); box(b, [0, 1.08, -0.12], [2.4, 0.06, 0.03], 5); }, 30, { collide: false, r: 0, h: 1.1 });
  def('ct_antenna', b => { box(b, [0, 0.6, 0], [0.05, 1.2, 0.05], 5); box(b, [0, 0.9, 0], [0.4, 0.02, 0.02], 5); box(b, [0, 0.5, 0], [0.25, 0.02, 0.02], 5); blob(b, [0, 1.25, 0], 0.04, 4, 2, 0, 3); }, 14, { r: 0.1, h: 1.3 });
  def('ct_billboard', b => { box(b, [0, 0.55, 0], [1.4, 0.7, 0.04], 3); box(b, [-0.5, 0.1, 0], [0.05, 0.2, 0.05], 5); box(b, [0.5, 0.1, 0], [0.05, 0.2, 0.05], 5); }, 10, { collide: false, r: 0, h: 0.9 });
  def('ct_road', b => box(b, [0, 0.02, 0], [1, 0.04, 6], 0), 8, { collide: false, r: 0, h: 0.05 });
  def('ct_pad', b => { cyl(b, [0, 0, 0], 0.9, 0.9, 0.08, 12, 2); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; blob(b, [Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8], 0.05, 4, 2, 0, 3); } box(b, [0, 0.05, 0], [0.5, 0.02, 0.5], 3); }, 22, { collide: false, r: 0, h: 0.1 });
  def('ct_spire', b => { cyl(b, [0, 0, 0], 0.3, 0.12, 2.4, 8, 5); cyl(b, [0, 2.4, 0], 0.12, 0.02, 0.6, 6, 5); torus(b, [0, 1.6, 0], 0.32, 0.03, 12, 5, 3); blob(b, [0, 3.0, 0], 0.04, 4, 2, 0, 3); }, 45, { r: 0.3, h: 3 });
  def('ct_lamp', b => { box(b, [0, 0.4, 0], [0.04, 0.8, 0.04], 5); blob(b, [0.1, 0.8, 0], 0.06, 4, 2, 0, 3); }, 6, { soft: true, r: 0.05, h: 0.8 });

  // Weird
  def('wd_island', b => island(b, 1), 45, { r: 0.9, h: 1.2 });
  def('wd_islandSmall', b => island(b, 7), 18, { r: 0.9, h: 1.2 });
  def('wd_spireDown', b => { const f = vcount(b); cone(b, [0, 0, 0], 0.3, 1.4, 6, 2); rotFrom(b, f, Math.PI, 0, 0, [0, 1.4, 0]); }, 30, { r: 0.3, h: 1.4 });
  def('wd_crystal', b => { for (let k = 0; k < 5; k++) { const f = vcount(b); const a = k / 5 * TAU; cone(b, [0, 0, 0], 0.12 + 0.06 * hashf(k, 3, 1), 0.7 + 0.5 * hashf(k, 1, 1), 5, 3); rotFrom(b, f, 0.35 * hashf(k, 2, 2), 0, a, [Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25]); } }, 12, { r: 0.35, h: 1.1 });
  def('wd_mushroom', b => { cyl(b, [0, 0, 0], 0.16, 0.12, 1.0, 7, 0); blob(b, [0, 1.05, 0], 0.7, 9, 4, 0.12, 1, 0.45, 0.05); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; blob(b, [Math.cos(a) * 0.35, 1.2, Math.sin(a) * 0.35], 0.08, 4, 2, 0, 3); } }, 22, { r: 0.2, h: 1.3 });
  def('wd_monolith', b => torus(b, [0, 0.9, 0], 0.8, 0.12, 20, 7, 2, true), 35, { r: 0.2, h: 1.8 });
  def('wd_tendril', b => { let p = [0, 0, 0]; for (let k = 0; k < 6; k++) { const q = [p[0] + 0.12 * Math.sin(k * 1.3), p[1] + 0.3, p[2] + 0.1 * Math.cos(k * 0.9)]; blade(b, p, q, 0.08 - k * 0.01, 0.07 - k * 0.01, 0); p = q; } blob(b, p, 0.09, 5, 3, 0.2, 3); }, 16, { soft: true, r: 0.1, h: 1.8 });
  def('wd_bubble', b => blob(b, [0, 0.5, 0], 0.5, 8, 4, 0.05, 7), 10, { collide: false, r: 0, h: 1 });

  // Sky (Kestrel): platforms, turbines, lanterns
  def('sk_platform', b => { cyl(b, [0, 0, 0], 1.0, 0.85, 0.15, 10, 5); box(b, [0.3, 0.45, 0], [0.4, 0.6, 0.4], 5); box(b, [-0.4, 0.3, 0.2], [0.3, 0.3, 0.3], 5); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; blob(b, [Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.9], 0.05, 4, 2, 0, 3); } cone(b, [0, -0.6, 0], 0.5, 0.6, 8, 2); }, 40, { r: 0.9, h: 0.8 });
  def('sk_turbine', b => { cyl(b, [0, 0, 0], 0.08, 0.05, 1.6, 6, 5); blob(b, [0, 1.6, 0.05], 0.1, 5, 3, 0, 5); for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; blade(b, [0, 1.6, 0.1], [Math.cos(a) * 0.7, 1.6 + Math.sin(a) * 0.7, 0.1], 0.06, 0.02, 1); } }, 22, { r: 0.1, h: 1.6 });
  def('sk_lantern', b => { blob(b, [0, 0.6, 0], 0.3, 7, 4, 0.05, 3, 1.2); box(b, [0, 0.15, 0], [0.12, 0.1, 0.12], 5); }, 8, { collide: false, r: 0, h: 1 });

  // Forest extras (densify existing planets)
  def('fx_stump', b => { cyl(b, [0, 0, 0], 0.3, 0.26, 0.4, 7, 0); blob(b, [0, 0.4, 0], 0.27, 7, 2, 0.1, 0, 0.2, 0.02); }, 2.5, { r: 0.3, h: 0.5 });
  def('fx_deadtree', b => { cyl(b, [0, 0, 0], 0.1, 0.05, 1.6, 6, 0); blade(b, [0, 1.0, 0], [0.5, 1.5, 0.2], 0.05, 0.01, 0); blade(b, [0, 1.3, 0], [-0.4, 1.7, -0.2], 0.04, 0.01, 0); blade(b, [0, 0.8, 0], [0.2, 1.1, -0.45], 0.04, 0.01, 0); }, 5, { r: 0.12, h: 1.7 });
  def('fx_ruin', b => { box(b, [-0.4, 0.3, 0], [0.12, 0.6, 1.0], 2); box(b, [0.2, 0.2, -0.4], [1.0, 0.4, 0.12], 2); box(b, [0.4, 0.12, 0.3], [0.3, 0.24, 0.3], 2); }, 7, { r: 0.5, h: 0.6 });
  def('fx_shrub', b => { blob(b, [0, 0.3, 0], 0.4, 6, 3, 0.3, 1, 0.75); blob(b, [0.3, 0.25, 0.15], 0.28, 5, 3, 0.3, 1, 0.75, -9, 4); }, 2.4, { soft: true, r: 0.3, h: 0.6 });
  def('fx_fern', b => { for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; blade(b, [0, 0.05, 0], [Math.cos(a) * 0.55, 0.35 + 0.1 * hashf(k, 1, 3), Math.sin(a) * 0.55], 0.08, 0.02, 1); } }, 2.2, { soft: true, r: 0.1, h: 0.4 });
  def('fx_fallen', b => { const f = vcount(b); cyl(b, [0, -0.9, 0], 0.13, 0.09, 1.8, 6, 0); rotFrom(b, f, 0, Math.PI / 2 - 0.15, 0.4, [0, 0.14, 0]); }, 5, { r: 0.5, h: 0.3 });
  }

  // ---- placement helpers ---------------------------------------------------
  function context(desc, tab, terrain) {
    const rnd = mulberry32((desc.seed ^ 0x3C6EF372) >>> 0);
    const ext = terrain && terrain.ext ? terrain.ext : tab.maxR * 1.8;
    const ground = terrain && terrain.heightAt && !desc.noTerrain ? (x, z) => terrain.heightAt(x, z) : null;
    const clear = Flora.laneClearance(desc, tab, terrain);
    const near = Flora.trackIndex(tab, ext);
    let avgY = 0; for (const s of tab.S) avgY += s.p[1] / tab.N;
    const out = {}, counts = {}, stats = { laneRejects: 0, placed: 0 };
    const clearCounted = (x, y, z, m) => { const ok = clear(x, y, z, m); if (!ok) stats.laneRejects++; return ok; };
    const push = (kind, x, y, z, s, sy, rot) => { (out[kind] = out[kind] || []).push(x, y, z, s, sy, s, rot, rnd()); counts[kind] = (counts[kind] || 0) + 1; stats.placed++; };
    const slopeAt = (x, z) => { if (!ground) return 0; const e = 3; return Math.hypot(ground(x + e, z) - ground(x - e, z), ground(x, z + e) - ground(x, z - e)) / (2 * e); };
    const size = (kind, jit = [0.7, 1.4]) => K[kind].size * mix(jit[0], jit[1], rnd());
    const R = desc.corridor && desc.corridor.radius ? desc.corridor.radius : 12;
    return { desc, tab, terrain, rnd, ext, ground, clear: clearCounted, near, avgY, out, counts, stats, push, slopeAt, size, R, wl: desc.waterLevel, maxR: tab.maxR };
  }
  const pick = (rnd, weights) => { let sum = 0; for (const k in weights) sum += weights[k]; let r = rnd() * sum; for (const k in weights) { r -= weights[k]; if (r <= 0) return k; } return Object.keys(weights)[0]; };

  // Ground scatter: n attempts in a band around the track, weighted kinds, slope and height limits, clumping.
  function scatter(c, o) {
    if (!c.ground) return;
    const n = Math.round(o.n * (o.mul || 1) * (c.desc.biome.propMul || 1));
    const rmin = (o.band ? o.band[0] : 0) * c.maxR, rmax = Math.min((o.band ? o.band[1] : 1.45) * c.maxR, c.ext - 6);
    for (let i = 0; i < n; i++) {
      const a = c.rnd() * TAU, r = Math.sqrt(mix(rmin * rmin, rmax * rmax, c.rnd()));
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) > c.ext - 6 || Math.abs(z) > c.ext - 6) continue;
      const h = c.ground(x, z);
      if (h < c.wl + (o.aboveWater === undefined ? 0.5 : o.aboveWater)) continue;
      if (o.hBand && (h < o.hBand[0] || h > o.hBand[1])) continue;
      const nr = c.near(x, z);
      if (o.maxLane && nr.dist > o.maxLane) continue;
      const slope = c.slopeAt(x, z);
      if (o.slopeMax !== undefined && slope > o.slopeMax) continue;
      if (o.slopeMin !== undefined && slope < o.slopeMin) continue;
      if (o.clump) { const cl = smoothstep(-0.3, 0.5, fbm(x * o.clump + 7.7, z * o.clump - 3.3)); if (c.rnd() > cl) continue; }
      if (o.nearBias) { const f = 1 - smoothstep(60, 260, nr.dist); if (c.rnd() > 0.45 + 0.55 * f) continue; }
      const kind = pick(c.rnd, o.kinds);
      const s = c.size(kind, o.jit), sy = s * mix(o.hy ? o.hy[0] : 0.85, o.hy ? o.hy[1] : 1.25, c.rnd());
      if (!c.clear(x, h + K[kind].h * sy * 0.5, z, (o.margin || 0) + K[kind].r * s + K[kind].h * sy * 0.5)) continue;
      c.push(kind, x, h - (o.sink || 0) * s, z, s, sy, o.alignLane && nr.s ? Math.atan2(nr.s.tan[0], nr.s.tan[2]) + (o.alignOff || 0) : c.rnd() * TAU);
    }
  }
  // Clusters near the lane: a centre, then members in a disc.
  function clusters(c, o) {
    for (let k = 0; k < o.n; k++) {
      const s = World.sampleAt(c.tab, c.rnd()), side = c.rnd() < 0.5 ? -1 : 1;
      const off = mix(o.laneDist[0], o.laneDist[1], c.rnd());
      const up = norm(cross(s.tan, s.right));
      const cx = s.p[0] + s.right[0] * side * off, cz = s.p[2] + s.right[2] * side * off;
      const cy = o.y === 'ground' && c.ground ? c.ground(cx, cz) : (o.y === 'lane' ? s.p[1] + (c.rnd() - 0.5) * (o.ySpread || 40) : (typeof o.y === 'number' ? c.avgY + o.y : s.p[1]));
      if (o.y === 'ground' && c.ground && cy < c.wl + 1) continue;
      const m = Math.round(mix(o.members[0], o.members[1], c.rnd()));
      let placed = 0;
      for (let j = 0; j < m * 3 && placed < m; j++) {
        const a = c.rnd() * TAU, r = Math.sqrt(c.rnd()) * o.radius;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        let y = cy;
        if (o.y === 'ground' && c.ground) { y = c.ground(x, z); if (y < c.wl + 0.5) continue; if (c.slopeAt(x, z) > (o.slopeMax || 0.6)) continue; }
        else y = cy + (c.rnd() - 0.5) * (o.ySpread || 0);
        const kind = pick(c.rnd, o.kinds), sz = c.size(kind, o.jit), sy = sz * mix(o.hy ? o.hy[0] : 0.85, o.hy ? o.hy[1] : 1.3, c.rnd());
        if (!c.clear(x, y + K[kind].h * sy * 0.5, z, (o.margin || 0) + K[kind].r * sz + K[kind].h * sy * 0.5)) continue;
        c.push(kind, x, y - (o.sink || 0) * sz, z, sz, sy, o.grid ? Math.round(c.rnd()) * Math.PI / 2 + o.gridRot : c.rnd() * TAU);
        placed++;
      }
    }
  }
  // Volume scatter around the lane (space debris, floating things): samples the lane, offsets radially in 3D.
  function volume(c, o) {
    const n = Math.round(o.n * (o.mul || 1));
    for (let i = 0; i < n; i++) {
      const s = World.sampleAt(c.tab, c.rnd());
      const up = norm(cross(s.tan, s.right));
      const a = c.rnd() * TAU, r = mix(o.rMin, o.rMax, Math.pow(c.rnd(), o.pow || 0.7));
      const along = (c.rnd() - 0.5) * (o.along || 40);
      let p = add(add(add(s.p, scale(s.right, Math.cos(a) * r)), scale(up, Math.sin(a) * r)), scale(s.tan, along));
      if (o.yClamp) p[1] = clamp(p[1], o.yClamp[0], o.yClamp[1]);
      if (c.ground) { const g = c.ground(p[0], p[2]); if (p[1] < g + (o.aboveGround || 6)) { if (o.dropToGround) p[1] = g; else continue; } }
      const kind = pick(c.rnd, o.kinds), sz = c.size(kind, o.jit), sy = sz * mix(o.hy ? o.hy[0] : 0.7, o.hy ? o.hy[1] : 1.3, c.rnd());
      if (!c.clear(p[0], p[1], p[2], (o.margin || 0) + Math.max(K[kind].r * sz, K[kind].h * sy * 0.5))) continue;
      c.push(kind, p[0], p[1] - sz * 0.5, p[2], sz, sy, c.rnd() * TAU);
    }
  }
  // Landmarks: few huge things in a ring beyond the track.
  function landmarks(c, o) {
    for (let k = 0; k < o.n; k++) {
      const a = (k + c.rnd() * 0.8) / o.n * TAU, r = c.maxR * mix(o.band[0], o.band[1], c.rnd());
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const kind = pick(c.rnd, o.kinds), sz = c.size(kind, o.jit);
      let y = c.ground ? c.ground(x, z) : c.avgY;
      if (typeof o.y === 'number') y = c.avgY + o.y;
      if (c.ground && y < c.wl - 2 && !o.allowWater) continue;
      const syL = sz * mix(o.hy ? o.hy[0] : 0.9, o.hy ? o.hy[1] : 1.3, c.rnd());
      if (!c.clear(x, y + K[kind].h * syL * 0.5, z, (o.margin || 0) + K[kind].r * sz)) continue;
      c.push(kind, x, y - (o.sink || 0) * sz, z, sz, syL, c.rnd() * TAU);
    }
  }
  // Pairs flanking the lane (canyon walls, gate pylons): every `every` metres, at ±(R + offset).
  function flank(c, o) {
    const { S, N } = c.tab;
    let acc = 0;
    for (let i = 0; i < N; i++) {
      const s = S[i], s2 = S[(i + 1) % N];
      acc += Math.hypot(s2.p[0] - s.p[0], s2.p[2] - s.p[2]);
      if (acc < o.every) continue; acc = 0;
      if (c.rnd() > (o.chance || 1)) continue;
      for (const side of [-1, 1]) {
        if (o.oneSide && side !== o.oneSide) continue;
        const kind = pick(c.rnd, o.kinds), sz = c.size(kind, o.jit), sy = sz * mix(o.hy ? o.hy[0] : 0.9, o.hy ? o.hy[1] : 1.4, c.rnd());
        const off = c.R + K[kind].r * sz + 4 + mix(o.offset[0], o.offset[1], c.rnd());
        const x = s.p[0] + s.right[0] * side * off, z = s.p[2] + s.right[2] * side * off;
        const y = c.ground ? c.ground(x, z) : s.p[1] + (o.yOff || 0);
        if (c.ground && y < c.wl + 0.5) continue;
        if (!c.clear(x, y + K[kind].h * sy * 0.5, z, K[kind].r * sz)) continue;
        c.push(kind, x, y - (o.sink || 0) * sz, z, sz, sy, Math.atan2(s.tan[0], s.tan[2]) + (o.rot || 0) + (c.rnd() - 0.5) * (o.rotJit || 0));
      }
    }
  }

  // ---- sets ------------------------------------------------------------------
  const SETS = {
    space(c) {
      const R = c.R;
      volume(c, { n: 4200, kinds: { sp_asteroid: 6, sp_plate: 1.2, sp_strut: 1, sp_pipe: 0.6, sp_container: 0.5 }, rMin: R + 14, rMax: R * 7 + 120, along: 60, jit: [0.35, 1.6], hy: [0.6, 1.4] });
      volume(c, { n: 900, kinds: { sp_asteroid: 1 }, rMin: R * 8, rMax: R * 22 + 300, along: 80, jit: [1.5, 4], hy: [0.7, 1.3] });
      volume(c, { n: 60, kinds: { sp_asteroidBig: 1 }, rMin: R * 4, rMax: R * 14 + 200, along: 120, jit: [0.6, 1.6], hy: [0.7, 1.2] });
      volume(c, { n: 70, kinds: { sp_satellite: 1, sp_beacon: 0.6 }, rMin: R + 16, rMax: R * 5 + 60, along: 60, jit: [0.8, 1.6] });
      volume(c, { n: 14, kinds: { sp_wreck: 1 }, rMin: R + 40, rMax: R * 4 + 80, along: 80, jit: [0.7, 1.4] });
      volume(c, { n: 5, kinds: { sp_station: 1 }, rMin: R * 2 + 60, rMax: R * 5 + 160, along: 150, jit: [0.8, 1.4], hy: [0.9, 1.1] });
      landmarks(c, { n: 1, kinds: { sp_gasgiant: 1 }, band: [2.6, 3.2], y: -260, jit: [0.9, 1.3], hy: [1, 1] });
      // Debris trail hugging the lane so there is always something passing by.
      volume(c, { n: 2600, kinds: { sp_plate: 2, sp_strut: 2, sp_pipe: 1, sp_container: 1, sp_asteroid: 2 }, rMin: R + 10, rMax: R * 2.2, along: 30, jit: [0.25, 0.8], hy: [0.6, 1.4], pow: 1 });
    },
    canyon(c) {
      scatter(c, { n: 1400, kinds: { cn_mesa: 2, cn_mesaWide: 1, cn_spire: 0.7 }, band: [0.15, 1.45], slopeMax: 0.7, margin: 20, hy: [0.6, 1.5], jit: [0.6, 1.5], sink: 0.02 });
      scatter(c, { n: 6000, kinds: { cn_hoodoo: 3, cn_balanced: 1, cn_arch: 0.5 }, band: [0.1, 1.45], slopeMax: 1.0, margin: 6, clump: 0.006, nearBias: 1, jit: [0.6, 1.5] });
      flank(c, { every: 70, offset: [0, 18], kinds: { cn_wall: 2, cn_spire: 1, cn_mesa: 1, cn_hoodoo: 1.5, cn_arch: 0.4 }, chance: 0.85, jit: [0.5, 1.2], hy: [0.7, 1.6], rotJit: 0.6 });
      scatter(c, { n: 30000, kinds: { cn_stone: 5, cn_shrub: 3 }, band: [0.05, 1.45], slopeMax: 1.6, clump: 0.012, nearBias: 1, jit: [0.5, 1.6] });
      scatter(c, { n: 1500, kinds: { cn_stone: 1 }, band: [0.05, 1.45], slopeMax: 0.8, jit: [3, 7], hy: [0.6, 1.0] });
    },
    frozen(c) {
      scatter(c, { n: 3000, kinds: { ic_spire: 3, ic_ridge: 0.6 }, band: [0.1, 1.45], slopeMax: 1.2, margin: 8, clump: 0.006, nearBias: 1, jit: [0.6, 1.5], hy: [0.7, 1.6] });
      scatter(c, { n: 3500, kinds: { ic_slab: 2, ic_wave: 1 }, band: [0.05, 1.45], slopeMax: 0.9, margin: 4, nearBias: 1, jit: [0.6, 1.4] });
      scatter(c, { n: 7000, kinds: { ic_drift: 1 }, band: [0.05, 1.45], slopeMax: 0.7, jit: [0.7, 1.8], hy: [0.6, 1.1] });
      scatter(c, { n: 2500, kinds: { ic_crevasse: 1 }, band: [0.05, 1.45], slopeMax: 0.4, jit: [0.7, 1.5], hy: [0.8, 1.2] });
      scatter(c, { n: 20000, kinds: { ic_shard: 1 }, band: [0.05, 1.45], slopeMax: 1.6, clump: 0.02, nearBias: 1, jit: [0.5, 1.5] });
      flank(c, { every: 60, offset: [0, 24], kinds: { ic_spire: 2, ic_ridge: 1, ic_wave: 1 }, chance: 0.8, jit: [0.8, 1.6], hy: [0.9, 1.8], rotJit: 1 });
    },
    city(c) {
      clusters(c, { n: 14, laneDist: [c.R + 40, c.R + 170], radius: 120, members: [70, 120], kinds: { ct_tower: 4, ct_towerTall: 1.2, ct_block: 3, ct_antenna: 0.8 }, y: 'ground', slopeMax: 0.35, margin: 6, jit: [0.7, 1.4], hy: [0.7, 1.6], grid: true, gridRot: 0.3 });
      clusters(c, { n: 9, laneDist: [c.R + 40, c.R + 170], radius: 130, members: [20, 40], kinds: { ct_road: 1 }, y: 'ground', slopeMax: 0.4, jit: [0.8, 1.4], hy: [1, 1], grid: true, gridRot: 0.3 });
      clusters(c, { n: 9, laneDist: [c.R + 40, c.R + 160], radius: 110, members: [8, 16], kinds: { ct_billboard: 2, ct_lamp: 3, ct_bridge: 0.6 }, y: 'ground', slopeMax: 0.4, jit: [0.7, 1.3] });
      scatter(c, { n: 16000, kinds: { ct_block: 2, ct_tower: 1, ct_lamp: 1.5, ct_antenna: 0.5 }, band: [0.05, 1.45], slopeMax: 0.45, clump: 0.004, nearBias: 1, jit: [0.6, 1.3], hy: [0.7, 1.5] });
      scatter(c, { n: 160, kinds: { ct_pad: 1 }, band: [0.1, 1.4], slopeMax: 0.3, margin: 10, jit: [0.8, 1.3], hy: [1, 1] });
      scatter(c, { n: 120, kinds: { ct_spire: 1 }, band: [0.2, 1.45], slopeMax: 0.4, margin: 15, jit: [0.9, 1.6], hy: [0.9, 1.5] });
      flank(c, { every: 90, offset: [10, 60], kinds: { ct_towerTall: 1, ct_tower: 1 }, chance: 0.6, jit: [0.8, 1.4], hy: [1.0, 1.8], rotJit: 0.4 });
    },
    weird(c) {
      volume(c, { n: 320, kinds: { wd_island: 3, wd_islandSmall: 4 }, rMin: c.R + 30, rMax: c.R * 3 + 260, along: 80, jit: [0.6, 1.6], hy: [0.8, 1.3], aboveGround: 25, margin: 6 });
      volume(c, { n: 120, kinds: { wd_bubble: 1 }, rMin: c.R + 12, rMax: c.R * 2 + 140, along: 60, jit: [0.5, 1.8], aboveGround: 10 });
      scatter(c, { n: 3500, kinds: { wd_crystal: 3, wd_monolith: 0.5, wd_tendril: 1.5 }, band: [0.05, 1.45], slopeMax: 1.0, clump: 0.008, nearBias: 1, jit: [0.6, 1.6], hy: [0.8, 1.5] });
      scatter(c, { n: 1400, kinds: { wd_mushroom: 1 }, band: [0.05, 1.45], slopeMax: 0.7, margin: 4, clump: 0.01, jit: [0.5, 1.6], hy: [0.8, 1.4] });
      scatter(c, { n: 6000, kinds: { wd_crystal: 1, fx_shrub: 1 }, band: [0.05, 1.45], slopeMax: 1.4, jit: [0.25, 0.7] });
      landmarks(c, { n: 6, kinds: { wd_monolith: 1 }, band: [1.15, 1.5], jit: [2.5, 4], hy: [0.9, 1.2] });
    },
    sky(c) {
      volume(c, { n: 260, kinds: { wd_island: 3, wd_islandSmall: 3 }, rMin: c.R + 40, rMax: c.R * 3 + 280, along: 90, jit: [0.7, 1.8], hy: [0.8, 1.3], margin: 8, aboveGround: 15 });
      volume(c, { n: 90, kinds: { sk_platform: 1 }, rMin: c.R + 30, rMax: c.R * 3 + 200, along: 100, jit: [0.7, 1.5], hy: [0.9, 1.2], margin: 8, aboveGround: 15 });
      volume(c, { n: 600, kinds: { sk_lantern: 1 }, rMin: c.R + 10, rMax: c.R * 2 + 120, along: 60, jit: [0.5, 1.5], aboveGround: 10 });
      scatter(c, { n: 3000, kinds: { sk_turbine: 1 }, band: [0.05, 1.45], slopeMax: 0.8, clump: 0.005, jit: [0.7, 1.5], hy: [0.9, 1.5] });
      scatter(c, { n: 5000, kinds: { cn_stone: 2, fx_shrub: 1, ic_shard: 0.5 }, band: [0.05, 1.45], slopeMax: 1.4, nearBias: 1, jit: [0.6, 1.5] });
    },
    forest(c) {
      scatter(c, { n: 12000, kinds: { fx_stump: 2, fx_deadtree: 1.2, fx_shrub: 4, fx_fern: 4, fx_fallen: 1 }, band: [0.05, 1.45], slopeMax: 1.2, clump: 0.01, nearBias: 1, jit: [0.6, 1.5] });
      scatter(c, { n: 250, kinds: { fx_ruin: 1 }, band: [0.1, 1.4], slopeMax: 0.6, margin: 4, jit: [1.5, 3.5] });
    },
    rocks(c) {
      scatter(c, { n: 9000, kinds: { cn_stone: 4, cn_hoodoo: 0.3, cn_balanced: 0.15 }, band: [0.05, 1.45], slopeMax: 1.4, clump: 0.01, nearBias: 1, jit: [0.6, 2] });
    },
    crystal(c) {
      scatter(c, { n: 2600, kinds: { wd_crystal: 4, wd_monolith: 0.4, wd_tendril: 0.8 }, band: [0.05, 1.45], slopeMax: 0.9, clump: 0.01, nearBias: 1, jit: [0.6, 1.8], hy: [0.8, 1.6] });
      scatter(c, { n: 4000, kinds: { wd_crystal: 1 }, band: [0.05, 1.45], slopeMax: 0.9, jit: [0.25, 0.7] });
      landmarks(c, { n: 8, kinds: { wd_monolith: 1 }, band: [1.1, 1.5], jit: [2.5, 4.5], hy: [0.9, 1.2] });
    },
    lava(c) {
      scatter(c, { n: 40000, kinds: { cn_stone: 3, cn_spire: 0.15, ic_shard: 0.5 }, band: [0.05, 1.45], slopeMax: 1.4, clump: 0.01, nearBias: 1, jit: [0.7, 2.2] });
      scatter(c, { n: 600, kinds: { cn_spire: 1, cn_mesa: 0.4 }, band: [0.15, 1.45], slopeMax: 0.9, margin: 12, jit: [0.4, 1.1], hy: [0.8, 1.6] });
    },
  };

  function build(desc, tab, terrain) {
    const names = desc.biome && desc.biome.propsets ? desc.biome.propsets : [];
    if (!names.length || !init()) return {};
    const c = context(desc, tab, terrain);
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    for (const n of names) if (SETS[n]) SETS[n](c);
    const res = {}; let total = 0;
    for (const k of Object.keys(c.out)) { res[k] = new Float32Array(c.out[k]); total += c.out[k].length / 8; }
    if (typeof console !== 'undefined') console.log(`propsets ${names.join('+')}: ${total} instances in ${((typeof performance !== 'undefined' ? performance : Date).now() - t0).toFixed(0)} ms, ${c.stats.laneRejects} rejected for lane clearance`, c.counts);
    build.last = { total, laneRejects: c.stats.laneRejects, counts: c.counts };
    return res;
  }
  return { build, init, SETS, KINDS: K, helpers: { scatter, clusters, volume, landmarks, flank, context } };
})();
