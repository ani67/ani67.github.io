import { useStore } from '../store/store';
import { SCALES } from '../lib/keymap/scales';
import { RAGAS } from '../lib/tuning/sruti';

export function ChordContext() {
  const tuning     = useStore((s) => s.tuning);
  const scaleTET   = useStore((s) => s.chordScaleTET);
  const ragaSruti  = useStore((s) => s.chordScaleSruti);
  const cycleTET   = useStore((s) => s.cycleChordScaleTET);
  const cycleSruti = useStore((s) => s.cycleChordScaleSruti);

  const label   = tuning === 'sruti' ? RAGAS[ragaSruti].label : SCALES[scaleTET].label;
  const onClick = () => (tuning === 'sruti' ? cycleSruti() : cycleTET());

  return (
    <button
      type="button"
      onClick={onClick}
      title={`cycle ${tuning === 'sruti' ? 'rāga' : 'scale'} — chord context + key highlight`}
      className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
        {tuning === 'sruti' ? 'rāga' : 'scale'}
      </span>
      <span className="font-mono text-sm text-inst-foreground">{label}</span>
    </button>
  );
}
