'use client';

import { useEffect, useState } from 'react';
import { useStore } from '../../store/store';
import { subscribe as subscribeTransport } from '../../lib/transport/transport';
import { cn } from '../../lib/utils';
import { Tooltip } from '../ui/tooltip';

/**
 * TransportBar — play/stop, BPM, metronome, count-in indicator, beat pulse.
 * The beat pulse subscribes to the transport directly (not via Zustand) to
 * avoid re-rendering the rest of the panel at beat rate.
 */
export function TransportBar() {
  const running     = useStore((s) => s.transportRunning);
  const bpm         = useStore((s) => s.bpm);
  const metronomeOn = useStore((s) => s.metronomeOn);
  const beatsPerBar = useStore((s) => s.beatsPerBar);
  const countIn     = useStore((s) => s.countInRemaining);

  const start       = useStore((s) => s.startTransport);
  const stop        = useStore((s) => s.stopTransport);
  const setBpm      = useStore((s) => s.setBpm);
  const setMet      = useStore((s) => s.setMetronomeOn);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tooltip content={running ? <>Stop the transport. Clears the count-in and silences all looping layers.</> : <>Start the transport with a 1-bar count-in. Layers begin playing back from the loop boundary.</>}>
        <button
          type="button"
          onClick={() => (running ? stop() : start())}
          aria-label={running ? 'stop transport' : 'start transport'}
          className={cn(
            'inst-glass-chip inline-flex h-8 w-8 items-center justify-center rounded-full',
            'transition-colors duration-[220ms] hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring',
            running ? 'bg-white/[0.12]' : '',
          )}
        >
          {running ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <rect x="1.5" y="1.5" width="7" height="7" rx="0.5" fill="currentColor" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
              <polygon points="2.5,1.5 9,5.5 2.5,9.5" fill="currentColor" />
            </svg>
          )}
        </button>
      </Tooltip>

      <BpmStepper bpm={bpm} setBpm={setBpm} disabled={running} />

      <Tooltip content={<>Metronome — audible click each beat, accented on the downbeat. The 1-bar count-in always plays regardless of this toggle.</>}>
        <button
          type="button"
          onClick={() => setMet(!metronomeOn)}
          aria-pressed={metronomeOn}
          aria-label={metronomeOn ? 'metronome on' : 'metronome off'}
          className={cn(
            'inst-glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1',
            'transition-colors duration-[220ms] hover:bg-white/[0.08]',
            metronomeOn ? 'bg-white/[0.12]' : '',
          )}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
            <path d="M3 1 L7 1 L9 9.5 L2 9.5 Z" />
            <line x1="5.5" y1="3" x2="5.5" y2="8" />
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
            click
          </span>
        </button>
      </Tooltip>

      <BeatIndicator beatsPerBar={beatsPerBar} running={running} />

      {countIn !== null && (
        <span className="font-mono text-sm text-inst-foreground tabular-nums">
          <span className="text-inst-muted-foreground text-[10px] uppercase tracking-widest mr-2">
            count-in
          </span>
          {countIn}
        </span>
      )}
    </div>
  );
}

function BpmStepper({ bpm, setBpm, disabled }: { bpm: number; setBpm: (n: number) => void; disabled: boolean }) {
  return (
    <Tooltip content={<>Beats per minute. Disabled while the transport is running — stop to change.</>}>
      <span
        className={cn(
          'inst-glass-chip inline-flex items-center gap-1 rounded-full pl-1 pr-1 py-0.5',
          disabled && 'opacity-60',
        )}
      >
        <button
          type="button"
          onClick={() => setBpm(bpm - 1)}
          disabled={disabled}
          aria-label="decrease bpm"
          className="h-6 w-6 rounded-full font-mono text-sm text-inst-muted-foreground hover:bg-white/[0.08] hover:text-inst-foreground disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
        >
          −
        </button>
        <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">bpm</span>
        <span className="font-mono text-sm text-inst-foreground tabular-nums min-w-[28px] text-center">{bpm}</span>
        <button
          type="button"
          onClick={() => setBpm(bpm + 1)}
          disabled={disabled}
          aria-label="increase bpm"
          className="h-6 w-6 rounded-full font-mono text-sm text-inst-muted-foreground hover:bg-white/[0.08] hover:text-inst-foreground disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
        >
          +
        </button>
      </span>
    </Tooltip>
  );
}

function BeatIndicator({ beatsPerBar, running }: { beatsPerBar: number; running: boolean }) {
  const [beat, setBeat] = useState<number | null>(null);

  // Subscribe only while the transport is actually running. When `running`
  // flips off, the effect cleanup unsubscribes and we render beat=null below
  // — no setState inside the effect just to clear it.
  useEffect(() => {
    if (!running) return;
    return subscribeTransport((e) => {
      if (e.kind === 'beat-tick') setBeat(e.beatInBar);
    });
  }, [running]);

  const displayBeat = running ? beat : null;

  return (
    <span className="flex items-center gap-1.5 px-1" aria-hidden>
      {Array.from({ length: beatsPerBar }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full transition-all duration-[120ms]',
            displayBeat === i
              ? 'bg-[hsl(var(--inst-highlight))] scale-125'
              : 'bg-white/[0.18]',
          )}
        />
      ))}
    </span>
  );
}
