let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let recorderDest: MediaStreamAudioDestinationNode | null = null;

export function getContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function getMaster(): GainNode {
  getContext();
  return master as GainNode;
}

let primed = false;
/**
 * Play one sample of silence through the destination. Some browsers
 * (notably iOS Safari) report the AudioContext as 'running' after
 * resume() but won't actually emit sound until a render has happened.
 * Cheap, idempotent, called once per context.
 */
function primeOnce(c: AudioContext): void {
  if (primed) return;
  primed = true;
  try {
    const buf = c.createBuffer(1, 1, c.sampleRate);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    src.stop(c.currentTime + 0.001);
  } catch { /* not catastrophic — best effort */ }
}

export async function ensureRunning(): Promise<boolean> {
  const c = getContext();
  if (c.state === 'suspended') await c.resume();
  if (c.state === 'running') primeOnce(c);
  return c.state === 'running';
}

export function isRunning(): boolean {
  return ctx !== null && ctx.state === 'running';
}

/**
 * Lazily create a MediaStreamAudioDestinationNode connected to master and return its stream.
 * Used by the recorder. Safe to call repeatedly — the destination is cached,
 * and master only gets connected to it once.
 */
export function getRecorderStream(): MediaStream {
  const c = getContext();
  if (!recorderDest) {
    recorderDest = c.createMediaStreamDestination();
    (master as GainNode).connect(recorderDest);
  }
  return recorderDest.stream;
}
