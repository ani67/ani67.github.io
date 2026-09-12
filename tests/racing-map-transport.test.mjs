import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../public/interplanetary-racers/src/net.js', import.meta.url), 'utf8');
const ctx = {};
vm.runInNewContext(source.slice(source.indexOf('  function eventPackets'), source.indexOf('  function send(to,')), ctx);
test('large map events round-trip in bounded packets without mixing peers', () => {
  const map = { t: 'start', world: { seed: 'world', descriptor: { points: Array.from({ length: 1400 }, (_, i) => [i * 1.123456789, i / 9, -i]), name: '🌍'.repeat(8000) } } };
  const packets = ctx.eventPackets(map);
  assert(packets.length > 1);
  const peers = [{}, {}]; const result = [];
  for (const text of packets) {
    assert(Buffer.byteLength(text) < 64000);
    for (let i = 0; i < peers.length; i++) result[i] = ctx.assembleEvent(peers[i], JSON.parse(text));
  }
  assert.equal(JSON.stringify(result[0]), JSON.stringify(map));
  assert.equal(JSON.stringify(result[1]), JSON.stringify(map));
  assert.equal(peers[0].eventParts, null);
});
test('malformed or out-of-order chunks are discarded and a fresh event can recover', () => {
  const peer = {};
  assert.equal(ctx.assembleEvent(peer, { t: '_chunk', index: 2, total: 3, text: '{}' }), null);
  assert.equal(ctx.assembleEvent(peer, { t: '_chunk', index: 0, total: 9999, text: '{}' }), null);
  assert.equal(JSON.stringify(ctx.assembleEvent(peer, { t: '_chunk', index: 0, total: 1, text: '{"t":"lobby"}' })), '{"t":"lobby"}');
});
