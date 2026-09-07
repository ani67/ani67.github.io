// Transport: room-code peer connections over WebRTC, with a public PeerJS broker used only for signalling.
// No library: this speaks the broker's WebSocket protocol directly and drives RTCPeerConnection itself.
//
// Topology is a star. The host owns the room code and keeps one connection per client; clients only talk to the host.
// Two data channels per peer: `state` is unreliable and unordered (snapshots and inputs, where the newest wins and a
// dropped packet is better than a late one), `evt` is reliable and ordered (lobby, race events, chat, ping).
//
// If the broker cannot be reached, `manual*` produces a paste-able blob so two people can connect by copying text.
const Net = (() => {
  const DEFAULTS = {
    broker: 'wss://0.peerjs.com/peerjs',
    key: 'peerjs',
    version: '1.5.4',
    prefix: 'ipr-',
    ice: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }],
  };
  const cfg = { ...DEFAULTS };
  try { const s = JSON.parse(localStorage.getItem('ir.net') || '{}'); Object.assign(cfg, s); } catch (e) {}

  let role = null;          // 'host' | 'client' | null
  let ws = null, myId = null, hostId = null, heartbeat = null;
  let handlers = {};
  const peers = new Map();  // peerId -> { pc, state, evt, ping, lastPong, open, name }
  const counters = { sent: 0, recv: 0, bytesSent: 0, bytesRecv: 0, since: 0 };

  const rand = n => { let s = ''; const a = 'abcdefghijklmnopqrstuvwxyz0123456789'; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
  const idFor = code => cfg.prefix + String(code).toUpperCase();
  const H = (name, ...a) => { try { if (handlers[name]) handlers[name](...a); } catch (e) { console.error('net handler ' + name, e); } };
  const status = (s, detail) => H('status', s, detail);

  // ---------------------------------------------------------------- signalling socket
  function openSocket(id) {
    return new Promise((resolve, reject) => {
      const token = rand(10);
      const url = `${cfg.broker}?key=${encodeURIComponent(cfg.key)}&id=${encodeURIComponent(id)}&token=${token}&version=${cfg.version}`;
      let settled = false;
      let sock;
      try { sock = new WebSocket(url); } catch (e) { reject(Object.assign(new Error('broker unreachable'), { code: 'broker' })); return; }
      const fail = (code, msg) => { if (settled) return; settled = true; try { sock.close(); } catch (e) {} reject(Object.assign(new Error(msg), { code })); };
      const timer = setTimeout(() => fail('broker', 'broker timed out'), 9000);
      sock.onopen = () => status('signalling');
      sock.onerror = () => fail('broker', 'broker unreachable');
      sock.onclose = () => { if (!settled) fail('broker', 'broker closed the connection'); else if (ws === sock) { ws = null; status('signalling-lost'); } };
      sock.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.type === 'OPEN') {
          if (settled) return;
          settled = true; clearTimeout(timer); ws = sock; myId = id;
          clearInterval(heartbeat);
          heartbeat = setInterval(() => { try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: 'HEARTBEAT' })); } catch (e) {} }, 5000);
          sock.onmessage = onSignal;
          resolve(id);
        } else if (m.type === 'ID-TAKEN') { clearTimeout(timer); fail('taken', 'that room code is already in use'); }
        else if (m.type === 'ERROR') { clearTimeout(timer); fail('broker', (m.payload && m.payload.msg) || 'broker error'); }
      };
    });
  }
  // The public broker validates the payload against its own connection shape and hangs up on anything else,
  // so signalling messages are dressed as PeerJS data-connection traffic even though only the sdp matters here.
  function connId(dst) { return 'ir_' + String(myId || 'x').slice(-8) + '_' + String(dst).slice(-8); }
  function signal(dst, type, payload) {
    if (!ws || ws.readyState !== 1) return false;
    const base = { type: 'data', connectionId: connId(dst), browser: 'chrome', label: 'ir', reliable: true, serialization: 'binary', metadata: null };
    ws.send(JSON.stringify({ type, dst, payload: { ...base, ...payload } }));
    return true;
  }
  const sdpOf = p => (p && p.sdp && typeof p.sdp === 'object') ? p.sdp.sdp : (p ? p.sdp : '');
  async function onSignal(ev) {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    const src = m.src;
    if (m.type === 'OFFER' && role === 'host') {
      const p = ensurePeer(src, false);
      await p.pc.setRemoteDescription({ type: 'offer', sdp: sdpOf(m.payload) });
      const answer = await p.pc.createAnswer();
      await p.pc.setLocalDescription(answer);
      signal(src, 'ANSWER', { sdp: { type: 'answer', sdp: answer.sdp } });
      for (const c of p.pending) { try { await p.pc.addIceCandidate(c); } catch (e) {} }
      p.pending.length = 0;
    } else if (m.type === 'ANSWER') {
      const p = peers.get(src);
      if (!p) return;
      await p.pc.setRemoteDescription({ type: 'answer', sdp: sdpOf(m.payload) });
      for (const c of p.pending) { try { await p.pc.addIceCandidate(c); } catch (e) {} }
      p.pending.length = 0;
    } else if (m.type === 'CANDIDATE') {
      const p = peers.get(src);
      if (!p || !m.payload.candidate) return;
      if (p.pc.remoteDescription && p.pc.remoteDescription.type) { try { await p.pc.addIceCandidate(m.payload.candidate); } catch (e) {} }
      else p.pending.push(m.payload.candidate);
    } else if (m.type === 'EXPIRE') {
      H('error', Object.assign(new Error('no room with that code'), { code: 'nohost' }));
    }
  }

  // ---------------------------------------------------------------- peer connections
  function ensurePeer(peerId, initiator) {
    let p = peers.get(peerId);
    if (p) return p;
    const pc = new RTCPeerConnection({ iceServers: cfg.ice });
    p = { id: peerId, pc, state: null, evt: null, pending: [], open: false, ping: 0, lastPong: 0, initiator };
    peers.set(peerId, p);
    pc.onicecandidate = e => { if (e.candidate) signal(peerId, 'CANDIDATE', { candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'failed' || s === 'closed' || s === 'disconnected') dropPeer(peerId, s);
    };
    if (initiator) {
      p.state = wireChannel(p, pc.createDataChannel('state', { ordered: false, maxRetransmits: 0 }), 'state');
      p.evt = wireChannel(p, pc.createDataChannel('evt', { ordered: true }), 'evt');
    } else {
      pc.ondatachannel = e => { p[e.channel.label] = wireChannel(p, e.channel, e.channel.label); };
    }
    return p;
  }
  function wireChannel(p, ch, label) {
    ch.binaryType = 'arraybuffer';
    ch.onopen = () => {
      if (p.state && p.state.readyState === 'open' && p.evt && p.evt.readyState === 'open' && !p.open) {
        p.open = true; status('connected'); H('peer', p.id, 'open');
        if (role === 'client') pingLoop();
      }
    };
    ch.onclose = () => dropPeer(p.id, 'channel closed');
    ch.onmessage = e => {
      counters.recv++; counters.bytesRecv += (e.data.byteLength || e.data.length || 0);
      if (label === 'evt') {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'ping') { try { p.evt.send(JSON.stringify({ t: 'pong', ts: m.ts })); } catch (err) {} return; }
        if (m.t === 'pong') { p.ping = Math.round(performance.now() - m.ts); p.lastPong = performance.now(); return; }
        H('data', p.id, 'evt', m);
      } else H('data', p.id, 'state', e.data);
    };
    return ch;
  }
  function dropPeer(peerId, why) {
    const p = peers.get(peerId);
    if (!p) return;
    peers.delete(peerId);
    try { p.pc.close(); } catch (e) {}
    H('peer', peerId, 'closed', why);
    if (role === 'client' && peerId === hostId) { status('lost'); H('error', Object.assign(new Error('the host left, room closed'), { code: 'hostgone' })); }
  }
  let pinger = null;
  function pingLoop() {
    clearInterval(pinger);
    pinger = setInterval(() => {
      for (const p of peers.values()) { if (p.evt && p.evt.readyState === 'open') { try { p.evt.send(JSON.stringify({ t: 'ping', ts: performance.now() })); } catch (e) {} } }
    }, 2000);
  }

  // ---------------------------------------------------------------- public API
  async function host(code, hs) {
    close();
    handlers = hs || {}; role = 'host'; counters.since = performance.now();
    status('signalling');
    await openSocket(idFor(code));
    pingLoop();
    status('hosting');
    H('open', myId);
    return myId;
  }
  async function join(code, hs) {
    close();
    handlers = hs || {}; role = 'client'; counters.since = performance.now();
    status('signalling');
    hostId = idFor(code);
    await openSocket(idFor(code) + '-' + rand(6));
    const p = ensurePeer(hostId, true);
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    signal(hostId, 'OFFER', { sdp: { type: 'offer', sdp: offer.sdp } });
    status('connecting');
    H('open', myId);
    return myId;
  }
  function send(to, channel, data) {
    const one = p => {
      const ch = channel === 'state' ? p.state : p.evt;
      if (!ch || ch.readyState !== 'open') return;
      const payload = channel === 'evt' ? JSON.stringify(data) : data;
      try { ch.send(payload); counters.sent++; counters.bytesSent += (payload.byteLength || payload.length || 0); } catch (e) {}
    };
    if (to === 'all') { for (const p of peers.values()) one(p); return; }
    const p = peers.get(to); if (p) one(p);
  }
  function close() {
    clearInterval(heartbeat); clearInterval(pinger);
    for (const id of [...peers.keys()]) { const p = peers.get(id); peers.delete(id); try { p.pc.close(); } catch (e) {} }
    if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    role = null; myId = null; hostId = null; handlers = {};
  }
  function stats() {
    const secs = Math.max(0.001, (performance.now() - counters.since) / 1000);
    return {
      role, id: myId, peers: [...peers.values()].map(p => ({ id: p.id, open: p.open, ping: p.ping, state: p.pc.connectionState })),
      sent: counters.sent, recv: counters.recv, upBps: Math.round(counters.bytesSent / secs), downBps: Math.round(counters.bytesRecv / secs),
      bytesSent: counters.bytesSent, bytesRecv: counters.bytesRecv,
    };
  }

  // ---------------------------------------------------------------- manual fallback (no broker)
  // Non-trickle: wait for ICE gathering so one blob carries everything.
  function gathered(pc) {
    return new Promise(res => {
      if (pc.iceGatheringState === 'complete') return res();
      const t = setTimeout(res, 4000);
      pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } };
    });
  }
  const packBlob = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const readBlob = s => JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
  async function manualHostOffer(hs) {
    close(); handlers = hs || {}; role = 'host'; counters.since = performance.now();
    const p = ensurePeer('manual', true);
    p.pc.onicecandidate = null;
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    await gathered(p.pc);
    status('manual');
    return packBlob({ k: 'offer', sdp: p.pc.localDescription.sdp });
  }
  async function manualHostAccept(blob) {
    const m = readBlob(blob); const p = peers.get('manual');
    if (!p || m.k !== 'answer') throw new Error('that is not an answer code');
    await p.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
    pingLoop();
  }
  async function manualJoin(blob, hs) {
    close(); handlers = hs || {}; role = 'client'; hostId = 'manual'; counters.since = performance.now();
    const m = readBlob(blob);
    if (m.k !== 'offer') throw new Error('that is not a room code');
    const p = ensurePeer('manual', false);
    p.pc.onicecandidate = null;
    await p.pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
    const answer = await p.pc.createAnswer();
    await p.pc.setLocalDescription(answer);
    await gathered(p.pc);
    pingLoop();
    status('manual');
    return packBlob({ k: 'answer', sdp: p.pc.localDescription.sdp });
  }

  return {
    host, join, send, close, stats, manualHostOffer, manualHostAccept, manualJoin,
    role: () => role, id: () => myId, hostId: () => hostId, peerIds: () => [...peers.keys()],
    ping: peerId => (peers.get(peerId) || {}).ping || 0,
    config: o => Object.assign(cfg, o || {}),
    available: () => typeof RTCPeerConnection !== 'undefined' && typeof WebSocket !== 'undefined',
  };
})();
