import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadTypeScript } from './load-typescript.mjs';
const { playTimerCue } = loadTypeScript(path.resolve('app/pomodoro/audio.ts'));
function context() {
 const notes=[];
 return { notes, state:'suspended', currentTime:10, destination:{}, async resume(){this.state='running';},
 createOscillator(){const note={frequency:{value:0},connect(){},disconnect(){},start(at){note.at=at;notes.push(note);},stop(at){note.stopAt=at;}};return note;},
 createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
}
test('start and completion cues are distinct and resume suspended audio',async()=>{
 const ctx=context();await playTimerCue(ctx,'start');assert.equal(ctx.state,'running');assert.equal(ctx.notes.length,2);assert(ctx.notes[1].frequency.value>ctx.notes[0].frequency.value);
 ctx.notes.length=0;await playTimerCue(ctx,'complete');assert.equal(ctx.notes.length,6);assert(ctx.notes[5].stopAt-ctx.notes[0].at>3);
});
test('blocked or closed audio never breaks timer interactions',async()=>{
 const ctx=context();ctx.resume=async()=>{throw Error('blocked')};await playTimerCue(ctx,'start');assert.equal(ctx.notes.length,0);ctx.state='closed';await playTimerCue(ctx,'complete');assert.equal(ctx.notes.length,0);
});
