import { useStore } from '../store/store';

export function ModeToggle() {
  const mode    = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const next: 'simple' | 'chromatic' = mode === 'chromatic' ? 'simple' : 'chromatic';

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      title={
        next === 'simple'
          ? 'switch to simple mode — one key per scale note, no chromatic gaps'
          : 'switch to chromatic mode — every pitch available, scale notes highlighted'
      }
      className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
        mode
      </span>
      <span className="font-mono text-sm text-inst-foreground">{mode}</span>
    </button>
  );
}
