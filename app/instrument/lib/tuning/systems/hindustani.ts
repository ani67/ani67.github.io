import type { TuningSystem } from '../types';
import { hindustaniLabeler } from '../labelers';

// 22-śruti grid — just-intonation ratios from the Hindustani tradition.
// Cents = 1200 × log2(ratio).
const ratios: readonly number[] = [
  1/1,     256/243, 16/15,   10/9,    9/8,
  32/27,   6/5,     5/4,     81/64,   4/3,
  27/20,   45/32,   729/512, 3/2,     128/81,
  8/5,     5/3,     27/16,   16/9,    9/5,
  15/8,    243/128,
];
const stepsCents = ratios.map((r) => 1200 * Math.log2(r));

// Western pitch class → śruti step, picking the just-intonation svara nearest
// each TET semitone (Sa=C, re=C#, Re=D, ga=Eb, …).
const pcToStep = [0, 2, 4, 6, 7, 9, 11, 13, 15, 16, 19, 20];

export const HINDUSTANI: TuningSystem = {
  id: 'hindustani',
  label: 'Hindustani',
  region: 'indian',
  blurb: 'Indian, 22-śruti just intonation',
  grid: { stepsCents, periodCents: 1200 },
  scales: [
    { id: 'yaman',    label: 'Yaman',          steps: [0, 4, 7, 11, 13, 16, 20] },
    { id: 'bhairav',  label: 'Bhairav',        steps: [0, 2, 7,  9, 13, 15, 20] },
    { id: 'bhairavi', label: 'Bhairavi',       steps: [0, 2, 6,  9, 13, 15, 19] },
    { id: 'kafi',     label: 'Kafi',           steps: [0, 4, 6,  9, 13, 16, 19] },
    { id: 'darbari',  label: 'Darbari Kanada', steps: [0, 4, 6,  9, 13, 15, 19] },
    { id: 'malkauns', label: 'Malkauns',       steps: [0, 6, 9, 15, 19]          },
    { id: 'todi',     label: 'Todi',           steps: [0, 2, 6, 11, 13, 15, 20] },
    { id: 'marwa',    label: 'Marwa',          steps: [0, 2, 7, 11, 16, 20]     },
  ],
  defaultScale: 'yaman',
  labeler: hindustaniLabeler,
  pcToStep,
  // Hindustani has no chord theory — accompaniment is the tanpura drone.
  // With chord-on, every press plays Sa + Pa underneath the melody note.
  chord: { kind: 'drone', steps: [0, 13] },
};
