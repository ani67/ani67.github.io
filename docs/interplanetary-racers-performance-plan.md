# Interplanetary Racers performance implementation

12 September 2026. Follow-up to the [baseline RCA](interplanetary-racers-performance-review.md).

## Plan and delivery

Renderer, simulation and mobile UI work ran in parallel. Geometry batching, multiplayer lifecycle, particle budgets, integration and before/after verification were handled alongside them. No changes to terrain collision sampling, craft stats, opponent count or course generation were used to obtain the reductions.

- [x] Add Eco (30 FPS), Balanced (60 FPS) and High (60 FPS), persisted in `ir.quality`. Default to Eco for coarse primary pointers, Balanced otherwise.
- [x] Cap internal pixel counts at 1280×720, 1600×900 and 2560×1440 equivalents; preserve aspect ratio and native-resolution HTML UI. Apply adaptive scale after the pixel cap.
- [x] Render menus at the preset frame rate while settling, then stop their frame loop; pause solo races in settings. Suspend hidden rendering/simulation and reset the clock on return.
- [x] Keep simulation at 60 updates/second with the existing three physics substeps, independent of display/render FPS. Bound catch-up and reset clocks after loading. Make visual banking time-based.
- [x] Skip shadow and bloom passes in Eco, using shader variants that omit their sampling. Balanced uses 1024 shadows, High 2048. Keep shadow math synchronized with map size.
- [x] Chunk terrain and scenery, independently reject invisible camera/light batches, and use distant terrain LODs with seam skirts. Retain the original height field for physics and full collision instances.
- [x] Limit cosmetic particle counts and distant particle rendering by preset while retaining short hit/weapon cues.
- [x] Render selector thumbnails in a separate cached 336×180 target; request only visible/near-visible tiles. Do not redraw or resize the game canvas to make a thumbnail.
- [x] Move HUD updates out of simulation steps and onto rendered frames. Existing minimap-base caching and leaderboard throttling remain.
- [x] Request a low-power GPU adapter with fallback. This is a browser hint, not an assurance of reduced device power.
- [x] Adapt render scale after sustained missed targets, recover more slowly, and stay within the selected preset. Reset measurement windows on state/preset changes.
- [x] Add frame/workload metrics through `Game.ui.performance()` and optional asynchronous GPU-pass timestamps with `?profile=1`. GPU timestamps are feature-detected and disabled by default.
- [x] Complete touch controls and responsive setup/settings/room flows. Add in-race settings/restart/home and GPU-loss recovery UI; stop submissions after GPU loss.
- [x] Explicitly pause the multiplayer room while the host's tab is hidden. Send authoritative pause/resume snapshots, reject stale packets, and notify clients. Expire remote controls after 500 ms without input so background clients cannot leave throttle/steering stuck.
- [x] Validate core simulation, scene batching, mobile UI, all planets and two-peer networking; complete production checks.

## First-pass workload comparison (before the follow-up below)

Local headless Chrome on the same Apple Metal adapter, 1440×900 CSS viewport, deviceScaleFactor 2. Baseline scripts were loaded from commit 6ef1b6b. Each version selected Halcyon with seed `performance-review`; the camera and shader time were fixed. Samples lasted four seconds after settling. Craft selection can vary between fresh sessions, contributing a small difference in total source triangle counts. Counts are submissions before GPU clipping, not visible triangles or fragment work.

| Fixed cover view | Baseline | Eco | Balanced |
| --- | ---: | ---: | ---: |
| Observed rendered FPS | 60.2 | 12.0 | 12.0 |
| Internal canvas | 2160×1350 | 1214×758 | 1517×948 |
| Scene triangles/frame | 1,183,172 | 301,076 | 311,456 |
| Shadow triangles/frame | 1,183,172 | 0 | 178,843 |
| Geometry submissions/frame total | 2,366,344 | 301,076 | 490,299 |
| Render passes/frame | 4 | 2 | 4 |

In this view, Eco submits roughly 87% fewer triangles per frame and renders 68% fewer pixels. Balanced submits roughly 79% fewer triangles and renders 51% fewer pixels. Menu frame rate also falls from 60 to 12. These are workload reductions, not percentages of battery/temperature improvement. Spatial batching increases draw calls; the tradeoff substantially reduces submitted geometry in this sample, but must still be evaluated on real mobile GPUs.

Separate short autopilot checks held about 30 FPS in Eco and 60 FPS in Balanced/High. All 14 planets initialized/rendered without browser errors in Eco. All three presets, persistent scaling, offscreen capture and optional GPU timestamp profiling were also checked. These runs do not establish sustained thermal performance.

## Validation

