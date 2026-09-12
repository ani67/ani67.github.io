// Procedural mesh builders. Vertex layout (12 floats): pos3, nrm3, uv2, ex4.
// ex0 = material (0 terrain, 1 track, 2 prop, 3 car). Other ex slots are material specific.
const Geo = (() => {
  const { TAU, clamp, mix, smoothstep, mulberry32, hash2, norm, cross, sub, add, scale } = M;
  const STRIDE = 12;

  class MeshBuilder {
    constructor() { this.v = []; this.i = []; }
    vert(p, n, uv, ex) { this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], ex[0], ex[1], ex[2], ex[3]); return this.v.length / STRIDE - 1; }
    tri(a, b, c) { this.i.push(a, b, c); }
    quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
    // Axis aligned box centered at c with size s. Flat normals.
    box(c, s, ex, uvFn) {
      const h = [s[0] / 2, s[1] / 2, s[2] / 2];
      const faces = [
        [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
        [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, 1], [-1, 0, 0]],
        [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
      ];
      for (const [n, u, v] of faces) {
        const base = [c[0] + n[0] * h[0], c[1] + n[1] * h[1], c[2] + n[2] * h[2]];
        const uu = [u[0] * h[0], u[1] * h[1], u[2] * h[2]], vv = [v[0] * h[0], v[1] * h[1], v[2] * h[2]];
        const ids = [];
        for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const p = [base[0] + uu[0] * su + vv[0] * sv, base[1] + uu[1] * su + vv[1] * sv, base[2] + uu[2] * su + vv[2] * sv];
          ids.push(this.vert(p, n, uvFn ? uvFn(p) : [su, sv], ex));
        }
        this.quad(ids[0], ids[1], ids[2], ids[3]);
      }
    }
    // Cylinder along X axis centered at c.
    cylinderX(c, r, w, seg, ex, uvFn) {
      const ring = [[], []];
      for (let s = 0; s < 2; s++) {
        const x = c[0] + (s ? w / 2 : -w / 2);
        for (let k = 0; k < seg; k++) {
          const a = k / seg * TAU, n = [0, Math.cos(a), Math.sin(a)];
          const p = [x, c[1] + n[1] * r, c[2] + n[2] * r];
          ring[s].push(this.vert(p, n, uvFn ? uvFn(p) : [k / seg, s], ex));
        }
      }
      for (let k = 0; k < seg; k++) {
        const k2 = (k + 1) % seg;
        this.quad(ring[0][k], ring[1][k], ring[1][k2], ring[0][k2]);
      }
      for (let s = 0; s < 2; s++) {
        const x = c[0] + (s ? w / 2 : -w / 2), n = [s ? 1 : -1, 0, 0];
        const center = this.vert([x, c[1], c[2]], n, uvFn ? uvFn([x, c[1], c[2]]) : [0.5, 0.5], ex);
        for (let k = 0; k < seg; k++) {
          const k2 = (k + 1) % seg, a = k / seg * TAU, a2 = k2 / seg * TAU;
          const pa = [x, c[1] + Math.cos(a) * r, c[2] + Math.sin(a) * r], pb = [x, c[1] + Math.cos(a2) * r, c[2] + Math.sin(a2) * r];
          const ia = this.vert(pa, n, uvFn ? uvFn(pa) : [0, 0], ex), ib = this.vert(pb, n, uvFn ? uvFn(pb) : [0, 0], ex);
          if (s) this.tri(center, ia, ib); else this.tri(center, ib, ia);
        }
      }
    }
    // Convex 8-corner hull: corners 0..3 = one end quad, 4..7 = other end quad (same order). Flat normals.
    hull(c, ex) {
      const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]];
      const cen = [0, 0, 0]; for (const q of c) { cen[0] += q[0] / 8; cen[1] += q[1] / 8; cen[2] += q[2] / 8; }
      for (const f of faces) {
        const a = c[f[0]], b = c[f[1]], d = c[f[2]];
        let n = norm(cross(sub(b, a), sub(d, a)));
        const fc = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2, (a[2] + d[2]) / 2];
        if (M.dot(n, sub(fc, cen)) < 0) n = scale(n, -1);
        const ids = f.map(k => this.vert(c[k], n, [0, 0], ex));
        this.quad(ids[0], ids[1], ids[2], ids[3]);
      }
    }
    // Cylinder along Z centered at c, radius r, length l.
    cylinderZ(c, r, l, seg, ex) {
      const ring = [[], []];
      for (let s = 0; s < 2; s++) {
        const z = c[2] + (s ? l / 2 : -l / 2);
        for (let k = 0; k < seg; k++) {
          const a = k / seg * TAU, n = [Math.cos(a), Math.sin(a), 0];
          ring[s].push(this.vert([c[0] + n[0] * r, c[1] + n[1] * r, z], n, [k / seg, s], ex));
        }
      }
      for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg; this.quad(ring[0][k], ring[1][k], ring[1][k2], ring[0][k2]); }
      for (let s = 0; s < 2; s++) {
        const z = c[2] + (s ? l / 2 : -l / 2), n = [0, 0, s ? 1 : -1];
        const center = this.vert([c[0], c[1], z], n, [0.5, 0.5], ex);
        for (let k = 0; k < seg; k++) {
          const k2 = (k + 1) % seg, a = k / seg * TAU, a2 = k2 / seg * TAU;
          const ia = this.vert([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z], n, [0, 0], ex), ib = this.vert([c[0] + Math.cos(a2) * r, c[1] + Math.sin(a2) * r, z], n, [0, 0], ex);
          if (s) this.tri(center, ia, ib); else this.tri(center, ib, ia);
        }
      }
    }
    finish() { return { verts: new Float32Array(this.v), idx: new Uint32Array(this.i) }; }
  }

  // --- Track ribbon ---------------------------------------------------------
  function buildTrack(tab) {
    // Flight only: no road deck. Return a degenerate mesh so callers that still expect one keep working.
    if (!tab || tab.noDeck !== false) { const b0 = new MeshBuilder(); const i0 = b0.vert([0, -1e4, 0], [0, 1, 0], [0, 0], [1, 0, 0, 0]); b0.tri(i0, i0, i0); return b0.finish(); }
    const b = new MeshBuilder();
    const { S, N } = tab;
    const sideIds = [];
    for (let i = 0; i <= N; i++) {
      const s = S[i % N];
      const up0 = norm(cross(s.tan, s.right));
      // Banking: rotate right/up around the tangent.
      const cb = Math.cos(s.bank), sb = Math.sin(s.bank);
      const right = add(scale(s.right, cb), scale(up0, sb));
      const up = norm(sub(scale(up0, cb), scale(s.right, sb)));
      const v = (i / N) * 60; // along-track texture coordinate
      const row = [];
      for (const u of [-1, -0.9, 0, 0.9, 1]) {
        const p = add(s.p, scale(right, u * s.w));
        const tt = i / N; const gates = tab.boostTs && tab.boostTs.length ? tab.boostTs : [0.083, 0.25, 0.417, 0.583, 0.75, 0.917];
        const pad = gates.some(g => { let e = tt - g; e -= Math.round(e); return Math.abs(e) < 0.0025; }) ? 1 : 0;
        row.push(b.vert(p, up, [u, v], [1, tt, s.w, pad]));
      }
      // Skirt below the edges so the road has a visible thickness.
      const dn = scale(up, -(1.5 + s.w * Math.abs(Math.sin(s.bank))));
      row.push(b.vert(add(add(s.p, scale(right, -s.w)), dn), scale(right, -1), [-1, v], [1, i / N, s.w, -9]));
      row.push(b.vert(add(add(s.p, scale(right, s.w)), dn), right, [1, v], [1, i / N, s.w, -9]));
      sideIds.push(row);
    }
    const T = (typeof Tracks !== 'undefined') ? Tracks.TAG : { gap: 1, bridge: 2, pylons: 3, tunnel: 4 };
    for (let i = 0; i < N; i++) {
      const a = sideIds[i], c = sideIds[i + 1];
      const s0 = S[i % N], s1 = S[(i + 1) % N];
      if (s0.tag === T.gap && s1.tag === T.gap) continue; // chasm: no deck
      for (let k = 0; k < 4; k++) b.quad(a[k], a[k + 1], c[k + 1], c[k]);
      b.quad(a[5], a[0], c[0], c[5]);
      b.quad(a[4], a[6], c[6], c[4]);
    }
    // Feature geometry: pylon posts under raised decks, tunnel tubes with portal frames.
    const frameOf = s => {
      const up0 = norm(cross(s.tan, s.right));
      const cb = Math.cos(s.bank), sb = Math.sin(s.bank);
      return { right: add(scale(s.right, cb), scale(up0, sb)), up: norm(sub(scale(up0, cb), scale(s.right, sb))), fwd: s.tan };
    };
    const slab = (center, f, size, ex) => {
      const hx = size[0] / 2, hy = size[1] / 2, hz = size[2] / 2, corners = [];
      for (const [sz, sy, sx] of [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]]) {
        corners.push(add(add(add(center, scale(f.right, sx * hx)), scale(f.up, sy * hy)), scale(f.fwd, sz * hz)));
      }
      b.hull(corners, ex);
    };
    const skirtEx = i => [1, i / N, 1, -9];
    for (let i = 0; i < N; i++) {
      const s = S[i];
      if (s.tag === T.pylons && i % 5 === 0 && s.ground > -1e3 && s.p[1] - s.ground > 1.5) {
        const f = frameOf(s), depth = s.p[1] - s.ground + 3;
        for (const side of [-0.62, 0.62]) {
          const top = add(s.p, scale(f.right, side * s.w));
          const center = add(top, scale([0, 1, 0], -depth / 2));
          slab(center, { right: f.right, up: [0, 1, 0], fwd: f.fwd }, [1.4, depth, 1.4], skirtEx(i));
        }
      }
    }
    // Tunnels: walls and ceiling strips over tagged runs, portal frames at the ends.
    let inTunnel = false, tStart = -1;
    const wallRows = [];
    for (let i = 0; i <= N; i++) {
      const s = S[i % N], f = frameOf(s), H = 5.5;
      const isT = s.tag === T.tunnel;
      if (isT) {
        const l0 = add(s.p, scale(f.right, -s.w)), r0 = add(s.p, scale(f.right, s.w));
        const l1 = add(l0, scale(f.up, H)), r1 = add(r0, scale(f.up, H));
        const inR = scale(f.right, -1);
        const row = [b.vert(l0, f.right, [-1, i], skirtEx(i)), b.vert(l1, f.right, [-1, i], skirtEx(i)), b.vert(r0, inR, [1, i], skirtEx(i)), b.vert(r1, inR, [1, i], skirtEx(i)),
          b.vert(l1, scale(f.up, -1), [-1, i], skirtEx(i)), b.vert(r1, scale(f.up, -1), [1, i], skirtEx(i))];
        wallRows.push({ i, row });
      }
      if (isT && !inTunnel) { inTunnel = true; tStart = i; }
      if ((!isT && inTunnel) || (isT && i === N)) {
        inTunnel = false;
        for (const idx of [tStart, i - 1]) {
          const ps = S[((idx % N) + N) % N], pf = frameOf(ps);
          const lin = add(ps.p, scale(pf.up, H + 0.8));
          slab(lin, pf, [ps.w * 2 + 3, 1.6, 2.4], skirtEx(idx));
          for (const side of [-1, 1]) slab(add(add(ps.p, scale(pf.right, side * (ps.w + 0.9))), scale(pf.up, (H + 1.6) / 2)), pf, [1.6, H + 1.6, 2.4], skirtEx(idx));
        }
      }
    }
    for (let k = 0; k + 1 < wallRows.length; k++) {
      const a = wallRows[k], c = wallRows[k + 1];
      if (c.i !== a.i + 1) continue;
      b.quad(a.row[0], a.row[1], c.row[1], c.row[0]);
      b.quad(a.row[2], a.row[3], c.row[3], c.row[2]);
      b.quad(a.row[4], a.row[5], c.row[5], c.row[4]);
    }
    return b.finish();
  }

  // --- Terrain grid (track flattened in) ------------------------------------
  function buildTerrain(d, tab, G = 200, opts = {}) {
    const flatten = opts.flatten !== false;
    const { S, N } = tab;
    const ext = tab.maxR * 1.45 + 120;
    const H = new Float32Array((G + 1) * (G + 1));
    // Coarse lookup: bucket track samples into a grid for fast nearest search.
    const cell = 40, nb = Math.ceil(ext * 2 / cell) + 1, buckets = new Map();
    const bkey = (bx, bz) => bx * 4096 + bz;
    for (let i = 0; i < N; i++) {
      const bx = Math.floor((S[i].p[0] + ext) / cell), bz = Math.floor((S[i].p[2] + ext) / cell);
      const key = bkey(bx, bz);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }
    const nearest = (x, z) => {
      const bx = Math.floor((x + ext) / cell), bz = Math.floor((z + ext) / cell);
      let best = -1, bd = Infinity;
      for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) {
        const arr = buckets.get(bkey(bx + ox, bz + oz)); if (!arr) continue;
        for (const i of arr) { const dx = S[i].p[0] - x, dz = S[i].p[2] - z, dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = i; } }
      }
      return best < 0 ? null : { i: best, dist: Math.sqrt(bd) };
    };
    const P = (gx, gz) => [-ext + gx / G * ext * 2, -ext + gz / G * ext * 2];
    for (let gz = 0; gz <= G; gz++) for (let gx = 0; gx <= G; gx++) {
      const [x, z] = P(gx, gz);
      let h = World.terrainRaw(d, x, z);
      const nr = flatten ? nearest(x, z) : null;
      if (nr) {
        const s = S[nr.i];
        const tag = s.tag || 0, TT = (typeof Tracks !== 'undefined') ? Tracks.TAG : { gap: 1, bridge: 2, pylons: 3, tunnel: 4 };
        const sh = d.shoulder || 170, inner = s.w * 1.3, outer = inner + Math.min(60, sh * 0.45);
        let floor = s.p[1] - 0.45 - s.w * Math.abs(Math.sin(s.bank));
        if ((tag === TT.pylons || tag === TT.bridge) && s.ground > -1e3) floor = s.ground - 0.4; // raised deck: leave the ground where it is
        if (tag === TT.tunnel) {
          // Tunnel: raise a mound over the deck instead of flattening down to it.
          const mound = s.p[1] + 7.5;
          const k = smoothstep(inner + 6, outer + 30, nr.dist);
          h = mix(Math.max(h, mound), h, k);
        } else {
          // Shoulders: pull the terrain toward road height over a wide band so you can drive beside the road.
          const pull = 0.94 * (1 - smoothstep(inner + 10, inner + sh, nr.dist));
          h = mix(h, floor - 0.6 + (h - floor) * 0.04, pull);
          const k = smoothstep(inner, outer, nr.dist);
          h = mix(floor, Math.min(h, floor + (h - floor) * k), k);
        }
      }
      H[gz * (G + 1) + gx] = h;
    }
    const b = new MeshBuilder();
    const step = ext * 2 / G;
    for (let gz = 0; gz <= G; gz++) for (let gx = 0; gx <= G; gx++) {
      const [x, z] = P(gx, gz);
      const hx0 = H[gz * (G + 1) + Math.max(gx - 1, 0)], hx1 = H[gz * (G + 1) + Math.min(gx + 1, G)];
      const hz0 = H[Math.max(gz - 1, 0) * (G + 1) + gx], hz1 = H[Math.min(gz + 1, G) * (G + 1) + gx];
      const n = norm([hx0 - hx1, 2 * step, hz0 - hz1]);
      const h = H[gz * (G + 1) + gx];
      b.vert([x, h, z], n, [x, z], [0, h / (d.terrainAmp * 2 + 1), 0, 0]);
    }
    for (let gz = 0; gz < G; gz++) for (let gx = 0; gx < G; gx++) {
      const a = gz * (G + 1) + gx;
      b.quad(a, a + G + 1, a + G + 2, a + 1);
    }
    const mesh = b.finish();
    mesh.heightAt = (x, z) => {
      const fx = clamp((x + ext) / (ext * 2) * G, 0, G - 1e-3), fz = clamp((z + ext) / (ext * 2) * G, 0, G - 1e-3);
      const ix = Math.floor(fx), iz = Math.floor(fz), ux = fx - ix, uz = fz - iz;
      const h00 = H[iz * (G + 1) + ix], h10 = H[iz * (G + 1) + ix + 1], h01 = H[(iz + 1) * (G + 1) + ix], h11 = H[(iz + 1) * (G + 1) + ix + 1];
      return mix(mix(h00, h10, ux), mix(h01, h11, ux), uz);
    };
    mesh.ext = ext;
    mesh.gridSize = G;
    return mesh;
  }

  // Keep collision sampling at full resolution; these chunks only change drawing.
  function terrainChunks(terrain, cells = 30) {
    const G = terrain.gridSize;
    if (!G) return [terrain];
    const chunks = [], row = G + 1;
    const tile = (x0, z0, x1, z1, stride) => {
      const xs = [], zs = [];
      for (let x = x0; x < x1; x += stride) xs.push(x);
      for (let z = z0; z < z1; z += stride) zs.push(z);
      xs.push(x1); zs.push(z1);
      const verts = [], idx = [];
      for (const z of zs) for (const x of xs) {
        const off = (z * row + x) * STRIDE;
        for (let k = 0; k < STRIDE; k++) verts.push(terrain.verts[off + k]);
      }
      const w = xs.length, h = zs.length;
      for (let z = 0; z < h - 1; z++) for (let x = 0; x < w - 1; x++) {
        const a = z * w + x;
        idx.push(a, a + w, a + w + 1, a, a + w + 1, a + 1);
      }
      // Skirts hide cracks where neighboring tiles choose different detail levels.
      const edge = [];
      for (let x = 0; x < w; x++) edge.push(x);
      for (let z = 1; z < h; z++) edge.push(z * w + w - 1);
      for (let x = w - 2; x >= 0; x--) edge.push((h - 1) * w + x);
      for (let z = h - 2; z > 0; z--) edge.push(z * w);
      const base = verts.length / STRIDE;
      for (const i of edge) {
        for (let k = 0; k < STRIDE; k++) verts.push(verts[i * STRIDE + k] - (k === 1 ? 80 : 0));
      }
      for (let i = 0; i < edge.length; i++) {
        const j = (i + 1) % edge.length;
        idx.push(edge[i], base + i, base + j, edge[i], base + j, edge[j]);
      }
      return { verts: new Float32Array(verts), idx: new Uint32Array(idx) };
    };
    for (let z = 0; z < G; z += cells) for (let x = 0; x < G; x += cells) {
      const x1 = Math.min(G, x + cells), z1 = Math.min(G, z + cells);
      const mesh = tile(x, z, x1, z1, 1);
      mesh.lods = [tile(x, z, x1, z1, 2), tile(x, z, x1, z1, 5)];
      chunks.push(mesh);
    }
    return chunks;
  }

  // Spatial batches keep instancing while allowing whole invisible batches to be skipped.
  // Conservative bounds include shader twist, breathing, sway and quantization.
  function instanceChunks(mesh, data, cellSize = 160) {
    const buckets = new Map();
    let radial = 0, minY = Infinity, maxY = -Infinity, absY = 0;
    for (let o = 0; o < mesh.verts.length; o += STRIDE) {
      radial = Math.max(radial, Math.hypot(mesh.verts[o], mesh.verts[o + 2]));
      minY = Math.min(minY, mesh.verts[o + 1]); maxY = Math.max(maxY, mesh.verts[o + 1]);
      absY = Math.max(absY, Math.abs(mesh.verts[o + 1]));
    }
    for (let o = 0; o < data.length; o += 8) {
      const key = `${Math.floor(data[o] / cellSize)},${Math.floor(data[o + 2] / cellSize)}`;
      if (!buckets.has(key)) buckets.set(key, { values: [], bounds: { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] } });
      const b = buckets.get(key), scaleXZ = Math.max(Math.abs(data[o + 3]), Math.abs(data[o + 5]));
      const radius = (radial * (1 + 0.04 * absY) + 0.05 * absY * absY) * scaleXZ + 8;
      const y0 = Math.min(minY * data[o + 4], maxY * data[o + 4]) - 9;
      const y1 = Math.max(minY * data[o + 4], maxY * data[o + 4]) + 9;
      const lo = [data[o] - radius, data[o + 1] + y0, data[o + 2] - radius];
      const hi = [data[o] + radius, data[o + 1] + y1, data[o + 2] + radius];
      for (let k = 0; k < 3; k++) { b.bounds.min[k] = Math.min(b.bounds.min[k], lo[k]); b.bounds.max[k] = Math.max(b.bounds.max[k], hi[k]); }
      for (let k = 0; k < 8; k++) b.values.push(data[o + k]);
    }
    return [...buckets.values()].map(b => ({ data: new Float32Array(b.values), bounds: b.bounds }));
  }

  // --- Props: one base mesh per vocabulary, many instances -------------------
  // Instance layout (8 floats): pos3, scale3, rotY, seed.
  function buildPropMesh(type) {
    const b = new MeshBuilder();
    const ex = [2, type, 0, 0];
    const uvFn = p => [p[1], Math.atan2(p[2], p[0]) / TAU];
    if (type === 0) { // column with a cap
      cylY(b, [0, 0.5, 0], 0.5, 1, 10, 0.85, ex, uvFn);
      b.box([0, 1.02, 0], [1.4, 0.08, 1.4], [2, type, 1, 0], uvFn);
    } else if (type === 1) { // shard: tapered prism
      cylY(b, [0, 0.5, 0], 0.5, 1, 5, 0.1, ex, uvFn);
    } else if (type === 2) { // ring: torus made of segments, axis Z
      const R = 0.8, r = 0.12, seg = 24;
      const ring = [];
      for (let k = 0; k < seg; k++) {
        const a = k / seg * TAU, cx = Math.cos(a) * R, cy = Math.sin(a) * R;
        const row = [];
        for (let j = 0; j < 6; j++) {
          const bb = j / 6 * TAU, n = [Math.cos(a) * Math.cos(bb), Math.sin(a) * Math.cos(bb), Math.sin(bb)];
          row.push(b.vert([cx + n[0] * r, cy + n[1] * r + 1.0, n[2] * r], n, [j / 6, k / seg], ex));
        }
        ring.push(row);
      }
      for (let k = 0; k < seg; k++) for (let j = 0; j < 6; j++) {
        const k2 = (k + 1) % seg, j2 = (j + 1) % 6;
        b.quad(ring[k][j], ring[k2][j], ring[k2][j2], ring[k][j2]);
      }
      b.box([0, 0.1, 0], [0.3, 0.2, 0.3], ex, uvFn);
    } else { // blade: thin tall tapered plane cluster
      for (let k = 0; k < 3; k++) {
        const a = k / 3 * TAU, ex2 = [2, type, k, 0];
        const bx = Math.cos(a) * 0.15, bz = Math.sin(a) * 0.15;
        const n = norm([Math.cos(a + 1.57), 0, Math.sin(a + 1.57)]);
        const w = 0.35;
        const p0 = [bx - n[2] * w, 0, bz + n[0] * w], p1 = [bx + n[2] * w, 0, bz - n[0] * w];
        const tip = [bx * 3, 1, bz * 3];
        const i0 = b.vert(p0, n, [0, 0], ex2), i1 = b.vert(p1, n, [0, 1], ex2), i2 = b.vert(tip, n, [1, 0.5], ex2);
        b.tri(i0, i1, i2); b.tri(i0, i2, i1);
      }
    }
    return b.finish();
  }
  // Cylinder along Y with taper (top radius = r*taper).
  function cylY(b, c, r, h, seg, taper, ex, uvFn) {
    const rings = [[], []];
    for (let s = 0; s < 2; s++) {
      const y = c[1] + (s ? h / 2 : -h / 2), rr = s ? r * taper : r;
      for (let k = 0; k < seg; k++) {
        const a = k / seg * TAU, n = norm([Math.cos(a), (1 - taper) * 0.5, Math.sin(a)]);
        const p = [c[0] + Math.cos(a) * rr, y, c[2] + Math.sin(a) * rr];
        rings[s].push(b.vert(p, n, uvFn ? uvFn(p) : [k / seg, s], ex));
      }
    }
    for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg; b.quad(rings[0][k], rings[0][k2], rings[1][k2], rings[1][k]); }
    const top = b.vert([c[0], c[1] + h / 2, c[2]], [0, 1, 0], [1, 0], ex);
    for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg; b.tri(top, rings[1][k2], rings[1][k]); }
  }

  function buildPropInstances(d, tab, terrain) {
    if (!(d.propDensity > 0.01)) return new Float32Array(0);
    const rnd = mulberry32(d.seed ^ 0x9E3779B9);
    const { S, N } = tab;
    const out = [];
    const every = Math.max(2, Math.round(6 / d.propDensity));
    for (let i = 0; i < N; i += every) {
      const s = S[i];
      const side = rnd() < 0.5 ? -1 : 1;
      const off = s.w + 5 + rnd() * 22;
      const p = add(s.p, scale(s.right, side * off));
      const y = terrain.heightAt(p[0], p[2]);
      const sc = d.propScale * (0.7 + rnd() * 1.2);
      const hgt = sc * (2 + rnd() * 9);
      out.push(p[0], y - 0.2, p[2], sc * 1.5, hgt, sc * 1.5, rnd() * TAU, rnd());
    }
    // Landmarks: a handful of giants placed away from the track.
    for (let k = 0; k < 14; k++) {
      const a = rnd() * TAU, r = tab.maxR * (1.15 + rnd() * 0.35);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const sc = 12 + rnd() * 25;
      out.push(x, terrain.heightAt(x, z) - 2, z, sc, sc * (2 + rnd() * 4), sc, rnd() * TAU, rnd());
    }
    return new Float32Array(out);
  }

  // --- Car mesh -------------------------------------------------------------
  // ex = [3, partId, pivotZ, wheelSide]; uv = (pivotX, pivotY). Local: +Z forward, +X right.
  function buildCar() {
    const b = new MeshBuilder();
    const body = [3, 0, 0, 0];
    b.box([0, 0.62, 0.1], [2.0, 0.55, 4.4], body);
    b.box([0, 0.95, -0.35], [1.5, 0.5, 2.2], [3, 4, 0, 0]);       // cabin (glass tint)
    b.box([0, 0.36, 0], [2.2, 0.22, 3.6], [3, 5, 0, 0]);          // lower skirt, darker
    b.box([0, 1.25, -2.0], [2.3, 0.07, 0.55], body);                // spoiler
    b.box([-1.0, 1.05, -2.0], [0.08, 0.35, 0.5], body); b.box([1.0, 1.05, -2.0], [0.08, 0.35, 0.5], body);
    b.box([0, 0.62, 2.33], [1.6, 0.14, 0.08], [3, 3, 0, 0]);       // headlight strip (emissive)
    b.box([0, 0.75, -2.13], [1.7, 0.1, 0.06], [3, 3, 0, 1]);       // tail light (emissive, red-tinted)
    b.box([-1.02, 0.5, 0], [0.04, 0.06, 1.7], [3, 3, 0, 0]); b.box([1.02, 0.5, 0], [0.04, 0.06, 1.7], [3, 3, 0, 0]);
    for (const [x, z, part] of [[-1.05, 1.45, 1], [1.05, 1.45, 1], [-1.05, -1.45, 2], [1.05, -1.45, 2]]) {
      b.cylinderX([x, 0.42, z], 0.42, 0.38, 14, [3, part, z, Math.sign(x)], () => [x, 0.42]);
    }
    return b.finish();
  }

  // --- Hover craft from a vehicle family descriptor --------------------------
  // Parts: 0 body (tint), 3 lights, 4 canopy, 5 dark, 6 engine/under glow.
  function buildCraft(v) {
    const b = new MeshBuilder();
    const body = [3, 0, 0, 0], dark = [3, 5, 0, 0], glow = [3, 6, 0, 0], canopyEx = [3, 4, 0, 0];
    const L = 4.2 * v.length, W = 1.7 * v.width, H = 0.7 * v.height, y0 = 0.55, hw = W / 2, hh = H / 2;
    const q = (x0, x1, y0_, y1, z) => [[x0, y0_, z], [x1, y0_, z], [x1, y1, z], [x0, y1, z]];
    // Fuselage and nose.
    b.hull([...q(-hw, hw, y0 - hh, y0 + hh, -L / 2), ...q(-hw * 0.92, hw * 0.92, y0 - hh * 0.9, y0 + hh * 0.9, L / 2)], body);
    const nl = 1.5 * v.nose;
    b.hull([...q(-hw * 0.92, hw * 0.92, y0 - hh * 0.9, y0 + hh * 0.9, L / 2), ...q(-hw * 0.14, hw * 0.14, y0 - hh * 0.15, y0 + hh * 0.12, L / 2 + nl)], body);
    b.box([0, y0 + hh * 0.05, L / 2 + nl - 0.05], [hw * 0.3, hh * 0.28, 0.08], [3, 3, 0, 0]);          // nose light
    // Canopy.
    if (v.canopy > 0.05) {
      const cw = hw * 0.55 * v.canopy, ch = 0.32 * v.canopy + 0.08, zc = L * 0.05;
      b.hull([...q(-cw, cw, y0 + hh * 0.9, y0 + hh * 0.9 + ch, zc - 0.9), ...q(-cw * 0.7, cw * 0.7, y0 + hh * 0.9, y0 + hh * 0.9 + ch * 0.75, zc + 0.9)], canopyEx);
    }
    // Wings.
    const span = 1.7 * v.wingSpan, sweep = 1.3 * v.wingSweep, wz = v.wingPos * L * 0.45, wt = 0.35 * v.wingThick * 4, chord = 1.7;
    for (const side of [-1, 1]) {
      const rx = side * hw * 0.85, tx = side * (hw + span);
      const root = [[rx, y0 - wt / 2, wz - chord / 2], [rx, y0 - wt / 2, wz + chord / 2], [rx, y0 + wt / 2, wz + chord / 2], [rx, y0 + wt / 2, wz - chord / 2]];
      const tip = [[tx, y0 - wt * 0.15, wz - sweep - chord * 0.3], [tx, y0 - wt * 0.15, wz - sweep + chord * 0.3], [tx, y0 + wt * 0.15, wz - sweep + chord * 0.3], [tx, y0 + wt * 0.15, wz - sweep - chord * 0.3]];
      b.hull([...root, ...tip], body);
      b.box([tx, y0, wz - sweep - chord * 0.3 + 0.1], [0.08, wt * 0.5 + 0.06, 0.25], [3, 3, 0, 1]); // tip light
    }
    // Fins.
    for (let k = 0; k < v.fins; k++) {
      const fx = v.fins === 1 ? 0 : (k / (v.fins - 1) - 0.5) * hw * 1.3;
      const fh = 0.9 * v.finHeight, fz = -L / 2 + 0.6;
      b.hull([...q(fx - 0.04, fx + 0.04, y0 + hh * 0.9, y0 + hh * 0.9 + fh, fz - 0.5), ...q(fx - 0.03, fx + 0.03, y0 + hh * 0.9 + fh * 0.6, y0 + hh * 0.9 + fh, fz + 0.5)], body);
    }
    // Engine pods and exhaust glow.
    const pr = 0.42 * v.podSize + 0.08;
    for (let k = 0; k < v.pods; k++) {
      const px = v.pods === 1 ? 0 : (k / (v.pods - 1) - 0.5) * hw * 1.5;
      const py = v.pods === 1 ? y0 + hh * 0.3 : y0 - hh * 0.2 + (k % 2) * 0.05;
      b.cylinderZ([px, py, -L / 2 + 0.3], pr, 1.8, 10, dark);
      b.cylinderZ([px, py, -L / 2 - 0.63], pr * 0.8, 0.08, 10, glow);
    }
    b.box([0, y0 - hh - 0.03, 0], [W * 0.5, 0.05, L * 0.7], glow);           // underglow
    b.box([0, y0 + hh * 0.92, -L / 2 + 0.05], [W * 0.7, 0.07, 0.07], [3, 3, 0, 1]); // tail light
    return b.finish();
  }

  // Ring (torus) around Z for corridor gates, unit radius. Part 6 emissive.
  function buildRing(R = 1, r = 0.05, seg = 32, sides = 8) {
    const b = new MeshBuilder(); const ex = [3, 6, 0, 0]; const ring = [];
    for (let k = 0; k < seg; k++) {
      const a = k / seg * TAU, cx = Math.cos(a) * R, cy = Math.sin(a) * R; const row = [];
      for (let j = 0; j < sides; j++) {
        const bb = j / sides * TAU, n = [Math.cos(a) * Math.cos(bb), Math.sin(a) * Math.cos(bb), Math.sin(bb)];
        row.push(b.vert([cx + n[0] * r, cy + n[1] * r, n[2] * r], n, [j / sides, k / seg], ex));
      }
      ring.push(row);
    }
    for (let k = 0; k < seg; k++) for (let j = 0; j < sides; j++) { const k2 = (k + 1) % seg, j2 = (j + 1) % sides; b.quad(ring[k][j], ring[k2][j], ring[k2][j2], ring[k][j2]); }
    return b.finish();
  }
  function buildCube() { const b = new MeshBuilder(); b.box([0, 0, 0], [1, 1, 1], [3, 6, 0, 0]); return b.finish(); }

  // Props scattered in the volume around a corridor track (space rocks, sky shards).
  function buildVolumeProps(d, tab) {
    if (!(d.propDensity > 0.01)) return new Float32Array(0);
    const rnd = mulberry32(d.seed ^ 0x7F4A7C15);
    const { S, N } = tab, out = [], R = d.corridor.radius;
    const every = Math.max(2, Math.round(5 / d.propDensity));
    for (let i = 0; i < N; i += every) {
      const s = S[i];
      const up = norm(cross(s.tan, s.right));
      for (let k = 0; k < 2; k++) {
        const a = rnd() * TAU, r = R * (1.8 + rnd() * 5);
        const p = add(add(s.p, scale(s.right, Math.cos(a) * r)), scale(up, Math.sin(a) * r));
        const sc = d.propScale * (0.6 + rnd() * 1.4);
        out.push(p[0], p[1] - sc, p[2], sc, sc * (1 + rnd() * 2), sc, rnd() * TAU, rnd());
      }
    }
    return new Float32Array(out);
  }

  return { STRIDE, terrainChunks, instanceChunks, buildTrack, buildTerrain, buildPropMesh, buildPropInstances, buildCar, buildCraft, buildRing, buildCube, buildVolumeProps };
})();
