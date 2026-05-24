import type { TuningSystem } from '../types';
import { carnaticLabeler } from '../labelers';

// Carnatic shares the 22-śruti grid with Hindustani — same JI ratios. The
// difference is in the rāga catalog (organised by 72 mēḷakartas) and the
// labeler (numbered svara positions R1/R2/R3 etc., rather than komal/shuddha).
//
// The catalog below is a curated selection of widely-used janaka (parent) and
// janya (derived) rāgas, not the full 72 mēḷakartas — a fuller catalog would
// follow the same shape if added later.

const ratios: readonly number[] = [
  1/1,     256/243, 16/15,   10/9,    9/8,
  32/27,   6/5,     5/4,     81/64,   4/3,
  27/20,   45/32,   729/512, 3/2,     128/81,
  8/5,     5/3,     27/16,   16/9,    9/5,
  15/8,    243/128,
];
const stepsCents = ratios.map((r) => 1200 * Math.log2(r));

export const CARNATIC: TuningSystem = {
  id: 'carnatic',
  label: 'Carnatic',
  region: 'indian',
  blurb: 'South Indian, mēḷakarta-based',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    // Mēḷakarta parents — 7-note scales spanning a wide range of moods.
    { id: 'shankarabharanam', label: 'Shankarābharanam', steps: [0, 4, 7, 9, 13, 16, 20] },   // 29 — equiv. major
    { id: 'kalyani',          label: 'Kalyāṇi',          steps: [0, 4, 7, 11, 13, 16, 20] },  // 65 — equiv. Lydian
    { id: 'hanumathodi',      label: 'Hanumathōdi',      steps: [0, 2, 6, 9, 13, 15, 19] },   // 8 — minor with flat 2
    { id: 'mayamalavagowla',  label: 'Māyāmāḷavagowla',  steps: [0, 2, 7, 9, 13, 15, 20] },   // 15 — sombre, like Bhairav
    { id: 'kharaharapriya',   label: 'Kharaharapriya',   steps: [0, 4, 6, 9, 13, 16, 19] },   // 22 — equiv. Dorian
    { id: 'natabhairavi',     label: 'Naṭabhairavi',     steps: [0, 4, 6, 9, 13, 15, 19] },   // 20 — natural minor
    { id: 'harikambhoji',     label: 'Harikāmbhoji',     steps: [0, 4, 7, 9, 13, 16, 19] },   // 28 — equiv. Mixolydian
    // Janya — pentatonic / hexatonic derived rāgas
    { id: 'mohanam',          label: 'Mōhanam',          steps: [0, 4, 7, 13, 16] },          // pentatonic, major-flavoured
    { id: 'hindolam',         label: 'Hindōḷam',         steps: [0, 6, 9, 15, 19] },          // pentatonic, ≈ Malkauns
    { id: 'madhyamavati',     label: 'Madhyamāvati',     steps: [0, 4, 9, 13, 19] },          // pentatonic
  ],
  defaultScale: 'shankarabharanam',
  labeler: carnaticLabeler,
  pcToStep: [0, 2, 4, 6, 7, 9, 11, 13, 15, 16, 19, 20],
  // Carnatic tanpura — Sa + Pa underneath every pressed note.
  chord: { kind: 'drone', steps: [0, 13] },
};
