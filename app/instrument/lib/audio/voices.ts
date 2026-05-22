/**
 * Voices — the instrument's timbre catalog.
 *
 * Every voice is described by a VoiceProfile (oscillators + amp envelope +
 * optional filter + optional LFO). spawnFromProfile() reads a profile and
 * builds the audio graph for a single pitch. Each spawned note returns a
 * VoiceNote whose release() tears it down with the profile's release tail.
 *
 * One voice plays at a time across the whole keyboard — chord notes from
 * Option mode spawn through the same voice with sqrt-N gain compensation.
 *
 * Names are instrument-flavoured (Felt, Reed, Drone) rather than technique-
 * flavoured (FM, subtractive, additive). The player picks a *character of
 * sound*, not a synthesis method.
 */

export interface ADSR {
  /** seconds */ attack:  number;
  /** seconds */ decay:   number;
  /** 0..1    */ sustain: number;
  /** seconds */ release: number;
}

export interface OscSpec {
  wave: OscillatorType;
  /** freq multiplier — 1 = fundamental, 2 = octave up, 1.5 = perfect 5th, 0.5 = octave down */
  ratio?: number;
  /** detune in cents (±) for unison thickening */
  detune?: number;
  /** per-oscillator gain inside the voice mix, 0..1 */
  gain?: number;
}

export interface FilterSpec {
  type: BiquadFilterType;
  /** Hz when the envelope is at rest (sustain × peak, or static if no env) */
  baseFreq: number;
  /** Hz at envelope peak — only used if env is present */
  peakFreq?: number;
  q?: number;
  env?: ADSR;
}

export interface LFOSpec {
  wave: OscillatorType;
  /** Hz */
  rate: number;
  /** target='pitch' → cents; target='amp' → 0..1 mix depth */
  depth: number;
  target: 'pitch' | 'amp';
}

export interface VoiceProfile {
  oscillators: OscSpec[];
  amp: ADSR;
  filter?: FilterSpec;
  lfo?: LFOSpec;
  /** master scale 0..1 — keeps loud waveforms (saw, square) at parity with sines */
  masterGain: number;
}

export interface VoiceSpec {
  id: string;
  label: string;
  blurb: string;
  profile: VoiceProfile;
}

/** Starting point for a new user-created voice — bland but legal. */
export function blankVoice(): VoiceSpec {
  return {
    id: '',
    label: '',
    blurb: '',
    profile: {
      oscillators: [{ wave: 'sine' }],
      amp: { attack: 0.02, decay: 0.30, sustain: 0.60, release: 0.40 },
      masterGain: 0.22,
    },
  };
}

/** kebab-case, alphanumeric + hyphens only, max 40 chars. */
export function slugifyLabel(label: string): string {
  return label.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    || 'voice';
}

export interface VoiceNote {
  release(immediate: boolean): void;
}

// ===========================================================================
// Spawn — turn a profile + frequency into a live audio sub-graph.
// ===========================================================================

