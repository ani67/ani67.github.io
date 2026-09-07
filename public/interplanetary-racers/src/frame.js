// Fills the per-frame uniform block. Shared by the game and the design pages. Layout mirrors Shaders.common.
const Frame = (() => {
  const { norm, sub, add, scale, cross, perspective, lookAt, ortho, mul4 } = M;
  function fill(f, d, cam, fx = {}) {
    const fov = cam.fov * Math.PI / 180;
    const view = lookAt(cam.pos, cam.look, cam.up || [0, 1, 0]);
    const proj = perspective(fov, cam.aspect, 0.5, 3000);
    f.set(mul4(proj, view), 0);
    const cf = norm(sub(cam.look, cam.pos)), cr = norm(cross(cf, cam.up || [0, 1, 0])), cu = cross(cr, cf);
    f.set([cam.pos[0], cam.pos[1], cam.pos[2], cam.time], 16);
    f.set([cr[0], cr[1], cr[2], Math.tan(fov / 2)], 20);
    f.set([cu[0], cu[1], cu[2], cam.aspect], 24);
    f.set([cf[0], cf[1], cf[2], fx.speed01 || 0], 28);
    f.set([d.sunDir[0], d.sunDir[1], d.sunDir[2], d.dayTime || 0], 32);
    f.set([d.sky[0][0], d.sky[0][1], d.sky[0][2], d.fog], 36);
    f.set([d.sky[1][0], d.sky[1][1], d.sky[1][2], d.stars], 40);
    for (let k = 0; k < 5; k++) f.set([d.pal5[k][0], d.pal5[k][1], d.pal5[k][2], 0], 44 + k * 4);
    f.set([d.emis[0], d.emis[1], d.emis[2], d.groundPattern], 64);
    f.set([d.twist, d.quantize, d.propType, fx.drift ? 1 : 0], 68);
    f[74] = fx.glow || 0; f[75] = fx.flash || 0;
    f.set([d.look.colormap, d.look.dither, d.look.edge, d.look.posterize], 76);
    f.set([d.bandFreq, d.bandPow, d.bandAmt, d.bright ? 1 : 0], 80);
    // Directional light: orthographic box of half-size S around a centre snapped to the shadow texel grid.
    const L = norm(d.sunDir), S = cam.shadowSize || 200, c0 = cam.shadowCenter || cam.look;
    const texel = (2 * S / 2048) * 4;
    const c = c0.map(v => Math.round(v / texel) * texel);
    const eye = add(c, scale(L, S * 2));
    const lview = lookAt(eye, c, Math.abs(L[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]);
    f.set(mul4(ortho(-S, S, -S, S, 0.5, S * 4), lview), 84);
    // Biome block: env, colour ramps, flora colours.
    const B = d.biome || {}, C = B.colors || {}, R = B.ramp || {};
    const hex = (h, fb) => { if (!h) return fb; return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };
    f.set([d.waterLevel === undefined ? -1e4 : d.waterLevel, B.nebula || 0, B.limb || 0, B.flags || 0], 100);
    f.set([...hex(C.grass, d.pal5[2]), R.highStart === undefined ? 1e4 : R.highStart], 104);
    f.set([...hex(C.rock, d.pal5[1]), R.slope === undefined ? 0.5 : R.slope], 108);
    f.set([...hex(C.high, d.pal5[3]), R.lava || 0], 112);
    f.set([...hex(C.shore, d.pal5[3]), R.shoreBand === undefined ? 2.5 : R.shoreBand], 116);
    f.set([...hex(C.trunk, d.pal5[1]), 0], 120);
    f.set([...hex(C.canopyA, d.pal5[2]), 0], 124);
    f.set([...hex(C.canopyB, d.pal5[3]), 0], 128);
    f.set([...hex(C.rockF, d.pal5[1]), C.flowerHue || 0], 132);
    const wd = hex(C.waterDeep, [d.pal5[1][0] * 0.6 + d.sky[1][0] * 0.3, d.pal5[1][1] * 0.6 + d.sky[1][1] * 0.3, d.pal5[1][2] * 0.6 + d.sky[1][2] * 0.3]);
    const ws = hex(C.waterShallow, d.pal5[3]);
    f.set([...wd, B.rippleScale || 0.12], 136);
    f.set([...ws, B.ripple === undefined ? 0.5 : B.ripple], 140);
  }
  return { fill };
})();
