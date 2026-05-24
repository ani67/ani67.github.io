import { useStore } from '../store/store';
import { cn } from '../lib/utils';
import type { RowId } from '../lib/types';
import { classifyTriad, isInScale, simpleStepToSemitone, triadInScale } from '../lib/keymap/scales';
import {
  isInRaga, PC_TO_SRUTI, simpleStepInRaga,
  SRUTI_LABELS, SRUTI_RATIOS, SRUTI_TO_NEAREST_SEMITONE,
} from '../lib/tuning/sruti';
import { midiToName } from '../lib/util';
import { resolveKeyDown } from '../lib/keymap/resolver';
import { dispatch } from '../lib/dispatch';
import { ensureRunning } from '../lib/audio/context';
import { KeyPicker } from './KeyPicker';

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

function svaraLabel(sruti: number, octaves: number): string {
  const name = SRUTI_LABELS[sruti];
  return octaves > 0 ? `${name}′${octaves > 1 ? octaves : ''}`
       : octaves < 0 ? `${name},${-octaves > 1 ? -octaves : ''}`
       : name;
}

export function Key({ code, row, step, className }: { code: string; row: RowId; step: number; className?: string }) {
  const active          = useStore((s) => s.activeCodes.has(code));
  const tuning          = useStore((s) => s.tuning);
  const mode            = useStore((s) => s.mode);
  const root            = useStore((s) => s.root);
  const baseOctave      = useStore((s) => s.baseOctave);
  const octaveShift     = useStore((s) => s.octaveShift);
  const chordScaleTET   = useStore((s) => s.chordScaleTET);
  const chordScaleSruti = useStore((s) => s.chordScaleSruti);
  const optionLock      = useStore((s) => s.optionLock);
  const tetOv           = useStore((s) => s.customMapTET[code]);
  const srutiOv         = useStore((s) => s.customMapSruti[code]);
  const pickerCode      = useStore((s) => s.pickerCode);
  const pickerArmed     = useStore((s) => s.pickerArmed);
  const openPicker      = useStore((s) => s.openPicker);

  const ov         = tuning === '12tet' ? tetOv : srutiOv;
  const isDeleted  = mode === 'simple' && !!ov && 'deleted' in ov;
  const isOverride = mode === 'simple' && !!ov && !('deleted' in ov);
  const pickerOpen = pickerCode === code;

  let pitchLabel: string;
  let subLabel: string | null = null;   // greyed second line — Western reference in Śruti mode
  let inContext: boolean;
  if (tuning === 'sruti') {
    // Fixed-Sa labelling: shift the svara labels by where root sits in the 22-śruti grid,
    // so the label on each key matches the absolute pitch it plays.
    const N      = SRUTI_RATIOS.length;
    const offset = PC_TO_SRUTI[root];

    let absSruti: number;
    let totalOct: number;
    if (mode === 'simple') {
      let sruti: number, octaves: number;
      if (srutiOv && !('deleted' in srutiOv)) {
        sruti   = srutiOv.sruti;
        octaves = srutiOv.octaves;
      } else {
        const r = simpleStepInRaga(chordScaleSruti, step);
        sruti   = r.sruti;
        octaves = r.octaves;
      }
      const total    = sruti + offset;
      absSruti       = ((total % N) + N) % N;
      const extraOct = Math.floor(total / N);
      totalOct       = octaves + extraOct;
      pitchLabel     = svaraLabel(absSruti, totalOct);
      inContext      = true;
    } else {
      const relSruti = ((step % N) + N) % N;
      const total    = step + offset;
      absSruti       = ((total % N) + N) % N;
      totalOct       = Math.floor(total / N);
      pitchLabel     = svaraLabel(absSruti, totalOct);
      inContext      = isInRaga(chordScaleSruti, relSruti);
    }
    // Western reference: nearest 12-TET semitone above absolute C-as-Sa, plus
    // octave register. Greyed below to read as "approximately."
    const nearestPc = SRUTI_TO_NEAREST_SEMITONE[absSruti];
    const refMidi   = 12 * (baseOctave + octaveShift + 1) + nearestPc + totalOct * 12;
    subLabel = midiToName(refMidi, root);
  } else {
    let midi: number;
    let semitoneFromRoot: number;
    let isInScalePress: boolean;
    if (mode === 'simple') {
      semitoneFromRoot =
        tetOv && !('deleted' in tetOv) ? tetOv.semitone : simpleStepToSemitone(chordScaleTET, step);
      midi             = 12 * (baseOctave + octaveShift + 1) + root + semitoneFromRoot;
      isInScalePress   = true;   // simple mode always walks the scale
      inContext        = true;
    } else {
      semitoneFromRoot = step;
      midi             = 12 * (baseOctave + octaveShift + 1) + root + step;
      isInScalePress   = isInScale(chordScaleTET, step);
      inContext        = isInScalePress;
    }
    pitchLabel = midiToName(midi, root);
    // Chord-quality suffix — when chord toggle is on AND we're pressing a key
    // whose triad lives in the current scale, classify the [0, +3rd, +5th]
    // shape into a Western chord suffix (m, °, +, sus2, sus4). Out-of-scale
    // chromatic keys with chord-on get no suffix — the resolver builds a
    // snap-in colour-tone chord which doesn't have a clean Western name.
    if (optionLock && isInScalePress) {
      const offsets = triadInScale(chordScaleTET, semitoneFromRoot);
      if (offsets) {
        const suffix = classifyTriad(offsets);
        if (suffix !== undefined) {
          // Insert the suffix between pitch and octave: "D4" → "Dm4".
          const m = /^([A-G][b#]?)(-?\d+)$/.exec(pitchLabel);
          if (m) pitchLabel = `${m[1]}${suffix}${m[2]}`;
        }
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
        octaveShift: s.octaveShift,
        tuning: s.tuning,
        mode: s.mode,
        chordScaleTET:   s.chordScaleTET,
        chordScaleSruti: s.chordScaleSruti,
        customMapTET:    s.customMapTET,
        customMapSruti:  s.customMapSruti,
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
