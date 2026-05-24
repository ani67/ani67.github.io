import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import {
  startRecording,
  stopRecording,
  downloadBlob,
  fileExtensionForMime,
  stampForFilename,
} from '../lib/audio/recorder';

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function RecordButton() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed]     = useState(0);
  const startRef                  = useRef<number | null>(null);

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
    if (!recording) {
      const ok = await startRecording();
      if (ok) setRecording(true);
      return;
    }
    const blob = await stopRecording();
    setRecording(false);
    if (blob && blob.size > 0) {
      const ext = fileExtensionForMime(blob.type);
      downloadBlob(blob, `instrument-${stampForFilename()}.${ext}`);
    }
  };

  const label = recording ? formatElapsed(elapsed) : 'off';

  return (
    <button
      type="button"
      onClick={onClick}
      title={recording ? 'stop and download' : 'start recording'}
      className="inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 w-[120px] transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full shrink-0 transition-colors duration-[220ms] ease-inst-out-expo',
          recording
            ? 'bg-inst-destructive shadow-[0_0_10px_hsl(var(--inst-destructive))] animate-pulse'
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
