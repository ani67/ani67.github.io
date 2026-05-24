import type { TuningSystem } from '../types';
import { arabicLabeler } from '../labelers';

// 24-tone equal temperament — each Western semitone split in half. The
// quarter-tone steps (50¢, 150¢, 250¢, …) are where the neutral seconds,
// neutral thirds, and neutral sixths of Arabic maqam tradition live.

const stepsCents = Array.from({ length: 24 }, (_, i) => i * 50);

// Maqam interval recipe (in 50¢ units, so quarter-tones are 1):
//   1 = quarter-tone
//   2 = semitone (100¢)
//   3 = three-quarter (150¢) — the "neutral second"
//   4 = whole tone (200¢)
//   6 = augmented second (300¢)
//
// Bayāti:  3-3-4-2-3-4 (neutral 2 + 3rd, perfect 4th, half-tone, neutral 6th, b7)
// Rāst:    4-3-3-4-4-3-3 — equivalent to a "neutral major" with half-flat 3rd + 7th
// Hijāz:   2-6-2-4-2-4-2 — flat 2nd, augmented 2nd between 2-3
// Saba:    3-3-2-2-6 — short scale with augmented 2nd
// Nahawand: 4-2-4-4-2-4-4 — Western harmonic minor relative
// Kurd:    2-4-4-4-2-4-4 — Phrygian-flavoured
// Ushshaq: 4-3-3-4-4-3-3 — variant of Rast/Bayati family
//
// We translate the recipe into step indices in 24-EDO.
function fromIntervals(intervals: number[]): number[] {
  const out: number[] = [0];
  let acc = 0;
  for (const i of intervals) { acc += i; if (acc < 24) out.push(acc); }
  return out;
}

export const ARAB: TuningSystem = {
  id: 'arab',
  label: 'Arab Maqam',
  region: 'middle-eastern',
  blurb: '24 quarter-tones per octave',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    // Canonical maqam intervals (50¢ units of 24-EDO):
    //   3 = neutral 2nd (150¢) — the characteristic Arab quarter-tone
    //   4 = whole tone (200¢)
    //   2 = semitone (100¢)
    //   6 = augmented 2nd (300¢) — the Hijāz / Saba gesture
    { id: 'bayati',   label: 'Bayātī',   steps: fromIntervals([3, 3, 4, 4, 3, 4, 3]) },   // neutral-2 + min-3 + P4 + P5 + neutral-6 + b7
    { id: 'rast',     label: 'Rāst',     steps: fromIntervals([4, 3, 3, 4, 4, 3, 3]) },   // major with neutral-3 + neutral-7
    { id: 'hijaz',    label: 'Hijāz',    steps: fromIntervals([2, 6, 2, 4, 2, 6, 2]) },   // b2 + aug-2 + P4 + P5 + b6 + nat-7
    { id: 'saba',     label: 'Saba',     steps: fromIntervals([3, 3, 2, 4, 3, 5, 4]) },   // neutral-2 + min-3 + dim-4 + neutral-5 ... (Saba is famously asymmetric)
    { id: 'nahawand', label: 'Nahāwand', steps: fromIntervals([4, 2, 4, 4, 2, 6, 2]) },   // harmonic minor — nat-2 + b3 + P4 + P5 + b6 + nat-7
    { id: 'kurd',     label: 'Kurd',     steps: fromIntervals([2, 4, 4, 4, 2, 4, 4]) },   // Phrygian — b2 + b3 + P4 + P5 + b6 + b7
    { id: 'ushshaq',  label: 'Ushshāq',  steps: fromIntervals([4, 3, 3, 4, 4, 3, 3]) },   // Rast family — ascending form
    { id: 'sikah',    label: 'Sīkāh',    steps: fromIntervals([3, 4, 4, 3, 4, 3, 3]) },   // built on the neutral-3rd as tonic
  ],
  defaultScale: 'bayati',
  labeler: arabicLabeler,
  // Western pc → 24-EDO grid step. C maps to 0; semitones double-spaced.
  pcToStep: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
  // Arab maqam is melodic; accompaniment is the tonic-fifth drone (Rast + Nawā).
  chord: { kind: 'drone', steps: [0, 14] },
};
