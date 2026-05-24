/**
 * Transport — the looper's audio engine.
 *
 * One global tempo grid (BPM, beats/bar, bars/loop) drives:
 *   - a metronome (audible clicks per beat, accented on the downbeat),
 *   - a look-ahead scheduler that spawns layer-playback notes against the
 *     AudioContext clock for sample-accurate timing,
 *   - a recorder that captures live-played notes from `dispatch` into the
 *     currently-armed layer.
 *
 * Architectural notes
 * -------------------
 * Layer audio data (notes + voice snapshot) lives here, not in the Zustand
 * store. The store keeps only UI metadata (enabled, volume, state, hasContent)
 * so React renders stay cheap while the audio engine churns at 60 Hz.
 *
 * The scheduler is the Chris Wilson "Tale of Two Clocks" pattern:
 * `setInterval` fires every ~25 ms, peeks ~100 ms ahead on the audio clock,
 * and schedules everything in that window via WebAudio's precise scheduling
 * primitives. JS jitter does not affect audio timing — the worst it does is
 * skip a tick (which the next tick catches up on by widening the window).
 *
 * Recording-end pairing: during recording we keep an `openByCode` map so each
 * NoteOff closes the most recent NoteOn for that code. On commit, any still-
 * open notes get a synthetic off at loopDuration (truncate held notes at the
 * loop boundary). The resulting `LayerNote[]` is purely flat — each note has
 * an explicit start + duration so playback can schedule release precisely.
 */

import { getContext, getMaster } from '../audio/context';
import { spawnLayerNote } from '../audio/synth';
import type { VoiceNote, VoiceSpec } from '../audio/voices';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayerNote {
  /** seconds from loop start */
  startTime: number;
  /** seconds */
  duration: number;
  freqs: number[];
  /** snapshot of the voice at record time — keeps the loop sounding the same
   *  even if the user later edits or deletes that voice */
  voice: VoiceSpec;
}

export interface TransportConfig {
  bpm: number;
  beatsPerBar: number;
  barsPerLoop: number;
}

export const TRANSPORT_DEFAULTS: TransportConfig = {
  bpm: 96,
  beatsPerBar: 4,
  barsPerLoop: 4,
};

export const LAYER_COUNT = 8;

export type LayerState = 'empty' | 'armed' | 'recording' | 'looping';

/** Events emitted to subscribers. UI components subscribe to drive React state. */
export type TransportEvent =
  | { kind: 'transport-state'; running: boolean }
  | { kind: 'recording-armed'; layerId: number }
  | { kind: 'recording-started'; layerId: number }
  | { kind: 'recording-finished'; layerId: number; hasContent: boolean }
  | { kind: 'layer-cleared'; layerId: number }
  | { kind: 'count-in-tick'; remaining: number }
  | { kind: 'beat-tick'; globalBeat: number; beatInBar: number };

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let config: TransportConfig = { ...TRANSPORT_DEFAULTS };
let metronomeOn = true;

const subs = new Set<(e: TransportEvent) => void>();
function emit(e: TransportEvent): void { for (const cb of subs) cb(e); }

export function subscribe(cb: (e: TransportEvent) => void): () => void {
  subs.add(cb);
  return () => { subs.delete(cb); };
}

interface RunState {
  /** AudioContext time when the *first loop iteration* begins
   *  (i.e. after the count-in, if any). */
  loopOriginTime: number;
  /** AudioContext time when the very first beat (count-in or loop) hit. */
  startTime: number;
  countInBeats: number;       // 0 if no count-in
  /** Next global beat index that hasn't been scheduled yet. */
  nextBeatIdx: number;
  /** Next AudioContext time at which a *loop iteration* should start. */
  nextLoopStartTime: number;
  iterationIdx: number;       // 0-based since loopOriginTime
  intervalId: ReturnType<typeof setInterval>;
}

let run: RunState | null = null;

