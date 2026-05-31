'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { cn } from '../lib/utils';
import { Tooltip } from './ui/tooltip';
import type { RecordFormat } from '../lib/audio/recorder';
import {
  startRecording,
  stopRecording,
  downloadBlob,
  fileExtensionFor,
  stampForFilename,
} from '../lib/audio/recorder';

const FORMAT_ORDER: RecordFormat[] = ['webm', 'wav', 'mp3'];

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Record chip. Single visual chip with two click zones:
 *   left  — start / stop recording (the dot + "rec" + status label)
 *   right — cycle the output format (WEBM → WAV → MP3 → …)
 * A 1px divider makes the two zones legible; both share the chip's frame
 * so the mobile header stays a single line instead of two competing pills.
 */
export function RecordButton() {
  const [recording, setRecording] = useState(false);
  const [encoding,  setEncoding]  = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const startRef                  = useRef<number | null>(null);

  const format    = useStore((s) => s.recordFormat);
  const setFormat = useStore((s) => s.setRecordFormat);

  useEffect(() => {
    if (!recording) {
      setElapsed(0);
      startRef.current = null;
      return;
    }
    startRef.current = performance.now();
    const id = window.setInterval(() => {
      if (startRef.current != null) {
        setElapsed(Math.floor((performance.now() - startRef.current) / 1000));
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [recording]);

  const onRecordClick = async () => {
    if (encoding) return;
    if (!recording) {
      const ok = await startRecording();
      if (ok) setRecording(true);
      return;
    }
    // Capture the format at stop-time so flipping it mid-recording works.
    const chosen = useStore.getState().recordFormat;
    setEncoding(true);
    setRecording(false);
    try {
      const blob = await stopRecording(chosen);
      if (blob && blob.size > 0) {
        downloadBlob(blob, `instrument-${stampForFilename()}.${fileExtensionFor(chosen)}`);
      }
    } finally {
      setEncoding(false);
    }
  };

  const onFormatClick = () => {
    const i = FORMAT_ORDER.indexOf(format);
    setFormat(FORMAT_ORDER[(i + 1) % FORMAT_ORDER.length]);
  };

  const statusLabel = encoding
    ? 'enc'
    : recording
      ? formatElapsed(elapsed)
      : 'off';

  return (
    <div className="inst-glass-chip inline-flex items-stretch rounded-full overflow-hidden">
      {/* --- Record zone ---------------------------------------------- */}
      <Tooltip
        content={
          encoding ? <>Encoding {format}…</>
          : recording ? <>Stop recording and download as {format.toUpperCase()}.</>
          : <>Start recording. File will download as {format.toUpperCase()} on stop.</>
        }
      >
        <button
          type="button"
          onClick={onRecordClick}
          disabled={encoding}
          aria-label={recording ? 'stop recording' : 'start recording'}
          className="inline-flex items-center gap-2 pl-3 pr-2.5 py-1 transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.06] focus-visible:outline-none focus-visible:bg-white/[0.06] disabled:cursor-progress"
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full shrink-0 transition-colors duration-[220ms] ease-inst-out-expo',
              recording
                ? 'bg-inst-destructive shadow-[0_0_10px_hsl(var(--inst-destructive))] animate-pulse'
                : encoding
                  ? 'bg-inst-foreground animate-pulse'
                  : 'bg-inst-muted-foreground'
            )}
          />
          <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground shrink-0">
            rec
          </span>
          <span className="font-mono text-sm text-inst-foreground tabular-nums min-w-[36px] text-left">
            {statusLabel}
          </span>
        </button>
      </Tooltip>

      {/* --- Divider -------------------------------------------------- */}
      <span aria-hidden className="w-px bg-white/[0.08] self-stretch" />

      {/* --- Format zone --------------------------------------------- */}
      <Tooltip
        content={
          <>
            Output format. <strong>WebM</strong> is browser-native (small, lossy).
            {' '}<strong>WAV</strong> is lossless PCM (large).
            {' '}<strong>MP3</strong> is 128 kbps. Click to cycle.
          </>
        }
      >
        <button
          type="button"
          onClick={onFormatClick}
          aria-label={`recording format: ${format}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.06] focus-visible:outline-none focus-visible:bg-white/[0.06]"
        >
          <span className="font-mono text-sm text-inst-foreground uppercase tabular-nums min-w-[34px] text-left">
            {format}
          </span>
          <svg
            width="9" height="9" viewBox="0 0 10 10" fill="none"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
            className="text-inst-muted-foreground shrink-0"
            aria-hidden
          >
            <path d="M2.5 4l2.5 2.5L7.5 4" />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
}
