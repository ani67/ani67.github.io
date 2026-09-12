import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = fs.readFileSync(new URL('../public/interplanetary-racers/src/game.js', import.meta.url), 'utf8');
const cacheCode = source.slice(source.indexOf('  const craftMeshes ='), source.indexOf('  function setupCars()'));

test('craft mesh reuse respects recipes and seeds and evicts within its memory budget', () => {
  let builds = 0;
  const context = {
    Craft: { build: () => { builds++; return { verts: new Float32Array(256 * 1024), idx: new Uint32Array(3) }; } },
    Geo: { withLods: mesh => mesh },
  };
  vm.runInNewContext(cacheCode + '\nthis.cache = { get: preparedCraft, bytes: () => craftMeshBytes, size: () => craftMeshes.size };', context);
  const a = { recipe: { hull: 'racer' }, seed: 1 };
  const first = context.cache.get(a);
  assert.equal(context.cache.get(JSON.parse(JSON.stringify(a))), first);
  assert.equal(builds, 1);
  assert.notEqual(context.cache.get({ ...a, seed: 2 }), first);
  assert.notEqual(context.cache.get({ ...a, recipe: { hull: 'hauler' } }), first);
  for (let seed = 3; seed < 40; seed++) context.cache.get({ ...a, seed });
  assert(context.cache.bytes() <= 16 * 1024 * 1024);
  assert(context.cache.size() <= 24);
  assert.notEqual(context.cache.get(a), first, 'old entries can be rebuilt after eviction');
  assert.equal(first.verts.length, 256 * 1024, 'eviction does not mutate an existing mesh');
});
