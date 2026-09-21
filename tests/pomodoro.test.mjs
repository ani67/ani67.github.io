import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadTypeScript } from './load-typescript.mjs';
const { INITIAL_TIMER, remainingAt, restoreTimer, finishTimer, formatTime } = loadTypeScript(path.resolve('lib/pomodoro.ts'));
test('running timer catches up after sleeping without depending on interval ticks', () => {
  const running = { ...INITIAL_TIMER, deadline: 1_000_000 + 1_200_000 };
  assert.equal(remainingAt(running, 1_600_000), 600_000);
  assert.equal(remainingAt(running, 9_000_000), 0);
});
test('paused timer does not lose time and running deadline survives reload', () => {
  assert.equal(remainingAt({ ...INITIAL_TIMER, remaining: 432_100 }, 9_000_000), 432_100);
  const running = { ...INITIAL_TIMER, deadline: 2_000_000 };
  assert.equal(remainingAt(restoreTimer(JSON.stringify(running)), 1_500_000), 500_000);
});
test('invalid saved data falls back safely', () => {
  for (const raw of ['oops', 'null', '{}', JSON.stringify({ ...INITIAL_TIMER, focus: 0 }), JSON.stringify({ ...INITIAL_TIMER, scene: 99 })]) assert.deepEqual(restoreTimer(raw), INITIAL_TIMER);
});
test('completion stops running and only counts focus sessions', () => {
  const finished = finishTimer({ ...INITIAL_TIMER, deadline: 123 });
  assert.equal(finished.deadline, null);
  assert.equal(finished.remaining, 0);
  assert.equal(finished.completed, 1);
  assert.equal(finishTimer({ ...INITIAL_TIMER, mode: 'break' }).completed, 0);
});
test('countdown rounds up partial seconds and handles long durations', () => {
  assert.equal(formatTime(1), '00:01');
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(120 * 60_000), '120:00');
});
