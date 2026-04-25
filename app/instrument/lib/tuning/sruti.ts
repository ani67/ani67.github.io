import type { RagaName } from '../types';

/**
 * 22 śrutis — just-intonation ratios from the tonic (Sa). Zero-indexed.
 */
export const SRUTI_RATIOS: readonly number[] = [
  1/1,     256/243, 16/15,   10/9,    9/8,
  32/27,   6/5,     5/4,     81/64,   4/3,
  27/20,   45/32,   729/512, 3/2,     128/81,
  8/5,     5/3,     27/16,   16/9,    9/5,
  15/8,    243/128,
];

/**
 * Label for each of the 22 śrutis. Lowercase = komal (flat); Capitalized = shuddha (natural).
 * `↓` = the lower of two alternate intonations of that svara; `↑` = the higher.
 * `tMa` = tivra Ma (augmented 4th).
 */
export const SRUTI_LABELS: readonly string[] = [
  'Sa',  're↓', 're',  'Re↓', 'Re',
  'ga↓', 'ga',  'Ga',  'Ga↑', 'Ma',
  'Ma+', 'tMa', 'tMa↑','Pa',  'dha↓',
  'dha', 'Dha', 'Dha↑','ni↓', 'ni',
  'Ni',  'Ni↑',
];

/**
 * Fixed-Sa convention — each Western pitch class maps to its canonical Hindustani
 * svara (Sa=C, re=C#, Re=D, ga=Eb, Ga=E, Ma=F, tMa=F#, Pa=G, dha=G#, Dha=A, ni=Bb, Ni=B).
 * Indexes into SRUTI_LABELS / SRUTI_RATIOS, picking the just-intonation svara closest
 * to each TET semitone.
 */
export const PC_TO_SRUTI: readonly number[] = [
  0,  // C  → Sa
  2,  // C# → re
  4,  // D  → Re
  6,  // Eb → ga
  7,  // E  → Ga
  9,  // F  → Ma
  11, // F# → tMa
  13, // G  → Pa
  15, // G# → dha
  16, // A  → Dha
  19, // Bb → ni
  20, // B  → Ni
];

/**
 * Rāgas — ordered lists of śruti indices forming the ascending scale.
 * CONTEXT ONLY — used for chord-mode voicing and visual highlight.
 * The keyboard plays every śruti regardless of the current rāga.
 */
export const RAGAS: Record<RagaName, { label: string; srutis: readonly number[] }> = {
  yaman:    { label: 'Yaman',          srutis: [0, 4, 7, 11, 13, 16, 20] },
  bhairav:  { label: 'Bhairav',        srutis: [0, 2, 7,  9, 13, 15, 20] },
  bhairavi: { label: 'Bhairavi',       srutis: [0, 2, 6,  9, 13, 15, 19] },
  kafi:     { label: 'Kafi',           srutis: [0, 4, 6,  9, 13, 16, 19] },
  darbari:  { label: 'Darbari Kanada', srutis: [0, 4, 6,  9, 13, 15, 19] },
  malkauns: { label: 'Malkauns',       srutis: [0, 6, 9, 15, 19]          },
};

export const RAGA_CYCLE: readonly RagaName[] = [
  'yaman', 'bhairav', 'bhairavi', 'kafi', 'darbari', 'malkauns',
];

export function nextRaga(current: RagaName): RagaName {
  const i = RAGA_CYCLE.indexOf(current);
  return RAGA_CYCLE[(i + 1) % RAGA_CYCLE.length];
}

/** Is this śruti index in the current rāga? */
export function isInRaga(ragaName: RagaName, sruti: number): boolean {
  return RAGAS[ragaName].srutis.includes(sruti);
}

/**
 * Stack of "thirds" (next-next svara) through a rāga, from the pressed śruti.
 * Returns total-step offsets relative to the pressed step (so the synth multiplies
 * by the right SRUTI_RATIO and adds octave multiplications from 2^n).
 * Null if the pressed śruti isn't in the rāga.
 */
export function triadInRaga(ragaName: RagaName, sruti: number): [number, number, number] | null {
  const srutis = RAGAS[ragaName].srutis;
  const i = srutis.indexOf(sruti);
  if (i === -1) return null;

  const L = srutis.length;
  // total-step delta uses 22-step octaves (śrutis wrap at 22).
  const step = (offset: number): number => {
    const idx   = i + offset;
    const wraps = Math.floor(idx / L);
    const norm  = ((idx % L) + L) % L;
    return srutis[norm] + 22 * wraps - srutis[i];
  };
  return [0, step(2), step(4)];
}

/** Hz from a root-Hz reference + śruti index + octave offset. */
export function srutiToHz(rootHz: number, sruti: number, octaves: number): number {
  return rootHz * SRUTI_RATIOS[sruti] * Math.pow(2, octaves);
}

/**
 * Simple-mode pitch: given a physical step index 0..N, walk the rāga
 * (octaves wrap past the rāga length) and return { sruti, octaves }.
 */
export function simpleStepInRaga(ragaName: RagaName, step: number): { sruti: number; octaves: number } {
  const svaras  = RAGAS[ragaName].srutis;
  const L       = svaras.length;
  const octaves = Math.floor(step / L);
  const pos     = ((step % L) + L) % L;
  return { sruti: svaras[pos], octaves };
}
