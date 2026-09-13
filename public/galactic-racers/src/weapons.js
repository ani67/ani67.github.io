// Pickups and weapons v2: track pickups, one item slot per craft, ten items, projectiles, missiles, mines, EMP rings,
// gravity wells, rail beams, decoys, shields, bot use, and the particle effects layer (driven by watching car state).
const Weapons = (() => {
  const { clamp, mix, norm, cross, sub, add, scale, dot, len } = M;
  const ITEMS = ['shot', 'mine', 'shield', 'boost', 'missile', 'emp', 'gravity', 'rail', 'cluster', 'decoy'];
  const SPD = (typeof Planets !== 'undefined' && Planets.SPD) || 1; // weapons keep their lead over craft at the raised speeds
  const MAXP = 24, MAXM = 32, MAXR = 8, MAXW = 4, MAXD = 6;
  // Damage table (before armour): shot 18, missile 35 direct + 15 splash within 9 m, mine 30, cluster mine 18,
  // EMP 10 + 1.2 s stun + 1.6 s dead engines, gravity burst 20 within 14 m, rail 40 (pierces), ram handled in game.js.
  const DMG = { shot: 18, missile: 35, splash: 15, mine: 30, cluster: 18, emp: 10, gravity: 20, rail: 40 };
  let ctx = null, pickups = [], projectiles = [], mines = [], rings = [], wells = [], decoys = [], groups = [], bufs = {}, rng = Math.random;
  const stats = { fired: 0, landed: 0, mined: 0, mineHits: 0, shields: 0, boosts: 0, collected: 0, missiles: 0, missileHits: 0, emps: 0, wells: 0, rails: 0, railHits: 0, clusters: 0, decoys: 0, explosions: 0 };
  const P = () => (typeof Particles !== 'undefined' ? Particles : null);
  const A = fn => { try { if (typeof Audio !== 'undefined' && Audio && Audio.sfx) fn(Audio); } catch (e) {} };
  // Pan and distance gain relative to the player's craft (cars[0]).
  function panOf(at) {
    const me = ctx && ctx.cars && ctx.cars[0]; if (!me) return { pan: 0, near: 1 };
    const dx = at[0] - me.x, dz = at[2] - me.z, dist = Math.hypot(dx, at[1] - me.y, dz);
    const right = [Math.cos(me.heading), 0, -Math.sin(me.heading)];
    return { pan: clamp((dx * right[0] + dz * right[2]) / Math.max(10, dist), -1, 1), near: clamp(1 - dist / 220, 0, 1) };
  }

  function retag(mesh, part) { for (let i = 9; i < mesh.verts.length; i += 12) mesh.verts[i] = part; return mesh; }
  function trackLen(tab) { let L = 0; for (let i = 0; i < tab.N; i++) L += len(sub(tab.S[(i + 1) % tab.N].p, tab.S[i].p)); return L; }
  function pos3(c) { return [c.x, c.y, c.z]; }
  function vel3(c) { return [c.vx, c.vy || 0, c.vz]; }

  // ctx: { cars, tab, desc, terrain, damage, hit, corridor, seed }
  function build(c) {
    ctx = c; pickups = []; projectiles = []; mines = []; rings = []; wells = []; decoys = [];
    for (const k of Object.keys(stats)) stats[k] = 0;
    rng = M.mulberry32((c.seed ^ 0xA11CE) >>> 0);
    const rnd = M.mulberry32((c.seed ^ 0x5EED) >>> 0);
    const L = trackLen(c.tab), every = 150, n = Math.max(6, Math.round(L / every));
    const gates = c.tab.boostTs && c.tab.boostTs.length ? c.tab.boostTs : [0.083, 0.25, 0.417, 0.583, 0.75, 0.917];
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      if (gates.some(g => { let e = t - g; e -= Math.round(e); return Math.abs(e) < 0.012; })) continue; // keep clear of boost gates
      const lane = [-0.5, 0, 0.5][k % 3];
      pickups.push({ t, lane, vert: (rnd() - 0.5) * 0.6, taken: 0, p: [0, 0, 0] });
    }
    for (const pk of pickups) pk.p = pickupPos(pk);
    const cube = retag(Geo.buildCube(), 7), ring = retag(Geo.buildRing(1, 0.05, 28, 6), 7), thin = retag(Geo.buildRing(1, 0.025, 40, 5), 7);
    const F = Gpu.CAR_FLOATS;
    bufs = {
      pick: new Float32Array(F * Math.max(1, pickups.length)), proj: new Float32Array(F * MAXP), mine: new Float32Array(F * MAXM),
      shield: new Float32Array(F * c.cars.length), ring: new Float32Array(F * MAXR), well: new Float32Array(F * MAXW * 2), decoy: new Float32Array(F * MAXD),
    };
    const mk = (mesh, data) => ({ mesh: Gpu.createMesh(mesh), inst: Gpu.createInstances(data), data, count: 0 });
    groups = [mk(cube, bufs.pick), mk(cube, bufs.proj), mk(cube, bufs.mine), mk(ring, bufs.shield), mk(thin, bufs.ring), mk(thin, bufs.well), mk(cube, bufs.decoy)];
    groups[0].count = pickups.length;
    for (const car of c.cars) { car.item = null; car.shield = 0; car.useItem = false; car.itemCd = 0; car.emp = 0; car._fx = null; }
    const p = P(); if (p) { p.clear(); p.setEnv({ ground: c.terrain ? c.terrain.heightAt : null, waterLevel: c.desc.waterLevel, seed: c.seed }); }
  }
  function pickupPos(pk) {
    const s = World.sampleAt(ctx.tab, pk.t), up = norm(cross(s.tan, s.right));
    if (ctx.corridor) { const R = ctx.desc.corridor.radius; return add(add(s.p, scale(s.right, pk.lane * R * 0.5)), scale(up, pk.vert * R * 0.5)); }
    return add(add(s.p, scale(s.right, pk.lane * s.w * 0.8)), scale(up, ctx.desc.physics.hover + 0.6));
  }

  // Rank 0 = leader. Attack items favour whoever is behind; defensive ones favour the front.
  function rollItem(rank, n) {
    const b = n <= 1 ? 0 : rank / (n - 1);
    const w = { shot: 0.12 + b * 0.15, missile: 0.06 + b * 0.22, rail: 0.05 + b * 0.15, boost: 0.08 + b * 0.2, mine: 0.16 - b * 0.1, cluster: 0.1 - b * 0.06, shield: 0.2 - b * 0.12, emp: 0.08, gravity: 0.06 + b * 0.06, decoy: 0.08 - b * 0.05 };
    let total = 0; for (const k of ITEMS) total += Math.max(0.01, w[k]);
    let r = rng() * total;
    for (const k of ITEMS) { const wk = Math.max(0.01, w[k]); if (r < wk) return k; r -= wk; }
    return 'boost';
  }
  function fwdOf(c) { const cp = ctx.corridor ? Math.cos(c.pitch || 0) : 1, sp = ctx.corridor ? Math.sin(c.pitch || 0) : 0; return [cp * Math.sin(c.heading), sp, cp * Math.cos(c.heading)]; }
  function basisOfCar(c) {
    if (c._basis) return c._basis;
    const fwd = fwdOf(c), up = [0, 1, 0], right = norm(cross(up, fwd));
    return { right, up, fwd, pos: pos3(c) };
  }
  function enginePoints(c) {
    const b = basisOfCar(c), hl = (c.box && c.box.hl) || 2.2, hw = Math.min((c.box && c.box.hw) || 1, 1.2);
    const base = add(add(b.pos, scale(b.fwd, -hl * 0.95)), scale(b.up, 0.45));
    return [add(base, scale(b.right, hw * 0.45)), add(base, scale(b.right, -hw * 0.45))];
  }
  // Targets for homing: cars ahead in a cone, decoys count as cars.
  function findTarget(c, maxDist, cone) {
    const f = fwdOf(c), me = pos3(c);
    let best = null, bd = maxDist;
    const cands = [...ctx.cars.filter(o => o !== c && !(o.wrecked > 0)), ...decoys];
    for (const o of cands) {
      const d = sub(pos3(o), me), dist = len(d);
      if (dist > bd || dist < 1) continue;
      if (dot(d, f) / dist < cone) continue;
      best = o; bd = dist;
    }
    return best;
  }

  function fire(c) {
    const it = c.item; if (!it) return; c.item = null; c.itemCd = 0.4;
    const f = fwdOf(c), b = basisOfCar(c), p = P();
    const sp = Math.hypot(c.vx, c.vy || 0, c.vz);
    const nose = add(add(pos3(c), scale(f, 3)), [0, 0.6, 0]);
    if (it === 'shot') {
      if (projectiles.length >= MAXP) projectiles.shift();
      projectiles.push({ kind: 'shot', x: nose[0], y: nose[1], z: nose[2], vx: f[0] * (95 * SPD + sp), vy: f[1] * (95 * SPD + sp), vz: f[2] * (95 * SPD + sp), owner: c, life: 2.4, t: c.t, col: c.color });
      stats.fired++; if (p) p.muzzle(nose, scale(f, -1), c.color);
      A(a => a.sfx.shot(panOf(nose).pan));
    } else if (it === 'missile') {
      if (projectiles.length >= MAXP) projectiles.shift();
      const target = findTarget(c, 170 * SPD, 0.75), v0 = 70 * SPD + sp * 0.6;
      projectiles.push({ kind: 'missile', x: nose[0], y: nose[1] + 0.3, z: nose[2], vx: f[0] * v0, vy: f[1] * v0 + 2, vz: f[2] * v0, speed: v0, owner: c, life: 5.5, t: c.t, target, col: [1.4, 0.8, 0.4] });
      stats.missiles++; if (p) p.muzzle(nose, scale(f, -1), [1.4, 0.8, 0.4]);
      A(a => a.sfx.missile(panOf(nose).pan));
    } else if (it === 'mine') {
      dropMine(c, add(pos3(c), scale(f, -5)), false);
    } else if (it === 'cluster') {
      for (let k = 0; k < 5; k++) dropMine(c, add(add(pos3(c), scale(f, -(4 + k * 2.2))), scale(b.right, (k - 2) * 3.2 + (rng() - 0.5) * 2)), true);
      stats.clusters++;
    } else if (it === 'shield') { c.shield = 8; stats.shields++; if (p) p.shieldRipple(pos3(c), [0.45, 0.85, 1.2]); A(a => a.sfx.shieldHit(panOf(pos3(c)).pan)); }
    else if (it === 'boost') { c.boost = Math.max(c.boost, 1.6); stats.boosts++; }
    else if (it === 'emp') {
      if (rings.length >= MAXR) rings.shift();
      rings.push({ x: c.x, y: c.y + 0.5, z: c.z, r: 2, maxR: 60 * SPD, speed: 55 * SPD, owner: c, life: 1.3, hit: new Set(), col: [0.5, 0.85, 1.7] });
      stats.emps++; if (p) p.empPulse(pos3(c), 60 * SPD, [0.5, 0.85, 1.7]);
      A(a => a.sfx.emp(panOf(pos3(c)).pan));
      c.shake = Math.max(c.shake, 0.4);
    } else if (it === 'gravity') {
      if (wells.length >= MAXW) wells.shift();
      const at = add(pos3(c), scale(f, 45 * SPD));
      if (!ctx.corridor && ctx.terrain) at[1] = Math.max(at[1], ctx.terrain.heightAt(at[0], at[2]) + 4);
      wells.push({ x: at[0], y: at[1], z: at[2], life: 3, radius: 45, owner: c, col: [0.75, 0.45, 1.6] });
      stats.wells++; A(a => a.sfx.gravity(panOf(at).pan));
    } else if (it === 'rail') {
      const a = nose, end = add(a, scale(f, 220));
      let hitAny = false;
      for (const o of ctx.cars) {
        if (o === c || o.wrecked > 0) continue;
        const w = sub(pos3(o), a), along = dot(w, f);
        if (along < 0 || along > 220) continue;
        const perp = len(sub(w, scale(f, along)));
        if (perp < 3.2) {
          ctx.damage(o, DMG.rail, c);
          if (o.shield <= 0) { ctx.hit(o, 24, null); o.vx *= 0.7; o.vz *= 0.7; }
          hitAny = true; stats.railHits++; if (p) p.hitImpact(pos3(o), 1.4);
        }
      }
      if (hitAny) c.hitMark = 1;
      stats.rails++; c.shake = Math.max(c.shake, 0.5);
      if (p) p.railBeam(a, end, [0.6, 0.9, 1.8]);
      A(au => au.sfx.rail(panOf(a).pan));
    } else if (it === 'decoy') {
      if (decoys.length >= MAXD) decoys.shift();
      decoys.push({ x: c.x, y: c.y, z: c.z, t: c.t, heading: c.heading, speed: Math.max(20, sp * 0.92), life: 10, owner: c, col: c.color, name: (c.name || 'racer') + '*' });
      stats.decoys++; if (p) p.shieldRipple(pos3(c), c.color);
    }
  }
  function dropMine(c, at, cluster) {
    if (mines.length >= MAXM) mines.shift();
    if (!ctx.corridor && ctx.terrain) at[1] = Math.max(at[1], ctx.terrain.heightAt(at[0], at[2]) + 0.5);
    mines.push({ x: at[0], y: at[1], z: at[2], owner: c, arm: cluster ? 0.8 : 0.6, life: cluster ? 20 : 30, col: cluster ? [1.3, 0.55, 0.1] : [1.0, 0.25, 0.1], cluster, pulsed: false });
    stats.mined++;
  }

  function botThink(c, dt) {
    if (!c.item || c.itemCd > 0) return;
    const f = fwdOf(c);
    let aheadClose = false, behindClose = false, near = 0, aheadFar = false, aligned = false;
    for (const o of ctx.cars) {
      if (o === c || o.wrecked > 0) continue;
      const d = sub(pos3(o), pos3(c)), dist = len(d);
      if (dist < 45 * SPD) near++;
      if (dist > 220 * SPD) continue;
      const along = dot(d, f) / dist;
      if (along > 0.9 && dist < 65 * SPD) aheadClose = true;
      if (along > 0.75 && dist < 160 * SPD) aheadFar = true;
      if (along > 0.985 && dist < 200 * SPD) aligned = true;
      if (along < -0.7 && dist < 30 * SPD) behindClose = true;
    }
    const s = c.sample, rank = c.rank || 0;
    const it = c.item;
    if (it === 'shot' && aheadClose) c.useItem = true;
    else if (it === 'missile' && aheadFar) c.useItem = true;
    else if (it === 'rail' && aligned) c.useItem = true;
    else if (it === 'mine' && behindClose) c.useItem = true;
    else if (it === 'cluster' && behindClose) c.useItem = true;
    else if (it === 'emp' && (near >= 2 || (aheadClose && near >= 1))) c.useItem = true;
    else if (it === 'gravity' && aheadClose) c.useItem = true;
    else if (it === 'decoy' && rank <= 1 && behindClose) c.useItem = true;
    else if (it === 'shield' && (c.life < c.lifeMax * 0.4 || behindClose)) c.useItem = true;
    else if (it === 'boost' && s && Math.abs(s.curv) < 0.004 && !c.air) c.useItem = true;
    else if (rng() < dt * 0.05) c.useItem = true; // eventually use whatever it is
  }

  function explode(at, sc, owner, direct, directDmg) {
    const p = P(); if (p) p.explosion(at, sc);
    stats.explosions++;
    { const q = panOf(at); if (q.near > 0.02) A(a => a.sfx.explosion(sc * (0.6 + q.near * 0.7), q.pan)); }
    for (const o of ctx.cars) {
      if (o.wrecked > 0) continue;
      const d = len(sub(pos3(o), at));
      if (o === direct) { ctx.damage(o, directDmg, owner); if (o.shield <= 0) { ctx.hit(o, 20, null); o.vx *= 0.6; o.vz *= 0.6; } }
      else if (d < 9) { ctx.damage(o, DMG.splash * (1 - d / 9) + 4, owner); if (o.shield <= 0) ctx.hit(o, 12, null); }
      if (d < 30) o.shake = Math.max(o.shake, 0.6 * (1 - d / 30));
    }
  }

  function update(dt) {
    if (!ctx) return;
    const cars = ctx.cars, p = P();
    const order = [...cars].sort((a, b) => b.prog - a.prog);
    order.forEach((c, i) => { c.rank = i; });
    // Pickups: respawn timers and collection.
    for (const pk of pickups) {
      if (pk.taken > 0) { pk.taken -= dt; continue; }
      for (const c of cars) {
        if (c.item || c.wrecked > 0) continue;
        const dx = c.x - pk.p[0], dy = c.y - pk.p[1], dz = c.z - pk.p[2];
        if (dx * dx + dy * dy + dz * dz < 3.2 * 3.2) {
          c.item = rollItem(c.rank, cars.length); pk.taken = 6; stats.collected++;
          c.flash = Math.max(c.flash, 0.2); c.itemCd = 0.3;
          if (p) p.pickupSparkle(pk.p, ctx.desc.emis);
          break;
        }
      }
    }
    for (const c of cars) {
      c.itemCd = Math.max(0, c.itemCd - dt);
      if (c.shield > 0) c.shield -= dt;
      if (c.emp > 0) { c.emp -= dt; c.glow *= 0.05; c.boost = 0; if (p && rng() < dt * 12) p.empZap(pos3(c), [0.5, 0.85, 1.7]); }
      if (c.isBot || c.autopilot) botThink(c, dt);
      if (c.useItem && c.itemCd <= 0 && c.wrecked <= 0 && c.stun <= 0) fire(c);
      c.useItem = false;
    }
    // Projectiles (shots and homing missiles).
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.life -= dt;
      if (pr.kind === 'missile') {
        let tgt = pr.target;
        if (tgt && (tgt.wrecked > 0 || (tgt.life !== undefined && tgt.life <= 0 && !tgt.owner))) tgt = pr.target = null;
        let dir = norm([pr.vx, pr.vy, pr.vz]);
        if (tgt) {
          const want = norm(sub(add(pos3(tgt), [0, 0.6, 0]), [pr.x, pr.y, pr.z]));
          dir = norm(add(dir, scale(sub(want, dir), Math.min(1, 3.2 * dt))));
        }
        pr.speed = Math.min(130 * SPD, pr.speed + 30 * SPD * dt);
        pr.vx = dir[0] * pr.speed; pr.vy = dir[1] * pr.speed; pr.vz = dir[2] * pr.speed;
        if (p) p.missileTrail([pr.x, pr.y, pr.z], scale(dir, -1));
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
      let done = pr.life <= 0;
      if (pr.kind === 'shot' && !ctx.corridor) {
        pr.t = World.nearestT(ctx.tab, pr.x, pr.z, pr.t, 20);
        const s = World.sampleAt(ctx.tab, pr.t);
        const lat = (pr.x - s.p[0]) * s.right[0] + (pr.z - s.p[2]) * s.right[2];
        if (Math.abs(lat) < s.w) pr.y = s.p[1] + lat * Math.sin(s.bank) + ctx.desc.physics.hover + 0.6;
        else if (pr.y < ctx.terrain.heightAt(pr.x, pr.z)) done = true;
      } else if (ctx.terrain && pr.y < ctx.terrain.heightAt(pr.x, pr.z) + 0.5) {
        if (pr.kind === 'missile') explode([pr.x, pr.y + 0.5, pr.z], 1.1, pr.owner, null, 0);
        done = true;
      }
      if (!done) {
        // decoys soak missiles
        if (pr.kind === 'missile') for (const d of decoys) {
          if (len(sub([d.x, d.y, d.z], [pr.x, pr.y, pr.z])) < 4) { if (p) p.explosion([pr.x, pr.y, pr.z], 0.7); stats.explosions++; done = true; break; }
        }
      }
      if (!done) for (const c of cars) {
        if (c === pr.owner || c.wrecked > 0) continue;
        const dx = c.x - pr.x, dy = c.y - pr.y, dz = c.z - pr.z, rr = pr.kind === 'missile' ? 3.6 : 2.8;
        if (dx * dx + dy * dy + dz * dz < rr * rr) {
          if (pr.kind === 'missile') { explode([pr.x, pr.y, pr.z], 1.4, pr.owner, c, DMG.missile); stats.missileHits++; }
          else {
            ctx.damage(c, DMG.shot, pr.owner);
            if (c.shield <= 0) { c.vx *= 0.55; c.vz *= 0.55; c.vy *= 0.55; ctx.hit(c, 14, null); }
            if (p) p.hitImpact([pr.x, pr.y, pr.z], 1);
            stats.landed++;
          }
          pr.owner.hitMark = 1; done = true; break;
        }
      }
      if (done) projectiles.splice(i, 1);
    }
    // Mines.
    for (let i = mines.length - 1; i >= 0; i--) {
      const m = mines[i];
      m.arm -= dt; m.life -= dt;
      if (m.arm <= 0 && !m.pulsed) { m.pulsed = true; if (p) p.minePulse([m.x, m.y + 0.3, m.z], m.col); }
      let done = m.life <= 0;
      if (!done && m.arm <= 0) for (const c of cars) {
        if (c.wrecked > 0) continue;
        const dx = c.x - m.x, dy = c.y - m.y, dz = c.z - m.z, rr = m.cluster ? 2.6 : 3.0;
        if (dx * dx + dy * dy + dz * dz < rr * rr) {
          ctx.damage(c, m.cluster ? DMG.cluster : DMG.mine, m.owner);
          if (c.shield <= 0) { ctx.hit(c, m.cluster ? 16 : 22, null); if (!ctx.corridor) { c.vy = Math.max(c.vy, m.cluster ? 4 : 6); c.air = true; } }
          if (m.owner !== c) m.owner.hitMark = 1;
          if (p) p.explosion([m.x, m.y + 0.3, m.z], m.cluster ? 0.7 : 1.0);
          stats.mineHits++; stats.explosions++; done = true; break;
        }
      }
      if (done) mines.splice(i, 1);
    }
    // EMP rings.
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += r.speed * dt; r.life -= dt;
      for (const c of cars) {
        if (c === r.owner || r.hit.has(c) || c.wrecked > 0) continue;
        const d = Math.hypot(c.x - r.x, c.z - r.z, (c.y - r.y) * 0.4);
        if (d < r.r + 2 && d > r.r - 6) {
          r.hit.add(c);
          ctx.damage(c, DMG.emp, r.owner);
          if (c.shield <= 0) { ctx.hit(c, 16, 0); c.emp = 1.6; c.glow = 0; }
          r.owner.hitMark = 1; if (p) p.empZap(pos3(c), r.col);
        }
      }
      if (r.life <= 0 || r.r > r.maxR) rings.splice(i, 1);
    }
    // Gravity wells.
    for (let i = wells.length - 1; i >= 0; i--) {
      const w = wells[i];
      w.life -= dt;
      const center = [w.x, w.y, w.z];
      for (const c of cars) {
        if (c === w.owner || c.wrecked > 0) continue;
        const d = sub(center, pos3(c)), dist = len(d);
        if (dist < w.radius && dist > 0.5) {
          const a = (28 * (1 - dist / w.radius) + 6) * dt, n = scale(d, 1 / dist);
          c.vx += n[0] * a; c.vy = (c.vy || 0) + n[1] * a * (ctx.corridor ? 1 : 0.3); c.vz += n[2] * a;
          c.shake = Math.max(c.shake, 0.15);
        }
      }
      if (p) { p.vortex(center, w.radius * 0.5, w.col); }
      if (w.life <= 0) {
        for (const c of cars) {
          if (c === w.owner || c.wrecked > 0) continue;
          if (len(sub(center, pos3(c))) < 14) { ctx.damage(c, DMG.gravity, w.owner); if (c.shield <= 0) ctx.hit(c, 18, null); w.owner.hitMark = 1; }
        }
        if (p) p.gravityBurst(center, 14, w.col);
        stats.explosions++;
        wells.splice(i, 1);
      }
    }
    // Decoys follow the track.
    for (let i = decoys.length - 1; i >= 0; i--) {
      const d = decoys[i];
      d.life -= dt;
      d.t = (d.t + d.speed * dt / Math.max(1, ctx.tab.length || trackLen(ctx.tab))) % 1;
      const s = World.sampleAt(ctx.tab, d.t);
      d.x = s.p[0]; d.y = s.p[1] + (ctx.corridor ? 0 : ctx.desc.physics.hover); d.z = s.p[2]; d.heading = Math.atan2(s.tan[0], s.tan[2]);
      if (p && rng() < dt * 20) p.ghost([d.x, d.y, d.z], d.col);
      if (d.life <= 0) decoys.splice(i, 1);
    }
    effects(dt);
  }

  // Watch car state each frame and spawn the matching effects.
  function effects(dt) {
    const p = P(); if (!p) return;
    const surface = !ctx.corridor, terrain = ctx.terrain, dustCol = ctx.desc.pal5 ? ctx.desc.pal5[2] : [0.6, 0.55, 0.5];
    for (const c of ctx.cars) {
      const prev = c._fx || (c._fx = { life: c.life, wrecked: 0, shield: 0, shake: 0, wet: 0 });
      const b = basisOfCar(c), pos = b.pos, v = vel3(c), sp = len(v), back = scale(b.fwd, -1);
      const eng = enginePoints(c);
      // Engine trails and boost flames scale with the glow field (throttle, drift charge, boost).
      const g = c.emp > 0 ? 0 : c.glow;
      if (g > 0.25 && c.wrecked <= 0) for (const e of eng) if (rng() < 0.35 + g * 0.5) p.engineTrail(e, back, (g - 0.2) * 1.2, c.color, sp);
      if (c.boost > 0 && c.wrecked <= 0 && c.emp <= 0) for (const e of eng) if (rng() < 0.7) p.boostFlame(e, back, c.color);
      // Drift sparks and dust.
      if (c.drifting && c.wrecked <= 0) {
        if (surface && !c.air) { if (rng() < 0.6) p.driftSparks(add(pos, scale(b.up, -0.6)), v); }
        else if (rng() < 0.4) { const side = c.steer > 0 ? 1 : -1; p.driftSparks(add(add(pos, scale(b.right, side * ((c.box && c.box.hw) || 1.5))), scale(b.up, 0.2)), v); }
      }
      if (terrain && sp > 14 && c.wrecked <= 0) {
        const h = pos[1] - terrain.heightAt(pos[0], pos[2]);
        if ((surface && !c.onRoad && !c.air) || (!surface && h < 4)) { if (rng() < 0.45) p.dust(add(pos, scale(b.up, -0.8)), v, dustCol); }
      }
      // Impacts: shake jumps mean a knock; life drops mean damage.
      if (c.shake - prev.shake > 0.25) p.hitImpact(pos, clamp(c.shake, 0.5, 1.5));
      if (c.life < prev.life - 0.5) p.hitImpact(add(pos, [0, 0.5, 0]), clamp((prev.life - c.life) / 25, 0.6, 1.6));
      if (prev.shield > 0.35 && c.shield <= 0 && c.wrecked <= 0) p.shieldRipple(pos, [0.45, 0.85, 1.2]);
      // Wrecks: one big explosion, then smoke that follows the tumble.
      if (prev.wrecked <= 0 && c.wrecked > 0) { p.explosion(add(pos, [0, 0.8, 0]), 1.7); stats.explosions++; }
      if (c.wrecked > 0 && rng() < 0.8) p.wreckSmoke(pos, v);
      // Water entry.
      if ((c.wet || 0) > 0 && (prev.wet || 0) <= 0) p.splash(pos, v, ctx.desc.water0 || [0.7, 0.85, 1.0]);
      prev.life = c.life; prev.wrecked = c.wrecked || 0; prev.shield = c.shield || 0; prev.shake = c.shake || 0; prev.wet = c.wet || 0;
    }
    p.update(dt);
  }

  // Fill instance buffers. basisOf(c) returns {right, up, fwd, pos}; cached for the effects layer.
  function fill(t, basisOf) {
    if (!ctx) return [];
    const F = Gpu.CAR_FLOATS;
    const put = (buf, k, right, up, fwd, pos, col, sc, glow) => {
      const o = k * F;
      buf.set(right, o); buf.set(up, o + 3); buf.set(fwd, o + 6); buf.set(pos, o + 9); buf.set(col, o + 12);
      buf[o + 15] = 0; buf[o + 16] = 0; buf.set(sc, o + 17); buf[o + 20] = glow; buf[o + 21] = 0; buf[o + 22] = 0;
    };
    const emis = ctx.desc.emis;
    for (const c of ctx.cars) c._basis = basisOf(c);
    pickups.forEach((pk, k) => {
      const a = t * 1.8 + k, cs = Math.cos(a), sn = Math.sin(a);
      const vis = pk.taken > 0 ? 0.001 : 1;
      put(bufs.pick, k, [cs, 0, -sn], [0, 1, 0], [sn, 0, cs], [pk.p[0], pk.p[1] + Math.sin(t * 2 + k) * 0.25, pk.p[2]], [emis[0] * 0.8, emis[1] * 0.8, emis[2] * 0.8], [1.3 * vis, 1.3 * vis, 1.3 * vis], 0.6 + 0.4 * Math.sin(t * 4 + k));
    });
    groups[0].count = pickups.length;
    projectiles.forEach((pr, k) => {
      const f = norm([pr.vx, pr.vy, pr.vz]), r = norm(cross([0, 1, 0], f)), u = cross(f, r);
      if (pr.kind === 'missile') put(bufs.proj, k, r, u, f, [pr.x, pr.y, pr.z], pr.col, [0.55, 0.55, 2.6], 1.2);
      else put(bufs.proj, k, r, u, f, [pr.x, pr.y, pr.z], [1.2, 1.0, 0.6], [0.5, 0.5, 3.2], 1.5);
    });
    groups[1].count = projectiles.length;
    mines.forEach((m, k) => {
      const a = t * 3 + k, cs = Math.cos(a), sn = Math.sin(a), pulse = m.arm > 0 ? 0.2 : 0.6 + 0.6 * Math.abs(Math.sin(t * 6 + k));
      const s = m.cluster ? 0.8 : 1.1;
      put(bufs.mine, k, [cs, 0, -sn], [0, 1, 0], [sn, 0, cs], [m.x, m.y + 0.3, m.z], m.col, [s, s * 0.65, s], pulse);
    });
    groups[2].count = mines.length;
    let sc = 0;
    ctx.cars.forEach(c => {
      if (c.shield <= 0) return;
      const b = c._basis, ringR = 2.4 + (c.box ? Math.max(c.box.hw, c.box.hl) : 2.5) * 0.6;
      const tilt = Math.sin(t * 2.5 + c.id) * 0.25;
      const up2 = norm(add(b.up, scale(b.fwd, tilt)));
      put(bufs.shield, sc++, b.right, b.fwd, up2, b.pos, [0.45, 0.85, 1.2], [ringR, ringR, ringR], 1.2 + 0.4 * Math.sin(t * 8));
    });
    groups[3].count = sc;
    rings.forEach((r, k) => { put(bufs.ring, k, [1, 0, 0], [0, 0, 1], [0, 1, 0], [r.x, r.y, r.z], r.col, [r.r, r.r, r.r], 1.6 * Math.max(0.2, 1 - r.r / r.maxR)); });
    groups[4].count = rings.length;
    let wc = 0;
    wells.forEach((w, k) => {
      const a = t * 4 + k, cs = Math.cos(a), sn = Math.sin(a), R = w.radius * 0.35 * (0.6 + 0.4 * Math.abs(Math.sin(t * 3)));
      put(bufs.well, wc++, [cs, 0, -sn], [sn * 0.5, 0.86, cs * 0.5], [-sn * 0.86, 0.5, -cs * 0.86], [w.x, w.y, w.z], w.col, [R, R, R], 1.4);
      put(bufs.well, wc++, [sn, 0, cs], [0, 1, 0], [-cs, 0, sn], [w.x, w.y, w.z], w.col, [R * 0.6, R * 0.6, R * 0.6], 1.8);
    });
    groups[5].count = wc;
    decoys.forEach((d, k) => {
      const f = [Math.sin(d.heading), 0, Math.cos(d.heading)], r = norm(cross([0, 1, 0], f));
      const fl = 0.5 + 0.5 * Math.sin(t * 9 + k);
      put(bufs.decoy, k, r, [0, 1, 0], f, [d.x, d.y + 0.6, d.z], d.col, [2.0, 0.9, 4.4], 0.25 + fl * 0.3);
    });
    groups[6].count = decoys.length;
    for (const g of groups) if (g.count) Gpu.updateInstances(g.inst, g.data);
    return groups;
  }
  // Test hook: hand every live car an item and make them use it next update.
  function give(item) { if (!ctx) return; for (const c of ctx.cars) { if (c.wrecked > 0) continue; c.item = item; c.itemCd = 0; c.useItem = true; } }
  return {
    build, update, fill, groups: () => groups, ITEMS, DMG, give,
    decoys: () => decoys.map(d => ({ x: d.x, y: d.y, z: d.z, t: d.t, name: d.name, col: d.col, life: d.life })),
    stats: () => ({ ...stats, projectiles: projectiles.length, mines: mines.length, rings: rings.length, wells: wells.length, decoys: decoys.length, particles: P() ? P().stats() : null }),
  };
})();
