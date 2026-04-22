import { useStore } from '../store/store';
import { cn } from '../lib/utils';

export function AudioStatus() {
  const ready = useStore((s) => s.audioReady);
  return (
    <div
      data-ready={ready}
      className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 transition-colors duration-[220ms] ease-inst-out-expo"
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full transition-colors duration-[220ms] ease-inst-out-expo',
          ready
            ? 'bg-inst-ok shadow-[0_0_10px_hsl(var(--inst-ok))]'
            : 'bg-inst-warn shadow-[0_0_10px_hsl(var(--inst-warn))]'
        )}
      />
      <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
        audio
      </span>
      <span className="font-mono text-sm text-inst-foreground">
        {ready ? 'on' : 'click to enable'}
      </span>
    </div>
  );
}
