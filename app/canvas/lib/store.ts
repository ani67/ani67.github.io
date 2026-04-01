import type { CanvasObject, Camera, Point } from './types';

// --- Persistence ---

const STORAGE_KEY = 'canvas_state';

type SerializedObject = Exclude<CanvasObject, { type: 'image' }> | { type: 'image'; id: string; parentId?: string; x: number; y: number; w: number; h: number; src: string };

function serializeObjects(objects: CanvasObject[]): string {
  const data: SerializedObject[] = objects.map(obj => {
    if (obj.type === 'image') { const { img: _, ...rest } = obj; return rest; }
    return obj;
  });
  return JSON.stringify(data);
}

function deserializeObjects(json: string): Promise<CanvasObject[]> {
  const data: SerializedObject[] = JSON.parse(json);
  return Promise.all(data.map(obj => {
    if (obj.type === 'image') {
      return new Promise<CanvasObject>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ ...obj, img });
        img.onerror = () => resolve({ ...obj, img });
        img.src = obj.src;
      });
    }
    return Promise.resolve(obj as CanvasObject);
  }));
}

// Deep clone objects (strips img for cloning, re-attaches)
function cloneObjects(objects: CanvasObject[]): CanvasObject[] {
  return objects.map(o => {
    if (o.type === 'image') return { ...o, img: o.img }; // share img ref, clone rest
    if (o.type === 'draw') return { ...o, points: o.points.map(p => ({ ...p })) };
    if (o.type === 'group') return { ...o, childIds: [...o.childIds] };
    return { ...o } as CanvasObject;
  });
}

// --- ID generator ---

let _nextId = 0;
export function uid(): string { return `obj_${++_nextId}`; }
export function restoreIdCounter(objects: CanvasObject[]) {
  let maxId = 0;
  for (const o of objects) { const n = parseInt(o.id.replace('obj_', ''), 10); if (n > maxId) maxId = n; }
  _nextId = maxId;
}

// --- Store ---

type Listener = () => void;

const MAX_UNDO = 50;

export class CanvasStore {
  objects: CanvasObject[] = [];
  camera: Camera = { x: 0, y: 0, zoom: 1 };
  selectedIds = new Set<string>();
  dirty = true;
  version = 0;

  // Undo/redo stacks hold snapshots of the objects array
  private undoStack: CanvasObject[][] = [];
  private redoStack: CanvasObject[][] = [];

  // Resize snapshot: the objects at the moment resize started
  resizeSnapshot: Map<string, CanvasObject> = new Map();
  resizeAnchor: Point | null = null;

  private listeners = new Set<Listener>();
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() { this.version++; this.listeners.forEach(fn => fn()); }
  markDirty() { this.dirty = true; }

  // --- Snapshot management ---

  /** Call before any mutation to push current state onto undo stack */
  pushUndo() {
    this.undoStack.push(cloneObjects(this.objects));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = []; // new action clears redo
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(cloneObjects(this.objects));
    this.objects = this.undoStack.pop()!;
    this.selectedIds = new Set();
    this.dirty = true;
    this.notify();
    this.scheduleSave();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(cloneObjects(this.objects));
    this.objects = this.redoStack.pop()!;
    this.selectedIds = new Set();
    this.dirty = true;
    this.notify();
    this.scheduleSave();
  }

  // --- Mutations (all push undo first) ---

  addObject(obj: CanvasObject) {
    this.pushUndo();
    this.objects.push(obj);
    this.dirty = true;
    this.notify();
    this.scheduleSave();
  }

  updateObject(id: string, updates: Partial<CanvasObject>) {
    this.pushUndo();
    this.objects = this.objects.map(o => {
      if (o.id !== id) return o;
      const merged = { ...o, ...updates } as CanvasObject;
      // Deep-merge style so individual properties aren't lost
      if (o.style && updates.style) {
        merged.style = { ...o.style, ...updates.style };
      }
      return merged;
    });
    this.dirty = true;
    this.notify();
    this.scheduleSave();
  }

  updateObjects(fn: (objects: CanvasObject[]) => CanvasObject[]) {
    this.pushUndo();
    this.objects = fn(this.objects);
    this.dirty = true;
    this.notify();
    this.scheduleSave();
  }

