import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function session() {
  const selected=[],sent=[],events={},rs={state:'racing',elapsed:10,timer:0};let handlers, now=100;
  const document={hidden:false,addEventListener:(k,f)=>events[k]=f};
  const Net={id:()=> 'client',hostId:()=> 'host',stats:()=>({}),ping:()=>0,peerIds:()=>[],send:(to,ch,msg)=>sent.push({to,ch,msg}),close:()=>{},
    host:async(c,h)=>{handlers=h},join:async(c,h)=>{handlers=h}};
  const ctx=vm.createContext({console,document,window:{addEventListener:()=>{}},performance:{now:()=>now},Net,
    Planets:{MAX_RACERS:2,RACES:[{id:'craft'}]},Weapons:{ITEMS:[]},M:{},
    Game:{ui:{playerName:()=> 'Tester',worldConfig:(planetId='halcyon',seed='seed')=>({planetId,seed,overrides:null,descriptor:{R:200}}),select:o=>{selected.push(o);api.assignCars([])}},mp:{race:()=>rs}}});
  vm.runInContext(fs.readFileSync(new URL('../public/interplanetary-racers/src/mp.js',import.meta.url),'utf8'),ctx);
  const api=vm.runInContext('MP',ctx);
  return {api,sent,selected,rs,document,visibility:()=>events.visibilitychange(),setTime:t=>{now=t},receive:(ch,msg,pid='host')=>handlers.data(pid,ch,msg)};
}
test('host publishes an authoritative pause and resume; stale events cannot re-pause clients',async()=>{
  const host=session();await host.api.hostRoom('TEST');host.api.startRace('halcyon','seed');
  host.document.hidden=true;host.visibility();assert.equal(host.api.paused(),true);
  const pause=host.sent.at(-1).msg;assert.equal(pause.t,'pause');assert.equal(pause.paused,true);
  host.document.hidden=false;host.visibility();assert.equal(host.api.paused(),false);
  const resume=host.sent.at(-1).msg;
  const client=session();await client.api.joinRoom('TEST');
  client.receive('evt',{t:'start',planetId:'halcyon',seed:'seed',roster:[{pid:'client',slot:0}]});
  client.receive('evt',pause);assert.equal(client.api.paused(),true);
  client.receive('evt',resume);assert.equal(client.api.paused(),false);
  client.receive('evt',pause);assert.equal(client.api.paused(),false);
  client.receive('state',new Uint8Array(pause.snapshot).buffer);assert.equal(client.api.paused(),false);
  client.api.leave();assert.equal(client.api.paused(),false);
});

test('host releases stale remote throttle and steering after a client stops sending',async()=>{
  const host=session();await host.api.hostRoom('TEST');
  host.receive('evt',{t:'hello',name:'Remote',raceId:'craft'},'remote');
  host.api.startRace('halcyon','seed');
  const input=new ArrayBuffer(12),d=new DataView(input);
  d.setUint16(0,1,true);d.setUint8(2,1);d.setInt8(3,127);d.setUint8(5,1);
  host.receive('state',input,'remote');
  assert.equal(host.api.control({id:1}).throttle,1);
  assert.equal(host.api.control({id:1}).steer,1);
  host.setTime(601);
  assert.equal(host.api.control({id:1}).throttle,0);
  assert.equal(host.api.control({id:1}).steer,0);
});


test('lobby snapshots replace client settings once and race start always applies the host descriptor', async () => {
  const host = session(); await host.api.hostRoom('MAP');
  host.receive('evt', { t: 'hello', name: 'Remote', raceId: 'craft' }, 'remote');
  const lobby = host.sent.find(e => e.msg.t === 'lobby').msg;
  assert.equal(lobby.world.descriptor.R, 200);
  const client = session(); await client.api.joinRoom('MAP');
  client.receive('evt', lobby);
  assert.equal(client.selected.length, 1);
  assert.equal(client.selected[0].mode, 'gallery');
  assert.equal(client.selected[0].world.overrides, null);
  client.receive('evt', lobby);
  assert.equal(client.selected.length, 1, 'roster updates do not rebuild an unchanged preview');
  host.api.startRace('halcyon', 'seed');
  const start = host.sent.find(e => e.msg.t === 'start').msg;
  client.receive('evt', start);
  assert.equal(client.selected.length, 2, 'same-seed race start still replaces local world state');
  assert.equal(client.selected[1].mode, 'race');
  assert.equal(client.selected[1].world.descriptor.R, 200);
  assert.deepEqual(client.selected[1].world, host.selected.at(-1).world);
  client.api.leave(); await client.api.joinRoom('MAP'); client.receive('evt', lobby);
  assert.equal(client.selected.length, 3, 'rejoining restores the authoritative preview');
});
