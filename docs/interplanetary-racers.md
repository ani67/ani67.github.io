# Interplanetary Racers

The game is hosted at `/interplanetary-racers/`. The homepage card opens the standard fullscreen gallery viewer; **Play game** opens the standalone game in a new tab. Its craft, planet and track designers remain available through the game's own links.

The runtime lives in `public/interplanetary-racers/`, so Next serves it during development and copies it unchanged into the static Pages export. No game server or separate deployment is needed for solo play. Multiplayer uses the game's existing PeerJS signalling broker and WebRTC connections; it has no TURN relay, so some networks cannot connect.

This is a source snapshot copied from `/Users/ani/Frameo/Racing Game` on 7 September 2026. The original folder was not modified and is not required to build or deploy the portfolio. To ship future game changes, update the files in `public/interplanetary-racers/src/` and any affected HTML pages here. Preserve the portfolio navigation, SEO metadata, no-script fallback and compatibility message added to this copy of `index.html`.

The homepage entry is `interplanetary-racers` in `content/gallery.json`. Its preview is a four-frame game capture at `public/images/interplanetary-racers.jpg`, showing the title screen, craft selection, planet selection and an in-race view. The homepage uses that lightweight still thumbnail. Opening the fullscreen viewer mounts the live game in an iframe, starting on the same Halcyon seed; closing it unloads the renderer. The separate Play game link still opens the dedicated page. The embed uses `?preview=1` to hide its duplicate portfolio link.

Run `npm run dev` for local development, or `npm run build` and `npm start` to preview the exported site. WebGPU requires a compatible browser/device and a secure context; the deployed site's HTTPS and local localhost development satisfy the secure-context requirement. The game shows a compatibility message if initialization fails.
