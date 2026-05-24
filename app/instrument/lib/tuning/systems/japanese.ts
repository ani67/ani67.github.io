import type { TuningSystem } from '../types';
import { westernLabeler } from '../labelers';

// Japanese pentatonic — 12-TET grid with traditional 5-note modes.
//   in 陰  — characteristic "dark" Japanese sound (flat-2 and flat-6)
//   yō 陽  — "bright" pentatonic
//   miyako-bushi — urban shamisen scale, similar to in
//   ryosen — used in court music (gagaku)
//   minyō  — folk song scale, minor pentatonic-flavoured
const stepsCents = Array.from({ length: 12 }, (_, i) => i * 100);

export const JAPANESE: TuningSystem = {
  id: 'japanese',
  label: 'Japanese Pentatonic',
  region: 'east-asian',
  blurb: 'in / yō / miyako-bushi',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    { id: 'in',           label: 'In (陰)',         steps: [0, 1, 5, 7, 8] },
    { id: 'yo',           label: 'Yō (陽)',         steps: [0, 2, 5, 7, 9] },
    { id: 'miyako-bushi', label: 'Miyako-bushi',   steps: [0, 1, 5, 7, 8] },
    { id: 'ryosen',       label: 'Ryosen',          steps: [0, 2, 4, 7, 9] },
    { id: 'minyo',        label: 'Min\'yō',         steps: [0, 3, 5, 7, 10] },
  ],
  defaultScale: 'in',
  labeler: westernLabeler,
  pcToStep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  chord: { kind: 'octaves', offsets: [0, -1] },   // heterophonic doubling
};
