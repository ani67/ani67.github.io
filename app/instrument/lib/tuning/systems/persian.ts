import type { TuningSystem } from '../types';
import { arabicLabeler } from '../labelers';

// Persian dastgah — uses the same 24-EDO quarter-tone grid as Arab maqam,
// but with a distinct repertoire of modes (dastgah-ha) and Persian-specific
// accidentals (koron ≈ -50¢, sori ≈ +50¢). The grid is the same; the scales
// and modal contexts differ. We use the Arabic labeler since the quarter-
// tone notation conventions overlap.

const stepsCents = Array.from({ length: 24 }, (_, i) => i * 50);

// Convert interval recipe (in 50¢ units) into 24-EDO step indices.
function fromIntervals(intervals: number[]): number[] {
  const out: number[] = [0];
  let acc = 0;
  for (const i of intervals) { acc += i; if (acc < 24) out.push(acc); }
  return out;
}

export const PERSIAN: TuningSystem = {
  id: 'persian',
  label: 'Persian Dastgah',
  region: 'middle-eastern',
  blurb: 'Iranian classical, 12 dastgāh',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    { id: 'shur',         label: 'Shur',          steps: fromIntervals([3, 3, 4, 4, 3, 4, 3]) },   // tonic-neutral-2-min-3-P4-P5-neutral-6-b7
    { id: 'mahur',        label: 'Māhur',         steps: fromIntervals([4, 4, 2, 4, 4, 4, 2]) },   // ≈ Western major
    { id: 'homayoun',     label: 'Homāyoun',      steps: fromIntervals([2, 6, 2, 4, 2, 6, 2]) },   // b2 + aug-2 (Hijaz-flavoured)
    // Segāh has its tonic on the *neutral 3rd* of Rast. Standard intervals:
    // 0, 200, 350, 500, 700, 850, 1050 (≈ Western minor with neutral 3rd shift).
    { id: 'segah',        label: 'Segāh',         steps: fromIntervals([4, 3, 3, 4, 3, 4, 3]) },
    { id: 'chahargah',    label: 'Chahārgāh',     steps: fromIntervals([2, 6, 2, 4, 2, 6, 2]) },   // same scale as Homāyoun (differentiated by sayr/phrasing)
    { id: 'nava',         label: 'Nava',          steps: fromIntervals([4, 2, 4, 4, 4, 2, 4]) },   // Dorian-flavoured
    { id: 'rast-panjgah', label: 'Rāst-Panjgāh',  steps: fromIntervals([4, 3, 3, 4, 4, 3, 3]) },   // Rast extended to a 5-tone pentachord
    // Esfahān is in the Homāyoun family but with neutral 6th. Standard:
    // 0, 100, 400, 500, 700, 850, 1050 (Hijaz tetrachord + neutral-6 + neutral-7 above).
    { id: 'esfahan',      label: 'Esfahān',       steps: fromIntervals([2, 6, 2, 4, 3, 4, 3]) },
  ],
  defaultScale: 'shur',
  labeler: arabicLabeler,
  pcToStep: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
  chord: { kind: 'drone', steps: [0, 14] },   // tonic + 5th drone
};
