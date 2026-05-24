import type { TuningSystem } from '../types';
import { gamelanSlendroLabeler } from '../labelers';

// Indonesian gamelan slendro — 5 nearly-equal divisions of the octave.
// Real gamelans tune slightly differently (no universal slendro), but the
// theoretical idealization is 5-EDO: each step = 240¢. Notation uses
// numbers 1, 2, 3, 5, 6 (omitting 4 and 7 — a Javanese convention).

const stepsCents = Array.from({ length: 5 }, (_, i) => i * 1200 / 5);

export const SLENDRO: TuningSystem = {
  id: 'slendro',
  label: 'Gamelan Slendro',
  region: 'southeast-asian',
  blurb: '5 equal divisions per octave',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    // The slendro system effectively *is* its scale — all 5 notes are used.
    { id: 'all',  label: 'Slendro',       steps: [0, 1, 2, 3, 4] },
    // Common pathet (mode) — barang miring style, omits one note.
    { id: 'nem',  label: 'Slendro Nem',   steps: [0, 1, 2, 3] },
    { id: 'sanga', label: 'Slendro Sanga', steps: [0, 1, 3, 4] },
  ],
  defaultScale: 'all',
  labeler: gamelanSlendroLabeler,
  // Western pc → nearest 5-EDO step. Very rough; gamelan doesn't map to Western
  // pitch classes meaningfully, but we need some default.
  pcToStep: [0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4],
  // Gamelan ensembles play heterophonically — octave doubling is the texture.
  chord: { kind: 'octaves', offsets: [0, -1] },
};
