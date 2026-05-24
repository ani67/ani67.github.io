import type { TuningSystem } from '../types';
import { makeWrappedNumericLabeler } from '../labelers';

// 31-tone equal temperament — each step ≈ 38.71¢. Notably *almost identical*
// to 1/4-comma meantone (the major thirds are within 0.5¢ of just). 31-EDO
// supports both traditional triads AND "neutral" triads (the in-between
// quarter-tone-flavoured thirds you get from sub-meantone steps).
const stepsCents = Array.from({ length: 31 }, (_, i) => i * 1200 / 31);

export const EDO31: TuningSystem = {
  id: 'edo31',
  label: '31-EDO',
  region: 'experimental',
  blurb: '31 equal divisions, meantone-precise',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    { id: 'major',      label: 'Major (meantone)', steps: [0,  5, 10, 13, 18, 23, 28] },
    { id: 'minor',      label: 'Natural Minor',    steps: [0,  5,  8, 13, 18, 21, 26] },
    { id: 'dorian',     label: 'Dorian',           steps: [0,  5,  8, 13, 18, 23, 26] },
    { id: 'lydian',     label: 'Lydian',           steps: [0,  5, 10, 15, 18, 23, 28] },
    { id: 'neutral',    label: 'Neutral diatonic', steps: [0,  5,  9, 13, 18, 22, 27] },   // neutral 3rd + 6th + 7th
  ],
  defaultScale: 'major',
  labeler: makeWrappedNumericLabeler(31),
  pcToStep: [0, 3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28],
  chord: { kind: 'triad' },
};
