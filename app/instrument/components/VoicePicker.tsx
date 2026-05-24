'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadPersistedDraft, useStore } from '../store/store';
import {
  VOICES, VOICE_ORDER, blankVoice, lookupVoice, type VoiceSpec,
} from '../lib/audio/voices';
import { dispatch } from '../lib/dispatch';
import { Tooltip } from './ui/tooltip';
import { cn } from '../lib/utils';

const PREVIEW_FREQ_HZ = 261.63; // C4
const PREVIEW_HOLD_MS = 380;

function previewVoiceById(id: string) {
  const code = `__voicepreview__${id}`;
  void dispatch({ type: 'NoteOff', code });
  void dispatch({ type: 'NoteOn', freqs: [PREVIEW_FREQ_HZ], row: 1, code, voice: id });
  setTimeout(() => void dispatch({ type: 'NoteOff', code }), PREVIEW_HOLD_MS);
}

// One scrollable list row. 'make' is the final entry that opens the editor.
type Row =
  | { kind: 'voice'; voice: VoiceSpec; isUser: boolean }
  | { kind: 'make' };

export function VoicePicker() {
  const voice           = useStore((s) => s.voice);
  const setVoice        = useStore((s) => s.setVoice);
  const userVoices      = useStore((s) => s.userVoices);
  const openVoiceEditor = useStore((s) => s.openVoiceEditor);

  const userIds = useMemo(() => Object.keys(userVoices).sort(), [userVoices]);
  const rows = useMemo<Row[]>(() => {
    const built = VOICE_ORDER.map((id): Row => ({ kind: 'voice', voice: VOICES[id], isUser: false }));
    const user  = userIds.map((id): Row => ({ kind: 'voice', voice: userVoices[id], isUser: true }));
    return [...built, ...user, { kind: 'make' }];
  }, [userIds, userVoices]);

  const currentIdx = useMemo(() => {
    const i = rows.findIndex((r) => r.kind === 'voice' && r.voice.id === voice);
    return i === -1 ? 0 : i;
  }, [rows, voice]);

  const [open, setOpen]                 = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(currentIdx);
  const rootRef = useRef<HTMLDivElement>(null);

  const openPicker  = () => { setHighlightIdx(currentIdx); setOpen(true); };
  const togglePicker = () => (open ? setOpen(false) : openPicker());

  const commitRow = (r: Row) => {
    if (r.kind === 'make') {
      // If the user had an unsaved draft from a previous session, pick it
      // up so they don't lose work. Otherwise start blank.
      const seed = loadPersistedDraft() ?? blankVoice();
      openVoiceEditor(seed, null);
      setOpen(false);
    } else {
      setVoice(r.voice.id);
      setOpen(false);
    }
  };

  const startEditUserVoice = (v: VoiceSpec) => {
    openVoiceEditor({ ...v, profile: { ...v.profile } }, v.id);
    setOpen(false);
  };

  // Open the editor seeded with a copy of `v` — new id, label suffixed with
  // " copy". Used by the duplicate affordance on every row, so a built-in
  // can become the starting point for a user voice without rebuilding it.
  const startDuplicateVoice = (v: VoiceSpec) => {
    const seed: VoiceSpec = {
      id: '',
      label: `${v.label} copy`,
      blurb: v.blurb,
      profile: {
        ...v.profile,
        oscillators: v.profile.oscillators.map((o) => ({ ...o })),
        filter: v.profile.filter ? { ...v.profile.filter, env: v.profile.filter.env ? { ...v.profile.filter.env } : undefined } : undefined,
        lfo:    v.profile.lfo    ? { ...v.profile.lfo } : undefined,
        amp:    { ...v.profile.amp },
      },
    };
    openVoiceEditor(seed, null);
    setOpen(false);
  };

  // Outside click + keyboard nav.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => {
          const next = Math.min(rows.length - 1, i + 1);
          const r = rows[next];
          if (r.kind === 'voice') previewVoiceById(r.voice.id);
          return next;
        });
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => {
          const next = Math.max(0, i - 1);
          const r = rows[next];
          if (r.kind === 'voice') previewVoiceById(r.voice.id);
          return next;
        });
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        commitRow(rows[highlightIdx]);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
    // commitRow is recreated each render but stable in behavior — exclude
    // intentionally so we don't re-bind listeners on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, highlightIdx, rows]);

  const currentVoice = lookupVoice(voice, userVoices);

  // Index where the "Your voices" section starts, for the visual separator.
  const userSectionStart = VOICE_ORDER.length;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <Tooltip
        content={
          <>Sound character of the instrument. One voice plays across the whole keyboard. Click to choose — preview on hover. <em>Make your own</em> opens an editor.</>
        }
      >
        <button
          type="button"
          onClick={togglePicker}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 w-[160px] transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground shrink-0">
            voice
          </span>
          <span className="font-mono text-sm text-inst-foreground truncate min-w-0 flex-1 text-left">{currentVoice.label || 'Sine'}</span>
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
            className={cn('text-inst-muted-foreground shrink-0 transition-transform', open && 'rotate-180')}
          >
            <path d="M2.5 4l2.5 2.5L7.5 4" />
          </svg>
        </button>
      </Tooltip>

      {open && (
        <div
          role="listbox"
          aria-label="voice"
          className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[180px] max-w-[calc(100vw-24px)] max-h-[60vh] overflow-y-auto rounded-2xl p-[1px]"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03), rgba(255,255,255,0.08))',
          }}
        >
          <div className="rounded-2xl bg-black/65 backdrop-blur-xl p-1.5">
            {rows.map((r, i) => {
              const isHighlighted = i === highlightIdx;
              if (r.kind === 'make') {
                return (
                  <div key="__make_section" className="mt-1 border-t border-white/[0.06] pt-1">
                    <button
                      type="button"
                      onPointerEnter={() => setHighlightIdx(i)}
                      onClick={() => commitRow(r)}
                      className={cn(
                        // taller on mobile for touch, collapses to compact on md+
                        'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 md:py-1.5 text-left transition-colors focus:outline-none',
                        isHighlighted ? 'bg-white/[0.10]' : 'hover:bg-white/[0.06]',
                      )}
                    >
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-transparent" />
                      <span className="font-mono text-sm text-inst-foreground">+ Make your own</span>
                    </button>
                  </div>
                );
              }

              const v = r.voice;
              const isCurrent = v.id === voice;
              // Separator before the first user voice — visual only, no label.
              const divider = r.isUser && i === userSectionStart ? (
                <div key={`__user_div_${i}`} className="my-1 border-t border-white/[0.06]" />
              ) : null;

              const row = (
                <div key={v.id} className="group/row flex items-center gap-0.5">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    onPointerEnter={() => {
                      setHighlightIdx(i);
                      previewVoiceById(v.id);
                    }}
                    onClick={() => commitRow(r)}
                    className={cn(
                      // taller on mobile for touch; min-w-0 so truncate inside flex works.
                      'flex flex-1 min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 md:py-1.5 text-left transition-colors focus:outline-none',
                      isHighlighted ? 'bg-white/[0.10]' : 'hover:bg-white/[0.06]',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0',
                        isCurrent ? 'bg-inst-highlight' : 'bg-transparent',
                      )}
                    />
                    <span className="font-mono text-sm text-inst-foreground truncate">{v.label}</span>
                  </button>
                  {/* Duplicate — built-ins and user voices both. Hover-revealed. */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); startDuplicateVoice(v); }}
                    aria-label={`duplicate ${v.label}`}
                    title="duplicate"
                    className="px-2 py-2 md:px-1.5 md:py-1 rounded-md text-inst-muted-foreground hover:text-inst-foreground hover:bg-white/[0.06] transition-colors opacity-100 md:opacity-0 md:group-hover/row:opacity-100 focus-visible:opacity-100"
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2.5" y="2.5" width="7" height="7" rx="1" />
                      <rect x="4.5" y="4.5" width="7" height="7" rx="1" />
                    </svg>
                  </button>
                  {r.isUser && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startEditUserVoice(v); }}
                      aria-label={`edit ${v.label}`}
                      title="edit"
                      className="px-2 py-2 md:px-1.5 md:py-1 rounded-md text-inst-muted-foreground hover:text-inst-foreground hover:bg-white/[0.06] transition-colors opacity-100 md:opacity-0 md:group-hover/row:opacity-100 focus-visible:opacity-100"
                    >
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.5 1.5l2 2-7.5 7.5H3v-2L10.5 1.5z" />
                      </svg>
                    </button>
                  )}
                </div>
              );

              return divider ? <div key={`__user_wrap_${v.id}`}>{divider}{row}</div> : row;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
