'use client';

import { useEffect } from 'react';
import { useStore } from '../../store/store';
import type { LayerUI } from '../../store/store';
import { cn } from '../../lib/utils';
import { Tooltip } from '../ui/tooltip';
import { TransportBar } from './TransportBar';
import { LayerSlot } from './LayerSlot';

/**
 * LooperDock — bottom-fixed dock that's the looper's home on every breakpoint.
 *
 * Collapsed: a thin strip across the bottom of the viewport showing transport,
 * 8 small layer-status dots, count-in, and an expand chevron. Always visible
 * when the looper is enabled. Native mobile-bottom-sheet pattern, and the same
 * pattern reads cleanly on desktop as a docked panel.
 *
 * Expanded: a sheet rises above the strip with the full TransportBar + 8 layer
 * rows. The strip stays visible at the bottom (its chevron flipped) so the
 * sheet feels anchored, not floating.
 *
 * Closing the sheet does *not* turn off the looper — that's the header chip.
 * Closing just collapses; layers keep playing, transport keeps running.
 */
export function LooperDock() {
  const open    = useStore((s) => s.looperOpen);
  const setOpen = useStore((s) => s.setLooperOpen);
  const layers  = useStore((s) => s.layers);
  const clearAll = useStore((s) => s.clearAllLayers);

  // Spacebar toggles play/stop while the dock is mounted. Skip when typing.
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
    <div className="fixed bottom-0 left-0 right-0 z-40 flex flex-col items-stretch pointer-events-none">
      {/* Sheet — the expanded portion, rising above the strip. */}
      {open && (
        <div
          className="pointer-events-auto mx-auto w-full max-w-[1100px] px-3 pb-0"
          role="region"
          aria-label="looper layers"
        >
          <div
            className="rounded-t-2xl border border-b-0 border-white/[0.08] bg-black/70 backdrop-blur-xl px-4 py-3"
            style={{
              boxShadow:
                '0 -8px 32px -8px hsl(0 0% 0% / 0.4), 0 -1px 0 0 hsl(0 0% 100% / 0.04) inset',
            }}
          >
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
              <TransportBar />
              <button
                type="button"
                onClick={clearAll}
                className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground hover:text-inst-foreground transition-colors shrink-0"
              >
                clear all
              </button>
            </div>
            <div className="flex flex-col gap-2 pt-3">
              {layers.map((L) => <LayerSlot key={L.id} layer={L} />)}
            </div>
          </div>
        </div>
      )}

      {/* Strip — always visible. Sits flush at the bottom; on mobile this is
          the entire affordance, tap-chevron to expand. */}
      <div
        className={cn(
          'pointer-events-auto border-t border-white/[0.08] bg-black/75 backdrop-blur-xl',
          // Sheet has rounded top, strip is square so they read as one unit.
        )}
      >
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-2 sm:gap-3 px-3 sm:px-4 h-9 sm:h-11">
          <PlayStop />
          <LayerDots layers={layers} />
          <CountInBadge />
          <span className="flex-1" />
          <BpmCompact />
          <ExpandChevron open={open} onToggle={() => setOpen(!open)} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Strip pieces — small, single-purpose components.
// ---------------------------------------------------------------------------

function PlayStop() {
  const running = useStore((s) => s.transportRunning);
  const start   = useStore((s) => s.startTransport);
  const stop    = useStore((s) => s.stopTransport);

  return (
    <Tooltip placement="top" content={running ? <>Stop</> : <>Play (1-bar count-in)</>}>
      <button
        type="button"
        onClick={() => (running ? stop() : start())}
        aria-label={running ? 'stop' : 'play'}
        className={cn(
          'inst-glass-chip inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full shrink-0',
          'transition-colors duration-[220ms] hover:bg-white/[0.10]',
          running && 'bg-white/[0.14]',
        )}
      >
        {running ? (
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
            <rect x="1.5" y="1.5" width="7" height="7" rx="0.5" fill="currentColor" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 11 11" aria-hidden>
            <polygon points="2.5,1.5 9,5.5 2.5,9.5" fill="currentColor" />
          </svg>
        )}
      </button>
    </Tooltip>
  );
}

function LayerDots({ layers }: { layers: LayerUI[] }) {
  const arm = useStore((s) => s.armRecordLayer);
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
      {layers.map((L) => (
        <LayerDot key={L.id} layer={L} onTap={() => arm(L.id)} />
      ))}
    </div>
  );
}

function LayerDot({ layer, onTap }: { layer: LayerUI; onTap: () => void }) {
  const recording = layer.state === 'recording';
  const armed     = layer.state === 'armed';
  const looping   = layer.state === 'looping';
  const muted     = looping && !layer.enabled;

  return (
    <Tooltip placement="top" content={<>L{layer.id + 1} — {recording ? 'recording' : armed ? 'armed' : looping ? (muted ? 'muted' : 'looping') : 'tap to record'}</>}>
      <button
        type="button"
        onClick={onTap}
        aria-label={`layer ${layer.id + 1}`}
        className={cn(
          'h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full transition-all duration-[180ms]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring',
          // Default empty: hollow ring.
          !recording && !armed && !looping && 'border border-white/[0.30] hover:border-white/[0.60]',
          armed && 'border border-white/70 animate-pulse',
          recording && 'bg-red-500',
          looping && !muted && 'bg-white',
          looping && muted && 'bg-white/[0.30]',
        )}
      />
    </Tooltip>
  );
}

function CountInBadge() {
  const countIn = useStore((s) => s.countInRemaining);
  if (countIn === null) return null;
  return (
    <span className="font-mono text-xs sm:text-sm text-inst-foreground tabular-nums shrink-0 px-1">
      {countIn}
    </span>
  );
}

function BpmCompact() {
  // Just a readout; the full +/- stepper lives in the expanded sheet.
  const bpm = useStore((s) => s.bpm);
  return (
    <Tooltip placement="top" content={<>Tempo — expand the dock to adjust.</>}>
      <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground shrink-0">
        <span>bpm</span>
        <span className="text-inst-foreground tabular-nums text-sm normal-case tracking-normal">{bpm}</span>
      </span>
    </Tooltip>
  );
}

function ExpandChevron({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Tooltip placement="top" content={open ? <>Collapse</> : <>Expand looper</>}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? 'collapse looper' : 'expand looper'}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-inst-muted-foreground hover:bg-white/[0.06] hover:text-inst-foreground transition-colors shrink-0"
      >
        <svg
          width="11" height="11" viewBox="0 0 10 10" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className={cn('transition-transform duration-[220ms]', open ? 'rotate-180' : '')}
          aria-hidden
        >
          <path d="M2.5 6.5l2.5 -2.5L7.5 6.5" />
        </svg>
      </button>
    </Tooltip>
  );
}