  /** Mutate without pushing undo (for continuous operations like drag/resize) */
  mutateObjects(fn: (objects: CanvasObject[]) => CanvasObject[]) {
    this.objects = fn(this.objects);
    this.dirty = true;
    // Don't notify or save — caller handles rendering via rAF
  }

  deleteSelected() {
    if (this.selectedIds.size === 0) return;
    this.pushUndo();
    const ids = new Set<string>();
    for (const id of this.selectedIds) {
      const obj = this.objects.find(o => o.id === id);
      if (obj?.type === 'group') { ids.add(obj.id); obj.childIds.forEach(c => ids.add(c)); }
      else ids.add(id);
    }
    this.objects = this.objects.filter(o => !ids.has(o.id));
    this.selectedIds = new Set();
    this.dirty = true;
    this.notify();
    this.scheduleSave();
  }

  setSelection(ids: Set<string>) {
    this.selectedIds = ids;
    this.dirty = true;
    this.notify();
  }

  setCamera(cam: Partial<Camera>) {
    Object.assign(this.camera, cam);
    this.dirty = true;
    this.notify();
    this.scheduleSave();
  }

  // --- Resize with snapshots ---

  beginResize(ids: Set<string>, anchor: Point) {
    this.resizeSnapshot.clear();
    for (const id of ids) {
      const obj = this.objects.find(o => o.id === id);
      if (obj) {
        // Deep clone for snapshot
        if (obj.type === 'draw') this.resizeSnapshot.set(id, { ...obj, points: obj.points.map(p => ({ ...p })) });
        else this.resizeSnapshot.set(id, { ...obj } as CanvasObject);
      }
    }
    this.resizeAnchor = anchor;
  }

  applyResize(sx: number, sy: number) {
    if (!this.resizeAnchor || this.resizeSnapshot.size === 0) return;
    const anchor = this.resizeAnchor;
    const s = (v: number, a: number, scale: number) => a + (v - a) * scale;

    this.objects = this.objects.map(o => {
      const snap = this.resizeSnapshot.get(o.id);
      if (!snap) return o;

      // Apply scale to the SNAPSHOT, not the current state
      switch (snap.type) {
        case 'draw': return { ...snap, points: snap.points.map(p => ({ x: s(p.x, anchor.x, sx), y: s(p.y, anchor.y, sy) })) };
        case 'line': return { ...snap, x1: s(snap.x1, anchor.x, sx), y1: s(snap.y1, anchor.y, sy), x2: s(snap.x2, anchor.x, sx), y2: s(snap.y2, anchor.y, sy) };
        case 'rectangle': case 'frame': return { ...snap, x: s(snap.x, anchor.x, sx), y: s(snap.y, anchor.y, sy), w: snap.w * sx, h: snap.h * sy };
        case 'ellipse': return { ...snap, cx: s(snap.cx, anchor.x, sx), cy: s(snap.cy, anchor.y, sy), rx: snap.rx * Math.abs(sx), ry: snap.ry * Math.abs(sy) };
        case 'text': return { ...snap, x: s(snap.x, anchor.x, sx), y: s(snap.y, anchor.y, sy) };
        case 'image': return { ...snap, x: s(snap.x, anchor.x, sx), y: s(snap.y, anchor.y, sy), w: snap.w * sx, h: snap.h * sy };
        default: return o;
      }
    });
    this.dirty = true;
  }

  endResize() {
    this.resizeSnapshot.clear();
    this.resizeAnchor = null;
    this.scheduleSave();
    this.notify();
  }

  // --- Persistence ---

  async load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.camera) Object.assign(this.camera, parsed.camera);
        if (parsed.objects) {
          this.objects = await deserializeObjects(parsed.objects);
          restoreIdCounter(this.objects);
        }
      }
    } catch { /* ignore corrupt data */ }
    this.dirty = true;
    this.notify();
  }

  private scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          objects: serializeObjects(this.objects),
          camera: this.camera,
        }));
      } catch { /* quota */ }
    }, 500);
  }
}
