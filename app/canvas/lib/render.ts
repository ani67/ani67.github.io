import type { CanvasObject, Bounds, Camera } from './types';
import { GRID_SPACING, GRID_PLUS_SIZE, HANDLE_SIZE } from './types';
import { getBounds, combineBounds, getFrameChildren } from './geometry';

interface RenderState {
  objects: CanvasObject[];
  preview: CanvasObject | null;
  selectedIds: Set<string>;
  marquee: { x: number; y: number; w: number; h: number } | null;
  camera: Camera;
  colors: { bg: string; stroke: string };
}

function drawObject(ctx: CanvasRenderingContext2D, obj: CanvasObject, stroke: string, zoom: number) {
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineWidth = 2 / zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (obj.type) {
    case 'draw':
      if (obj.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(obj.points[0].x, obj.points[0].y);
      for (let i = 1; i < obj.points.length; i++) ctx.lineTo(obj.points[i].x, obj.points[i].y);
      ctx.stroke();
      break;
    case 'line':
      ctx.beginPath(); ctx.moveTo(obj.x1, obj.y1); ctx.lineTo(obj.x2, obj.y2); ctx.stroke();
      break;
    case 'rectangle':
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      break;
    case 'ellipse':
      ctx.beginPath(); ctx.ellipse(obj.cx, obj.cy, Math.abs(obj.rx), Math.abs(obj.ry), 0, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'text':
      ctx.font = '20px PP Mondwest, sans-serif';
      ctx.textBaseline = 'top';
      obj.value.split('\n').forEach((line, i) => ctx.fillText(line, obj.x, obj.y + i * 26));
      break;
    case 'image':
      ctx.drawImage(obj.img, obj.x, obj.y, obj.w, obj.h);
      break;
  }
}

function drawSelectionOutline(ctx: CanvasRenderingContext2D, obj: CanvasObject, allObjects: CanvasObject[], zoom: number) {
  const b = getBounds(obj, allObjects);
  ctx.save();
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1 / zoom;
  const pad = 6 / zoom;
  ctx.strokeRect(b.minX - pad, b.minY - pad, b.maxX - b.minX + pad * 2, b.maxY - b.minY + pad * 2);
  ctx.restore();
}

export function render(canvas: HTMLCanvasElement, state: RenderState) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { objects, preview, selectedIds, marquee, camera, colors } = state;
  const { x: panX, y: panY, zoom } = camera;

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // + grid
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1 / zoom;
  ctx.lineCap = 'round';
  const vMinX = -panX / zoom, vMinY = -panY / zoom;
  const vMaxX = (canvas.width - panX) / zoom, vMaxY = (canvas.height - panY) / zoom;
  const startX = Math.floor(vMinX / GRID_SPACING) * GRID_SPACING;
  const startY = Math.floor(vMinY / GRID_SPACING) * GRID_SPACING;
  for (let gx = startX; gx <= vMaxX; gx += GRID_SPACING) {
    for (let gy = startY; gy <= vMaxY; gy += GRID_SPACING) {
      ctx.beginPath();
      ctx.moveTo(gx, gy - GRID_PLUS_SIZE); ctx.lineTo(gx, gy + GRID_PLUS_SIZE);
      ctx.moveTo(gx - GRID_PLUS_SIZE, gy); ctx.lineTo(gx + GRID_PLUS_SIZE, gy);
      ctx.stroke();
    }
  }

  const allObjects = preview ? [...objects, preview] : objects;
  const frames = allObjects.filter(o => o.type === 'frame');
  const freeObjects = allObjects.filter(o => o.type !== 'frame' && o.type !== 'group' && !o.parentId);

  // Frames (Figma-style)
  for (const frame of frames) {
    if (frame.type !== 'frame') continue;
    const fx = Math.min(frame.x, frame.x + frame.w);
    const fy = Math.min(frame.y, frame.y + frame.h);
    const fw = Math.abs(frame.w);
    const fh = Math.abs(frame.h);

    // Label
    ctx.fillStyle = selectedIds.has(frame.id) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)';
    ctx.font = '12px PP Mondwest, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(frame.label, fx, fy - 6);

    // Background + border
    ctx.save();
    ctx.fillStyle = frame.fill || 'rgba(255,255,255,0.02)';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = selectedIds.has(frame.id) ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(fx, fy, fw, fh);

    // Clip + draw children
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx, fy, fw, fh);
    ctx.clip();
    const children = getFrameChildren(frame.id, allObjects);
    for (const child of children) {
      drawObject(ctx, child, colors.stroke, zoom);
      if (selectedIds.has(child.id)) drawSelectionOutline(ctx, child, allObjects, zoom);
    }
    ctx.restore();
    ctx.restore();

    if (selectedIds.has(frame.id)) drawSelectionOutline(ctx, frame, allObjects, zoom);
  }

  // Free objects
  for (const obj of freeObjects) {
    drawObject(ctx, obj, colors.stroke, zoom);
    if (selectedIds.has(obj.id)) drawSelectionOutline(ctx, obj, allObjects, zoom);
  }

  // Resize handles
  if (selectedIds.size > 0) {
    const selObjs = allObjects.filter(o => selectedIds.has(o.id));
    if (selObjs.length > 0) {
      const b = combineBounds(selObjs.map(o => getBounds(o, allObjects)));
      const hs = HANDLE_SIZE / zoom;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1 / zoom;
      for (const [hx, hy] of [[b.minX, b.minY], [b.maxX, b.minY], [b.minX, b.maxY], [b.maxX, b.maxY]]) {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
      }
    }
  }

  // Marquee
  if (marquee) {
    ctx.save();
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1 / zoom;
    ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
    ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
    ctx.restore();
  }

  ctx.restore();
}
