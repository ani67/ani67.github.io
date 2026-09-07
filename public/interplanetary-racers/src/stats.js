// Ship stats derived from a craft recipe's geometry. Contract shared by the craft designer (owner) and the physics.
// All *Mul fields are multipliers applied to the planet's medium constants; life is hit points; armour scales damage taken (<1 = tougher).
// bars are 0..1 for the designer; budget is the normalised stat sum over the cap (>1 means the recipe was scaled down to fit).
const Stats = (() => {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const DEFAULT = { massMul: 1, accelMul: 1, speedMul: 1, gripMul: 1, driftMul: 1, steerMul: 1, armour: 1, life: 100, budget: 0, bars: { speed: 0.5, accel: 0.5, drift: 0.5, defense: 0.5, life: 0.5 } };
  // Race-relevant stats cost more budget than survivability, because speed, acceleration and cornering are what
  // decide a lap while armour and hull only pay off under fire. Without this a glass cannon buys the whole top end free.
  const COST = { speed: 1.35, accel: 1.25, drift: 0.9, defense: 0.75, life: 0.75 };
  const CAP = 2.9;
  // Wider spans than before so the five bars actually separate the families in play, not just on the readout.
  function fromBars(bars, extra) {
    return {
      speedMul: 0.88 + 0.24 * bars.speed, accelMul: 0.62 + 0.86 * bars.accel, driftMul: 0.6 + 1.0 * bars.drift,
      armour: 1.25 - 0.72 * bars.defense, life: Math.round(58 + 104 * bars.life), bars, ...extra,
    };
  }
  function compute(recipe, seed = 1) {
    if (!recipe || (!recipe.hull && !recipe.archetypes)) return { ...DEFAULT, bars: { ...DEFAULT.bars } };
    if (typeof Craft === 'undefined' || !Craft.measure) return { ...DEFAULT, bars: { ...DEFAULT.bars } };
    const m = Craft.measure(recipe, seed);
    // The role fixes the character before geometry adds detail.
    // Each role owns a distinct corner of the space so the pick matters: nobody is strictly better, they trade.
    const ROLE = {
      racer: { speed: 1.5, accel: 1.35, drift: 0.95, defense: 0.6, life: 0.58 },      // fastest, fragile, runs wide
      scout: { speed: 1.16, accel: 1.22, drift: 0.82, defense: 0.45, life: 0.45 },     // glass cannon: quick, loose, fragile
      drifter: { speed: 1.3, accel: 1.15, drift: 1.6, defense: 0.85, life: 0.8 },      // slides and turns, mid pace
      hauler: { speed: 0.92, accel: 0.68, drift: 0.9, defense: 0.95, life: 1.85 },     // slow, enormous hull, soaks damage
      brute: { speed: 1.0, accel: 0.9, drift: 0.9, defense: 1.85, life: 1.0 },         // armoured rammer, hard to dent
      junker: { speed: 0.98, accel: 1.02, drift: 1.28, defense: 1.0, life: 0.95 },     // odd all-rounder
    };
    const role = ROLE[m.recipe.role] || ROLE.junker;
    // Mass: hull volume plus parts, on a soft curve so haulers stay heavy without saturating.
    const mass = (m.hullVol + m.partVol * 0.7) / 3.2;
    const massMul = clamp(0.55 + Math.sqrt(mass) * 0.5 + (m.turrets || 0) * 0.06, 0.6, 2.0);
    // Thrust from engine bell volume; acceleration is thrust over mass, top speed follows thrust more gently.
    const thrust = clamp(m.thrust / 0.16, 0.3, 3.0);
    const rawAccel = thrust / massMul * role.accel, rawSpeed = (0.58 + thrust * 0.32) * role.speed;
    // Grip from lift surface area per mass; drift is the inverse tendency, saucers slide.
    const lift = m.liftArea / Math.max(0.5, massMul);
    const rawGrip = 0.75 + lift * 0.25, rawDrift = clamp((1.3 - lift * 0.18 + (m.recipe.hull.type === 'saucer' ? 0.25 : 0) + (m.sails || 0) * 0.12) * role.drift, 0.6, 1.5);
    // Armour from hull thickness and plating; life from volume.
    const rawDefense = clamp((m.thick * 4 + m.plates * 0.06 + massMul * 0.15) * role.defense, 0.1, 1.6);
    const rawLife = clamp(m.hullVol / 6 * role.life, 0.15, 1.6);
    const steerMul = clamp(1.55 - m.len / 6.5, 0.7, 1.3);
    // Kitbash parts: alien limbs add grip, sails add drift, turrets add mass, armour plates already count as plating.
    const gripMul = clamp(rawGrip + (m.limbs || 0) * 0.07, 0.7, 1.5);
    // Cornering hold: drift and defense buy the ability to carry speed through a turn, which is what offsets raw top speed.
    // Bars before the budget.
    let bars = {
      speed: clamp((rawSpeed - 0.62) / 0.85, 0, 1), accel: clamp((rawAccel - 0.4) / 1.6, 0, 1), drift: clamp((rawDrift - 0.5) / 0.95, 0, 1),
      defense: clamp(rawDefense / 1.2, 0, 1), life: clamp(rawLife / 1.3, 0, 1),
    };
    const sum = bars.speed * COST.speed + bars.accel * COST.accel + bars.drift * COST.drift + bars.defense * COST.defense + bars.life * COST.life;
    const budget = sum / CAP;
    // Normalise both ways. Scaling only the over-budget craft down used to leave light hulls spending well under the
    // cap, so they were strictly worse; now every craft spends the same total and differs only in how it spends it.
    const norm = clamp(1 / Math.max(0.01, budget), 0.8, 1.3);
    for (const k of Object.keys(bars)) bars[k] = clamp(bars[k] * norm, 0, 1);
    // Role perks, small enough not to unbalance the bars: haulers push harder on boost, brutes hit harder when ramming.
    const perk = { hauler: { boostMul: 1.45, ramMul: 1.15, padMul: 1.3 }, brute: { ramMul: 1.45, boostMul: 1.3, padMul: 1.25 }, racer: { boostMul: 1.05 }, drifter: { driftCharge: 1.25 }, scout: {}, junker: { padMul: 1.05 } }[m.recipe.role] || {};
    const cornerMul = clamp(0.86 + 0.26 * bars.drift + 0.17 * bars.defense + 0.12 * (gripMul - 1), 0.85, 1.3);
    return fromBars(bars, { massMul, gripMul, steerMul, cornerMul, budget, perk, role: m.recipe.role, archetype: m.recipe.archetype, measure: { hullVol: m.hullVol, partVol: m.partVol, thrust: m.thrust, liftArea: m.liftArea, plates: m.plates, engines: m.engines } });
  }
  return { compute, DEFAULT, CAP };
})();
