/**
 * Recorder — captures the instrument's master output to a downloadable file.
 *
 * Two parallel paths run while recording:
 *   1. MediaRecorder on the master MediaStream → compressed Blob (webm/opus
 *      on Chrome/Firefox, mp4/aac on Safari). Cheap, native, gives "webm".
 *   2. A ScriptProcessorNode tap on the master GainNode → raw Float32 PCM
 *      buffers. Used to encode WAV (inline) or MP3 (via lamejs) on stop.
 *
 * Both run regardless of the chosen format — the cost is a few MB of PCM
 * memory per minute, which is fine for an instrument toy. The choice only
 * affects what we emit on stop, so the user can also flip the format chip
 * mid-recording and the final file matches the latest choice.
 *
 * ScriptProcessorNode is officially deprecated but still works in every
 * browser; AudioWorklet would be the modern path but adds a worklet-module
 * file to /public for a single tap. Not worth the complexity here.
 */

import { ensureRunning, getContext, getMaster, getRecorderStream } from './context';

export type RecordFormat = 'webm' | 'wav' | 'mp3';

// Preference order — pick the first format the browser reports as supported.
// Chrome/Firefox favour webm/opus; Safari favours mp4/aac.
const MIME_OPTIONS = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

function pickMime(): string | undefined {
  return MIME_OPTIONS.find((m) => MediaRecorder.isTypeSupported(m));
}

interface RecState {
  mediaRecorder: MediaRecorder;
  webmChunks: Blob[];
  webmMime: string;
  processor: ScriptProcessorNode;
  silentSink: GainNode;
  pcmLeft: Float32Array[];
  pcmRight: Float32Array[];
  sampleRate: number;
}

let state: RecState | null = null;

export async function startRecording(): Promise<boolean> {
  if (state) return false;
  const ok = await ensureRunning();
  if (!ok) return false;

  const ctx    = getContext();
  const master = getMaster();

  // --- WebM path ---------------------------------------------------------
  const stream = getRecorderStream();
  const mime   = pickMime();
  const mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const webmChunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) webmChunks.push(e.data);
  };
  mediaRecorder.start(1000); // flush every 1s so memory doesn't grow unbounded

  // --- PCM tap (for wav/mp3) --------------------------------------------
  const BUFFER_SIZE = 4096;
  // 2 channels in / 2 channels out — Web Audio defaults master to stereo.
  const processor = ctx.createScriptProcessor(BUFFER_SIZE, 2, 2);
  const pcmLeft:  Float32Array[] = [];
  const pcmRight: Float32Array[] = [];
  processor.onaudioprocess = (e) => {
    const inL = e.inputBuffer.getChannelData(0);
    const inR = e.inputBuffer.numberOfChannels > 1
      ? e.inputBuffer.getChannelData(1)
      : inL;
    // Copy — the AudioBuffer's data is reused across callbacks.
    pcmLeft.push(new Float32Array(inL));
    pcmRight.push(new Float32Array(inR));
  };

  // ScriptProcessor only runs when it's connected through to destination.
  // Route master → processor → silentSink → destination so the tap pulls
  // audio without doubling what the user hears.
  const silentSink = ctx.createGain();
  silentSink.gain.value = 0;
  master.connect(processor);
  processor.connect(silentSink);
  silentSink.connect(ctx.destination);

  state = {
    mediaRecorder,
    webmChunks,
    webmMime: mediaRecorder.mimeType || 'audio/webm',
    processor,
    silentSink,
    pcmLeft,
    pcmRight,
    sampleRate: ctx.sampleRate,
  };

  return true;
}

export function isRecording(): boolean {
  return state !== null;
}

export async function stopRecording(format: RecordFormat): Promise<Blob | null> {
  const s = state;
  if (!s) return null;
  state = null;

  // Tear down the PCM tap. The MediaRecorder finishes on its own onstop tick.
  const master = getMaster();
  try { master.disconnect(s.processor); } catch { /* */ }
  try { s.processor.disconnect(); }       catch { /* */ }
  try { s.silentSink.disconnect(); }      catch { /* */ }

  const webmBlob = await new Promise<Blob>((resolve) => {
    s.mediaRecorder.onstop = () => {
      resolve(new Blob(s.webmChunks, { type: s.webmMime }));
    };
    s.mediaRecorder.stop();
  });

  if (format === 'webm') return webmBlob;

  // wav/mp3 — encode the captured PCM.
  const [left, right] = concatChannels(s.pcmLeft, s.pcmRight);
  if (left.length === 0) return null;

  if (format === 'wav') return encodeWav(left, right, s.sampleRate);
  if (format === 'mp3') return await encodeMp3(left, right, s.sampleRate);
  return null;
}

