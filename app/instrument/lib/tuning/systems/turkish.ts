import type { TuningSystem } from '../types';
import { makeWrappedNumericLabeler } from '../labelers';

// 53-tone equal temperament — used in classical Turkish music theory.
// Each step ≈ 22.642¢ (a "Holdrian comma"). Western whole-tones are 9 commas,
// minor 2nds typically 4 or 5 commas. The makamlar are 7-note scales built
// from specific comma patterns.
const stepsCents = Array.from({ length: 53 }, (_, i) => i * 1200 / 53);

// Approximate makam scale-step indices in 53-EDO. Real Turkish theory uses
// specific koma-counted intervals (per Yekta and others); these are practical
// approximations that capture the characteristic intonation of each makam.
export const TURKISH: TuningSystem = {
  id: 'turkish',
  label: 'Turkish Makam',
  region: 'middle-eastern',
  blurb: '53-EDO Holdrian commas',
  grid: { stepsCents, periodCents: 1200 },
  // Comma counts follow the Arel-Ezgi-Uzdilek (AEU) system, which is the
  // standard taught in Turkish conservatories. T = Tanini (9 commas, major
  // whole-tone), S = small Mücennep (8 commas), K = small Mücennep (5 commas),
  // B = Bakiye (4 commas), AK = augmented 2nd (12 commas). Tetrachord/
  // pentachord patterns determine each makam's identity.
  scales: [
    // Rast tetrachord = T-S-K (9-8-5 = 22 commas = pure 4th), then a tone (T)
    // up to the 5th, then Rast tetrachord above. Slightly low 3rd vs Pyth.
    { id: 'rast',     label: 'Rast',      steps: [0,  9, 17, 22, 31, 40, 48] },
    // Hicaz tetrachord = K-AK-K (5-12-5 = 22 commas), Buselik tetrachord above
    // with b6 + b7 (= the "Spanish" augmented-2nd characteristic).
    { id: 'hicaz',    label: 'Hicaz',     steps: [0,  5, 17, 22, 31, 35, 44] },
    // Uşşak tetrachord = S-K-T (8-5-9 = 22), Uşşak tetrachord above with b6.
    { id: 'ussak',    label: 'Uşşak',     steps: [0,  8, 13, 22, 31, 39, 44] },
    // Kürdi (Phrygian-flavoured) — K-T-S (5-9-8).
    { id: 'kurdi',    label: 'Kürdi',     steps: [0,  5, 13, 22, 31, 35, 44] },
    // Hüseynî = Uşşak pentachord + Uşşak tetrachord above the 5th.
    // Corrected from earlier values — 6th = 40 commas (not 39), 7th = 44 (not 48).
    { id: 'huseyni',  label: 'Hüseynî',   steps: [0,  8, 13, 22, 31, 40, 44] },
    // Saba — the characteristic "diminished 4th" makam. Saba tetrachord
    // S-K-K (8-5-5 = 18 commas, less than a 4th), then unusual upper structure.
    // Corrected to canonical 5th-step value (27 commas, not 30).
    { id: 'saba',     label: 'Saba',      steps: [0,  8, 13, 18, 27, 35, 44] },
    // Nihavend = harmonic minor in Turkish terms — Buselik tetrachord + Hicaz
    // tetrachord above the 5th (raised 7th).
    { id: 'nihavend', label: 'Nihavend',  steps: [0,  9, 13, 22, 31, 35, 48] },
    // Buselik = natural minor — Buselik tetrachord + Kürdi above.
    { id: 'buselik',  label: 'Buselik',   steps: [0,  9, 13, 22, 31, 35, 44] },
  ],
  defaultScale: 'rast',
  labeler: makeWrappedNumericLabeler(53),
  // Western pc → nearest 53-EDO step (12-TET semitones × 53/12 ≈ 4.42 commas).
  pcToStep: [0, 4, 9, 13, 18, 22, 27, 31, 36, 40, 44, 49],
  chord: { kind: 'drone', steps: [0, 31] },   // Turkish is melodic — tonic + 5th drone
};
