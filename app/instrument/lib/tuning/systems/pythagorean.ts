import type { TuningSystem } from '../types';
import { westernLabeler } from '../labelers';

// Pythagorean tuning — every interval is built by stacking pure perfect fifths
// (3:2) and reducing into one octave. The major third becomes 81:64 (≈408¢)
// instead of 12-TET's 400¢ — slightly *brighter*, almost shrill. Used in
// European medieval music and most music theory before the Renaissance.
//
// Ratios for the 12 chromatic positions, expressed as 3-limit fractions:
const ratios: readonly number[] = [
  1/1,        // P1   C
  256/243,    // m2   C#  (Pythagorean limma)
  9/8,        // M2   D
  32/27,      // m3   D#
  81/64,      // M3   E   (Pythagorean major 3rd — brighter than just)
  4/3,        // P4   F
  729/512,    // A4   F#  (Pythagorean tritone)
  3/2,        // P5   G
  128/81,     // m6   G#
  27/16,      // M6   A
  16/9,       // m7   A#
  243/128,    // M7   B   (Pythagorean leading tone — very sharp)
];
const stepsCents = ratios.map((r) => 1200 * Math.log2(r));

export const PYTHAGOREAN: TuningSystem = {
  id: 'pythagorean',
  label: 'Pythagorean',
  region: 'western-historical',
  blurb: 'Medieval Europe, pure fifths',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    { id: 'major',      label: 'Major',         steps: [0, 2, 4, 5, 7, 9, 11] },
    { id: 'minor',      label: 'Natural Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
    { id: 'dorian',     label: 'Dorian',        steps: [0, 2, 3, 5, 7, 9, 10] },
    { id: 'mixolydian', label: 'Mixolydian',    steps: [0, 2, 4, 5, 7, 9, 10] },
    { id: 'phrygian',   label: 'Phrygian',      steps: [0, 1, 3, 5, 7, 8, 10] },
    { id: 'lydian',     label: 'Lydian',        steps: [0, 2, 4, 6, 7, 9, 11] },
  ],
  defaultScale: 'major',
  labeler: westernLabeler,
  pcToStep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  chord: { kind: 'triad' },   // Western tertian harmony (Pythagorean tuning)
};
