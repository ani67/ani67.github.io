import type { ScaleName } from '../types';

/**
 * Scale intervals (semitones from tonic).
 * CONTEXT ONLY — chord shape + key highlight.
 * The keyboard lets you play every chromatic pitch regardless of the current scale.
 */
export const SCALES: Record<ScaleName, { label: string; intervals: readonly number[] }> = {
  major:      { label: 'Major',         intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor:      { label: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  sus:        { label: 'Suspended',     intervals: [0, 2, 5, 7, 9]        },
  dorian:     { label: 'Dorian',        intervals: [0, 2, 3, 5, 7, 9, 10] },
  lydian:     { label: 'Lydian',        intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { label: 'Mixolydian',    intervals: [0, 2, 4, 5, 7, 9, 10] },
  blues:      { label: 'Blues',         intervals: [0, 3, 5, 6, 7, 10]    },
  diminished: { label: 'Diminished',    intervals: [0, 1, 3, 4, 6, 7, 9, 10] },
  wholeTone:  { label: 'Whole Tone',    intervals: [0, 2, 4, 6, 8, 10]    },
};

export const SCALE_CYCLE: readonly ScaleName[] = [
  'major', 'lydian', 'mixolydian',
  'dorian', 'minor',
  'sus', 'blues',
  'diminished', 'wholeTone',
];

export function nextScale(current: ScaleName): ScaleName {
  const i = SCALE_CYCLE.indexOf(current);
  return SCALE_CYCLE[(i + 1) % SCALE_CYCLE.length];
}

/** Is this semitone-offset-from-root a member of the scale? */
export function isInScale(scaleName: ScaleName, semitoneFromRoot: number): boolean {
  const s = ((semitoneFromRoot % 12) + 12) % 12;
  return SCALES[scaleName].intervals.includes(s);
}

/**
 * Nearest in-scale semitone-from-root, preserving octave context.
 * Used by chromatic-mode chord voicing: an out-of-scale press is harmonised
 * by snapping to the closest scale degree and stacking the chord there.
 */
export function nearestScaleStep(scaleName: ScaleName, semitoneFromRoot: number): number {
  const intervals = SCALES[scaleName].intervals;
  const baseOct = Math.floor(semitoneFromRoot / 12) * 12;
  let best = semitoneFromRoot;
  let bestDist = Infinity;
  for (const iv of intervals) {
    for (const oct of [baseOct - 12, baseOct, baseOct + 12]) {
      const cand = iv + oct;
      const d = Math.abs(cand - semitoneFromRoot);
      if (d < bestDist) { best = cand; bestDist = d; }
    }
  }
  return best;
}

/**
 * Simple-mode pitch: given a physical step index 0..N, walk the scale
 * (octaves wrap past the scale length) and return the semitone offset from root.
 */
export function simpleStepToSemitone(scaleName: ScaleName, step: number): number {
  const intervals = SCALES[scaleName].intervals;
  const L         = intervals.length;
  const octaves   = Math.floor(step / L);
  const pos       = ((step % L) + L) % L;
  return intervals[pos] + 12 * octaves;
}

/**
 * Given the scale-degree index `i` where the pressed semitone lives,
 * returns semitone offsets [0, +3rd, +5th] (stack of thirds through the scale)
 * relative to the pressed pitch. Handles wrap past the scale length (→ next octave).
 */
export function triadInScale(scaleName: ScaleName, semitoneFromRoot: number): [number, number, number] | null {
  const intervals = SCALES[scaleName].intervals;
  const s = ((semitoneFromRoot % 12) + 12) % 12;
  const i = intervals.indexOf(s);
  if (i === -1) return null;

  const L = intervals.length;
  const step = (offset: number): number => {
    const idx    = i + offset;
    const wraps  = Math.floor(idx / L);
    const norm   = ((idx % L) + L) % L;
    return intervals[norm] + 12 * wraps - intervals[i];
  };
  return [0, step(2), step(4)];
}
