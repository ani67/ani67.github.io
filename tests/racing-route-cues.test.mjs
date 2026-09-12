import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = fs.readFileSync(new URL('../public/interplanetary-racers/src/game.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('  function updateRouteCues'), source.indexOf('  function craftParams(race)'));
function scene() {
  const context = {
    gateGroup: [{ data: new Float32Array(48), inst: {} }],
    routeRings: [0.1, 0.5].map((t, i) => ({ t, p: [0, 0, i * 50], tan: [0, 0, 1], radius: 10, flash: 0 })),
    routePrevious: [0, 0, -1], player: { x: 0, y: 0, z: 1, t: 0.11, wrecked: 0 },
    rs: { state: 'racing' }, reducedMotion: { matches: false },
    A: fn => fn({ sfx: { routePassed: () => { context.sounds = (context.sounds || 0) + 1; } } }),
    Gpu: { CAR_FLOATS: 24, updateInstances: () => {} },
    sub: (a, b) => a.map((v, i) => v - b[i]), scale: (a, n) => a.map(v => v * n),
    dot: (a, b) => a.reduce((n, v, i) => n + v * b[i], 0), len: a => Math.hypot(...a),
    smoothstep: (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); },
  };
  vm.runInNewContext(code, context);
  return context;
}
test('forward passage inside a ring confirms and next-ring selection wraps at the lap boundary', () => {
  const c = scene(); c.updateRouteCues(1 / 30);
  assert(c.routeRings[0].flash > 0.9);
  assert.equal(c.sounds, 1);
  c.updateRouteCues(1 / 30); assert.equal(c.sounds, 1, 'no repeated chime while inside');
  assert.equal(c.gateGroup[0].data[45], 1);
  c.player.t = 0.99; c.updateRouteCues(1 / 30);
  assert.equal(c.gateGroup[0].data[21], 1);
  assert.equal(c.gateGroup[0].data[45], 0);
});
test('outside, backward and teleport crossings do not confirm; reduced motion keeps guidance static', () => {
  for (const kind of ['outside', 'backward', 'teleport']) {
    const c = scene();
    if (kind === 'outside') { c.player.x = 20; c.routePrevious[0] = 20; }
    if (kind === 'backward') { c.player.z = -1; c.routePrevious[2] = 1; }
    if (kind === 'teleport') c.routePrevious[2] = -200;
    c.updateRouteCues(1 / 30); assert.equal(c.routeRings[0].flash, 0, kind);
  }
  const c = scene(); c.reducedMotion.matches = true; c.updateRouteCues(1 / 30);
  assert.equal(c.gateGroup[0].data[22], 0);
  assert.equal(c.gateGroup[0].data[45], 1);
});
