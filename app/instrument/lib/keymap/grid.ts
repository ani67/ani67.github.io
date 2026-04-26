import type { RowId } from '../types';

export const ROW_IDS: readonly RowId[] = [1, 2, 3, 4];

/** Keys per row. Physical-key bindings — uses event.code for layout-independence. */
export const ROWS: Record<RowId, { keys: readonly string[] }> = {
  1: { keys: ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0'] },
  2: { keys: ['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP'] },
  3: { keys: ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon'] },
  4: { keys: ['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash'] },
};

/**
 * No overlap — each row covers its own 10 consecutive steps.
 * Row 1 (top) highest, Row 4 (bottom) lowest.
 *
 * Step formula: step = (4 - row) * 10 + degree
 *   Row 4 → steps 0..9
 *   Row 3 → steps 10..19
 *   Row 2 → steps 20..29
 *   Row 1 → steps 30..39
 * Total: 40 unique steps (TET: ~3⅓ octaves · Śruti: ~1.8 octaves).
 */
export function positionToStep(row: RowId, degree: number): number {
  return (4 - row) * 10 + degree;
}

/**
 * Mobile layout — 4 keys × 4 rows = 16 cells, contiguous in step-space with the
 * top of one row repeating at the bottom of the next so the octave note is
 * reachable from both ends:
 *   Row 4 (bottom) → 0,1,2,3
 *   Row 3          → 4,5,6,7
 *   Row 2          → 7,8,9,10   (deg 0 overlaps row 3 deg 3 at step 7)
 *   Row 1 (top)    → 11,12,13,14
 * Total: 15 unique steps, 2 octaves in heptatonic simple mode.
 */
const MOBILE_STEP: Record<RowId, readonly number[]> = {
  4: [0, 1, 2, 3],
  3: [4, 5, 6, 7],
  2: [7, 8, 9, 10],
  1: [11, 12, 13, 14],
};

export function mobilePositionToStep(row: RowId, degree: number): number {
  return MOBILE_STEP[row][degree] ?? 0;
}

/** Inverse of positionToStep — physical step (0..39) → keyboard event.code, or null if out of range. */
export function stepToCode(step: number): string | null {
  if (step < 0 || step > 39) return null;
  const rowIdx = 4 - Math.floor(step / 10);
  const degree = step % 10;
  if (rowIdx < 1 || rowIdx > 4) return null;
  return ROWS[rowIdx as RowId].keys[degree] ?? null;
}

/** Shift + these keys sets the root. Covers all 12 chromatic pitch classes. */
export const KEY_SELECTOR: Record<string, number> = {
  Digit1: 0,  Digit2: 1,  Digit3: 2,  Digit4: 3,
  Digit5: 4,  Digit6: 5,  Digit7: 6,  Digit8: 7,
  Digit9: 8,  Digit0: 9,
  Minus:  10, Equal:  11,
};

export const CONTROLS = {
  octaveDown: 'BracketLeft',
  octaveUp:   'BracketRight',
} as const;

export interface RowPosition {
  row: RowId;
  degree: number;
}

export const CODE_TO_ROW: Map<string, RowPosition> = (() => {
  const m = new Map<string, RowPosition>();
  for (const rowId of ROW_IDS) {
    const row = ROWS[rowId];
    row.keys.forEach((code, degree) => {
      m.set(code, { row: rowId, degree });
    });
  }
  return m;
})();

export const INSTRUMENT_CODES: Set<string> = new Set<string>([
  ...ROW_IDS.flatMap((id) => [...ROWS[id].keys]),
  'Minus', 'Equal',          // root-selector overflow keys
  CONTROLS.octaveDown, CONTROLS.octaveUp,
]);
