import { useStore } from '../store/store';
import { lookupSystem } from '../lib/tuning';
import { Tooltip } from './ui/tooltip';
import { Kbd } from './ui/kbd';

export function ChordContext() {
  const systemId     = useStore((s) => s.systemId);
  const activeScales = useStore((s) => s.activeScales);
  const cycleScale   = useStore((s) => s.cycleScale);
  const overrides    = useStore((s) => s.customMaps[s.systemId]);
  const resetCustom  = useStore((s) => s.resetCustom);

  const sys     = lookupSystem(systemId);
  const scaleId = activeScales[systemId] ?? sys.defaultScale;
  const scale   = sys.scales.find((s) => s.id === scaleId) ?? sys.scales[0];

  const hasCustom = overrides && Object.keys(overrides).length > 0;
  const baseLabel = scale.label;
  const label     = hasCustom ? `custom · ${baseLabel}` : baseLabel;

  const tip = hasCustom
    ? <>Custom layout — one or more keys remapped on top of <strong>{baseLabel}</strong>. Click <strong>↺</strong> to clear all overrides for this tuning. Tap <Kbd>=</Kbd> then any key to remap it.</>
    : <>Active scale in {sys.label}. Sets which notes are highlighted on the keys and what intervals Option-chords stack from. Click to cycle. Tap <Kbd>=</Kbd> then any key to remap it.</>;

  return (
    <Tooltip content={tip}>
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={cycleScale}
          className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
            scale
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
