import { useStore } from '../store/store';
import { SCALES } from '../lib/keymap/scales';
import { RAGAS } from '../lib/tuning/sruti';
import { Tooltip } from './ui/tooltip';
import { Kbd } from './ui/kbd';

export function ChordContext() {
  const tuning     = useStore((s) => s.tuning);
  const scaleTET   = useStore((s) => s.chordScaleTET);
  const ragaSruti  = useStore((s) => s.chordScaleSruti);
  const cycleTET   = useStore((s) => s.cycleChordScaleTET);
  const cycleSruti = useStore((s) => s.cycleChordScaleSruti);
  const customMap  = useStore((s) =>
    s.tuning === '12tet' ? s.customMapTET : s.customMapSruti
  );
  const resetCustom = useStore((s) => s.resetCustom);

  const hasCustom = Object.keys(customMap).length > 0;
  const baseLabel = tuning === 'sruti' ? RAGAS[ragaSruti].label : SCALES[scaleTET].label;
  const label     = hasCustom ? `custom · ${baseLabel}` : baseLabel;
  const onClick   = () => (tuning === 'sruti' ? cycleSruti() : cycleTET());

  const tip = hasCustom
    ? <>Custom layout — one or more keys remapped on top of <strong>{baseLabel}</strong>. Click <strong>↺</strong> to clear all overrides for this tuning. Tap <Kbd>=</Kbd> then any key to remap that key.</>
    : tuning === 'sruti'
      ? <>Active rāga. Sets which svaras are highlighted on the keys and what notes Option-chords stack from. Click to cycle through rāgas. Tap <Kbd>=</Kbd> then any key to remap that key.</>
      : <>Active scale. Sets which notes are highlighted on the keys and what intervals Option-chords stack from. Click to cycle through scales. Tap <Kbd>=</Kbd> then any key to remap that key.</>;

  return (
    <Tooltip content={tip}>
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={onClick}
          className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
            {tuning === 'sruti' ? 'rāga' : 'scale'}
          </span>
          <span className="font-mono text-sm text-inst-foreground">{label}</span>
        </button>
        {hasCustom && (
          <button
            type="button"
            onClick={resetCustom}
            title="reset custom layout"
            aria-label="reset custom layout"
            className="inst-glass-chip inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs text-inst-muted-foreground transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] hover:text-inst-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
          >
            ↺
          </button>
        )}
      </span>
    </Tooltip>
  );
}
