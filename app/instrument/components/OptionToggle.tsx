import { useStore } from '../store/store';
import { lookupSystem } from '../lib/tuning';
import { Tooltip } from './ui/tooltip';
import { Kbd } from './ui/kbd';

export function OptionToggle() {
  const optionLock = useStore((s) => s.optionLock);
  const systemId   = useStore((s) => s.systemId);
  const toggle     = useStore((s) => s.toggleOptionLock);

  const sys = lookupSystem(systemId);
  const explanation =
    sys.chord.kind === 'triad'
      ? 'plays a stack-of-thirds chord through the active scale'
      : sys.chord.kind === 'drone'
      ? `plays a drone (tonic + 5th) underneath each pressed note — like a transient tanpura`
      : sys.chord.kind === 'octaves'
      ? 'plays the pressed note + the same note one octave below (heterophonic doubling)'
      : 'is a no-op in this tuning system';

  const tip = (
    <>
      Auto-chord — when on, every key {explanation}. Behaviour adapts to the
      active tuning: Western systems get tertian harmony, Indian/Arab get
      drone-under-melody, Thai gets octave doubling. Hold <Kbd>⌥ Option</Kbd>
      for the same effect momentarily.
    </>
  );

  return (
    <Tooltip content={tip}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={optionLock}
        className={[
          'inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 w-[120px]',
          'transition-colors duration-[220ms] ease-inst-out-expo',
          'hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring',
          optionLock ? 'bg-white/[0.12] text-inst-foreground' : '',
        ].join(' ')}
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground shrink-0">
          chord
        </span>
        <span className="font-mono text-sm text-inst-foreground truncate min-w-0 flex-1 text-left">
          {optionLock ? 'on' : 'off'}
        </span>
      </button>
    </Tooltip>
  );
}
