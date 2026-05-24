import type { TuningSystem } from '../types';
import { gamelanPelogLabeler } from '../labelers';

// Indonesian gamelan pelog — 7 unequal divisions per octave. The intervals
// vary between gamelans; these are typical Central-Javanese-style values.
// Approximate cents from tonic: 0, 120, 260, 540, 680, 800, 1050 (and 1200).
// Note the large step between 3rd and 4th positions (~280¢), and the small
// steps elsewhere — this asymmetry is the "feel" of pelog.

const stepsCents = [0, 120, 270, 540, 670, 800, 1050];

export const PELOG: TuningSystem = {
  id: 'pelog',
  label: 'Gamelan Pelog',
  region: 'southeast-asian',
  blurb: '7 unequal divisions per octave',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    // Common pathet (modes) — different 5-note subsets of the 7-tone grid.
    { id: 'bem',     label: 'Pelog Bem',     steps: [0, 1, 2, 4, 5] },   // 1,2,3,5,6
    { id: 'barang',  label: 'Pelog Barang',  steps: [0, 1, 3, 4, 6] },   // 1,2,4,5,7
    { id: 'lima',    label: 'Pelog Lima',    steps: [0, 1, 2, 4, 5] },
    { id: 'all',     label: 'Pelog (all 7)', steps: [0, 1, 2, 3, 4, 5, 6] },
  ],
  defaultScale: 'bem',
  labeler: gamelanPelogLabeler,
  pcToStep: [0, 1, 1, 1, 2, 3, 3, 4, 5, 5, 6, 6],
  chord: { kind: 'octaves', offsets: [0, -1] },
};
