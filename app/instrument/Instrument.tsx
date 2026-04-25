'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useStore } from './store/store';
import { ensureRunning } from './lib/audio/context';
import { useKeyboard } from './hooks/useKeyboard';
import { AudioStatus } from './components/AudioStatus';
import { RecordButton } from './components/RecordButton';
import { Keyboard } from './components/Keyboard';
import { Pill } from './components/ui/pill';
import { Kbd } from './components/ui/kbd';
import { TuningToggle } from './components/TuningToggle';
import { ModeToggle } from './components/ModeToggle';
import { ChordContext } from './components/ChordContext';
import { OptionToggle } from './components/OptionToggle';
import { PITCH_CLASS_NAMES } from './lib/util';
import { PC_TO_SRUTI, SRUTI_LABELS } from './lib/tuning/sruti';
import { extractAccent, applyAccent } from './lib/accent';

export function Instrument() {
  useKeyboard();

  const tuning = useStore((s) => s.tuning);
  const root   = useStore((s) => s.root);
  const oct    = useStore((s) => s.octaveShift);

  const rootName    = PITCH_CLASS_NAMES[root];
  const tonicSvara  = SRUTI_LABELS[PC_TO_SRUTI[root]];
  const octLabel    = oct === 0 ? '±0' : oct > 0 ? `+${oct}` : `${oct}`;

  // First click anywhere unlocks audio.
  useEffect(() => {
    const onDown = async () => {
      if (useStore.getState().audioReady) return;
      const ok = await ensureRunning();
      useStore.getState().setAudioReady(ok);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  // Sample the accent color from the background image at runtime.
  useEffect(() => {
    extractAccent('/instrument-bg.png').then((hsl) => { if (hsl) applyAccent(hsl); });
  }, []);

  return (
    <main className="flex w-full max-w-[1100px] flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-sm uppercase tracking-[0.15em] text-inst-muted-foreground">
            instrument
          </div>
          <AudioStatus />
          <RecordButton />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Pill
            label={tuning === 'sruti' ? 'tonic' : 'root'}
            value={tuning === 'sruti' ? `${tonicSvara} · ${rootName}` : rootName}
            tooltip={
              tuning === 'sruti'
                ? <>Tonic — the absolute pitch the keyboard is anchored to, shown as its svara name (fixed-Sa convention) plus the Western pitch class. Use <Kbd>Shift</Kbd> + <Kbd>1</Kbd>…<Kbd>=</Kbd> to transpose.</>
                : <>Root note — the tonic the active scale and Option-chords are built from. Use <Kbd>Shift</Kbd> + <Kbd>1</Kbd>…<Kbd>=</Kbd> to transpose.</>
            }
          />
          <Pill
            label="oct"
            value={octLabel}
            tooltip={<>Octave shift relative to the default range. Use <Kbd>[</Kbd> and <Kbd>]</Kbd> to nudge down/up.</>}
          />
          <ChordContext />
          <TuningToggle />
          <ModeToggle />
          <OptionToggle />
          <Link
            href="/"
            title="close instrument"
            aria-label="close instrument"
            className="inst-glass-chip inline-flex h-8 w-8 items-center justify-center rounded-full text-inst-muted-foreground transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] hover:text-inst-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </Link>
        </div>
      </header>

      <Keyboard />
    </main>
  );
}
