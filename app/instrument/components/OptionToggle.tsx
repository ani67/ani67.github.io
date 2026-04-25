import { useStore } from '../store/store';
import { Tooltip } from './ui/tooltip';
import { Kbd } from './ui/kbd';

export function OptionToggle() {
  const tuning     = useStore((s) => s.tuning);
  const optionLock = useStore((s) => s.optionLock);
  const toggle     = useStore((s) => s.toggleOptionLock);

  const tip = tuning === 'sruti'
    ? <>Sticky <Kbd>⌥ Option</Kbd>. When on, every key press plays a rāga-stack chord (or a ±1 cluster if the note is out of the rāga) instead of a single svara — same as holding Option.</>
    : <>Sticky <Kbd>⌥ Option</Kbd>. When on, every key press plays a scale-diatonic chord (or a fallback major triad if out of scale) instead of a single note — same as holding Option.</>;

  return (
    <Tooltip content={tip}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={optionLock}
        className={[
          'inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1',
          'transition-colors duration-[220ms] ease-inst-out-expo',
          'hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring',
          optionLock ? 'bg-white/[0.12] text-inst-foreground' : '',
        ].join(' ')}
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
          ⌥ option
        </span>
        <span className="font-mono text-sm text-inst-foreground">
          {optionLock ? 'on' : 'off'}
        </span>
      </button>
    </Tooltip>
  );
}
