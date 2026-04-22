import { ensureRunning, getRecorderStream } from './context';

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

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];

export async function startRecording(): Promise<boolean> {
  if (recorder && recorder.state === 'recording') return false;

  const ok = await ensureRunning();
  if (!ok) return false;

  const stream = getRecorderStream();
  const mime   = pickMime();

  recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(1000);   // flush chunks every second so memory doesn't grow unbounded
  return true;
}

export function isRecording(): boolean {
  return recorder?.state === 'recording';
}

export function stopRecording(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const r = recorder;
    if (!r) {
      resolve(null);
      return;
    }
    const capturedChunks = chunks;
    r.onstop = () => {
      const type = r.mimeType || 'audio/webm';
      resolve(new Blob(capturedChunks, { type }));
    };
    r.stop();
    recorder = null;
    chunks = [];
  });
}

export function fileExtensionForMime(mime: string): string {
  if (mime.includes('mp4'))  return 'm4a';
  if (mime.includes('ogg'))  return 'ogg';
  return 'webm';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Keep the blob URL alive briefly so the browser can start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stampForFilename(): string {
  const d   = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
