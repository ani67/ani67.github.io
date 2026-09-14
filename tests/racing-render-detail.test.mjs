import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source=fs.readFileSync(new URL('../public/galactic-racers/src/gpu.js',import.meta.url),'utf8');
const methods=source.slice(source.indexOf('  function chooseLod('),source.indexOf('  // scene ='));
const context=vm.createContext({quality:'high'});vm.runInContext(methods,context);
const frame=new Float32Array(144);
test('High retains player/near craft while distant craft simplify',()=>{
 const mesh={lods:[{detail:'medium'},{detail:'far'}]};const player={mesh,lodDistance:0,lodThresholds:[100,240]};
 assert.equal(context.groupLod(player,frame),player);
 assert.equal(context.groupLod({...player,lodDistance:190},frame).mesh,mesh);
 assert.equal(context.groupLod({...player,lodDistance:220},frame).mesh,mesh.lods[0]);
 assert.equal(context.groupLod({...player,lodDistance:500},frame).mesh,mesh.lods[1]);
 assert.equal(player.mesh,mesh);
});
test('High terrain chooses conservative LOD by nearest chunk bound',()=>{
 const mesh={bounds:{min:[690,0,0],max:[710,20,20]},lods:[{detail:1},{detail:2}]};
 assert.equal(context.chooseLod(mesh,frame),mesh);
 const far={...mesh,bounds:{min:[1500,0,0],max:[1550,20,20]}};
 assert.equal(context.chooseLod(far,frame),mesh.lods[1]);
});
