// WGSL sources. Frame uniform layout mirrors Gpu.writeFrame in gpu.js.
const Shaders = (() => {
  const common = /* wgsl */`
struct Frame {
  viewProj : mat4x4f,
  camPos : vec4f,    // xyz, w = time
  camRight : vec4f,  // xyz, w = tanHalfFov
  camUp : vec4f,     // xyz, w = aspect
  camFwd : vec4f,    // xyz, w = speed01
  sunDir : vec4f,    // xyz, w = dayTime
  skyA : vec4f,      // horizon rgb, w = fogDensity
  skyB : vec4f,      // zenith rgb, w = stars
  pal0 : vec4f, pal1 : vec4f, pal2 : vec4f, pal3 : vec4f, pal4 : vec4f, // palette dark -> light
  emis : vec4f,      // emissive rgb, w = ground pattern (0 none, 1 grid, 2 circuit)
  params : vec4f,    // twist, quantize, propType, drift01
  res : vec4f,       // width, height, boostGlow, hitFlash
  look : vec4f,      // colormap amount, dither, edge, posterize levels
  sky2 : vec4f,      // band freq, band pow, band amount, bright
  lightVP : mat4x4f, // directional light view-projection (orthographic)
  env : vec4f,       // water level, nebula amount, planet limb, biome flags (1 ramp, 2 patchwork, 4 striated, 8 falls, 16 lava)
  ramp0 : vec4f,     // grass rgb, w = high start (world y)
  ramp1 : vec4f,     // rock rgb, w = slope threshold
  ramp2 : vec4f,     // high rgb, w = lava amount
  ramp3 : vec4f,     // shore rgb, w = shore band
  flora0 : vec4f,    // trunk rgb
  flora1 : vec4f,    // canopy A rgb
  flora2 : vec4f,    // canopy B rgb
  flora3 : vec4f,    // rock rgb, w = flower hue
  water0 : vec4f,    // deep water rgb, w = ripple scale
  water1 : vec4f,    // shallow water rgb, w = ripple strength
};
@group(0) @binding(0) var<uniform> F : Frame;

fn palette(t0 : f32) -> vec3f {
  var cols = array<vec3f, 5>(F.pal0.xyz, F.pal1.xyz, F.pal2.xyz, F.pal3.xyz, F.pal4.xyz);
  let t = clamp(t0, 0.0, 0.9999) * 4.0;
  let i = u32(floor(t));
  let f = t - floor(t);
  let s = f * f * (3.0 - 2.0 * f);
  return mix(cols[i], cols[min(i + 1u, 4u)], s);
}
fn luma(c : vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
fn bayer4(p : vec2f) -> f32 {
  let x = i32(p.x) & 3; let y = i32(p.y) & 3;
  let m = array<f32, 16>(0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[y * 4 + x] + 0.5) / 16.0;
}
fn hash21(p : vec2f) -> f32 {
  var q = fract(p * vec2f(123.34, 456.21));
  q = q + dot(q, q + 45.32);
  return fract(q.x * q.y);
}
fn vnoise(p : vec2f) -> f32 {
  let i = floor(p); let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash21(i); let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0)); let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
fn fbm(p0 : vec2f) -> f32 {
  var p = p0; var s = 0.0; var a = 0.5;
  for (var i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
struct FsOut { @location(0) col : vec4f, @location(1) nd : vec4f };

struct VOut {
  @builtin(position) pos : vec4f,
  @location(0) wp : vec3f,
  @location(1) n : vec3f,
  @location(2) uv : vec2f,
  @location(3) ex : vec4f,
  @location(4) tint : vec4f,
  @location(5) extra : vec4f, // craft: damage, shield
};
`;

  const scene = common + /* wgsl */`
@group(0) @binding(1) var shadowTex : texture_depth_2d;
@group(0) @binding(2) var shadowSamp : sampler_comparison;

override WITH_SHADOWS: bool = true;
// Cel shading with a shadow map: three bands (lit, half, shadow) and a hard terminator.
fn shadowFactor(wp : vec3f, n : vec3f, ndl : f32) -> f32 {
  if (!WITH_SHADOWS) { return 1.0; }
  let texel = 2.0 / f32(textureDimensions(shadowTex).x);
  let lp = F.lightVP * vec4f(wp + n * (0.35 + 0.6 * (1.0 - ndl)), 1.0);
  let uv = vec2f(lp.x * 0.5 + 0.5, 0.5 - lp.y * 0.5);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || lp.z > 1.0) { return 1.0; }
  let refZ = lp.z - 0.0012;
  var s = 0.0;
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    s += textureSampleCompareLevel(shadowTex, shadowSamp, uv + vec2f(f32(x), f32(y)) * texel, refZ);
  } }
  return s / 9.0;
}
fn shade(albedo : vec3f, n0 : vec3f, wp : vec3f, emis : vec3f, gloss : f32) -> vec4f {
  let n = normalize(n0);
  let L = normalize(F.sunDir.xyz);
  let V = normalize(F.camPos.xyz - wp);
  let H = normalize(L + V);
  let ndl = dot(n, L);
  let sh = shadowFactor(wp, n, max(ndl, 0.0));
  let lit = max(ndl, 0.0) * sh;
  // Bands with a slightly soft terminator.
  let band = smoothstep(0.08, 0.14, lit) * 0.5 + smoothstep(0.42, 0.5, lit) * 0.5;
  let sunCol = mix(vec3f(1.0, 0.96, 0.88), F.skyA.xyz, 0.25) * 1.15;
  // Designed biomes keep their own hues in shadow; palette worlds tint shadows with the palette's dark colour.
  let ramped = (u32(F.env.w + 0.5) & 1u) != 0u;
  let shadowCol = select(mix(F.pal0.xyz * 0.9, albedo * 0.5, 0.45), albedo * 0.42 + F.ramp1.xyz * 0.08, ramped) + F.skyB.xyz * 0.06;
  let litCol = albedo * sunCol;
  var col = mix(shadowCol, litCol, band);
  let specRaw = pow(max(dot(n, H), 0.0), 24.0 + gloss * 60.0);
  let spec = step(0.55, specRaw) * (0.1 + gloss * 0.35) * band;
  let fres = pow(1.0 - max(dot(n, V), 0.0), 4.0) * 0.2 * gloss;
  col += (spec + fres) * sunCol + emis;
  let dist = length(F.camPos.xyz - wp);
  let fog = 1.0 - exp(-dist * F.skyA.w);
  return vec4f(mix(col, F.skyA.xyz, fog), band);
}

struct VIn {
  @location(0) p : vec3f, @location(1) n : vec3f, @location(2) uv : vec2f, @location(3) ex : vec4f,
};
fn staticWorld(v : VIn) -> VOut {
  var o : VOut;
  o.wp = v.p; o.n = v.n; o.uv = v.uv; o.ex = v.ex; o.tint = vec4f(1.0);
  return o;
}
@vertex fn vsStatic(v : VIn) -> VOut { var o = staticWorld(v); o.pos = F.viewProj * vec4f(o.wp, 1.0); return o; }
@vertex fn vsStaticShadow(v : VIn) -> @builtin(position) vec4f { let o = staticWorld(v); return F.lightVP * vec4f(o.wp, 1.0); }

// Props: instance = pos3, scale3, rotY, seed
struct PropIn {
  @location(0) p : vec3f, @location(1) n : vec3f, @location(2) uv : vec2f, @location(3) ex : vec4f,
  @location(4) ipos : vec3f, @location(5) iscl : vec3f, @location(6) irot : f32, @location(7) iseed : f32,
};
fn rotY(p : vec3f, a : f32) -> vec3f {
  let c = cos(a); let s = sin(a);
  return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
fn propWorld(v : PropIn) -> VOut {
  var o : VOut;
  var p = v.p * v.iscl;
  var n = normalize(v.n / max(v.iscl, vec3f(1e-3)));
  // Geometry filters: twist around the local Y axis, breathing, optional quantize.
  let t = F.camPos.w;
  let breathe = 1.0 + 0.04 * sin(t * 1.3 + v.iseed * 20.0) * v.p.y;
  p = vec3f(p.x * breathe, p.y, p.z * breathe);
  let tw = v.irot + p.y * F.params.x * 4.0;
  p = rotY(p, tw); n = rotY(n, tw);
  if (v.ex.y > 9.5) {
    // Flora: wind sway grows with height; clouds drift and bob.
    let part = v.ex.z;
    if (part == 7.0) { p.y += sin(t * 0.4 + v.iseed * 12.0) * 0.6; }
    else if (part != 2.0 && part != 5.0) {
      let sw = sin(t * 1.3 + v.ipos.x * 0.05 + v.ipos.z * 0.07 + v.iseed * 3.0) * 0.035 * v.p.y * v.p.y;
      p = vec3f(p.x + sw * v.iscl.x, p.y, p.z + sw * 0.6 * v.iscl.z);
    }
  }
  var wp = p + v.ipos;
  let q = F.params.y;
  if (q > 0.0) { wp = floor(wp / q + 0.5) * q; }
  o.wp = wp; o.n = n; o.uv = vec2f(v.p.y, v.uv.y); o.ex = v.ex; o.tint = vec4f(v.iseed, v.iscl.y, 0.0, 0.0);
  return o;
}
@vertex fn vsProp(v : PropIn) -> VOut { var o = propWorld(v); o.pos = F.viewProj * vec4f(o.wp, 1.0); return o; }
@vertex fn vsPropShadow(v : PropIn) -> @builtin(position) vec4f { let o = propWorld(v); return F.lightVP * vec4f(o.wp, 1.0); }

// Cars: instance = right3, up3, fwd3, pos3, color3, spin, steer, bodyScale3, glow (24 floats)
struct CarIn {
  @location(0) p : vec3f, @location(1) n : vec3f, @location(2) uv : vec2f, @location(3) ex : vec4f,
  @location(4) iright : vec3f, @location(5) iup : vec3f, @location(6) ifwd : vec3f, @location(7) ipos : vec3f,
  @location(8) icol : vec3f, @location(9) ispin : f32, @location(10) isteer : f32, @location(11) ibody : vec3f, @location(12) iglow : f32,
  @location(13) idmg : f32, @location(14) ishield : f32,
};
fn rotX(p : vec3f, a : f32) -> vec3f {
  let c = cos(a); let s = sin(a);
  return vec3f(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}
fn carWorld(v : CarIn) -> VOut {
  var o : VOut;
  var p = v.p; var n = v.n;
  let part = v.ex.y;
  if (part == 1.0 || part == 2.0) {
    let pivot = vec3f(v.uv.x, v.uv.y, v.ex.z);
    var q = p - pivot;
    q = rotX(q, -v.ispin); n = rotX(n, -v.ispin);
    if (part == 1.0) { q = rotY(q, -v.isteer); n = rotY(n, -v.isteer); }
    p = q + pivot;
    p = vec3f(p.x * v.ibody.x, p.y, p.z * v.ibody.z);
  } else {
    p = p * v.ibody; n = normalize(n / v.ibody);
  }
  let wp = v.ipos + v.iright * p.x + v.iup * p.y + v.ifwd * p.z;
  let wn = v.iright * n.x + v.iup * n.y + v.ifwd * n.z;
  o.wp = wp; o.n = wn; o.uv = v.uv; o.ex = v.ex; o.tint = vec4f(v.icol, v.iglow);
  o.extra = vec4f(v.idmg, v.ishield, 0.0, 0.0);
  return o;
}
@vertex fn vsCar(v : CarIn) -> VOut { var o = carWorld(v); o.pos = F.viewProj * vec4f(o.wp, 1.0); return o; }
@vertex fn vsCarShadow(v : CarIn) -> @builtin(position) vec4f { let o = carWorld(v); return F.lightVP * vec4f(o.wp, 1.0); }

@fragment fn fsScene(i : VOut) -> FsOut {
  let mat = i.ex.x;
  var albedo = vec3f(0.5);
  var emis = vec3f(0.0);
  var gloss = 0.0;
  let time = F.camPos.w;
  if (mat < 0.5) {
    // Terrain: palette roles. Ground = mid colour, rock (steep) = dark colour, high flats = light colour.
    let h = i.ex.y;
    let nz = fbm(i.uv * 0.02);
    let slope = 1.0 - normalize(i.n).y;
    let rockMask = smoothstep(0.16, 0.28, slope + (nz - 0.5) * 0.08);
    let topMask = smoothstep(0.5, 0.66, h + (nz - 0.5) * 0.1) * (1.0 - rockMask);
    albedo = mix(mix(F.pal2.xyz, F.pal1.xyz, rockMask), F.pal3.xyz, topMask);
    let flags = u32(F.env.w + 0.5);
    if ((flags & 1u) != 0u) {
      // Biome colour ramp: grass on flat, rock on steep, high colour above a height, shore near water.
      let y = i.wp.y; let wl = F.env.x;
      let rockM = smoothstep(F.ramp1.w - 0.1, F.ramp1.w + 0.1, slope + (nz - 0.5) * 0.12);
      var col = mix(F.ramp0.xyz, F.ramp1.xyz, rockM);
      let highM = smoothstep(F.ramp0.w - 6.0, F.ramp0.w + 6.0, y + (nz - 0.5) * 10.0) * (1.0 - rockM * 0.6);
      col = mix(col, F.ramp2.xyz, highM);
      if ((flags & 4u) != 0u) { let bandS = step(0.5, fract(y / 6.5 + nz * 0.4)); col = mix(col, col * 0.72, bandS * rockM); }
      if ((flags & 2u) != 0u) {
        let cid = hash21(floor(i.uv / 36.0));
        let flatM = 1.0 - smoothstep(0.06, 0.16, slope);
        let field = mix(col * 0.85, mix(F.ramp2.xyz, F.ramp0.xyz, 0.5) * 1.05, fract(cid * 7.0));
        col = mix(col, field, flatM * 0.65 * step(0.3, cid));
        let gl = abs(fract(i.uv / 36.0) - 0.5);
        col = mix(col, col * 0.6, (1.0 - smoothstep(0.0, 0.025, min(gl.x, gl.y))) * flatM * 0.7);
      }
      let shoreM = smoothstep(wl + F.ramp3.w, wl + 0.15, y);
      col = mix(col, F.ramp3.xyz, shoreM);
      col = mix(col, col * 0.7, smoothstep(wl + 0.2, wl - 3.0, y));
      if ((flags & 8u) != 0u) {
        let f = step(0.86, vnoise(vec2f(i.uv.x * 0.09, i.uv.y * 0.09) + 3.0)) * rockM * smoothstep(0.32, 0.5, slope);
        col = mix(col, vec3f(0.95, 0.97, 1.0), f); emis += vec3f(0.35) * f;
      }
      if ((flags & 16u) != 0u) {
        let crack = 1.0 - smoothstep(0.0, 0.07, abs(vnoise(i.uv * 0.045) * 2.0 - 1.0));
        let low = smoothstep(wl + 16.0, wl + 1.0, y);
        let pulse = 0.8 + 0.2 * sin(time * 2.0 + i.uv.x * 0.1);
        emis += vec3f(1.4, 0.35, 0.05) * crack * low * F.ramp2.w * pulse;
      }
      albedo = col;
    }
    albedo *= 0.94 + 0.12 * nz;
    let dist = length(F.camPos.xyz - i.wp);
    if (F.emis.w > 0.5 && F.emis.w < 1.5) {
      let g = abs(fract(i.uv / 20.0) - 0.5);
      let line = 1.0 - smoothstep(0.0, 0.03, min(g.x, g.y));
      emis = F.emis.xyz * line * 0.6 * exp(-dist * 0.004);
      albedo = albedo * 0.35;
    } else if (F.emis.w > 1.5) {
      // Circuit pattern: several pixel-noise layers combined with lighten, plus thin traces.
      var pat = 0.0;
      let scales = array<f32, 3>(0.018, 0.045, 0.11);
      for (var k = 0; k < 3; k++) {
        let c = floor(i.uv * scales[k]);
        pat = max(pat, step(0.74, hash21(c + f32(k) * 7.1)));
      }
      let tr = abs(fract(i.uv.x * 0.06) - 0.5) < 0.03 || abs(fract(i.uv.y * 0.06) - 0.5) < 0.03;
      let trace = select(0.0, step(0.6, hash21(floor(i.uv * 0.06) + 3.3)), tr);
      albedo = mix(albedo, palette(0.85), pat * 0.6);
      emis = F.emis.xyz * (trace * 0.35 + pat * 0.12) * exp(-dist * 0.003);
    }
  } else if (mat < 1.5) {
    // Track ribbon.
    let u = i.uv.x; let v = i.uv.y; let tp = i.ex.y;
    if (i.ex.w < -5.0) {
      albedo = palette(0.2 + fract(tp * 3.0) * 0.3) * 0.7; gloss = 0.2;
    } else {
      let grain = vnoise(vec2f(u * 40.0, v * 80.0)) * 0.05;
      albedo = vec3f(0.055, 0.06, 0.07) + grain;
      gloss = 0.35;
      let au = abs(u);
      // Edge stripes alternate emissive palette / white.
      let edge = smoothstep(0.92, 0.935, au);
      let alt = step(0.5, fract(v * 2.0));
      let stripe = mix(F.emis.xyz * 0.9, vec3f(0.9), alt);
      emis += stripe * edge * 0.7;
      // Center dashes.
      let dash = (1.0 - smoothstep(0.02, 0.035, au)) * step(0.5, fract(v * 1.0));
      emis += F.emis.xyz * dash * 0.35;
      // Boost pads: same rule as physics (fract(t*6+0.5) < 0.015, |u| < 0.6).
      let pad = step(0.5, i.ex.w) * (1.0 - smoothstep(0.55, 0.62, au));
      let chevron = step(0.5, fract((v * 6.0 - au * 2.0) + time * 3.0));
      emis += F.emis.xyz * pad * (1.5 + chevron * 1.5);
      // Start / finish checker.
      let sf = step(tp, 0.0025) + step(0.9975, tp);
      let ch = step(0.5, fract(u * 3.0)) + step(0.5, fract(v * 6.0));
      let checker = abs(fract(ch * 0.5) * 2.0 - 1.0);
      albedo = mix(albedo, vec3f(0.05 + 0.55 * checker), sf);
    }
  } else if (mat < 2.5) {
    let seed = i.tint.x; let y = i.uv.x;
    let ptype = i.ex.y;
    if (ptype > 9.5) {
      // Flora and dressing: part 0 trunk, 1 canopy, 2 rock, 3 flower, 4 lily, 5 building, 6 grass, 7 cloud, 8 reed.
      let part = i.ex.z; let sv = 0.85 + 0.3 * fract(seed * 5.3);
      if (part == 0.0 || part == 8.0) { albedo = F.flora0.xyz * sv; gloss = 0.1; }
      else if (part == 1.0 || part == 4.0 || part == 6.0) { albedo = mix(F.flora1.xyz, F.flora2.xyz, fract(seed * 3.1)) * sv; if (part == 6.0) { albedo *= 1.12; } gloss = 0.15; }
      else if (part == 2.0) { albedo = F.flora3.xyz * sv; gloss = 0.3; }
      else if (part == 3.0) { albedo = palette(fract(F.flora3.w + seed * 0.25)) * 1.25; emis = albedo * 0.2; }
      else if (part == 5.0) { albedo = mix(F.pal4.xyz, F.pal3.xyz, 0.35) * sv; gloss = 0.4; emis = F.emis.xyz * 0.5 * step(0.8, hash21(floor(vec2f(y * 5.0, i.wp.x * 0.7 + i.wp.z * 0.4)))) * step(0.3, y); }
      else if (part == 7.0) { albedo = vec3f(0.97, 0.97, 0.99); emis = vec3f(0.22); gloss = 0.0; if ((u32(F.env.w + 0.5) & 16u) != 0u) { albedo = F.ramp2.xyz * 1.3; emis = vec3f(0.02); } }
    } else {
      // Props: palette by seed and height, emissive rim lines.
      albedo = mix(F.pal1.xyz, F.pal3.xyz, step(0.5, fract(seed * 3.7))) * (0.9 + 0.2 * fract(seed * 9.1));
      gloss = 0.5;
      let lines = 1.0 - smoothstep(0.0, 0.05, abs(fract(y * 2.0 - time * 0.2 * (seed - 0.5)) - 0.5) * 2.0 - 0.0);
      let pulse = 0.5 + 0.5 * sin(time * 2.0 + seed * 30.0 + y * 6.0);
      emis = F.emis.xyz * lines * (0.3 + pulse * 0.5) * step(0.5, fract(seed * 7.0) + 0.3);
      if (ptype == 2.0) { emis += F.emis.xyz * 0.6; albedo = albedo * 0.4; }
      if (i.ex.z > 0.5 && ptype == 0.0) { emis += F.emis.xyz * 1.2; }
      if (ptype == 3.0) { albedo = mix(albedo, palette(fract(seed + 0.3)), y); emis = emis * 0.3; }
    }
  } else {
    // Cars.
    let part = i.ex.y; let col = i.tint.xyz; let glow = i.tint.w;
    let tone2 = i.ex.z; let stripeF = i.ex.w; let wear = i.uv.y;
    if (part == 0.0) {
      // Secondary paint tone, stripe band, belly dirt and edge chips.
      let col2 = mix(col.zxy * 0.8, vec3f(0.92, 0.9, 0.85), 0.45);
      albedo = mix(col, col2, tone2);
      let stripeCol = select(vec3f(0.12), vec3f(0.95, 0.93, 0.85), luma(col) < 0.45);
      albedo = mix(albedo, stripeCol, stripeF * 0.9);
      let dirt = smoothstep(0.55, 1.0, wear) * (0.35 + 0.65 * vnoise(i.wp.xz * 3.0 + i.wp.y));
      let chip = step(0.86, vnoise(i.wp.xy * 9.0 + i.wp.z * 7.0)) * 0.5;
      albedo = mix(albedo, albedo * 0.45, dirt * 0.6);
      albedo = mix(albedo, vec3f(0.35, 0.33, 0.3), chip * 0.7);
      gloss = 0.9 - dirt * 0.5;
      // Damage: scorch blotches grow with the damage level, paint dulls.
      let dmg = i.extra.x;
      let scorch = smoothstep(1.0 - dmg * 1.1, 1.0 - dmg * 1.1 + 0.25, vnoise(i.wp.xz * 2.2 + i.wp.y * 1.7) * 0.7 + vnoise(i.wp.xy * 6.0) * 0.3);
      albedo = mix(albedo, vec3f(0.08, 0.07, 0.06), scorch * min(1.0, dmg * 1.5));
      albedo = mix(albedo, albedo * 0.7, dmg * 0.5);
      gloss = gloss * (1.0 - dmg * 0.6);
    }
    else if (part == 1.0 || part == 2.0) { albedo = vec3f(0.04); gloss = 0.3; }
    else if (part == 3.0) {
      let tail = i.ex.w;
      emis = mix(vec3f(1.6, 1.6, 1.5), vec3f(2.0, 0.15, 0.1), tail) * (1.0 + glow * 2.0);
      albedo = vec3f(0.1);
    }
    else if (part == 4.0) { albedo = vec3f(0.02, 0.03, 0.05); gloss = 0.5; }
    else if (part == 6.0) { emis = mix(F.emis.xyz, col, 0.4) * (0.25 + glow * 0.7) * (1.0 - i.extra.x * 0.8); albedo = vec3f(0.05); }
    else if (part == 7.0) {
      // Shield ring / pickup / projectile: pure emissive in the instance colour, pulsing with glow.
      emis = col * (1.2 + glow * 1.5); albedo = vec3f(0.02);
    }
    else { albedo = col * 0.25; gloss = 0.4; }
    if (i.extra.y > 0.5) {
      // Active shield: cool fresnel sheen over the whole craft.
      let V = normalize(F.camPos.xyz - i.wp);
      let fr = pow(1.0 - max(dot(normalize(i.n), V), 0.0), 2.5);
      emis += vec3f(0.35, 0.8, 1.2) * (0.25 + fr * 1.4) * (0.8 + 0.2 * sin(F.camPos.w * 9.0));
    }
  }
  let sc = shade(albedo, i.n, i.wp, emis, gloss);
  var mask = 1.0;
  if (mat >= 0.5 && mat < 1.5) { mask = 0.12; } else if (mat >= 1.5 && mat < 2.5) { mask = 0.85; } else if (mat >= 2.5) { mask = 0.0; }
  var o : FsOut;
  // Alpha packs the colormap mask and the shading band: a = 3 * band + mask * 0.9.
  o.col = vec4f(sc.xyz, 3.0 * round(sc.w * 2.0) * 0.5 + mask * 0.9);
  o.nd = vec4f(normalize(i.n), length(F.camPos.xyz - i.wp));
  return o;
}

// Water (or lava) plane: alpha blended over the scene, own normal for outlines.
@fragment fn fsWater(i : VOut) -> FsOut {
  let t = F.camPos.w; let uv = i.uv;
  let flags = u32(F.env.w + 0.5);
  let dist = length(F.camPos.xyz - i.wp);
  let fog = 1.0 - exp(-dist * F.skyA.w);
  var o : FsOut;
  if ((flags & 16u) != 0u) {
    let crust = smoothstep(0.42, 0.56, vnoise(uv * 0.05 + vec2f(t * 0.03, 0.0)) * 0.6 + vnoise(uv * 0.13) * 0.4);
    let glow = 0.9 + 0.3 * sin(t * 1.7 + uv.x * 0.2);
    var col = mix(vec3f(0.8, 0.24, 0.04) * glow, vec3f(0.07, 0.03, 0.02), crust);
    o.col = vec4f(mix(col, F.skyA.xyz, fog), 1.0);
    o.nd = vec4f(0.0, 1.0, 0.0, dist);
    return o;
  }
  let w1 = vnoise(uv * 0.09 + vec2f(t * 0.12, t * 0.07));
  let w2 = vnoise(uv * 0.21 - vec2f(t * 0.09, t * 0.05));
  let n = normalize(vec3f((w1 - 0.5) * 0.35 + sin(uv.x * 0.5 + t * 1.4) * 0.05, 1.0, (w2 - 0.5) * 0.35 + cos(uv.y * 0.47 - t * 1.1) * 0.05));
  let V = normalize(F.camPos.xyz - i.wp);
  let L = normalize(F.sunDir.xyz); let H = normalize(L + V);
  let fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  let deep = F.water0.xyz;
  let shallow = F.water1.xyz;
  var col = mix(deep, shallow, 0.3 + 0.4 * w1);
  // Ripple lines: thin bright crests drifting across the surface.
  let rs = F.water0.w;
  let rip = smoothstep(0.52, 0.58, vnoise(uv * rs + vec2f(t * 0.25, t * 0.11)) * 0.7 + vnoise(uv * rs * 2.3 - vec2f(t * 0.17, t * 0.2)) * 0.3);
  col = mix(col, shallow * 1.15 + vec3f(0.08), rip * F.water1.w);
  col = mix(col, mix(F.skyB.xyz, F.skyA.xyz, 0.4), fres * 0.35);
  let glint = step(0.6, pow(max(dot(n, H), 0.0), 90.0)) * 0.9;
  col += vec3f(glint);
  let alpha = 0.78 + fres * 0.18;
  o.col = vec4f(mix(col, F.skyA.xyz, fog), alpha);
  o.nd = vec4f(n, dist);
  return o;
}
`;

  const fullscreen = /* wgsl */`
struct FOut { @builtin(position) pos : vec4f, @location(0) uv : vec2f };
@vertex fn vsFull(@builtin(vertex_index) vi : u32) -> FOut {
  var o : FOut;
  let x = f32(i32(vi & 1u) * 4 - 1);
  let y = f32(i32(vi >> 1u) * 4 - 1);
  o.pos = vec4f(x, y, 1.0, 1.0);
  o.uv = vec2f(x, -y) * 0.5 + 0.5;
  return o;
}
`;

  const sky = common + fullscreen + /* wgsl */`
fn hash3(p : vec3f) -> f32 { return fract(sin(dot(p, vec3f(12.9898, 78.233, 37.719))) * 43758.5453); }
@fragment fn fsSky(i : FOut) -> FsOut {
  let ndc = (i.uv * 2.0 - 1.0) * vec2f(1.0, -1.0);
  let d = normalize(F.camFwd.xyz + F.camRight.xyz * ndc.x * F.camRight.w * F.camUp.w + F.camUp.xyz * ndc.y * F.camRight.w);
  let t = F.camPos.w;
  let up = max(d.y, 0.0);
  var col = mix(F.skyA.xyz, F.skyB.xyz, pow(up, 0.55));
  col = mix(col, F.skyA.xyz * 0.6, smoothstep(0.0, -0.3, d.y));
  let sun = normalize(F.sunDir.xyz);
  let sd = max(dot(d, sun), 0.0);
  col += vec3f(1.0, 0.9, 0.7) * (pow(sd, 400.0) * 3.0 + pow(sd, 12.0) * 0.25);
  // Horizontal waveform bands (sine raised to a power) coloured from the palette, warped by noise.
  let warp = fbm(vec2f(atan2(d.z, d.x) * 2.0, d.y * 3.0) + t * 0.01) * 0.8;
  let band = pow(0.5 + 0.5 * sin(d.y * F.sky2.x * 6.0 + warp * 4.0), F.sky2.y);
  let bandMask = smoothstep(-0.02, 0.3, d.y) * F.sky2.z;
  let bandCol = palette(select(0.55, 0.8, F.sky2.w > 0.5) + band * 0.2);
  col = mix(col, bandCol, band * bandMask);
  // Faint aurora ribbon for dark worlds.
  if (F.sky2.w < 0.5) {
    let rib = sin(d.x * 6.0 + t * 0.15 + sin(d.z * 4.0 - t * 0.1) * 2.0) * 0.5 + 0.5;
    col += F.emis.xyz * smoothstep(0.05, 0.6, up) * pow(rib, 8.0) * 0.25;
  }
  // Nebula: soft colour clouds from fbm, palette tinted.
  if (F.env.y > 0.0) {
    let q = d * 2.6;
    let nb = fbm(vec2f(q.x + q.y * 0.7, q.z - q.y * 0.5) + t * 0.004);
    let nb2 = fbm(vec2f(q.z * 1.3 + 7.0, q.x * 1.1 - 3.0));
    let neb = pow(max(nb - 0.32, 0.0) * 1.9, 1.7);
    col += palette(0.35 + nb2 * 0.55) * neb * F.env.y * 0.9;
  }
  // Moon disc with a terminator, for dark skies.
  if (F.skyB.w > 0.5 || F.env.y > 0.0) {
    let moonDir = normalize(vec3f(-sun.x * 0.6 + 0.3, 0.4, -sun.z * 0.8 - 0.2));
    let md = dot(d, moonDir);
    let disc = smoothstep(0.9962, 0.9972, md);
    let lit = 0.35 + 0.65 * smoothstep(-0.2, 0.6, dot(normalize(d - moonDir * md), sun));
    let craters = 0.85 + 0.15 * vnoise(d.xz * 260.0 + d.y * 130.0);
    col = mix(col, F.pal4.xyz * lit * craters * 0.7, disc);
    col += F.pal3.xyz * exp(-(1.0 - md) * 260.0) * 0.18;
  }
  // Planet limb below the corridor: a huge planet under the camera with an atmosphere glow band.
  if (F.env.z > 0.5) {
    let horizon = -0.16;
    let below = smoothstep(horizon, horizon - 0.015, d.y);
    let bands = fbm(vec2f(atan2(d.z, d.x) * 2.5, d.y * 18.0) + t * 0.002);
    let pc = mix(F.pal0.xyz * 0.7, F.pal2.xyz * 0.55, bands);
    let night = smoothstep(0.3, -0.5, dot(vec3f(d.x, 0.0, d.z), vec3f(sun.x, 0.0, sun.z)));
    col = mix(col, mix(pc, F.pal0.xyz * 0.25, night * 0.8), below);
    let g = exp(-abs(d.y - horizon) * 28.0);
    col += F.pal4.xyz * g * 0.9 + F.pal3.xyz * exp(-max(d.y - horizon, 0.0) * 7.0) * 0.3 * (1.0 - below);
  }
  // Stars.
  if (F.skyB.w > 0.5) {
    let cell = floor(d * 160.0);
    let s = hash3(cell);
    let star = step(0.985, s) * smoothstep(0.0, 0.2, up) * (0.5 + 0.5 * sin(t * 3.0 + s * 100.0));
    col += vec3f(star * 1.5);
  }
  var o : FsOut;
  o.col = vec4f(col, 3.0 + 0.9);
  o.nd = vec4f(0.0, 0.0, 0.0, 1e5);
  return o;
}
`;

  const post = common + fullscreen + /* wgsl */`
@group(0) @binding(1) var samp : sampler;
@group(0) @binding(2) var sceneTex : texture_2d<f32>;
@group(0) @binding(3) var bloomTex : texture_2d<f32>;
@group(0) @binding(4) var ndTex : texture_2d<f32>;

// Bright pass + blur, rendered to a quarter resolution target.
@fragment fn fsBloom(i : FOut) -> @location(0) vec4f {
  var acc = vec3f(0.0);
  let px = 1.0 / F.res.xy * 4.0;
  for (var k = 0; k < 12; k++) {
    let a = f32(k) * 0.5236;
    let r = 1.0 + f32(k % 3);
    let off = vec2f(cos(a), sin(a)) * r * px;
    let c = textureSample(sceneTex, samp, i.uv + off).xyz;
    let l = dot(c, vec3f(0.299, 0.587, 0.114));
    let th = select(0.85, 1.35, F.sky2.w > 0.5);
    acc += c * smoothstep(th, th + 0.75, l);
  }
  return vec4f(acc / 12.0, 1.0);
}

fn aces(x : vec3f) -> vec3f {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}
override WITH_EFFECTS: bool = true;
override WITH_BLOOM: bool = true;
@fragment fn fsComposite(i : FOut) -> @location(0) vec4f {
  let speed = F.camFwd.w; let drift = F.params.w; let t = F.camPos.w; let flash = F.res.w;
  var uv = i.uv;
  // Impact glitch: a few rows tear sideways for a moment.
  let row = floor(uv.y * 60.0);
  let tear = step(0.92, hash21(vec2f(row, floor(t * 24.0)))) * flash;
  uv.x += (hash21(vec2f(row, 3.0)) - 0.5) * 0.08 * tear;
  // Speed fisheye (barrel) on the viewing window.
  let c = uv - 0.5;
  let r2 = dot(c, c);
  uv = 0.5 + c * (1.0 - (0.03 + speed * 0.06) * r2);
  // Chromatic aberration grows with speed and drift.
  let ca = (0.0012 + speed * 0.004 + drift * 0.004 + flash * 0.012) * length(c) * 2.0;
  let dir = normalize(c + vec2f(1e-5));

  let c4 = textureSample(sceneTex, samp, uv);

  let band = floor(c4.w / 1.5) * 0.5;
  let mask = (c4.w - 1.5 * floor(c4.w / 1.5)) / 0.9;
  var col = c4.xyz;
  if (WITH_EFFECTS) {
    col.r = textureSample(sceneTex, samp, uv + dir * ca).r;
    col.b = textureSample(sceneTex, samp, uv - dir * ca).b;
  }
  // Ink outlines from depth and normal discontinuities.
  let px = vec2i(uv * F.res.xy);
  let inkCol = select(F.pal0.xyz * 0.35, F.ramp1.xyz * 0.22, (u32(F.env.w + 0.5) & 1u) != 0u);
  if (WITH_EFFECTS && F.look.z > 0.0) {
    let nd0 = textureLoad(ndTex, px, 0);
    var dd = 0.0; var nn = 0.0;
    let offs = array<vec2i, 4>(vec2i(1, 0), vec2i(-1, 0), vec2i(0, 1), vec2i(0, -1));
    for (var k = 0; k < 4; k++) {
      let ndk = textureLoad(ndTex, px + offs[k], 0);
      dd = max(dd, abs(nd0.w - ndk.w) / max(min(nd0.w, ndk.w), 1.0));
      nn = max(nn, 1.0 - dot(nd0.xyz, ndk.xyz));
    }
    let edge = clamp(smoothstep(0.02, 0.08, dd) + smoothstep(0.25, 0.6, nn) * 0.7, 0.0, 1.0);
    col = mix(col, inkCol, edge * clamp(F.look.z * 1.6, 0.0, 1.0));
  }
  // Hatching inside the shadow bands: diagonal strokes in screen space, plus a cross hatch in full shadow.
  let hp = vec2f(px);
  if (WITH_EFFECTS) {
    let h1 = step(0.55, fract((hp.x + hp.y) / 7.0 + vnoise(hp * 0.08) * 0.4));
    let h2 = step(0.6, fract((hp.x - hp.y) / 9.0 + vnoise(hp * 0.05) * 0.4));
    let hatch = (h1 * select(0.0, 1.0, band < 0.75) + h2 * select(0.0, 1.0, band < 0.25)) * step(0.05, mask);
    col = mix(col, inkCol, hatch * 0.13);
  }
  // Ordered dither on luminance, then map luminance through the five-colour palette (ColorMap / LUT look).
  if (F.look.x > 0.0) {
    let l = luma(col);
    let d = (bayer4(i.pos.xy) - 0.5) * F.look.y;
    let mapped = palette(clamp(l + d, 0.0, 1.0));
    let keep = smoothstep(0.9, 1.8, l); // let emissives keep their own colour
    col = mix(col, mapped, F.look.x * (1.0 - keep) * mask);
  }
  if (F.look.w > 0.5) {
    let lv = F.look.w;
    col = mix(col, floor(col * lv + 0.5) / lv, 0.7);
  }
  // Bloom (quarter res, bilinear) with a small extra spread.
  if (WITH_BLOOM) {
    let bpx = 4.0 / F.res.xy;
    var bl = textureSample(bloomTex, samp, uv).xyz * 0.4;
    bl += textureSample(bloomTex, samp, uv + vec2f(bpx.x, 0.0)).xyz * 0.15;
    bl += textureSample(bloomTex, samp, uv - vec2f(bpx.x, 0.0)).xyz * 0.15;
    bl += textureSample(bloomTex, samp, uv + vec2f(0.0, bpx.y)).xyz * 0.15;
    bl += textureSample(bloomTex, samp, uv - vec2f(0.0, bpx.y)).xyz * 0.15;
    col += bl * (1.1 + F.res.z * 0.8);
  }
  // Speed streaks near the edges.
  let ang = atan2(c.y, c.x);
  let streak = pow(max(vnoise(vec2f(ang * 40.0, t * 30.0)) - 0.55, 0.0) * 2.0, 2.0) * smoothstep(0.1, 0.5, r2) * speed * 1.5;
  col += streak * select(F.emis.xyz, F.pal1.xyz * 0.6, F.sky2.w > 0.5) * 0.8;
  col = aces(col * (1.0 + flash * 0.35));
  // Vignette and grain.
  let vig = 1.0 - smoothstep(0.35, 1.1, r2 * 1.6);
  col *= mix(0.55, 1.0, vig);
  col += (hash21(i.uv * F.res.xy + t) - 0.5) * 0.03;
  // Paper grain: low-frequency fibre noise.
  if (WITH_EFFECTS) { col *= 0.96 + 0.08 * vnoise(hp * 0.35) * vnoise(hp * 0.11 + 5.0); }
  return vec4f(col, 1.0);
}
`;
  // Particles: camera-facing quads, instance = pos3, size, col3, alpha, vel3, rot, type, life01 (16 floats).
  const particles = common + /* wgsl */`
struct PIn {
  @builtin(vertex_index) vi : u32,
  @location(0) pos : vec3f, @location(1) size : f32, @location(2) col : vec3f, @location(3) alpha : f32,
  @location(4) vel : vec3f, @location(5) rot : f32, @location(6) ptype : f32, @location(7) life : f32,
};
struct POut { @builtin(position) pos : vec4f, @location(0) uv : vec2f, @location(1) col : vec3f, @location(2) misc : vec4f, @location(3) wp : vec3f };
@vertex fn vsParticle(v : PIn) -> POut {
  var corners = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0));
  let c = corners[v.vi];
  var a = F.camRight.xyz; var b = F.camUp.xyz;
  var sa = v.size; var sb = v.size;
  let streak = v.ptype == 2.0 || v.ptype == 6.0;
  if (streak) {
    let vl = length(v.vel);
    if (vl > 0.05) {
      let d = v.vel / vl;
      // project the velocity into the view plane so the streak stays visible head-on
      let f = F.camFwd.xyz;
      var ap = d - f * dot(d, f);
      if (length(ap) < 0.05) { ap = a; }
      a = normalize(ap); b = normalize(cross(f, a));
      sa = v.size * clamp(1.0 + vl * 0.12, 1.0, 7.0); sb = v.size * 0.35;
    }
  } else {
    let cr = cos(v.rot); let sr = sin(v.rot);
    let a2 = a * cr + b * sr; let b2 = -a * sr + b * cr;
    a = a2; b = b2;
  }
  let wp = v.pos + a * (c.x * sa) + b * (c.y * sb);
  var o : POut;
  o.pos = F.viewProj * vec4f(wp, 1.0);
  o.uv = c; o.col = v.col; o.misc = vec4f(v.alpha, v.ptype, v.life, v.rot); o.wp = wp;
  return o;
}
fn pshape(uv : vec2f, ptype : f32, life : f32, rot : f32) -> f32 {
  let r = length(uv);
  var m = 0.0;
  if (ptype == 0.0) { m = pow(smoothstep(1.0, 0.15, r), 1.4) * (1.0 + pow(1.0 - min(r, 1.0), 3.0)); }
  else if (ptype == 1.0) { let w = 0.08 + life * 0.14; m = smoothstep(w, 0.0, abs(r - 0.82)) * (1.0 - life); }
  else if (ptype == 2.0 || ptype == 6.0) { m = smoothstep(1.0, 0.1, abs(uv.y)) * smoothstep(1.0, 0.25, abs(uv.x)); m = m * (1.0 + 1.5 * smoothstep(0.4, 0.0, abs(uv.y))); }
  else if (ptype == 3.0) { let n = fbm(uv * 1.6 + vec2f(rot * 0.7, life * 0.8)); m = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7) * pow(1.0 - life, 0.6); }
  else if (ptype == 4.0) { let cr = cos(rot); let sr = sin(rot); let q = vec2f(uv.x * cr - uv.y * sr, uv.x * sr + uv.y * cr); m = step(max(abs(q.x), abs(q.y) * 1.5), 0.62); }
  else { m = pow(smoothstep(1.0, 0.0, r), 2.5) * (1.0 - life); }
  return m;
}
@fragment fn fsParticleAdd(i : POut) -> FsOut {
  let m = pshape(i.uv, i.misc.y, i.misc.z, i.misc.w);
  let dist = length(F.camPos.xyz - i.wp);
  let fog = 1.0 - exp(-dist * F.skyA.w);
  var o : FsOut;
  // Additive glow reads too hot over pale skies: scale it down on light worlds.
  let bright = select(1.0, 0.55, F.sky2.w > 0.5);
  o.col = vec4f(i.col * m * i.misc.x * (1.0 - fog * 0.85) * bright, 1.0);
  o.nd = vec4f(0.0);
  return o;
}
@fragment fn fsParticleAlpha(i : POut) -> FsOut {
  let m = pshape(i.uv, i.misc.y, i.misc.z, i.misc.w);
  let dist = length(F.camPos.xyz - i.wp);
  let fog = 1.0 - exp(-dist * F.skyA.w);
  var col = i.col;
  if (i.misc.y == 4.0) { let cr = cos(i.misc.w); let sr = sin(i.misc.w); let q = vec2f(i.uv.x * cr - i.uv.y * sr, i.uv.x * sr + i.uv.y * cr); col = col * (0.7 + 0.5 * step(0.0, q.x + q.y)); }
  else if (i.misc.y == 3.0) { col = mix(col, F.skyA.xyz * 0.8 + vec3f(0.15), 0.35 + 0.35 * (1.0 - i.misc.z)); }
  var o : FsOut;
  o.col = vec4f(mix(col, F.skyA.xyz, fog), m * i.misc.x);
  o.nd = vec4f(0.0);
  return o;
}
`;
  return { scene, sky, post, particles };
})();
