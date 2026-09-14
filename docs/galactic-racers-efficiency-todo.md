# Galactic Racers: sustained performance and visual quality

14 September 2026. Baseline: `8a81399`. Keep WebGPU, gameplay rules, ship identity, route readability and the existing art direction.

Follow-up: [visibility, per-ship LOD and bloom review](galactic-racers-culling-review.md). The first pass left race-object visibility and shared ship LOD gaps; that follow-up records their correction.

## Acceptance criteria

- Stable, deliberately capped rendering; simulation remains 60 Hz with its existing collision substeps.
- Inactive menus stop rendering, but navigation, dragging, resizing and settings remain responsive.
- Graphics detail and frame-rate preference are independent and persistent.
- High uses conservative distant LOD without degrading nearby ships or silhouettes.
- Compare fixed-seed screenshots before/after at desktop and mobile sizes; inspect actual images.
- Profile complete frames as well as individual GPU passes. No claimed temperature or power savings without hardware measurements.

## Todo

- [x] Capture baseline screenshots, workload counters and GPU timings for cover, ship selection and races.
- [x] Restore menu settling/sleep and interaction wakeups; keep transitions smooth.
- [x] Add independent Auto / 30 / 60 FPS controls, allowing Eco rendering at 60 FPS.
- [x] Add refresh-aware frame pacing and rendering interpolation; preserve teleports, pause, restart and networking.
- [x] Keep distant LOD in High with conservative thresholds; verify player detail and scenery silhouettes.
- [x] Add frame-time percentiles, CPU work and GPU timing samples, with bounded storage.
- [x] Make adaptive quality preserve headroom and avoid automatically consuming recovered capacity.
- [x] Evaluate shadows, HDR bandwidth, backface culling, HUD and blur using profiles; implement only justified changes.
- [x] Inspect desktop/mobile screenshots and all planets, route cues, shadows, water and particles.
- [x] Verify paused settings, touch interaction, saved preferences, resize, reduced motion and device-loss behavior.
- [x] Verify multiplayer host/client with different graphics/frame-rate settings and pause/resume.
- [x] Run scheduler/interpolation regressions, full tests, lint, typecheck, build and export checks.
- [x] Run sustained local browser samples and record early/late frame pacing and limitations.
- [x] Update older performance documentation and publish the measured results here.

## Hardware acceptance (requires physical measurements)

- [ ] Matched 15–20 minute runs on the user's laptop with fixed seed, viewport, refresh, brightness, charging state and radio state.
- [ ] Record OS CPU/GPU energy and thermal state, device details, browser and ambient conditions.
- [ ] Compare early/late p95/p99 frame times, input feel and throttling; repeat on physical Android/iPhone if those are target devices.

These hardware checks remain explicitly unverified until measured; headless browser results are not a cooling guarantee.

## Implementation decisions

- **Menu lifecycle:** animate at the chosen frame budget for 2.4 seconds after selection/interaction, then stop. Dragging extends the window without resetting the frame deadline on every pointer event. Solo results also settle and sleep, stopping engine/wind audio; multiplayer results keep authority running. Hidden/paused behavior and multiplayer authority remain intact.
- **Frame preference:** persistent `ir.frameRate` accepts Auto, 30 and 60 independently of `ir.quality`. Auto infers a stable display cadence and uses a divisor within the preset limit: 60 on 60/120 Hz, 48 on 144 Hz, 55 on 165 Hz. Explicit 60 retains that cap, including on displays where exact even presentation is impossible. Browser cadence is an estimate, especially with variable refresh.
- **Interpolation:** craft positions/headings and the camera interpolate between 60 Hz simulation states without changing physics/network state. Heading interpolation follows the shortest arc. Respawns and large teleports snap. This adds up to one simulation tick of visual delay, a standard tradeoff for even motion.
- **High geometry:** retain near/player/selector meshes; allow distant terrain LOD beyond 700/1400 world units and double the existing prop/craft thresholds in High. Collision geometry stays unchanged.
- **Headroom:** feature-detected asynchronous GPU timing samples every 30 rendered frames, or every available frame under `?profile=1`. Bounded rolling medians complement FPS. After two slow three-second windows, lower scale by 0.1 if FPS misses the target or measured GPU passes exceed 70% of its frame interval. Do not automatically consume recovered capacity. Selecting a preset restores its ceiling. Ignore stale async timings after state/quality/scale changes.
- **Bandwidth:** discard the scene depth attachment after its last use in the scene pass; preserve the separate normal/depth colour texture used by outlines. Keep HDR colour formats because alpha contains signed material/band markers; replacing that with a normalized format would change the image.
- **Shader:** skip hatching noise for pixels whose existing material/band masks make its contribution zero. Preserve the original formula for visible hatching, palette, paper texture, bloom, rings and speed effects.
- **Stack:** retain custom WebGPU/JavaScript. Short sampled CPU p95 near 3 ms does not justify rewriting physics in WASM or moving it into a worker. Keep verified two-sided rendering for sails/foliage; global backface culling is not an acceptable shortcut. Shadows were much cheaper than image processing in the sampled scene, so keep their appearance rather than introduce shadow lag.

