import { create } from 'zustand';
import type { Mode } from '../lib/types';
import type { VoiceSpec } from '../lib/audio/voices';
import { validateUserVoicesRecord, validateVoiceSpec } from '../lib/audio/voices';
import { SYSTEMS, lookupSystem } from '../lib/tuning';
import * as transport from '../lib/transport/transport';
import { LAYER_COUNT, type LayerState } from '../lib/transport/transport';

export type CentsOverride = number | { deleted: true };

const USER_VOICES_KEY  = 'instrument:userVoices:v1';
const VOICE_PICK_KEY   = 'instrument:voice:v1';
const VOICE_DRAFT_KEY  = 'instrument:voiceDraft:v1';
const SYSTEM_KEY       = 'instrument:systemId:v2';   // v2: was 'tuning:v1' before the refactor
const OPTION_LOCK_KEY  = 'instrument:optionLock:v1';
const ACTIVE_SCALES_KEY = 'instrument:activeScales:v1';
const CUSTOM_MAPS_KEY  = 'instrument:customMaps:v1';
const LOOPER_ENABLED_KEY = 'instrument:looperEnabled:v1';
const BPM_KEY          = 'instrument:bpm:v1';
const METRONOME_KEY    = 'instrument:metronome:v1';

function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}
function clearKey(key: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

function readUserVoices(): Record<string, VoiceSpec> {
  return validateUserVoicesRecord(readJSON(USER_VOICES_KEY));
}
function writeUserVoices(map: Record<string, VoiceSpec>): void { writeJSON(USER_VOICES_KEY, map); }
function readVoicePick(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(VOICE_PICK_KEY); } catch { return null; }
}
function writeVoicePick(id: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(VOICE_PICK_KEY, id); } catch { /* quota */ }
}
function readDraft(): VoiceSpec | null {
  const raw = readJSON<unknown>(VOICE_DRAFT_KEY);
  return raw ? validateVoiceSpec(raw) : null;
}
export function loadPersistedDraft(): VoiceSpec | null { return readDraft(); }
function writeDraft(spec: VoiceSpec | null): void {
  if (spec) writeJSON(VOICE_DRAFT_KEY, spec); else clearKey(VOICE_DRAFT_KEY);
}
function readSystemId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(SYSTEM_KEY);
    return v && v in SYSTEMS ? v : null;
  } catch { return null; }
}
function writeSystemId(id: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(SYSTEM_KEY, id); } catch { /* quota */ }
}
function readActiveScales(): Record<string, string> {
  const raw = readJSON<Record<string, string>>(ACTIVE_SCALES_KEY);
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}
function writeActiveScales(m: Record<string, string>): void { writeJSON(ACTIVE_SCALES_KEY, m); }
function readCustomMaps(): Record<string, Record<string, CentsOverride>> {
  const raw = readJSON<Record<string, Record<string, CentsOverride>>>(CUSTOM_MAPS_KEY);
  return raw && typeof raw === 'object' ? raw : {};
}
function writeCustomMaps(m: Record<string, Record<string, CentsOverride>>): void { writeJSON(CUSTOM_MAPS_KEY, m); }
function readBool(key: string): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  } catch { return null; }
}
function writeBool(key: string, v: boolean): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, String(v)); } catch { /* quota */ }
}
function readNum(key: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
function writeNum(key: string, v: number): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, String(v)); } catch { /* quota */ }
}

function readOptionLock(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(OPTION_LOCK_KEY);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  } catch { return null; }
}
function writeOptionLock(v: boolean): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(OPTION_LOCK_KEY, String(v)); } catch { /* quota */ }
}

/** CustomMapExport — JSON shape for save/load (CustomIO).
 *  Cents-from-root values per (systemId, keyCode), or the deleted sentinel. */
export interface CustomMapExport {
  version: 2;
  customMaps: Record<string, Record<string, CentsOverride>>;
}

/** UI-facing slice of a layer. The audio data (notes + voice snapshots)
 *  lives in the transport module — this is just what the panel renders. */
export interface LayerUI {
  id: number;
  enabled: boolean;
  volume: number;
  state: LayerState;
  hasContent: boolean;
}

function buildInitialLayers(): LayerUI[] {
  return Array.from({ length: LAYER_COUNT }, (_, i) => ({
    id: i,
    enabled: true,
    volume: 0.8,
    state: 'empty' as LayerState,
    hasContent: false,
  }));
}

interface Store {
  // ---- musical state -----------------------------------------------------
  root: number;                                           // 0..11 pitch class (Western input)
  baseOctave: number;                                     // base octave register
  periodShift: number;                                    // -3..3, in periods (octave or tritave)
  systemId: string;                                       // active tuning system id
  mode: Mode;                                             // 'simple' | 'chromatic'
  activeScales: Record<string, string>;                   // per-system selected scale id
  optionLock: boolean;

