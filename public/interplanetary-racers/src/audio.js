// Audio: seeded generative music plus fully synthesised SFX. No files, no network — everything is Web Audio.
// Public API: init(), setMusic(v), setSfx(v), mute(b), planet(desc), race(state), and the sfx.* calls.
const Audio = (() => {
  let ac = null, ready = false, started = false;
  let master, musicBus, sfxBus, duckGain, verbIn, verbOut, delayIn;
  let vol = { music: 0.6, sfx: 0.75, muted: false };
  try { Object.assign(vol, JSON.parse(localStorage.getItem('ir.audio') || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem('ir.audio', JSON.stringify(vol)); } catch (e) {} };

  const dbg = { events: {}, voices: 0, notes: 0, sfx: 0, sections: [] };
  const bump = k => { dbg.events[k] = (dbg.events[k] || 0) + 1; };

  // ---------------------------------------------------------------- helpers
  const now = () => ac.currentTime;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  function rnd32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashStr(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function noiseBuffer(sec, decayPow) {
    const n = Math.max(1, Math.floor(ac.sampleRate * sec)), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * (decayPow ? Math.pow(1 - t, decayPow) : 1); }
    return b;
  }
  let NOISE_LOOP = null;
  function noise(dur, decayPow) { const s = ac.createBufferSource(); s.buffer = noiseBuffer(dur, decayPow); return s; }
  function loopNoise() { const s = ac.createBufferSource(); s.buffer = NOISE_LOOP; s.loop = true; return s; }

  // Small reverb: generated noise impulse, dark tail.
  function impulse(sec, decay, dark) {
    const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n, env = Math.pow(1 - t, decay);
        lp += ((Math.random() * 2 - 1) - lp) * dark;
        d[i] = lp * env;
      }
    }
    return b;
  }

  // ---------------------------------------------------------------- graph
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { return false; }
    NOISE_LOOP = noiseBuffer(2, 0);

    master = ac.createGain(); master.gain.value = vol.muted ? 0 : 1; master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.22;
    comp.connect(master);

    duckGain = ac.createGain(); duckGain.gain.value = 1;      // music ducks under big SFX
    musicBus = ac.createGain(); musicBus.gain.value = vol.music;
    sfxBus = ac.createGain(); sfxBus.gain.value = vol.sfx;
    musicBus.connect(duckGain); duckGain.connect(comp); sfxBus.connect(comp);

    // Shared reverb and feedback delay, fed by music and by a few SFX.
    const conv = ac.createConvolver(); conv.buffer = impulse(3.2, 3.2, 0.34);
    verbIn = ac.createGain(); verbIn.gain.value = 0.5;
    verbOut = ac.createGain(); verbOut.gain.value = 0.9;
    verbIn.connect(conv); conv.connect(verbOut); verbOut.connect(duckGain);

    const dl = ac.createDelay(1.5), fb = ac.createGain(), dfilt = ac.createBiquadFilter();
    dl.delayTime.value = 0.42; fb.gain.value = 0.42; dfilt.type = 'lowpass'; dfilt.frequency.value = 2200;
    delayIn = ac.createGain(); delayIn.gain.value = 0.4;
    delayIn.connect(dl); dl.connect(dfilt); dfilt.connect(fb); fb.connect(dl); dfilt.connect(duckGain); dfilt.connect(verbIn);
    music.delay = dl;
    buildLayers();   // one gain node per musical layer, so layers fade as a whole

    document.addEventListener('visibilitychange', () => {
      if (!ac) return;
      if (document.hidden) { try { ac.suspend(); } catch (e) {} }
      else if (!vol.muted) { try { ac.resume(); } catch (e) {} }
    });
    ready = true;
    if (music.pending) { applyPlanet(music.pending); music.pending = null; }
    if (music.pendingState) { raceState(music.pendingState); music.pendingState = null; }
    if (!started) { started = true; schedule(); }
    return true;
  }
  const alive = () => ready && ac && ac.state !== 'closed';

  // Duck the music briefly under an explosion or similar.
  function duck(amount, dur) {
    if (!alive()) return;
    const g = duckGain.gain, t = now();
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1 - amount, t + 0.04);
    g.linearRampToValueAtTime(1, t + 0.04 + dur);
  }

  // ---------------------------------------------------------------- music
  // Structured generative score. The race's progress (lap + t) / laps drives a section form;
  // each section switches a set of independent layers on or off, and a seed-derived motif is
  // restated across sections transposed, inverted or augmented so the whole race reads as one piece.
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10], penta: [0, 3, 5, 7, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  };
  // Section form. `order` is the timeline index used by tests; `layers` are target gains 0..1.
  // `sub` is the pluck subdivision (2 = eighths, 1 = sixteenths), `lead` the motif variation,
  // `oct` the lead octave, `key` a scale-degree shift applied to the whole harmony.
  const SECTIONS = {
    grid:    { order: 0, layers: { drone: 0.95, tex: 0.45 },                                              sub: 4, lead: null,          oct: 0,  key: 0, perc: 'none',   fade: 2 },
    intro:   { order: 1, layers: { drone: 0.45, pad: 0.85, sub: 0.75, tex: 0.2 },                         sub: 4, lead: null,          oct: 0,  key: 0, perc: 'pulse',  fade: 2 },
    build:   { order: 2, layers: { drone: 0.2, pad: 0.9, sub: 0.9, pluck: 0.7, perc: 0.5, tex: 0.18 },    sub: 2, lead: null,          oct: 0,  key: 0, perc: 'half',   fade: 2 },
    develop: { order: 3, layers: { pad: 0.8, sub: 0.95, pluck: 0.8, lead: 0.7, perc: 0.7, tex: 0.28 },    sub: 2, lead: 'prime',       oct: 0,  key: 3, perc: 'four',   fade: 2 },
    drive:   { order: 4, layers: { pad: 0.7, sub: 1, pluck: 0.75, lead: 0.9, perc: 0.9, tex: 0.32 },      sub: 1, lead: 'transposeUp', oct: 12, key: 0, perc: 'busy',   fade: 1 },
    climax:  { order: 5, layers: { drone: 0.3, pad: 0.85, sub: 1, pluck: 0.9, lead: 1, perc: 1, tex: 0.5 }, sub: 1, lead: 'augmented', oct: 12, key: 4, perc: 'double', fade: 1 },
    finish:  { order: 6, layers: { drone: 0.8, pad: 0.95, sub: 0.5, tex: 0.4 },                           sub: 4, lead: 'retrograde',  oct: 0,  key: 0, perc: 'none',   fade: 2 },
  };
  const LAYER_NAMES = ['drone', 'pad', 'sub', 'pluck', 'lead', 'perc', 'tex'];
  // Per-layer reverb and delay sends, set once when the buses are built.
  const LAYER_SENDS = { drone: [0.6, 0], pad: [0.45, 0.12], sub: [0.04, 0], pluck: [0.3, 0.5], lead: [0.35, 0.45], perc: [0.22, 0.1], tex: [0.65, 0.2] };

  const music = {
    on: false, intensity: 0, target: 0, bpm: 84, root: 45, scale: SCALES.minor, scaleName: 'minor',
    wave: 'sawtooth', cutoff: 900, arpDens: 0.5, pending: null, pendingState: null, nextT: 0, step: 0, chordI: 0,
    prog: [0, 5, 3, 4], rng: rnd32(1), euclid: [], delay: null, seedName: '',
    section: 'grid', pendingSection: 'grid', sectionBar: 0, bar: 0, keyShift: 0,
    motif: [0, 2, 4, 2], motifName: 'prime', layers: {}, voices: 0, state: 'menu',
    p01: 0, lap: 0, laps: 3, lastLap: false, rank01: 0, lowHull: 0, boosting: 0, drifting: 0, hurt: 0,
    poll: 0, tempoMul: 1,
  };
  function euclidean(k, n) { // Bjorklund-ish: even spread of k pulses over n steps
    const out = []; let bucket = 0;
    for (let i = 0; i < n; i++) { bucket += k; if (bucket >= n) { bucket -= n; out.push(1); } else out.push(0); }
    return out;
  }

  // One gain node per layer, so a layer fades as a whole rather than note by note.
  function buildLayers() {
    for (const name of LAYER_NAMES) {
      const bus = ac.createGain(); bus.gain.value = 0; bus.connect(musicBus);
      const [rv, dl] = LAYER_SENDS[name] || [0.2, 0];
      let sv = null, sd = null;
      if (rv > 0) { sv = ac.createGain(); sv.gain.value = rv; bus.connect(sv); sv.connect(verbIn); }
      if (dl > 0) { sd = ac.createGain(); sd.gain.value = dl; bus.connect(sd); sd.connect(delayIn); }
      music.layers[name] = { bus, target: 0, sv, sd };
    }
  }
  function layerTo(name, target, t, bars) {
    const L = music.layers[name]; if (!L) return;
    L.target = target;
    const dur = Math.max(0.25, (60 / music.bpm) * 4 * (bars || 1.5));
    const g = L.bus.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(target, t + dur);
  }
  const layerGain = n => (music.layers[n] ? music.layers[n].target : 0);
  // Ramp every layer to the current section's targets, scaled by the overall intensity.
  function applyLayers(t) {
    const S = SECTIONS[music.section] || SECTIONS.grid;
    for (const name of LAYER_NAMES) layerTo(name, (S.layers[name] || 0) * (0.35 + 0.65 * music.intensity), t, S.fade);
  }

  function applyPlanet(desc) {
    if (!alive()) { music.pending = desc; return; }
    // Seed and planet both feed the music, so one seed on two planets still sounds different.
    const seed = ((desc && desc.seed) || 1) ^ hashStr((desc && (desc.planetId || desc.laneStyle)) || 'x');
    const r = rnd32(seed ^ 0x9E37);
    music.rng = r;
    // Bright worlds lean major-ish (lydian, dorian, penta); dark worlds lean minor and phrygian.
    const pool = desc && desc.bright ? ['dorian', 'penta', 'lydian', 'minor'] : ['minor', 'phrygian', 'minor', 'penta'];
    music.scaleName = pool[Math.floor(r() * pool.length)];
    music.scale = SCALES[music.scaleName] || SCALES.minor;
    music.bpm = Math.round(70 + r() * 40);
    music.root = 33 + Math.floor(r() * 8);                       // A1..E2 area
    music.wave = ['sawtooth', 'triangle', 'square'][Math.floor(r() * 3)];
    const emis = (desc && desc.emis) || [1, 1, 1];
    const bright = (emis[0] + emis[1] + emis[2]) / 3;
    music.cutoff = 420 + bright * 520 + r() * 500;               // emissive-heavy worlds sound brighter
    music.arpDens = 0.3 + r() * 0.5;
    music.euclid = euclidean(3 + Math.floor(r() * 5), 16);
    music.prog = [0, [5, 3, 4][Math.floor(r() * 3)], [3, 2, 5][Math.floor(r() * 3)], [4, 6, 1][Math.floor(r() * 3)]];
    music.seedName = (desc && desc.name) || '';
    // A 3 to 5 note motif in scale degrees, the piece's recurring idea.
    const len = 3 + Math.floor(r() * 3), steps = [-2, -1, 1, 1, 2, 2, 3, 4];
    const m = [0];
    for (let i = 1; i < len; i++) m.push(clamp(m[i - 1] + steps[Math.floor(r() * steps.length)], -4, 7));
    music.motif = m;
    if (verbIn) verbIn.gain.value = 0.3 + (desc && desc.fog ? clamp(desc.fog * 90, 0, 0.5) : 0.2);
    if (music.delay) music.delay.delayTime.value = 60 / music.bpm * (r() < 0.5 ? 0.75 : 0.5);
    music.chordI = 0; music.step = 0; music.nextT = 0; music.bar = 0; music.sectionBar = 0;
    bump('planet');
  }
  const degree = d => {
    const s = music.scale, dd = d + music.keyShift;
    const o = Math.floor(dd / s.length), i = ((dd % s.length) + s.length) % s.length;
    return music.root + s[i] + o * 12;
  };
  // Motif variations: the same idea heard differently as the race develops.
  function motifNotes(kind) {
    const m = music.motif;
    if (kind === 'transposeUp') return m.map(d => d + 2);
    if (kind === 'transposeDown') return m.map(d => d - 2);
    if (kind === 'inverted') return m.map(d => -d);
    if (kind === 'retrograde') return [...m].reverse();
    if (kind === 'augmented') return m;                      // same notes, doubled durations
    return m;
  }

  // ---- voices. Every one takes an absolute time so the scheduler stays ahead of the clock.
  // Two tiers, so that when the score is busy it drops decoration rather than harmony.
  const budget = (tier) => music.voices < (tier === 'deco' ? 13 : 19);
  function track(node, t, dur) {
    music.voices++;
    node.onended = () => { music.voices--; };
    return node;
  }
  function padVoice(t, midi, dur, gain, detune) {
    if (!budget()) return;
    const o = ac.createOscillator();
    o.type = music.wave; o.frequency.value = mtof(midi); o.detune.value = detune;
    const f = ac.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(music.cutoff * 0.6, t);
    f.frequency.linearRampToValueAtTime(music.cutoff * (1 + 0.4 * music.intensity), t + dur * 0.5);
    f.Q.value = 3;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(music.layers.pad.bus);
    o.start(t); o.stop(t + dur + 0.05); track(o);
    dbg.notes++;
    o.onended = () => { music.voices--; try { g.disconnect(); f.disconnect(); } catch (e) {} };
  }
  function droneVoice(t, midi, dur, gain) {
    if (!budget()) return;
    const o = ac.createOscillator(), o2 = ac.createOscillator();
    o.type = 'triangle'; o2.type = 'triangle'; o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi); o2.detune.value = 8;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500 + music.cutoff * 0.3;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(music.layers.drone.bus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    track(o); dbg.notes++;
    o.onended = () => { music.voices--; try { g.disconnect(); f.disconnect(); } catch (e) {} };
  }
  function pluck(t, midi, gain, busName) {
    if (!budget('deco')) return;
    const o = ac.createOscillator();
    o.type = 'triangle'; o.frequency.value = mtof(midi);
    const f = ac.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(mtof(midi) * 7, t); f.frequency.exponentialRampToValueAtTime(mtof(midi) * 1.6, t + 0.5);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(f); f.connect(g); g.connect(music.layers[busName || 'pluck'].bus);
    o.start(t); o.stop(t + 0.8); track(o); dbg.notes++;
  }
  function leadVoice(t, midi, dur, gain) {
    if (!budget()) return;
    const o = ac.createOscillator();
    o.type = music.wave === 'square' ? 'square' : 'sawtooth'; o.frequency.value = mtof(midi);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(mtof(midi) * 2, t);
    f.frequency.linearRampToValueAtTime(mtof(midi) * (4 + 4 * music.intensity), t + dur * 0.4);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.linearRampToValueAtTime(gain * 0.7, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(music.layers.lead.bus);
    o.start(t); o.stop(t + dur + 0.05); track(o); dbg.notes++;
  }
  function subNote(t, midi, dur, gain) {
    if (!budget()) return;
    const o = ac.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(mtof(midi), t);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(music.layers.sub.bus);
    o.start(t); o.stop(t + dur + 0.05); track(o); dbg.notes++;
  }
  function perc(t, gain, lo, hi, dur) {
    if (!budget('deco')) return;
    const s = noise(dur || 0.22, 3), f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = lo + Math.random() * (hi - lo); f.Q.value = 1.2;
    const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2));
    s.connect(f); f.connect(g); g.connect(music.layers.perc.bus);
    s.start(t); s.stop(t + (dur || 0.22) + 0.03); track(s);
  }
  function kick(t, gain) {
    if (!budget('deco')) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(music.layers.perc.bus);
    o.start(t); o.stop(t + 0.25); track(o);
  }
  // Atmosphere bed: a slow filtered noise swell, used in the grid and under the big sections.
  function texSwell(t, dur, gain) {
    if (!budget('deco')) return;
    const s = loopNoise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1400, t + dur * 0.6); f.frequency.linearRampToValueAtTime(400, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(music.layers.tex.bus);
    s.start(t); s.stop(t + dur + 0.05); track(s);
  }
  // One-bar riser into a section change, landing on the downbeat.
  function riser(t, dur) {
    if (!alive()) return;
    const s = loopNoise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'bandpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(5200, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    s.connect(f); f.connect(g); g.connect(music.layers.tex.bus);
    s.start(t); s.stop(t + dur + 0.1); track(s);
    bump('riser');
  }

  // ---- race state feeding the form. Read from the game rather than pushed, so game.js stays untouched.
  function pollGame() {
    try {
      if (music.pinned) return;   // test seam: progress pinned by testProgress()
      if (typeof Game === 'undefined' || !Game.ui || !Game.ui.order) return;
      const order = Game.ui.order(); if (!order || !order.length) return;
      const me = order.find(c => !c.isBot) || order[0];
      let laps = music.laps;
      const el = typeof document !== 'undefined' && document.getElementById('lap');
      if (el && el.textContent) { const m = el.textContent.match(/(\d+)\s*\/\s*(\d+)/); if (m) laps = +m[2] || laps; }
      music.laps = Math.max(1, laps);
      music.lap = me.lap || 0;
      // Craft line up just *behind* the start line, so t reads ~0.99 on lap 0 before the first crossing.
      // `half` (set once past the track midpoint) tells a grid slot apart from the run home on the last lap.
      const onGrid = (me.lap || 0) === 0 && !me.half && (me.t || 0) > 0.75;
      music.p01 = onGrid ? 0 : clamp((me.prog || 0) / music.laps, 0, 1);
      music.lastLap = (music.lap >= music.laps - 1) && (music.laps > 1 || music.p01 > 0.5);
      music.rank01 = order.length > 1 ? order.indexOf(me) / (order.length - 1) : 0;
      music.lowHull = me.life !== undefined && me.stats ? clamp(1 - me.life / (me.stats.life || 100), 0, 1) : 0;
      music.boosting = (me.boost || 0) > 0 ? 1 : 0;
      music.drifting = me.drifting ? 1 : 0;
      const prevLife = music.lastLife === undefined ? me.life : music.lastLife;
      music.hurt = Math.max(0, music.hurt - 0.08) + (me.life < prevLife - 1 ? 1 : 0);
      music.lastLife = me.life;
    } catch (e) {}
  }
  function sectionFor() {
    if (music.state === 'finished') return 'finish';
    if (music.state !== 'racing') return 'grid';
    const p = music.p01;
    if (p >= 0.9) return 'climax';
    if (p >= 0.72) return 'drive';
    if (p >= 0.5) return 'develop';
    if (p >= 0.25) return 'build';
    return 'intro';
  }

  // Step scheduler: 16 sixteenths per bar, looked ahead so timing is steady and voices are
  // scheduled at absolute times rather than whenever the timer happens to fire.
  let schedTimer = null;
  function schedule() {
    if (schedTimer) return;
    schedTimer = setInterval(() => {
      if (!alive() || ac.state !== 'running') return;
      if (++music.poll % 8 === 0) pollGame();
      music.intensity += (music.target - music.intensity) * 0.06;
      if (!music.on || music.intensity < 0.02) return;
      music.pendingSection = sectionFor();
      const spb = 60 / music.bpm / music.tempoMul, stepDur = spb / 4;   // sixteenths
      const t = now();
      if (music.nextT < t) music.nextT = t + 0.06;
      while (music.nextT < t + 0.3) {
        step(music.nextT, music.step);
        music.nextT += stepDur;
        music.step++;
      }
    }, 40);
  }

  function step(t, n) {
    const s = n % 16, spb = 60 / music.bpm / music.tempoMul, bar = 60 / music.bpm * 4 / music.tempoMul;
    const I = music.intensity;
    // --- bar line: commit the pending section, move the harmony, restate the motif.
    if (s === 0) {
      music.bar++;
      if (music.pendingSection !== music.section) {
        const from = music.section;
        music.section = music.pendingSection; music.sectionBar = 0;
        const S = SECTIONS[music.section];
        music.keyShift = S.key || 0;
        music.tempoMul = (music.section === 'climax' || (music.lastLap && music.section === 'drive')) ? 1.04 : 1;
        applyLayers(t);
        music.needLayers = false;
        bump('section:' + music.section);
        // If the change was decided too late for a riser, mark the seam with a downbeat accent.
        if (!music.filled) { perc(t, 0.07, 600, 5200, 0.5); bump('accent'); }
        music.filled = false;
        dbg.sections.push({ from, to: music.section, bar: music.bar, p: +music.p01.toFixed(3) });
      } else {
        music.sectionBar++;
        // First bar after the music starts, or after intensity moved a long way: settle the layers.
        if (music.needLayers) { applyLayers(t); music.needLayers = false; }
        else if (music.bar % 4 === 0) applyLayers(t);
      }
      const S = SECTIONS[music.section];
      music.chordI = (music.bar - 1) % music.prog.length;
      const rootDeg = music.prog[music.chordI];
      // Pad chord and bass, present in every section that asks for them.
      if (layerGain('pad') > 0.02) {
        const dur = bar * 0.98;
        padVoice(t, degree(rootDeg) + 12, dur, 0.055, -7);
        padVoice(t, degree(rootDeg + 2) + 12, dur, 0.045, 6);
        if (I > 0.45 || music.section === 'climax') padVoice(t, degree(rootDeg + 4) + 12, dur, 0.033, 12);
      }
      if (layerGain('drone') > 0.02) droneVoice(t, degree(0) - 12, bar * 1.9, 0.05);
      if (layerGain('sub') > 0.02) subNote(t, degree(rootDeg) - 12, spb * 2, 0.13);
      if (layerGain('tex') > 0.02 && music.bar % 4 === 1) texSwell(t, bar * 3.5, 0.05 + 0.05 * music.rank01);
      // Motif on the lead layer, one variation per section, augmented sections take twice as long.
      if (S.lead && layerGain('lead') > 0.02) {
        const notes = motifNotes(S.lead), aug = S.lead === 'augmented' ? 2 : 1;
        const gap = (S.lead === 'augmented' ? spb : spb * 0.75);
        notes.forEach((d, i) => {
          const nt = t + i * gap;
          if (nt < t + bar) leadVoice(nt, degree(rootDeg + d) + 24 + (S.oct || 0), gap * 0.9 * aug, 0.06);
        });
        music.motifName = S.lead;
      }
      // Final lap hook: the motif answered an octave up on the pluck bus.
      if (music.lastLap && layerGain('pluck') > 0.02 && music.bar % 2 === 0) {
        motifNotes('inverted').forEach((d, i) => pluck(t + spb * 2 + i * spb * 0.5, degree(rootDeg + d) + 36, 0.035, 'pluck'));
        bump('hook');
      }
      // Finish cadence: V then I with a long tail.
      if (music.section === 'finish' && music.sectionBar === 0) {
        padVoice(t, degree(4) + 12, bar, 0.05, -5);
        padVoice(t + bar, degree(0) + 12, bar * 2, 0.06, 4);
        padVoice(t + bar, degree(2) + 12, bar * 2, 0.05, -6);
        droneVoice(t + bar, degree(0) - 12, bar * 3, 0.06);
        bump('cadence');
      }
    }
    const S = SECTIONS[music.section];
    // --- one-bar fill and riser before a section change.
    if (s === 12 && music.pendingSection !== music.section) {
      for (let i = 0; i < 4; i++) perc(t + i * (spb / 4), 0.05 + i * 0.012, 900 + i * 900, 2600 + i * 1200, 0.12);
      riser(t, spb);
      music.filled = true;
      bump('fill');
    }
    // --- pluck arpeggio, denser as the race develops.
    if (layerGain('pluck') > 0.02) {
      const div = S.sub || 2;
      if (n % div === 0 && music.euclid[s] && music.rng() < music.arpDens + (music.lastLap ? 0.15 : 0)) {
        const deg = music.prog[music.chordI] + [0, 2, 4, 6][Math.floor(music.rng() * 4)];
        pluck(t, degree(deg) + 24, 0.05);
      }
    }
    // --- percussion patterns per section, double-time on the last lap.
    const pat = S.perc, dbl = music.lastLap || music.section === 'climax';
    if (layerGain('perc') > 0.02 && pat !== 'none') {
      if (pat === 'pulse' && s % 8 === 0) perc(t, 0.03, 1400, 3000);
      if (pat === 'half') { if (s === 0 || s === 8) kick(t, 0.16); if (s === 4 || s === 12) perc(t, 0.035, 1800, 4200); }
      if (pat === 'four') { if (s % 4 === 0) kick(t, 0.17); if (s === 4 || s === 12) perc(t, 0.045, 1800, 4200); if (s % 4 === 2) perc(t, 0.018, 5000, 9000, 0.06); }
      if (pat === 'busy' || pat === 'double') {
        if (s % 4 === 0) kick(t, 0.18);
        if (s === 4 || s === 12) perc(t, 0.05, 1600, 4200);
        if (s % (dbl ? 1 : 2) === 0) perc(t, 0.014 + 0.006 * music.drifting, 5200, 9500, 0.05);
      }
    }
    // --- live race state, applied gently and only on beats so there is no zipper noise.
    if (s % 4 === 0) {
      const L = music.layers;
      if (L.tex) { const want = ((S.layers.tex || 0) + music.rank01 * 0.22 + music.hurt * 0.1) * (0.35 + 0.65 * I); L.tex.bus.gain.setTargetAtTime(clamp(want, 0, 1), t, 0.5); }
      if (L.lead && music.boosting) L.lead.bus.gain.setTargetAtTime(clamp(L.lead.target * 1.25, 0, 1), t, 0.15);
      if (music.lowHull > 0.65 && s === 0 && music.bar % 2 === 0 && layerGain('drone') < 0.3) droneVoice(t, degree(1) - 12, bar * 0.9, 0.035);
      if (music.hurt > 0.6 && s === 0) { pluck(t, degree(1) + 24, 0.04); music.hurt = 0.2; }
    }
  }

  function raceState(state) {
    if (!alive()) { music.pendingState = state; return; }
    music.on = true; music.state = state; music.needLayers = true;
    if (state === 'menu') { music.target = 0.4; music.p01 = 0; music.lap = 0; music.lastLap = false; }
    else if (state === 'countdown') { music.target = 0.55; music.p01 = 0; music.lap = 0; music.lastLap = false; }
    else if (state === 'racing') music.target = 0.9;
    else if (state === 'finished') music.target = 0.6;
    else if (state === 'off') { music.target = 0; music.on = false; }
    bump('state:' + state);
  }
  function goSting() {
    if (!alive()) return;
    const t = now(), base = degree(music.prog[0]) + 24;
    [0, 7, 12].forEach((iv, k) => pluck(t + k * 0.055, base + iv, 0.09));
    bump('go');
  }

  // ---------------------------------------------------------------- sfx
  const panners = new Map();
  function sfxNode(pan) {
    const g = ac.createGain();
    if (pan === undefined || !ac.createStereoPanner) { g.connect(sfxBus); return g; }
    const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    g.connect(p); p.connect(sfxBus); return g;
  }
  function blip(freq, dur, type, gain, pan, sweepTo) {
    if (!alive()) return;
    const t = now(), o = ac.createOscillator(), g = sfxNode(pan);
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.02); dbg.sfx++;
  }
  function noiseBurst(dur, f0, f1, gain, q, pan, type) {
    if (!alive()) return;
    const t = now(), s = noise(dur, 2), f = ac.createBiquadFilter(), g = sfxNode(pan);
    f.type = type || 'bandpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); s.start(t); s.stop(t + dur + 0.02); dbg.sfx++;
  }

  // Engine: one continuous voice per craft. The player's is full volume and centred; others are quieter and panned.
  const engines = new Map();
  function engineFor(id) {
    if (!alive()) return null;
    let e = engines.get(id);
    if (e) return e;
    const osc = ac.createOscillator(), osc2 = ac.createOscillator(), sub = ac.createOscillator();
    const nz = loopNoise(), nf = ac.createBiquadFilter();
    const f = ac.createBiquadFilter(), g = ac.createGain(), p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    osc.type = 'sawtooth'; osc2.type = 'sawtooth'; osc2.detune.value = 11; sub.type = 'sine';
    f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 4;
    nf.type = 'bandpass'; nf.frequency.value = 1200; nf.Q.value = 0.8;
    const ng = ac.createGain(); ng.gain.value = 0.12;
    g.gain.value = 0;
    osc.connect(f); osc2.connect(f); sub.connect(g); f.connect(g); nz.connect(nf); nf.connect(ng); ng.connect(g);
    if (p) { g.connect(p); p.connect(sfxBus); } else g.connect(sfxBus);
    osc.start(); osc2.start(); sub.start(); nz.start();
    e = { osc, osc2, sub, f, g, p, ng };
    engines.set(id, e);
    return e;
  }
  // speed 0..1, throttle 0..1, gain scale, pan -1..1
  function engine(id, speed01, throttle, gain, pan) {
    const e = engineFor(id); if (!e) return;
    const t = now(), base = 55 + speed01 * 120 + throttle * 26;
    e.osc.frequency.setTargetAtTime(base, t, 0.08);
    e.osc2.frequency.setTargetAtTime(base * 1.005, t, 0.08);
    e.sub.frequency.setTargetAtTime(base * 0.5, t, 0.12);
    e.f.frequency.setTargetAtTime(320 + speed01 * 2600 + throttle * 900, t, 0.09);
    e.ng.gain.setTargetAtTime(0.05 + speed01 * 0.16, t, 0.12);
    e.g.gain.setTargetAtTime(gain, t, 0.1);
    if (e.p) e.p.pan.setTargetAtTime(clamp(pan || 0, -1, 1), t, 0.15);
  }
  function engineStopAll() { for (const [, e] of engines) { try { e.osc.stop(); e.osc2.stop(); e.sub.stop(); } catch (x) {} } engines.clear(); }

  // Wind: one shared noise voice whose level and brightness follow speed.
  let wind = null;
  function windLevel(speed01) {
    if (!alive()) return;
    if (!wind) {
      const s = loopNoise(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.5; g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
      wind = { s, f, g };
    }
    const t = now();
    wind.g.gain.setTargetAtTime(0.035 * speed01 * speed01, t, 0.2);
    wind.f.frequency.setTargetAtTime(500 + speed01 * 1500, t, 0.2);
  }

  const sfx = {
    boost(pan) { noiseBurst(0.75, 300, 4200, 0.3, 0.7, pan); blip(90, 0.5, 'sawtooth', 0.14, pan, 260); bump('boost'); },
    thrust(pan) { blip(150, 0.28, 'square', 0.16, pan, 520); noiseBurst(0.3, 800, 200, 0.18, 1.4, pan); bump('thrust'); },
    drift(intensity, pan) { noiseBurst(0.22, 2600, 900, 0.06 * clamp(intensity, 0, 1), 3, pan); bump('drift'); },
    gate(pan) { noiseBurst(0.5, 3200, 400, 0.14, 0.8, pan); blip(420, 0.3, 'sine', 0.05, pan, 180); bump('gate'); },
    pickup() { [0, 4, 7, 12].forEach((iv, k) => setTimeout(() => blip(mtof(72 + iv), 0.24, 'triangle', 0.13), k * 45)); bump('pickup'); },
    itemReady() { blip(880, 0.1, 'square', 0.07); setTimeout(() => blip(1320, 0.12, 'square', 0.06), 70); bump('itemReady'); },
    shot(pan) { blip(760, 0.14, 'square', 0.16, pan, 180); noiseBurst(0.12, 3000, 700, 0.12, 1, pan); bump('shot'); },
    missile(pan) {
      noiseBurst(1.1, 500, 2600, 0.2, 0.6, pan); blip(180, 0.9, 'sawtooth', 0.12, pan, 900); bump('missile');
    },
    rail(pan) { blip(2400, 0.35, 'sawtooth', 0.16, pan, 300); noiseBurst(0.4, 6000, 800, 0.2, 2.5, pan); duck(0.2, 0.3); bump('rail'); },
    emp(pan) {
      if (!alive()) return;
      const t = now(), o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = sfxNode(pan), f = ac.createBiquadFilter();
      o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(45, t + 1.1);
      lfo.type = 'sine'; lfo.frequency.value = 18; lg.gain.value = 220; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.26, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(f); f.connect(g); o.start(t); lfo.start(t); o.stop(t + 1.25); lfo.stop(t + 1.25);
      duck(0.3, 0.6); bump('emp'); dbg.sfx++;
    },
    gravity(pan) {
      if (!alive()) return;
      const t = now(), o = ac.createOscillator(), g = sfxNode(pan);
      o.type = 'triangle'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(240, t + 2.8);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      o.connect(g); o.start(t); o.stop(t + 3.1); bump('gravity'); dbg.sfx++;
    },
    explosion(scale, pan) {
      const s = clamp(scale || 1, 0.4, 2.2);
      noiseBurst(0.9 * s, 900, 60, 0.42 * s, 0.5, pan, 'lowpass');
      blip(110, 0.8 * s, 'sine', 0.32 * s, pan, 26);
      noiseBurst(0.25, 5000, 1200, 0.16, 1.2, pan);
      duck(0.35, 0.5); bump('explosion');
    },
    impact(force, pan) {
      const f = clamp(force / 20, 0.15, 1.4);
      noiseBurst(0.28, 2200 * f + 400, 180, 0.3 * f, 1.6, pan);
      blip(140 + 90 * f, 0.22, 'square', 0.14 * f, pan, 60);
      bump('impact');
    },
    shieldHit(pan) { blip(1200, 0.5, 'sine', 0.16, pan, 2400); noiseBurst(0.4, 4000, 2000, 0.1, 3, pan); bump('shieldHit'); },
    wreck(pan) {
      noiseBurst(1.3, 700, 40, 0.4, 0.4, pan, 'lowpass');
      blip(80, 1.1, 'sawtooth', 0.2, pan, 18);
      duck(0.45, 0.8); bump('wreck');
    },
    splash(pan) { noiseBurst(0.55, 4000, 500, 0.24, 0.8, pan); bump('splash'); },
    click() { blip(1500, 0.05, 'square', 0.05); bump('click'); },
    step() { blip(520, 0.14, 'triangle', 0.07, 0, 780); bump('step'); },
    count(n) { blip(n > 0 ? 620 : 940, n > 0 ? 0.16 : 0.4, 'triangle', 0.12); if (n === 0) goSting(); bump('count'); },
  };

  // ---------------------------------------------------------------- api
  function setMusic(v) { vol.music = clamp(v, 0, 1); if (musicBus) musicBus.gain.setTargetAtTime(vol.music, now(), 0.05); save(); }
  function setSfx(v) { vol.sfx = clamp(v, 0, 1); if (sfxBus) sfxBus.gain.setTargetAtTime(vol.sfx, now(), 0.05); save(); }
  function mute(b) {
    vol.muted = b === undefined ? !vol.muted : !!b; save();
    if (master) master.gain.setTargetAtTime(vol.muted ? 0 : 1, now(), 0.03);
    if (ac) { if (vol.muted) { try { ac.suspend(); } catch (e) {} } else { try { ac.resume(); } catch (e) {} } }
    return vol.muted;
  }
  return {
    init, setMusic, setSfx, mute,
    resume: () => { try { if (ac && ac.state !== 'running' && !vol.muted) ac.resume(); } catch (e) {} },
    isMuted: () => vol.muted, volumes: () => ({ ...vol }),
    // Test seam: pin race progress so the section form can be swept without driving a whole race.
    testProgress: (p, lap, laps) => {
      music.pinned = p !== null && p !== undefined;
      if (!music.pinned) return;
      music.laps = Math.max(1, laps || music.laps);
      music.p01 = clamp(p, 0, 1);
      music.lap = lap === undefined ? Math.min(music.laps - 1, Math.floor(music.p01 * music.laps)) : lap;
      music.lastLap = (music.lap >= music.laps - 1) && (music.laps > 1 || music.p01 > 0.5);
    },
    planet: applyPlanet, race: raceState,
    engine, engineStopAll, wind: windLevel, sfx,
    debug: () => ({
      ctx: ac ? ac.state : 'none', voices: engines.size + (wind ? 1 : 0), musicVoices: music.voices, notes: dbg.notes, sfx: dbg.sfx,
      music: {
        on: music.on, intensity: +music.intensity.toFixed(2), bpm: music.bpm, tempoMul: +music.tempoMul.toFixed(2),
        scale: music.scaleName, root: music.root, wave: music.wave, cutoff: Math.round(music.cutoff),
        section: music.section, order: (SECTIONS[music.section] || {}).order, bar: music.bar, sectionBar: music.sectionBar,
        motif: music.motif, motifVariation: music.motifName, keyShift: music.keyShift,
        p01: +music.p01.toFixed(3), lap: music.lap, laps: music.laps, lastLap: music.lastLap, rank01: +music.rank01.toFixed(2),
        layers: Object.fromEntries(LAYER_NAMES.map(n => [n, +(music.layers[n] ? music.layers[n].bus.gain.value : 0).toFixed(3)])),
      },
      sections: dbg.sections.slice(-24), events: { ...dbg.events },
    }),
  };
})();