## Short-run evidence

- Baseline and initial updated headless Chrome, 1440×900 CSS with device scale 2, Halcyon / `efficiency-audit`: settled cover changed from 30 renders/second to zero for all presets. High cover scene submissions decreased from 82,662 to 61,574 (about 25.5%); shadow submissions stayed at 81,722. Counts are submitted triangles, not visible triangles or power measurements.
- Independent fixed-camera comparison at 1440×900 internal pixels: scene submissions 100,136 → 70,332 (about 29.8%). Nearby structures and the visual style were inspected in before/after screenshots.
- Isolated shader comparison with identical geometry, camera, resolution and shader time: all 5,184,000 RGBA screenshot channels matched exactly. Composite median across 30 short samples was 2.72 ms with the old shader and 2.49 ms with the new shader (~8% lower). This is one view on one browser/adapter, not a universal speedup.
- Eco with explicit 60 FPS, no profiling query: measured ~60.3 rendered FPS, frame p95 16.8 ms, CPU callback p95 2.7 ms, scene/composite GPU medians approximately 1.05/0.98 ms. Both expensive passes remain omitted.
- Real browser navigation verified full-detail ship preview, terrain preview, sleeping menus and drag wakeups. Settings persistence, live paused quality changes, portrait/landscape resize, reduced motion and all 14 planets passed without game errors. Real WebRTC peers with Balanced/60 host and Eco/30 client paused and resumed correctly.
- Final production checks: 67 tests, lint, typecheck, production build and static export verification passed.
- macOS `pmset -g therm` reported no recorded thermal/performance warning or CPU power status. It supplied no temperature, wattage or battery measurements.

## Reproducing sustained measurements

Run a static server from `public`, then run `scripts/verify-racer-performance.mjs` with an installed Playwright module. Environment options: `PLAYWRIGHT_MODULE`, `RACER_URL`, `RACER_SECONDS` (default 900), `RACER_BASELINE` (optional git ref), and `RACER_OUTPUT` (default `/tmp/racer-sustained`). The runner uses the same planet, seed, craft, High preset, viewport and 60 FPS target in sequential baseline/current runs, records early/late frame intervals, render scale, GPU work, heap observations, browser errors and available OS thermal status, and saves final screenshots.

These are headless, muted-audio workload checks. They do not establish physical-display smoothness, radio/audio power cost, temperature or battery savings. Physical laptop/phone acceptance remains separate.

## Visual review artifacts

- [High before](performance/2026-09-14/high-before.png) / [High after](performance/2026-09-14/high-after.png): same fixed camera, seed and shader time. High retains the close scenery and sky treatment while distant detail is simplified.
- [Ship preview](performance/2026-09-14/ship-preview.png): original near mesh and paint treatment retained.
- [Mobile settings](performance/2026-09-14/settings-mobile.png): frame-rate preference fits at 390 px; quality choice and keyboard guidance remain readable within the existing design.
- [Fixed-view samples and pixel comparison](performance/2026-09-14/fixed-view.json).