// Per-layer audio data + metadata. Notes here are authoritative; the store
// only mirrors a small slice for UI rendering (enabled, volume, state).
interface LayerRuntime {
  notes: LayerNote[];
  enabled: boolean;
  volume: number;
  state: LayerState;
  gain: GainNode | null;
  /** notes currently playing back, keyed by a unique scheduled-event token,
   *  so stopTransport can release them cleanly without touching user-played
   *  notes in the synth's global `live` map. */
  active: Set<VoiceNote>;
}

const layers: LayerRuntime[] = Array.from({ length: LAYER_COUNT }, () => ({
  notes: [],
  enabled: true,
  volume: 0.8,
  state: 'empty' as LayerState,
  gain: null,
  active: new Set<VoiceNote>(),
}));

// Recording state — non-null while a layer is recording or armed.
interface RecorderState {
  layerId: number;
  /** AudioContext time the recording iteration began. Events are stored as
   *  relative to this. */
  iterationStartTime: number;
  /** Notes committed so far in this iteration (closed pairs). */
  notes: LayerNote[];
  /** Open notes keyed by code — each captureNoteOff matches and closes the
   *  most recent open of the same code. */
  openByCode: Map<string, { startTime: number; freqs: number[]; voice: VoiceSpec }>;
}

let recorder: RecorderState | null = null;
/** A layer can be armed to record at the next loop boundary while the
 *  transport is running. Held here until the boundary fires. */
let armedLayerId: number | null = null;

// ---------------------------------------------------------------------------
// Config + status
// ---------------------------------------------------------------------------

export function setConfig(cfg: Partial<TransportConfig>): void {
  // Reject mid-transport BPM changes silently — would desync existing layers.
  // The UI should disable the BPM input while running.
  if (run) return;
  config = {
    bpm:         clampNum(cfg.bpm ?? config.bpm, 30, 240),
    beatsPerBar: clampInt(cfg.beatsPerBar ?? config.beatsPerBar, 2, 16),
    barsPerLoop: clampInt(cfg.barsPerLoop ?? config.barsPerLoop, 1, 16),
  };
}

export function getConfig(): TransportConfig { return { ...config }; }
export function isRunning(): boolean { return run !== null; }
export function getBeatDuration(): number { return 60 / config.bpm; }
export function getLoopDuration(): number {
  return config.beatsPerBar * config.barsPerLoop * getBeatDuration();
}

/** Current loop position in seconds (0..loopDuration), or null if stopped. */
export function getLoopPosition(): number | null {
  if (!run) return null;
  const ctx = getContext();
  const t = ctx.currentTime - run.loopOriginTime;
  const dur = getLoopDuration();
  if (t < 0) return null; // still in count-in
  return ((t % dur) + dur) % dur;
}

export function getCountInRemaining(): number | null {
  if (!run || run.countInBeats === 0) return null;
  const ctx = getContext();
  const beatsElapsed = (ctx.currentTime - run.startTime) / getBeatDuration();
  const remaining = run.countInBeats - Math.floor(beatsElapsed);
  return remaining > 0 ? remaining : null;
}

export function setMetronomeEnabled(on: boolean): void { metronomeOn = on; }
export function getMetronomeEnabled(): boolean { return metronomeOn; }

// ---------------------------------------------------------------------------
// Layer accessors (UI-facing — return shallow copies for safety)
// ---------------------------------------------------------------------------

export function getLayerState(layerId: number): LayerState {
  return layers[layerId]?.state ?? 'empty';
}
export function getLayerHasContent(layerId: number): boolean {
  return (layers[layerId]?.notes.length ?? 0) > 0;
}
export function getLayerVolume(layerId: number): number {
  return layers[layerId]?.volume ?? 0.8;
}
export function getLayerEnabled(layerId: number): boolean {
  return layers[layerId]?.enabled ?? true;
}

export function setLayerVolume(layerId: number, v: number): void {
  const L = layers[layerId];
  if (!L) return;
  L.volume = clampNum(v, 0, 1);
  ensureLayerGain(layerId);
  L.gain!.gain.value = L.enabled ? L.volume : 0;
}

