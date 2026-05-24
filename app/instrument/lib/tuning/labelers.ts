import type { Labeler } from './types';

// ===========================================================================
// Western — used for 12-TET, Pythagorean, 5-limit JI, meantone, well-temperaments,
// any 12-step grid that uses Western letter names.
// ===========================================================================

const PITCH_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const PITCH_NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
// Root pitch classes that "belong to" flat keys (F, Bb, Eb, Ab, Db).
const PREFERS_FLATS = [false, true, false, true, false, true, false, false, true, false, true, false];

export const westernLabeler: Labeler = {
  id: 'western',
  labelStep(step, rootStep) {
    const useFlats = PREFERS_FLATS[((rootStep % 12) + 12) % 12];
    const names = useFlats ? PITCH_NAMES_FLAT : PITCH_NAMES_SHARP;
    return names[((step % 12) + 12) % 12];
  },
  withPeriodMark(base, periodOffset) {
    // Western octave numbers: rootStep at C → C4 is the canonical middle C.
    // The instrument's base register is 4; periodOffset shifts.
    return `${base}${4 + periodOffset}`;
  },
  periodName: 'octave',
};

// ===========================================================================
// Hindustani svara — fixed-Sa convention (Sa = C, re = C#, …).
// Labels at steps in the 22-śruti grid, shifted by where root sits.
// ===========================================================================

export const HINDUSTANI_SVARA_LABELS = [
  'Sa',  're↓', 're',  'Re↓', 'Re',
  'ga↓', 'ga',  'Ga',  'Ga↑', 'Ma',
  'Ma+', 'tMa', 'tMa↑','Pa',  'dha↓',
  'dha', 'Dha', 'Dha↑','ni↓', 'ni',
  'Ni',  'Ni↑',
] as const;

export const hindustaniLabeler: Labeler = {
  id: 'hindustani',
  labelStep(step, rootStep) {
    const N = HINDUSTANI_SVARA_LABELS.length;     // 22
    const inPeriod = ((step % N) + N) % N;
    const absSruti = ((inPeriod + rootStep) % N + N) % N;
    return HINDUSTANI_SVARA_LABELS[absSruti];
  },
  withPeriodMark(base, periodOffset) {
    if (periodOffset > 0) return `${base}′${periodOffset > 1 ? periodOffset : ''}`;
    if (periodOffset < 0) return `${base},${-periodOffset > 1 ? -periodOffset : ''}`;
    return base;
  },
  periodName: 'octave',
};

// ===========================================================================
// Carnatic svara — sapta swara with positional indices (Ri1/Ri2/Ri3,
// Ga1/Ga2/Ga3, Ma1/Ma2, Da1/Da2/Da3, Ni1/Ni2/Ni3). Mapped to the 22-śruti
// grid by the position in the mēḷakarta scheme.
// Two śrutis may share a label (the Carnatic system uses 16 named positions
// distributed over 22 grid steps, with some doubling).
// ===========================================================================

const CARNATIC_LABELS = [
  'S',   'R1',  'R1',  'R2',  'R2',
  'G2',  'G2',  'G3',  'G3',  'M1',
  'M1',  'M2',  'M2',  'P',   'D1',
  'D1',  'D2',  'D2',  'N2',  'N2',
  'N3',  'N3',
];

export const carnaticLabeler: Labeler = {
  id: 'carnatic',
  labelStep(step, rootStep) {
    const N = CARNATIC_LABELS.length;
    const inPeriod = ((step % N) + N) % N;
    const absSruti = ((inPeriod + rootStep) % N + N) % N;
    return CARNATIC_LABELS[absSruti];
  },
  withPeriodMark(base, periodOffset) {
    // Same ′ / , marks as Hindustani — common Indian convention
    if (periodOffset > 0) return `${base}′${periodOffset > 1 ? periodOffset : ''}`;
    if (periodOffset < 0) return `${base},${-periodOffset > 1 ? -periodOffset : ''}`;
    return base;
  },
  periodName: 'octave',
};

// ===========================================================================
// Arabic — note names of the maqam tradition. 24-EDO grid.
// Names follow the standard ascending row (Yegâh-style) for the 24 quarter-tones.
// Steps are 50¢ each; the half-flat/half-sharp positions get distinct names.
// ===========================================================================

// Each of 24 steps in 24-EDO. The base seven names (Rast, Dūkāh, Sīkāh, Jahārkāh,
// Nawā, Husaynī, Awj) sit on selected steps; quarter-tones in between get
// modified labels with half-sharp (♯/) or half-flat (♭/).
const ARABIC_LABELS = [
  'Rast',     'Rast♯/',   // 0, 50¢
  'Dūkāh♭/',  'Dūkāh',    // 100, 150¢
  'Sīkāh♭/',  'Sīkāh',    // 200, 250¢   ← neutral 3rd
  'Jahār♭/',  'Jahār',    // 300, 350¢
  'Jahār♯/',  'Nawā♭/',   // 400, 450¢
  'Nawā',     'Nawā♯/',   // 500, 550¢
  'Husay♭/',  'Husay',    // 600, 650¢
  'Awj♭/',    'Awj',      // 700, 750¢   ← neutral 6th
  'Awj♯/',    'Kard♭/',   // 800, 850¢
  'Kardān',   'Kard♯/',   // 900, 950¢
  'Muhay♭/',  'Muhay',    // 1000, 1050¢
  'Buzur♭/',  'Buzur',    // 1100, 1150¢
];

