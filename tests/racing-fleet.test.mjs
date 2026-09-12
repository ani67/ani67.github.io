import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx=vm.createContext({console});
const root=new URL('../public/interplanetary-racers/',import.meta.url);
for(const file of ['src/math.js','src/palettes.js','src/planets.js','src/craft.js','src/biomes.js','src/world.js',...Array.from({length:6},(_,i)=>`ships/ship-0${i+1}.js`),'src/fleet.js','src/stats.js','src/geometry.js']) vm.runInContext(fs.readFileSync(new URL(file,root),'utf8'),ctx);
const {Fleet,Stats,Planets,Geo}=vm.runInContext('({Fleet,Stats,Planets,Geo})',ctx);
test('six replacement ships produce finite meshes and truly neutral greyscale',()=>{
  assert.equal(new Set(Fleet.entries.map(e=>e.id)).size,6);
  for(const entry of Fleet.entries){
    const mesh=Fleet.build(Fleet.recipe(entry.id,1));
    assert([...mesh.verts].every(Number.isFinite));
    assert([...mesh.idx].every(i=>i<mesh.verts.length/12));
    for(let i=0;i<mesh.verts.length;i+=12){
      assert.equal(mesh.verts[i+6],mesh.verts[i+7]);assert.equal(mesh.verts[i+6],mesh.verts[i+10]);
      assert.equal(mesh.verts[i+9],10);
      for(let k=0;k<3;k++)assert(Math.abs(mesh.verts[i+k])<3.02);
    }
    const lod=Geo.withLods(mesh);assert(lod.lods.length>0);
  }
});
test('paint changes appearance without changing geometry or balanced stats',()=>{
  for(const entry of Fleet.entries){
    const grey=Fleet.build(Fleet.recipe(entry.id,1));
    const painted=Fleet.build(Fleet.recipe(entry.id,3));
    assert.notDeepEqual(Array.from(grey.verts),Array.from(painted.verts));
    for(let i=0;i<grey.verts.length;i+=12)assert.deepEqual(Array.from(grey.verts.slice(i,i+6)),Array.from(painted.verts.slice(i,i+6)));
    const ability=Planets.RACES[entry.raceIndex].ability;
    assert.deepEqual(Stats.compute(grey.recipe,1,ability),Stats.compute(painted.recipe,1,ability));
  }
  assert(Planets.RACES.every(r=>Fleet.entries.includes(Fleet.forRace(r))));
});
