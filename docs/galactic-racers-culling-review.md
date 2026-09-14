# Galactic Racers: visibility, LOD and postprocessing follow-up

14 September 2026. This follows the first efficiency pass; its baseline is the local code immediately before this follow-up, not the older live deployment.

## Checklist

- [x] Audit actual scene submissions, including objects using the craft instance layout.
- [x] Cull ships, rings, route markers and weapon instances against the camera frustum.
- [x] Independently cull shadow casters against the light frustum. Keep off-camera objects whose shadows can enter the view.
- [x] Include wheel rotation, gate ripple and distance-enlarged markers in conservative bounds.
- [x] Choose ship LOD per instance; preserve full player detail while sharing meshes and instance buffers.
- [x] Partition route markers into 160-unit spatial batches, retaining phase and position data.
- [x] Add 48×6 / 32×4 / 24×3 ring meshes, with conservative distance thresholds (High: 360/900 units).
- [x] Remove route-ring and route-marker shadow casting; retain physical ships and weapon shadows.
- [x] Benchmark moving the final bloom spread to quarter resolution; reject the extra pass because it did not show a convincing GPU improvement. Retain the existing bloom and composite.
- [x] Count visible/total/shadow race instances in renderer diagnostics.
- [x] Test camera/light independence, partial intersections, separated draw ranges, independent LOD and animation bounds.
- [x] Compare culling enabled/disabled across three planets and four camera directions.
- [x] Complete final fixed-view and sustained measurements, inspect images and record results below.
- [x] Verify local production preview and all quality levels after final changes.

## Implementation and limits

The world stays resident for physics and race logic. Rendering uses a smaller visible selection. Terrain and scenery already used chunk bounds and LOD; the missing coverage was the `carGroups` path, which also carries route decorations and weapon effects.

The renderer now selects individual instances and merges adjacent visible instances using the same mesh into draw ranges. This avoids repacking dynamic GPU buffers and does not mutate gameplay entities. Conservative animated bounds can retain some invisible geometry; they intentionally favour avoiding visible clipping.

This is frustum culling, not occlusion culling. Objects behind hills may still be submitted. Water and screen effects retain their existing rendering. Full-resolution image processing still costs GPU time. No stack migration, physics changes or artificial distance fade was introduced.

The postprocessing experiment moved bloom's five-tap spread into an extra quarter-resolution pass and reduced the full-resolution composite to one bloom sample. It barely changed the image but failed to demonstrate a sustained GPU improvement. That experiment was reverted, including its additional texture and pipeline. Bloom and the artistic composite retain the first efficiency pass's implementation. The remaining postprocessing cost is real; reducing it further will require another measured algorithm change or an explicit quality/frame-rate tradeoff.

## Visual evidence

- Fixed-view geometry comparison: 129,650 → 88,852 scene triangles; 141,040 → 103,588 shadow triangles. This test uses the same current scene/instance data with the previous renderer, then the updated renderer, to isolate render selection. It is not a whole-game baseline timing comparison.
- In that view, 113 of 417 race instances were submitted to the camera and 7 to shadows.
- Visibility-only comparison against the previous renderer changed 0.21% of colour channels; mean absolute difference 0.052 on a 0–255 scale, reflecting distant ring LOD and removal of decorative shadows.
- Culling enabled versus disabled, holding the selected meshes and shadow policy fixed, was pixel-identical in all 12 captures: Halcyon, Nullsector and Embervale, four directions each, at 1001×703.
- Rejected bloom experiment comparison at 1440×900 changed 20 of 5,184,000 channels by at most one level. The final build retains the original bloom; its appearance is identical to the visibility-only stage.

Artifacts: [fixed-view data](performance/2026-09-14/culling/fixed.json), [edge checks](performance/2026-09-14/culling/edge-checks.json), [before](performance/2026-09-14/culling/before.png), [after](performance/2026-09-14/culling/after.png).

## Sustained results

The saved pre-follow-up build and final build each ran a three-minute Halcyon autopilot race, seed `efficiency-sustained`, High, 60 FPS target, 1440×900 CSS viewport at DPR 2. Internal resolution stayed at 2160×1350: adaptive scaling was disabled in the benchmark only. The shipping game retains its adaptive behaviour. Audio was muted; no other browser tests ran during these samples. Both runs recorded zero browser errors.

| Measure | Before | Final |
| --- | ---: | ---: |
| Render calls/second | 60.02 | 60.02 |
| Median 30-second p95 render-call interval (ms) | 18.20 | 18.55 |
| Mean sum of per-pass window medians (GPU ms) | 12.17 | 12.92 |
| Mean 30-second CPU-submit p95 (ms) | 0.65 | 0.67 |
| Mean 30-second median scene triangles | 288,758.50 | 256,228.50 |
| Mean 30-second median shadow triangles | 164,110.17 | 139,487.17 |

**These measurements do not establish a GPU-time or thermal improvement.** Geometry submissions fell, but the sampled GPU-duration aggregate increased by about 6%. CPU submission remained similar and the render-call rate held 60 FPS. The unchanged bloom/composite also measured slower, so this aggregate cannot isolate a causal effect of the visibility code.

A second, shorter comparison ran the final build first and the baseline second. It likewise failed to establish a consistent overall speedup; the baseline also had a transient frame-count drop. Run-to-run and scene variation remain material. No claim of cooler hardware, less power use or improved physical presentation is justified by these tests. The validated result is more selective geometry submission with preserved visible content. Postprocessing remains a substantial cost.

The rejected bloom experiment measured an aggregate 12.39 ms against its 12.17 ms baseline using the same summary method, giving no reason to retain its extra pass. The final renderer keeps the original four passes in High/Balanced and two in Eco.

GPU summaries average the sum of individual pass medians in each 30-second window; they are not a directly measured whole-frame median. Frame intervals measure JavaScript render calls, not display presentation. Three-minute samples do not establish long-term thermal equilibrium.

Raw data: [final comparison](performance/2026-09-14/culling/sustained.json), [reverse-order check](performance/2026-09-14/culling/reverse/sustained.json), [rejected bloom experiment](performance/2026-09-14/culling/bloom-experiment.json).

## Verification

- 74 unit tests (including seven instance visibility/animation tests), lint, typecheck, production build and export verification.
- Production preview: Eco/Balanced/High switching, odd render dimensions, 336×180 thumbnail capture, mobile resize and all three craft viewers passed without browser errors. [Results](performance/2026-09-14/culling/production.json).
- Local exported `gpu.js`, `game.js` and `shaders.js` match the current source files.
- Reusable pixel comparison: `PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-racer-visibility.mjs`. Set `RACER_URL` for another local port and `RACER_OUTPUT` for the result directory. It renders the same scene with instance culling enabled and disabled, at four camera directions on three worlds.

## Hardware acceptance

- [ ] Measure temperature and power on the user's system in comparable sustained runs.
- [ ] Confirm subjective smoothness and appearance on the physical display.
- [ ] Deploy the verified build if requested; the live site is unchanged by local builds.

Browser GPU timestamps measure workload, not watts, temperature or physical presentation. This work cannot establish that the system stays cold at maximum settings.
