# Interplanetary Racers: performance RCA and todo

Baseline reviewed 12 September 2026 at commit 6ef1b6b. The findings below describe that version. See [implementation and validation](interplanetary-racers-performance-plan.md) for the subsequent optimization work.

## Conclusion and limits

The game has a substantial continuous rendering workload and no explicit frame-rate or quality budget. This is a credible explanation for heat, including while sitting at the title screen. It is not yet a measured thermal root cause: we have not recorded device temperature, GPU power, energy use, long-session throttling, or a GPU capture. A steady 60 FPS does not establish that a device is running efficiently. The goal is lower sustained power at a stable, playable frame rate, not a guarantee of a cold device.

## Evidence

A short local headless Chrome run used an Apple Metal adapter, a 1440 x 900 CSS viewport, and emulated devicePixelRatio 2. The game rendered at 2160 x 1350 because its DPR cap is 1.5. It selected Halcyon with seed `performance-review`, then ran cover and autopilot race states. Each state had 4.5 seconds of settling followed by a four-second sample. This is a workload sanity check, not a representative device or thermal benchmark; audio playback was not exercised.

| Measurement | Cover | Race |
| --- | --- | --- |
| Frames in sample | 240 | 240 |
| Median frame interval | 16.7 ms | 16.6 ms |
| p95 frame interval | 17.4 ms | 17.2 ms |
| Submitted scene triangles, excluding water/particles | 1,183,726 | 1,183,726 |
| Last particle count | 0 | 513 |

The triangle count includes instance multiplication, before clipping. The renderer submits these static/prop/craft groups to both the scene and shadow passes: approximately 2.37 million triangle submissions per displayed frame in this sample. This is not a count of visible triangles or fragments. The short CPU duration of `Gpu.render()` only measures command preparation/submission; GPU work runs asynchronously.

### Primary findings

1. **Continuous rendering with no FPS cap.** `src/game.js:28` calls update and draw on every requestAnimationFrame. Menus skip race simulation (`game.js:655`) but still update the camera and draw the full scene. Higher-refresh displays can request proportionally more work. There is no explicit game visibility/pause policy; browsers normally suspend rAF in hidden tabs, so this is not evidence of full-speed hidden-tab rendering.
2. **Full-quality shadows and effects every frame.** `src/gpu.js` always runs a 2048-square shadow pass, two full-resolution RGBA16F scene outputs, quarter-width/quarter-height bloom, and a composite pass. `src/shaders.js:89` performs a 3 x 3 shadow comparison kernel; bloom uses 12 samples, and composite adds multiple scene/bloom samples. No quality tiers skip these passes.
3. **Whole-world geometry submission.** `gpu.js:201` renders all supplied groups in both geometry passes with no CPU view/distance rejection. The static and prop pipelines use `cullMode: 'none'`. `game.js:84` builds a 300 x 300 terrain grid (180,000 triangles) as one mesh. Instancing already reduces draw calls, but does not remove invisible geometry or supply distant LODs.
4. **Resolution has no persistent quality setting.** `gpu.js:153` caps DPR at 1.5 but does not cap total pixels. A large display still creates large render targets. Although `resize(scale)` exists, `render()` calls `resize()` with the default scale on every frame, undoing a one-off scale change.
5. **Physics work scales with display FPS.** `game.js:670` uses three physics substeps per displayed frame for up to eight racers, plus AI, collision and weapons work. At 60 FPS this is 180 substeps per second; at 120 FPS it is 360. Reducing rendering FPS alone also changes numerical integration step size, so flight/collision stability needs testing.

### Secondary costs and things already done well

- Selector thumbnails (`src/thumbs.js:79`) render at main-canvas resolution, synchronously copy/encode PNGs, then render the game again. The captured output is only 336 x 180. This is a selector hitch candidate, not a continuous race cost: jobs are cached and gated to open selectors.
- Particles already use pooled typed arrays and upload active ranges. The 20,000 capacity is not evidence that 20,000 particles are active. Alpha particles are sorted each frame; distance/size budgets remain opportunities if profiling warrants them.
- Terrain is built at world load, not regenerated every frame. Background generation/worker work would target loading stalls, not directly fix steady race heat.
- The minimap base is cached; the leaderboard is already throttled to roughly 11 Hz. Speedometer/minimap foreground and other HUD updates still run per race frame. Optimize only after measuring their contribution.
- Meshes are instanced and world GPU buffers are explicitly destroyed on replacement. No memory leak was established by this review.
- Radio and game audio already have visibility handling. Do not assume the recently added radio is the main heat source without an audio-on/off comparison.
- Basic touch steering/throttle/drift exists (`game.js:291`); mobile gameplay still needs usable pitch, brake, weapon, restart and menu controls.

## Prioritized todo

### P0: establish a power budget and stop unnecessary work