export function spawnFromProfile(
  profile: VoiceProfile,
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  gainScale: number,
): VoiceNote {
  const t0 = ctx.currentTime;

  // Amplitude envelope — the gain node that the envelope runs against.
  const ampGain = ctx.createGain();
  const peak = profile.masterGain * gainScale;
  ampGain.gain.setValueAtTime(0, t0);
  ampGain.gain.linearRampToValueAtTime(peak, t0 + profile.amp.attack);
  ampGain.gain.linearRampToValueAtTime(
    peak * profile.amp.sustain,
    t0 + profile.amp.attack + profile.amp.decay,
  );

  // Optional filter, inserted between amp and dest.
  let tail: AudioNode = ampGain;
  let filterNode: BiquadFilterNode | null = null;
  if (profile.filter) {
    filterNode = ctx.createBiquadFilter();
    filterNode.type = profile.filter.type;
    filterNode.Q.value = profile.filter.q ?? 1;

    if (profile.filter.env && profile.filter.peakFreq != null) {
      // Filter envelope — sweep from base → peak → sustain.
      const sustainFreq =
        profile.filter.baseFreq +
        (profile.filter.peakFreq - profile.filter.baseFreq) * profile.filter.env.sustain;
      filterNode.frequency.setValueAtTime(profile.filter.baseFreq, t0);
      filterNode.frequency.linearRampToValueAtTime(
        profile.filter.peakFreq,
        t0 + profile.filter.env.attack,
      );
      filterNode.frequency.linearRampToValueAtTime(
        sustainFreq,
        t0 + profile.filter.env.attack + profile.filter.env.decay,
      );
    } else {
      filterNode.frequency.setValueAtTime(profile.filter.baseFreq, t0);
    }

    ampGain.connect(filterNode);
    tail = filterNode;
  }
  tail.connect(dest);

  // Oscillators feed into ampGain through per-osc gain.
  const oscs: OscillatorNode[] = [];
  for (const o of profile.oscillators) {
    const osc = ctx.createOscillator();
    osc.type = o.wave;
    osc.frequency.value = freq * (o.ratio ?? 1);
    osc.detune.value = o.detune ?? 0;
    if ((o.gain ?? 1) !== 1) {
      const sg = ctx.createGain();
      sg.gain.value = o.gain ?? 1;
      osc.connect(sg).connect(ampGain);
    } else {
      osc.connect(ampGain);
    }
    osc.start(t0);
    oscs.push(osc);
  }

  // Optional LFO (pitch-target only for Phase 1 — amp tremolo isn't used by any voice yet).
  let lfo: OscillatorNode | null = null;
  if (profile.lfo && profile.lfo.target === 'pitch') {
    lfo = ctx.createOscillator();
    lfo.type = profile.lfo.wave;
    lfo.frequency.value = profile.lfo.rate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = profile.lfo.depth; // cents
    lfo.connect(lfoGain);
    for (const osc of oscs) lfoGain.connect(osc.detune);
    lfo.start(t0);
  }

  return {
    release(immediate: boolean) {
      const tNow = ctx.currentTime;
      const releaseTime = immediate ? 0.01 : profile.amp.release;

      ampGain.gain.cancelScheduledValues(tNow);
      ampGain.gain.setValueAtTime(ampGain.gain.value, tNow);
      ampGain.gain.linearRampToValueAtTime(0, tNow + releaseTime);

      if (filterNode && profile.filter?.env && profile.filter.peakFreq != null) {
        filterNode.frequency.cancelScheduledValues(tNow);
        filterNode.frequency.setValueAtTime(filterNode.frequency.value, tNow);
        filterNode.frequency.linearRampToValueAtTime(
          profile.filter.baseFreq,
          tNow + releaseTime,
        );
      }

      const stopAt = tNow + releaseTime + 0.02;
      for (const osc of oscs) osc.stop(stopAt);
      if (lfo) lfo.stop(stopAt);
    },
  };
}

// ===========================================================================
// The ten voices.
// Numbers are tuned by listening, not by theory — change them and re-listen.
// ===========================================================================

export type VoiceId =
  | 'sine' | 'glass' | 'reed' | 'brass' | 'felt'
  | 'pluck' | 'mallet' | 'pad' | 'drone' | 'hollow';

