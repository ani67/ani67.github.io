# Interplanetary Racers

The game is hosted at `/interplanetary-racers/`. The homepage card opens the standard fullscreen gallery viewer; **Play game** opens the standalone game in a new tab. Its craft, planet and track designers remain available through the game's own links.

The runtime lives in `public/interplanetary-racers/`, so Next serves it during development and copies it unchanged into the static Pages export. No game server or separate deployment is needed for solo play. Multiplayer uses the game's existing PeerJS signalling broker and WebRTC connections; it has no TURN relay, so some networks cannot connect.

This is a source snapshot copied from `/Users/ani/Frameo/Racing Game` on 7 September 2026. The original folder was not modified and is not required to build or deploy the portfolio. To ship future game changes, update the files in `public/interplanetary-racers/src/` and any affected HTML pages here. Preserve the portfolio navigation, SEO metadata, no-script fallback and compatibility message added to this copy of `index.html`.

The homepage entry is `interplanetary-racers` in `content/gallery.json`. Its preview is a real game capture at `public/images/interplanetary-racers.jpg`. The thumbnail is a still image so the homepage and gallery overlay don't start a GPU renderer; gameplay begins on the dedicated page.

Run `npm run dev` for local development, or `npm run build` and `npm start` to preview the exported site. WebGPU requires a compatible browser/device and a secure context; the deployed site's HTTPS and local localhost development satisfy the secure-context requirement. The game shows a compatibility message if initialization fails.
