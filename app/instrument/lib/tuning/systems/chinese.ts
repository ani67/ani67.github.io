import type { TuningSystem } from '../types';
import { westernLabeler } from '../labelers';

// Chinese pentatonic — modern practice uses 12-TET. Five-tone modes
// (gōng-diào) are named after their starting scale degree:
//   gōng 宫  — major-flavoured pentatonic
//   shāng 商 — Dorian-flavoured
//   jué 角   — minor-flavoured
//   zhǐ 徵   — Mixolydian-flavoured
//   yǔ 羽    — minor-flavoured (alternative shape)
const stepsCents = Array.from({ length: 12 }, (_, i) => i * 100);

export const CHINESE: TuningSystem = {
  id: 'chinese',
  label: 'Chinese Pentatonic',
  region: 'east-asian',
  blurb: 'gōng-diào 5-tone modes',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    { id: 'gong',   label: 'Gōng (宫)',  steps: [0, 2, 4, 7, 9] },
    { id: 'shang',  label: 'Shāng (商)', steps: [0, 2, 5, 7, 10] },
    { id: 'jue',    label: 'Jué (角)',   steps: [0, 3, 5, 8, 10] },
    { id: 'zhi',    label: 'Zhǐ (徵)',   steps: [0, 2, 5, 7, 10] },
    { id: 'yu',     label: 'Yǔ (羽)',    steps: [0, 3, 5, 7, 10] },
  ],
  defaultScale: 'gong',
  labeler: westernLabeler,
  pcToStep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  // Chinese folk/classical music is largely heterophonic — octave doubling
  // captures the ensemble texture better than imposed Western harmony.
  chord: { kind: 'octaves', offsets: [0, -1] },
};