  // ---- audio / playback state -------------------------------------------
  activeCodes: Set<string>;
  audioReady: boolean;

  // ---- per-key custom maps ----------------------------------------------
  // Outer key = systemId; inner key = keyboard event.code; value = cents from root,
  // or a "deleted" sentinel (silent in simple mode).
  customMaps: Record<string, Record<string, CentsOverride>>;

  // ---- voice editor / catalog -------------------------------------------
  voice: string;
  userVoices: Record<string, VoiceSpec>;
  voiceEditor: VoiceSpec | null;
  voiceEditorEditingId: string | null;

  // ---- per-key picker ----------------------------------------------------
  pickerArmed: boolean;
  pickerCode:  string | null;

  // ---- looper ------------------------------------------------------------
  looperEnabled:    boolean;   // whether the looper panel is shown at all
  looperOpen:       boolean;   // collapsible state of the panel
  bpm:              number;
  beatsPerBar:      number;
  barsPerLoop:      number;
  metronomeOn:      boolean;
  transportRunning: boolean;
  countInRemaining: number | null;  // 4..1 during count-in, null otherwise
  layers:           LayerUI[];
  recordingLayerId: number | null;

  // ---- mutators ----------------------------------------------------------
  setRoot:        (pitchClass: number) => void;
  shiftPeriod:    (delta: number) => void;
  setSystem:      (id: string) => void;
  setMode:        (m: Mode) => void;
  cycleScale:     () => void;
  noteOn:         (code: string) => void;
  noteOff:        (code: string) => void;
  allNotesOff:    () => void;
  toggleOptionLock: () => void;
  setAudioReady:    (ready: boolean) => void;

  hydrateFromStorage: () => void;

  setVoice:           (id: string) => void;
  openVoiceEditor:    (seed: VoiceSpec, editingId: string | null) => void;
  updateVoiceEditor:  (spec: VoiceSpec) => void;
  commitVoiceEditor:  () => string | null;
  closeVoiceEditor:   () => void;
  discardVoiceDraft:  () => void;
  deleteUserVoice:    (id: string) => void;

  setOverride:    (code: string, ov: CentsOverride) => void;
  clearOverride:  (code: string) => void;
  resetCustom:    () => void;
  loadCustom:     (data: CustomMapExport) => void;

  armPicker:      () => void;
  disarmPicker:   () => void;
  openPicker:     (code: string) => void;
  closePicker:    () => void;

  // looper
  setLooperEnabled:   (on: boolean) => void;
  setLooperOpen:      (on: boolean) => void;
  setBpm:             (bpm: number) => void;
  setMetronomeOn:     (on: boolean) => void;
  startTransport:     () => void;
  stopTransport:      () => void;
  armRecordLayer:     (layerId: number) => void;
  setLayerVolume:     (layerId: number, v: number) => void;
  setLayerEnabled:    (layerId: number, on: boolean) => void;
  clearLayer:         (layerId: number) => void;
  clearAllLayers:     () => void;
}

