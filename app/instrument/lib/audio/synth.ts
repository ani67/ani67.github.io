import type { RowId } from '../types';
import { getContext, getMaster } from './context';

interface Profile {
  waveform: OscillatorType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  gain: number;
}

// All rows share one voice — soft sine with long release.
// Revisit D10 in notes/02-mvp-build.md for the per-row alternative.
const VOICE_PROFILE: Profile = {
  waveform: 'sine',
  attack:   0.012,
  decay:    0.25,
  sustain:  0.60,
  release:  0.35,
  gain:     0.22,
};

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

// Multiple voices per code — a chord / drone on one key-press spawns N voices under one code.
const voices = new Map<string, Voice[]>();

function spawnVoice(freq: number, profile: Profile, gainScale: number): Voice {
  const c  = getContext();
  const m  = getMaster();
  const t0 = c.currentTime;

  const osc = c.createOscillator();
  osc.type = profile.waveform;
  osc.frequency.value = freq;

  const g = c.createGain();
  const peak = profile.gain * gainScale;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + profile.attack);
  g.gain.linearRampToValueAtTime(peak * profile.sustain, t0 + profile.attack + profile.decay);

  osc.connect(g).connect(m);
  osc.start(t0);

  return { osc, gain: g };
}

export function synthNoteOn(opts: { code: string; freqs: number[]; row: RowId }): void {
  if (voices.has(opts.code)) synthNoteOff({ code: opts.code, immediate: true });

  const n = opts.freqs.length;
  const gainScale = n === 1 ? 1 : 1 / Math.sqrt(n);

  const spawned = opts.freqs.map((freq) => spawnVoice(freq, VOICE_PROFILE, gainScale));
  voices.set(opts.code, spawned);
}

export function synthNoteOff(opts: { code: string; immediate?: boolean }): void {
  const vs = voices.get(opts.code);
  if (!vs) return;
  voices.delete(opts.code);

  const c  = getContext();
  const t0 = c.currentTime;
  const rel = opts.immediate ? 0.01 : VOICE_PROFILE.release;

  for (const v of vs) {
    v.gain.gain.cancelScheduledValues(t0);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t0);
    v.gain.gain.linearRampToValueAtTime(0, t0 + rel);
    v.osc.stop(t0 + rel + 0.02);
  }
}

export function synthAllNotesOff(): void {
  for (const code of [...voices.keys()]) synthNoteOff({ code });
}