The isolated static server does not serve Next's `/icon.svg`, so some static-server screenshots include the pre-existing missing portfolio-icon placeholder in the corner. The mobile Settings artifact was refreshed against the production export and includes the correct icon. The production export serves that asset; it is unrelated to the game renderer.

## Additional regression checks

Craft, design and hangar pages rendered with the shared timing helper and supplied GPU timings without errors. Mobile emulation exercised simultaneous Go/Steer touches and cancellation; both held states cleared. The graphics-loss notification displayed recovery and paused solo simulation (synthetic notification, not an induced hardware fault). Enter on the frame-rate selector stays in Settings.

A short browser main-thread blur probe (on/off/on, three seconds each) measured task durations of 0.529/0.460/0.400 seconds, with style recalculation also falling over successive samples. Removing blur did not produce a consistent improvement over the repeated enabled condition, so the existing blur was retained. This does not measure browser compositor GPU power; inactive-menu sleeping removes continuous background changes without altering the design. [Probe results](performance/2026-09-14/additional-checks.json).

Other local verification ran during the early portions of both soak runs. Sustained comparisons should emphasize the final five-minute windows, after that work stopped; ambient conditions, OS background activity and GPU clocks were not controlled. No thermal efficiency percentage can be inferred from these runs.

Solo results sleeping/restart passed a real browser check; two scheduler tests separately verify solo suspension and continued multiplayer simulation. The final suite contains 67 passing tests.

## Completed sustained comparison

Two sequential 900-second runs completed in Chrome 153.0.8010.36 using the Apple Metal 3 adapter. Same Halcyon / halcyonites craft, seed `efficiency-sustained`, High preset, 1440×900 CSS viewport, emulated DPR 2 and 60 FPS target. Autopilot with 10,000 laps kept the race running. Audio was muted. Both runs had zero browser errors.

| Final five-minute window | Baseline | Updated |
| --- | ---: | ---: |
| Observed render calls/second | 59.98 | 59.95 |
| Median of 30-second p95 render-call intervals | 18.70 ms | 18.25 ms |
| Median of 30-second p99 render-call intervals | 19.70 ms | 18.85 ms |
| Median sampled GPU-pass total | 13.76 ms | 8.03 ms |
| Internal render size | 2160×1350 | 1512×945 |
| Render scale | 1.0 | 0.7 |
| Observed JS heap range | 29.7–44.4 MB | 29.7–43.2 MB |

The updated build settled at scale 0.7 during the first two minutes and retained it. That produces 51% fewer scene pixels than this baseline; it is an explicit fidelity/power tradeoff. The final screenshot was inspected: the scene is somewhat softer, while nearby ship detail, route contrast, lighting, hatching, effects and native HTML HUD remain recognizable and intact. The fixed-camera full-resolution comparison above isolates the separate LOD/shader improvements.

The baseline's early/late median p95 render-call intervals were 18.3/18.7 ms; the updated build's were 18.8/18.25 ms. Neither run showed a late-session FPS collapse. The benchmark measures when JavaScript reaches `Gpu.render()`, so its interval includes CPU scheduling variability; it is not physical display presentation timing. GPU figures are medians of pass-total snapshots collected every 30 seconds, not energy readings. Background activity, hardware clocks and environmental conditions were not controlled. Do not infer battery or temperature percentages from these numbers.

The results-screen-only lifecycle follow-up was checked separately after the sustained run began; it does not execute during this extended active-race scenario.

[Raw sustained results](performance/2026-09-14/sustained-results.json) · [Baseline final view](performance/2026-09-14/sustained-before.png) · [Updated final view](performance/2026-09-14/sustained-after.png).

All software implementation and validation items above are complete. Physical display/input-feel, audio/radio-on energy, battery and temperature validation on the user's devices remain explicitly unverified.

The production export was also opened in Chrome: the game, shared timing module, settings and portfolio icon loaded correctly. Source/export game and GPU files match. A local production preview is available at `http://127.0.0.1:3018/galactic-racers/`.
