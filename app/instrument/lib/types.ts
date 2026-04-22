export type RowId = 1 | 2 | 3 | 4;

export type Tuning = '12tet' | 'sruti';

/**
 * Keyboard layout mode.
 *   chromatic — every semitone (TET) / every 22-JI śruti (Śruti) is a key. Out-of-scale keys show plain.
 *   simple    — each physical key plays the next scale/rāga note; no chromatic gaps. All keys highlighted.
 */
export type Mode = 'simple' | 'chromatic';

/**
 * Western scales — intervals in semitones from the tonic.
 * Used only as a CHORD CONTEXT + visual highlight hint, not as a keyboard filter.
 * The keyboard exposes every chromatic semitone regardless of which scale is chosen.
 */
export type ScaleName =
  | 'major'
  | 'minor'
  | 'sus'
  | 'dorian'
  | 'lydian'
  | 'mixolydian'
  | 'blues'
  | 'diminished'
  | 'wholeTone';

/**
 * Hindustani rāgas — sets of śruti indices (0..21 in the 22-JI table).
 * Used only as a CHORD CONTEXT + visual highlight hint, not as a keyboard filter.
 */
export type RagaName =
  | 'yaman'
  | 'bhairav'
  | 'bhairavi'
  | 'kafi'
  | 'darbari'
  | 'malkauns';

/** Pre-computed Hz so the synth doesn't need to know about tuning systems or chord builders. */
export type Action =
  | { type: 'NoteOn';      freqs: number[]; row: RowId; code: string }
  | { type: 'NoteOff';     code: string }
  | { type: 'SetRoot';     pitchClass: number }
  | { type: 'ShiftOctave'; delta: number }
  | { type: 'AllNotesOff' };
