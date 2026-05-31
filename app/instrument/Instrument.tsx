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
import { SystemPicker } from './components/SystemPicker';
import { ChordContext } from './components/ChordContext';
import { OptionToggle } from './components/OptionToggle';
import { VoicePicker } from './components/VoicePicker';
import { VoiceEditor } from './components/VoiceEditor';
import { LooperToggle } from './components/looper/LooperToggle';
import { LooperDock } from './components/looper/LooperDock';
import { validateVoiceSpec } from './lib/audio/voices';
import { lookupSystem } from './lib/tuning';
import { PITCH_CLASS_NAMES } from './lib/util';
import { extractAccent, applyAccent } from './lib/accent';

// Module-scoped so the +1 default is applied once per page load — surviving
// remounts when the user navigates away from /instrument and back.
let mobileDefaultsApplied = false;

export function Instrument() {
  useKeyboard();

  const systemId      = useStore((s) => s.systemId);
  const root          = useStore((s) => s.root);
  const oct           = useStore((s) => s.periodShift);
  const looperEnabled = useStore((s) => s.looperEnabled);

  const sys = lookupSystem(systemId);
  const rootName = PITCH_CLASS_NAMES[root];
  // The labeler's name for the root step — different per system (svara name for
  // Hindustani, scale degree for Thai, etc.). Shown alongside the Western pc
  // when the system isn't already Western.
  const rootStep = sys.pcToStep[root] ?? 0;
  const systemRootLabel = sys.labeler.id !== 'western'
    ? sys.labeler.labelStep(0, rootStep, sys.grid)
    : null;
  const tonicValue = systemRootLabel ? `${systemRootLabel} · ${rootName}` : rootName;
  const periodLabel = sys.labeler.periodName;
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
    extractAccent('https://res.cloudinary.com/duw0custw/image/upload/v1778934187/instrument-bg_pdmqqo.png').then((hsl) => { if (hsl) applyAccent(hsl); });
  }, []);

  // Hydrate persisted voice + user voices from localStorage on mount.
  // Done here (not in store init) so SSR and first client render match.
  useEffect(() => {
    useStore.getState().hydrateFromStorage();
  }, []);

  // Mobile (< md): default octave shift to +1 on first mount.
  useEffect(() => {
    if (mobileDefaultsApplied) return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    if (useStore.getState().periodShift !== 0) return;
    useStore.getState().shiftPeriod(+1);
    mobileDefaultsApplied = true;
  }, []);

  // Shareable voice via #voice=BASE64(json). On mount, decode if present and
  // open the editor seeded with the decoded voice (user previews + decides
  // whether to save). Clears the hash so reload doesn't re-trigger.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash.startsWith('#voice=')) return;
    try {
      const b64 = hash.slice('#voice='.length);
      const json = atob(decodeURIComponent(b64));
      const decoded = validateVoiceSpec(JSON.parse(json));
      if (decoded) {
        useStore.getState().openVoiceEditor({ ...decoded, id: '' }, null);
      }
    } catch {
      // Invalid hash — ignore silently.
    }
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  return (
    <>
      <div className="fixed left-6 top-6 z-50 flex items-center gap-2.5 select-none">
        <svg width="24" height="24" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.2148 15.2927C15.2302 15.2927 15.7378 15.2928 16.0532 15.6082C16.3686 15.9237 16.3687 16.4313 16.3687 17.4466V26.062C16.3687 27.0773 16.3686 27.5849 16.0532 27.9003C15.7378 28.2157 15.2302 28.2158 14.2148 28.2158H2.36869C1.35336 28.2158 0.845772 28.2157 0.530349 27.9003C0.214925 27.5849 0.214844 27.0773 0.214844 26.062V17.4466C0.214844 16.4313 0.214925 15.9237 0.530349 15.6082C0.845772 15.2928 1.35336 15.2927 2.36869 15.2927H14.2148Z" fill="url(#ilogo0)"/>
          <path d="M26.061 15.2927C27.0763 15.2927 27.5839 15.2928 27.8993 15.6082C28.2148 15.9237 28.2148 16.4313 28.2148 17.4466V26.062C28.2148 27.0773 28.2148 27.5849 27.8993 27.9003C27.5839 28.2157 27.0763 28.2158 26.061 28.2158H20.6764C19.6611 28.2158 19.1535 28.2157 18.838 27.9003C18.5226 27.5849 18.5225 27.0773 18.5225 26.062V17.4466C18.5225 16.4313 18.5226 15.9237 18.838 15.6082C19.1535 15.2928 19.6611 15.2927 20.6764 15.2927H26.061Z" fill="url(#ilogo1)"/>
          <path d="M8.83023 0.21582C9.84556 0.21582 10.3531 0.215902 10.6686 0.531325C10.984 0.846749 10.9841 1.35433 10.9841 2.36967V10.9851C10.9841 12.0004 10.984 12.508 10.6686 12.8234C10.3531 13.1388 9.84556 13.1389 8.83023 13.1389H2.36869C1.35336 13.1389 0.845772 13.1388 0.530349 12.8234C0.214925 12.508 0.214844 12.0004 0.214844 10.9851V2.36967C0.214844 1.35433 0.214925 0.846749 0.530349 0.531325C0.845772 0.215902 1.35336 0.21582 2.36869 0.21582H8.83023Z" fill="url(#ilogo2)"/>
          <path d="M26.061 0.21582C27.0763 0.21582 27.5839 0.215902 27.8993 0.531325C28.2148 0.846749 28.2148 1.35433 28.2148 2.36967V10.9851C28.2148 12.0004 28.2148 12.508 27.8993 12.8234C27.5839 13.1388 27.0763 13.1389 26.061 13.1389H15.2918C14.2764 13.1389 13.7688 13.1388 13.4534 12.8234C13.138 12.508 13.1379 12.0004 13.1379 10.9851V2.36967C13.1379 1.35433 13.138 0.846749 13.4534 0.531325C13.7688 0.215902 14.2764 0.21582 15.2918 0.21582H26.061Z" fill="url(#ilogo3)"/>
          <path d="M8.83023 0.21582C9.84556 0.21582 10.3531 0.215902 10.6686 0.531325C10.984 0.846749 10.9841 1.35433 10.9841 2.36967V10.9851C10.9841 12.0004 10.984 12.508 10.6686 12.8234C10.3531 13.1388 9.84556 13.1389 8.83023 13.1389H2.36869C1.35336 13.1389 0.845772 13.1388 0.530349 12.8234C0.214925 12.508 0.214844 12.0004 0.214844 10.9851V2.36967C0.214844 1.35433 0.214925 0.846749 0.530349 0.531325C0.845772 0.215902 1.35336 0.21582 2.36869 0.21582H8.83023Z" fill="url(#ilogo4)"/>
          <path d="M8.83023 0.21582C9.44938 0.24753 10.1646 0.0968702 10.6686 0.531325C10.7545 0.616524 10.8187 0.721872 10.8612 0.834788C11.0239 1.32839 10.9735 1.85631 10.9841 2.36967C10.9841 5.24146 10.9841 8.11326 10.9841 10.9851C10.9524 11.6042 11.103 12.3194 10.6686 12.8234C10.1646 13.2578 9.44938 13.1072 8.83023 13.1389C6.67638 13.1389 4.52254 13.1389 2.36869 13.1389C1.74954 13.1072 1.03434 13.2578 0.530349 12.8234C0.530348 12.8234 0.530348 12.8234 0.530348 12.8234C0.0958059 12.3188 0.251659 11.6042 0.228517 10.9851C0.26731 8.11326 0.377762 5.24146 0.416555 2.36967C0.442618 1.75675 0.360929 1.01567 0.682648 0.683625C0.682648 0.683625 0.682648 0.683625 0.682649 0.683625C1.01484 0.361884 1.75577 0.444945 2.36869 0.420002C3.76544 0.403609 5.16219 0.369225 6.55894 0.316849C7.31604 0.288459 8.07313 0.254782 8.83023 0.21582C8.07313 0.176858 7.31604 0.143182 6.55894 0.114792C5.16219 0.062416 3.76544 0.0280313 2.36869 0.0116382C1.7433 0.0501152 1.05383 -0.168143 0.378049 0.379025C0.378048 0.379025 0.378048 0.379025 0.378048 0.379025C-0.169141 1.05495 0.0504888 1.74427 0.0131323 2.36967C0.0519253 5.24146 0.162378 8.11326 0.201171 10.9851C0.241448 11.6042 0.095982 12.32 0.530348 12.8234C0.530348 12.8234 0.530348 12.8234 0.530349 12.8234C1.03434 13.2578 1.74954 13.1072 2.36869 13.1389C2.36869 13.1389 2.36869 13.1389 2.36869 13.1389C4.52254 13.1389 6.67638 13.1389 8.83023 13.1389C9.44938 13.1072 10.1646 13.2578 10.6686 12.8234C11.103 12.3194 10.9524 11.6042 10.9841 10.9851C10.9841 8.11326 10.9841 5.24146 10.9841 2.36967C10.9735 1.85631 11.0239 1.32839 10.8612 0.834788C10.8187 0.721872 10.7545 0.616524 10.6686 0.531325C10.1646 0.0968703 9.44938 0.24753 8.83023 0.21582ZM8.83023 0.21582" fill="url(#ilogo5)"/>
          <defs>
            <radialGradient id="ilogo0" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0.214844 0.21582) rotate(45) scale(39.598)">
              <stop offset="0.4" stopColor="#5F1090"/>
              <stop offset="1" stopColor="#FF0000"/>
            </radialGradient>
            <radialGradient id="ilogo1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0.214844 0.21582) rotate(45) scale(39.598)">
              <stop offset="0.4" stopColor="#5F1090"/>
              <stop offset="1" stopColor="#FF0000"/>
            </radialGradient>
            <radialGradient id="ilogo2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0.214844 0.21582) rotate(45) scale(39.598)">
              <stop offset="0.4" stopColor="#5F1090"/>
              <stop offset="1" stopColor="#FF0000"/>
            </radialGradient>
            <radialGradient id="ilogo3" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0.214844 0.21582) rotate(45) scale(39.598)">
              <stop offset="0.4" stopColor="#5F1090"/>
              <stop offset="1" stopColor="#FF0000"/>
            </radialGradient>
            <radialGradient id="ilogo4" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0.214844 0.21582) rotate(45) scale(39.598)">
              <stop offset="0.650675" stopColor="#FF0000" stopOpacity="0"/>
              <stop offset="1" stopColor="#FFF7A0"/>
            </radialGradient>
            <linearGradient id="ilogo5" x1="0.214844" y1="0.21582" x2="28.2148" y2="28.2158" gradientUnits="userSpaceOnUse">
              <stop stopColor="white"/>
              <stop offset="1" stopColor="white" stopOpacity="0"/>
            </linearGradient>
          </defs>
        </svg>
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

      <div
        className={[
          'fixed left-6 z-50 select-none font-[family-name:var(--font-mori)] text-xs text-white/40 transition-[bottom] duration-[220ms]',
          // Tucks above the looper dock strip when the looper is enabled.
          looperEnabled ? 'bottom-[52px] sm:bottom-[60px]' : 'bottom-6',
        ].join(' ')}
      >
        2026
      </div>
      <div
        className={[
          'fixed right-6 z-50 select-none font-[family-name:var(--font-mori)] text-xs text-white/40 transition-[bottom] duration-[220ms]',
          looperEnabled ? 'bottom-[52px] sm:bottom-[60px]' : 'bottom-6',
        ].join(' ')}
      >
        Ani Dalal
      </div>

      <main className="flex w-full max-w-[1100px] flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AudioStatus />
            <RecordButton />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ChordContext />
            <LooperToggle />
            <SystemPicker />
            <VoicePicker />
          </div>
        </header>

        <Keyboard />

        {/* Playing controls — root, octave shift, mode, chord. Below the keyboard
            because these are the things adjusted *while playing*; the chips
            above are configuration. */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Pill
            label={systemRootLabel ? 'tonic' : 'root'}
            value={tonicValue}
            tooltip={
              systemRootLabel
                ? <>Tonic — the pitch the keyboard is anchored to, shown as its system label plus the Western pitch class. Use <Kbd>Shift</Kbd> + <Kbd>1</Kbd>…<Kbd>=</Kbd> to transpose.</>
                : <>Root note — the tonic the active scale and Option-chords are built from. Use <Kbd>Shift</Kbd> + <Kbd>1</Kbd>…<Kbd>=</Kbd> to transpose.</>
            }
          />
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => void dispatch({ type: 'ShiftPeriod', delta: -1 })}
              aria-label={`${periodLabel} down`}
              className="inst-glass-chip inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm text-inst-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-inst-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring md:hidden"
            >
              −
            </button>
            <Pill
              label={periodLabel === 'octave' ? 'oct' : periodLabel}
              value={octLabel}
              tooltip={<>{periodLabel[0].toUpperCase() + periodLabel.slice(1)} shift relative to the default range. Use <Kbd>[</Kbd> and <Kbd>]</Kbd> to nudge down/up.</>}
              className="w-[90px]"
            />
            <button
              type="button"
              onClick={() => void dispatch({ type: 'ShiftPeriod', delta: +1 })}
              aria-label={`${periodLabel} up`}
              className="inst-glass-chip inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm text-inst-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-inst-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring md:hidden"
            >
              +
            </button>
          </span>
          {/* Mode toggle (simple/chromatic) is hidden — keyboard still
              honours store.mode; the chip is just removed from the UI. */}
          <OptionToggle />
        </div>
      </main>

      {looperEnabled && <LooperDock />}

      <VoiceEditor />
    </>
  );
}
