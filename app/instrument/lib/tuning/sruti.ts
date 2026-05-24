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
 * Inverse of PC_TO_SRUTI extended to all 22 śrutis — the *nearest* 12-TET
 * semitone (0..11, relative to Sa) for each śruti. Used to show a greyed
 * Western pitch reference under each key in Śruti mode.
 *
 * Two śrutis often round to the same semitone (e.g. Ga at 5/4 = 386¢ and
 * Ga↑ at 81/64 = 408¢ both round to E = 400¢). That's the whole point —
 * Western labels can't distinguish them; Hindustani notation can.
 */
export const SRUTI_TO_NEAREST_SEMITONE: readonly number[] = [
  0,   // 0  Sa    1/1      0¢       → C
  1,   // 1  re↓   256/243  90¢      → C#
  1,   // 2  re    16/15    112¢     → C#
  2,   // 3  Re↓   10/9     182¢     → D
  2,   // 4  Re    9/8      204¢     → D
  3,   // 5  ga↓   32/27    294¢     → D#/Eb
  3,   // 6  ga    6/5      316¢     → D#/Eb
  4,   // 7  Ga    5/4      386¢     → E
  4,   // 8  Ga↑   81/64    408¢     → E
  5,   // 9  Ma    4/3      498¢     → F
  5,   // 10 Ma+   27/20    520¢     → F
  6,   // 11 tMa   45/32    590¢     → F#
  6,   // 12 tMa↑  729/512  612¢     → F#
  7,   // 13 Pa    3/2      702¢     → G
  8,   // 14 dha↓  128/81   792¢     → G#/Ab
  8,   // 15 dha   8/5      814¢     → G#/Ab
  9,   // 16 Dha   5/3      884¢     → A
  9,   // 17 Dha↑  27/16    906¢     → A
  10,  // 18 ni↓   16/9     996¢     → A#/Bb
  10,  // 19 ni    9/5      1018¢    → A#/Bb
  11,  // 20 Ni    15/8     1088¢    → B
  11,  // 21 Ni↑   243/128  1110¢    → B
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
 * Nearest in-rāga step in the 22-śruti grid, preserving octave context.
 * Used by chromatic-mode chord voicing: an out-of-rāga press is harmonised
 * by snapping to the closest svara and stacking the chord there.
 */
export function nearestRagaStep(ragaName: RagaName, step: number): number {
  const srutis = RAGAS[ragaName].srutis;
  const N      = SRUTI_RATIOS.length;
  const baseOct = Math.floor(step / N) * N;
  let best = step;
  let bestDist = Infinity;
  for (const sv of srutis) {
    for (const oct of [baseOct - N, baseOct, baseOct + N]) {
      const cand = sv + oct;
      const d = Math.abs(cand - step);
      if (d < bestDist) { best = cand; bestDist = d; }
    }
  }
  return best;
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
