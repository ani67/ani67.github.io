import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL('../public/interplanetary-racers/src/math.js', import.meta.url), 'utf8'), ctx);
vm.runInContext('const World = { terrainRaw: (d,x,z) => Math.sin(x/30)*20+Math.cos(z/20)*10 };', ctx);
vm.runInContext(fs.readFileSync(new URL('../public/interplanetary-racers/src/geometry.js', import.meta.url), 'utf8'), ctx);
const Geo = vm.runInContext('Geo', ctx);
test('terrain draw chunks preserve the collision field and valid meshes at every LOD', () => {
  const t = Geo.buildTerrain({ terrainAmp: 30 }, { S: [], N: 0, maxR: 100 }, 60, { flatten: false });
  const before = t.heightAt(14, 24), original = Array.from(t.verts);
  const chunks = Geo.terrainChunks(t);
  assert.equal(chunks.length, 4);
  assert.equal(t.heightAt(14, 24), before);
  assert.deepEqual(Array.from(t.verts), original);
  for (const c of chunks) {
    assert.equal(c.lods.length, 2);
    assert(c.idx.length > c.lods[0].idx.length && c.lods[0].idx.length > c.lods[1].idx.length);
    for (const m of [c, ...c.lods]) {
      assert.equal(m.idx.length % 3, 0);
      assert([...m.verts].every(Number.isFinite));
      assert(Math.max(...m.idx) < m.verts.length / Geo.STRIDE);
    }
  }
});
test('instance spatial batches preserve every instance and contain transformed vertices', () => {
  const mesh = Geo.buildPropMesh(0);
  const data = new Float32Array([0,2,0,1,2,1,0,0.2, 400,8,-350,2,3,4,0.8,0.4, 410,4,-360,1,1,1,1.3,0.8]);
  const chunks = Geo.instanceChunks(mesh, data);
  assert.equal(chunks.length, 2);
  assert.deepEqual(Array.from(chunks).flatMap(c => Array.from(c.data)), Array.from(data));
  for (const c of chunks) for (let o = 0; o < c.data.length; o += 8) {
    const p = c.data;
    for (let k = 0; k < mesh.verts.length; k += 12) {
      const x=mesh.verts[k]*p[o+3],y=mesh.verts[k+1]*p[o+4],z=mesh.verts[k+2]*p[o+5],a=p[o+6];
      const v=[p[o]+x*Math.cos(a)+z*Math.sin(a), p[o+1]+y, p[o+2]-x*Math.sin(a)+z*Math.cos(a)];
      v.forEach((n,i)=>assert(n>=c.bounds.min[i] && n<=c.bounds.max[i]));
    }
  }
});
