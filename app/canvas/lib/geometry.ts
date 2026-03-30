import type { CanvasObject, Point, Bounds, Handle, Camera } from './types';
import { HANDLE_SIZE } from './types';

// --- Distance ---

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// --- Hit testing ---

export function hitTest(obj: CanvasObject, p: Point, threshold = 8): boolean {
  switch (obj.type) {
    case 'draw':
      for (let i = 1; i < obj.points.length; i++) {
        if (distToSegment(p, obj.points[i - 1], obj.points[i]) < threshold) return true;
      }
      return false;
    case 'line':
      return distToSegment(p, { x: obj.x1, y: obj.y1 }, { x: obj.x2, y: obj.y2 }) < threshold;
    case 'rectangle': case 'frame': {
      const minX = Math.min(obj.x, obj.x + obj.w), maxX = Math.max(obj.x, obj.x + obj.w);
      const minY = Math.min(obj.y, obj.y + obj.h), maxY = Math.max(obj.y, obj.y + obj.h);
      return p.x >= minX - threshold && p.x <= maxX + threshold && p.y >= minY - threshold && p.y <= maxY + threshold
        && !(p.x > minX + threshold && p.x < maxX - threshold && p.y > minY + threshold && p.y < maxY - threshold);
    }
    case 'ellipse': {
      if (obj.rx < 2 && obj.ry < 2) return Math.hypot(p.x - obj.cx, p.y - obj.cy) < threshold;
      const norm = ((p.x - obj.cx) ** 2) / ((obj.rx || 1) ** 2) + ((p.y - obj.cy) ** 2) / ((obj.ry || 1) ** 2);
      return Math.abs(norm - 1) < threshold / Math.max(obj.rx, obj.ry, 1);
    }
    case 'text': {
      const lines = obj.value.split('\n');
      return p.x >= obj.x - 4 && p.x <= obj.x + Math.max(obj.value.length * 10, 40) + 4 && p.y >= obj.y - 4 && p.y <= obj.y + lines.length * 26 + 4;
    }
    case 'image':
      return p.x >= obj.x && p.x <= obj.x + obj.w && p.y >= obj.y && p.y <= obj.y + obj.h;
    case 'group':
      return false;
  }
}

// --- Bounds ---

export function getBounds(obj: CanvasObject, allObjects?: CanvasObject[]): Bounds {
  switch (obj.type) {
    case 'draw': {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of obj.points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
      return { minX, minY, maxX, maxY };
    }
    case 'line': return { minX: Math.min(obj.x1, obj.x2), minY: Math.min(obj.y1, obj.y2), maxX: Math.max(obj.x1, obj.x2), maxY: Math.max(obj.y1, obj.y2) };
    case 'rectangle': case 'frame': return { minX: Math.min(obj.x, obj.x + obj.w), minY: Math.min(obj.y, obj.y + obj.h), maxX: Math.max(obj.x, obj.x + obj.w), maxY: Math.max(obj.y, obj.y + obj.h) };
    case 'ellipse': return { minX: obj.cx - obj.rx, minY: obj.cy - obj.ry, maxX: obj.cx + obj.rx, maxY: obj.cy + obj.ry };
    case 'text': { const lines = obj.value.split('\n'); return { minX: obj.x, minY: obj.y, maxX: obj.x + Math.max(obj.value.length * 10, 40), maxY: obj.y + lines.length * 26 }; }
    case 'image': return { minX: obj.x, minY: obj.y, maxX: obj.x + obj.w, maxY: obj.y + obj.h };
    case 'group': {
      if (!allObjects) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const cid of obj.childIds) {
        const child = allObjects.find(o => o.id === cid);
        if (child) { const b = getBounds(child, allObjects); minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY); maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY); }
      }
      return { minX, minY, maxX, maxY };
    }
  }
}

export function combineBounds(bounds: Bounds[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of bounds) { minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY); maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY); }
  return { minX, minY, maxX, maxY };
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

// --- Transforms (non-destructive, applied to snapshots) ---

