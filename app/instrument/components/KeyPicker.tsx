'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
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

interface Item {
  id: string;
  label: string;
  kind: 'pitch' | 'delete' | 'reset';
  isCurrent: boolean;
  apply: () => void;
  preview?: () => number[]; // freqs
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

  const items: Item[] = useMemo(() => {
    const baseMidi = 12 * (baseOctave + octaveShift + 1) + root;
    const rootHz   = midiToHz(baseMidi);
    const list: Item[] = [];

    if (tuning === '12tet') {
      const currentSemi =
        tetOv && !('deleted' in tetOv) ? tetOv.semitone : simpleStepToSemitone(chordScaleTET, step);
      for (let off = NEIGHBORS; off >= -NEIGHBORS; off--) {
        const semi = currentSemi + off;
        const midi = baseMidi + semi;
        list.push({
          id: `tet:${semi}`,
          label: midiToName(midi, root),
          kind: 'pitch',
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
        const labelTot = sruti + offset;
        const labelSru = ((labelTot % N_SRUTI) + N_SRUTI) % N_SRUTI;
        const labelOct = octaves + Math.floor(labelTot / N_SRUTI);
        list.push({
          id: `sruti:${total}`,
          label: svaraLabel(labelSru, labelOct),
          kind: 'pitch',
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

    list.push({
      id: 'delete',
      label: '✕  delete',
      kind: 'delete',
      isCurrent: false,
      apply: () => {
        const next: TETOverride | SrutiOverride =
          tuning === '12tet'
            ? { kind: 'tet',   deleted: true }
            : { kind: 'sruti', deleted: true };
        setOverride(code, next);
        closePicker();
      },
    });

    const overridden = tuning === '12tet' ? !!tetOv : !!srutiOv;
    if (overridden) {
      list.push({
        id: 'reset',
        label: '↺  reset',
        kind: 'reset',
        isCurrent: false,
        apply: () => {
          clearOverride(code);
          closePicker();
        },
      });
    }
    return list;
  }, [tuning, root, baseOctave, octaveShift, chordScaleTET, chordScaleSruti, tetOv, srutiOv, code, step, setOverride, clearOverride, closePicker]);

  const currentIdx = useMemo(
    () => Math.max(0, items.findIndex((i) => i.isCurrent)),
    [items]
  );
  const [highlightedIdx, setHighlightedIdx] = useState(currentIdx);

  // Reset highlight if items change shape (e.g. reset removed).
  useEffect(() => { setHighlightedIdx(currentIdx); }, [currentIdx]);

  const previewNote = (freqs: number[] | undefined) => {
    if (!freqs || freqs.length === 0) return;
    const previewCode = `__picker_preview__${code}`;
    void dispatch({ type: 'NoteOn', freqs, row: 1, code: previewCode });
    setTimeout(() => void dispatch({ type: 'NoteOff', code: previewCode }), 220);
  };

  // Preview when keyboard arrow moves the highlight.
  const lastPreviewedIdx = useRef(currentIdx);
  useEffect(() => {
    if (highlightedIdx !== lastPreviewedIdx.current) {
      lastPreviewedIdx.current = highlightedIdx;
      previewNote(items[highlightedIdx]?.preview?.());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedIdx]);

  // Keyboard nav: arrow up/down, enter, backspace = delete.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIdx((i) => Math.max(0, i - 1));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        items[highlightedIdx]?.apply();
      } else if (e.code === 'Backspace' || e.code === 'Delete') {
        e.preventDefault();
        const del = items.find((i) => i.kind === 'delete');
        del?.apply();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [items, highlightedIdx]);

  // Click outside backdrop also closes.
  const onBackdropClick = () => closePicker();

  return (
    <>
      {/* Blur backdrop — covers everything behind the picker */}
      <div
        data-key-picker
        onClick={onBackdropClick}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-md transition-opacity"
      />

      {/* Picker centered on the key */}
      <div
        data-key-picker
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 flex flex-col items-stretch gap-1.5 min-w-[160px]"
      >
        {items.map((it, i) => {
          const dist     = Math.abs(i - highlightedIdx);
          const opacity  = Math.max(0.25, 1 - dist * 0.18);
          const scale    = i === highlightedIdx ? 1.08 : Math.max(0.82, 1 - dist * 0.04);
          const isHighlighted = i === highlightedIdx;
          return (
            <button
              key={it.id}
              type="button"
              onPointerEnter={() => {
                setHighlightedIdx(i);
                previewNote(it.preview?.());
              }}
              onClick={it.apply}
              style={{ opacity, transform: `scale(${scale})` }}
              className={cn(
                'inst-glass-chip rounded-lg px-4 py-2 text-center font-mono text-sm',
                'transition-all duration-[140ms] ease-inst-out-expo',
                'focus:outline-none',
                isHighlighted && 'bg-white/[0.16] text-inst-foreground shadow-[0_0_24px_2px_hsl(var(--inst-highlight)/0.35)] ring-1 ring-inst-ring',
                !isHighlighted && 'text-inst-muted-foreground hover:text-inst-foreground',
                it.isCurrent && !isHighlighted && 'text-inst-foreground/80',
                (it.kind === 'delete' || it.kind === 'reset') && 'text-[12px] tracking-wide'
              )}
            >
              <span className="inline-flex items-center gap-2">
                {it.isCurrent && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-inst-highlight" />}
                {it.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
