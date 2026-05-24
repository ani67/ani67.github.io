import { useStore } from '../store/store';
import { cn } from '../lib/utils';
import type { RowId } from '../lib/types';
import { resolveKeyDown } from '../lib/keymap/resolver';
import { dispatch } from '../lib/dispatch';
import { ensureRunning } from '../lib/audio/context';
import {
  lookupSystem, scaleStepFromGridStep, stepToCents,
  westernReferenceFromCents,
} from '../lib/tuning';
import { KeyPicker } from './KeyPicker';

/**
 * Classify a triad's [third-semitone, fifth-semitone] shape into a Western
 * chord-quality suffix. Returns undefined for shapes without a clean name
 * (e.g. the [0, 5, 9] you get stacking thirds through a 5-note pentatonic).
 * Inputs are rounded to the nearest 12-TET semitone so non-12-TET grids
 * (Pythagorean, just intonation) still classify cleanly.
 */
function classifyTriadSuffix(thirdSemi: number, fifthSemi: number): string | undefined {
  const t = ((thirdSemi % 12) + 12) % 12;
  const f = ((fifthSemi % 12) + 12) % 12;
  if (t === 4 && f === 7) return '';      // major
  if (t === 3 && f === 7) return 'm';     // minor
  if (t === 3 && f === 6) return '°';     // diminished
  if (t === 4 && f === 8) return '+';     // augmented
  if (t === 5 && f === 7) return 'sus4';
  if (t === 2 && f === 7) return 'sus2';
  return undefined;
}

const LETTER: Record<string, string> = {
  Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5',
  Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0',
  KeyQ: 'Q', KeyW: 'W', KeyE: 'E', KeyR: 'R', KeyT: 'T',
  KeyY: 'Y', KeyU: 'U', KeyI: 'I', KeyO: 'O', KeyP: 'P',
  KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyF: 'F', KeyG: 'G',
  KeyH: 'H', KeyJ: 'J', KeyK: 'K', KeyL: 'L', Semicolon: ';',
  KeyZ: 'Z', KeyX: 'X', KeyC: 'C', KeyV: 'V', KeyB: 'B',
  KeyN: 'N', KeyM: 'M', Comma: ',', Period: '.', Slash: '/',
};