export function setLayerEnabled(layerId: number, on: boolean): void {
  const L = layers[layerId];
  if (!L) return;
  L.enabled = on;
  ensureLayerGain(layerId);
  L.gain!.gain.value = on ? L.volume : 0;
}

export function clearLayer(layerId: number): void {
  const L = layers[layerId];
  if (!L) return;
  for (const note of L.active) note.release(true);
  L.active.clear();
  L.notes = [];
  L.state = 'empty';
  emit({ kind: 'layer-cleared', layerId });
}

export function clearAllLayers(): void {
  for (let i = 0; i < LAYER_COUNT; i++) clearLayer(i);
}

function ensureLayerGain(layerId: number): void {
  const L = layers[layerId];
  if (L.gain) return;
  const ctx = getContext();
  const g = ctx.createGain();
  g.gain.value = L.enabled ? L.volume : 0;
  g.connect(getMaster());
  L.gain = g;
}

// ---------------------------------------------------------------------------
// Recording — armed + active
// ---------------------------------------------------------------------------

/**
 * Arm a layer to start recording.
 *   - If transport is stopped: start the transport with a 1-bar count-in,
 *     then recording begins at the first loop boundary.
 *   - If transport is running: the layer is queued; recording begins at the
 *     next loop boundary. Any existing content on that layer is replaced
 *     *at the point recording starts*, not at arm time — so an un-arm reverts
 *     the layer to its prior state non-destructively.
 *   - Clicking the same layer's record button while it is already armed (but
 *     not yet recording) cancels the arm.
 */
export function armRecord(layerId: number): void {
  if (layerId < 0 || layerId >= LAYER_COUNT) return;

  // Toggle-cancel: re-click on the armed-but-not-yet-recording layer reverts.
  if (armedLayerId === layerId && (!recorder || recorder.layerId !== layerId)) {
    armedLayerId = null;
    const L = layers[layerId];
    L.state = L.notes.length ? 'looping' : 'empty';
    emit({ kind: 'recording-finished', layerId, hasContent: L.notes.length > 0 });
    return;
  }

  // Re-arming a currently-recording layer: ignore (let it commit at boundary).
  if (recorder && recorder.layerId === layerId) return;

  // Replace a previously-armed-but-different layer: revert it first.
  if (armedLayerId !== null && armedLayerId !== layerId) {
    const prev = layers[armedLayerId];
    prev.state = prev.notes.length ? 'looping' : 'empty';
    emit({ kind: 'recording-finished', layerId: armedLayerId, hasContent: prev.notes.length > 0 });
  }

  armedLayerId = layerId;
  layers[layerId].state = 'armed';
  // Note: existing L.notes are NOT cleared here. The scheduler clears them
  // at the recording boundary so that a cancel-arm restores prior content.

  emit({ kind: 'recording-armed', layerId });

  if (!run) {
    startTransport({ countIn: true });
  }
}

export function disarmRecord(): void {
  if (armedLayerId !== null) {
    const L = layers[armedLayerId];
    if (L && L.state === 'armed') L.state = L.notes.length ? 'looping' : 'empty';
    armedLayerId = null;
  }
  if (recorder) {
    // Stop mid-recording: commit what we have.
    commitRecording();
  }
}

export function getRecordingLayerId(): number | null {
  if (recorder) return recorder.layerId;
  return armedLayerId;
}

/**
 * Live-played NoteOn — funneled from dispatch when a recorder is active.
 * `voice` is the resolved VoiceSpec used to play the note, so the loop
 * keeps sounding identical to the live playback.
 */
export function captureNoteOn(opts: {
  code: string;
  freqs: number[];
  voice: VoiceSpec;
}): void {
  if (!recorder) return;
  // Close any previous open under this code (reattack).
  closeOpen(opts.code);
  recorder.openByCode.set(opts.code, {
    startTime: getContext().currentTime - recorder.iterationStartTime,
    freqs: [...opts.freqs],
    voice: opts.voice,
  });
}

export function captureNoteOff(opts: { code: string }): void {
  if (!recorder) return;
  closeOpen(opts.code);
}

