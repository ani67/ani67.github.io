import type { Action, Mode } from '../types';
import { CONTROLS, KEY_SELECTOR, CODE_TO_ROW, positionToStep } from './grid';
import { midiToHz } from '../util';
import {
  centsToHzFromRoot, lookupSystem, nearestScaleStep, scaleStepFromGridStep, stepToCents,
} from '../tuning';
import type { TuningSystem } from '../tuning';
import type { CentsOverride } from '../../store/store';

export interface KeyEventLike {
  code: string;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
}

export interface ResolverState {
  root: number;          // 0..11 Western pitch class
  baseOctave: number;
  periodShift: number;
  systemId: string;
  mode: Mode;
  /** Per-system selected scale. */
  activeScales: Record<string, string>;
  /** Per-system per-key cents overrides (or 'deleted' sentinel). */
  customMaps: Record<string, Record<string, CentsOverride>>;
}

/** Convenience — look up the active scale for a system, falling back to default. */
function getActiveScale(sys: TuningSystem, activeScales: Record<string, string>) {
  const id = activeScales[sys.id] ?? sys.defaultScale;
  return sys.scales.find((s) => s.id === id) ?? sys.scales[0];
}

/** Convert a scale-step index → Hz, given the system, scale, and root/period context. */
function scaleStepToHz(
  sys: TuningSystem,
  scaleSteps: readonly number[],
  scaleStep: number,
  baseRootHz: number,
  periodShift: number,
  rootStep: number,
): number {
  const L = scaleSteps.length;
  const wraps = Math.floor(scaleStep / L);
  const inScale = ((scaleStep % L) + L) % L;
  const gridStep = scaleSteps[inScale];
  // We label/sound relative to the root, so shift the grid step by rootStep
  // (where the root sits in the grid). For the 22-śruti grid this is the
  // PC_TO_SRUTI offset; for 12-TET it's the pitch class itself.
  const cents = stepToCents(sys.grid, gridStep + rootStep) +
                (wraps + periodShift) * sys.grid.periodCents -
                stepToCents(sys.grid, rootStep);
  return centsToHzFromRoot(baseRootHz, cents);
}

/** Convert a chromatic grid-step index → Hz. */
function gridStepToHz(
  sys: TuningSystem,
  step: number,
  baseRootHz: number,
  periodShift: number,
  rootStep: number,
): number {
  const cents = stepToCents(sys.grid, step + rootStep) +
                periodShift * sys.grid.periodCents -
                stepToCents(sys.grid, rootStep);
  return centsToHzFromRoot(baseRootHz, cents);
}

