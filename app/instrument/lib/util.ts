// Names per pitch class — Western convention is context-dependent: sharp keys
// (G, D, A, E, B) prefer sharps; flat keys (F, Bb, Eb, Ab, Db) prefer flats.
// We pick which set to use based on the *root* pitch class.
const PITCH_NAMES_SHARP: readonly string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];
const PITCH_NAMES_FLAT:  readonly string[] = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
];

// Whether the root pitch class "belongs to" a flat key signature.
// F, Bb, Eb, Ab, Db are the flat keys; Db is enharmonic with C# but spelled
// with flats. F#/Gb sits at the boundary — we pick sharps (F# major has 6#).
const PREFERS_FLATS: readonly boolean[] = [
  false,  // C — neutral, sharps by convention
  true,   // C#/Db — Db is more common as a key
  false,  // D — 2 sharps
  true,   // Eb — 3 flats
  false,  // E — 4 sharps
  true,   // F — 1 flat
  false,  // F#/Gb — pick sharps (F# major)
  false,  // G — 1 sharp
  true,   // Ab — 4 flats
  false,  // A — 3 sharps
  true,   // Bb — 2 flats
  false,  // B — 5 sharps
];

// Default mixed naming used by header pills + anywhere we don't have a root
// context (kept to preserve the existing "Bb" labelling for the root selector).
export const PITCH_CLASS_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B',
] as const;

/** MIDI note → Hz (equal temperament, A4 = 440). */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** MIDI note → pretty name, e.g. 60 → "C4". When rootPc is supplied, the
 *  name uses sharps or flats according to that root's key signature
 *  convention. Without a root, falls back to sharp-style. */
export function midiToName(midi: number, rootPc?: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const useFlats = rootPc != null && PREFERS_FLATS[((rootPc % 12) + 12) % 12];
  const names = useFlats ? PITCH_NAMES_FLAT : PITCH_NAMES_SHARP;
  return `${names[pc]}${octave}`;
}

export interface PitchParts {
  root: number;
  semitone: number;
  baseOctave: number;
  octaveShift: number;
}

export function toMidi({ root, semitone, baseOctave, octaveShift }: PitchParts): number {
  return 12 * (baseOctave + octaveShift + 1) + root + semitone;
}
