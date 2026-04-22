import { useStore } from '../store/store';
import { cn } from '../lib/utils';
import type { RowId } from '../lib/types';
import { positionToStep } from '../lib/keymap/grid';
import { isInScale, simpleStepToSemitone } from '../lib/keymap/scales';
import { isInRaga, simpleStepInRaga, SRUTI_LABELS, SRUTI_RATIOS } from '../lib/tuning/sruti';
import { midiToName } from '../lib/util';

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
  return octaves > 0 ? `${name}′${octaves > 1 ? octaves : ''}` : name;
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

  const step = positionToStep(row, degree);

  let pitchLabel: string;
  let inContext: boolean;
  if (tuning === 'sruti') {
    if (mode === 'simple') {
      const { sruti, octaves } = simpleStepInRaga(chordScaleSruti, step);
      pitchLabel = svaraLabel(sruti, octaves);
      inContext  = true;
    } else {
      const sruti   = step % SRUTI_RATIOS.length;
      const octaves = Math.floor(step / SRUTI_RATIOS.length);
      pitchLabel    = svaraLabel(sruti, octaves);
      inContext     = isInRaga(chordScaleSruti, sruti);
    }
  } else {
    if (mode === 'simple') {
      const semitone = simpleStepToSemitone(chordScaleTET, step);
      const midi     = 12 * (baseOctave + octaveShift + 1) + root + semitone;
      pitchLabel     = midiToName(midi);
      inContext      = true;
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
      style={{
        backgroundColor: active
          ? 'hsl(var(--inst-highlight) / 0.8)'
          : inContext
            ? 'hsl(var(--inst-highlight) / 0.2)'
            : 'rgba(255, 255, 255, 0.04)',
      }}
      className={cn(
        'inst-glass-key relative flex min-h-[72px] flex-col justify-between rounded-md p-2 transition-all duration-[120ms] ease-inst-pop',
        !active && !inContext && 'opacity-80',
        active && 'translate-y-[1px] scale-[0.98] shadow-[0_0_22px_2px_hsl(var(--inst-highlight)/0.9)]'
      )}
    >
      <div className={cn('font-mono text-lg font-semibold', !active && inContext ? 'text-inst-highlight' : 'text-inst-foreground')}>
        {LETTER[code]}
      </div>
      <div className="font-mono text-[10px] text-inst-muted-foreground">{pitchLabel}</div>
    </div>
  );
}
