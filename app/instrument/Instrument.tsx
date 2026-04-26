'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useStore } from './store/store';
import { dispatch } from './lib/dispatch';
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
import { CustomIO } from './components/CustomIO';
import { PITCH_CLASS_NAMES } from './lib/util';
import { PC_TO_SRUTI, SRUTI_LABELS } from './lib/tuning/sruti';
import { extractAccent, applyAccent } from './lib/accent';

// Module-scoped so the +1 default is applied once per page load — surviving
// remounts when the user navigates away from /instrument and back.
let mobileDefaultsApplied = false;

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

  // Mobile (< md): default octave shift to +1 on first mount.
  useEffect(() => {
    if (mobileDefaultsApplied) return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    if (useStore.getState().octaveShift !== 0) return;
    useStore.getState().shiftOctave(+1);
    mobileDefaultsApplied = true;
  }, []);

  return (
    <>
      <div className="fixed left-6 top-6 z-50 select-none">
        <span className="font-[family-name:var(--font-mondwest)] text-2xl text-white">
          Instrument
        </span>
      </div>

      <Link
        href="/"
        title="close instrument"
        aria-label="close instrument"
        className="fixed right-6 top-6 z-50 text-white/40 transition-colors hover:text-white focus:outline-none"
      >
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="4" y1="4" x2="16" y2="16" />
          <line x1="16" y1="4" x2="4" y2="16" />
        </svg>
      </Link>

      <div className="fixed bottom-6 left-6 z-50 select-none font-[family-name:var(--font-mori)] text-xs text-white/40">
        2026
      </div>
      <div className="fixed bottom-6 right-6 z-50 select-none font-[family-name:var(--font-mori)] text-xs text-white/40">
        Ani Dalal
      </div>

      <main className="flex w-full max-w-[1100px] flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => void dispatch({ type: 'ShiftOctave', delta: -1 })}
                aria-label="octave down"
                className="inst-glass-chip inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm text-inst-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-inst-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring md:hidden"
              >
                −
              </button>
              <Pill
                label="oct"
                value={octLabel}
                tooltip={<>Octave shift relative to the default range. Use <Kbd>[</Kbd> and <Kbd>]</Kbd> to nudge down/up.</>}
              />
              <button
                type="button"
                onClick={() => void dispatch({ type: 'ShiftOctave', delta: +1 })}
                aria-label="octave up"
                className="inst-glass-chip inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm text-inst-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-inst-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring md:hidden"
              >
                +
              </button>
            </span>
            <ChordContext />
            <TuningToggle />
            <ModeToggle />
            <OptionToggle />
            <CustomIO />
          </div>
        </header>

        <Keyboard />
      </main>
    </>
  );
}
