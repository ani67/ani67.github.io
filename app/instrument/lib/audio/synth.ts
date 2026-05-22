import { getContext, getMaster } from './context';
import { spawnFromProfile, type VoiceNote, type VoiceSpec } from './voices';

// Each pressed code maps to N live notes (one per chord pitch).
// All notes under one code share a voice spec — chord polyphony, not
// per-note timbres.
const live = new Map<string, VoiceNote[]>();

export function synthNoteOn(opts: { code: string; freqs: number[]; voice: VoiceSpec }): void {
  if (live.has(opts.code)) synthNoteOff({ code: opts.code, immediate: true });

  const ctx    = getContext();
  const dest   = getMaster();
  const n      = opts.freqs.length;
  const gainScale = n === 1 ? 1 : 1 / Math.sqrt(n);

  const notes = opts.freqs.map((freq) =>
    spawnFromProfile(opts.voice.profile, ctx, dest, freq, gainScale),
  );
  live.set(opts.code, notes);
}

export function synthNoteOff(opts: { code: string; immediate?: boolean }): void {
  const notes = live.get(opts.code);
  if (!notes) return;
  live.delete(opts.code);
  for (const n of notes) n.release(opts.immediate === true);
}

export function synthAllNotesOff(): void {
  for (const code of [...live.keys()]) synthNoteOff({ code });
}
