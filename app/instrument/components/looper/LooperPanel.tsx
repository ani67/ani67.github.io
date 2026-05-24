'use client';

import { useEffect } from 'react';
import { useStore } from '../../store/store';
import { cn } from '../../lib/utils';
import { LayerSlot } from './LayerSlot';
import { TransportBar } from './TransportBar';

/**
 * Looper panel — the collapsible widget under the keyboard. Renders only when
 * the looper feature is enabled in the store; otherwise the surrounding
 * Instrument layout shows the keyboard alone.
 */
export function LooperPanel() {
  const open    = useStore((s) => s.looperOpen);
  const setOpen = useStore((s) => s.setLooperOpen);
  const layers  = useStore((s) => s.layers);
  const clearAll = useStore((s) => s.clearAllLayers);

  // Wire up Space-bar play/stop when the panel is mounted, since this is a
  // looper-only affordance. Skip if focus is in a text input (voice editor).
  const start = useStore((s) => s.startTransport);
  const stop  = useStore((s) => s.stopTransport);
  const running = useStore((s) => s.transportRunning);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      if (running) stop(); else start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, start, stop]);

  return (
    <section
      className={cn(
        'w-full rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-xl',
      )}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-inst-muted-foreground hover:text-inst-foreground transition-colors focus:outline-none focus-visible:text-inst-foreground"
        >
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
            className={cn('transition-transform', !open && '-rotate-90')}
          >
            <path d="M2.5 4l2.5 2.5L7.5 4" />
          </svg>
          looper
        </button>
        {open && (
          <button
            type="button"
            onClick={clearAll}
            className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground hover:text-inst-foreground transition-colors"
          >
            clear all
          </button>
        )}
      </header>

      {open && (
        <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-3">
          <TransportBar />
          <div className="flex flex-col gap-2 pt-1">
            {layers.map((L) => <LayerSlot key={L.id} layer={L} />)}
          </div>
        </div>
      )}
    </section>
  );
}