export const useStore = create<Store>((set) => ({
  root: 0,
  baseOctave: 3,
  periodShift: 0,
  systemId: 'hindustani',         // default — same family as the previous 'sruti'
  mode: 'simple',
  activeScales: {},               // populated from system defaults on hydration
  optionLock: true,
  activeCodes: new Set<string>(),
  audioReady: false,
  customMaps: {},
  voice: 'drone',
  userVoices: {},
  voiceEditor: null,
  voiceEditorEditingId: null,
  pickerArmed: false,
  pickerCode:  null,

  looperEnabled:    false,
  looperOpen:       true,
  bpm:              transport.TRANSPORT_DEFAULTS.bpm,
  beatsPerBar:      transport.TRANSPORT_DEFAULTS.beatsPerBar,
  barsPerLoop:      transport.TRANSPORT_DEFAULTS.barsPerLoop,
  metronomeOn:      true,
  transportRunning: false,
  countInRemaining: null,
  layers:           buildInitialLayers(),
  recordingLayerId: null,

  setRoot: (pitchClass) =>
    set({ root: ((pitchClass % 12) + 12) % 12 }),

  shiftPeriod: (delta) =>
    set((s) => {
      const n = s.periodShift + delta;
      if (n < -3 || n > 3) return {};
      return { periodShift: n };
    }),

  setSystem: (id) => {
    if (!(id in SYSTEMS)) return;
    writeSystemId(id);
    set({ systemId: id });
  },

  setMode: (mode) => set({ mode }),

  cycleScale: () =>
    set((s) => {
      const sys = lookupSystem(s.systemId);
      const cur = s.activeScales[s.systemId] ?? sys.defaultScale;
      const idx = sys.scales.findIndex((sc) => sc.id === cur);
      const next = sys.scales[(idx + 1) % sys.scales.length];
      const activeScales = { ...s.activeScales, [s.systemId]: next.id };
      writeActiveScales(activeScales);
      return { activeScales };
    }),

  noteOn: (code) =>
    set((s) => {
      if (s.activeCodes.has(code)) return {};
      const next = new Set(s.activeCodes);
      next.add(code);
      return { activeCodes: next };
    }),

  noteOff: (code) =>
    set((s) => {
      if (!s.activeCodes.has(code)) return {};
      const next = new Set(s.activeCodes);
      next.delete(code);
      return { activeCodes: next };
    }),

  allNotesOff: () =>
    set((s) => {
      if (s.activeCodes.size === 0) return {};
      return { activeCodes: new Set<string>() };
    }),

  toggleOptionLock: () =>
    set((s) => {
      const next = !s.optionLock;
      writeOptionLock(next);
      return { optionLock: next };
    }),

  setAudioReady: (ready) => set({ audioReady: ready }),

  hydrateFromStorage: () => {
    const userVoices   = readUserVoices();
    const pick         = readVoicePick();
    const systemId     = readSystemId();
    const optionLock   = readOptionLock();
    const activeScales = readActiveScales();
    const customMaps   = readCustomMaps();
    const looperEnabled = readBool(LOOPER_ENABLED_KEY);
    const bpm           = readNum(BPM_KEY);
    const metronomeOn   = readBool(METRONOME_KEY);
    // Mirror persisted BPM + metronome state into the transport engine.
    if (bpm !== null) transport.setConfig({ bpm });
    if (metronomeOn !== null) transport.setMetronomeEnabled(metronomeOn);
    set((s) => ({
      userVoices,
      voice:        pick ?? s.voice,
      systemId:     systemId ?? s.systemId,
      optionLock:   optionLock ?? s.optionLock,
      activeScales: Object.keys(activeScales).length ? activeScales : s.activeScales,
      customMaps,
      looperEnabled: looperEnabled ?? s.looperEnabled,
      bpm:           bpm ?? s.bpm,
      metronomeOn:   metronomeOn ?? s.metronomeOn,
    }));
  },

  setVoice: (id) => { writeVoicePick(id); set({ voice: id }); },

  openVoiceEditor: (seed, editingId) => {
    writeDraft(seed);
    set({ voiceEditor: seed, voiceEditorEditingId: editingId });
  },

  updateVoiceEditor: (spec) => {
    writeDraft(spec);
    set({ voiceEditor: spec });
  },

  commitVoiceEditor: () => {
    let outId: string | null = null;
    set((s) => {
      const draft = s.voiceEditor;
      if (!draft) return {};
      if (!draft.label.trim()) return {};
      if (!draft.id.trim()) return {};
      const id = draft.id;
      const next: VoiceSpec = { ...draft, id };
      const userVoices = { ...s.userVoices, [id]: next };
      writeUserVoices(userVoices);
      writeVoicePick(id);
      writeDraft(null);
      outId = id;
      return { userVoices, voice: id, voiceEditor: null, voiceEditorEditingId: null };
    });
    return outId;
  },

  closeVoiceEditor: () =>
    set({ voiceEditor: null, voiceEditorEditingId: null }),

  discardVoiceDraft: () => {
    writeDraft(null);
    set({ voiceEditor: null, voiceEditorEditingId: null });
  },

  deleteUserVoice: (id) =>
    set((s) => {
      if (!(id in s.userVoices)) return {};
      const userVoices = { ...s.userVoices };
      delete userVoices[id];
      writeUserVoices(userVoices);
      const voice = s.voice === id ? 'drone' : s.voice;
      if (voice !== s.voice) writeVoicePick(voice);
      writeDraft(null);
      return { userVoices, voice, voiceEditor: null, voiceEditorEditingId: null };
    }),

  setOverride: (code, ov) =>
    set((s) => {
      const cur = s.customMaps[s.systemId] ?? {};
      const nextSys = { ...cur, [code]: ov };
      const customMaps = { ...s.customMaps, [s.systemId]: nextSys };
      writeCustomMaps(customMaps);
      return { customMaps };
    }),

  clearOverride: (code) =>
    set((s) => {
      const cur = s.customMaps[s.systemId];
      if (!cur || !(code in cur)) return {};
      const nextSys = { ...cur };
      delete nextSys[code];
      const customMaps = { ...s.customMaps, [s.systemId]: nextSys };
      writeCustomMaps(customMaps);
      return { customMaps };
    }),

  resetCustom: () =>
    set((s) => {
      const customMaps = { ...s.customMaps, [s.systemId]: {} };
      writeCustomMaps(customMaps);
      return { customMaps };
    }),

  loadCustom: (data) => {
    if (!data || data.version !== 2 || typeof data.customMaps !== 'object') return;
    writeCustomMaps(data.customMaps);
    set({ customMaps: data.customMaps });
  },

  armPicker:    () => set({ pickerArmed: true }),
  disarmPicker: () => set({ pickerArmed: false }),
  openPicker:   (code) => set({ pickerCode: code, pickerArmed: false }),
  closePicker:  () => set({ pickerCode: null }),

  setLooperEnabled: (on) => {
    writeBool(LOOPER_ENABLED_KEY, on);
    // Turning off the looper stops the transport and clears everything.
    if (!on) {
      transport.stopTransport();
      transport.clearAllLayers();
      set({
        looperEnabled: false,
        transportRunning: false,
        countInRemaining: null,
        recordingLayerId: null,
        layers: buildInitialLayers(),
      });
    } else {
      set({ looperEnabled: true });
    }
  },

  setLooperOpen: (on) => set({ looperOpen: on }),

  setBpm: (bpm) => {
    const v = Math.max(30, Math.min(240, Math.round(bpm)));
    writeNum(BPM_KEY, v);
    transport.setConfig({ bpm: v });
    set({ bpm: v });
  },

  setMetronomeOn: (on) => {
    writeBool(METRONOME_KEY, on);
    transport.setMetronomeEnabled(on);
    set({ metronomeOn: on });
  },

  startTransport: () => transport.startTransport({ countIn: true }),
  stopTransport:  () => transport.stopTransport(),

  armRecordLayer: (layerId) => transport.armRecord(layerId),

  setLayerVolume: (layerId, v) => {
    transport.setLayerVolume(layerId, v);
    set((s) => ({
      layers: s.layers.map((L) => (L.id === layerId ? { ...L, volume: v } : L)),
    }));
  },

  setLayerEnabled: (layerId, on) => {
    transport.setLayerEnabled(layerId, on);
    set((s) => ({
      layers: s.layers.map((L) => (L.id === layerId ? { ...L, enabled: on } : L)),
    }));
  },

  clearLayer: (layerId) => {
    transport.clearLayer(layerId);
    set((s) => ({
      layers: s.layers.map((L) =>
        L.id === layerId ? { ...L, state: 'empty', hasContent: false } : L,
      ),
    }));
  },

  clearAllLayers: () => {
    transport.clearAllLayers();
    set({ layers: buildInitialLayers() });
  },
}));

