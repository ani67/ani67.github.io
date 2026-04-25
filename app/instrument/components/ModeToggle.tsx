import { useStore } from '../store/store';
import { Tooltip } from './ui/tooltip';

export function ModeToggle() {
  const mode    = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const next: 'simple' | 'chromatic' = mode === 'chromatic' ? 'simple' : 'chromatic';

  const tip = mode === 'simple'
    ? <>Simple mode — each key is the next note in the active scale/rāga, no out-of-scale gaps. Click to switch to chromatic, where every pitch is available and scale notes are highlighted.</>
    : <>Chromatic mode — every semitone (or śruti) gets its own key, with scale notes highlighted. Click to switch to simple, where keys walk only through the active scale/rāga.</>;

  return (
    <Tooltip content={tip}>
      <button
        type="button"
        onClick={() => setMode(next)}
        className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
          mode
        </span>
        <span className="font-mono text-sm text-inst-foreground">{mode}</span>
      </button>
    </Tooltip>
  );
}