export const arabicLabeler: Labeler = {
  id: 'arabic',
  labelStep(step, rootStep) {
    const N = ARABIC_LABELS.length;
    const inPeriod = ((step % N) + N) % N;
    const abs = ((inPeriod + rootStep * 2) % N + N) % N;
    return ARABIC_LABELS[abs];
  },
  withPeriodMark(base, periodOffset) {
    if (periodOffset > 0) return `${base}′${periodOffset > 1 ? periodOffset : ''}`;
    if (periodOffset < 0) return `${base},${-periodOffset > 1 ? -periodOffset : ''}`;
    return base;
  },
  periodName: 'octave',
};

// ===========================================================================
// Thai — 7-EDO, no traditional pitch names. Use scale-degree numbers 1..7.
// ===========================================================================

export const thaiLabeler: Labeler = {
  id: 'thai',
  labelStep(step) {
    const inPeriod = ((step % 7) + 7) % 7;
    return String(inPeriod + 1);
  },
  withPeriodMark(base, periodOffset) {
    if (periodOffset > 0) return `${base}′${periodOffset > 1 ? periodOffset : ''}`;
    if (periodOffset < 0) return `${base},${-periodOffset > 1 ? -periodOffset : ''}`;
    return base;
  },
  periodName: 'octave',
};

// ===========================================================================
// Numeric — for systems without traditional pitch names (EDOs).
// Shows the 1-indexed step number wrapped within the period.
// ===========================================================================

export function makeWrappedNumericLabeler(stepsPerPeriod: number, periodName: string = 'octave'): Labeler {
  return {
    id: `numeric-${stepsPerPeriod}-${periodName}`,
    labelStep(step) {
      const inPeriod = ((step % stepsPerPeriod) + stepsPerPeriod) % stepsPerPeriod;
      return String(inPeriod + 1);
    },
    withPeriodMark(base, periodOffset) {
      if (periodOffset > 0) return `${base}′${periodOffset > 1 ? periodOffset : ''}`;
      if (periodOffset < 0) return `${base},${-periodOffset > 1 ? -periodOffset : ''}`;
      return base;
    },
    periodName,
  };
}

// ===========================================================================
// Gamelan — Javanese kepatihan notation. Slendro uses 1-2-3-5-6 (no 4 and 7);
// pelog uses 1-2-3-4-5-6-7 with cultural omissions per scale.
// ===========================================================================

const SLENDRO_LABELS = ['1', '2', '3', '5', '6'];   // gangsa numbering
export const gamelanSlendroLabeler: Labeler = {
  id: 'gamelan-slendro',
  labelStep(step) {
    const inPeriod = ((step % 5) + 5) % 5;
    return SLENDRO_LABELS[inPeriod];
  },
  withPeriodMark(base, periodOffset) {
    if (periodOffset > 0) return `${base}′${periodOffset > 1 ? periodOffset : ''}`;
    if (periodOffset < 0) return `${base},${-periodOffset > 1 ? -periodOffset : ''}`;
    return base;
  },
  periodName: 'octave',
};

const PELOG_LABELS = ['1', '2', '3', '4', '5', '6', '7'];
export const gamelanPelogLabeler: Labeler = {
  id: 'gamelan-pelog',
  labelStep(step) {
    const inPeriod = ((step % 7) + 7) % 7;
    return PELOG_LABELS[inPeriod];
  },
  withPeriodMark(base, periodOffset) {
    if (periodOffset > 0) return `${base}′${periodOffset > 1 ? periodOffset : ''}`;
    if (periodOffset < 0) return `${base},${-periodOffset > 1 ? -periodOffset : ''}`;
    return base;
  },
  periodName: 'octave',
};

// ===========================================================================
// Helper for a system to compose a Western reference label off any grid step
// (used by Key.tsx to render the small greyed Western pitch under a non-Western
// label). Returns "C4", "Eb5", etc. given absolute cents from C0 and the root pc.
// ===========================================================================

const SEMITONE_CENTS = 100;

export function westernReferenceFromCents(absCentsFromRoot: number, rootPc: number, baseOctave: number): string {
  // 12-TET cent grid relative to absolute pitch class 0 (C of some octave).
  // The instrument's root sits at midi = 12*(baseOctave+1) + rootPc. We convert
  // the cent offset to a MIDI note and round.
  const rootMidi = 12 * (baseOctave + 1) + ((rootPc % 12) + 12) % 12;
  const targetMidi = rootMidi + absCentsFromRoot / SEMITONE_CENTS;
  const rounded = Math.round(targetMidi);
  const pc = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  const useFlats = PREFERS_FLATS[((rootPc % 12) + 12) % 12];
  const names = useFlats ? PITCH_NAMES_FLAT : PITCH_NAMES_SHARP;
  return `${names[pc]}${octave}`;
}
