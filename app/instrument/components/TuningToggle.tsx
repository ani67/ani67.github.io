import { useStore } from '../store/store';

export function TuningToggle() {
  const tuning    = useStore((s) => s.tuning);
  const setTuning = useStore((s) => s.setTuning);
  const next: 'sruti' | '12tet' = tuning === '12tet' ? 'sruti' : '12tet';

  return (
    <button
      type="button"
      onClick={() => setTuning(next)}
      title={`switch to ${next === 'sruti' ? 'Śruti (22-JI) mode' : '12-TET mode'}`}
      className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
        tuning
      </span>
      <span className="font-mono text-sm text-inst-foreground">
        {tuning === 'sruti' ? 'Śruti' : '12-TET'}
      </span>
    </button>
  );
}
