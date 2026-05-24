import type { TuningSystem } from '../types';
import { westernLabeler } from '../labelers';

// 12-tone equal temperament — every step is exactly 100¢, one octave = 1200¢.
// Each Western diatonic scale becomes a 7-step subset; modal scales are
// rotations of major. Blues/whole-tone/diminished round out the catalog.
const stepsCents = Array.from({ length: 12 }, (_, i) => i * 100);

export const TWELVE_TET: TuningSystem = {
  id: '12tet',
  label: '12-TET',
  region: 'western-modern',
  blurb: 'Western, equal-tempered',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    { id: 'major',      label: 'Major',         steps: [0, 2, 4, 5, 7, 9, 11] },
    { id: 'minor',      label: 'Natural Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
    { id: 'sus',        label: 'Suspended',     steps: [0, 2, 5, 7, 9]        },
    { id: 'dorian',     label: 'Dorian',        steps: [0, 2, 3, 5, 7, 9, 10] },
    { id: 'lydian',     label: 'Lydian',        steps: [0, 2, 4, 6, 7, 9, 11] },
    { id: 'mixolydian', label: 'Mixolydian',    steps: [0, 2, 4, 5, 7, 9, 10] },
    { id: 'blues',      label: 'Blues',         steps: [0, 3, 5, 6, 7, 10]    },
    { id: 'diminished', label: 'Diminished',    steps: [0, 1, 3, 4, 6, 7, 9, 10] },
    { id: 'wholeTone',  label: 'Whole Tone',    steps: [0, 2, 4, 6, 8, 10]    },
  ],
  defaultScale: 'major',
  labeler: westernLabeler,
  pcToStep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  chord: { kind: 'triad' },   // Western tertian harmony — stack of thirds
};
