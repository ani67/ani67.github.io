// Screens and flow: cover, settings, setup (craft, planet, room), results. Talks to the game through Game.ui.
const UI = (() => {
  const $ = id => document.getElementById(id);
  let screen = null, sel = { race: 0, planet: 0, archSeed: 1, kit: false, kitSeed: 1 }, seed = '', roomCode = '', boardTimer = 0, legendTimer = null;
  const settings = { name: null };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('ir.settings') || '{}')); } catch (e) {}
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const A = fn => { try { if (typeof Audio !== 'undefined' && Audio && Audio.sfx) fn(Audio); } catch (e) {} };
  // Browsers only allow audio after a user gesture. The cover's Start button is one, but deep links
  // (#p=..., skip=1) go straight into a race, so arm the context on the first gesture anywhere.
  (function armAudio() {
    const go = () => { A(a => { a.init(); a.resume && a.resume(); }); off(); };
    const off = () => { for (const e of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(e, go, true); };
    for (const e of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(e, go, true);
  })();
  const STATS = ['speed', 'accel', 'drift', 'defense', 'life'];

  // ---------------------------------------------------------------- screens
  function show(name) {
    screen = name;
    releaseFlight();
    $('touchControls').hidden = name !== null;
    $('raceTools').hidden = name !== null;
    for (const el of document.querySelectorAll('#ui .screen')) el.classList.toggle('on', el.id === name);
    $('hud').classList.toggle('on', name === null || name === 'results');
    if (name === 'cover') updateCoverLine();
    if (name === 'ship') renderShip();
    if (name === 'planet') { renderPlanet(); $('seedField').value = seed; }
    if (name === 'room') renderRoom();
    if (name === 'settings') syncSettings();
    Game.ui.invalidate();
    scheduleUi();
  }
  function makeCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  function updateCoverLine() {
    const g = Game.ui;
    $('coverWhere').innerHTML = `<b>${g.planet().name}</b> · ${g.desc().name} · seed <b>${g.seed()}</b>`;
  }

  // Current craft choice: a race family (archetype seed) or a kitbash generated for that race.
  function currentCraft() {
    const r = Planets.RACES[sel.race];
    if (sel.kit && typeof Kitbash !== 'undefined') { const rec = Kitbash.forRace(r.id, sel.kitSeed); rec.hue = r.hue; rec.seed = sel.kitSeed; return { race: r, craft: rec, recipe: rec, seed: sel.kitSeed }; }
    return { race: r, craft: null, recipe: Planets.RECIPES[r.vehicle], seed: sel.archSeed };
  }

  // Cover: random planet, gallery camera.
  function goCover() {
    const p = Planets.PLANETS[Math.floor(Math.random() * Planets.PLANETS.length)];
    Game.ui.select({ planetId: p.id, seed: Game.ui.randomSeed(), raceId: Planets.RACES.find(r => r.planet === p.id)?.id, craftSeed: null, mode: 'cover' });
    seed = Game.ui.seed();
    sel.planet = Planets.PLANETS.indexOf(p);
    sel.race = Math.max(0, Planets.RACES.findIndex(r => r.planet === p.id));
    show('cover');
  }
  function goShip() {
    const cc = currentCraft();
    Game.ui.select({ raceId: cc.race.id, craft: cc.craft, craftSeed: cc.seed, mode: 'showcase' });
    if (mp() && MP.connected()) pushPick();   // the lobby shows what everyone has picked
    show('ship');
    A(a => { a.init(); a.race('menu'); a.sfx.step(); });
  }
  function goPlanet() {
    const p = Planets.PLANETS[sel.planet];
    Game.ui.select({ planetId: p.id, seed, mode: 'gallery' });
    show('planet');
    A(a => a.sfx.step());
  }
  function goRoom() { show('room'); A(a => a.sfx.step()); }
  function startRace() {
    const cc = currentCraft(), p = Planets.PLANETS[sel.planet];
    if (mp() && MP.connected()) {
      if (MP.isClient()) return;                       // only the host starts a room race
      pushPick();
      MP.startRace(p.id, seed);                        // loads the same world on every machine
      showLegend();
      return;
    }
    Game.ui.select({ planetId: p.id, seed, raceId: cc.race.id, craft: cc.craft, craftSeed: cc.seed, mode: 'race' });
    show(null);
    showLegend();
  }

  // ---------------------------------------------------------------- room: host, join, lobby
  const mp = () => typeof MP !== 'undefined' && Net.available();
  let netNote = 'Race on your own, or open a room and share the code.', netErr = false, manualRole = null;
  function pushPick() {
    if (!mp()) return;
    const cc = currentCraft();
    MP.setLocal({ raceId: cc.race.id, archSeed: sel.archSeed, kitSeed: sel.kitSeed, kit: sel.kit, name: Game.ui.playerName() });
  }
  const STATUS_TEXT = { hosting: 'waiting for players', signalling: 'contacting the broker…', connecting: 'connecting to the host…', connected: 'connected', lobby: 'in the lobby', racing: 'racing', manual: 'direct connection', closed: 'room closed', 'signalling-lost': 'signalling dropped (already connected peers are fine)' };
  function renderRoom() {
    const on = mp() && MP.connected();
    $('roomPick').hidden = !!on;
    $('roomLobby').hidden = !on;
    $('roomCopy').hidden = !(on && MP.isHost());
    $('roomLeave').hidden = !on;
    $('roomManual').hidden = !!on;
    if (!on) {
      $('roomNote').textContent = netNote;
      $('roomNote').classList.toggle('err', netErr);
      $('roomStart').innerHTML = 'Start race <kbd>↵</kbd>'; $('roomStart').disabled = false;
      return;
    }
    $('roomCode').textContent = MP.code();
    $('roomCodeLabel').textContent = MP.isHost() ? 'Share this code, others can join' : 'Joined room';
    const err = MP.error(), st = MP.status();
    $('roomStatus').textContent = err || STATUS_TEXT[st] || st;
    $('roomStatus').classList.toggle('err', !!err);
    const ps = MP.players();
    $('lobbyRows').innerHTML = ps.length ? ps.map(p => {
      const race = Planets.race(p.raceId), craft = race ? Planets.VEHICLES[race.vehicle].name : '';
      return `<div class="r on${p.me ? ' me' : ''}"><span class="dot"></span><span class="who">${esc(p.name || 'racer')}${p.dropped ? ' · left' : ''}${p.me ? ' · you' : ''}</span><span>${p.kit ? 'kitbash' : craft}</span><span class="ping num">${p.ping ? p.ping + ' ms' : ''}</span></div>`;
    }).join('') : '<div class="r"><span class="dot"></span><span class="who">waiting for players…</span><span></span><span></span></div>';
    $('roomStart').innerHTML = MP.isHost() ? 'Start race <kbd>↵</kbd>' : 'Waiting for the host';
    $('roomStart').disabled = !MP.isHost();
  }
  async function doHost() {
    if (!mp()) { netErr = true; netNote = 'this browser has no WebRTC'; renderRoom(); return; }
    netErr = false; netNote = 'opening a room…'; renderRoom();
    pushPick();
    roomCode = makeCode();
    try { await MP.hostRoom(roomCode); }
    catch (e) {
      netErr = true;
      netNote = e.code === 'taken' ? 'that code is already in use, try again'
        : 'could not reach the room broker. Use “No connection?” to connect by pasting codes.';
      MP.leave();
    }
    renderRoom();
  }
  async function doJoin(codeIn) {
    const c = (codeIn || '').trim().toUpperCase();
    if (c.length < 4) { netErr = true; netNote = 'enter the six letter code'; renderRoom(); return; }
    netErr = false; netNote = 'connecting…'; renderRoom();
    pushPick();
    try { await MP.joinRoom(c); }
    catch (e) {
      netErr = true;
      netNote = 'could not reach the room broker. Use “No connection?” to connect by pasting codes.';
      MP.leave();
    }
    renderRoom();
  }

  // ---------------------------------------------------------------- craft screen: hero + rail
  // Tiles show a real render (src/thumbs.js). The flat drawing below is the placeholder until one arrives.
  function tile(cls, imgUrl, key, title, sub) {
    const b = document.createElement('button'); b.className = 'tile' + (cls ? ' ' + cls : '');
    const pic = document.createElement('div'); pic.className = 'pic' + (imgUrl ? '' : ' wait');
    if (imgUrl) { const im = document.createElement('img'); im.src = imgUrl; im.alt = title; pic.appendChild(im); }
    if (key) pic.dataset.thumb = key;
    b.appendChild(pic);
    const n = document.createElement('div'); n.className = 'n';
    n.innerHTML = `<span class="t">${title}</span><small>${sub || ''}</small>`;
    b.appendChild(n);
    return b;
  }
  // Swap in a render the moment it is ready, without rebuilding the rail.
  const TH = () => typeof Thumbs !== 'undefined' && Thumbs.craft;
  function fillThumb(key) {
    const url = Thumbs.get(key); if (!url) return;
    for (const pic of document.querySelectorAll(`.tile .pic[data-thumb="${CSS.escape(key)}"]`)) {
      if (pic.querySelector('img')) continue;
      pic.classList.remove('wait', 'paint');
      const old = pic.querySelector('canvas'); if (old) old.remove();
      const im = document.createElement('img'); im.src = url; pic.appendChild(im);
    }
  }
  // A stable key per craft so a render is cached and reused across rail rebuilds.
  function craftKey(race, kit, seedN) { return 'c:' + (kit ? 'kit' : race.vehicle) + ':' + race.id + ':' + seedN; }
  let thumbObserver = null;
  function observeThumbs(rail) {
    if (thumbObserver) thumbObserver.disconnect();
    thumbObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.requestThumb?.();
        thumbObserver.unobserve(entry.target);
      }
    }, { root: rail, rootMargin: '0px 100px' });
    for (const tile of rail.children) if (tile.requestThumb) thumbObserver.observe(tile);
  }
  function renderShip() {
    const cc = currentCraft(), r = cc.race, home = Planets.planet(r.planet);
    const st = Stats.compute(cc.recipe, cc.seed);
    $('heroName').textContent = cc.craft ? (cc.craft.name || 'Kitbash') : Planets.VEHICLES[r.vehicle].name;
    $('heroSub').textContent = `${r.name} of ${home ? home.name : ''}${cc.craft ? ' · kitbash' : st.archetype ? ' · ' + st.archetype : ''}`;
    $('heroTag').textContent = `${r.ability.name} · ${r.ability.desc}`;
    $('heroStats').innerHTML = STATS.map(k => { const v = Math.max(0, Math.min(1, st.bars[k] || 0)); return `<div class="st"><span class="k">${k}</span><span class="v num">${(v * 10).toFixed(1)}</span><i style="--v:${Math.max(0.03, v).toFixed(2)}"></i></div>`; }).join('');
    $('archName').textContent = cc.craft ? `Kit ${sel.kitSeed}` : (st.archetype || '');
    $('archHint').textContent = cc.craft ? 'kitbash · seed' : `archetype · seed ${sel.archSeed}`;
    // Rail: one tile per race plus a kitbash tile. Each shows a real render of that craft.
    const rail = $('shipRail'); rail.innerHTML = '';
    Planets.RACES.forEach((race, i) => {
      const key = craftKey(race, false, sel.archSeed);
      const seedN = sel.archSeed;
      const url = TH() ? Thumbs.get(key) : null;
      const b = tile(i === sel.race && !sel.kit ? 'on' : '', url, key, Planets.VEHICLES[race.vehicle].name, race.name);
      if (!url && TH()) b.requestThumb = () => Thumbs.craft(key, Planets.RECIPES[race.vehicle], seedN, race.hue);
      b.dataset.i = i;
      b.onclick = () => { sel.race = i; sel.kit = false; goShip(); };
      rail.appendChild(b);
    });
    const kitKey = craftKey(r, true, sel.kitSeed);
    const kitSeedN = sel.kitSeed;
    const kitUrl = cc.craft && TH() ? Thumbs.get(kitKey) : null;
    const kb = tile('kit' + (sel.kit ? ' on' : ''), kitUrl, cc.craft ? kitKey : '', 'Kitbash', sel.kit ? 'reroll ›' : 'generate one');
    if (!kitUrl && cc.craft && TH()) kb.requestThumb = () => Thumbs.craft(kitKey, cc.craft, kitSeedN, r.hue);
    kb.onclick = () => { if (sel.kit) sel.kitSeed = Math.floor(Math.random() * 9000) + 1; sel.kit = true; goShip(); };
    rail.appendChild(kb);
    scrollToOn(rail);
    observeThumbs(rail);
  }
  function scrollToOn(rail) { const on = rail.querySelector('.tile.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' }); }

  // ---------------------------------------------------------------- planet screen: hero + rail with painted glimpses
  const glimpseCache = new Map();
  function planetGlimpse(p) {
    if (glimpseCache.has(p.id)) return glimpseCache.get(p.id);
    const cv = document.createElement('canvas'); cv.width = 312; cv.height = 188;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    let d = null; try { d = World.generate('glimpse-' + p.id, p, null); } catch (e) {}
    const c = a => `rgb(${a.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`;
    const sky = d ? d.sky : [[0.2, 0.2, 0.3], [0.05, 0.05, 0.1]], pal = d ? d.pal5 : [[0.1, 0.1, 0.1], [0.3, 0.3, 0.3], [0.5, 0.5, 0.5], [0.7, 0.7, 0.7], [0.9, 0.9, 0.9]];
    const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, c(sky[1])); grad.addColorStop(1, c(sky[0]));
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const rnd = M.mulberry32(M.hashStr(p.id));
    if (d && d.stars) for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(rnd() * W, rnd() * H * 0.7, 1.5, 1.5); }
    const space = p.medium === 'space';
    if (!space) {
      // Far and near ground bands with a wavy horizon.
      const bands = [[pal[3], 0.55, 14, 0.5], [pal[2], 0.66, 22, 0.8], [pal[1], 0.8, 16, 1.0]];
      for (const [col, y0, amp, f] of bands) {
        g.fillStyle = c(col); g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 6) g.lineTo(x, H * y0 + Math.sin(x * 0.02 * f + f * 3) * amp + Math.sin(x * 0.07 * f) * amp * 0.3);
        g.lineTo(W, H); g.closePath(); g.fill();
      }
      if (d && d.waterLevel > -1e3 && (p.water || /atoll|water|drowned/i.test(p.tagline || ''))) { g.fillStyle = c(sky[0].map((v, i) => v * 0.7 + pal[3][i] * 0.3)); g.globalAlpha = 0.6; g.fillRect(0, H * 0.72, W, H * 0.1); g.globalAlpha = 1; }
    } else {
      for (let i = 0; i < 18; i++) { g.fillStyle = c(pal[1 + (i % 3)]); const rr = 4 + rnd() * 14; g.beginPath(); g.arc(rnd() * W, rnd() * H, rr, 0, Math.PI * 2); g.fill(); }
    }
    // Prop silhouettes by kind.
    g.fillStyle = c(pal[0].map(v => v * 0.85));
    const kind = space ? 'debris' : /canyon|mesa|rock/i.test(p.tagline || '') ? 'mesa' : /city|tower|dusk/i.test(p.tagline || '') ? 'city' : /ice|frozen|snow/i.test(p.tagline || '') ? 'spire' : /forest|jungle|autumn|palm|atoll/i.test(p.tagline || '') ? 'tree' : p.props === 2 ? 'ring' : p.props === 1 ? 'shard' : 'column';
    for (let i = 0; i < 6; i++) {
      const x = 20 + rnd() * (W - 40), base = H * (0.72 + rnd() * 0.12), h = 18 + rnd() * 40, w = 6 + rnd() * 14;
      g.beginPath();
      if (kind === 'mesa') { g.rect(x - w * 1.6, base - h * 0.6, w * 3.2, h * 0.6); }
      else if (kind === 'city') { g.rect(x - w * 0.5, base - h * 1.3, w, h * 1.3); }
      else if (kind === 'spire') { g.moveTo(x - w * 0.5, base); g.lineTo(x, base - h * 1.4); g.lineTo(x + w * 0.5, base); }
      else if (kind === 'tree') { g.rect(x - 1.5, base - h * 0.6, 3, h * 0.6); g.moveTo(x, base - h * 0.6); g.arc(x, base - h * 0.75, w * 0.9, 0, Math.PI * 2); }
      else if (kind === 'ring') { g.arc(x, base - h * 0.5, w, 0, Math.PI * 2); g.arc(x, base - h * 0.5, w * 0.7, 0, Math.PI * 2, true); }
      else if (kind === 'debris') { g.moveTo(x, base - h); g.lineTo(x + w, base - h * 0.5); g.lineTo(x - w * 0.4, base - h * 0.3); }
      else if (kind === 'shard') { g.moveTo(x - w * 0.4, base); g.lineTo(x, base - h); g.lineTo(x + w * 0.4, base); }
      else { g.rect(x - w * 0.3, base - h, w * 0.6, h); }
      g.closePath(); g.fill();
    }
    // Paper grain.
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${(rnd() * 0.08).toFixed(3)})`; g.fillRect(rnd() * W, rnd() * H, 1, 1); }
    glimpseCache.set(p.id, cv); return cv;
  }
  function renderPlanet() {
    const p = Planets.PLANETS[sel.planet];
    $('planetName').textContent = p.name; $('planetSub').textContent = p.tagline;
    $('planetTag').textContent = `${p.medium} · ${p.laneStyle || (p.mode === 'corridor' ? 'sky lane' : 'terrain lane')}`;
    const rail = $('planetRail'); rail.innerHTML = '';
    Planets.PLANETS.forEach((pl, i) => {
      const key = 'p:' + pl.id;
      const url = TH() ? Thumbs.get(key) : null;
      const b = tile(i === sel.planet ? 'on' : '', url, key, pl.name, (pl.laneStyle || (pl.mode === 'corridor' ? 'sky' : 'terrain')) + ' lane');
      b.dataset.i = i;
      if (!url && TH()) b.requestThumb = () => Thumbs.planet(pl);
      if (!url) { const g = planetGlimpse(pl); const pic = b.querySelector('.pic'); pic.classList.remove('wait'); pic.appendChild(g); pic.classList.add('paint'); }
      b.onclick = () => { sel.planet = i; goPlanet(); };
      rail.appendChild(b);
    });
    scrollToOn(rail);
    observeThumbs(rail);
  }

  // ---------------------------------------------------------------- settings
  function syncSettings() {
    // The look sliders need a loaded world; the rest of the panel works without one (deep link, cover).
    let look = null; try { look = Game.ui.desc().look; } catch (e) {}
    $('setQuality').value = Game.ui.quality();
    updateQualityNote();
    $('settingsRaceNote').textContent = lastBefore === null && Game.ui.state() === 'race' ? (Game.ui.paused() ? 'Race paused. Back to continue.' : 'Your multiplayer race continues while settings are open.') : '';
    for (const id of ['setEdge', 'setDither', 'setMap']) $(id).disabled = !look;
    if (look) {
      $('setEdge').value = look.edge; $('setEdgeV').textContent = (+look.edge).toFixed(2);
      $('setDither').value = look.dither; $('setDitherV').textContent = (+look.dither).toFixed(2);
      $('setMap').value = look.colormap; $('setMapV').textContent = (+look.colormap).toFixed(2);
    }
    $('setName').value = Game.ui.playerName();
    A(a => { const v = a.volumes(); $('setMusic').value = v.music; $('setMusicV').textContent = v.music.toFixed(2); $('setSfx').value = v.sfx; $('setSfxV').textContent = v.sfx.toFixed(2); });
    $('setControls').innerHTML = CONTROLS.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('');
  }
  const CONTROLS = [['A D / ← →', 'yaw'], ['W', 'throttle'], ['S', 'brake'], ['↑ ↓', 'pitch'], ['space', 'vertical thrust'], ['shift', 'drift, release to boost'], ['E', 'use item'], ['C', 'cockpit camera'], ['G', 'gallery camera'], ['R', 'return to lane'], ['M', 'mute audio'], ['N', 'new seed'], ['esc', 'back']];

  // ---------------------------------------------------------------- legend + leaderboard
  function showLegend() {
    const rows = [['← →', 'yaw'], ['W S', 'throttle, brake'], ['↑ ↓', 'pitch'], ['space', 'thrust up'], ['shift', 'drift'], ['E', 'item'], ['C', 'cockpit'], ['R', 'lane']];
    $('legend').innerHTML = rows.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('');
    $('legend').classList.remove('faded');
    clearTimeout(legendTimer); legendTimer = setTimeout(() => $('legend').classList.add('faded'), 8000);
  }
  function tickBoard(now) {
    if (now - boardTimer < 90) return; boardTimer = now;
    if (!$('hud').classList.contains('on')) return;
    const g = Game.ui, order = g.order();
    const lead = order[0];
    const rows = order.map((c, i) => {
      let gap = '';
      if (c !== lead) gap = c.finished && lead.finished ? `+${(c.finishTime - lead.finishTime).toFixed(1)}s` : `+${Math.round(Math.max(0, (lead.prog - c.prog) * g.trackLength()))} m`;
      return `<div class="row${c.isPlayer ? ' me' : ''}"><span class="n num">${i + 1}</span><span class="who">${esc(c.name)}</span><span class="gap num">${gap}</span></div>`;
    });
    if (typeof Weapons !== 'undefined' && Weapons.decoys) for (const d of Weapons.decoys()) rows.push(`<div class="row decoy"><span class="n num">·</span><span class="who">${esc(d.name || 'unknown')}</span><span class="gap num">?</span></div>`);
    $('rows').innerHTML = rows.join('');
    // Connection health: worst ping in the room, and a warning if a peer is lagging or has gone quiet.
    const ind = $('netind');
    if (mp() && MP.active()) {
      const s = MP.stats(), pings = (s.peers || []).map(p => p.ping).filter(Boolean);
      const worst = pings.length ? Math.max(...pings) : 0;
      const bad = worst > 250 || (s.peers || []).some(p => !p.open);
      ind.hidden = false; ind.classList.toggle('warn', bad);
      ind.textContent = `${MP.isHost() ? 'host' : 'client'} · ${(s.peers || []).length} peer${(s.peers || []).length === 1 ? '' : 's'}${worst ? ' · ' + worst + ' ms' : ''}`;
    } else ind.hidden = true;
  }

  // ---------------------------------------------------------------- results
  function showResults() {
    const g = Game.ui, order = g.finalOrder(), me = order.find(c => c.isPlayer), pos = order.indexOf(me);
    const ord = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][pos];
    $('verdict').textContent = pos === 0 ? 'Victory' : ord;
    $('resultsSub').textContent = `${g.planet().name} · ${g.desc().name} · ${me.finishTime ? me.finishTime.toFixed(2) + ' s' : ''}`;
    const lead = order[0];
    $('resultRows').innerHTML = order.map((c, i) => `<div class="r${c.isPlayer ? ' me' : ''}"><span class="n display num">${i + 1}</span><span class="who">${esc(c.name)}</span><span class="time num">${c.finishTime ? c.finishTime.toFixed(2) + ' s' : 'racing'}</span><span class="gap num">${i === 0 ? '' : (c.finishTime && lead.finishTime ? '+' + (c.finishTime - lead.finishTime).toFixed(2) : '')}</span></div>`).join('');
    show('results');
  }

  // ---------------------------------------------------------------- keys
  function moveShip(d) {
    const n = Planets.RACES.length; // the kitbash tile sits after the last race
    let i = sel.kit ? n : sel.race;
    i = (i + d + n + 1) % (n + 1);
    if (i === n) { sel.kit = true; } else { sel.kit = false; sel.race = i; }
    goShip();
  }
  function onKey(e) {
    if (!screen) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' && e.key !== 'Enter' && e.key !== 'Escape') return;
    if (e.key === 'Enter') { e.preventDefault(); primary(); }
    else if (e.key === 'Escape') { e.preventDefault(); back(); }
    else if ((screen === 'ship' || screen === 'planet') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault(); const d = e.key === 'ArrowLeft' ? -1 : 1;
      if (screen === 'ship') moveShip(d); else { sel.planet = (sel.planet + d + Planets.PLANETS.length) % Planets.PLANETS.length; goPlanet(); }
    }
    else if (screen === 'ship' && (e.key === '[' || e.key === ']')) { cycleSeed(e.key === ']' ? 1 : -1); }
  }
  function cycleSeed(d) { if (sel.kit) sel.kitSeed = Math.max(1, sel.kitSeed + d); else sel.archSeed = Math.max(1, sel.archSeed + d); goShip(); }
  function primary() {
    if (screen === 'cover') goShip();
    else if (screen === 'ship') goPlanet();
    else if (screen === 'planet') { seed = $('seedField').value.trim() || seed; goRoom(); }
    else if (screen === 'room') startRace();
    else if (screen === 'results') Game.ui.restart();
    else if (screen === 'settings') back();
  }
  function back() {
    if (screen === 'settings') { Game.ui.setPaused(false); show(lastBefore); }
    else if (screen === 'ship') goCover();
    else if (screen === 'planet') goShip();
    else if (screen === 'room') goPlanet();
    else if (screen === 'results') { Game.ui.home(); goCover(); }
  }
  let lastBefore = null;

  const QUALITY_NOTES = {
    eco: '30 FPS limit. Lower resolution, no dynamic shadows or bloom. Uses less graphics power.',
    balanced: '60 FPS limit. Reduced shadows and adaptive resolution for smoother play.',
    high: '60 FPS limit. Sharper rendering and full effects, with a higher graphics workload.',
  };
  function updateQualityNote() { $('qualityNote').textContent = QUALITY_NOTES[Game.ui.quality()]; }
  function openSettings() {
    lastBefore = screen;
    Game.ui.setPaused(true);
    show('settings');
  }
  const heldFlight = new Map();
  const flightEvent = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
  function releaseFlight() {
    for (const button of heldFlight.values()) {
      flightEvent('keyup', button.dataset.flight);
      button.classList.remove('held');
    }
    heldFlight.clear();
  }
  function bindFlight() {
    for (const button of document.querySelectorAll('[data-flight]')) {
      button.addEventListener('pointerdown', e => {
        if (screen !== null || heldFlight.has(e.pointerId)) return;
        e.preventDefault(); e.stopPropagation();
        button.setPointerCapture(e.pointerId);
        heldFlight.set(e.pointerId, button);
        button.classList.add('held');
        flightEvent('keydown', button.dataset.flight);
      });
      const end = e => {
        const held = heldFlight.get(e.pointerId);
        if (!held) return;
        heldFlight.delete(e.pointerId);
        if (![...heldFlight.values()].includes(held)) {
          held.classList.remove('held');
          flightEvent('keyup', held.dataset.flight);
        }
      };
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, end);
      button.addEventListener('contextmenu', e => e.preventDefault());
    }
    window.addEventListener('blur', releaseFlight);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseFlight(); });
    $('raceSettings').onclick = openSettings;
    $('raceRestart').onclick = () => {
      if (mp() && MP.active()) { notice('Use To lane (R) to recover during a multiplayer race. Start a new race together from the room.'); return; }
      Game.ui.restart();
    };
    $('raceHome').onclick = () => { if (mp() && MP.connected()) MP.leave(); Game.ui.setPaused(false); Game.ui.home(); goCover(); };
    $('raceNotice').querySelector('button').onclick = () => { $('raceNotice').hidden = true; };
    window.addEventListener('ir:device-lost', () => { releaseFlight(); Game.ui.setPaused(true); $('gpuRecovery').hidden = false; });
  }
  function notice(message) { $('raceNotice').querySelector('span').textContent = message; $('raceNotice').hidden = false; }
  function bindRail(id, prev, next, onStep) {
    const rail = $(id);
    $(prev).onclick = () => onStep(-1); $(next).onclick = () => onStep(1);
    rail.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { rail.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    let drag = null;
    rail.addEventListener('pointerdown', e => { drag = { x: e.clientX, s: rail.scrollLeft, moved: false }; });
    rail.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true; rail.scrollLeft = drag.s - dx; });
    rail.addEventListener('pointerup', e => { if (drag && drag.moved) { e.preventDefault(); rail.addEventListener('click', ev => ev.stopPropagation(), { capture: true, once: true }); } drag = null; });
    rail.addEventListener('pointerleave', () => { drag = null; });
  }
  function start() {
    $('btnStart').onclick = () => { A(a => a.init()); goShip(); };   // first user gesture: start the audio context here
    $('btnSettings').onclick = () => { A(a => { a.init(); a.sfx.click(); }); openSettings(); };
    for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => { A(a => a.sfx.click()); back(); };
    $('setQuality').onchange = () => { Game.ui.setQuality($('setQuality').value); updateQualityNote(); Game.ui.invalidate(); };
    bindFlight();
    const look = (id, key, out) => { $(id).oninput = () => { Game.ui.setLook({ [key]: +$(id).value }); Game.ui.invalidate(); $(out).textContent = (+$(id).value).toFixed(2); }; };
    look('setEdge', 'edge', 'setEdgeV'); look('setDither', 'dither', 'setDitherV'); look('setMap', 'colormap', 'setMapV');
    $('setName').onchange = () => { Game.ui.setPlayerName($('setName').value.trim()); };
    $('setMusic').oninput = () => { const v = +$('setMusic').value; $('setMusicV').textContent = v.toFixed(2); A(a => a.setMusic(v)); };
    $('setSfx').oninput = () => { const v = +$('setSfx').value; $('setSfxV').textContent = v.toFixed(2); A(a => { a.setSfx(v); a.sfx.click(); }); };
    $('archPrev').onclick = () => cycleSeed(-1);
    $('archNext').onclick = () => cycleSeed(1);
    $('shipNext').onclick = goPlanet;
    bindRail('shipRail', 'shipPrev', 'shipNextTile', moveShip);
    bindRail('planetRail', 'planetPrev', 'planetNextTile', d => { sel.planet = (sel.planet + d + Planets.PLANETS.length) % Planets.PLANETS.length; goPlanet(); });
    $('seedRoll').onclick = () => { seed = Game.ui.randomSeed(); $('seedField').value = seed; goPlanet(); };
    $('seedField').onchange = () => { seed = $('seedField').value.trim() || seed; goPlanet(); };
    $('planetNext').onclick = () => { seed = $('seedField').value.trim() || seed; goRoom(); };
    $('roomCopy').onclick = () => { navigator.clipboard?.writeText(roomCode); $('roomCopy').textContent = 'Copied'; setTimeout(() => $('roomCopy').textContent = 'Copy code', 1200); };
    $('roomSkip').onclick = () => { if (mp() && MP.connected()) MP.leave(); startRace(); };
    $('roomStart').onclick = startRace;
    $('roomCopy').addEventListener('click', () => A(a => a.sfx.click()));
    $('roomHost').onclick = () => { A(a => a.sfx.click()); doHost(); };
    $('roomJoinOpen').onclick = () => { A(a => a.sfx.click()); $('joinRow').hidden = !$('joinRow').hidden; if (!$('joinRow').hidden) $('joinCode').focus(); };
    $('joinGo').onclick = () => doJoin($('joinCode').value);
    $('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doJoin($('joinCode').value); } });
    $('roomLeave').onclick = () => { MP.leave(); netNote = 'left the room'; netErr = false; renderRoom(); };
    $('roomManual').onclick = () => { const b = $('roomManualBox'); b.hidden = !b.hidden; };
    $('manOffer').onclick = async () => { manualRole = 'host'; $('manOut').value = 'making an invite…'; try { $('manOut').value = await MP.manualHost(); } catch (e) { $('manOut').value = 'failed: ' + e.message; } renderRoom(); };
    $('manJoinMode').onclick = () => { manualRole = 'join'; $('manOut').value = ''; $('manIn').focus(); };
    $('manApply').onclick = async () => {
      const blob = $('manIn').value.trim();
      if (!blob) return;
      try {
        if (manualRole === 'host') { await MP.manualAccept(blob); $('manOut').value = 'connected'; }
        else { $('manOut').value = await MP.manualJoin(blob); }
      } catch (e) { $('manOut').value = 'failed: ' + e.message; }
      renderRoom();
    };
    if (mp()) MP.onChange(() => {
      if (screen === 'room') renderRoom();
      const paused = MP.paused();
      const message = 'Race paused while the host is away. It resumes when they return.';
      if (paused) notice(message);
      else if ($('raceNotice').querySelector('span').textContent === message) $('raceNotice').hidden = true;
      $('raceNotice').querySelector('button').hidden = paused;
      scheduleUi();
    });
    $('resRestart').onclick = () => Game.ui.restart();
    $('resNew').onclick = () => { Game.ui.home(); goShip(); };
    $('resHome').onclick = () => { Game.ui.home(); goCover(); };
    window.addEventListener('keydown', onKey);
    Game.ui.on('finished', showResults);
    Game.ui.on('race', () => { show(null); showLegend(); });

    const q = Game.ui.hashQuery();
    if (Game.ui.state() === 'race') { show(null); showLegend(); }
    else {
      const p = Game.ui.planet(); seed = Game.ui.seed();
      sel.planet = Math.max(0, Planets.PLANETS.indexOf(p)); sel.race = Math.max(0, Planets.RACES.indexOf(Game.ui.race()));
      show('cover');
    }
    if (q.settings) openSettings();
    if (TH()) {
      Thumbs.init(document.getElementById('gl'));
      Thumbs.onReady(fillThumb);
      Thumbs.onPending(scheduleUi);
    }
    Game.ui.on('pause', scheduleUi);
    window.addEventListener('resize', () => Game.ui.invalidate());
    document.addEventListener('visibilitychange', scheduleUi);
    scheduleUi();
  }
  // UI work has its own small budget. Static menus never need an animation loop;
  // a new thumbnail request, screen change or race transition wakes this timer.
  let uiTimer = null;
  const selectorOpen = () => screen === 'ship' || screen === 'planet';
  const boardActive = () => screen === null && Game.ui.state() === 'race' && !Game.ui.paused() && !(mp() && MP.paused());
  function uiWorkPending() {
    return !document.hidden && (boardActive() || (selectorOpen() && TH() && Thumbs.hasPending()));
  }
  function scheduleUi() {
    if (!uiWorkPending()) { clearTimeout(uiTimer); uiTimer = null; return; }
    if (uiTimer !== null) return;
    uiTimer = setTimeout(runUi, 100);
  }
  function runUi() {
    uiTimer = null;
    if (!uiWorkPending()) return;
    if (boardActive()) tickBoard(performance.now());
    if (selectorOpen() && TH() && Thumbs.hasPending()) Thumbs.pump(true);
    scheduleUi();
  }

  return { start, show, showResults, settings, notice };
})();
