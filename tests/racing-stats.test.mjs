import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const context = vm.createContext({ console });
for (const name of ['math', 'palettes', 'planets', 'craft', 'kitbash', 'stats', 'biomes']) {
  vm.runInContext(fs.readFileSync(new URL(`../public/galactic-racers/src/${name}.js`, import.meta.url), 'utf8'), context);
}
const { Stats, Planets, Kitbash } = vm.runInContext('({Stats, Planets, Kitbash})', context);
const stock = [], generated = [];
for (const race of Planets.RACES) {
  for (let seed = 1; seed <= 64; seed++) stock.push(Stats.compute(Planets.RECIPES[race.vehicle], seed, race.ability));
  for (let seed = 1; seed <= 32; seed++) generated.push(Stats.compute(Kitbash.forRace(race.id, seed), seed, race.ability));
}
function withinMedian(values, label) {
  values.sort((a, b) => a - b);
  const median = (values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2;
  for (const v of values) assert(Number.isFinite(v) && Math.abs(v / median - 1) <= 0.16, `${label}: ${v} / median ${median}`);
}
for (const [name, fleet] of [['stock', stock], ['generated', generated], ['combined', [...stock, ...generated]]]) {
  test(`${name} fleet stays within 16% of its actual medians, including stacked durability and bonuses`, () => {
    for (const key of Object.keys(Stats.CENTRES)) withinMedian(fleet.map(s => s[key]), key);
    withinMedian(fleet.map(s => s.life / s.armour), 'effective HP');
    for (const key of ['boostMul', 'padMul', 'ramMul', 'driftCharge', 'crashResist', 'steer', 'offroad']) withinMedian(fleet.map(s => s.ability[key] ?? 1), key);
    withinMedian(fleet.map(s => (s.ability.boostMul || 1) * (s.ability.driftCharge || 1)), 'drift charge and boost duration');
  });
}
test('custom craft and extreme stacked perks cannot escape the envelope; bars reflect physics', () => {
  for (const race of Planets.RACES) {
    const recipe = Kitbash.forRace(race.id, 47);
    for (const scale of [0.01, 100]) {
      const custom = JSON.parse(JSON.stringify(recipe));
      for (const key of ['len', 'w', 'h']) if (typeof custom.hull[key] === 'number') custom.hull[key] *= scale;
      const s = Stats.compute(custom, 47, { steer: 100, boostMul: 100, crashResist: 0.001 });
      for (const [key, centre] of Object.entries(Stats.CENTRES)) {
        const spread = key === 'life' || key === 'armour' ? Stats.DURABILITY_SPREAD : Stats.SPREAD;
        assert(Math.abs(s[key] / centre - 1) <= spread + 1e-12, key);
      }
      assert.equal(s.ability.steer, 1);
      assert(s.ability.boostMul <= 1.07);
      assert(s.ability.crashResist >= 0.93 - 1e-12);
      assert.equal(s.bars.speed, 0.5 * s.speedMul / Stats.CENTRES.speedMul);
      assert.equal(s.bars.defense, 0.5 * Stats.CENTRES.armour / s.armour);
    }
  }
});
test('same seed and faction give identical stats without mutating recipes or shared defaults', () => {
  const race = Planets.RACES[0], recipe = Planets.RECIPES[race.vehicle], before = JSON.stringify(recipe);
  assert.deepEqual(Stats.compute(recipe, 99, race.ability), Stats.compute(recipe, 99, race.ability));
  assert.equal(JSON.stringify(recipe), before);
  const a = Stats.compute(null, 1, { steer: 999 });
  assert.equal(a.ability.steer, 1);
  a.bars.speed = 0;
  assert.equal(Stats.compute(null).bars.speed, 0.5);
});
