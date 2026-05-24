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

/**
 * Spawn a note for the looper's layer playback. Returns the live VoiceNote
 * handles so the caller can schedule a precise release later. Bypasses the
 * `live` map so layer-playback notes don't collide with user-played keys.
 *
 *   `startAt`  — audio context time to begin the note. Pass a future time
 *                for sample-accurate look-ahead scheduling.
 *   `dest`     — destination AudioNode (typically a per-layer GainNode).
 */
export function spawnLayerNote(opts: {
  freqs: number[];
  voice: VoiceSpec;
  startAt: number;
  dest: AudioNode;
}): VoiceNote[] {
  const ctx = getContext();
  const n   = opts.freqs.length;
  const gainScale = n === 1 ? 1 : 1 / Math.sqrt(n);
  return opts.freqs.map((freq) =>
    spawnFromProfile(opts.voice.profile, ctx, opts.dest, freq, gainScale, opts.startAt),
  );
}
