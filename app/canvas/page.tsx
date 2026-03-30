'use client';

import { useRef, useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

import type { Tool, Point, CanvasObject, InteractionType, Handle } from './lib/types';
import { THEME_COLORS, MIN_ZOOM, MAX_ZOOM } from './lib/types';
import { hitTest, getBounds, combineBounds, boundsIntersect, moveObject, screenToCanvas, getResizeHandle, expandSelection, resolveSelection, autoParent, findFrameAtPoint, getFrameChildren } from './lib/geometry';
import { CanvasStore, uid } from './lib/store';
import { render } from './lib/render';

// --- Tool icons ---

const TOOL_IDS: Tool[] = ['select', 'hand', 'draw', 'line', 'rectangle', 'ellipse', 'text', 'frame'];
const TOOL_LABELS: Record<Tool, string> = {
  select: 'Select (V)', hand: 'Hand (Space)', draw: 'Draw (D)', line: 'Line (L)',
  rectangle: 'Rectangle (R)', ellipse: 'Ellipse (O)', text: 'Text (T)', frame: 'Frame (F)',
};

function ToolIcon({ tool, size = 22 }: { tool: Tool; size?: number }) {
  const s = size;
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (tool) {
    case 'select': return (<svg width={s} height={s} viewBox="0 0 18 18" {...p}><path d="M3 2l5 14 2-5.5 5.5-2L3 2z" /></svg>);
    case 'hand': return (<svg width={s} height={s} viewBox="0 0 18 18" {...p}><path d="M6.5 9V4a1.5 1.5 0 013 0v5m0-4.5a1.5 1.5 0 013 0V9m0-3a1.5 1.5 0 013 0v5.5a6 6 0 01-6 6h-.5a6 6 0 01-6-6V6.5a1.5 1.5 0 013 0V9" /></svg>);
    case 'draw': return (<svg width={s} height={s} viewBox="0 0 18 18" {...p}><path d="M2.5 15.5l1.5-4L13 2.5a1.4 1.4 0 012 2L6 13.5l-3.5 2z" /><path d="M11 4.5l2.5 2.5" /></svg>);
    case 'line': return (<svg width={s} height={s} viewBox="0 0 18 18" {...p}><line x1="3" y1="15" x2="15" y2="3" /></svg>);
    case 'rectangle': return (<svg width={s} height={s} viewBox="0 0 18 18" {...p}><rect x="3" y="3" width="12" height="12" rx="1" /></svg>);
    case 'ellipse': return (<svg width={s} height={s} viewBox="0 0 18 18" {...p}><circle cx="9" cy="9" r="6" /></svg>);
    case 'text': return (<svg width={s} height={s} viewBox="0 0 18 18" {...p}><path d="M4 4h10M9 4v11M6.5 15h5" /></svg>);
    case 'frame': return (<svg width={s} height={s} viewBox="0 0 18 18" {...p}><rect x="2" y="4" width="14" height="12" rx="1" /><text x="4" y="3.5" fontSize="5" fill="currentColor" stroke="none" fontFamily="sans-serif">F</text></svg>);
  }
}

// --- Singleton store (persists across re-renders, not across navigations) ---
const store = new CanvasStore();

export default function CanvasPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  // Subscribe to store for UI updates (toolbar, selection indicator)
  const storeVersion = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.objects.length + store.selectedIds.size + store.camera.zoom,
    () => 0, // server snapshot
  );
  void storeVersion;

  const [activeTool, setActiveTool] = useState<Tool>('draw');
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Interaction state (all refs — no React re-renders during pointer events)
  const toolRef = useRef<Tool>('draw');
  const interactionType = useRef<InteractionType>(null);
  const startPoint = useRef<Point | null>(null);
  const drawPoints = useRef<Point[]>([]);
  const dragOffset = useRef<Point | null>(null);
  const panStart = useRef<Point | null>(null);
  const spaceHeld = useRef(false);
  const resizeHandleRef = useRef<Handle | null>(null);
  const resizeStartBounds = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const previewRef = useRef<CanvasObject | null>(null);
  const marqueeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const setTool = useCallback((t: Tool) => { toolRef.current = t; setActiveTool(t); }, []);
  const colors = THEME_COLORS[resolvedTheme || 'day'] || THEME_COLORS.day;

  // --- rAF render loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const loop = () => {
      if (store.dirty) {
        store.dirty = false;
        render(canvas, {
          objects: store.objects,
          preview: previewRef.current,
          selectedIds: store.selectedIds,
          marquee: marqueeRef.current,
          camera: store.camera,
          colors,
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [colors]);

  // Resize canvas element
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; store.markDirty(); };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Load persisted state
  useEffect(() => { store.load(); }, []);

  // --- Helpers ---
  const getScreenPt = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) { const t = e.touches[0]; return { x: t.clientX - rect.left, y: t.clientY - rect.top }; }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const toCvs = (sx: number, sy: number) => screenToCanvas(sx, sy, store.camera);

  const commitText = useCallback(() => {
    if (!textInput || !textInput.value.trim()) { setTextInput(null); return; }
    const obj: CanvasObject = { type: 'text', id: uid(), x: textInput.x, y: textInput.y, value: textInput.value };
    const pid = autoParent(obj, store.objects);
    store.addObject(pid ? { ...obj, parentId: pid } : obj);
    setTextInput(null);
  }, [textInput]);

  // --- Pointer handlers ---
  const handleDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const screen = getScreenPt(e);
    if (!screen) return;
    const pt = toCvs(screen.x, screen.y);
    const tool = toolRef.current;
    const shiftKey = 'shiftKey' in e ? e.shiftKey : false;

    if (spaceHeld.current || tool === 'hand') {
      interactionType.current = 'pan';
      panStart.current = { x: screen.x - store.camera.x, y: screen.y - store.camera.y };
      return;
    }

    if (tool === 'select') {
      // Resize handles
      const handle = getResizeHandle(pt, store.selectedIds, store.objects, store.camera);
      if (handle) {
        const selObjs = store.objects.filter(o => store.selectedIds.has(o.id));
        const b = combineBounds(selObjs.map(o => getBounds(o, store.objects)));
        resizeHandleRef.current = handle;
        resizeStartBounds.current = b;
        const anchor = { x: handle.includes('e') ? b.minX : b.maxX, y: handle.includes('s') ? b.minY : b.maxY };

        // Snapshot-based resize: push undo + snapshot originals
        store.pushUndo();
        const ids = expandSelection(store.selectedIds, store.objects);
        store.beginResize(ids, anchor);

        interactionType.current = 'resize';
        startPoint.current = pt;
        return;
      }

      // Hit test
      let hit: CanvasObject | null = null;
      for (let i = store.objects.length - 1; i >= 0; i--) {
        const o = store.objects[i];
        if (o.type === 'group' || o.type === 'frame') continue;
        if (hitTest(o, pt, 8 / store.camera.zoom)) { hit = o; break; }
      }
      if (!hit) {
        const frame = findFrameAtPoint(pt, store.objects);
        if (frame) hit = frame;
      }

      if (hit) {
        const resolved = resolveSelection(hit.id, store.objects);
        if (shiftKey) {
          const next = new Set(store.selectedIds);
          for (const id of resolved) { if (next.has(id)) next.delete(id); else next.add(id); }
          store.setSelection(next);
        } else if (!store.selectedIds.has(hit.id) && !Array.from(resolved).some(id => store.selectedIds.has(id))) {
          store.setSelection(resolved);
        }
        store.pushUndo(); // for drag
        interactionType.current = 'drag';
        dragOffset.current = { x: pt.x, y: pt.y };
      } else {
        if (!shiftKey) store.setSelection(new Set());
        interactionType.current = 'marquee';
        startPoint.current = pt;
        marqueeRef.current = { x: pt.x, y: pt.y, w: 0, h: 0 };
        store.markDirty();
      }
      return;
    }

    if (tool === 'text') {
      if (textInput) commitText();
      setTextInput({ x: pt.x, y: pt.y, value: '' });
      return;
    }

    startPoint.current = pt;
    if (tool === 'draw') {
      interactionType.current = 'draw';
      drawPoints.current = [pt];
    } else {
      interactionType.current = 'shape';
    }
  }, [textInput, commitText]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const iType = interactionType.current;
    if (!iType) return;
    const screen = getScreenPt(e);
    if (!screen) return;

    if (iType === 'pan' && panStart.current) {
      store.setCamera({ x: screen.x - panStart.current.x, y: screen.y - panStart.current.y });
      return;
    }

    const pt = toCvs(screen.x, screen.y);

    if (iType === 'resize' && resizeStartBounds.current) {
      const sb = resizeStartBounds.current;
      const anchor = store.resizeAnchor;
      if (!anchor) return;
      const origW = sb.maxX - sb.minX, origH = sb.maxY - sb.minY;
      if (origW < 1 || origH < 1) return;
      const handle = resizeHandleRef.current!;
      const sx = (pt.x - anchor.x) / (handle.includes('e') ? origW : -origW);
      const sy = (pt.y - anchor.y) / (handle.includes('s') ? origH : -origH);
      store.applyResize(sx, sy);
      return;
    }

    if (iType === 'drag' && dragOffset.current) {
      const dx = pt.x - dragOffset.current.x, dy = pt.y - dragOffset.current.y;
      dragOffset.current = { x: pt.x, y: pt.y };
      const ids = expandSelection(store.selectedIds, store.objects);
      const frameChildIds = new Set<string>();
      for (const id of store.selectedIds) {
        const obj = store.objects.find(o => o.id === id);
        if (obj?.type === 'frame') getFrameChildren(obj.id, store.objects).forEach(c => frameChildIds.add(c.id));
      }
      const allIds = new Set([...ids, ...frameChildIds]);
      store.mutateObjects(prev => prev.map(o => allIds.has(o.id) ? moveObject(o, dx, dy) : o));
      return;
    }

    if (iType === 'marquee' && startPoint.current) {
      const sx = startPoint.current.x, sy = startPoint.current.y;
      marqueeRef.current = { x: Math.min(sx, pt.x), y: Math.min(sy, pt.y), w: Math.abs(pt.x - sx), h: Math.abs(pt.y - sy) };
      store.markDirty();
      return;
    }

    if (iType === 'draw') {
      drawPoints.current.push(pt);
      previewRef.current = { type: 'draw', id: '_preview', points: [...drawPoints.current] };
      store.markDirty();
      return;
    }

    if (iType === 'shape' && startPoint.current) {
      const sx = startPoint.current.x, sy = startPoint.current.y;
      const tool = toolRef.current;
      let p: CanvasObject | null = null;
      if (tool === 'line') p = { type: 'line', id: '_preview', x1: sx, y1: sy, x2: pt.x, y2: pt.y };
      else if (tool === 'rectangle') p = { type: 'rectangle', id: '_preview', x: sx, y: sy, w: pt.x - sx, h: pt.y - sy };
      else if (tool === 'ellipse') p = { type: 'ellipse', id: '_preview', cx: (sx + pt.x) / 2, cy: (sy + pt.y) / 2, rx: Math.abs(pt.x - sx) / 2, ry: Math.abs(pt.y - sy) / 2 };
      else if (tool === 'frame') p = { type: 'frame', id: '_preview', x: sx, y: sy, w: pt.x - sx, h: pt.y - sy, label: 'Frame', fill: 'rgba(255,255,255,0.02)' };
      if (p) { previewRef.current = p; store.markDirty(); }
    }
  }, []);

  const handleUp = useCallback(() => {
    const iType = interactionType.current;

    if (iType === 'draw') {
      const points = [...drawPoints.current];
      drawPoints.current = [];
      previewRef.current = null;
      if (points.length > 1) {
        const obj: CanvasObject = { type: 'draw', id: uid(), points };
        const pid = autoParent(obj, store.objects);
        store.addObject(pid ? { ...obj, parentId: pid } : obj);
      }
      store.markDirty();
    } else if (iType === 'shape') {
      const snap = previewRef.current;
      previewRef.current = null;
      if (snap && snap.id === '_preview') {
        const obj = { ...snap, id: uid() };
        const pid = obj.type !== 'frame' ? autoParent(obj, store.objects) : undefined;
        store.addObject(pid ? { ...obj, parentId: pid } : obj);
      }
      store.markDirty();
    } else if (iType === 'drag') {
      // Re-parent after drop
      store.mutateObjects(prev => {
        const ids = expandSelection(store.selectedIds, prev);
        return prev.map(o => {
          if (!ids.has(o.id) || o.type === 'frame' || o.type === 'group') return o;
          const pid = autoParent(o, prev);
          if (pid !== o.parentId) return { ...o, parentId: pid } as CanvasObject;
          return o;
        });
      });
      store.markDirty();
    } else if (iType === 'resize') {
      store.endResize();
      resizeHandleRef.current = null;
      resizeStartBounds.current = null;
    } else if (iType === 'marquee') {
      const m = marqueeRef.current;
      marqueeRef.current = null;
      if (m && (m.w > 3 || m.h > 3)) {
        const mb = { minX: m.x, minY: m.y, maxX: m.x + m.w, maxY: m.y + m.h };
        const hits = store.objects.filter(o => o.type !== 'group' && boundsIntersect(getBounds(o, store.objects), mb));
        if (hits.length > 0) store.setSelection(new Set(hits.map(h => h.id)));
      }
      store.markDirty();
    }

    if (iType === 'pan') panStart.current = null;
    interactionType.current = null;
    startPoint.current = null;
    dragOffset.current = null;
  }, []);

  // --- Wheel zoom ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = store.camera;
      if (e.ctrlKey || e.metaKey) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const delta = -e.deltaY * 0.01;
        const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * (1 + delta)));
        const s = nz / cam.zoom;
        store.setCamera({ x: mx - (mx - cam.x) * s, y: my - (my - cam.y) * s, zoom: nz });
      } else {
        store.setCamera({ x: cam.x - e.deltaX, y: cam.y - e.deltaY });
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // Touch pinch
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastDist = 0;
    const getInfo = (touches: TouchList) => {
      const [t1, t2] = [touches[0], touches[1]];
      const rect = canvas.getBoundingClientRect();
      return { center: { x: (t1.clientX + t2.clientX) / 2 - rect.left, y: (t1.clientY + t2.clientY) / 2 - rect.top }, dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY) };
    };
    const onTS = (e: TouchEvent) => { if (e.touches.length === 2) { e.preventDefault(); lastDist = getInfo(e.touches).dist; } };
    const onTM = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const cam = store.camera;
        const info = getInfo(e.touches);
        const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * (info.dist / lastDist)));
        const s = nz / cam.zoom;
        store.setCamera({ x: info.center.x - (info.center.x - cam.x) * s, y: info.center.y - (info.center.y - cam.y) * s, zoom: nz });
        lastDist = info.dist;
      }
    };
    canvas.addEventListener('touchstart', onTS, { passive: false });
    canvas.addEventListener('touchmove', onTM, { passive: false });
    return () => { canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); };
  }, []);

  // --- Keyboard ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const meta = e.metaKey || e.ctrlKey;

      if (e.code === 'Space') { e.preventDefault(); spaceHeld.current = true; }

      // Undo / Redo
      if (e.key === 'z' && meta && !e.shiftKey) { e.preventDefault(); store.undo(); }
      if (e.key === 'z' && meta && e.shiftKey) { e.preventDefault(); store.redo(); }

      // Delete
      if ((e.key === 'Backspace' || e.key === 'Delete') && store.selectedIds.size > 0) store.deleteSelected();
      if (e.key === 'Escape') { store.setSelection(new Set()); setTextInput(null); }

      // Arrow nudge
      const nudge = e.shiftKey ? 10 : 1;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && store.selectedIds.size > 0) {
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -nudge : e.key === 'ArrowRight' ? nudge : 0;
        const dy = e.key === 'ArrowUp' ? -nudge : e.key === 'ArrowDown' ? nudge : 0;
        const ids = expandSelection(store.selectedIds, store.objects);
        store.updateObjects(prev => prev.map(o => ids.has(o.id) ? moveObject(o, dx, dy) : o));
      }

      // Group / Ungroup
      if (e.key === 'g' && meta && !e.shiftKey && store.selectedIds.size > 1) {
        e.preventDefault();
        const childIds = [...expandSelection(store.selectedIds, store.objects)];
        const groupId = uid();
        store.updateObjects(prev => [...prev, { type: 'group', id: groupId, childIds }]);
        store.setSelection(new Set([groupId, ...childIds]));
      }
      if (e.key === 'g' && meta && e.shiftKey) {
        e.preventDefault();
        const groupIds = [...store.selectedIds].filter(id => store.objects.find(o => o.id === id)?.type === 'group');
        if (groupIds.length > 0) {
          const childIds = new Set<string>();
          for (const gid of groupIds) { const g = store.objects.find(o => o.id === gid); if (g?.type === 'group') g.childIds.forEach(c => childIds.add(c)); }
          store.updateObjects(prev => prev.filter(o => !groupIds.includes(o.id)));
          store.setSelection(childIds);
        }
      }

      // Tool shortcuts
      if (!meta) {
        if (e.key === 'v' || e.key === 'V') setTool('select');
        if (e.key === 'h' || e.key === 'H') setTool('hand');
        if (e.key === 'd' || e.key === 'D') setTool('draw');
        if (e.key === 'l' || e.key === 'L') setTool('line');
        if (e.key === 'r' || e.key === 'R') setTool('rectangle');
        if (e.key === 'o' || e.key === 'O') setTool('ellipse');
        if (e.key === 't' || e.key === 'T') setTool('text');
        if (e.key === 'f' || e.key === 'F') setTool('frame');
      }

      // Zoom
      if ((e.key === '=' || e.key === '+') && meta) { e.preventDefault(); const c = store.camera; const cx = window.innerWidth / 2, cy = window.innerHeight / 2; const nz = Math.min(MAX_ZOOM, c.zoom * 1.2); const s = nz / c.zoom; store.setCamera({ x: cx - (cx - c.x) * s, y: cy - (cy - c.y) * s, zoom: nz }); }
      if (e.key === '-' && meta) { e.preventDefault(); const c = store.camera; const cx = window.innerWidth / 2, cy = window.innerHeight / 2; const nz = Math.max(MIN_ZOOM, c.zoom / 1.2); const s = nz / c.zoom; store.setCamera({ x: cx - (cx - c.x) * s, y: cy - (cy - c.y) * s, zoom: nz }); }
      if (e.key === '0' && meta) { e.preventDefault(); store.setCamera({ x: 0, y: 0, zoom: 1 }); }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') spaceHeld.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [setTool]);

  // Focus text input
  useEffect(() => { if (textInput && textInputRef.current) textInputRef.current.focus(); }, [textInput]);

  // Image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        const max = 360;
        if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const cam = store.camera;
        const cx = (window.innerWidth / 2 - cam.x) / cam.zoom - w / 2;
        const cy = (window.innerHeight / 2 - cam.y) / cam.zoom - h / 2;
        store.addObject({ type: 'image', id: uid(), x: cx, y: cy, w, h, src, img });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'canvas.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  const getCursor = () => {
    if (spaceHeld.current) return 'grab';
    switch (activeTool) {
      case 'select': return 'default';
      case 'hand': return 'grab';
      case 'draw': return 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' fill=\'none\' stroke=\'white\' stroke-width=\'1.5\' stroke-linecap=\'round\'%3E%3Cpath d=\'M3 17l1.5-4L14 3.5a1.2 1.2 0 011.7 1.7L6 14.5 3 17z\'/%3E%3C/svg%3E") 2 18, crosshair';
      case 'text': return 'text';
      default: return 'crosshair';
    }
  };

  const cam = store.camera;
  const zoomPercent = Math.round(cam.zoom * 100);

  return (
    <div className="fixed inset-0 z-50" style={{ backgroundColor: colors.bg }}>
      <div className="absolute top-6 left-6 z-10">
        <span className="text-white/40 text-2xl font-[family-name:var(--font-mondwest)]">Canvas</span>
      </div>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
        <span className="text-white/30 text-xs font-[family-name:var(--font-mondwest)]">{zoomPercent}%</span>
      </div>
      <button onClick={() => router.back()} className="absolute top-6 right-6 z-10 text-white/40 hover:text-white transition-colors focus:outline-none" aria-label="Close canvas">
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" /></svg>
      </button>

      <canvas ref={canvasRef} className="w-full h-full touch-none" style={{ cursor: getCursor() }}
        onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
        onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={handleUp} />

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {textInput && (
        <textarea ref={textInputRef} value={textInput.value}
          onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Escape') setTextInput(null); else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); } }}
          onBlur={commitText}
          className="absolute z-20 bg-transparent border-none outline-none resize-none text-white caret-white font-[family-name:var(--font-mondwest)]"
          style={{ left: textInput.x * cam.zoom + cam.x, top: textInput.y * cam.zoom + cam.y, fontSize: `${20 * cam.zoom}px`, lineHeight: `${26 * cam.zoom}px`, minWidth: '100px', minHeight: '26px' }} />
      )}

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white/5 backdrop-blur-md rounded-full px-2 py-2">
        {TOOL_IDS.map((id) => (
          <button key={id} title={TOOL_LABELS[id]}
            onClick={() => { if (textInput) commitText(); setTool(id); if (id !== 'select') store.setSelection(new Set()); }}
            className={`p-2.5 rounded-full transition-colors focus:outline-none ${activeTool === id ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'}`}>
            <ToolIcon tool={id} />
          </button>
        ))}
        <div className="w-px h-6 bg-white/20 mx-1.5" />
        <button title="Upload image" onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-full text-white/40 hover:text-white transition-colors focus:outline-none">
          <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="14" height="14" rx="2" /><circle cx="6" cy="6.5" r="1.5" /><path d="M16 12l-4-4-8 8" /></svg>
        </button>
        <button title="Download as PNG" onClick={handleDownload} className="p-2.5 rounded-full text-white/40 hover:text-white transition-colors focus:outline-none">
          <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v9m0 0l-3-3m3 3l3-3" /><path d="M3 13v1a1 1 0 001 1h10a1 1 0 001-1v-1" /></svg>
        </button>
      </div>
    </div>
  );
}
