'use client';

import { useStore } from '../../store/store';
import type { LayerUI } from '../../store/store';
import { cn } from '../../lib/utils';
import { Tooltip } from '../ui/tooltip';

/**
 * One row in the looper panel — one of the 8 layers.
 *
 * State drives the record button's appearance + label:
 *   empty      — hollow circle; click arms record for next loop boundary
 *   armed      — pulsing dot; click cancels
 *   recording  — solid red; click commits early
 *   looping    — filled circle, white; click re-records (replaces)
 */
export function LayerSlot({ layer }: { layer: LayerUI }) {
  const arm    = useStore((s) => s.armRecordLayer);
  const setVol = useStore((s) => s.setLayerVolume);
  const setEn  = useStore((s) => s.setLayerEnabled);
  const clear  = useStore((s) => s.clearLayer);

  const isEmpty     = layer.state === 'empty';
  const isArmed     = layer.state === 'armed';
  const isRecording = layer.state === 'recording';
  const isLooping   = layer.state === 'looping';

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground w-5 shrink-0">
        L{layer.id + 1}
      </span>

      <Tooltip
        placement="top"
        content={
          isEmpty   ? <>Arm to record. Recording begins at the next loop boundary; you get 1 bar of count-in if nothing is playing yet.</>
        : isArmed   ? <>Armed — waiting for the next loop boundary. Click to cancel.</>
        : isRecording ? <>Recording. Will commit and start looping at the next loop boundary.</>
        : <>Re-record this layer — replaces existing content.</>
        }
      >
        <button
          type="button"
          onClick={() => arm(layer.id)}
          aria-label={`record layer ${layer.id + 1}`}
          className={cn(
            'inst-glass-chip inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors',
            'hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring',
            isArmed && 'bg-white/[0.10] animate-pulse',
            isRecording && 'bg-red-500/30',
          )}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <circle
              cx="5" cy="5" r="3.2"
              fill={isRecording ? '#ef4444' : isLooping ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={isRecording || isLooping ? 0 : 1.2}
            />
          </svg>
        </button>
      </Tooltip>

      <Tooltip placement="top" content={layer.enabled ? <>Mute this layer. Audio data is preserved.</> : <>Unmute this layer.</>}>
        <button
          type="button"
          onClick={() => setEn(layer.id, !layer.enabled)}
          aria-pressed={!layer.enabled}
          aria-label={layer.enabled ? `mute layer ${layer.id + 1}` : `unmute layer ${layer.id + 1}`}
          className={cn(
            'inst-glass-chip inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors',
            'hover:bg-white/[0.08]',
            !layer.enabled && 'opacity-50',
          )}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
            <path d="M2 4 L4 4 L7 2 L7 9 L4 7 L2 7 Z" />
            {!layer.enabled && <line x1="1" y1="1" x2="10" y2="10" />}
          </svg>
        </button>
      </Tooltip>

      <input
        type="range"
        min={0} max={1} step={0.01}
        value={layer.volume}
        onChange={(e) => setVol(layer.id, Number(e.currentTarget.value))}
        aria-label={`volume layer ${layer.id + 1}`}
        className="inst-range flex-1 min-w-[60px]"
        style={{ margin: 0 }}
      />

      <span className={cn(
        'font-mono text-[10px] uppercase tracking-widest tabular-nums w-12 text-right shrink-0',
        isRecording ? 'text-red-400' : isArmed ? 'text-inst-foreground' : 'text-inst-muted-foreground',
      )}>
        {isEmpty ? '—' : isArmed ? 'armed' : isRecording ? 'rec' : 'loop'}
      </span>

      <Tooltip placement="top" content={<>Clear this layer.</>}>
        <button
          type="button"
          onClick={() => clear(layer.id)}
          aria-label={`clear layer ${layer.id + 1}`}
          disabled={!layer.hasContent && !isArmed && !isRecording}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-inst-muted-foreground hover:bg-white/[0.06] hover:text-inst-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
            <line x1="2" y1="2" x2="8" y2="8" />
            <line x1="8" y1="2" x2="2" y2="8" />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
}
