// Multiplayer session and netcode. Host authoritative: the host's tab simulates every craft, including remote
// players and bots, and broadcasts snapshots; clients send inputs, predict their own craft and interpolate the rest.
//
// Only the seed, planet and roster travel, so each client generates an identical world from the same numbers.
// Single player is untouched: when no room is open, every entry point here reports inactive and the game runs as before.
const MP = (() => {
  const SNAP_HZ = 20, INPUT_HZ = 30, INTERP_MS = 100, CORR_TAU = 0.14;
  const HDR = 16, CRAFT = 52, INPUT_BYTES = 12;
  const ST = { idle: 0, countdown: 1, racing: 2, finished: 3 };
  const STN = ['idle', 'countdown', 'racing', 'finished'];

  let mode = null;              // 'host' | 'client' | null
  let myPid = null;             // this browser's identity in the room (the host hands one to each client)
  let code = '', roster = null, localSlot = 0, cars = null, started = false;
  let players = [];             // host: authoritative list. client: mirror of the host's list.
  let local = { name: '', raceId: null, archSeed: 1, kitSeed: 1, kit: false, ready: true };
  let world = { planetId: null, seed: null };
  let statusText = 'offline', errorText = '';
  const listeners = [];
  const onChange = () => listeners.forEach(f => { try { f(); } catch (e) {} });

  // host: inputs received per slot. client: history for reconciliation.
  const inputs = new Map();     // slot -> { seq, ctl, at }
  let seq = 0, ackSeq = 0, hist = [];
  let sendAcc = 0, snapAcc = 0, tick = 0;
  let buf = [];                 // client: [{ at, states: Map(slot -> state) }]
  const corr = { x: 0, y: 0, z: 0, h: 0 };
  const stats = { snapBytes: 0, snapCount: 0, corrSum: 0, corrCount: 0, corrMax: 0, lastSnap: 0, dropped: 0, ev: {}, fired: 0 };

  const G = () => (typeof Game !== 'undefined' ? Game : null);
  const ITEMS = (typeof Weapons !== 'undefined' && Weapons.ITEMS) ? Weapons.ITEMS : [];
  const active = () => mode !== null && !!roster;

  // ---------------------------------------------------------------- lobby
  function makeRoster() {
    const out = [];
    players.forEach((p, i) => out.push({ pid: p.pid, name: p.name, raceId: p.raceId, archSeed: p.archSeed, kitSeed: p.kitSeed, kit: p.kit, bot: false, slot: i }));
    const NUM = Planets.MAX_RACERS;
    let b = 0;
    const used = new Set(out.map(o => o.raceId));
    const spare = Planets.RACES.filter(r => !used.has(r.id));
    while (out.length < NUM) {
      const r = spare[b % spare.length] || Planets.RACES[b % Planets.RACES.length];
      out.push({ pid: 'bot' + b, name: null, raceId: r.id, archSeed: 1 + b, kitSeed: 1, kit: false, bot: true, slot: out.length });
      b++;
    }
    return out;
  }
  function selfEntry(pid) {
    return { pid, name: local.name || (G() ? G().ui.playerName() : 'racer'), raceId: local.raceId || Planets.RACES[0].id, archSeed: local.archSeed, kitSeed: local.kitSeed, kit: local.kit, ready: true, ping: 0, dropped: false };
  }
  function broadcastLobby() {
    if (mode !== 'host') return;
    Net.send('all', 'evt', { t: 'lobby', players: players.map(p => ({ pid: p.pid, name: p.name, raceId: p.raceId, kit: p.kit, kitSeed: p.kitSeed, archSeed: p.archSeed, ping: p.ping || 0, dropped: !!p.dropped })), world });
    onChange();
  }

  const handlers = {
    status: s => { statusText = s; onChange(); },
    error: e => { errorText = e.message || String(e); statusText = e.code === 'hostgone' ? 'closed' : 'error'; onChange(); },
    peer: (pid, what) => {
      if (mode === 'host') {
        if (what === 'open') { Net.send(pid, 'evt', { t: 'welcome', code, world, you: pid }); }
        else if (what === 'closed') {
          const p = players.find(x => x.pid === pid);
          if (p) { p.dropped = true; markDropped(p); }
          players = players.filter(x => x.pid !== pid || x.dropped);
          broadcastLobby();
        }
      }
      onChange();
    },
    data: (pid, ch, msg) => { if (ch === 'state') onState(pid, msg); else { stats.ev[msg.t] = (stats.ev[msg.t] || 0) + 1; onEvent(pid, msg); } },
  };

  function markDropped(p) {
    // Keep the race going: a dropped player's craft carries on as a bot.
    if (!cars || !roster) return;
    const e = roster.find(r => r.pid === p.pid);
    if (!e) return;
    const c = cars[e.slot];
    if (c) { c.isBot = true; c.dropped = true; c.name = (c.name || 'racer') + ' (left)'; }
    stats.dropped++;
  }

  function onEvent(pid, m) {
    if (mode === 'host') {
      if (m.t === 'hello') {
        // The authoritative roster is fixed once racing begins. Do not let a
        // late peer fall back to slot zero and impersonate the host's craft.
        if (started) { Net.send(pid, 'evt', { t: 'started' }); return; }
        let p = players.find(x => x.pid === pid);
        if (!p) { p = { pid }; players.push(p); }
        Object.assign(p, { name: m.name, raceId: m.raceId, archSeed: m.archSeed, kitSeed: m.kitSeed, kit: m.kit, ready: true, dropped: false });
        if (players.length > Planets.MAX_RACERS) { players = players.filter(x => x !== p); Net.send(pid, 'evt', { t: 'full' }); return; }
        broadcastLobby();
      } else if (m.t === 'bye') {
        const p = players.find(x => x.pid === pid);
        if (p) { p.dropped = true; markDropped(p); }
        broadcastLobby();
      } else if (m.t === 'pick') {
        const p = players.find(x => x.pid === pid);
        if (p) { Object.assign(p, { raceId: m.raceId, archSeed: m.archSeed, kitSeed: m.kitSeed, kit: m.kit }); broadcastLobby(); }
      }
      return;
    }
    // client
    if (m.t === 'welcome') { myPid = m.you || Net.id(); world = m.world || world; statusText = 'lobby'; sendHello(); onChange(); }
    else if (m.t === 'lobby') { players = m.players; world = m.world || world; onChange(); }
    else if (m.t === 'full') { errorText = 'that room is full'; statusText = 'error'; onChange(); }
    else if (m.t === 'started') { errorText = 'that race is already in progress'; statusText = 'error'; onChange(); }
    else if (m.t === 'start') applyStart(m);
    else if (m.t === 'use') { const c = cars && cars[m.slot]; if (c) { c.item = m.item; c.useItem = true; } }
    else if (m.t === 'fin') { const c = cars && cars[m.slot]; if (c) { c.finished = true; c.finishTime = m.time; } }
    else if (m.t === 'bye') { statusText = 'closed'; errorText = 'the host ended the room'; onChange(); }
  }
  function sendHello() {
    Net.send(Net.hostId(), 'evt', { t: 'hello', name: local.name || (G() ? G().ui.playerName() : 'racer'), raceId: local.raceId, archSeed: local.archSeed, kitSeed: local.kitSeed, kit: local.kit });
  }

  // ---------------------------------------------------------------- start
  function sendStart(to) {
    Net.send(to || 'all', 'evt', { t: 'start', planetId: world.planetId, seed: world.seed, roster, at: Date.now() });
  }
  function startRace(planetId, seed) {
    if (mode !== 'host') return;
    world = { planetId, seed };
    for (const p of players) if (p.pid === myPid) Object.assign(p, selfEntry(myPid));
    roster = makeRoster();
    localSlot = roster.findIndex(r => r.pid === myPid);
    if (localSlot < 0) localSlot = 0;
    started = true;
    sendStart();
    onChange();
    G().ui.select({ planetId, seed, mode: 'race' });
  }
  function applyStart(m) {
    roster = m.roster; world = { planetId: m.planetId, seed: m.seed };
    localSlot = roster.findIndex(r => r.pid === myPid);
    if (localSlot < 0) localSlot = 0;
    started = true; buf = []; hist = []; seq = 0; ackSeq = 0;
    statusText = 'racing';
    onChange();
    G().ui.select({ planetId: m.planetId, seed: m.seed, mode: 'race' });
  }

  // ---------------------------------------------------------------- snapshots
  function encodeSnapshot() {
    const n = cars.length;
    const ab = new ArrayBuffer(HDR + CRAFT * n + 2 * n);
    const d = new DataView(ab);
    const rs = G().mp.race();
    d.setUint32(0, ++tick, true);
    d.setFloat32(4, rs.elapsed, true);
    d.setFloat32(8, rs.timer, true);
    d.setUint8(12, ST[rs.state] === undefined ? 0 : ST[rs.state]);
    d.setUint8(13, n);
    d.setUint8(14, 0); d.setUint8(15, 0);
    let o = HDR;
    for (let i = 0; i < n; i++) {
      const c = cars[i];
      d.setUint8(o, c.id);
      d.setUint8(o + 1, Math.min(255, c.lap));
      d.setUint8(o + 2, Math.max(0, Math.min(255, Math.round(255 * c.life / Math.max(1, c.lifeMax)))));
      d.setUint8(o + 3, (c.wrecked > 0 ? 1 : 0) | (c.shield > 0 ? 2 : 0) | (c.drifting ? 4 : 0) | (c.boost > 0 ? 8 : 0) | (c.finished ? 16 : 0) | (c.dropped ? 32 : 0));
      d.setFloat32(o + 4, c.x, true); d.setFloat32(o + 8, c.y, true); d.setFloat32(o + 12, c.z, true);
      d.setFloat32(o + 16, c.heading, true); d.setFloat32(o + 20, c.pitch, true);
      d.setFloat32(o + 24, c.vx, true); d.setFloat32(o + 28, c.vy, true); d.setFloat32(o + 32, c.vz, true);
      d.setFloat32(o + 36, c.t, true);
      d.setFloat32(o + 40, c.steer, true);
      d.setFloat32(o + 44, c.glow, true);
      d.setUint8(o + 48, c.item ? ITEMS.indexOf(c.item) + 1 : 0);   // 0 = empty slot
      d.setUint8(o + 49, 0); d.setUint8(o + 50, 0); d.setUint8(o + 51, 0);
      o += CRAFT;
    }
    for (let i = 0; i < n; i++) { const inp = inputs.get(i); d.setUint16(o, inp ? inp.seq & 0xffff : 0, true); o += 2; }
    return ab;
  }
  function decodeSnapshot(ab) {
    const d = new DataView(ab);
    const n = d.getUint8(13);
    const snap = { tick: d.getUint32(0, true), elapsed: d.getFloat32(4, true), timer: d.getFloat32(8, true), state: STN[d.getUint8(12)] || 'racing', states: new Map(), ack: 0 };
    let o = HDR;
    for (let i = 0; i < n; i++) {
      const f = d.getUint8(o + 3);
      snap.states.set(d.getUint8(o), {
        lap: d.getUint8(o + 1), life: d.getUint8(o + 2) / 255,
        wrecked: !!(f & 1), shield: !!(f & 2), drifting: !!(f & 4), boost: !!(f & 8), finished: !!(f & 16), dropped: !!(f & 32),
        x: d.getFloat32(o + 4, true), y: d.getFloat32(o + 8, true), z: d.getFloat32(o + 12, true),
        heading: d.getFloat32(o + 16, true), pitch: d.getFloat32(o + 20, true),
        vx: d.getFloat32(o + 24, true), vy: d.getFloat32(o + 28, true), vz: d.getFloat32(o + 32, true),
        t: d.getFloat32(o + 36, true), steer: d.getFloat32(o + 40, true), glow: d.getFloat32(o + 44, true),
        item: ITEMS[d.getUint8(o + 48) - 1] || null,
      });
      o += CRAFT;
    }
    snap.ack = o + localSlot * 2 + 2 <= ab.byteLength ? d.getUint16(o + localSlot * 2, true) : 0;
    return snap;
  }
  function encodeInput(ctl) {
    const ab = new ArrayBuffer(INPUT_BYTES), d = new DataView(ab);
    d.setUint16(0, ++seq & 0xffff, true);
    d.setUint8(2, (ctl.throttle ? 1 : 0) | (ctl.brake ? 2 : 0) | (ctl.drift ? 4 : 0) | (ctl.jump ? 8 : 0) | (ctl.useItem ? 16 : 0));
    d.setInt8(3, Math.max(-127, Math.min(127, Math.round(ctl.steer * 127))));
    d.setInt8(4, Math.max(-127, Math.min(127, Math.round((ctl.pitch || 0) * 127))));
    d.setUint8(5, localSlot);
    d.setFloat32(8, performance.now(), true);
    return ab;
  }
  function decodeInput(ab) {
    const d = new DataView(ab), b = d.getUint8(2);
    return {
      seq: d.getUint16(0, true), slot: d.getUint8(5),
      ctl: { steer: d.getInt8(3) / 127, pitch: d.getInt8(4) / 127, throttle: b & 1 ? 1 : 0, brake: b & 2 ? 1 : 0, drift: !!(b & 4), jump: !!(b & 8), useItem: !!(b & 16) },
    };
  }
  function onState(pid, ab) {
    if (!started) return;
    if (mode === 'host') {
      const m = decodeInput(ab);
      const e = roster && roster.find(r => r.pid === pid);
      if (!e) return;
      const prev = inputs.get(e.slot);
      if (prev && ((m.seq - prev.seq) & 0xffff) > 0x8000) return;   // stale packet, unreliable channel
      inputs.set(e.slot, { seq: m.seq, ctl: m.ctl, at: performance.now() });
    } else {
      const snap = decodeSnapshot(ab);
      stats.snapBytes = ab.byteLength; stats.snapCount++; stats.lastSnap = performance.now();
      buf.push({ at: performance.now(), snap });
      if (buf.length > 30) buf.shift();
      ackSeq = snap.ack;
      reconcile(snap);
    }
  }

  // ---------------------------------------------------------------- client prediction
  function reconcile(snap) {
    if (!cars) return;
    const c = cars[localSlot], s = snap.states.get(localSlot);
    if (!c || !s) return;
    const cur = { x: c.x, y: c.y, z: c.z, heading: c.heading, pitch: c.pitch, vx: c.vx, vy: c.vy, vz: c.vz, t: c.t };
    // Race bookkeeping is never predicted: laps, damage and wrecks come straight from the host.
    c.lap = s.lap; c.finished = s.finished; c.life = s.life * c.lifeMax; c.dmg = 1 - s.life; c.item = s.item;
    c.shield = s.shield ? Math.max(c.shield, 0.1) : 0;
    if (s.wrecked && c.wrecked <= 0) c.wrecked = 1.2; if (!s.wrecked && c.wrecked > 0) c.wrecked = 0;
    // Authoritative state, then replay the inputs the host has not seen yet.
    c.x = s.x; c.y = s.y; c.z = s.z; c.heading = s.heading; c.pitch = s.pitch;
    c.vx = s.vx; c.vy = s.vy; c.vz = s.vz; c.t = s.t;
    hist = hist.filter(h => ((h.seq - snap.ack) & 0xffff) < 0x8000 && h.seq !== snap.ack);
    for (const h of hist) G().mp.step(c, h.ctl, h.dt);
    const want = { x: c.x, y: c.y, z: c.z, heading: c.heading };
    const dx = want.x - cur.x, dy = want.y - cur.y, dz = want.z - cur.z;
    const err = Math.hypot(dx, dy, dz);
    stats.corrSum += err; stats.corrCount++; stats.corrMax = Math.max(stats.corrMax, err);
    if (err > 30) return;                       // wreck, respawn or a long stall: take the authoritative state as is
    // Otherwise keep flying from where we were and fold the difference in over a few frames.
    c.x = cur.x; c.y = cur.y; c.z = cur.z; c.heading = cur.heading;
    let dh = want.heading - cur.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    corr.x += dx; corr.y += dy; corr.z += dz; corr.h += dh;
  }
  function applyCorrection(dt) {
    const c = cars && cars[localSlot];
    if (!c) return;
    const k = 1 - Math.exp(-dt / CORR_TAU);
    c.x += corr.x * k; c.y += corr.y * k; c.z += corr.z * k; c.heading += corr.h * k;
    corr.x -= corr.x * k; corr.y -= corr.y * k; corr.z -= corr.z * k; corr.h -= corr.h * k;
  }
  // Remote craft: play back the snapshot stream ~100 ms in the past and lerp between the two frames around it.
  function interpolate(c) {
    if (buf.length < 2) return;
    const want = performance.now() - INTERP_MS;
    let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length - 1; i++) if (buf[i].at <= want && buf[i + 1].at >= want) { a = buf[i]; b = buf[i + 1]; break; }
    const sa = a.snap.states.get(c.id), sb = b.snap.states.get(c.id);
    if (!sa || !sb) return;
    const span = Math.max(1, b.at - a.at), u = Math.max(0, Math.min(1, (want - a.at) / span));
    const L = (p, q) => p + (q - p) * u;
    let dh = sb.heading - sa.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    c.x = L(sa.x, sb.x); c.y = L(sa.y, sb.y); c.z = L(sa.z, sb.z);
    c.heading = sa.heading + dh * u; c.pitch = L(sa.pitch, sb.pitch); c.steer = L(sa.steer, sb.steer);
    c.vx = L(sa.vx, sb.vx); c.vy = L(sa.vy, sb.vy); c.vz = L(sa.vz, sb.vz);
    c.t = Math.abs(sb.t - sa.t) > 0.5 ? sb.t : L(sa.t, sb.t);       // don't lerp across the lap wrap
    c.speed = Math.hypot(c.vx, c.vy, c.vz);
    c.lap = sb.lap; c.glow = L(sa.glow, sb.glow); c.drifting = sb.drifting;
    c.life = sb.life * c.lifeMax; c.dmg = 1 - sb.life; c.shield = sb.shield ? 1 : 0;
    c.wrecked = sb.wrecked ? 1 : 0; c.finished = sb.finished; c.dropped = sb.dropped; c.item = sb.item;
    c.prog = c.lap + c.t;
    c.sample = World.sampleAt(G().mp.tab(), c.t);
  }

  // ---------------------------------------------------------------- hooks called by game.js
  function assignCars(list) {
    cars = list;
    if (!active()) return;
    for (const c of cars) {
      const e = roster[c.id];
      if (!e) continue;
      c.isBot = e.bot;
      c.isPlayer = c.id === localSlot;
      c.remote = !e.bot && c.id !== localSlot;
      if (e.name) c.name = e.name + (e.dropped ? ' (left)' : '');
      if (mode === 'client' && !c.isPlayer) c.isBot = false;   // clients never drive anyone else
    }
    corr.x = corr.y = corr.z = corr.h = 0;
    hist = []; buf = [];
  }
  function skip(c) { return mode === 'client' && active() && c.id !== localSlot; }
  function control(c) {
    if (!active() || mode !== 'host') return null;
    const e = roster[c.id];
    if (!e || e.bot) return null;
    if (c.id === localSlot) return null;                        // the host drives its own craft from the keyboard
    const inp = inputs.get(c.id);
    if (!inp) return { steer: 0, throttle: 0, brake: 0, drift: false, pitch: 0, jump: false };
    if (inp.ctl.useItem) { c.useItem = true; inp.ctl = { ...inp.ctl, useItem: false }; }
    return inp.ctl;
  }
  function syncRace(rs) {
    if (mode !== 'client' || !buf.length) return;
    const s = buf[buf.length - 1].snap;
    rs.elapsed = s.elapsed; rs.timer = s.timer;
    if (rs.state !== s.state && s.state !== 'idle') rs.state = s.state;
  }
  function beforeUpdate(dt) {
    if (!active()) return;
    if (mode === 'client') { applyCorrection(dt); }
  }
  function afterUpdate(dt, ctl) {
    if (!active()) return;
    if (mode === 'host') {
      snapAcc += dt;
      if (snapAcc >= 1 / SNAP_HZ) { snapAcc = 0; if (Net.peerIds().length) Net.send('all', 'state', encodeSnapshot()); }
    } else {
      sendAcc += dt;
      if (sendAcc >= 1 / INPUT_HZ) {
        const c = cars[localSlot];
        const payload = { ...ctl, useItem: !!(c && c.mpUsed) };
        if (c) c.mpUsed = false;
        hist.push({ seq: seq + 1, ctl: payload, dt: sendAcc });
        if (hist.length > 120) hist.shift();
        Net.send(Net.hostId(), 'state', encodeInput(payload));
        sendAcc = 0;
      }
    }
  }
  // Host tells clients when a craft fires, so they can spawn the same visual locally.
  function fired(slot, item) { if (mode === 'host' && active()) { stats.fired++; Net.send('all', 'evt', { t: 'use', slot, item }); } }
  // Finish times are the host's to give: clients cannot time a lap they did not simulate.
  function finished(slot, time) { if (mode === 'host' && active()) Net.send('all', 'evt', { t: 'fin', slot, time }); }

  // ---------------------------------------------------------------- public
  async function hostRoom(roomCode) {
    code = roomCode; mode = 'host'; errorText = ''; started = false;
    players = [selfEntry('me')];
    await Net.host(roomCode, handlers);
    myPid = Net.id(); players[0].pid = myPid;
    statusText = 'hosting'; onChange();
    return roomCode;
  }
  async function joinRoom(roomCode) {
    code = roomCode; mode = 'client'; errorText = ''; started = false; players = [];
    await Net.join(roomCode, handlers);
    statusText = 'connecting'; onChange();
    return roomCode;
  }
  // Manual path: no broker, two people paste blobs at each other. Same session logic once a channel is open.
  async function manualHost() {
    code = 'DIRECT'; mode = 'host'; errorText = ''; started = false;
    myPid = 'host'; players = [selfEntry(myPid)];
    const blob = await Net.manualHostOffer(handlers);
    statusText = 'manual'; onChange();
    return blob;
  }
  async function manualAccept(blob) { await Net.manualHostAccept(blob); statusText = 'connected'; onChange(); }
  async function manualJoin(blob) {
    code = 'DIRECT'; mode = 'client'; errorText = ''; started = false; players = [];
    const ans = await Net.manualJoin(blob, handlers);
    statusText = 'connected'; onChange();
    return ans;
  }
  function leave() {
    if (mode === 'host') Net.send('all', 'evt', { t: 'bye' });
    try { Net.close(); } catch (e) {}
    mode = null; roster = null; started = false; players = []; buf = []; hist = []; cars = null; myPid = null;
    statusText = 'offline'; errorText = '';
    onChange();
  }
  function setLocal(o) {
    Object.assign(local, o);
    if (mode === 'host') { const p = players.find(x => x.pid === myPid) || players[0]; if (p) Object.assign(p, o); broadcastLobby(); }
    else if (mode === 'client' && Net.hostId()) Net.send(Net.hostId(), 'evt', { t: 'pick', raceId: local.raceId, archSeed: local.archSeed, kitSeed: local.kitSeed, kit: local.kit });
  }

  if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { try { if (mode) Net.send('all', 'evt', { t: 'bye' }); } catch (e) {} });

  return {
    // lobby / flow
    hostRoom, joinRoom, leave, setLocal, startRace, manualHost, manualAccept, manualJoin, onChange: f => listeners.push(f),
    players: () => players.map(p => ({ ...p, ping: mode === 'host' ? Net.ping(p.pid) : p.ping, me: p.pid === myPid })),
    status: () => statusText, error: () => errorText, code: () => code, isHost: () => mode === 'host', isClient: () => mode === 'client',
    connected: () => mode !== null, started: () => started, world: () => world,
    // game hooks
    active, roster: () => (active() ? roster : null), localSlot: () => localSlot,
    assignCars, skip, control, interpolate, syncRace, beforeUpdate, afterUpdate, fired, finished,
    useItem: () => { const c = cars && cars[localSlot]; if (c) c.mpUsed = true; },
    stats: () => ({
      ...Net.stats(), snapBytes: stats.snapBytes, snapHz: SNAP_HZ, inputHz: INPUT_HZ,
      corrAvg: stats.corrCount ? +(stats.corrSum / stats.corrCount).toFixed(3) : 0, corrMax: +stats.corrMax.toFixed(2), ev: stats.ev, fired: stats.fired,
      snaps: stats.snapCount, dropped: stats.dropped, slot: localSlot, mode,
    }),
  };
})();