function concatChannels(
  left: Float32Array[],
  right: Float32Array[],
): [Float32Array, Float32Array] {
  let total = 0;
  for (const b of left) total += b.length;
  const L = new Float32Array(total);
  const R = new Float32Array(total);
  let offset = 0;
  for (let i = 0; i < left.length; i++) {
    L.set(left[i], offset);
    R.set(right[i], offset);
    offset += left[i].length;
  }
  return [L, R];
}

/**
 * 16-bit PCM stereo WAV with the standard 44-byte RIFF header. Float samples
 * are clamped to [-1, 1] and scaled to int16 range with the asymmetric
 * 0x8000 / 0x7FFF convention so the magnitude is preserved.
 */
function encodeWav(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const numFrames = left.length;
  const dataSize  = numFrames * 2 * 2; // 2 channels * 2 bytes
  const buf  = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  let p = 0;
  const writeStr = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); };
  const writeU32 = (n: number) => { view.setUint32(p, n, true); p += 4; };
  const writeU16 = (n: number) => { view.setUint16(p, n, true); p += 2; };

  writeStr('RIFF');
  writeU32(36 + dataSize);
  writeStr('WAVE');
  writeStr('fmt ');
  writeU32(16);                // PCM fmt chunk size
  writeU16(1);                 // PCM format tag
  writeU16(2);                 // channels
  writeU32(sampleRate);
  writeU32(sampleRate * 2 * 2); // byte rate
  writeU16(4);                 // block align (channels * bytesPerSample)
  writeU16(16);                // bits per sample
  writeStr('data');
  writeU32(dataSize);

  for (let i = 0; i < numFrames; i++) {
    const lf = Math.max(-1, Math.min(1, left[i]));
    const rf = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(p, lf < 0 ? lf * 0x8000 : lf * 0x7FFF, true); p += 2;
    view.setInt16(p, rf < 0 ? rf * 0x8000 : rf * 0x7FFF, true); p += 2;
  }

  return new Blob([buf], { type: 'audio/wav' });
}

/**
 * 128 kbps CBR MP3 via lamejs. Loaded on-demand so the ~80 KB encoder isn't
 * paid for by users who never pick mp3.
 */
async function encodeMp3(left: Float32Array, right: Float32Array, sampleRate: number): Promise<Blob> {
  // Lazy-load lamejs so the ~80 KB encoder is only paid for by users who
  // actually pick mp3. Types live in /types/lamejs.d.ts.
  const { Mp3Encoder } = await import('lamejs');

  const KBPS       = 128;
  const BLOCK_SIZE = 1152; // one MP3 frame's worth of samples
  const encoder    = new Mp3Encoder(2, sampleRate, KBPS);

  const l16 = floatToInt16(left);
  const r16 = floatToInt16(right);

  const mp3Data: Int8Array[] = [];
  for (let i = 0; i < l16.length; i += BLOCK_SIZE) {
    const lChunk = l16.subarray(i, i + BLOCK_SIZE);
    const rChunk = r16.subarray(i, i + BLOCK_SIZE);
    const out = encoder.encodeBuffer(lChunk, rChunk);
    if (out.length > 0) mp3Data.push(out);
  }
  const tail = encoder.flush();
  if (tail.length > 0) mp3Data.push(tail);

  // BlobPart typing in lib.dom expects ArrayBuffer-backed views; Int8Array's
  // ArrayBufferLike trips it. Cast — runtime is fine.
  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mpeg' });
}

function floatToInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(-1, Math.min(1, f[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
  }
  return out;
}

export function fileExtensionFor(format: RecordFormat): string {
  return format === 'wav' ? 'wav' : format === 'mp3' ? 'mp3' : 'webm';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stampForFilename(): string {
  const d   = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
