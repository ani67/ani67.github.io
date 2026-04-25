'use client';
import { useEffect } from 'react';
import { useStore } from '../store/store';
import type { SrutiOverride, TETOverride } from '../store/store';
import { cn } from '../lib/utils';
import { simpleStepToSemitone } from '../lib/keymap/scales';
import { simpleStepInRaga, srutiToHz, SRUTI_LABELS, SRUTI_RATIOS, PC_TO_SRUTI } from '../lib/tuning/sruti';
import { midiToHz, midiToName } from '../lib/util';
import { dispatch } from '../lib/dispatch';

const NEIGHBORS = 5;
const N_SRUTI = SRUTI_RATIOS.length; // 22

function svaraLabel(sruti: number, octaves: number): string {
  const name = SRUTI_LABELS[sruti];
  return octaves > 0 ? `${name}′${octaves > 1 ? octaves : ''}`
       : octaves < 0 ? `${name},${-octaves > 1 ? -octaves : ''}`
       : name;
}

interface Option {
  id: string;
  label: string;
  isCurrent: boolean;
  apply: () => void;
  preview: () => number[]; // freqs
}

export function KeyPicker({ code, step }: { code: string; step: number }) {
  const tuning          = useStore((s) => s.tuning);
  const root            = useStore((s) => s.root);
  const baseOctave      = useStore((s) => s.baseOctave);
  const octaveShift     = useStore((s) => s.octaveShift);
  const chordScaleTET   = useStore((s) => s.chordScaleTET);
  const chordScaleSruti = useStore((s) => s.chordScaleSruti);
  const tetOv           = useStore((s) => s.customMapTET[code]);
  const srutiOv         = useStore((s) => s.customMapSruti[code]);
  const setOverride     = useStore((s) => s.setOverride);
  const clearOverride   = useStore((s) => s.clearOverride);
  const closePicker     = useStore((s) => s.closePicker);

  const baseMidi = 12 * (baseOctave + octaveShift + 1) + root;
  const rootHz   = midiToHz(baseMidi);
  const isOverridden = tuning === '12tet' ? !!tetOv : !!srutiOv;

  const options: Option[] = [];

  if (tuning === '12tet') {
    const currentSemi =
      tetOv && !('deleted' in tetOv) ? tetOv.semitone : simpleStepToSemitone(chordScaleTET, step);

    for (let off = NEIGHBORS; off >= -NEIGHBORS; off--) {
      const semi = currentSemi + off;
      const midi = baseMidi + semi;
      options.push({
        id: `tet:${semi}`,
        label: midiToName(midi),
        isCurrent: off === 0,
        apply: () => {
          const next: TETOverride = { kind: 'tet', semitone: semi };
          setOverride(code, next);
          closePicker();
        },
        preview: () => [midiToHz(midi)],
      });
    }
  } else {
    let curSruti: number, curOct: number;
    if (srutiOv && !('deleted' in srutiOv)) {
      curSruti = srutiOv.sruti;
      curOct   = srutiOv.octaves;
    } else {
      const r = simpleStepInRaga(chordScaleSruti, step);
      curSruti = r.sruti;
      curOct   = r.octaves;
    }
    const offset = PC_TO_SRUTI[root];
    const total0 = curSruti + curOct * N_SRUTI;

    for (let off = NEIGHBORS; off >= -NEIGHBORS; off--) {
      const total    = total0 + off;
      const sruti    = ((total % N_SRUTI) + N_SRUTI) % N_SRUTI;
      const octaves  = Math.floor(total / N_SRUTI);
      // Display label with fixed-Sa offset, matching what Key.tsx shows.
      const labelTot = sruti + offset;
      const labelSru = ((labelTot % N_SRUTI) + N_SRUTI) % N_SRUTI;
      const labelOct = octaves + Math.floor(labelTot / N_SRUTI);
      options.push({
        id: `sruti:${total}`,
        label: svaraLabel(labelSru, labelOct),
        isCurrent: off === 0,
        apply: () => {
          const next: SrutiOverride = { kind: 'sruti', sruti, octaves };
          setOverride(code, next);
          closePicker();
        },
        preview: () => [srutiToHz(rootHz, sruti, octaves)],
      });
    }
  }

  const onDelete = () => {
    const next: TETOverride | SrutiOverride =
      tuning === '12tet'
        ? { kind: 'tet',   deleted: true }
        : { kind: 'sruti', deleted: true };
    setOverride(code, next);
    closePicker();
  };

  const onReset = () => {
    clearOverride(code);
    closePicker();
  };

  // Click outside / Esc handled in useKeyboard, but a backdrop catches misclicks too.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-key-picker]')) closePicker();
    };
    // Defer registration until after the click that opened the picker has settled.
    const t = setTimeout(() => document.addEventListener('pointerdown', onPointerDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [closePicker]);

  const previewNote = (freqs: number[]) => {
    const previewCode = `__picker_preview__${code}`;
    void dispatch({ type: 'NoteOn', freqs, row: 1, code: previewCode });
    setTimeout(() => void dispatch({ type: 'NoteOff', code: previewCode }), 220);
  };

  return (
    <div
      data-key-picker
      className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 inst-glass-chip rounded-lg p-1 flex flex-col gap-0.5 min-w-[120px]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={opt.apply}
          onPointerEnter={() => previewNote(opt.preview())}
          className={cn(
            'rounded px-3 py-1 text-left font-mono text-xs transition-colors hover:bg-white/[0.10]',
            opt.isCurrent && 'bg-white/[0.10] text-inst-foreground',
            !opt.isCurrent && 'text-inst-muted-foreground hover:text-inst-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
      <div className="my-0.5 h-px bg-white/[0.08]" />
      <button
        type="button"
        onClick={onDelete}
        className="rounded px-3 py-1 text-left font-mono text-xs text-inst-muted-foreground transition-colors hover:bg-white/[0.10] hover:text-inst-foreground"
      >
        ✕  delete
      </button>
      {isOverridden && (
        <button
          type="button"
          onClick={onReset}
          className="rounded px-3 py-1 text-left font-mono text-xs text-inst-muted-foreground transition-colors hover:bg-white/[0.10] hover:text-inst-foreground"
        >
          ↺  reset
        </button>
      )}
    </div>
  );
}
