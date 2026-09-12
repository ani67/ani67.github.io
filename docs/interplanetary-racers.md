# Interplanetary Racers

The game is hosted at `/interplanetary-racers/`. The homepage card opens the standard fullscreen gallery viewer; **Play game** opens the standalone game in a new tab. Its craft, planet and track designers remain available through the game's own links.

The runtime lives in `public/interplanetary-racers/`, so Next serves it during development and copies it unchanged into the static Pages export. No game server or separate deployment is needed for solo play. Multiplayer uses the game's existing PeerJS signalling broker and WebRTC connections; it has no TURN relay, so some networks cannot connect.

This is a source snapshot copied from `/Users/ani/Frameo/Racing Game` on 7 September 2026. The original folder was not modified and is not required to build or deploy the portfolio. To ship future game changes, update the files in `public/interplanetary-racers/src/` and any affected HTML pages here. Preserve the portfolio navigation, SEO metadata, no-script fallback and compatibility message added to this copy of `index.html`.

The homepage entry is `interplanetary-racers` in `content/gallery.json`. Its thumbnail shows the title screen. Opening the fullscreen viewer shows still screenshots one at a time, with four selectable thumbnails for the title screen, craft selection, planet selection and an in-race view. The screenshots are hosted on Cloudinary and listed in `public/data/collections/interplanetary-racers.json`. The Play game link opens the dedicated game page.

Run `npm run dev` for local development, or `npm run build` and `npm start` to preview the exported site. WebGPU requires a compatible browser/device and a secure context; the deployed site's HTTPS and local localhost development satisfy the secure-context requirement. The game shows a compatibility message if initialization fails.

Background music is the ON Dance live stream from Hof, Germany, configured in `src/radio.js` using the HTTPS address from the station's official player. It starts on the first user interaction, respects the existing Music and mute settings, and pauses when the tab is hidden. The generated score is disabled when the radio module is loaded; game sound effects remain active. Radio needs an internet connection. Its status and station link appear in Settings, and a later click retries failed playback.

Graphics settings provide Eco (30 FPS), Balanced and High (60 FPS), with adaptive internal resolution. Touch devices default to Eco and offer on-screen flight controls. Menus settle at 12 FPS and then stop rendering until interaction, solo settings pause the race, and hiding the multiplayer host explicitly pauses the room until they return. See the [performance implementation report](interplanetary-racers-performance-plan.md) for workload measurements, tests and physical-device validation still needed. Add `?profile=1` to enable optional GPU-pass timings; `Game.ui.performance()` exposes diagnostic metrics in the browser console.
