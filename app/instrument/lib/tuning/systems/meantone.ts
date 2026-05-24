import type { TuningSystem } from '../types';
import { westernLabeler } from '../labelers';

// 1/4-comma meantone temperament — used in European keyboard music from the
// late Renaissance through the early Baroque. Every fifth is tempered slightly
// flat (696.578¢ instead of pure 702¢) so that four stacked fifths land
// *exactly* on a pure 5:4 major third (386.314¢). Result: triads in close
// keys (C, F, G, D) sound *sweet* and beat-free; distant keys (F#, C#, B)
// sound progressively worse because of the accumulated tempering.
//
// The 12-tone version arbitrarily picks accidentals: sharps for C#-F#-G#,
// flats for Eb-Bb. The "wolf fifth" between G# and Eb is the price.
const stepsCents = [
  0,        // C
  76.049,   // C#
  193.157,  // D
  310.265,  // Eb
  386.314,  // E    (pure 5:4 major third)
  503.422,  // F
  579.471,  // F#
  696.578,  // G    (the tempered fifth)
  772.627,  // G#
  889.735,  // A
  1006.843, // Bb
  1082.892, // B
];

export const MEANTONE: TuningSystem = {
  id: 'meantone',
  label: 'Meantone',
  region: 'western-historical',
  blurb: '1/4-comma — pure major thirds',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    { id: 'major',      label: 'Major',         steps: [0, 2, 4, 5, 7, 9, 11] },
    { id: 'minor',      label: 'Natural Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
    { id: 'dorian',     label: 'Dorian',        steps: [0, 2, 3, 5, 7, 9, 10] },
    { id: 'mixolydian', label: 'Mixolydian',    steps: [0, 2, 4, 5, 7, 9, 10] },
    { id: 'lydian',     label: 'Lydian',        steps: [0, 2, 4, 6, 7, 9, 11] },
  ],
  defaultScale: 'major',
  labeler: westernLabeler,
  pcToStep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  chord: { kind: 'triad' },
};
