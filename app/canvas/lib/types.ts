// --- Canvas object types ---

export type Tool = 'select' | 'hand' | 'draw' | 'line' | 'rectangle' | 'ellipse' | 'text' | 'frame';
export type Handle = 'nw' | 'ne' | 'sw' | 'se';
export type Point = { x: number; y: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export type BaseObj = { id: string; parentId?: string };

export type CanvasObject =
  | (BaseObj & { type: 'draw'; points: Point[] })
  | (BaseObj & { type: 'line'; x1: number; y1: number; x2: number; y2: number })
  | (BaseObj & { type: 'rectangle'; x: number; y: number; w: number; h: number })
  | (BaseObj & { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number })
  | (BaseObj & { type: 'text'; x: number; y: number; value: string })
  | (BaseObj & { type: 'image'; x: number; y: number; w: number; h: number; src: string; img: HTMLImageElement })
  | (BaseObj & { type: 'frame'; x: number; y: number; w: number; h: number; label: string; fill: string })
  | (BaseObj & { type: 'group'; childIds: string[] });

export type InteractionType = 'pan' | 'draw' | 'shape' | 'drag' | 'marquee' | 'resize' | null;

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export const THEME_COLORS: Record<string, { bg: string; stroke: string }> = {
  dawn: { bg: '#BB3232', stroke: '#ffffff' },
  day: { bg: '#4269E8', stroke: '#ffffff' },
  night: { bg: '#14151A', stroke: '#ffffff' },
};

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const HANDLE_SIZE = 6;
export const GRID_SPACING = 140;
export const GRID_PLUS_SIZE = 3;
