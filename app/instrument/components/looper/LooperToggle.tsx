'use client';

import { useStore } from '../../store/store';
import { Tooltip } from '../ui/tooltip';

export function LooperToggle() {
  const enabled    = useStore((s) => s.looperEnabled);
  const setEnabled = useStore((s) => s.setLooperEnabled);

  return (
    <Tooltip
      content={
        <>
          Looper — record layered loops over a click track. Turn on to reveal
          the panel under the keyboard with 8 layers, metronome, and BPM.
        </>
      }
    >
      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        aria-pressed={enabled}
        className={[
          'inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 w-[120px]',
          'transition-colors duration-[220ms] ease-inst-out-expo',
          'hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring',
          enabled ? 'bg-white/[0.12] text-inst-foreground' : '',
        ].join(' ')}
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground shrink-0">
          looper
        </span>
        <span className="font-mono text-sm text-inst-foreground truncate min-w-0 flex-1 text-left">
          {enabled ? 'on' : 'off'}
        </span>
      </button>
    </Tooltip>
  );
}
