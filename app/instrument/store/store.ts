import { create } from 'zustand';
import type { Mode } from '../lib/types';
import type { VoiceSpec } from '../lib/audio/voices';
import { validateUserVoicesRecord, validateVoiceSpec } from '../lib/audio/voices';
import { SYSTEMS, lookupSystem } from '../lib/tuning';

export type CentsOverride = number | { deleted: true };

const USER_VOICES_KEY  = 'instrument:userVoices:v1';
const VOICE_PICK_KEY   = 'instrument:voice:v1';
const VOICE_DRAFT_KEY  = 'instrument:voiceDraft:v1';
const SYSTEM_KEY       = 'instrument:systemId:v2';   // v2: was 'tuning:v1' before the refactor
const OPTION_LOCK_KEY  = 'instrument:optionLock:v1';
const ACTIVE_SCALES_KEY = 'instrument:activeScales:v1';
const CUSTOM_MAPS_KEY  = 'instrument:customMaps:v1';

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
    set((s) => ({
      userVoices,
      voice:        pick ?? s.voice,
      systemId:     systemId ?? s.systemId,
      optionLock:   optionLock ?? s.optionLock,
      activeScales: Object.keys(activeScales).length ? activeScales : s.activeScales,
      customMaps,
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
}));
