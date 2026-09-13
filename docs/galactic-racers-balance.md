# Ship balance

The September 13 balance pass reduces the influence of vehicle selection while retaining small handling differences. Geometry and appearance are unchanged.

## Centres and limits

Centres are rounded medians from the previous stock fleet: 14 factions, 32 archetype seeds each. Multipliers apply to the current world's physics, so different worlds retain their character.

| Parameter | Centre | Hard range |
| --- | ---: | ---: |
| Top speed | 1.02× | 0.9486–1.0914× |
| Acceleration | 1.00× | 0.93–1.07× |
| Drift | 1.20× | 1.116–1.284× |
| Grip | 0.82× | 0.7626–0.8774× |
| Steering | 0.80× | 0.744–0.856× |
| Cornering retention | 1.12× | 1.0416–1.1984× |
| Collision mass | 1.20× | 1.116–1.284× |
| Damage received | 0.80× | 0.776–0.824× |
| Hull | 120 HP | 116.4–123.6 HP |

The normal envelope is ±7% of its centre. This guarantees any value is within 16% of the actual median of any fleet: even the worst ratio is 1.07 / 0.93 = 1.1506. Values approach the limits smoothly rather than bunching at hard caps.

Hull and damage received use ±3% each. This keeps their combined effective health within the requirement too: the largest possible ratio is (1.03 / 0.97)^2 = 1.1275. Before this pass, stock acceleration ranged from 0.66× to 1.42× and hull from 70 to 162 HP.

Faction and role multipliers are combined before compression to 0.93–1.07×. Steering bonuses are folded into the bounded steering stat, then reset to 1 for physics. Role perks cannot be multiplied a second time. Existing fleet combinations of drift charge and boost duration also pass the median check.

Race setup now computes stats with the selected craft seed, fixing a discrepancy with selection previews. Selection, craft preview, hangar and designer all supply faction abilities to the same calculation. Bars reflect final physics ratios, with the centre shown at 5/10.

## Validation and limits

`tests/racing-stats.test.mjs` checks 896 stock and 448 generated variants, separate and combined fleet medians, effective health, ability stacking, extreme custom dimensions and bonuses, deterministic results and immutable inputs. Browser smoke tests cover racing, rendering presets and reduced motion; the multiplayer regression checks host/client race and pause behaviour.

These are numeric balance guarantees, not a claim of equal lap times. Geometry still affects collision footprints, handling parameters interact, and bots retain their existing driving skill and catch-up logic. Visual design and hitbox tuning belong to the subsequent ship design pass.
