import type { Action, Mode, RagaName, ScaleName, Tuning } from '../types';
import { CONTROLS, KEY_SELECTOR, CODE_TO_ROW, positionToStep } from './grid';
import { simpleStepToSemitone, triadInScale } from './scales';
import { simpleStepInRaga, srutiToHz, SRUTI_RATIOS, triadInRaga } from '../tuning/sruti';
import { midiToHz } from '../util';

export interface KeyEventLike {
  code: string;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
}

export interface ResolverState {
  root: number;
  baseOctave: number;
  octaveShift: number;
  tuning: Tuning;
  mode: Mode;
  chordScaleTET:   ScaleName;
  chordScaleSruti: RagaName;
}

/** Pure. No side effects, no audio, no DOM. */
export function resolveKeyDown(event: KeyEventLike, st: ResolverState): Action | null {
  if (event.repeat) return null;
  const { code, shiftKey, altKey } = event;

  if (shiftKey && code in KEY_SELECTOR) {
    return { type: 'SetRoot', pitchClass: KEY_SELECTOR[code] };
  }

  if (code === CONTROLS.octaveDown) return { type: 'ShiftOctave', delta: -1 };
  if (code === CONTROLS.octaveUp)   return { type: 'ShiftOctave', delta: +1 };

  const rowInfo = CODE_TO_ROW.get(code);
  if (rowInfo) {
    const step = positionToStep(rowInfo.row, rowInfo.degree);
    const freqs = st.tuning === 'sruti'
      ? computeSrutiFreqs(step, altKey, st)
      : compute12TETFreqs(step, altKey, st);
    return { type: 'NoteOn', freqs, row: rowInfo.row, code };
  }

  return null;
}

export function resolveKeyUp(event: { code: string }): Action | null {
  return CODE_TO_ROW.has(event.code)
    ? { type: 'NoteOff', code: event.code }
    : null;
}

// ----- tuning × mode pitch computation -----

function compute12TETFreqs(step: number, alt: boolean, st: ResolverState): number[] {
  const baseMidi = 12 * (st.baseOctave + st.octaveShift + 1) + st.root;

  if (st.mode === 'simple') {
    // Walk the scale — each step = next scale note.
    const stepToMidi = (s: number) => baseMidi + simpleStepToSemitone(st.chordScaleTET, s);
    const pressed = stepToMidi(step);
    if (alt) return [pressed, stepToMidi(step + 2), stepToMidi(step + 4)].map(midiToHz);
    return [midiToHz(pressed)];
  }

  // Chromatic — every semitone is a key.
  const midi = baseMidi + step;
  if (!alt) return [midiToHz(midi)];

  // Scale-context chord: stack thirds through the chosen scale from this semitone.
  const offsets = triadInScale(st.chordScaleTET, step);
  if (offsets) return offsets.map((off) => midiToHz(midi + off));
  // Out of scale → fixed major triad so every key still yields something.
  return [midi, midi + 4, midi + 7].map(midiToHz);
}

function computeSrutiFreqs(step: number, alt: boolean, st: ResolverState): number[] {
  const rootMidi = 12 * (st.baseOctave + st.octaveShift + 1) + st.root;
  const rootHz   = midiToHz(rootMidi);

  if (st.mode === 'simple') {
    // Walk the rāga — each step = next svara.
    const stepToHz = (s: number) => {
      const { sruti, octaves } = simpleStepInRaga(st.chordScaleSruti, s);
      return srutiToHz(rootHz, sruti, octaves);
    };
    const pressed = stepToHz(step);
    if (alt) return [pressed, stepToHz(step + 2), stepToHz(step + 4)];
    return [pressed];
  }

  // Chromatic — every śruti is a key, wrapped into 22-śruti octaves.
  const n = SRUTI_RATIOS.length; // 22
  const stepToFreq = (s: number): number => {
    const sruti   = ((s % n) + n) % n;
    const octaves = Math.floor(s / n);
    return srutiToHz(rootHz, sruti, octaves);
  };

  const melody = stepToFreq(step);
  if (!alt) return [melody];

  const absSruti = ((step % n) + n) % n;
  const offsets  = triadInRaga(st.chordScaleSruti, absSruti);
  if (offsets) return offsets.map((off) => stepToFreq(step + off));
  return [stepToFreq(step - 1), melody, stepToFreq(step + 1)];
}