- 36 automated tests passed, including simulated 30/60/120/144 Hz displays, preset changes, bounded catch-up, menu-to-race timing, hidden/pause/resume, visual banking, geometry/collision preservation, stale pause packets and stale remote input.
- Two local browser peers connected through the real manual WebRTC path, raced, paused/resumed with the host's visibility, and continued with Balanced host/Eco client. No browser errors.
- Chrome mobile emulation checked 390×844 portrait and 844×390 landscape: setup navigation, visible controls, simultaneous touches, cancellation/blur release, quality selection, pause/resume and recovery UI. This is not physical Android/iPhone testing.
- Lint, TypeScript, production build and static export checks passed.

## Follow-up: avoid unnecessary work

All five follow-up changes are implemented:

- Eco now writes one HDR colour attachment instead of two. The unused normal/depth colour texture is a 1×1 placeholder for the shared binding layout, and a dedicated composite uses one scene sample. Palette, tone mapping, speed lens and impact brightness remain; optional edge/noise filters are omitted in Eco.
- Menus settle for 1.6 seconds at 12 FPS, then stop requesting animation frames. Selection, resize and settings changes wake rendering. Paused settings redraw without advancing physics. The UI also stops its timer when neither race information nor thumbnails need updating.
- Distant scenery and opponent craft use reduced visual meshes. Material boundaries and opposing faces are retained, the player's craft stays at full detail, and High uses original meshes. Collision data remains unchanged.
- Bot steering plans run at 15 Hz, with immediate refresh on recovery/state changes. Flight and collisions still use the original 180 Hz substeps.
- Eco can reduce resolution under sustained load but no longer raises it automatically when spare capacity appears. Balanced and High retain slow recovery.

Follow-up verification in local headless Chrome:

- Settled cover and selector screens requested zero animation frames during a 700 ms observation. Scrolling still generated newly visible thumbnails; paused quality/look changes and resizing updated the canvas.
- Eco reported one colour attachment and one placeholder normal-target pixel; Balanced/High retained two attachments. Preset switching, water, both particle blend modes and offscreen captures passed without GPU errors.
- A deterministic before/after comparison simulated 30 seconds on Halcyon, Nullsector and Vitrine with eight autopilot racers. About 3,600 steering decisions per world replaced 43,200 evaluations. Both versions had zero wrecks; recorded hits were 4 before and 2 after across the three worlds. Progress remained comparable, with the largest individual difference about 2.2 percentage points of a lap. This short comparison is a regression check, not a difficulty or long-run balance guarantee.
- All 14 planets rendered in Eco, and real manual WebRTC host/client pause/resume passed with mixed presets. The full 36-test suite, lint, TypeScript, production build and static export passed.

## Remaining hardware validation and optional follow-ups

- [ ] Run matched 15–20 minute sessions on the actual laptop and physical midrange Android/iPhone devices. Record energy/battery, thermal state or temperature where available, p95/p99 frame times, input feel and late-session throttling. Keep brightness, charging state, room conditions, seed and radio state comparable. Hardware measurements are unavailable in this session, so no cooling guarantee is made.
- [ ] Measure demanding biomes and multiplayer hosting on those devices before tuning preset/LOD thresholds further.
- [ ] If GPU profiling still identifies bandwidth as a bottleneck after the Eco target removal, evaluate narrower colour formats.
- [ ] If geometry remains limiting after distance simplification, evaluate authored LODs and per-material backface culling. Global backface culling remains disabled because sails and foliage can be two-sided.
- [ ] If CPU/HUD work becomes limiting, cache static speedometer artwork and profile further allocations. World-generation workers would address loading stalls, not continuous race rendering.
- [ ] If support for older non-WebGPU browsers is required, implement and validate a separate WebGL2 fallback. This is a separate renderer project; lower quality cannot supply a missing graphics API.

To test lower workload now, choose **Settings → Graphics → Eco**. WebGPU support is still required. Physical device testing is needed before describing any preset as thermally validated.

## Follow-up: smoother setup and clearer acceleration

The 12 FPS moving menu camera made the pre-race sequence visibly uneven. Menu transitions now use the selected 30/60 FPS budget for their 1.6-second settling window, then stop completely as before.

Setup also rebuilt and simplified the same craft on each screen. A CPU mesh cache keyed by recipe and seed now reuses those results, bounded to 24 entries and 16 MiB. GPU buffers retain their existing scene ownership. A local Halcyon check measured repeated showcase/gallery/race setup at 38.5/34.2/40.2 ms before and 4.4/1.9/2.4 ms after. These timings cover reused craft in an already generated world; generating a new planet can still cause a loading pause.

The acceleration response starts earlier and drives both stronger peripheral HUD perspective and the existing scene composite's barrel distortion. No extra render pass or texture sample is added. Short CSS interpolation smooths the HUD between Eco frames; aiming/touch controls remain fixed. Reduced motion disables the dynamic lens response.

Validation: 38 automated tests, including preset-paced menu settling and bounded craft-cache reuse/eviction; local browser acceleration/reduced-motion and multiplayer startup/pause/resume checks; lint, TypeScript, production build and export verification.