export function Key({ code, row, step, className }: { code: string; row: RowId; step: number; className?: string }) {
  const active        = useStore((s) => s.activeCodes.has(code));
  const systemId      = useStore((s) => s.systemId);
  const mode          = useStore((s) => s.mode);
  const root          = useStore((s) => s.root);
  const baseOctave    = useStore((s) => s.baseOctave);
  const periodShift   = useStore((s) => s.periodShift);
  const activeScales  = useStore((s) => s.activeScales);
  const overrides     = useStore((s) => s.customMaps[s.systemId]);
  const ov            = overrides?.[code];
  const pickerCode    = useStore((s) => s.pickerCode);
  const pickerArmed   = useStore((s) => s.pickerArmed);
  const openPicker    = useStore((s) => s.openPicker);

  const sys = lookupSystem(systemId);
  const scaleId = activeScales[systemId] ?? sys.defaultScale;
  const scale = sys.scales.find((s) => s.id === scaleId) ?? sys.scales[0];

  const isDeleted  = mode === 'simple' && !!ov && typeof ov === 'object' && ov.deleted === true;
  const isOverride = mode === 'simple' && typeof ov === 'number';
  const pickerOpen = pickerCode === code;

  // Compute which grid step this key produces, and whether it sits inside the
  // active scale. All systems handled uniformly via grid math.
  const rootStep = sys.pcToStep[root] ?? 0;
  const gridSize = sys.grid.stepsCents.length;
  const scaleLen = scale.steps.length;

  // The "logical" grid step (relative to root) — same as what the resolver
  // produces from this physical key.
  let logicalGridStep: number;       // grid steps from root (can span periods)
  let totalPeriods: number;          // for label display
  let inContext: boolean;
  if (mode === 'simple') {
    const wraps  = Math.floor(step / scaleLen);
    const inScalePos = ((step % scaleLen) + scaleLen) % scaleLen;
    logicalGridStep = scale.steps[inScalePos] + wraps * gridSize;
    totalPeriods    = wraps + periodShift;
    inContext       = true;
  } else {
    logicalGridStep = step;
    totalPeriods    = Math.floor(step / gridSize) + periodShift;
    inContext = scaleStepFromGridStep(scale, sys.grid, step) !== null;
  }

  // Primary label — system labeler decides what to call it.
  const stepInPeriod = ((logicalGridStep % gridSize) + gridSize) % gridSize;
  const baseLabel = sys.labeler.labelStep(stepInPeriod, rootStep, sys.grid);
  let pitchLabel = sys.labeler.withPeriodMark(baseLabel, totalPeriods);

  // Greyed Western reference — shown only when the system's labeler is NOT
  // already Western (so we don't duplicate "C4" under "C4").
  let subLabel: string | null = null;
  if (sys.labeler.id !== 'western') {
    const centsFromRoot =
      stepToCents(sys.grid, logicalGridStep + rootStep) +
      periodShift * sys.grid.periodCents -
      stepToCents(sys.grid, rootStep);
    subLabel = westernReferenceFromCents(centsFromRoot, root, baseOctave);
  }

  // Chord-quality suffix (Dm, B°, F+, Csus4) — only meaningful for systems
  // whose chord rule is tertian (Western family). Drone / octaves / none
  // produce non-tertian vertical structures, so no suffix.
  const optionLock = useStore((s) => s.optionLock);
  if (optionLock && sys.chord.kind === 'triad' && inContext && sys.labeler.id === 'western') {
    const pressScalePos = mode === 'simple'
      ? ((step % scaleLen) + scaleLen) % scaleLen
      : scaleStepFromGridStep(scale, sys.grid, step);
    if (pressScalePos !== null) {
      const baseGridPos = Math.floor(logicalGridStep / gridSize) * gridSize;
      const pressCents = stepToCents(sys.grid, logicalGridStep + rootStep);
      const thirdGridStep = scale.steps[(pressScalePos + 2) % scaleLen]
                         + (Math.floor((pressScalePos + 2) / scaleLen)) * gridSize + baseGridPos;
      const fifthGridStep = scale.steps[(pressScalePos + 4) % scaleLen]
                         + (Math.floor((pressScalePos + 4) / scaleLen)) * gridSize + baseGridPos;
      const thirdSemi = Math.round((stepToCents(sys.grid, thirdGridStep + rootStep) - pressCents) / 100);
      const fifthSemi = Math.round((stepToCents(sys.grid, fifthGridStep + rootStep) - pressCents) / 100);
      const suffix = classifyTriadSuffix(thirdSemi, fifthSemi);
      if (suffix !== undefined) {
        const m = /^([A-G][b#]?)(-?\d+)$/.exec(pitchLabel);
        if (m) pitchLabel = `${m[1]}${suffix}${m[2]}`;
      }
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Prime AudioContext synchronously inside the user gesture (iOS Safari
    // requires resume() to be called within the gesture window).
    void ensureRunning();
    const s = useStore.getState();
    if (s.pickerArmed) { openPicker(code); return; }
    if (s.pickerCode) return;
    if (isDeleted) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    const a = resolveKeyDown(
      { code, shiftKey: false, altKey: s.optionLock, repeat: false },
      {
        root: s.root,
        baseOctave: s.baseOctave,
        periodShift: s.periodShift,
        systemId: s.systemId,
        mode: s.mode,
        activeScales: s.activeScales,
        customMaps: s.customMaps,
      },
      step,
    );
    if (a) void dispatch(a);
  };

  const onPointerEnd = () => {
    void dispatch({ type: 'NoteOff', code });
  };

  return (
    <div
      data-active={active}
      data-row={row}
      data-in-scale={inContext}
      data-deleted={isDeleted || undefined}
      data-override={isOverride || undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={{
        backgroundColor: isDeleted
          ? 'rgba(255, 255, 255, 0.02)'
          : active
            ? 'hsl(var(--inst-highlight) / 0.8)'
            : isOverride
              ? 'hsl(var(--inst-highlight) / 0.32)'
              : inContext
                ? 'hsl(var(--inst-highlight) / 0.2)'
                : 'rgba(255, 255, 255, 0.04)',
      }}
      className={cn(
        'inst-glass-key relative flex min-h-[72px] flex-col justify-between rounded-md p-2 transition-all duration-[120ms] ease-inst-pop touch-none select-none cursor-pointer',
        isDeleted && 'opacity-30',
        !isDeleted && !active && !inContext && 'opacity-80',
        active && 'translate-y-[1px] scale-[0.98] shadow-[0_0_22px_2px_hsl(var(--inst-highlight)/0.9)]',
        pickerArmed && 'cursor-crosshair ring-1 ring-inst-ring/40',
        pickerOpen && 'ring-2 ring-inst-ring',
        className
      )}
    >
      <div
        className={cn(
          'font-mono text-lg font-semibold',
          isDeleted ? 'text-inst-muted-foreground/60'
            : !active && inContext ? 'text-inst-highlight'
            : 'text-inst-foreground'
        )}
      >
        {LETTER[code]}
      </div>
      <div className="font-mono text-[10px] leading-tight text-inst-muted-foreground">
        {isDeleted ? '—' : pitchLabel}
      </div>
      {!isDeleted && subLabel && (
        <div className="font-mono text-[8.5px] leading-tight text-inst-muted-foreground/40">
          {subLabel}
        </div>
      )}
      {pickerOpen && <KeyPicker code={code} step={step} />}
    </div>
  );
}
