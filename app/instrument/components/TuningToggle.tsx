import { useStore } from '../store/store';
import { Tooltip } from './ui/tooltip';

export function TuningToggle() {
  const tuning    = useStore((s) => s.tuning);
  const setTuning = useStore((s) => s.setTuning);
  const next: 'sruti' | '12tet' = tuning === '12tet' ? 'sruti' : '12tet';

  const tip = tuning === 'sruti'
    ? <>Currently in Śruti (22 just-intonation microtones per octave). Click to switch to 12-TET — the standard 12 equal semitones used by Western instruments.</>
    : <>Currently in 12-TET (12 equal semitones per octave). Click to switch to Śruti — 22 just-intonation microtones per octave used in Indian classical music.</>;

  return (
    <Tooltip content={tip}>
      <button
        type="button"
        onClick={() => setTuning(next)}
        className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
          tuning
        </span>
        <span className="font-mono text-sm text-inst-foreground">
          {tuning === 'sruti' ? 'Śruti' : '12-TET'}
        </span>
      </button>
    </Tooltip>
  );
}
