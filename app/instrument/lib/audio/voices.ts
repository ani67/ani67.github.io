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

/** Sound source for an oscillator slot. 'noise' spawns a looped white-noise
 *  buffer instead of a tone — useful for drums, breath, wind, hi-hats. */
export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise';

export interface OscSpec {
  wave: Wave;
  /** freq multiplier — 1 = fundamental, 2 = octave up, 1.5 = perfect 5th, 0.5 = octave down */
  ratio?: number;
  /** detune in cents (±) for unison thickening */
  detune?: number;
  /** per-oscillator gain inside the voice mix, 0..1 */
  gain?: number;
}

export interface DistortionSpec {
  /** 0..1 — drive amount through a tanh waveshaper. 0 = clean. */
  amount: number;
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
  distortion?: DistortionSpec;
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

/**
 * Slug for use as object key + share-URL fragment. Preserves Unicode letters
 * (Hindi, Sanskrit, Japanese, etc.) via \p{L}\p{N}, so a label like "Tanpura"
 * or "विशेष" produces a meaningful, unique id rather than the literal
 * fallback `voice`.
 */
export function slugifyLabel(label: string): string {
  return label.trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    || 'voice';
}

export interface VoiceNote {
  release(immediate: boolean): void;
}

// ===========================================================================
// Noise + distortion helpers.
// ===========================================================================

// White-noise buffer — 2 seconds at the AudioContext's sample rate, cached
// per-context so noise oscillators don't regenerate the buffer per note.
const noiseBufferCache = new WeakMap<AudioContext, AudioBuffer>();
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  let buf = noiseBufferCache.get(ctx);
  if (buf) return buf;
  const seconds = 2;
  buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBufferCache.set(ctx, buf);
  return buf;
}

