# Interplanetary Racers performance implementation

12 September 2026. Follow-up to the [baseline RCA](interplanetary-racers-performance-review.md).

## Plan and delivery

Renderer, simulation and mobile UI work ran in parallel. Geometry batching, multiplayer lifecycle, particle budgets, integration and before/after verification were handled alongside them. No changes to terrain collision sampling, craft stats, opponent count or course generation were used to obtain the reductions.

- [x] Add Eco (30 FPS), Balanced (60 FPS) and High (60 FPS), persisted in `ir.quality`. Default to Eco for coarse primary pointers, Balanced otherwise.
- [x] Cap internal pixel counts at 1280×720, 1600×900 and 2560×1440 equivalents; preserve aspect ratio and native-resolution HTML UI. Apply adaptive scale after the pixel cap.
- [x] Render menus at 12 FPS; pause solo races in settings. Suspend hidden rendering/simulation and reset the clock on return.
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

## Measured workload comparison

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

- 33 automated tests passed, including simulated 30/60/120/144 Hz displays, preset changes, bounded catch-up, menu-to-race timing, hidden/pause/resume, visual banking, geometry/collision preservation, stale pause packets and stale remote input.
- Two local browser peers connected through the real manual WebRTC path, raced, paused/resumed with the host's visibility, and continued with Balanced host/Eco client. No browser errors.
- Chrome mobile emulation checked 390×844 portrait and 844×390 landscape: setup navigation, visible controls, simultaneous touches, cancellation/blur release, quality selection, pause/resume and recovery UI. This is not physical Android/iPhone testing.
- Lint, TypeScript, production build and static export checks passed.

## Remaining hardware validation and optional follow-ups

- [ ] Run matched 15–20 minute sessions on the actual laptop and physical midrange Android/iPhone devices. Record energy/battery, thermal state or temperature where available, p95/p99 frame times, input feel and late-session throttling. Keep brightness, charging state, room conditions, seed and radio state comparable. Hardware measurements are unavailable in this session, so no cooling guarantee is made.
- [ ] Measure demanding biomes and multiplayer hosting on those devices before tuning preset/LOD thresholds further.
- [ ] If GPU profiling still identifies bandwidth as a bottleneck, remove the extra normal/depth colour target in Eco and evaluate narrower formats. The current change retains it to avoid mixing a render-target rewrite with initial optimizations.
- [ ] If geometry remains limiting, add verified per-material backface culling and authored distant craft/flora LODs. Global backface culling is intentionally not enabled because sails and foliage can be two-sided.
- [ ] If CPU/HUD work becomes limiting, cache static speedometer artwork and profile further allocations. World-generation workers would address loading stalls, not continuous race rendering.
- [ ] If support for older non-WebGPU browsers is required, implement and validate a separate WebGL2 fallback. This is a separate renderer project; lower quality cannot supply a missing graphics API.

To test lower workload now, choose **Settings → Graphics → Eco**. WebGPU support is still required. Physical device testing is needed before describing any preset as thermally validated.
