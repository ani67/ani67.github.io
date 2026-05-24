export type RowId = 1 | 2 | 3 | 4;

/**
 * Keyboard layout mode.
 *   chromatic — every grid step is a key. Out-of-scale keys show plain.
 *   simple    — each key plays the next scale/rāga note. All keys highlighted.
 */
export type Mode = 'simple' | 'chromatic';

/** Pre-computed Hz so the synth doesn't need to know about tuning systems or chord builders. */
export type Action =
  | { type: 'NoteOn';     freqs: number[]; row: RowId; code: string; voice?: string }
  | { type: 'NoteOff';    code: string }
  | { type: 'SetRoot';    pitchClass: number }
  | { type: 'ShiftPeriod'; delta: number }
  | { type: 'AllNotesOff' };
