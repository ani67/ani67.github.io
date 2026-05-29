import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { cn } from '../lib/utils';
import {
  startRecording,
  stopRecording,
  downloadBlob,
  fileExtensionFor,
  stampForFilename,
} from '../lib/audio/recorder';

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function RecordButton() {
  const [recording, setRecording] = useState(false);
  const [encoding,  setEncoding]  = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const startRef                  = useRef<number | null>(null);
  const format                    = useStore((s) => s.recordFormat);

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

  const onClick = async () => {
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

  const label = encoding
    ? `enc ${format}`
    : recording
      ? formatElapsed(elapsed)
      : 'off';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={encoding}
      title={
        encoding ? `encoding ${format}…`
        : recording ? `stop and download as ${format}`
        : `start recording (${format})`
      }
      className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 w-[120px] transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring disabled:cursor-progress"
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
      <span className="font-mono text-sm text-inst-foreground truncate min-w-0 flex-1">{label}</span>
    </button>
  );
}
