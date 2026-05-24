import type { TuningSystem } from '../types';
import { makeWrappedNumericLabeler } from '../labelers';

// 19-tone equal temperament — each step ≈ 63.16¢. Notable property: very
// close to 1/3-comma meantone, with even *sweeter* major thirds than 12-TET
// (379¢ vs 12-TET's 400¢ vs pure 386¢). Some xenharmonic composers prefer it.
const stepsCents = Array.from({ length: 19 }, (_, i) => i * 1200 / 19);

export const EDO19: TuningSystem = {
  id: 'edo19',
  label: '19-EDO',
  region: 'experimental',
  blurb: '19 equal divisions, meantone-like',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    // 19-EDO diatonic major — rounds the 12-TET intervals to 19-EDO steps.
    { id: 'major', label: 'Major',         steps: [0,  3,  6,  8, 11, 14, 17] },
    { id: 'minor', label: 'Natural Minor', steps: [0,  3,  5,  8, 11, 13, 16] },
    { id: 'dorian',     label: 'Dorian',     steps: [0,  3,  5,  8, 11, 14, 16] },
    { id: 'lydian',     label: 'Lydian',     steps: [0,  3,  6, 10, 11, 14, 17] },
    { id: 'mixolydian', label: 'Mixolydian', steps: [0,  3,  6,  8, 11, 14, 16] },
  ],
  defaultScale: 'major',
  labeler: makeWrappedNumericLabeler(19),
  pcToStep: [0, 2, 3, 5, 6, 8, 9, 11, 13, 14, 16, 17],
  chord: { kind: 'triad' },
};
