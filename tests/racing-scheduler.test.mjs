import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Exercise the actual browser scheduler with a deterministic display clock.
// Physics is stubbed at its boundary so integration step size/count can be
// compared across display frequencies without needing a GPU or random worlds.
const source = fs.readFileSync(new URL('../public/interplanetary-racers/src/game.js', import.meta.url), 'utf8');
const from = source.indexOf('    let last = performance.now(), lastDraw');
const to = source.indexOf('\n  let paused = false;', from);
assert(from > 0 && to > from, 'game scheduler boundaries exist');
const schedule = source.slice(from, to).replace(/\n  }\s*$/, '');

function harness(hz, quality = 'balanced', idle = false) {
  let callback, now = 0, netPaused = false;
  const updates = [], draws = [], listeners = {};
  const context = {
    performance: { now: () => now }, requestAnimationFrame: f => { callback = f; },
    rs: { state: idle ? 'idle' : 'racing' },
    document: { hidden: false, addEventListener: (event, fn) => { listeners[event] = fn; } },
    paused: false, perf: { renderedFrames: 0, simulationSteps: 0, droppedSeconds: 0 },
    MP: { paused: () => netPaused, active: () => true },
    Gpu: { qualitySettings: { fps: quality === 'eco' ? 30 : 60 }, renderScale: 1,
      setRenderScale: value => { context.Gpu.renderScale = value; } },
    quality: () => quality, update: dt => updates.push(dt), updateCamera: () => {},
    updateHud: () => {}, draw: () => draws.push(now), emit: () => {},
  };
  vm.runInNewContext(schedule, context);
  const advance = seconds => { for (let i = 0; i < Math.round(seconds * hz); i++) { now += 1000 / hz; callback(now); } };
  return { context, updates, draws, advance,
    hide(value) { context.document.hidden = value; listeners.visibilitychange(); },
    netPause(value) { netPaused = value; },
    quality(value) { quality = value; context.Gpu.qualitySettings.fps = value === 'eco' ? 30 : 60; },
    stall(seconds) { now += seconds * 1000; callback(now); },
    load(seconds) { now += seconds * 1000; context.resetClock(); },
  };
}

for (const hz of [30, 60, 120, 144]) for (const quality of ['eco', 'balanced']) {
  test(`${quality} at ${hz} Hz preserves 60 simulation updates/second and caps rendering`, () => {
    const h = harness(hz, quality); h.advance(5);
    assert.equal(h.updates.length, 300);
    assert(h.updates.every(dt => dt === 1 / 60));
    assert(Math.abs(h.draws.length - Math.min(hz, quality === 'eco' ? 30 : 60) * 5) <= 1);
  });
}

test('menus render at 12 FPS without racing simulation', () => {
  const h = harness(60, 'balanced', true); h.advance(5);
  assert.equal(h.updates.length, 0); assert.equal(h.draws.length, 60);
});

for (const reason of ['hidden', 'solo settings', 'host paused']) {
  test(`${reason} suspends and resumes without catching up paused time`, () => {
    const h = harness(60); h.advance(1);
    const pause = value => reason === 'hidden' ? h.hide(value) : reason === 'host paused' ? h.netPause(value) : (h.context.paused = value);
    const updates = h.updates.length, draws = h.draws.length;
    pause(true); h.advance(2);
    assert.equal(h.updates.length, updates); assert.equal(h.draws.length, draws);
    pause(false); h.advance(1);
    assert(Math.abs(h.updates.length - updates - 59) <= 1);
    assert.equal(h.context.perf.droppedSeconds, 0);
  });
}

test('switching presets changes rendering without changing simulation rate', () => {
  const h = harness(120); h.advance(1); h.quality('eco');
  const draws = h.draws.length; h.advance(2);
  assert(Math.abs(h.draws.length - draws - 60) <= 1);
  assert.equal(h.updates.length, 180);
});

test('long stalls bound catch-up to six fixed updates and record dropped time', () => {
  const h = harness(60); h.advance(1);
  const before = h.updates.length; h.stall(5);
  assert.equal(h.updates.length - before, 6);
  assert(Math.abs(h.context.perf.droppedSeconds - 4.9) < 0.00001);
});

test('sustained missed frames reduce scale, recovery is slower and capped', () => {
  const h = harness(30); h.advance(12);
  assert(h.context.Gpu.renderScale < 1);
  const reduced = h.context.Gpu.renderScale;
  h.quality('eco'); h.advance(20);
  assert.equal(h.context.Gpu.renderScale, reduced);
  h.advance(20); assert(h.context.Gpu.renderScale > reduced);
  assert(h.context.Gpu.renderScale <= 1);
});

test('visual banking has equal response at 30/60 FPS and repeated basis lookups do not advance it', () => {
  const start = source.indexOf('    const rollDt =');
  const end = source.indexOf('    upB =', start);
  assert(start > 0 && end > start);
  const smooth = source.slice(start, end);
  const finalRoll = hz => {
    const context = { c: { roll: 0, rollAt: 0 }, t: 0, targetRoll: 1, mix: (a, b, k) => a + (b - a) * k };
    for (let i = 1; i <= hz; i++) {
      context.t = i / hz; vm.runInNewContext(`{${smooth}}`, context);
      const first = context.c.roll;
      vm.runInNewContext(`{${smooth}}`, context);
      assert.equal(context.c.roll, first);
    }
    return context.c.roll;
  };
  assert(Math.abs(finalRoll(30) - finalRoll(60)) < 1e-10);
});


for (const quality of ['eco', 'balanced']) {
  test(`${quality} starts a race without treating menu frames as missed race frames`, () => {
    const h = harness(60, quality, true);
    h.advance(2.8); h.context.rs.state = 'countdown'; h.advance(3.2);
    assert.equal(h.context.Gpu.renderScale, 1);
    h.context.rs.state = 'racing'; h.advance(4);
    assert.equal(h.context.Gpu.renderScale, 1);
  });
}

test('world-load reset excludes generation time from catch-up and adaptive samples', () => {
  const h = harness(60); h.advance(1);
  const before = h.updates.length;
  h.load(5); h.advance(1);
  assert.equal(h.updates.length - before, 60);
  assert.equal(h.context.perf.droppedSeconds, 0);
  assert.equal(h.context.Gpu.renderScale, 1);
});
