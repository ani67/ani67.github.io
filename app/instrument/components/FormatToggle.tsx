'use client';

import { useStore } from '../store/store';
import type { RecordFormat } from '../lib/audio/recorder';
import { Tooltip } from './ui/tooltip';

const ORDER: RecordFormat[] = ['webm', 'wav', 'mp3'];

export function FormatToggle() {
  const fmt    = useStore((s) => s.recordFormat);
  const setFmt = useStore((s) => s.setRecordFormat);

  const next = () => {
    const i = ORDER.indexOf(fmt);
    setFmt(ORDER[(i + 1) % ORDER.length]);
  };

  return (
    <Tooltip
      content={
        <>
          File format for the next download. <strong>WebM</strong> is the
          browser&apos;s native recording (small, lossy). <strong>WAV</strong>
          is lossless stereo PCM (large). <strong>MP3</strong> is 128 kbps
          (small, universal). Click to cycle.
        </>
      }
    >
      <button
        type="button"
        onClick={next}
        aria-label={`recording format ${fmt}`}
        className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 w-[110px] transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground shrink-0">
          fmt
        </span>
        <span className="font-mono text-sm text-inst-foreground truncate min-w-0 flex-1 text-left uppercase">
          {fmt}
        </span>
      </button>
    </Tooltip>
  );
}
