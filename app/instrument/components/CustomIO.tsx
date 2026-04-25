'use client';
import { useRef } from 'react';
import { useStore } from '../store/store';
import type { CustomMapExport } from '../store/store';
import { Tooltip } from './ui/tooltip';

export function CustomIO() {
  const tetMap   = useStore((s) => s.customMapTET);
  const srutiMap = useStore((s) => s.customMapSruti);
  const loadCustom = useStore((s) => s.loadCustom);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSave = () => {
    const data: CustomMapExport = { version: 1, tet: tetMap, sruti: srutiMap };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instrument-custom-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onLoad = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as CustomMapExport;
      if (!parsed || parsed.version !== 1 || typeof parsed.tet !== 'object' || typeof parsed.sruti !== 'object') {
        alert('Invalid custom-layout file.');
        return;
      }
      loadCustom(parsed);
    } catch {
      alert('Could not read file.');
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <Tooltip content={<>Download the current custom key map as a JSON file. Includes overrides for both tunings.</>}>
        <button
          type="button"
          onClick={onSave}
          aria-label="save custom layout"
          className="inst-glass-chip inline-flex h-8 w-8 items-center justify-center rounded-full text-inst-muted-foreground transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] hover:text-inst-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 1.5v8" />
            <path d="M3.5 6L7 9.5L10.5 6" />
            <path d="M2 11.5h10" />
          </svg>
        </button>
      </Tooltip>
      <Tooltip content={<>Load a previously saved custom layout. Replaces the current overrides.</>}>
        <button
          type="button"
          onClick={onLoad}
          aria-label="load custom layout"
          className="inst-glass-chip inline-flex h-8 w-8 items-center justify-center rounded-full text-inst-muted-foreground transition-colors duration-[220ms] ease-inst-out-expo hover:bg-white/[0.08] hover:text-inst-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 9.5v-8" />
            <path d="M3.5 5L7 1.5L10.5 5" />
            <path d="M2 11.5h10" />
          </svg>
        </button>
      </Tooltip>
      <input ref={fileRef} type="file" accept="application/json" onChange={onFile} className="hidden" />
    </span>
  );
}
