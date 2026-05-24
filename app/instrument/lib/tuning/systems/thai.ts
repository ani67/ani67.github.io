import type { TuningSystem } from '../types';
import { thaiLabeler } from '../labelers';

// Thai classical music — 7-tone equal temperament. The octave is divided
// into exactly 7 equal steps of 1200/7 ≈ 171.43¢. Sounds *floating* and
// neutral because there are no semitones or whole-tones in the Western sense
// — every interval is the same mid-sized step.
//
// In Thai practice the system effectively *is* its own scale (7 evenly
// spaced pitches), so there's only one "scale" to cycle through.
const stepsCents = Array.from({ length: 7 }, (_, i) => i * 1200 / 7);

export const THAI: TuningSystem = {
  id: 'thai',
  label: 'Thai',
  region: 'southeast-asian',
  blurb: '7 equal divisions per octave',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    { id: 'all',   label: '7-equal',  steps: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'penta', label: 'Pentatonic', steps: [0, 1, 3, 4, 5] },   // common 5-note subset
  ],
  defaultScale: 'all',
  labeler: thaiLabeler,
  // Western pc → nearest 7-EDO step (rough approximation; Thai doesn't really
  // correspond to Western pitch classes).
  pcToStep: [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6],
  // Thai classical ensembles play heterophonically — the same melody at
  // multiple octaves. Octave doubling under chord-on captures that texture.
  chord: { kind: 'octaves', offsets: [0, -1] },
};
