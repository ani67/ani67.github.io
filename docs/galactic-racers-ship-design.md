# Replacement fleet

Review URL: http://localhost:3000/galactic-racers/ship-studio.html

`public/galactic-racers/ships/fleet.json` records the legacy fleet and the separate replacement collection. All six current families, their 30 authored archetypes, faction variants, and the existing kitbash generator are marked for retirement. The six replacements now supply player, bot and multiplayer meshes; legacy geometry remains available only in the archive.

The collection contains Retro saucer, Industrial tug, Orbital racer, Splitwing, Twinfin and Longtail. Add each new design to `designs` with `id`, `name`, `status`, `notes`, and a same-origin `previewUrl` relative to the studio. Set `current` to that design's ID. The stable studio URL then shows it automatically. Preview pages can use entirely new geometry/rendering; they are not restricted to the legacy part grammar. The studio reads the registry without caching.

Review each ship's silhouette, proportions, cockpit, engines, materials, front/side/top and chase-camera rear view. Iterate on the current design before beginning the next. The playable fleet retains the balanced family stat profiles. Paint IDs are transported with each player choice independently of terrain. No legacy designs belong in the final replacement roster.

Archive links show seed 1 of each old family as references. They render on interaction in Eco mode to avoid an always-running turntable while discussing designs.

Game previews fit the full three-dimensional bounds, including vertical wings. Paint travels in the existing archSeed field. Static surface patterns run in the ship shader with distance fading, without another render pass; wings retain their single paint shade.
