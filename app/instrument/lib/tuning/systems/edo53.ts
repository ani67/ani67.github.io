import type { TuningSystem } from '../types';
import { makeWrappedNumericLabeler } from '../labelers';

// 53-tone equal temperament (pure microtonal, distinct from the Turkish makam
// system which also uses 53 divisions but with culturally-specific scales).
// Each step ≈ 22.642¢ — fine enough to closely approximate both Pythagorean
// (3-limit) and 5-limit just-intonation intervals simultaneously. Some
// xenharmonic composers consider this the most "perfect" practical EDO.
const stepsCents = Array.from({ length: 53 }, (_, i) => i * 1200 / 53);

export const EDO53: TuningSystem = {
  id: 'edo53',
  label: '53-EDO',
  region: 'experimental',
  blurb: '53 equal — JI + Pythagorean',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    // Diatonic 9-9-4-9-9-9-4 pattern (Holdrian commas) — sounds Pythagorean-pure
    { id: 'major', label: 'Major (Pythag-pure)', steps: [0,  9, 18, 22, 31, 40, 49] },
    { id: 'minor', label: 'Minor',               steps: [0,  9, 13, 22, 31, 35, 44] },
    { id: 'just-major', label: 'Just Major (5-limit)', steps: [0,  9, 17, 22, 31, 40, 48] },   // sweeter 3rd/6th
    { id: 'just-minor', label: 'Just Minor (5-limit)', steps: [0,  9, 14, 22, 31, 36, 44] },
  ],
  defaultScale: 'major',
  labeler: makeWrappedNumericLabeler(53),
  pcToStep: [0, 4, 9, 13, 18, 22, 27, 31, 36, 40, 44, 49],
  chord: { kind: 'triad' },
};
