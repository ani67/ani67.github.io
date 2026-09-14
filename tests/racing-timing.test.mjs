import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const Timing = vm.runInNewContext(fs.readFileSync(new URL('../public/galactic-racers/src/timing.js', import.meta.url),'utf8')+'\nTiming');
test('interpolation blends position and shortest heading without mutating physics', () => {
  const a={x:0,y:1,z:2,heading:Math.PI-.1,pitch:0,wrecks:0};
  const b={x:2,y:3,z:4,heading:-Math.PI+.1,pitch:.2,wrecks:0};
  const before=JSON.stringify([a,b]);const c=Timing.interpolate(a,b,.5);
  assert.equal(c.x,1);assert.equal(c.y,2);assert.equal(c.z,3);assert.equal(c.pitch,.1);
  assert(Math.abs(c.heading-Math.PI)<1e-9);assert.equal(JSON.stringify([a,b]),before);
});
test('teleports, respawns and missing snapshots snap without trailing across the world', () => {
  const a={x:0,y:0,z:0,heading:0,pitch:0,wrecks:0};
  for(const b of [{...a,x:100},{...a,wrecks:1}]) assert.equal(Timing.interpolate(a,b,.2),b);
  assert.equal(Timing.interpolate(null,a,.5),a);
});
test('telemetry discards old samples, ignores invalid values and resets', () => {
  const s=Timing.samples(4);for(const n of [100,1,2,3,4,NaN,Infinity,-1])s.add(n);
  assert.equal(s.summary().count,4);assert.equal(s.summary().p99,4);assert.equal(s.summary().p50,2);
  s.clear();assert.equal(s.summary().count,0);
});
test('unstable callbacks do not infer a refresh rate; explicit cap remains unchanged', () => {
  const d=Timing.displayClock();for(let i=0;i<240;i++)d.add(i%2?7:15);
  assert.equal(d.hz,0);assert.equal(d.target(60,true),60);
  for(let i=0;i<240;i++)d.add(1000/144);
  assert.equal(d.target(60,true),48);assert.equal(d.target(60,false),60);
});
