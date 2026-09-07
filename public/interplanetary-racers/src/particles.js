// Particle VFX: CPU simulated pool, uploaded each frame as camera-facing quads in two blend modes (additive, alpha).
// Types: 0 soft disc (fire/glow), 1 ring (shockwave), 2 spark streak, 3 smoke puff, 4 debris chunk, 5 flash, 6 vortex streak.
const Particles = (() => {
  const { clamp, mix, norm, cross, sub, add, scale, dot, len } = M;
  const MAX = 20000, F = 16; // floats per instance
  const px = new Float32Array(MAX * 3), pv = new Float32Array(MAX * 3), life = new Float32Array(MAX), maxLife = new Float32Array(MAX);
  const s0 = new Float32Array(MAX), s1 = new Float32Array(MAX), col = new Float32Array(MAX * 3), alp = new Float32Array(MAX);
  const rot = new Float32Array(MAX), rotV = new Float32Array(MAX), type = new Uint8Array(MAX), blend = new Uint8Array(MAX), drag = new Float32Array(MAX), grav = new Float32Array(MAX), fade = new Uint8Array(MAX);
  let count = 0;
  const addData = new Float32Array(MAX * F), alphaData = new Float32Array(MAX * F);
  const depthKeys = new Float32Array(MAX), order = new Uint32Array(MAX);
  let addBuf = null, alphaBuf = null, addCount = 0, alphaCount = 0;
  let ground = null, waterLevel = -1e4, lastRun = 0, acc = 0;
  const stats = { live: 0, updateMs: 0, fillMs: 0, spawned: 0 };
  let rng = Math.random;
  const r1 = () => rng() * 2 - 1;
  function randDir() { const z = r1(), a = rng() * 6.2832, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), z, r * Math.sin(a)]; }

  // p: { pos, vel, life, size0, size1, color, alpha, type, blend, rot, rotVel, drag, gravity, fadeIn }
  function spawn(p) {
    let i;
    if (count < MAX) i = count++;
    else { i = Math.floor(rng() * MAX); } // overwrite a random one when full
    px[i * 3] = p.pos[0]; px[i * 3 + 1] = p.pos[1]; px[i * 3 + 2] = p.pos[2];
    const v = p.vel || [0, 0, 0]; pv[i * 3] = v[0]; pv[i * 3 + 1] = v[1]; pv[i * 3 + 2] = v[2];
    life[i] = maxLife[i] = p.life || 1;
    s0[i] = p.size0 === undefined ? 1 : p.size0; s1[i] = p.size1 === undefined ? s0[i] : p.size1;
    const c = p.color || [1, 1, 1]; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    alp[i] = p.alpha === undefined ? 1 : p.alpha; rot[i] = p.rot || rng() * 6.28; rotV[i] = p.rotVel || 0;
    type[i] = p.type || 0; blend[i] = p.blend || 0; drag[i] = p.drag === undefined ? 0.5 : p.drag; grav[i] = p.gravity || 0; fade[i] = p.fadeIn ? 1 : 0;
    stats.spawned++;
    return i;
  }
  function kill(i) {
    count--;
    if (i === count) return;
    for (let k = 0; k < 3; k++) { px[i * 3 + k] = px[count * 3 + k]; pv[i * 3 + k] = pv[count * 3 + k]; col[i * 3 + k] = col[count * 3 + k]; }
    life[i] = life[count]; maxLife[i] = maxLife[count]; s0[i] = s0[count]; s1[i] = s1[count]; alp[i] = alp[count]; rot[i] = rot[count]; rotV[i] = rotV[count];
    type[i] = type[count]; blend[i] = blend[count]; drag[i] = drag[count]; grav[i] = grav[count]; fade[i] = fade[count];
  }
  function setEnv(e) { ground = e.ground || null; waterLevel = e.waterLevel === undefined ? -1e4 : e.waterLevel; if (e.seed !== undefined) rng = M.mulberry32(e.seed >>> 0); }
  function clear() { count = 0; }

  // Integrate. Called with substep dt; runs the sim at most ~120 Hz with accumulated time.
  function update(dt) {
    acc += dt;
    const now = performance.now();
    if (now - lastRun < 7 && acc < 0.03) return;
    lastRun = now;
    const h = Math.min(acc, 0.05); acc = 0;
    const t0 = performance.now();
    for (let i = count - 1; i >= 0; i--) {
      life[i] -= h;
      if (life[i] <= 0) { kill(i); continue; }
      const d = Math.exp(-drag[i] * h);
      pv[i * 3] *= d; pv[i * 3 + 1] = pv[i * 3 + 1] * d - grav[i] * h; pv[i * 3 + 2] *= d;
      px[i * 3] += pv[i * 3] * h; px[i * 3 + 1] += pv[i * 3 + 1] * h; px[i * 3 + 2] += pv[i * 3 + 2] * h;
      rot[i] += rotV[i] * h;
      if (type[i] === 4 && ground) { // debris bounces
        const g = ground(px[i * 3], px[i * 3 + 2]);
        if (px[i * 3 + 1] < g + 0.2) { px[i * 3 + 1] = g + 0.2; pv[i * 3 + 1] = Math.abs(pv[i * 3 + 1]) * 0.4; pv[i * 3] *= 0.6; pv[i * 3 + 2] *= 0.6; rotV[i] *= 0.5; }
      }
    }
    stats.live = count; stats.updateMs = performance.now() - t0;
  }

  // Build instance data. frame is the Float32Array uniform block (camPos at 16..18).
  function fill(frame) {
    const t0 = performance.now();
    const cx = frame[16], cy = frame[17], cz = frame[18];
    addCount = 0; alphaCount = 0;
    let na = 0;
    for (let i = 0; i < count; i++) {
      if (blend[i] === 1) { order[na] = i; depthKeys[na] = -((px[i * 3] - cx) ** 2 + (px[i * 3 + 1] - cy) ** 2 + (px[i * 3 + 2] - cz) ** 2); na++; }
    }
    const put = (data, k, i) => {
      const o = k * F, l = 1 - life[i] / maxLife[i]; // 0 at birth, 1 at death
      const fin = fade[i] ? clamp(l * 6, 0, 1) : 1;
      data[o] = px[i * 3]; data[o + 1] = px[i * 3 + 1]; data[o + 2] = px[i * 3 + 2];
      data[o + 3] = mix(s0[i], s1[i], l);
      data[o + 4] = col[i * 3]; data[o + 5] = col[i * 3 + 1]; data[o + 6] = col[i * 3 + 2];
      data[o + 7] = alp[i] * fin;
      data[o + 8] = pv[i * 3]; data[o + 9] = pv[i * 3 + 1]; data[o + 10] = pv[i * 3 + 2];
      data[o + 11] = rot[i]; data[o + 12] = type[i]; data[o + 13] = l; data[o + 14] = 0; data[o + 15] = 0;
    };
    for (let i = 0; i < count; i++) if (blend[i] === 0) put(addData, addCount++, i);
    // Alpha particles far to near (keys are negative squared distance).
    alphaCount = 0;
    if (na) {
      const pairs = new Array(na);
      for (let k = 0; k < na; k++) pairs[k] = k;
      pairs.sort((a, b) => depthKeys[a] - depthKeys[b]);
      for (let k = 0; k < na; k++) put(alphaData, alphaCount++, order[pairs[k]]);
    }
    if (!addBuf) { addBuf = Gpu.createInstances(addData); alphaBuf = Gpu.createInstances(alphaData); }
    if (addCount) Gpu.updateInstances(addBuf, addData.subarray(0, addCount * F));
    if (alphaCount) Gpu.updateInstances(alphaBuf, alphaData.subarray(0, alphaCount * F));
    stats.fillMs = performance.now() - t0;
    return { add: { inst: addBuf, count: addCount }, alpha: { inst: alphaBuf, count: alphaCount } };
  }

  // ------------------------------------------------------------ effects
  const FIRE = [1.1, 0.45, 0.12], EMBER = [1.0, 0.28, 0.06], SMOKE = [0.16, 0.15, 0.14], SPARK = [1.5, 1.1, 0.5], WHITE = [1.3, 1.25, 1.1];
  function explosion(pos, sc = 1, colour = FIRE) {
    // fireball
    for (let k = 0; k < Math.round(28 * sc); k++) {
      const d = randDir(), sp = 6 + rng() * 14 * sc;
      spawn({ pos, vel: scale(d, sp), life: 0.35 + rng() * 0.45, size0: 1.2 * sc, size1: 3.0 * sc, color: k % 3 === 0 ? [1.2, 0.9, 0.5] : colour, alpha: 0.75, type: 0, drag: 3.5, gravity: -3 });
    }
    // sparks
    for (let k = 0; k < Math.round(40 * sc); k++) {
      const d = randDir(), sp = 18 + rng() * 40 * sc;
      spawn({ pos, vel: scale(d, sp), life: 0.4 + rng() * 0.8, size0: 0.25 * sc, size1: 0.05, color: SPARK, alpha: 1, type: 2, drag: 1.2, gravity: 22 });
    }
    // smoke column
    for (let k = 0; k < Math.round(22 * sc); k++) {
      const d = randDir(), sp = 2 + rng() * 6 * sc;
      spawn({ pos: add(pos, scale(d, 0.6 * sc)), vel: add(scale(d, sp), [0, 4 + rng() * 5, 0]), life: 1.6 + rng() * 2.2, size0: 1.2 * sc, size1: 6.5 * sc, color: SMOKE, alpha: 0.55, type: 3, blend: 1, rotVel: r1() * 1.2, drag: 1.4, gravity: -2.5, fadeIn: true });
    }
    // shockwave ring and flash
    spawn({ pos, vel: [0, 0, 0], life: 0.45, size0: 1 * sc, size1: 22 * sc, color: [1.2, 1.0, 0.8], alpha: 0.9, type: 1, drag: 0 });
    spawn({ pos, vel: [0, 0, 0], life: 0.16, size0: 6 * sc, size1: 12 * sc, color: [1.2, 1.0, 0.7], alpha: 0.7, type: 5, drag: 0 });
    // debris chunks
    for (let k = 0; k < Math.round(10 * sc); k++) {
      const d = randDir(), sp = 8 + rng() * 16 * sc;
      spawn({ pos, vel: add(scale(d, sp), [0, 6 + rng() * 6, 0]), life: 1.5 + rng() * 1.5, size0: 0.35 * sc, size1: 0.25 * sc, color: [0.12, 0.1, 0.09], alpha: 1, type: 4, blend: 1, rotVel: r1() * 12, drag: 0.4, gravity: 26 });
    }
  }
  function engineTrail(pos, back, glow, colour, speed) {
    // short glow streak behind the engine; scales with the glow field
    const g = clamp(glow, 0, 1.5); if (g < 0.05) return;
    const jitter = [r1() * 0.15, r1() * 0.15, r1() * 0.15];
    spawn({ pos: add(pos, jitter), vel: add(scale(back, 6 + speed * 0.15), [0, 0.2, 0]), life: 0.18 + g * 0.22, size0: 0.35 + g * 0.5, size1: 0.05, color: mix3(colour, [1.6, 1.2, 0.6], 0.4), alpha: 0.7 * g, type: 2, drag: 4 });
  }
  function boostFlame(pos, back, colour) {
    for (let k = 0; k < 2; k++) {
      spawn({ pos: add(pos, [r1() * 0.3, r1() * 0.3, r1() * 0.3]), vel: add(scale(back, 14 + rng() * 10), [r1() * 2, r1() * 2, r1() * 2]), life: 0.25 + rng() * 0.2, size0: 0.9, size1: 0.15, color: k ? FIRE : mix3(colour, WHITE, 0.5), alpha: 1, type: 0, drag: 4 });
    }
    if (rng() < 0.4) spawn({ pos, vel: add(scale(back, 8), [0, 2, 0]), life: 0.6, size0: 0.5, size1: 1.8, color: SMOKE, alpha: 0.35, type: 3, blend: 1, drag: 2, fadeIn: true });
  }
  function driftSparks(pos, vel) {
    for (let k = 0; k < 2; k++) spawn({ pos: add(pos, [r1() * 0.6, 0, r1() * 0.6]), vel: add(scale(vel, 0.25), [r1() * 6, 2 + rng() * 5, r1() * 6]), life: 0.3 + rng() * 0.4, size0: 0.14, size1: 0.03, color: SPARK, alpha: 1, type: 2, drag: 1.5, gravity: 20 });
  }
  function dust(pos, vel, colour) {
    spawn({ pos: add(pos, [r1() * 1.2, 0.2, r1() * 1.2]), vel: add(scale(vel, 0.1), [r1() * 2, 1.5 + rng() * 2, r1() * 2]), life: 0.8 + rng() * 0.8, size0: 0.8, size1: 3.2, color: colour, alpha: 0.35, type: 3, blend: 1, rotVel: r1(), drag: 1.5, fadeIn: true });
  }
  function hitImpact(pos, strength = 1) {
    for (let k = 0; k < Math.round(14 * strength); k++) { const d = randDir(); spawn({ pos, vel: scale(d, 8 + rng() * 18), life: 0.3 + rng() * 0.5, size0: 0.2, size1: 0.04, color: SPARK, alpha: 1, type: 2, drag: 1.5, gravity: 18 }); }
    spawn({ pos, vel: [0, 0, 0], life: 0.12, size0: 2.5 * strength, size1: 4 * strength, color: WHITE, alpha: 0.9, type: 5, drag: 0 });
    for (let k = 0; k < 3; k++) spawn({ pos, vel: [r1() * 3, 2 + rng() * 3, r1() * 3], life: 0.9, size0: 0.6, size1: 2.4, color: SMOKE, alpha: 0.4, type: 3, blend: 1, drag: 1.5, fadeIn: true });
  }
  function shieldRipple(pos, colour) {
    spawn({ pos, vel: [0, 0, 0], life: 0.5, size0: 3, size1: 9, color: colour, alpha: 0.9, type: 1, drag: 0 });
    spawn({ pos, vel: [0, 0, 0], life: 0.25, size0: 4, size1: 6, color: colour, alpha: 0.6, type: 5, drag: 0 });
    for (let k = 0; k < 16; k++) { const d = randDir(); spawn({ pos: add(pos, scale(d, 2.5)), vel: scale(d, 6), life: 0.4, size0: 0.3, size1: 0.05, color: colour, alpha: 1, type: 0, drag: 2 }); }
  }
  function wreckSmoke(pos, vel) {
    spawn({ pos: add(pos, [r1() * 0.8, 0.5, r1() * 0.8]), vel: add(scale(vel, 0.3), [r1() * 2, 3 + rng() * 3, r1() * 2]), life: 1.2 + rng() * 1.5, size0: 0.9, size1: 4.5, color: [0.1, 0.09, 0.09], alpha: 0.6, type: 3, blend: 1, rotVel: r1(), drag: 1.2, gravity: -2, fadeIn: true });
    if (rng() < 0.5) spawn({ pos, vel: add(scale(vel, 0.4), [r1() * 3, 2 + rng() * 4, r1() * 3]), life: 0.3 + rng() * 0.3, size0: 0.6, size1: 0.1, color: EMBER, alpha: 1, type: 0, drag: 2 });
    if (rng() < 0.3) spawn({ pos, vel: [r1() * 6, 3 + rng() * 5, r1() * 6], life: 0.6, size0: 0.15, size1: 0.03, color: SPARK, alpha: 1, type: 2, drag: 1, gravity: 20 });
  }
  function pickupSparkle(pos, colour) {
    for (let k = 0; k < 18; k++) { const d = randDir(); spawn({ pos, vel: scale(d, 4 + rng() * 6), life: 0.5 + rng() * 0.4, size0: 0.3, size1: 0.04, color: mix3(colour, WHITE, 0.5), alpha: 1, type: 0, drag: 2.5 }); }
    spawn({ pos, vel: [0, 0, 0], life: 0.35, size0: 1.5, size1: 6, color: colour, alpha: 0.8, type: 1, drag: 0 });
  }
  function minePulse(pos, colour) {
    spawn({ pos, vel: [0, 0, 0], life: 0.6, size0: 0.8, size1: 5, color: colour, alpha: 0.7, type: 1, drag: 0 });
  }
  function splash(pos, vel, colour) {
    for (let k = 0; k < 24; k++) spawn({ pos, vel: add(scale(vel, 0.3), [r1() * 7, 5 + rng() * 9, r1() * 7]), life: 0.6 + rng() * 0.6, size0: 0.35, size1: 0.9, color: colour, alpha: 0.85, type: 0, blend: 1, drag: 1, gravity: 22 });
    spawn({ pos, vel: [0, 0, 0], life: 0.7, size0: 2, size1: 12, color: colour, alpha: 0.6, type: 1, drag: 0 });
  }
  function missileTrail(pos, back) {
    spawn({ pos: add(pos, [r1() * 0.2, r1() * 0.2, r1() * 0.2]), vel: add(scale(back, 4), [r1() * 1.5, 0.8 + rng(), r1() * 1.5]), life: 0.9 + rng() * 0.6, size0: 0.5, size1: 2.6, color: [0.55, 0.53, 0.5], alpha: 0.5, type: 3, blend: 1, rotVel: r1() * 2, drag: 1.5, fadeIn: true });
    spawn({ pos, vel: scale(back, 10), life: 0.15, size0: 0.9, size1: 0.2, color: FIRE, alpha: 1, type: 0, drag: 5 });
  }
  function empPulse(pos, radius, colour) {
    spawn({ pos, vel: [0, 0, 0], life: 0.9, size0: 2, size1: radius * 2.2, color: colour, alpha: 0.45, type: 1, drag: 0 });
    spawn({ pos, vel: [0, 0, 0], life: 0.25, size0: 4, size1: 10, color: colour, alpha: 0.3, type: 5, drag: 0 });
    for (let k = 0; k < 30; k++) { const a = rng() * 6.2832; const d = [Math.cos(a), r1() * 0.15, Math.sin(a)]; spawn({ pos, vel: scale(d, radius * 0.9), life: 0.9, size0: 0.22, size1: 0.04, color: colour, alpha: 0.45, type: 2, drag: 0.2 }); }
  }
  function empZap(pos, colour) {
    for (let k = 0; k < 6; k++) { const d = randDir(); spawn({ pos: add(pos, scale(d, 1.5)), vel: scale(d, 3), life: 0.15 + rng() * 0.2, size0: 0.5, size1: 0.1, color: colour, alpha: 1, type: 2, drag: 2 }); }
  }
  function vortex(center, radius, colour) {
    // swirling streaks that spiral inward; callers run this every update, so keep the rate low
    if (rng() > 0.25) return;
    for (let k = 0; k < 2; k++) {
      const a = rng() * 6.2832, r = radius * (0.5 + rng() * 0.6), el = r1() * 0.5;
      const p = [center[0] + Math.cos(a) * r, center[1] + el * r * 0.4, center[2] + Math.sin(a) * r];
      const tang = [-Math.sin(a), 0, Math.cos(a)], inward = norm(sub(center, p));
      spawn({ pos: p, vel: add(scale(tang, 14), scale(inward, 9)), life: 0.5 + rng() * 0.5, size0: 0.3, size1: 0.05, color: colour, alpha: 0.55, type: 6, drag: 0.4 });
    }
    if (rng() < 0.5) spawn({ pos: center, vel: [0, 0, 0], life: 0.25, size0: 2.5, size1: 3.5, color: [0.15, 0.05, 0.3], alpha: 0.7, type: 0, blend: 1, drag: 0 });
  }
  function gravityBurst(center, radius, colour) {
    spawn({ pos: center, vel: [0, 0, 0], life: 0.5, size0: 2, size1: radius * 2, color: colour, alpha: 1, type: 1, drag: 0 });
    spawn({ pos: center, vel: [0, 0, 0], life: 0.25, size0: 6, size1: 14, color: WHITE, alpha: 1, type: 5, drag: 0 });
    for (let k = 0; k < 50; k++) { const d = randDir(); spawn({ pos: center, vel: scale(d, 20 + rng() * 25), life: 0.6 + rng() * 0.5, size0: 0.4, size1: 0.05, color: colour, alpha: 1, type: 2, drag: 1 }); }
  }
  function railBeam(a, b, colour) {
    const d = sub(b, a), L = len(d), n = Math.max(8, Math.round(L / 2.5)), dir = scale(d, 1 / L);
    for (let k = 0; k <= n; k++) {
      const p = add(a, scale(d, k / n));
      spawn({ pos: p, vel: scale(dir, 30), life: 0.35, size0: 0.8, size1: 0.15, color: WHITE, alpha: 1, type: 2, drag: 80 });      // bright core (stretched along the beam)
      spawn({ pos: p, vel: [0, 0, 0], life: 0.9, size0: 1.4, size1: 3.0, color: colour, alpha: 0.35, type: 0, drag: 0 });        // afterglow
      if (k % 3 === 0) spawn({ pos: p, vel: [r1() * 2, 1 + rng(), r1() * 2], life: 1.2, size0: 0.4, size1: 1.6, color: [0.5, 0.5, 0.55], alpha: 0.3, type: 3, blend: 1, drag: 1, fadeIn: true });
    }
    spawn({ pos: a, vel: [0, 0, 0], life: 0.15, size0: 3, size1: 5, color: WHITE, alpha: 1, type: 5, drag: 0 });
  }
  function muzzle(pos, back, colour) {
    spawn({ pos, vel: [0, 0, 0], life: 0.1, size0: 2, size1: 3, color: mix3(colour, WHITE, 0.5), alpha: 1, type: 5, drag: 0 });
    for (let k = 0; k < 6; k++) spawn({ pos, vel: add(scale(back, -6), [r1() * 4, r1() * 4, r1() * 4]), life: 0.2, size0: 0.3, size1: 0.05, color: SPARK, alpha: 1, type: 2, drag: 3 });
  }
  function ghost(pos, colour) {
    spawn({ pos: add(pos, [r1() * 1.5, r1() * 0.6, r1() * 1.5]), vel: [r1() * 0.5, 0.4, r1() * 0.5], life: 0.5, size0: 1.2, size1: 2.2, color: colour, alpha: 0.35, type: 0, drag: 1 });
  }
  function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }

  return { spawn, update, fill, setEnv, clear, stats: () => ({ ...stats }), MAX, F,
    explosion, engineTrail, boostFlame, driftSparks, dust, hitImpact, shieldRipple, wreckSmoke, pickupSparkle, minePulse, splash, missileTrail, empPulse, empZap, vortex, gravityBurst, railBeam, muzzle, ghost };
})();
