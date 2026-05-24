'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/store';
import type { CentsOverride } from '../store/store';
import { cn } from '../lib/utils';
import { midiToHz } from '../lib/util';
import { dispatch } from '../lib/dispatch';
import {
  lookupSystem, scaleStepFromGridStep, stepToCents,
} from '../lib/tuning';

const NEIGHBORS = 5;

interface Item {
  id: string;
  label: string;
  kind: 'pitch' | 'delete' | 'reset';
  isCurrent: boolean;
  apply: () => void;
  preview?: () => number[];
}

export function KeyPicker({ code, step }: { code: string; step: number }) {
  const systemId      = useStore((s) => s.systemId);
  const root          = useStore((s) => s.root);
  const baseOctave    = useStore((s) => s.baseOctave);
  const periodShift   = useStore((s) => s.periodShift);
  const activeScales  = useStore((s) => s.activeScales);
  const overrides     = useStore((s) => s.customMaps[s.systemId]);
  const ov            = overrides?.[code];
  const setOverride   = useStore((s) => s.setOverride);
  const clearOverride = useStore((s) => s.clearOverride);
  const closePicker   = useStore((s) => s.closePicker);

  const items: Item[] = useMemo(() => {
    const sys      = lookupSystem(systemId);
    const scaleId  = activeScales[systemId] ?? sys.defaultScale;
    const scale    = sys.scales.find((s) => s.id === scaleId) ?? sys.scales[0];
    const rootStep = sys.pcToStep[root] ?? 0;
    const gridSize = sys.grid.stepsCents.length;
    const baseMidi = 12 * (baseOctave + 1) + root;
    const baseRootHz = midiToHz(baseMidi);

    // The "current" cents value — what the key would play right now.
    let currentCents: number;
    if (typeof ov === 'number') {
      currentCents = ov;
    } else {
      // Walk the scale to find the natural step.
      const L = scale.steps.length;
      const wraps = Math.floor(step / L);
      const inScalePos = ((step % L) + L) % L;
      const gridStep = scale.steps[inScalePos] + wraps * gridSize;
      currentCents = stepToCents(sys.grid, gridStep + rootStep) -
                     stepToCents(sys.grid, rootStep);
    }

    const list: Item[] = [];

    // Show NEIGHBORS grid steps above and below the current pitch.
    const currentCentsForLabel = currentCents;
    // Find the grid step nearest to currentCents (in absolute cents from root).
    let nearestStep = 0;
    let nearestDiff = Infinity;
    const allSteps = sys.grid.stepsCents;
    for (let s = -2 * gridSize; s < 2 * gridSize; s++) {
      const c = stepToCents(sys.grid, s + rootStep) - stepToCents(sys.grid, rootStep);
      const d = Math.abs(c - currentCentsForLabel);
      if (d < nearestDiff) { nearestDiff = d; nearestStep = s; }
    }
    void allSteps;

    for (let off = NEIGHBORS; off >= -NEIGHBORS; off--) {
      const gridStep = nearestStep + off;
      const cents = stepToCents(sys.grid, gridStep + rootStep) -
                    stepToCents(sys.grid, rootStep);
      const stepInPeriod = ((gridStep % gridSize) + gridSize) % gridSize;
      const totalPeriods = Math.floor(gridStep / gridSize);
      const base = sys.labeler.labelStep(stepInPeriod, rootStep, sys.grid);
      const label = sys.labeler.withPeriodMark(base, totalPeriods);
      const inScale = scaleStepFromGridStep(scale, sys.grid, gridStep) !== null;
      void inScale;
      list.push({
        id: `step:${gridStep}`,
        label,
        kind: 'pitch',
        isCurrent: off === 0,
        apply: () => {
          setOverride(code, cents);
          closePicker();
        },
        preview: () => [baseRootHz * Math.pow(2, (cents + periodShift * sys.grid.periodCents) / 1200)],
      });
    }

    list.push({
      id: 'delete',
      label: '✕  delete',
      kind: 'delete',
      isCurrent: false,
      apply: () => {
        const next: CentsOverride = { deleted: true };
        setOverride(code, next);
        closePicker();
      },
    });

    if (ov !== undefined) {
      list.push({
        id: 'reset',
        label: '↺  reset',
        kind: 'reset',
        isCurrent: false,
        apply: () => { clearOverride(code); closePicker(); },
      });
    }
    return list;
  }, [systemId, root, baseOctave, periodShift, activeScales, ov, code, step, setOverride, clearOverride, closePicker]);

  const currentIdx = useMemo(
    () => Math.max(0, items.findIndex((i) => i.isCurrent)),
    [items]
  );
  const [highlightedIdx, setHighlightedIdx] = useState(currentIdx);

  const lastPreviewedIdx = useRef(currentIdx);
  useEffect(() => { setHighlightedIdx(currentIdx); lastPreviewedIdx.current = currentIdx; }, [currentIdx]);

  const previewNote = (freqs: number[] | undefined) => {
    if (!freqs || freqs.length === 0) return;
    const previewCode = `__picker_preview__${code}`;
    void dispatch({ type: 'NoteOn', freqs, row: 1, code: previewCode });
    setTimeout(() => void dispatch({ type: 'NoteOff', code: previewCode }), 220);
  };

  useEffect(() => {
    if (highlightedIdx !== lastPreviewedIdx.current) {
      lastPreviewedIdx.current = highlightedIdx;
      previewNote(items[highlightedIdx]?.preview?.());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedIdx]);

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
        items.find((i) => i.kind === 'delete')?.apply();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [items, highlightedIdx]);

  return (
    <>
      <div
        data-key-picker
        onClick={() => closePicker()}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-md transition-opacity"
      />
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
