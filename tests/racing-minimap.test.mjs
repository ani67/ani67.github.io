import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../public/galactic-racers/src/',import.meta.url);
const math=fs.readFileSync(new URL('math.js',root),'utf8');
const game=fs.readFileSync(new URL('game.js',root),'utf8');
const projection=game.match(/const project = p => \{[\s\S]*?\n    \};/)[0];
for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5,.63])test(`minimap agrees with camera left/right at heading ${heading}`,()=>{
 const c=vm.createContext({heading});
 vm.runInContext(math,c);
 const result=vm.runInContext(`(()=>{const W=500,H=348,sc=1,mapRange=230,player={x:0,y:0,z:0}; const sn=Math.sin(heading),cs=Math.cos(heading),clamp=M.clamp; ${projection}
 const forward=[sn,0,cs], camera=M.lookAt(M.scale(forward,-20),[0,0,0],[0,1,0]);
 const right=[camera[0],camera[4],camera[8]];
 return {right:project(M.scale(right,25)),left:project(M.scale(right,-25)),ahead:project(M.scale(forward,30)),above:project([0,30,0]),center:project([0,0,0])};})()`,c);
 assert(result.right[0]>result.center[0]);assert(result.left[0]<result.center[0]);
 assert(result.ahead[1]<result.center[1]);assert(result.above[1]<result.center[1]);
});