/** Pure. No side effects, no audio, no DOM. */
export function resolveKeyDown(event: KeyEventLike, st: ResolverState, explicitStep?: number): Action | null {
  if (event.repeat) return null;
  const { code, shiftKey, altKey } = event;

  if (shiftKey && code in KEY_SELECTOR) {
    return { type: 'SetRoot', pitchClass: KEY_SELECTOR[code] };
  }
  if (code === CONTROLS.octaveDown) return { type: 'ShiftPeriod', delta: -1 };
  if (code === CONTROLS.octaveUp)   return { type: 'ShiftPeriod', delta: +1 };

  const rowInfo = CODE_TO_ROW.get(code);
  if (!rowInfo) return null;

  const sys     = lookupSystem(st.systemId);
  const scale   = getActiveScale(sys, st.activeScales);
  const overrides = st.customMaps[st.systemId];
  const ov      = overrides?.[code];

  // Deleted-in-simple-mode → silent. Chromatic mode ignores overrides.
  if (st.mode === 'simple' && ov && typeof ov === 'object' && ov.deleted) {
    return null;
  }

  const step = explicitStep ?? positionToStep(rowInfo.row, rowInfo.degree);

  // Base root Hz — the frequency of the root pitch class in the standard
  // 12-TET grid. Per-system grids are interpreted relative to this base
  // through the rootStep offset.
  const baseRootMidi = 12 * (st.baseOctave + 1) + st.root;
  const baseRootHz   = midiToHz(baseRootMidi);
  const rootStep     = sys.pcToStep[st.root] ?? 0;

  // Per-key override (cents from root) takes priority in simple mode.
  // Overrides don't currently stack into chords — single-pitch only.
  if (st.mode === 'simple' && typeof ov === 'number') {
    const f = centsToHzFromRoot(baseRootHz, ov + st.periodShift * sys.grid.periodCents);
    return { type: 'NoteOn', freqs: [f], row: rowInfo.row, code };
  }

  // Compute the pressed note's Hz once. Used as the "melody note" for all
  // chord-rule kinds — drone, octaves, and the in-scale triad case.
  const pressedHz = st.mode === 'simple'
    ? scaleStepToHz(sys, scale.steps, step, baseRootHz, st.periodShift, rootStep)
    : gridStepToHz(sys, step, baseRootHz, st.periodShift, rootStep);

  // Chord-off → just the pressed note.
  if (!altKey) {
    return { type: 'NoteOn', freqs: [pressedHz], row: rowInfo.row, code };
  }

  // Chord-on — branch on the system's native chord rule.
  switch (sys.chord.kind) {
    case 'none':
      return { type: 'NoteOn', freqs: [pressedHz], row: rowInfo.row, code };

    case 'octaves': {
      // Pressed note repeated at each period offset. offsets = [0, -1] → note
      // + same note one period below. Period = octave for octave-based grids.
      const freqs = sys.chord.offsets.map((o) =>
        pressedHz * Math.pow(2, o * sys.grid.periodCents / 1200),
      );
      return { type: 'NoteOn', freqs, row: rowInfo.row, code };
    }

    case 'drone': {
      // Pressed melody note + fixed grid-step pitches relative to root, at
      // the BASE register (not following periodShift) — so [ and ] move the
      // keyboard but the drone stays anchored, like a real tanpura.
      const droneFreqs = sys.chord.steps.map((s) =>
        gridStepToHz(sys, s, baseRootHz, 0, rootStep),
      );
      return { type: 'NoteOn', freqs: [pressedHz, ...droneFreqs], row: rowInfo.row, code };
    }

    case 'triad': {
      // Western tertian harmony — stack +2 and +4 through the active scale.
      if (st.mode === 'simple') {
        const third = scaleStepToHz(sys, scale.steps, step + 2, baseRootHz, st.periodShift, rootStep);
        const fifth = scaleStepToHz(sys, scale.steps, step + 4, baseRootHz, st.periodShift, rootStep);
        return { type: 'NoteOn', freqs: [pressedHz, third, fifth], row: rowInfo.row, code };
      }
      // Chromatic in-scale: stack thirds from the press's scale position.
      const inScalePos = scaleStepFromGridStep(scale, sys.grid, step);
      if (inScalePos !== null) {
        const wraps = Math.floor(step / sys.grid.stepsCents.length);
        const third = scaleStepToHz(sys, scale.steps, inScalePos + 2, baseRootHz, st.periodShift + wraps, rootStep);
        const fifth = scaleStepToHz(sys, scale.steps, inScalePos + 4, baseRootHz, st.periodShift + wraps, rootStep);
        return { type: 'NoteOn', freqs: [pressedHz, third, fifth], row: rowInfo.row, code };
      }
      // Out-of-scale chromatic: snap to nearest in-scale, voice triad there,
      // keep the pressed pitch as a top colour-tone voice.
      const snapped = nearestScaleStep(scale, sys.grid, step);
      const snappedInScale = scaleStepFromGridStep(scale, sys.grid, snapped);
      if (snappedInScale === null) {
        return { type: 'NoteOn', freqs: [pressedHz], row: rowInfo.row, code };
      }
      const snappedWraps = Math.floor(snapped / sys.grid.stepsCents.length);
      const snapPress = gridStepToHz(sys, snapped, baseRootHz, st.periodShift, rootStep);
      const third = scaleStepToHz(sys, scale.steps, snappedInScale + 2, baseRootHz, st.periodShift + snappedWraps, rootStep);
      const fifth = scaleStepToHz(sys, scale.steps, snappedInScale + 4, baseRootHz, st.periodShift + snappedWraps, rootStep);
      return { type: 'NoteOn', freqs: [snapPress, third, fifth, pressedHz], row: rowInfo.row, code };
    }
  }
}

export function resolveKeyUp(event: { code: string }): Action | null {
  return CODE_TO_ROW.has(event.code)
    ? { type: 'NoteOff', code: event.code }
    : null;
}
