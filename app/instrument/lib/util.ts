export const PITCH_CLASS_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B',
] as const;

/** MIDI note → Hz (equal temperament, A4 = 440). */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** MIDI note → pretty name, e.g. 60 → "C4". */
export function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_CLASS_NAMES[pc]}${octave}`;
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
