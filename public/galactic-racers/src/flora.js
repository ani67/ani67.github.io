// Flora, clouds, settlements and water: low-poly instanced vegetation and biome dressing.
// Meshes use the shared 12-float vertex layout with ex = [2 (prop material), 10 (flora), part, 0].
// Parts: 0 trunk, 1 canopy, 2 rock, 3 flower, 4 lily pad, 5 building, 6 grass, 7 cloud, 8 reed.
const Flora = (() => {
  const { TAU, clamp, mix, smoothstep, mulberry32, fbm, norm, cross, sub } = M;
  const STRIDE = 12;
  class MB {
    constructor() { this.v = []; this.i = []; }
    vert(p, n, uv, ex) { this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], ex[0], ex[1], ex[2], ex[3]); return this.v.length / STRIDE - 1; }
    // Flat-shaded triangle: its own three vertices with the face normal.
    tri(a, b, c, ex, flip) {
      let n = norm(cross(sub(b, a), sub(c, a)));
      if (flip) n = [-n[0], -n[1], -n[2]];
      const i0 = this.vert(a, n, [a[1], 0], ex), i1 = this.vert(b, n, [b[1], 0], ex), i2 = this.vert(c, n, [c[1], 0], ex);
      this.i.push(i0, i1, i2);
    }
    quad(a, b, c, d, ex) { this.tri(a, b, c, ex); this.tri(a, c, d, ex); }
    finish() { return { verts: new Float32Array(this.v), idx: new Uint32Array(this.i) }; }
  }
  const hashf = (a, b, c) => { const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return x - Math.floor(x); };
  const ex = part => [2, 10, part, 0];

  // ---- primitives (flat shaded)
  function cone(b, c, r, h, seg, part) {
    const apex = [c[0], c[1] + h, c[2]];
    for (let k = 0; k < seg; k++) {
      const a0 = k / seg * TAU, a1 = (k + 1) / seg * TAU;
      b.tri([c[0] + Math.cos(a0) * r, c[1], c[2] + Math.sin(a0) * r], apex, [c[0] + Math.cos(a1) * r, c[1], c[2] + Math.sin(a1) * r], ex(part));
    }
  }
  function cyl(b, c, r0, r1, h, seg, part, lean = [0, 0]) {
    for (let k = 0; k < seg; k++) {
      const a0 = k / seg * TAU, a1 = (k + 1) / seg * TAU;
      const p00 = [c[0] + Math.cos(a0) * r0, c[1], c[2] + Math.sin(a0) * r0], p01 = [c[0] + Math.cos(a1) * r0, c[1], c[2] + Math.sin(a1) * r0];
      const p10 = [c[0] + lean[0] + Math.cos(a0) * r1, c[1] + h, c[2] + lean[1] + Math.sin(a0) * r1], p11 = [c[0] + lean[0] + Math.cos(a1) * r1, c[1] + h, c[2] + lean[1] + Math.sin(a1) * r1];
      b.quad(p00, p10, p11, p01, ex(part));
    }
  }
  // Jittered low-poly sphere; sy squashes vertically; bottomClamp flattens the underside (clouds).
  function blob(b, c, r, seg, rings, jit, part, sy = 1, bottomClamp = -9, seedOff = 0) {
    const pt = (i, k) => {
      const th = i / rings * Math.PI, ph = k / seg * TAU;
      const j = 1 + (hashf(i + seedOff, k, 3.1) - 0.5) * jit;
      let y = Math.cos(th) * r * sy * j;
      if (bottomClamp > -9) y = Math.max(y, -r * sy * bottomClamp);
      return [c[0] + Math.sin(th) * Math.cos(ph) * r * j, c[1] + y, c[2] + Math.sin(th) * Math.sin(ph) * r * j];
    };
    for (let i = 0; i < rings; i++) for (let k = 0; k < seg; k++) {
      const a = pt(i, k), bq = pt(i + 1, k), cq = pt(i + 1, k + 1), d = pt(i, k + 1);
      if (i === 0) b.tri(a, bq, cq, ex(part)); else if (i === rings - 1) b.tri(a, bq, d, ex(part)); else b.quad(a, bq, cq, d, ex(part));
    }
  }
  function box(b, c, s, part) {
    const [x, y, z] = c, [w, h, d] = [s[0] / 2, s[1] / 2, s[2] / 2];
    const P = (sx, sy, sz) => [x + sx * w, y + sy * h, z + sz * d];
    b.quad(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), ex(part));
    b.quad(P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), ex(part));
    b.quad(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), ex(part));
    b.quad(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), ex(part));
    b.quad(P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), ex(part));
  }
  function blade(b, base, tip, w0, w1, part) { // tapered vertical-ish quad
    const dx = tip[0] - base[0], dz = tip[2] - base[2], l = Math.hypot(dx, dz) || 1, px = -dz / l, pz = dx / l;
    b.quad([base[0] - px * w0, base[1], base[2] - pz * w0], [base[0] + px * w0, base[1], base[2] + pz * w0], [tip[0] + px * w1, tip[1], tip[2] + pz * w1], [tip[0] - px * w1, tip[1], tip[2] - pz * w1], ex(part));
  }

  // ---- kinds
  const KINDS = {
    pine: { build(b) { cyl(b, [0, 0, 0], 0.12, 0.09, 1.0, 6, 0); cone(b, [0, 0.55, 0], 0.6, 0.95, 7, 1); cone(b, [0, 1.05, 0], 0.46, 0.85, 7, 1); cone(b, [0, 1.55, 0], 0.3, 0.75, 7, 1); }, size: 5, r: 0.15, h: 2.3 },
    round: { build(b) { cyl(b, [0, 0, 0], 0.12, 0.08, 1.3, 6, 0); blob(b, [0, 1.55, 0], 0.72, 7, 4, 0.22, 1); blob(b, [0.38, 1.3, 0.22], 0.48, 6, 3, 0.25, 1, 1, -9, 5); blob(b, [-0.34, 1.42, -0.28], 0.44, 6, 3, 0.25, 1, 1, -9, 9); }, size: 4.5, r: 0.14, h: 2.3 },
    palm: { build(b) {
      let y = 0, lx = 0, lz = 0;
      for (let k = 0; k < 5; k++) { cyl(b, [lx, y, lz], 0.11 - k * 0.012, 0.1 - k * 0.012, 0.5, 5, 0, [0.07, 0.03]); lx += 0.07; lz += 0.03; y += 0.5; }
      for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + 0.3; blade(b, [lx, y + 0.05, lz], [lx + Math.cos(a) * 1.2, y - 0.45 + 0.2 * hashf(k, 1, 1), lz + Math.sin(a) * 1.2], 0.16, 0.04, 1); }
      blob(b, [lx, y, lz], 0.16, 5, 2, 0.1, 1);
    }, size: 4.5, r: 0.12, h: 2.6 },
    puff: { build(b) { cyl(b, [0, 0, 0], 0.13, 0.1, 0.9, 6, 0); blob(b, [0, 1.45, 0], 0.95, 8, 5, 0.18, 1, 0.9); }, size: 4.2, r: 0.14, h: 2.4 },
    boulder: { build(b) { blob(b, [0, 0.3, 0], 0.55, 7, 4, 0.35, 2, 0.7); }, size: 2.2, r: 0.5, h: 0.8 },
    grass: { build(b) { for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI; blade(b, [Math.cos(a) * -0.2, 0, Math.sin(a) * -0.2], [Math.cos(a) * 0.2, 0.55, Math.sin(a) * 0.2], 0.18, 0.02, 6); } }, size: 1.3, soft: true, h: 0.6 },
    flower: { build(b) { blade(b, [0, 0, 0], [0.05, 0.4, 0.02], 0.02, 0.015, 6); blob(b, [0.05, 0.45, 0.02], 0.11, 5, 3, 0.2, 3); }, size: 1.2, soft: true, h: 0.6 },
    lily: { build(b) { const c = [0, 0.02, 0]; for (let k = 0; k < 7; k++) { const a0 = k / 7 * TAU * 0.92, a1 = (k + 1) / 7 * TAU * 0.92; b.tri(c, [Math.cos(a1) * 0.5, 0.02, Math.sin(a1) * 0.5], [Math.cos(a0) * 0.5, 0.02, Math.sin(a0) * 0.5], ex(4)); } }, size: 1.4, soft: true, h: 0.1 },
    log: { build(b) { for (let k = 0; k < 6; k++) { const a0 = k / 6 * TAU, a1 = (k + 1) / 6 * TAU; b.quad([-0.8, 0.22 + Math.cos(a0) * 0.22, Math.sin(a0) * 0.22], [0.8, 0.22 + Math.cos(a0) * 0.22, Math.sin(a0) * 0.22], [0.8, 0.22 + Math.cos(a1) * 0.22, Math.sin(a1) * 0.22], [-0.8, 0.22 + Math.cos(a1) * 0.22, Math.sin(a1) * 0.22], ex(0)); } }, size: 2.5, r: 0.35, h: 0.5 },
    reed: { build(b) { for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; blade(b, [Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15], [Math.cos(a) * 0.25, 1.2, Math.sin(a) * 0.25], 0.05, 0.02, 8); } }, size: 1.6, soft: true, h: 1.3 },
    cloud: { build(b) { const parts = [[0, 0, 0, 1.0], [0.9, -0.1, 0.2, 0.75], [-0.9, -0.15, -0.1, 0.8], [0.3, 0.1, 0.8, 0.6], [-0.4, 0.05, -0.8, 0.55], [1.6, -0.25, -0.3, 0.5]]; parts.forEach((p, k) => blob(b, [p[0], p[1], p[2]], p[3], 7, 4, 0.12, 7, 0.75, 0.35, k * 3)); }, size: 12, h: 2 },
    dome: { build(b) { blob(b, [0, 0, 0], 0.5, 8, 4, 0.0, 5, 1, 0.02); box(b, [0, 0.03, 0], [1.05, 0.06, 1.05], 5); }, size: 4, r: 0.5, h: 0.6 },
    block: { build(b) { box(b, [0, 0.3, 0], [1, 0.6, 1], 5); box(b, [0.15, 0.7, -0.1], [0.5, 0.25, 0.6], 5); }, size: 4, r: 0.55, h: 0.9 },
    tower: { build(b) { cyl(b, [0, 0, 0], 0.26, 0.22, 1.5, 7, 5); blob(b, [0, 1.5, 0], 0.3, 7, 3, 0, 5, 1, 0.05); }, size: 4, r: 0.3, h: 1.9 },
  };
  const meshCache = {};
  function mesh(kind) { if (!meshCache[kind]) { const b = new MB(); KINDS[kind].build(b); meshCache[kind] = b.finish(); } return meshCache[kind]; }
  // Extra kinds from prop sets register here so mesh caching and collision hints work the same way.
  function register(name, def) { KINDS[name] = def; delete meshCache[name]; return def; }
  // Lane clearance: true when a point is far enough from the track (3D for flying lanes, road shoulder on surface tracks).
  function laneClearance(desc, tab, terrain) {
    const near = trackIndex(tab, terrain && terrain.ext ? terrain.ext : tab.maxR * 1.6);
    const R = desc.corridor && desc.corridor.radius ? desc.corridor.radius : 0;
    return (x, y, z, margin = 0) => {
      // Search far enough that a big prop's own radius cannot reach back into the lane unseen.
      const reach = Math.min(12, 2 + Math.ceil((R + 15 + margin) / 40));
      const nr = near(x, z, reach);
      if (!nr.s) return true;
      if (desc.mode === 'corridor') {
        const dy = y - nr.s.p[1];
        const clear = R + 15 + margin;
        return (nr.dist * nr.dist + dy * dy) > clear * clear;
      }
      return nr.dist > nr.w + 3.5 + margin;
    };
  }

  // ---- placement
  function trackIndex(tab, ext) {
    const { S, N } = tab, cell = 40, buckets = new Map(), bkey = (bx, bz) => bx * 4096 + bz;
    for (let i = 0; i < N; i++) { const key = bkey(Math.floor((S[i].p[0] + ext) / cell), Math.floor((S[i].p[2] + ext) / cell)); if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(i); }
    return (x, z, reach = 2) => {
      const bx = Math.floor((x + ext) / cell), bz = Math.floor((z + ext) / cell);
      let best = -1, bd = Infinity;
      for (let ox = -reach; ox <= reach; ox++) for (let oz = -reach; oz <= reach; oz++) {
        const arr = buckets.get(bkey(bx + ox, bz + oz)); if (!arr) continue;
        for (const i of arr) { const dx = S[i].p[0] - x, dz = S[i].p[2] - z, dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = i; } }
      }
      return best < 0 ? { dist: 1e9, w: 10, s: null } : { dist: Math.sqrt(bd), w: S[best].w, s: S[best] };
    };
  }

  function place(desc, tab, terrain) {
    const b = desc.biome, out = {};
    if (!b || !b.flora || !desc.floraDensity) return out;
    const rnd = mulberry32(desc.seed ^ 0x2F0A9D1);
    const ext = terrain.ext - 25, cellSize = b.cell || 7, wl = desc.waterLevel;
    const near = trackIndex(tab, terrain.ext);
    const kinds = Object.keys(b.flora).filter(k => KINDS[k]);
    let total = 0;
    const push = (kind, x, y, z, s, sy, rot) => { (out[kind] = out[kind] || []).push(x, y, z, s, sy, s, rot, rnd()); total++; };
    const slopeAt = (x, z) => { const e = 2.5; return Math.hypot(terrain.heightAt(x + e, z) - terrain.heightAt(x - e, z), terrain.heightAt(x, z + e) - terrain.heightAt(x, z - e)) / (2 * e); };
    const nCells = Math.floor(ext * 2 / cellSize);
    const corridor = desc.mode === 'corridor', R = desc.corridor && desc.corridor.radius ? desc.corridor.radius : 0;
    const cap = b.cap || 22000;
    for (let gz = 0; gz < nCells && total < cap; gz++) for (let gx = 0; gx < nCells && total < cap; gx++) {
      const x = -ext + (gx + rnd()) * cellSize, z = -ext + (gz + rnd()) * cellSize;
      const nr = near(x, z);
      const h = terrain.heightAt(x, z);
      let fade;
      if (corridor) {
        // Flying lane: keep the lane volume clear, densify the ground under and beside it.
        const dy = nr.s ? h - nr.s.p[1] : 1e9, d3 = Math.sqrt(nr.dist * nr.dist + dy * dy);
        if (d3 < R + 15) continue;
        fade = 1;
      } else {
        if (nr.dist < nr.w + 3.5) continue;
        fade = clamp((nr.dist - nr.w - 3.5) / 22, 0, 1);
      }
      // Twice as much dressing within about 120 m of the lane, where the player actually looks.
      fade *= 1 + (b.nearBoost === undefined ? 1.0 : b.nearBoost) * (1 - smoothstep(30, 130, nr.dist));
      const clump = smoothstep(-0.35, 0.45, fbm(x * (b.clumpFreq || 0.007) + 13, z * (b.clumpFreq || 0.007)));
      const density = desc.floraDensity * (0.25 + 0.75 * clump) * fade;
      const slope = slopeAt(x, z);
      // Water: lily pads and reeds only.
      if (h < wl + 0.25) {
        if (h > wl - 4 && b.flora.lily && rnd() < b.flora.lily * density) push('lily', x, wl + 0.03, z, KINDS.lily.size * (0.7 + rnd() * 0.6), 1, rnd() * TAU);
        continue;
      }
      if (rnd() > Math.min(1, density)) continue;
      // Weighted pick with terrain adjustments.
      let sum = 0; const w = {};
      for (const k of kinds) {
        let wk = b.flora[k];
        if (k === 'reed') wk *= h < wl + 3 ? 4 : 0;
        else if (k === 'lily') wk = 0;
        else if (k === 'boulder' || k === 'log') wk *= 0.6 + slope * 2;
        else if (k === 'grass' || k === 'flower') wk *= 1 - smoothstep(0.5, 1.0, slope);
        else wk *= 1 - smoothstep(0.55, 1.1, slope); // trees avoid cliffs
        if (b.treeLine !== undefined && h > b.treeLine && (k === 'pine' || k === 'round' || k === 'palm' || k === 'puff')) wk *= 0.15;
        w[k] = wk; sum += wk;
      }
      if (sum <= 0) continue;
      let r = rnd() * sum, kind = kinds[0];
      for (const k of kinds) { r -= w[k]; if (r <= 0) { kind = k; break; } }
      const K = KINDS[kind];
      const s = K.size * (0.65 + rnd() * 0.7) * (desc.floraScale || 1);
      push(kind, x, h - 0.15 * s * 0.2, z, s, s * (0.85 + rnd() * 0.4), rnd() * TAU);
    }
    const res = {};
    for (const k of Object.keys(out)) res[k] = new Float32Array(out[k]);
    return res;
  }

  function clouds(desc, tab, terrain) {
    const b = desc.biome; if (!b || !desc.cloudDensity) return null;
    if (desc.noTerrain && !b.cloudsInSpace) return null;
    const rnd = mulberry32(desc.seed ^ 0x5C10D);
    const ext = (terrain && terrain.ext) ? terrain.ext : tab.maxR * 1.6;
    const n = Math.round(desc.cloudDensity * 90), out = [];
    let avgY = 0; for (const s of tab.S) avgY += s.p[1] / tab.N;
    for (let k = 0; k < n; k++) {
      const x = (rnd() * 2 - 1) * ext, z = (rnd() * 2 - 1) * ext;
      const y = avgY + desc.cloudHeight + (rnd() - 0.5) * (b.cloudSpread || 30);
      const s = KINDS.cloud.size * (0.5 + rnd() * 1.2) * (b.cloudScale || 1);
      out.push(x, y, z, s, s * (0.6 + rnd() * 0.3), s, rnd() * TAU, rnd());
    }
    return new Float32Array(out);
  }

  function settlements(desc, tab, terrain) {
    const b = desc.biome; if (!b || !b.settlements) return {};
    const rnd = mulberry32(desc.seed ^ 0x5E771E), out = { dome: [], block: [], tower: [] };
    const nClusters = b.settlements;
    for (let c = 0; c < nClusters; c++) {
      const s = World.sampleAt(tab, rnd()), side = rnd() < 0.5 ? -1 : 1, off = s.w + 35 + rnd() * 50;
      const cx = s.p[0] + s.right[0] * side * off, cz = s.p[2] + s.right[2] * side * off;
      const nB = 8 + Math.floor(rnd() * 14);
      for (let k = 0; k < nB; k++) {
        const a = rnd() * TAU, r = Math.sqrt(rnd()) * 28;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = terrain.heightAt(x, z);
        if (y < desc.waterLevel + 0.5) continue;
        const t = rnd(), kind = t < 0.55 ? 'dome' : t < 0.88 ? 'block' : 'tower';
        const sz = KINDS[kind].size * (0.7 + rnd() * 0.9);
        out[kind].push(x, y - 0.3, z, sz, sz * (0.9 + rnd() * 0.3), sz, rnd() * TAU, rnd());
      }
    }
    const res = {}; for (const k of Object.keys(out)) if (out[k].length) res[k] = new Float32Array(out[k]);
    return res;
  }

  function waterMesh(ext, level) {
    const b = new MB(), G = 24, st = ext * 2 / G, exw = [4, 0, 0, 0];
    for (let gz = 0; gz < G; gz++) for (let gx = 0; gx < G; gx++) {
      const x0 = -ext + gx * st, z0 = -ext + gz * st, x1 = x0 + st, z1 = z0 + st;
      const q = [[x0, level, z0], [x0, level, z1], [x1, level, z1], [x1, level, z0]];
      const ids = q.map(p => b.vert(p, [0, 1, 0], [p[0], p[2]], exw));
      b.i.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    }
    return b.finish();
  }

  // Everything a scene needs for a world: instance groups (with collision hints) and an optional water plane.
  function buildScene(desc, tab, terrain) {
    const groups = [];
    const add = (kind, inst) => { if (!inst || !inst.length) return; const K = KINDS[kind]; groups.push({ kind, mesh: mesh(kind), inst, count: inst.length / 8, r: K.r || 0, h: K.h || 1, soft: !!K.soft, collide: kind !== 'cloud' }); };
    const hasGround = terrain && terrain.ext && !desc.noTerrain;
    if (hasGround) {
      const fl = place(desc, tab, terrain); for (const k of Object.keys(fl)) add(k, fl[k]);
      const st = settlements(desc, tab, terrain); for (const k of Object.keys(st)) add(k, st[k]);
    }
    add('cloud', clouds(desc, tab, terrain));
    // Biome prop sets (debris, canyons, ice, cities, weird): see propsets.js.
    if (typeof Propsets !== 'undefined' && desc.biome && desc.biome.propsets) {
      const ps = Propsets.build(desc, tab, terrain);
      for (const k of Object.keys(ps)) add(k, ps[k]);
    }
    const water = (desc.waterLevel > -1e3 && terrain && terrain.ext) ? waterMesh(terrain.ext, desc.waterLevel) : null;
    return { groups, water };
  }

  return { KINDS, mesh, register, place, clouds, settlements, waterMesh, buildScene, laneClearance, trackIndex, prim: { MB, cone, cyl, blob, box, blade, hashf, ex } };
})();
