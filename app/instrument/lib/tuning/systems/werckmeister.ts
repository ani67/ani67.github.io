import type { TuningSystem } from '../types';
import { westernLabeler } from '../labelers';

// Werckmeister III — a well-temperament (1691, Andreas Werckmeister).
// Unlike equal temperament, each key has a slightly *different character*:
// close keys (C, F, G) sound mostly-pure; distant keys (F#, C#) have more
// audible tempering. This is the kind of tuning that Bach's "Well-Tempered
// Clavier" was written to explore — each prelude/fugue exploits the unique
// flavour of its key.
//
// Cents are specific (not equal-divisions) — calculated from Werckmeister's
// recipe of distributing the Pythagorean comma across four fifths.
const stepsCents = [
  0,        // C
  90.225,   // C#
  192.180,  // D
  294.135,  // Eb
  390.225,  // E
  498.045,  // F
  588.270,  // F#
  696.090,  // G
  792.180,  // G#
  888.270,  // A
  996.090,  // Bb
  1092.180, // B
];

export const WERCKMEISTER: TuningSystem = {
  id: 'werckmeister',
  label: 'Werckmeister III',
  region: 'western-historical',
  blurb: 'well-temperament, each key unique',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    { id: 'major',      label: 'Major',         steps: [0, 2, 4, 5, 7, 9, 11] },
    { id: 'minor',      label: 'Natural Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
    { id: 'dorian',     label: 'Dorian',        steps: [0, 2, 3, 5, 7, 9, 10] },
    { id: 'lydian',     label: 'Lydian',        steps: [0, 2, 4, 6, 7, 9, 11] },
    { id: 'mixolydian', label: 'Mixolydian',    steps: [0, 2, 4, 5, 7, 9, 10] },
    { id: 'phrygian',   label: 'Phrygian',      steps: [0, 1, 3, 5, 7, 8, 10] },
  ],
  defaultScale: 'major',
  labeler: westernLabeler,
  pcToStep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  chord: { kind: 'triad' },
};