export const VOICES: Record<VoiceId, VoiceSpec> = {
  sine: {
    id: 'sine',
    label: 'Sine',
    blurb: 'pure tone',
    profile: {
      oscillators: [{ wave: 'sine' }],
      amp: { attack: 0.012, decay: 0.25, sustain: 0.60, release: 0.35 },
      masterGain: 0.22,
    },
  },

  glass: {
    id: 'glass',
    label: 'Glass',
    blurb: 'soft, slightly chimey',
    profile: {
      oscillators: [
        { wave: 'sine' },
        { wave: 'sine', ratio: 2, gain: 0.28 },
      ],
      amp: { attack: 0.008, decay: 0.40, sustain: 0.45, release: 0.55 },
      masterGain: 0.20,
    },
  },

  reed: {
    id: 'reed',
    label: 'Reed',
    blurb: 'reedy, with breath vibrato',
    profile: {
      oscillators: [{ wave: 'triangle' }],
      amp: { attack: 0.030, decay: 0.20, sustain: 0.78, release: 0.22 },
      lfo: { wave: 'sine', rate: 5.5, depth: 8, target: 'pitch' },
      masterGain: 0.22,
    },
  },

  brass: {
    id: 'brass',
    label: 'Brass',
    blurb: 'bright, fading to warm',
    profile: {
      oscillators: [{ wave: 'sawtooth' }],
      amp: { attack: 0.020, decay: 0.20, sustain: 0.70, release: 0.28 },
      filter: {
        type: 'lowpass',
        baseFreq: 420,
        peakFreq: 2800,
        q: 1.0,
        env: { attack: 0.025, decay: 0.25, sustain: 0.45, release: 0.28 },
      },
      masterGain: 0.16,
    },
  },

  felt: {
    id: 'felt',
    label: 'Felt',
    blurb: 'soft, hammered',
    profile: {
      oscillators: [
        { wave: 'triangle' },
        { wave: 'sine', ratio: 2, gain: 0.18 },
      ],
      amp: { attack: 0.004, decay: 0.70, sustain: 0.22, release: 0.50 },
      filter: { type: 'lowpass', baseFreq: 1800, q: 0.7 },
      masterGain: 0.24,
    },
  },

  pluck: {
    id: 'pluck',
    label: 'Pluck',
    blurb: 'plucked string',
    profile: {
      oscillators: [{ wave: 'sawtooth' }],
      // Near-zero sustain so the note dies off like a real pluck.
      amp: { attack: 0.002, decay: 0.28, sustain: 0.05, release: 0.20 },
      filter: {
        type: 'lowpass',
        baseFreq: 850,
        peakFreq: 3200,
        q: 1.1,
        env: { attack: 0.005, decay: 0.22, sustain: 0.18, release: 0.20 },
      },
      masterGain: 0.20,
    },
  },

  mallet: {
    id: 'mallet',
    label: 'Mallet',
    blurb: 'bell-like, percussive',
    profile: {
      oscillators: [
        { wave: 'sine' },
        // High inharmonic-ish partial — gives the metallic "ping" attack.
        { wave: 'sine', ratio: 4, gain: 0.32 },
      ],
      amp: { attack: 0.002, decay: 0.65, sustain: 0.0, release: 0.45 },
      masterGain: 0.22,
    },
  },

  pad: {
    id: 'pad',
    label: 'Pad',
    blurb: 'detuned, airy',
    profile: {
      oscillators: [
        { wave: 'sawtooth', detune: -7 },
        { wave: 'sawtooth', detune:  7 },
      ],
      amp: { attack: 0.80, decay: 0.50, sustain: 0.82, release: 1.50 },
      filter: { type: 'lowpass', baseFreq: 1200, q: 0.5 },
      masterGain: 0.14,
    },
  },

  drone: {
    id: 'drone',
    label: 'Drone',
    blurb: 'tanpura-like, three-tone',
    profile: {
      oscillators: [
        { wave: 'sine' },
        // 3/2 = perfect fifth in just intonation — flatters the śruti grid.
        { wave: 'sine', ratio: 1.5, gain: 0.55 },
        { wave: 'sine', ratio: 2,   gain: 0.45 },
      ],
      amp: { attack: 0.55, decay: 0.80, sustain: 0.85, release: 2.40 },
      masterGain: 0.20,
    },
  },

  hollow: {
    id: 'hollow',
    label: 'Hollow',
    blurb: 'clarinet-flavoured',
    profile: {
      oscillators: [{ wave: 'square' }],
      amp: { attack: 0.008, decay: 0.25, sustain: 0.65, release: 0.25 },
      filter: { type: 'lowpass', baseFreq: 1600, q: 0.8 },
      masterGain: 0.16,
    },
  },
};

export const VOICE_ORDER: readonly VoiceId[] = [
  'sine', 'glass', 'reed', 'brass', 'felt',
  'pluck', 'mallet', 'pad', 'drone', 'hollow',
];

/**
 * Look up a voice by string id across the built-in catalog and a user-voices
 * record. Returns Sine if nothing matches — every lookup is guaranteed to
 * produce something playable.
 */
export function lookupVoice(
  id: string,
  userVoices: Record<string, VoiceSpec>,
): VoiceSpec {
  if (id in VOICES) return VOICES[id as VoiceId];
  if (id in userVoices) return userVoices[id];
  return VOICES.sine;
}
