'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { dispatch } from '../lib/dispatch';
import { slugifyLabel } from '../lib/audio/voices';
import type {
  ADSR, FilterSpec, LFOSpec, OscSpec, VoiceProfile, VoiceSpec,
} from '../lib/audio/voices';
import { cn } from '../lib/utils';

const TEST_FREQ_HZ  = 261.63; // C4
const TEST_HOLD_MS  = 600;
const MAX_OSC       = 4;
const COMMON_RATIOS: readonly { value: number; label: string }[] = [
  { value: 0.5,  label: '½'   },
  { value: 1,    label: '1'   },
  { value: 1.5,  label: '3/2' },
  { value: 2,    label: '2'   },
  { value: 3,    label: '3'   },
  { value: 4,    label: '4'   },
];

function playTestNote() {
  const code = '__editor_test__';
  void dispatch({ type: 'NoteOff', code });
  void dispatch({ type: 'NoteOn', freqs: [TEST_FREQ_HZ], row: 1, code });
  setTimeout(() => void dispatch({ type: 'NoteOff', code }), TEST_HOLD_MS);
}

// ===========================================================================
// Atoms — match the rest of the instrument's chip vocabulary.
// ===========================================================================

/** Small glass chip — same recipe as header pills, but compact. */
function Chip({
  children, onClick, disabled, variant = 'default', className,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: 'default' | 'primary' | 'destructive'; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inst-glass-chip inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px]',
        'transition-colors duration-[220ms] ease-inst-out-expo focus:outline-none',
        'disabled:opacity-30 disabled:cursor-not-allowed',
        variant === 'default'     && 'text-inst-muted-foreground hover:text-inst-foreground hover:bg-white/[0.08]',
        variant === 'primary'     && 'bg-white/[0.10] text-inst-foreground hover:bg-white/[0.16]',
        variant === 'destructive' && 'text-inst-destructive/80 hover:text-inst-destructive hover:bg-inst-destructive/[0.08]',
        className,
      )}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
        {children}
      </h3>
      {action}
    </div>
  );
}

