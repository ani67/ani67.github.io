import { create } from 'zustand';
import type { Mode, RagaName, ScaleName, Tuning } from '../lib/types';
import { nextScale } from '../lib/keymap/scales';
import { nextRaga } from '../lib/tuning/sruti';
import type { VoiceSpec } from '../lib/audio/voices';
import { validateUserVoicesRecord, validateVoiceSpec } from '../lib/audio/voices';

const USER_VOICES_KEY  = 'instrument:userVoices:v1';
const VOICE_PICK_KEY   = 'instrument:voice:v1';
const VOICE_DRAFT_KEY  = 'instrument:voiceDraft:v1';
const TUNING_KEY       = 'instrument:tuning:v1';
const OPTION_LOCK_KEY  = 'instrument:optionLock:v1';

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
// Public export so the picker can seed a new editor session from any draft
// the user previously had in flight (commit/discard clears it).
export function loadPersistedDraft(): VoiceSpec | null { return readDraft(); }
function writeDraft(spec: VoiceSpec | null): void {
  if (spec) writeJSON(VOICE_DRAFT_KEY, spec); else clearKey(VOICE_DRAFT_KEY);
}
function readTuning(): Tuning | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(TUNING_KEY);
    return v === '12tet' || v === 'sruti' ? v : null;
  } catch { return null; }
}
function writeTuning(t: Tuning): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(TUNING_KEY, t); } catch { /* quota */ }
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

export type TETOverride   = { kind: 'tet';   semitone: number } | { kind: 'tet';   deleted: true };
export type SrutiOverride = { kind: 'sruti'; sruti: number; octaves: number } | { kind: 'sruti'; deleted: true };

export interface CustomMapExport {
  version: 1;
  tet:   Record<string, TETOverride>;
  sruti: Record<string, SrutiOverride>;
}

interface Store {
  // State
  root: number;                                   // 0..11
  baseOctave: number;                             // MIDI octave of row-4 key 0 (the lowest key)
  octaveShift: number;                            // -3..3
  tuning: Tuning;
  mode: Mode;                                     // 'simple' | 'chromatic'
  chordScaleTET:   ScaleName;                     // context for chord + highlight in 12-TET
  chordScaleSruti: RagaName;                      // context for chord + highlight in Śruti
  voice: string;                                   // active voice id — built-in or user-created
  userVoices: Record<string, VoiceSpec>;           // user-created voices, keyed by id
  voiceEditor: VoiceSpec | null;                   // live draft — when non-null, overrides voice
  voiceEditorEditingId: string | null;             // id being edited (null = creating new)
  optionLock: boolean;                             // sticky ⌥ — chord modifier without holding Alt
  activeCodes: Set<string>;
  audioReady: boolean;
  // Per-key overrides — separate per tuning so each system has its own custom layout.
  customMapTET:   Record<string, TETOverride>;
  customMapSruti: Record<string, SrutiOverride>;
  // Picker — pickerArmed: next instrument key opens picker. pickerCode: which key's picker is open.
  pickerArmed: boolean;
  pickerCode:  string | null;

  // Mutators
  setRoot:                 (pitchClass: number) => void;
  shiftOctave:             (delta: number) => void;
  setTuning:               (t: Tuning) => void;
  setMode:                 (m: Mode) => void;
  noteOn:                  (code: string) => void;
  noteOff:                 (code: string) => void;
  allNotesOff:             () => void;
  cycleChordScaleTET:      () => void;
  cycleChordScaleSruti:    () => void;
  hydrateVoicesFromStorage:() => void;
  setVoice:                (id: string) => void;
  openVoiceEditor:         (seed: VoiceSpec, editingId: string | null) => void;
  updateVoiceEditor:       (spec: VoiceSpec) => void;
  commitVoiceEditor:       () => string | null;     // returns new id on success, null if invalid
  closeVoiceEditor:        () => void;              // keeps the persisted draft for restore
  discardVoiceDraft:       () => void;              // explicit discard — clears persistence
  deleteUserVoice:         (id: string) => void;
  toggleOptionLock:        () => void;
  setAudioReady:           (ready: boolean) => void;

  setOverride:    (code: string, override: TETOverride | SrutiOverride) => void;
  clearOverride:  (code: string) => void;
  resetCustom:    () => void;
  loadCustom:     (data: CustomMapExport) => void;

  armPicker:      () => void;
  disarmPicker:   () => void;
  openPicker:     (code: string) => void;
  closePicker:    () => void;
}

