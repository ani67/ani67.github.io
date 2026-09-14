import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = fs.readFileSync(new URL('../public/galactic-racers/src/gpu.js', import.meta.url), 'utf8');
const context = vm.createContext({ quality: 'high', CAR_FLOATS: 24 });
vm.runInContext(source.slice(source.indexOf('  function visible('), source.indexOf('  // scene =')), context);
const frame = new Float32Array(144);
for (const offset of [0, 84]) for (let i = 0; i < 4; i++) frame[offset + i * 5] = 1;
const mesh = { cullRadius: .1, lods: [{ level: 1 }, { level: 2 }] };
function group(positions) {
  const data = new Float32Array(positions.length * 24);
  positions.forEach((p, i) => { const o = i * 24; data[o] = data[o + 4] = data[o + 8] = 1; data.set(p, o + 9); data.set([1, 1, 1], o + 17); });
  return { mesh, data, count: positions.length, lodThresholds: [100, 240] };
}
test('camera and shadow independently retain off-camera shadow casters', () => {
  const g = group([[0, 0, .5], [3, 0, .5]]), f = frame.slice(); f[84 + 12] = -3;
  assert.equal(context.visibleInstances([g], f)[0].firstInstance, 0);
  const shadow = context.visibleInstances([g], f, true);
  assert.equal(shadow.length, 1); assert.equal(shadow[0].firstInstance, 1);
});
test('WebGPU near plane, behind camera and intersecting edge bounds', () => {
  const g = group([[0, 0, -.5], [1.05, 0, .5], [1.2, 0, .5], [0, 0, 2]]);
  const visible = context.visibleInstances([g], frame);
  assert.equal(visible.length, 1); assert.equal(visible[0].firstInstance, 1); assert.equal(visible[0].count, 1);
});
test('shared mesh selects independent player and distant rival detail', () => {
  const g = group([[0, 0, .5], [.3, 0, .5], [.5, 0, .5]]); g.lodDistances = [0, 250, 500];
  const visible = context.visibleInstances([g], frame);
  assert.equal(visible.length, 3); assert.equal(visible[0].mesh, mesh);
  assert.equal(visible[1].mesh, mesh.lods[0]); assert.equal(visible[2].mesh, mesh.lods[1]);
  assert.equal(g.count, 3); assert.equal(g.mesh, mesh);
});
test('draw ranges do not bridge an invisible instance and merge adjacent matches', () => {
  const g = group([[0, 0, .5], [5, 0, .5], [.2, 0, .5], [.4, 0, .5]]);
  assert.deepEqual(Array.from(context.visibleInstances([g], frame), g => [g.firstInstance, g.count]), [[0, 1], [2, 2]]);
});
test('decorations stay visible but omit shadow submissions', () => {
  const g = { ...group([[0, 0, .5]]), castShadow: false };
  assert.equal(context.visibleInstances([g], frame).length, 1);
  assert.equal(context.visibleInstances([g], frame, true).length, 0);
});
test('instance bounds contain rotated and nonuniformly scaled geometry', () => {
  const g = group([[.5, 0, .5]]); g.data.set([0, 2, 0, -3, 0, 0, 0, 0, 4], 0); g.data.set([2, 1, 1], 17);
  const b = context.instanceBounds(mesh, g.data, 0);
  assert.ok(b.min[0] <= -.1 && b.max[0] >= 1.1);
  assert.ok(b.min[2] <= -.3 && b.max[2] >= 1.3);
});
test('mesh bounds allow wheel rotation, gate ripple and enlarged distant dots', () => {
  const fakeDevice = { createBuffer: ({ size }) => { const buffer = new ArrayBuffer(size); return { getMappedRange: () => buffer, unmap() {} }; } };
  const creation = vm.createContext({ device: fakeDevice, Geo: { STRIDE: 12 }, GPUBufferUsage: { VERTEX: 1, INDEX: 2 } });
  vm.runInContext(source.slice(source.indexOf('  function createMesh('), source.indexOf('  function createInstances(')), creation);
  const make = (position, part, pivot = [0, 0, 0]) => {
    const verts = new Float32Array(12); verts.set(position); verts[9] = part;
    verts[6] = pivot[0]; verts[7] = pivot[1]; verts[10] = pivot[2];
    return creation.createMesh({ verts, idx: new Uint32Array([0, 0, 0]) });
  };
  // This wheel vertex rotates from y=1 to y=5 about a pivot at y=3.
  assert.ok(make([0, 1, 0], 2, [0, 3, 0]).cullRadius >= 5);
  assert.ok(make([1, 0, 0], 8).cullRadius >= 1.12);
  assert.ok(make([1, 0, 0], 9).cullRadius >= 3);
});