- [ ] Record a reproducible baseline on the actual laptop: fixed seed, viewport, brightness, refresh rate, power source and radio state. Capture CPU profile, optional GPU timestamp queries per pass, submitted geometry, render size, frame p50/p95/p99, memory and OS energy/thermal measurements where available. Include cover, selector, solo race and multiplayer host/client.
- [ ] Add explicit Eco / Balanced / High presets. Initial targets to validate: Eco 30 FPS with around 720p internal rendering and no dynamic shadows/bloom; Balanced capped 60 FPS with dynamic resolution and reduced shadows; High opt-in. Keep UI/text at native resolution. A preset is a workload budget, not a device-temperature guarantee.
- [ ] Separate simulation from rendering using a fixed-step accumulator and interpolation, with bounded catch-up. Benchmark 60/120 Hz simulation options against current flight and collision behavior before selecting one. Preserve elapsed race time and multiplayer authority/snapshot behavior when frames are skipped. Do not silently change track, collision geometry, craft stats or opponent count by device quality.
- [ ] Persist render scale and impose an internal-pixel budget; stop default `resize()` from resetting the selected scale. Change render-target size only when needed. At the same viewport, DPR 1 rather than 1.5 produces about 56% fewer pixels, not necessarily 56% less power.
- [ ] Make cover and paused menus static or animate at 10-15 FPS. Explicitly suspend rendering and thumbnail work when hidden. Pause solo simulation safely; define a multiplayer host departure/pause/reconnect policy because blindly suspending the host can stall the room.
- [ ] Try `requestAdapter({powerPreference: 'low-power'})` for Eco. This is only a selection hint, and may select the same hardware. Keep a fallback if the request fails.

### P1: reduce cost per frame

- [ ] Add true shader/pipeline variants: skip shadow-map rendering and shadow sampling when disabled; offer 512/1024 maps; remove bloom and optional outlines/chromatic effects in Eco. Update hardcoded shadow resolution in both `frame.js` and `shaders.js` when resizing shadows. Turning effect intensity to zero without skipping work is insufficient.
- [ ] Partition terrain and props into spatial chunks, reject chunks outside the camera view, and use separate shadow-caster visibility rules. Add distance LODs for terrain, flora, props and distant craft. Retain consistent collision surfaces and deterministic gameplay across presets.
- [ ] Enable backface culling for verified closed meshes after checking winding. Keep two-sided foliage/sails on suitable pipelines; applying culling globally may make geometry disappear.
- [ ] Profile render-target bandwidth. In low quality, consider removing the normals/depth colour attachment when outlines no longer use it and choosing cheaper compatible formats. Do not blindly downgrade HDR outputs or discard buffers still sampled later.
- [ ] Set particle visibility/spawn budgets by quality, especially distant exhaust and transparent effects. Preserve gameplay cues for weapons, damage and gates.
- [ ] Render thumbnails directly to small offscreen targets; cache them and generate only visible entries. Avoid borrowing/redrawing the full game canvas or synchronous full-size readback for every tile.
- [ ] Profile HUD/allocation costs, cache static speedometer artwork, and update noncritical UI at a modest rate. Avoid optimizing the already-throttled leaderboard ahead of GPU work.

### P2: sustained mobile play and validation

- [ ] Add adaptive quality based on rolling frame-time measurements, with hysteresis, slow recovery and a ceiling set by the selected preset. Keep unused performance headroom instead of always increasing quality until the device saturates. Browser frame time is not a temperature sensor; native Android thermal APIs are not directly callable by this browser game.
- [ ] Finish touch controls and test landscape/portrait resizing, safe areas, interrupted touches, background/resume, radio, networking and GPU device loss. Current device-loss handling only logs an error.
- [ ] Feature-detect WebGPU and test actual Android and iPhone browsers/devices. If older non-WebGPU phones are a requirement, scope a separate WebGL2 renderer/fallback; lowering graphics quality cannot make WebGPU available.
- [ ] Run matched 15-20 minute baseline/optimized sessions on a laptop and representative midrange Android/iPhone hardware. Check stable 30 FPS Eco / 60 FPS Balanced where sustainable, p95/p99 stalls, input feel, battery/energy, temperature or OS thermal state where measurable, and no degradation late in the run. Include multiplayer hosting and demanding biome/particle scenes.
- [ ] Accept changes only when equivalent gameplay consumes less measured energy and/or improves sustained frame pacing. Report actual results per device rather than promising universal cooling percentages.

## Reference practices

- [Android thermal management](https://developer.android.com/games/optimize/adpf/thermal) describes reducing fidelity/resolution/frame rate to stay within sustained thermal limits, including Unity/Unreal quality controls. The workload strategy transfers to the web; the native thermal API does not.
- [MDN rendering best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) recommends a smaller back buffer and batching. These principles apply to this renderer even though it uses WebGPU rather than WebGL.
- [Arm mobile GPU profiling guidance](https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/accelerating-mali-gpu-analysis-using-arm-mobile-studio) recommends application-side visibility rejection and reviewing mesh density/LOD when geometry is wasted.
- [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) documents refresh-rate scheduling and usual hidden-tab suspension.
- [MDN adapter selection](https://developer.mozilla.org/en-US/docs/Web/API/GPU/requestAdapter) explains the low-power hint and dual-GPU Mac behavior.
- [WebGPU timestamp-query sample](https://webgpu.github.io/webgpu-samples/?sample=timestampQuery) demonstrates optional GPU-pass timing. Pair it with end-to-end and energy measurements.
- [WebKit Safari 26 release](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) documents WebGPU on Apple platforms; still feature-detect and test actual devices.