function closeOpen(code: string): void {
  if (!recorder) return;
  const open = recorder.openByCode.get(code);
  if (!open) return;
  const now = getContext().currentTime - recorder.iterationStartTime;
  const dur = Math.max(0.02, now - open.startTime);
  recorder.notes.push({
    startTime: clampNum(open.startTime, 0, getLoopDuration()),
    duration:  clampNum(dur, 0.02, getLoopDuration() - open.startTime + 0.5),
    freqs: open.freqs,
    voice: open.voice,
  });
  recorder.openByCode.delete(code);
}

function commitRecording(): void {
  if (!recorder) return;
  const loopDur = getLoopDuration();
  // Truncate held notes at the loop boundary.
  for (const [, open] of recorder.openByCode) {
    recorder.notes.push({
      startTime: clampNum(open.startTime, 0, loopDur),
      duration:  Math.max(0.02, loopDur - open.startTime),
      freqs: open.freqs,
      voice: open.voice,
    });
  }

  const layerId = recorder.layerId;
  const L = layers[layerId];
  L.notes = recorder.notes;
  L.state = L.notes.length > 0 ? 'looping' : 'empty';

  emit({ kind: 'recording-finished', layerId, hasContent: L.notes.length > 0 });

  recorder = null;
}

// ---------------------------------------------------------------------------
// Transport start/stop
// ---------------------------------------------------------------------------

const LOOKAHEAD_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_SEC    = 0.12;

export function startTransport(opts: { countIn?: boolean } = {}): void {
  if (run) return;
  const ctx = getContext();
  for (let i = 0; i < LAYER_COUNT; i++) ensureLayerGain(i);

  const countInBeats = opts.countIn ? config.beatsPerBar : 0;
  const startTime = ctx.currentTime + 0.06; // small offset for first scheduling tick
  const loopOriginTime = startTime + countInBeats * getBeatDuration();

  run = {
    startTime,
    loopOriginTime,
    countInBeats,
    nextBeatIdx: 0,
    nextLoopStartTime: loopOriginTime,
    iterationIdx: 0,
    intervalId: setInterval(schedulerTick, LOOKAHEAD_INTERVAL_MS),
  };

  emit({ kind: 'transport-state', running: true });
}

export function stopTransport(): void {
  if (!run) return;
  clearInterval(run.intervalId);
  run = null;

  // Release everything currently playing from layers.
  for (const L of layers) {
    for (const note of L.active) note.release(false);
    L.active.clear();
    if (L.state === 'armed') L.state = L.notes.length ? 'looping' : 'empty';
  }

  // Discard any in-progress recording silently — user can re-arm.
  if (recorder) {
    const L = layers[recorder.layerId];
    L.state = L.notes.length ? 'looping' : 'empty';
    emit({ kind: 'recording-finished', layerId: recorder.layerId, hasContent: false });
    recorder = null;
  }
  armedLayerId = null;

  emit({ kind: 'transport-state', running: false });
}

// ---------------------------------------------------------------------------
// Scheduler tick — peek ahead on the audio clock, schedule everything inside
// the window. Idempotent: each event is scheduled at most once.
// ---------------------------------------------------------------------------

