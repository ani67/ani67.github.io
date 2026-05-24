/**
 * Tuning system abstractions.
 *
 * The big insight: a "tuning system" is three independent layers:
 *
 *   PITCH GRID     what frequencies exist per period (Hindustani's 22 śrutis,
 *                  12-TET's 12 semitones, BP's 13 tritave divisions, ...)
 *   SCALES         which subsets of the grid form modes (rāgas, maqamat,
 *                  major/minor, mēḷakarta, ...)
 *   LABELER        what to call each pitch (Sa/re/Re/Ga..., C/C#/D..., Rast/
 *                  Dūkāh/Sīkāh..., or raw step numbers)
 *
 * The current Hindustani system = śruti grid + Hindustani rāga catalog + Hindustani
 * svara labeler. Carnatic = śruti grid + Carnatic rāga catalog + Carnatic labeler.
 * The grid is reused, the rest differs. Pythagorean = different grid but same
 * Western scales + Western labels. This factoring is what makes "swap any
 * dimension independently" work.
 */

export interface PitchGrid {
  /** Cents from tonic for each step within one period. First entry must be 0. */
  stepsCents: readonly number[];
  /** Period in cents. 1200 = octave; ~1901.96 = Bohlen-Pierce tritave. */
  periodCents: number;
}

export interface Scale {
  id: string;
  label: string;
  /** Indices into PitchGrid.stepsCents. Length is the scale's note count. */
  steps: readonly number[];
}

/** Labels for one period's worth of grid pitches. */
export interface Labeler {
  id: string;
  /**
   * Display label for a grid step (within one period), given the active root
   * step. Receives the system's grid for context (e.g. so a Western labeler
   * can pick sharps vs flats based on key signature).
   */
  labelStep(stepInPeriod: number, rootStep: number, grid: PitchGrid): string;
  /**
   * Octave-style suffix for a step that's `n` periods above or below the
   * base register. Western uses "C4", "C5"; svara uses "Sa", "Sa′", "Sa″".
   * Receives the base label already.
   */
  withPeriodMark(baseLabel: string, periodOffset: number): string;
  /** The user-facing name for one "period" of this system — 'octave' or 'tritave'. */
  periodName: string;
}

/**
 * How chord-on behaves for this system. The chord toggle isn't culturally
 * universal — Western traditions stack thirds, Indian/Arab use drone-over-
 * melody, Thai uses heterophonic octave doubling. Each system declares its
 * native accompaniment so chord-on produces *musically appropriate* output
 * everywhere instead of imposing Western harmony on melodic traditions.
 */
export type ChordRule =
  /** Western — walk +2/+4 in active scale (triadic harmony). */
  | { kind: 'triad' }
  /** Indian/Middle-Eastern — pressed note + fixed grid steps relative to root.
   *  E.g. steps [0, 13] for 22-śruti = Sa + Pa (transient tanpura). */
  | { kind: 'drone'; steps: readonly number[] }
  /** Gamelan/Thai — pressed note repeated at multiple period offsets.
   *  offsets [0, -1] = note + same note one octave below. */
  | { kind: 'octaves'; offsets: readonly number[] }
  /** Pure-melodic traditions where chord-on is a no-op. */
  | { kind: 'none' };

export type SystemRegion =
  | 'western-modern'
  | 'western-historical'
  | 'indian'
  | 'middle-eastern'
  | 'southeast-asian'
  | 'east-asian'
  | 'experimental';

export interface TuningSystem {
  id: string;
  label: string;
  region: SystemRegion;
  /** Short, ≤40 chars — shown muted next to the name in the picker. */
  blurb: string;
  grid: PitchGrid;
  scales: readonly Scale[];
  /** Default scale ID for this system. */
  defaultScale: string;
  /** Picker labeler — converts grid step + root to a display string. */
  labeler: Labeler;
  /**
   * Mapping from Western pitch class (0..11) to grid step. Used by the
   * root selector (Shift+1…=) and per-key label rendering. Length must be 12.
   * For 12-step grids this is identity [0..11]. For 22-śruti it's the
   * existing PC_TO_SRUTI table.
   */
  pcToStep: readonly number[];
  /** What the chord toggle does in this system — see ChordRule. */
  chord: ChordRule;
}

// ===========================================================================
// Grid math
// ===========================================================================

/**
 * For an integer step index — possibly across multiple periods — return
 * absolute cents above the tonic.
 */
export function stepToCents(grid: PitchGrid, step: number): number {
  const L = grid.stepsCents.length;
  const periodOffset = Math.floor(step / L);
  const stepInPeriod = ((step % L) + L) % L;
  return grid.stepsCents[stepInPeriod] + periodOffset * grid.periodCents;
}

/** rootHz × 2^(cents/1200). */
export function centsToHzFromRoot(rootHz: number, cents: number): number {
  return rootHz * Math.pow(2, cents / 1200);
}

/**
 * Among the grid steps that belong to `scale`, return the one closest in
 * cents to the given absolute grid step. Used for the "snap to nearest
 * in-scale + colour-tone" chord voicing in chromatic mode.
 */
export function nearestScaleStep(scale: Scale, grid: PitchGrid, step: number): number {
  const L = grid.stepsCents.length;
  const baseOct = Math.floor(step / L) * L;
  const targetCents = stepToCents(grid, step);
  let best = scale.steps[0] + baseOct;
  let bestDiff = Math.abs(targetCents - stepToCents(grid, best));
  for (const s of scale.steps) {
    for (const oct of [baseOct - L, baseOct, baseOct + L]) {
      const cand = s + oct;
      const d = Math.abs(targetCents - stepToCents(grid, cand));
      if (d < bestDiff) { bestDiff = d; best = cand; }
    }
  }
  return best;
}

/** Find which position in `scale.steps` corresponds to a given grid step (0-based, wrapped). null if not in scale. */
export function scaleStepFromGridStep(scale: Scale, grid: PitchGrid, gridStep: number): number | null {
  const L = grid.stepsCents.length;
  const inPeriod = ((gridStep % L) + L) % L;
  const idx = scale.steps.indexOf(inPeriod);
  return idx === -1 ? null : idx;
}
