import { useStore } from '../store/store';
import { cn } from '../lib/utils';
import type { RowId } from '../lib/types';
import { positionToStep } from '../lib/keymap/grid';
import { isInScale, simpleStepToSemitone } from '../lib/keymap/scales';
import { isInRaga, PC_TO_SRUTI, simpleStepInRaga, SRUTI_LABELS, SRUTI_RATIOS } from '../lib/tuning/sruti';
import { midiToName } from '../lib/util';
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

export function Key({ code, row, degree }: { code: string; row: RowId; degree: number }) {
  const active          = useStore((s) => s.activeCodes.has(code));
  const tuning          = useStore((s) => s.tuning);
  const mode            = useStore((s) => s.mode);
  const root            = useStore((s) => s.root);
  const baseOctave      = useStore((s) => s.baseOctave);
  const octaveShift     = useStore((s) => s.octaveShift);
  const chordScaleTET   = useStore((s) => s.chordScaleTET);
  const chordScaleSruti = useStore((s) => s.chordScaleSruti);
  const tetOv           = useStore((s) => s.customMapTET[code]);
  const srutiOv         = useStore((s) => s.customMapSruti[code]);
  const pickerCode      = useStore((s) => s.pickerCode);
  const pickerArmed     = useStore((s) => s.pickerArmed);
  const openPicker      = useStore((s) => s.openPicker);

  const step = positionToStep(row, degree);
  const ov         = tuning === '12tet' ? tetOv : srutiOv;
  const isDeleted  = mode === 'simple' && !!ov && 'deleted' in ov;
  const isOverride = mode === 'simple' && !!ov && !('deleted' in ov);
  const pickerOpen = pickerCode === code;

  let pitchLabel: string;
  let inContext: boolean;
  if (tuning === 'sruti') {
    // Fixed-Sa labelling: shift the svara labels by where root sits in the 22-śruti grid,
    // so the label on each key matches the absolute pitch it plays.
    const N      = SRUTI_RATIOS.length;
    const offset = PC_TO_SRUTI[root];
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
      const absSruti = ((total % N) + N) % N;
      const extraOct = Math.floor(total / N);
      pitchLabel = svaraLabel(absSruti, octaves + extraOct);
      inContext  = true;
    } else {
      const relSruti = ((step % N) + N) % N;
      const total    = step + offset;
      const absSruti = ((total % N) + N) % N;
      const absOct   = Math.floor(total / N);
      pitchLabel     = svaraLabel(absSruti, absOct);
      inContext      = isInRaga(chordScaleSruti, relSruti);
    }
  } else {
    if (mode === 'simple') {
      const semitone =
        tetOv && !('deleted' in tetOv) ? tetOv.semitone : simpleStepToSemitone(chordScaleTET, step);
      const midi = 12 * (baseOctave + octaveShift + 1) + root + semitone;
      pitchLabel = midiToName(midi);
      inContext  = true;
    } else {
      const midi = 12 * (baseOctave + octaveShift + 1) + root + step;
      pitchLabel = midiToName(midi);
      inContext  = isInScale(chordScaleTET, step);
    }
  }

  return (
    <div
      data-active={active}
      data-row={row}
      data-in-scale={inContext}
      data-deleted={isDeleted || undefined}
      data-override={isOverride || undefined}
      onClick={() => { if (pickerArmed) openPicker(code); }}
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
        'inst-glass-key relative flex min-h-[72px] flex-col justify-between rounded-md p-2 transition-all duration-[120ms] ease-inst-pop',
        isDeleted && 'opacity-30',
        !isDeleted && !active && !inContext && 'opacity-80',
        active && 'translate-y-[1px] scale-[0.98] shadow-[0_0_22px_2px_hsl(var(--inst-highlight)/0.9)]',
        pickerArmed && 'cursor-crosshair ring-1 ring-inst-ring/40',
        pickerOpen && 'ring-2 ring-inst-ring'
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
      <div className="font-mono text-[10px] text-inst-muted-foreground">
        {isDeleted ? '—' : pitchLabel}
      </div>
      {pickerOpen && <KeyPicker code={code} step={step} />}
    </div>
  );
}
