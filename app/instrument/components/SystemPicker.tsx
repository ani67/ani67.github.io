'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { SYSTEMS, SYSTEM_ORDER } from '../lib/tuning';
import { Tooltip } from './ui/tooltip';
import { cn } from '../lib/utils';

export function SystemPicker() {
  const systemId  = useStore((s) => s.systemId);
  const setSystem = useStore((s) => s.setSystem);

  const rows = useMemo(() => SYSTEM_ORDER.map((id) => SYSTEMS[id]).filter(Boolean), []);
  const currentIdx = Math.max(0, rows.findIndex((s) => s.id === systemId));

  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(currentIdx);
  const rootRef = useRef<HTMLDivElement>(null);

  const openPicker  = () => { setHighlightIdx(currentIdx); setOpen(true); };
  const togglePicker = () => (open ? setOpen(false) : openPicker());

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { e.preventDefault(); setOpen(false); }
      else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(rows.length - 1, i + 1));
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(0, i - 1));
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        const pick = rows[highlightIdx];
        if (pick) { setSystem(pick.id); setOpen(false); }
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, highlightIdx, rows, setSystem]);

  const current = SYSTEMS[systemId] ?? rows[0];

  return (
    <div ref={rootRef} className="relative inline-flex">
      <Tooltip content={<>Tuning system. Decides which pitches exist per octave and what scales are available.</>}>
        <button
          type="button"
          onClick={togglePicker}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground shrink-0">
            tuning
          </span>
          <span className="font-mono text-sm text-inst-foreground truncate max-w-[140px]">{current.label}</span>
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
            className={cn('text-inst-muted-foreground transition-transform', open && 'rotate-180')}
          >
            <path d="M2.5 4l2.5 2.5L7.5 4" />
          </svg>
        </button>
      </Tooltip>

      {open && (
        <div
          role="listbox"
          aria-label="tuning system"
          className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[180px] max-w-[calc(100vw-24px)] max-h-[60vh] overflow-y-auto rounded-2xl p-[1px]"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03), rgba(255,255,255,0.08))',
          }}
        >
          <div className="rounded-2xl bg-black/65 backdrop-blur-xl p-1">
            {rows.map((sys, i) => {
              const isCurrent     = sys.id === systemId;
              const isHighlighted = i === highlightIdx;
              return (
                <button
                  key={sys.id}
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  onPointerEnter={() => setHighlightIdx(i)}
                  onClick={() => { setSystem(sys.id); setOpen(false); }}
                  className={cn(
                    // py-2.5 on mobile (~44px touch target) collapses to py-1 on md+
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 md:py-1 text-left transition-colors min-w-0',
                    'focus:outline-none',
                    isHighlighted ? 'bg-white/[0.10]' : 'hover:bg-white/[0.06]',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'h-1.5 w-1.5 rounded-full shrink-0',
                      isCurrent ? 'bg-inst-highlight' : 'bg-transparent',
                    )}
                  />
                  <span className="font-mono text-sm text-inst-foreground truncate">{sys.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
