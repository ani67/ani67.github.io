import { create } from 'zustand';
import type { Mode, RagaName, ScaleName, Tuning } from '../lib/types';
import { nextScale } from '../lib/keymap/scales';
import { nextRaga } from '../lib/tuning/sruti';

interface Store {
  // State
  root: number;                                   // 0..11
  baseOctave: number;                             // MIDI octave of row-4 key 0 (the lowest key)
  octaveShift: number;                            // -3..3
  tuning: Tuning;
  mode: Mode;                                     // 'simple' | 'chromatic'
  chordScaleTET:   ScaleName;                     // context for chord + highlight in 12-TET
  chordScaleSruti: RagaName;                      // context for chord + highlight in Śruti
  optionLock: boolean;                             // sticky ⌥ — chord modifier without holding Alt
  activeCodes: Set<string>;
  audioReady: boolean;

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
  toggleOptionLock:        () => void;
  setAudioReady:           (ready: boolean) => void;
}

export const useStore = create<Store>((set) => ({
  root: 0,
  baseOctave: 3,       // row 4 key 0 = C3 by default → range C3..C6 across 37 steps
  octaveShift: 0,
  tuning: 'sruti',
  mode: 'simple',
  chordScaleTET:   'major',
  chordScaleSruti: 'yaman',
  optionLock: false,
  activeCodes: new Set<string>(),
  audioReady: false,

  setRoot: (pitchClass) =>
    set({ root: ((pitchClass % 12) + 12) % 12 }),

  shiftOctave: (delta) =>
    set((s) => {
      const n = s.octaveShift + delta;
      if (n < -3 || n > 3) return {};
      return { octaveShift: n };
    }),

  setTuning: (tuning) => set({ tuning }),
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

  toggleOptionLock: () => set((s) => ({ optionLock: !s.optionLock })),

  setAudioReady: (ready) => set({ audioReady: ready }),
}));