export const useStore = create<Store>((set) => ({
  root: 0,
  baseOctave: 3,       // row 4 key 0 = C3 by default → range C3..C6 across 37 steps
  octaveShift: 0,
  tuning: 'sruti',
  mode: 'simple',
  chordScaleTET:   'major',
  chordScaleSruti: 'yaman',
  // Defaults at module-init. localStorage hydration runs on mount —
  // see hydrateVoicesFromStorage() and its caller in Instrument.tsx — to
  // avoid hydration mismatches between SSR (window-undefined) and client.
  voice: 'drone',
  userVoices: {},
  voiceEditor: null,
  voiceEditorEditingId: null,
  optionLock: true,
  activeCodes: new Set<string>(),
  audioReady: false,
  customMapTET:   {},
  customMapSruti: {},
  pickerArmed: false,
  pickerCode:  null,

  setRoot: (pitchClass) =>
    set({ root: ((pitchClass % 12) + 12) % 12 }),

  shiftOctave: (delta) =>
    set((s) => {
      const n = s.octaveShift + delta;
      if (n < -3 || n > 3) return {};
      return { octaveShift: n };
    }),

  setTuning: (tuning) => { writeTuning(tuning); set({ tuning }); },
  setMode:   (mode)   => set({ mode }),

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

  cycleChordScaleTET: () =>
    set((s) => ({ chordScaleTET: nextScale(s.chordScaleTET) })),

  cycleChordScaleSruti: () =>
    set((s) => ({ chordScaleSruti: nextRaga(s.chordScaleSruti) })),

  hydrateVoicesFromStorage: () => {
    const userVoices = readUserVoices();
    const pick       = readVoicePick();
    const tuning     = readTuning();
    const optionLock = readOptionLock();
    set((s) => ({
      userVoices,
      voice:        pick ?? s.voice,
      tuning:       tuning ?? s.tuning,
      optionLock:   optionLock ?? s.optionLock,
    }));
    // Draft is NOT restored into voiceEditor on hydration — that would
    // auto-open the modal on every reload, which is wrong. It stays in
    // storage and gets used as the seed when the user clicks "Make your
    // own" via consumePersistedDraft().
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
      if (!draft.label.trim()) return {};   // require a name
      if (!draft.id.trim()) return {};      // require a slug
      const id = draft.id;
      const next: VoiceSpec = { ...draft, id };
      const userVoices = { ...s.userVoices, [id]: next };
      writeUserVoices(userVoices);
      writeVoicePick(id);
      writeDraft(null);                     // saved → draft cleared
      outId = id;
      return { userVoices, voice: id, voiceEditor: null, voiceEditorEditingId: null };
    });
    return outId;
  },

  // Close keeps the draft in storage so it auto-restores next session.
  closeVoiceEditor: () =>
    set({ voiceEditor: null, voiceEditorEditingId: null }),

  // Explicit user intent to throw the draft away — also closes the editor.
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
      // If the deleted voice was active, fall back to the default.
      const voice = s.voice === id ? 'drone' : s.voice;
      if (voice !== s.voice) writeVoicePick(voice);
      writeDraft(null);
      return { userVoices, voice, voiceEditor: null, voiceEditorEditingId: null };
    }),

  toggleOptionLock: () =>
    set((s) => {
      const next = !s.optionLock;
      writeOptionLock(next);
      return { optionLock: next };
    }),

  setAudioReady: (ready) => set({ audioReady: ready }),

  setOverride: (code, override) =>
    set((s) =>
      override.kind === 'tet'
        ? { customMapTET:   { ...s.customMapTET,   [code]: override } }
        : { customMapSruti: { ...s.customMapSruti, [code]: override } }
    ),

  clearOverride: (code) =>
    set((s) => {
      if (s.tuning === '12tet') {
        if (!(code in s.customMapTET)) return {};
        const next = { ...s.customMapTET };
        delete next[code];
        return { customMapTET: next };
      }
      if (!(code in s.customMapSruti)) return {};
      const next = { ...s.customMapSruti };
      delete next[code];
      return { customMapSruti: next };
    }),

  resetCustom: () => set({ customMapTET: {}, customMapSruti: {} }),

  loadCustom: (data) =>
    set({ customMapTET: { ...data.tet }, customMapSruti: { ...data.sruti } }),

  armPicker:    () => set({ pickerArmed: true }),
  disarmPicker: () => set({ pickerArmed: false }),
  openPicker:   (code) => set({ pickerCode: code, pickerArmed: false }),
  closePicker:  () => set({ pickerCode: null }),
}));