// tanh-shaped waveshaper curve. amount=0 is near-identity, amount=1 hard.
function makeDistortionCurve(amount: number): Float32Array {
  const drive = 1 + Math.max(0, Math.min(1, amount)) * 19;
  const n = 256;
  // Allocate on an explicit ArrayBuffer so the resulting Float32Array satisfies
  // WaveShaperNode.curve's narrower TypeScript signature.
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive);
  }
  return curve;
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

  // Optional distortion — tanh waveshaper, post-filter so the filter
  // colours the signal pre-saturation (classic order; lowpass → drive
  // sounds warm, drive → lowpass sounds buzzy).
  if (profile.distortion && profile.distortion.amount > 0) {
    const shaper = ctx.createWaveShaper();
    // Narrowed Float32Array typing — runtime is identical.
    shaper.curve = makeDistortionCurve(profile.distortion.amount) as Float32Array<ArrayBuffer>;
    shaper.oversample = '2x';
    tail.connect(shaper);
    tail = shaper;
  }

  // Tremolo gain — only created if an amp-target LFO is present. Sandwiched
  // between the filter (or amp) tail and the destination so the LFO can
  // modulate its gain around 1.0 (centred so average loudness is preserved).
  let tremGain: GainNode | null = null;
  if (profile.lfo && profile.lfo.target === 'amp') {
    tremGain = ctx.createGain();
    tremGain.gain.value = 1;
    tail.connect(tremGain);
    tail = tremGain;
  }
  tail.connect(dest);

  // Oscillators feed into ampGain through per-osc gain. Each is either an
  // OscillatorNode (tone) or an AudioBufferSourceNode looping white noise.
  // Both share start/stop + a detune AudioParam, so the LFO can wobble either.
  type Source = OscillatorNode | AudioBufferSourceNode;
  const oscs: Source[] = [];
  for (const o of profile.oscillators) {
    let src: Source;
    if (o.wave === 'noise') {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      noise.loop = true;
      src = noise;
    } else {
      const osc = ctx.createOscillator();
      osc.type = o.wave;
      osc.frequency.value = freq * (o.ratio ?? 1);
      src = osc;
    }
    src.detune.value = o.detune ?? 0;
    if ((o.gain ?? 1) !== 1) {
      const sg = ctx.createGain();
      sg.gain.value = o.gain ?? 1;
      src.connect(sg).connect(ampGain);
    } else {
      src.connect(ampGain);
    }
    src.start(t0);
    oscs.push(src);
  }

  // Optional LFO. Pitch target → modulate every source's detune (cents). Amp
  // target → modulate tremGain.gain around its 1.0 base (0..1 depth).
  let lfo: OscillatorNode | null = null;
  if (profile.lfo) {
    lfo = ctx.createOscillator();
    lfo.type = profile.lfo.wave;
    lfo.frequency.value = profile.lfo.rate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = profile.lfo.depth;
    lfo.connect(lfoGain);
    if (profile.lfo.target === 'pitch') {
      for (const osc of oscs) lfoGain.connect(osc.detune);
    } else if (tremGain) {
      lfoGain.connect(tremGain.gain);
    }
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
  | 'pluck' | 'mallet' | 'pad' | 'drone' | 'hollow'
  | 'kick' | 'fuzz';

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

  kick: {
    id: 'kick',
    label: 'Kick',
    blurb: 'one-shot, percussive',
    profile: {
      oscillators: [
        // Low sine — the "thump." Without a pitch envelope we can't sweep,
        // so the body sits at a fixed sub-bass pitch via low ratio.
        { wave: 'sine',  ratio: 0.25, gain: 1.0 },
        // Noise burst — the click / transient on top.
        { wave: 'noise', gain: 0.35 },
      ],
      amp: { attack: 0.001, decay: 0.18, sustain: 0.0, release: 0.10 },
      filter: { type: 'lowpass', baseFreq: 220, q: 0.9 },
      masterGain: 0.30,
    },
  },

  fuzz: {
    id: 'fuzz',
    label: 'Fuzz Bass',
    blurb: 'gritty, saturated',
    profile: {
      oscillators: [
        { wave: 'sawtooth', detune: -7 },
        { wave: 'sawtooth', detune:  7 },
      ],
      amp: { attack: 0.005, decay: 0.20, sustain: 0.65, release: 0.22 },
      filter: { type: 'lowpass', baseFreq: 1300, q: 1.0 },
      distortion: { amount: 0.62 },
      masterGain: 0.16,
    },
  },
};