// Bridge transport-engine events into the store so React renders update when
// recording transitions or the transport state changes. Set up once at module
// load — the store's a singleton, so this listener leaks for the page lifetime,
// which is correct.
if (typeof window !== 'undefined') {
  transport.subscribe((e) => {
    if (e.kind === 'transport-state') {
      useStore.setState({
        transportRunning: e.running,
        countInRemaining: e.running ? useStore.getState().countInRemaining : null,
      });
    } else if (e.kind === 'recording-armed') {
      useStore.setState((s) => ({
        recordingLayerId: e.layerId,
        layers: s.layers.map((L) =>
          L.id === e.layerId ? { ...L, state: 'armed', hasContent: false } : L,
        ),
      }));
    } else if (e.kind === 'recording-started') {
      useStore.setState((s) => ({
        recordingLayerId: e.layerId,
        countInRemaining: null,
        layers: s.layers.map((L) =>
          L.id === e.layerId ? { ...L, state: 'recording' } : L,
        ),
      }));
    } else if (e.kind === 'recording-finished') {
      useStore.setState((s) => ({
        recordingLayerId: null,
        layers: s.layers.map((L) =>
          L.id === e.layerId
            ? { ...L, state: e.hasContent ? 'looping' : 'empty', hasContent: e.hasContent }
            : L,
        ),
      }));
    } else if (e.kind === 'layer-cleared') {
      useStore.setState((s) => ({
        layers: s.layers.map((L) =>
          L.id === e.layerId ? { ...L, state: 'empty', hasContent: false } : L,
        ),
      }));
    } else if (e.kind === 'count-in-tick') {
      useStore.setState({ countInRemaining: e.remaining });
    }
    // beat-tick: components subscribe directly via transport.subscribe to
    // avoid Zustand re-renders at beat rate.
  });
}