function Slider({
  label, value, onChange, min, max, step, format,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between font-mono text-[10px] text-inst-muted-foreground">
        <span>{label}</span>
        <span className="text-inst-foreground/80">{(format ?? ((v) => v.toFixed(2)))(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="inst-range"
      />
    </label>
  );
}

function Segmented<T extends string>({
  options, value, onChange,
}: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inst-glass-chip inline-flex rounded-full p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'px-2.5 py-1 rounded-full font-mono text-[11px] transition-colors',
            value === o.value
              ? 'bg-white/[0.16] text-inst-foreground'
              : 'text-inst-muted-foreground hover:text-inst-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ADSRControls({
  value, onChange, releaseMax = 3,
}: { value: ADSR; onChange: (v: ADSR) => void; releaseMax?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
      <Slider label="attack"  min={0} max={2}            step={0.001} value={value.attack}
              onChange={(v) => onChange({ ...value, attack: v })}
              format={(v) => `${(v * 1000).toFixed(0)}ms`} />
      <Slider label="decay"   min={0} max={3}            step={0.001} value={value.decay}
              onChange={(v) => onChange({ ...value, decay: v })}
              format={(v) => `${(v * 1000).toFixed(0)}ms`} />
      <Slider label="sustain" min={0} max={1}            step={0.01}  value={value.sustain}
              onChange={(v) => onChange({ ...value, sustain: v })} />
      <Slider label="release" min={0} max={releaseMax}   step={0.01}  value={value.release}
              onChange={(v) => onChange({ ...value, release: v })}
              format={(v) => `${(v * 1000).toFixed(0)}ms`} />
    </div>
  );
}

const WAVE_OPTIONS = [
  { value: 'sine',     label: 'Sine' },
  { value: 'triangle', label: 'Tri'  },
  { value: 'square',   label: 'Sq'   },
  { value: 'sawtooth', label: 'Saw'  },
] as const;

const FILTER_TYPE_OPTIONS = [
  { value: 'lowpass',  label: 'Low'   },
  { value: 'highpass', label: 'High'  },
  { value: 'bandpass', label: 'Band'  },
  { value: 'notch',    label: 'Notch' },
] as const;

const LFO_TARGET_OPTIONS = [
  { value: 'pitch', label: 'Pitch' },
  { value: 'amp',   label: 'Amp'   },
] as const;

// ===========================================================================
// The editor.
// ===========================================================================

export function VoiceEditor() {
  const draft           = useStore((s) => s.voiceEditor);
  const editingId       = useStore((s) => s.voiceEditorEditingId);
  const userVoices      = useStore((s) => s.userVoices);
  const updateDraft     = useStore((s) => s.updateVoiceEditor);
  const closeEditor     = useStore((s) => s.closeVoiceEditor);
  const deleteUserVoice = useStore((s) => s.deleteUserVoice);

  const [error, setError] = useState<string | null>(null);
  const initialIdRef = useRef<string>('');

  useEffect(() => {
    if (draft && editingId && !initialIdRef.current) initialIdRef.current = editingId;
    if (!draft) initialIdRef.current = '';
  }, [draft, editingId]);

  const dismiss = () => { setError(null); closeEditor(); };

  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { e.preventDefault(); dismiss(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  if (!draft) return null;

  const patch = (p: Partial<VoiceSpec>) => updateDraft({ ...draft, ...p });
  const patchProfile = (p: Partial<VoiceProfile>) =>
    patch({ profile: { ...draft.profile, ...p } });

  const updateOsc = (i: number, p: Partial<OscSpec>) => {
    const oscillators = draft.profile.oscillators.map((o, idx) => idx === i ? { ...o, ...p } : o);
    patchProfile({ oscillators });
  };
  const addOsc = () => {
    if (draft.profile.oscillators.length >= MAX_OSC) return;
    patchProfile({
      oscillators: [...draft.profile.oscillators, { wave: 'sine', ratio: 1, gain: 0.5 }],
    });
  };
  const removeOsc = (i: number) => {
    if (draft.profile.oscillators.length <= 1) return;
    patchProfile({ oscillators: draft.profile.oscillators.filter((_, idx) => idx !== i) });
  };

  const toggleFilter = () => {
    if (draft.profile.filter) {
      patchProfile({ filter: undefined });
    } else {
      const f: FilterSpec = { type: 'lowpass', baseFreq: 1200, q: 0.7 };
      patchProfile({ filter: f });
    }
  };
  const patchFilter = (p: Partial<FilterSpec>) => {
    if (!draft.profile.filter) return;
    patchProfile({ filter: { ...draft.profile.filter, ...p } });
  };
  const toggleFilterEnv = () => {
    if (!draft.profile.filter) return;
    if (draft.profile.filter.env) {
      patchFilter({ env: undefined, peakFreq: undefined });
    } else {
      patchFilter({
        env: { attack: 0.02, decay: 0.25, sustain: 0.4, release: 0.3 },
        peakFreq: Math.max(draft.profile.filter.baseFreq * 4, 2000),
      });
    }
  };

  const toggleLFO = () => {
    if (draft.profile.lfo) {
      patchProfile({ lfo: undefined });
    } else {
      const l: LFOSpec = { wave: 'sine', rate: 5, depth: 10, target: 'pitch' };
      patchProfile({ lfo: l });
    }
  };
  const patchLFO = (p: Partial<LFOSpec>) => {
    if (!draft.profile.lfo) return;
    patchProfile({ lfo: { ...draft.profile.lfo, ...p } });
  };

  const onSave = () => {
    setError(null);
    if (!draft.label.trim()) { setError('Give it a name first.'); return; }
    const slug = slugifyLabel(draft.label);
    if (slug in userVoices && slug !== initialIdRef.current) {
      setError(`A voice called "${draft.label}" already exists.`); return;
    }
    updateDraft({ ...draft, id: slug });
    queueMicrotask(() => {
      const id = useStore.getState().commitVoiceEditor();
      if (!id) setError('Could not save — check the name.');
    });
  };
  const onDelete = () => {
    if (!editingId) return;
    setError(null);
    deleteUserVoice(editingId);
  };

  const isEditing = !!editingId;
  const oscList = draft.profile.oscillators;
  const filter = draft.profile.filter;
  const lfo    = draft.profile.lfo;

  return (
    // Gradient-border wrapper — matches VoicePicker / KeyPicker / CanvasEditPanel exactly.
    <div
      role="dialog"
      aria-label="voice editor"
      className="fixed left-1/2 top-[78px] z-40 w-[calc(100vw-24px)] max-w-[640px] -translate-x-1/2 rounded-2xl p-[1px]
                 shadow-[0_22px_70px_rgba(0,0,0,0.55)]"
      style={{
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03), rgba(255,255,255,0.10))',
      }}
    >
      <div className="flex max-h-[calc(100vh-160px)] flex-col overflow-hidden rounded-2xl bg-black/65 backdrop-blur-xl">

        {/* Header strip — name + close. No buttons crammed in here. */}
        <div className="flex items-center gap-3 px-5 py-3.5">
          <input
            type="text"
            placeholder="Name your voice"
            value={draft.label}
            onChange={(e) => patch({ label: e.target.value })}
            className="flex-1 min-w-0 bg-transparent font-[family-name:var(--font-mondwest)] text-[22px]
                       text-inst-foreground placeholder:text-inst-muted-foreground/60
                       focus:outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={dismiss}
            aria-label="close editor"
            className="text-inst-muted-foreground hover:text-inst-foreground transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
                 strokeWidth="1.4" strokeLinecap="round">
              <line x1="4" y1="4" x2="14" y2="14" />
              <line x1="14" y1="4" x2="4" y2="14" />
            </svg>
          </button>
        </div>

        {/* Body strip — scrollable form. Section rhythm by space, not lines. */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <input
            type="text"
            placeholder="one-line description (shown in picker)"
            value={draft.blurb}
            onChange={(e) => patch({ blurb: e.target.value })}
            maxLength={48}
            className="block w-full bg-transparent font-mono text-[12px]
                       text-inst-muted-foreground placeholder:text-inst-muted-foreground/40
                       focus:outline-none focus:text-inst-foreground mb-6"
          />

          {error && (
            <div className="mb-5 rounded-md border border-inst-destructive/40 bg-inst-destructive/10
                            px-3 py-2 font-mono text-[11px] text-inst-destructive">
              {error}
            </div>
          )}

          {/* Oscillators */}
          <SectionLabel
            action={
              <Chip onClick={addOsc} disabled={oscList.length >= MAX_OSC}>
                + add ({oscList.length}/{MAX_OSC})
              </Chip>
            }
          >
            Oscillators
          </SectionLabel>
          <div className="space-y-3">
            {oscList.map((osc, i) => (
              <div key={i} className="inst-glass-chip rounded-xl p-3">
                <div className="mb-3 flex items-center justify-between">
                  <Segmented
                    options={WAVE_OPTIONS}
                    value={osc.wave}
                    onChange={(wave) => updateOsc(i, { wave })}
                  />
                  {oscList.length > 1 && (
                    <Chip variant="destructive" onClick={() => removeOsc(i)}>remove</Chip>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
                  <div>
                    <Slider
                      label="ratio"
                      min={0.25} max={8} step={0.01}
                      value={osc.ratio ?? 1}
                      onChange={(ratio) => updateOsc(i, { ratio })}
                      format={(v) => `×${v.toFixed(2)}`}
                    />
                    <div className="mt-1 flex gap-1">
                      {COMMON_RATIOS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => updateOsc(i, { ratio: r.value })}
                          className={cn(
                            'rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                            (osc.ratio ?? 1) === r.value
                              ? 'bg-white/[0.14] text-inst-foreground'
                              : 'text-inst-muted-foreground hover:text-inst-foreground',
                          )}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Slider
                    label="detune ¢"
                    min={-100} max={100} step={1}
                    value={osc.detune ?? 0}
                    onChange={(detune) => updateOsc(i, { detune })}
                    format={(v) => v === 0 ? '0' : v > 0 ? `+${v}` : `${v}`}
                  />
                  <Slider
                    label="gain"
                    min={0} max={1} step={0.01}
                    value={osc.gain ?? 1}
                    onChange={(gain) => updateOsc(i, { gain })}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Amplitude envelope */}
          <div className="mt-7">
            <SectionLabel>Amplitude envelope</SectionLabel>
            <ADSRControls
              value={draft.profile.amp}
              onChange={(amp) => patchProfile({ amp })}
              releaseMax={4}
            />
          </div>

          {/* Filter */}
          <div className="mt-7">
            <SectionLabel
              action={
                <Chip
                  variant={filter ? 'primary' : 'default'}
                  onClick={toggleFilter}
                >
                  {filter ? 'on' : 'off'}
                </Chip>
              }
            >
              Filter
            </SectionLabel>
            {filter ? (
              <div className="space-y-4">
                <div>
                  <Segmented
                    options={FILTER_TYPE_OPTIONS}
                    value={filter.type}
                    onChange={(type) => patchFilter({ type })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
                  <Slider
                    label="base Hz"
                    min={40} max={8000} step={10}
                    value={filter.baseFreq}
                    onChange={(baseFreq) => patchFilter({ baseFreq })}
                    format={(v) => `${v.toFixed(0)}Hz`}
                  />
                  {filter.env && (
                    <Slider
                      label="peak Hz"
                      min={40} max={12000} step={10}
                      value={filter.peakFreq ?? filter.baseFreq * 4}
                      onChange={(peakFreq) => patchFilter({ peakFreq })}
                      format={(v) => `${v.toFixed(0)}Hz`}
                    />
                  )}
                  <Slider
                    label="Q"
                    min={0.1} max={20} step={0.1}
                    value={filter.q ?? 1}
                    onChange={(q) => patchFilter({ q })}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground/80">
                    envelope
                  </span>
                  <Chip
                    variant={filter.env ? 'primary' : 'default'}
                    onClick={toggleFilterEnv}
                  >
                    {filter.env ? 'on' : 'off'}
                  </Chip>
                </div>
                {filter.env && (
                  <ADSRControls
                    value={filter.env}
                    onChange={(env) => patchFilter({ env })}
                  />
                )}
              </div>
            ) : (
              <p className="font-mono text-[11px] text-inst-muted-foreground/60">
                Low / high / band / notch filter, optional envelope for sweeps.
              </p>
            )}
          </div>

          {/* LFO */}
          <div className="mt-7">
            <SectionLabel
              action={
                <Chip variant={lfo ? 'primary' : 'default'} onClick={toggleLFO}>
                  {lfo ? 'on' : 'off'}
                </Chip>
              }
            >
              LFO
            </SectionLabel>
            {lfo ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Segmented
                    options={WAVE_OPTIONS}
                    value={lfo.wave}
                    onChange={(wave) => patchLFO({ wave })}
                  />
                  <Segmented
                    options={LFO_TARGET_OPTIONS}
                    value={lfo.target}
                    onChange={(target) => patchLFO({ target })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Slider
                    label="rate"
                    min={0.1} max={20} step={0.1}
                    value={lfo.rate}
                    onChange={(rate) => patchLFO({ rate })}
                    format={(v) => `${v.toFixed(1)}Hz`}
                  />
                  <Slider
                    label="depth"
                    min={0} max={lfo.target === 'pitch' ? 100 : 1}
                    step={lfo.target === 'pitch' ? 1 : 0.01}
                    value={lfo.depth}
                    onChange={(depth) => patchLFO({ depth })}
                    format={(v) => lfo.target === 'pitch' ? `${v}¢` : v.toFixed(2)}
                  />
                </div>
              </div>
            ) : (
              <p className="font-mono text-[11px] text-inst-muted-foreground/60">
                Slow wobble — vibrato (pitch) or tremolo (amp).
              </p>
            )}
          </div>

          {/* Master */}
          <div className="mt-7">
            <SectionLabel>Master</SectionLabel>
            <Slider
              label="output gain"
              min={0.02} max={0.45} step={0.005}
              value={draft.profile.masterGain}
              onChange={(masterGain) => patchProfile({ masterGain })}
            />
          </div>
        </div>

        {/* Footer strip — action bar. Test left, save / delete right. */}
        <div className="flex items-center gap-2 border-t border-white/[0.05] bg-black/30 px-5 py-3">
          <Chip onClick={playTestNote}>Test ♪</Chip>
          <span className="flex-1" />
          {isEditing && <Chip variant="destructive" onClick={onDelete}>Delete</Chip>}
          <Chip variant="primary" onClick={onSave}>{isEditing ? 'Save' : 'Save as new'}</Chip>
        </div>
      </div>
    </div>
  );
}