export const VOICE_ORDER: readonly VoiceId[] = [
  'sine', 'glass', 'reed', 'brass', 'felt',
  'pluck', 'mallet', 'pad', 'drone', 'hollow',
  'kick', 'fuzz',
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

// ===========================================================================
// Validation — used when ingesting voices from untrusted sources (URL hash
// shares + localStorage). Clamps numbers, fills defaults, drops anything
// catastrophic. The synth assumes well-formed input; this is the perimeter.
// ===========================================================================

const WAVE_TYPES: ReadonlySet<Wave> = new Set<Wave>(['sine', 'triangle', 'square', 'sawtooth', 'noise']);
const LFO_WAVE_TYPES: ReadonlySet<OscillatorType> = new Set<OscillatorType>(['sine', 'triangle', 'square', 'sawtooth']);
const FILTER_TYPES = new Set<BiquadFilterType>(['lowpass', 'highpass', 'bandpass', 'notch']);
const clamp = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : lo;

function validateADSR(maybe: unknown): ADSR {
  const m = (maybe ?? {}) as Partial<ADSR>;
  return {
    attack:  clamp(Number(m.attack  ?? 0.02), 0, 4),
    decay:   clamp(Number(m.decay   ?? 0.30), 0, 4),
    sustain: clamp(Number(m.sustain ?? 0.60), 0, 1),
    release: clamp(Number(m.release ?? 0.40), 0, 8),
  };
}

function validateOsc(maybe: unknown): OscSpec {
  const m = (maybe ?? {}) as Partial<OscSpec>;
  return {
    wave:   WAVE_TYPES.has(m.wave as Wave) ? (m.wave as Wave) : 'sine',
    ratio:  clamp(Number(m.ratio  ?? 1), 0.01, 16),
    detune: clamp(Number(m.detune ?? 0), -200, 200),
    gain:   clamp(Number(m.gain   ?? 1), 0, 1),
  };
}

function validateDistortion(maybe: unknown): DistortionSpec | undefined {
  if (!maybe || typeof maybe !== 'object') return undefined;
  const m = maybe as Partial<DistortionSpec>;
  const amount = clamp(Number(m.amount ?? 0), 0, 1);
  if (amount <= 0) return undefined;
  return { amount };
}

function validateFilter(maybe: unknown): FilterSpec | undefined {
  if (!maybe || typeof maybe !== 'object') return undefined;
  const m = maybe as Partial<FilterSpec>;
  const f: FilterSpec = {
    type:     FILTER_TYPES.has(m.type as BiquadFilterType) ? (m.type as BiquadFilterType) : 'lowpass',
    baseFreq: clamp(Number(m.baseFreq ?? 1200), 20, 20000),
    q:        clamp(Number(m.q ?? 0.7), 0.05, 30),
  };
  if (m.env) f.env = validateADSR(m.env);
  if (m.peakFreq != null) f.peakFreq = clamp(Number(m.peakFreq), 20, 20000);
  return f;
}

function validateLFO(maybe: unknown): LFOSpec | undefined {
  if (!maybe || typeof maybe !== 'object') return undefined;
  const m = maybe as Partial<LFOSpec>;
  const target = m.target === 'amp' ? 'amp' : 'pitch';
  return {
    wave:   LFO_WAVE_TYPES.has(m.wave as OscillatorType) ? (m.wave as OscillatorType) : 'sine',
    rate:   clamp(Number(m.rate  ?? 5), 0.05, 40),
    depth:  clamp(Number(m.depth ?? (target === 'pitch' ? 10 : 0.3)), 0, target === 'pitch' ? 200 : 1),
    target,
  };
}

/**
 * Returns a fully-validated VoiceSpec, or null if the input is so malformed
 * it can't represent a voice (e.g. not an object at all).
 */
export function validateVoiceSpec(maybe: unknown): VoiceSpec | null {
  if (!maybe || typeof maybe !== 'object') return null;
  const m = maybe as Partial<VoiceSpec> & { profile?: Partial<VoiceProfile> };

  const rawOsc = Array.isArray(m.profile?.oscillators) ? m.profile.oscillators : [];
  const oscillators = rawOsc.slice(0, 8).map(validateOsc);
  if (oscillators.length === 0) oscillators.push({ wave: 'sine' });

  const profile: VoiceProfile = {
    oscillators,
    amp:        validateADSR(m.profile?.amp),
    filter:     validateFilter(m.profile?.filter),
    distortion: validateDistortion(m.profile?.distortion),
    lfo:        validateLFO(m.profile?.lfo),
    masterGain: clamp(Number(m.profile?.masterGain ?? 0.22), 0, 1),
  };

  return {
    id:    typeof m.id    === 'string' ? m.id.slice(0, 80)    : '',
    label: typeof m.label === 'string' ? m.label.slice(0, 80) : '',
    blurb: typeof m.blurb === 'string' ? m.blurb.slice(0, 80) : '',
    profile,
  };
}

/** Validate a whole userVoices record; drop entries that fail. */
export function validateUserVoicesRecord(maybe: unknown): Record<string, VoiceSpec> {
  if (!maybe || typeof maybe !== 'object') return {};
  const result: Record<string, VoiceSpec> = {};
  for (const [k, v] of Object.entries(maybe as Record<string, unknown>)) {
    if (typeof k !== 'string' || !k) continue;
    const spec = validateVoiceSpec(v);
    if (spec) result[k] = { ...spec, id: k };
  }
  return result;
}