export function moveObject(obj: CanvasObject, dx: number, dy: number): CanvasObject {
  switch (obj.type) {
    case 'draw': return { ...obj, points: obj.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    case 'line': return { ...obj, x1: obj.x1 + dx, y1: obj.y1 + dy, x2: obj.x2 + dx, y2: obj.y2 + dy };
    case 'rectangle': case 'frame': return { ...obj, x: obj.x + dx, y: obj.y + dy };
    case 'ellipse': return { ...obj, cx: obj.cx + dx, cy: obj.cy + dy };
    case 'text': return { ...obj, x: obj.x + dx, y: obj.y + dy };
    case 'image': return { ...obj, x: obj.x + dx, y: obj.y + dy };
    case 'group': return obj;
  }
}

export function scaleObject(obj: CanvasObject, anchorX: number, anchorY: number, sx: number, sy: number): CanvasObject {
  const s = (v: number, anchor: number, scale: number) => anchor + (v - anchor) * scale;
  switch (obj.type) {
    case 'draw': return { ...obj, points: obj.points.map(p => ({ x: s(p.x, anchorX, sx), y: s(p.y, anchorY, sy) })) };
    case 'line': return { ...obj, x1: s(obj.x1, anchorX, sx), y1: s(obj.y1, anchorY, sy), x2: s(obj.x2, anchorX, sx), y2: s(obj.y2, anchorY, sy) };
    case 'rectangle': case 'frame': return { ...obj, x: s(obj.x, anchorX, sx), y: s(obj.y, anchorY, sy), w: obj.w * sx, h: obj.h * sy };
    case 'ellipse': return { ...obj, cx: s(obj.cx, anchorX, sx), cy: s(obj.cy, anchorY, sy), rx: obj.rx * Math.abs(sx), ry: obj.ry * Math.abs(sy) };
    case 'text': return { ...obj, x: s(obj.x, anchorX, sx), y: s(obj.y, anchorY, sy) };
    case 'image': return { ...obj, x: s(obj.x, anchorX, sx), y: s(obj.y, anchorY, sy), w: obj.w * sx, h: obj.h * sy };
    case 'group': return obj;
  }
}

// --- Frame helpers ---

export function getFrameChildren(frameId: string, objects: CanvasObject[]): CanvasObject[] {
  return objects.filter(o => o.parentId === frameId);
}

export function findFrameAtPoint(pt: Point, objects: CanvasObject[]): (CanvasObject & { type: 'frame' }) | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.type !== 'frame') continue;
    const minX = Math.min(o.x, o.x + o.w), maxX = Math.max(o.x, o.x + o.w);
    const minY = Math.min(o.y, o.y + o.h), maxY = Math.max(o.y, o.y + o.h);
    if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) return o as CanvasObject & { type: 'frame' };
  }
  return null;
}

export function autoParent(obj: CanvasObject, objects: CanvasObject[]): string | undefined {
  if (obj.type === 'frame' || obj.type === 'group') return undefined;
  const b = getBounds(obj, objects);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  return findFrameAtPoint({ x: cx, y: cy }, objects)?.id;
}

// --- Selection helpers ---

export function resolveSelection(id: string, objects: CanvasObject[]): Set<string> {
  const group = objects.find(o => o.type === 'group' && o.childIds.includes(id));
  if (group && group.type === 'group') return new Set([group.id, ...group.childIds]);
  const obj = objects.find(o => o.id === id);
  if (obj && obj.type === 'group') return new Set([obj.id, ...obj.childIds]);
  return new Set([id]);
}

export function expandSelection(ids: Set<string>, objects: CanvasObject[]): Set<string> {
  const expanded = new Set<string>();
  for (const id of ids) {
    const obj = objects.find(o => o.id === id);
    if (obj?.type === 'group') obj.childIds.forEach(cid => expanded.add(cid));
    else expanded.add(id);
  }
  return expanded;
}

// --- Camera ---

export function screenToCanvas(sx: number, sy: number, cam: Camera): Point {
  return { x: (sx - cam.x) / cam.zoom, y: (sy - cam.y) / cam.zoom };
}

export function getResizeHandle(pt: Point, selectedIds: Set<string>, objects: CanvasObject[], cam: Camera): Handle | null {
  if (selectedIds.size === 0) return null;
  const selObjs = objects.filter(o => selectedIds.has(o.id));
  if (selObjs.length === 0) return null;
  const b = combineBounds(selObjs.map(o => getBounds(o, objects)));
  const hs = HANDLE_SIZE / cam.zoom;
  const corners: [Handle, number, number][] = [['nw', b.minX, b.minY], ['ne', b.maxX, b.minY], ['sw', b.minX, b.maxY], ['se', b.maxX, b.maxY]];
  for (const [h, hx, hy] of corners) {
    if (Math.abs(pt.x - hx) < hs * 2 && Math.abs(pt.y - hy) < hs * 2) return h;
  }
  return null;
}
