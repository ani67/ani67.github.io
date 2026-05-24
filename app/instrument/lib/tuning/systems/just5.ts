import type { TuningSystem } from '../types';
import { westernLabeler } from '../labelers';

// 5-limit Just Intonation — small-integer ratios involving primes 2, 3, 5
// only. Triads sound *exactly in tune* (no beating) because the 5:4 major
// third and 6:5 minor third are exact. The cost: you can only play
// in-tune in one key at a time — distant key modulations require re-tuning.
//
// Used in Renaissance vocal polyphony (where singers naturally tune to JI),
// modern barbershop quartets, and most "pure intonation" demonstrations.
const ratios: readonly number[] = [
  1/1,        // P1   C
  16/15,      // m2   C#  (just minor 2nd)
  9/8,        // M2   D
  6/5,        // m3   D#  (just minor 3rd)
  5/4,        // M3   E   (just major 3rd — the "sweet" third)
  4/3,        // P4   F
  45/32,      // A4   F#  (just augmented 4th)
  3/2,        // P5   G
  8/5,        // m6   G#  (just minor 6th)
  5/3,        // M6   A   (just major 6th)
  9/5,        // m7   A#
  15/8,       // M7   B   (just major 7th)
];
const stepsCents = ratios.map((r) => 1200 * Math.log2(r));

export const JUST_5: TuningSystem = {
  id: 'just5',
  label: 'Just Intonation',
  region: 'western-historical',
  blurb: 'Renaissance pure ratios',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    { id: 'major',      label: 'Major',         steps: [0, 2, 4, 5, 7, 9, 11] },
    { id: 'minor',      label: 'Natural Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
    { id: 'dorian',     label: 'Dorian',        steps: [0, 2, 3, 5, 7, 9, 10] },
    { id: 'lydian',     label: 'Lydian',        steps: [0, 2, 4, 6, 7, 9, 11] },
    { id: 'mixolydian', label: 'Mixolydian',    steps: [0, 2, 4, 5, 7, 9, 10] },
  ],
  defaultScale: 'major',
  labeler: westernLabeler,
  pcToStep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  chord: { kind: 'triad' },   // Western tertian harmony (in just intonation)
};
