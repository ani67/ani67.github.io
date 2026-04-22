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

export async function ensureRunning(): Promise<boolean> {
  const c = getContext();
  if (c.state === 'suspended') await c.resume();
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