function schedulerTick(): void {
  if (!run) return;
  const ctx = getContext();
  const horizon = ctx.currentTime + SCHEDULE_AHEAD_SEC;
  const beatDur = getBeatDuration();
  const loopDur = getLoopDuration();

  // 1. Schedule metronome clicks for every beat in (currentTime, horizon].
  //    Beat 0 is at startTime; beat N is at startTime + N*beatDur.
  while (true) {
    const beatTime = run.startTime + run.nextBeatIdx * beatDur;
    if (beatTime >= horizon) break;
    const beatInBar = run.nextBeatIdx % config.beatsPerBar;
    const inCountIn = run.nextBeatIdx < run.countInBeats;
    if (metronomeOn || inCountIn) {
      scheduleClick(beatTime, beatInBar === 0);
    }
    // Fire beat-tick callback at the actual beat time (slight setTimeout)
    // so React can pulse a beat indicator. Audio precision irrelevant here.
    {
      const beat = run.nextBeatIdx;
      const inBar = beatInBar;
      const deltaMs = Math.max(0, (beatTime - ctx.currentTime) * 1000);
      setTimeout(() => emit({ kind: 'beat-tick', globalBeat: beat, beatInBar: inBar }), deltaMs);
      if (inCountIn) {
        const remaining = run.countInBeats - beat;
        setTimeout(() => emit({ kind: 'count-in-tick', remaining }), deltaMs);
      }
    }
    run.nextBeatIdx += 1;
  }

  // 2. Schedule loop iterations whose start is < horizon. Each iteration kicks
  //    off all looping layers' notes + handles the recording-start/recording-
  //    end transitions for armed/recording layers.
  while (run.nextLoopStartTime < horizon) {
    const iterStart = run.nextLoopStartTime;

    // 2a. Recording transitions.
    //   - If a layer was armed: start recording at this boundary.
    //   - If a layer was recording: commit it (which transitions to looping).
    if (recorder) {
      // Recording ends at iterStart — commit. (Synthetic offs may be needed
      // for notes whose 'off' falls slightly after iterStart due to JS lag;
      // commitRecording handles via openByCode truncation.)
      commitRecording();
    }
    if (armedLayerId !== null) {
      const id = armedLayerId;
      armedLayerId = null;
      const L = layers[id];
      // Replace-on-rerecord: clear prior content + cut any in-flight playback
      // at the moment recording actually begins (not at arm time).
      for (const note of L.active) note.release(true);
      L.active.clear();
      L.notes = [];
      recorder = {
        layerId: id,
        iterationStartTime: iterStart,
        notes: [],
        openByCode: new Map(),
      };
      L.state = 'recording';
      // setTimeout so the event fires roughly at iterStart, not now.
      const deltaMs = Math.max(0, (iterStart - ctx.currentTime) * 1000);
      setTimeout(() => emit({ kind: 'recording-started', layerId: id }), deltaMs);
    }

    // 2b. Schedule all looping layers' notes for this iteration.
    for (let layerId = 0; layerId < LAYER_COUNT; layerId++) {
      const L = layers[layerId];
      if (L.state !== 'looping' || L.notes.length === 0) continue;
      for (const note of L.notes) {
        scheduleLayerNote(layerId, note, iterStart + note.startTime);
      }
    }

    run.nextLoopStartTime += loopDur;
    run.iterationIdx += 1;
  }

  // 3. Garbage-collect released notes from `active` so the set doesn't grow.
  //    A note that was released completes after release+envelope; we can't
  //    detect that precisely without onended hooks. Keep it simple: notes
  //    are short-lived in the active set since release schedules cleanup
  //    via WebAudio internally. Periodic full clear is fine; for V1 we
  //    leave them — release() has already scheduled the oscillator stop.
}

function scheduleClick(audioTime: number, strong: boolean): void {
  const ctx = getContext();
  const dest = getMaster();
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = strong ? 1500 : 950;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, audioTime);
  g.gain.linearRampToValueAtTime(strong ? 0.18 : 0.10, audioTime + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, audioTime + 0.05);
  osc.connect(g).connect(dest);
  osc.start(audioTime);
  osc.stop(audioTime + 0.08);
}

function scheduleLayerNote(layerId: number, note: LayerNote, audioTime: number): void {
  const L = layers[layerId];
  ensureLayerGain(layerId);
  const voices = spawnLayerNote({
    freqs: note.freqs,
    voice: note.voice,
    startAt: audioTime,
    dest: L.gain!,
  });
  for (const v of voices) L.active.add(v);
  // Schedule release at audioTime + duration. Pass `at` so the release
  // envelope is precisely timed against the audio clock.
  const releaseAt = audioTime + note.duration;
  for (const v of voices) v.release(false, releaseAt);
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function clampNum(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : lo;
}
function clampInt(v: number, lo: number, hi: number): number {
  return Math.round(clampNum(v, lo, hi));
}
