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
  dropTargetId: string | null;
}

function drawObject(ctx: CanvasRenderingContext2D, obj: CanvasObject, defaultStroke: string, zoom: number) {
  const s = obj.style;
  const stroke = s?.strokeColor || defaultStroke;
  const lw = (s?.strokeWidth ?? 2) / zoom;
  const fill = s?.fillColor;
  const opacity = s?.opacity ?? 1;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineWidth = lw;
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
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(obj.x, obj.y, obj.w, obj.h); }
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      break;
    case 'ellipse':
      ctx.beginPath(); ctx.ellipse(obj.cx, obj.cy, Math.abs(obj.rx), Math.abs(obj.ry), 0, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.stroke();
      break;
    case 'text': {
      const fs = s?.fontSize ?? 20;
      ctx.font = `${fs}px PP Mondwest, sans-serif`;
      ctx.textBaseline = 'top';
      obj.value.split('\n').forEach((line, i) => ctx.fillText(line, obj.x, obj.y + i * (fs * 1.3)));
      break;
    }
    case 'image':
      ctx.drawImage(obj.img, obj.x, obj.y, obj.w, obj.h);
      break;
  }
  ctx.restore();
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
  const { objects, preview, selectedIds, marquee, camera, colors, dropTargetId } = state;
  const { x: panX, y: panY, zoom } = camera;

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2 / zoom;
  const vMinX = -panX / zoom, vMinY = -panY / zoom;
  const vMaxX = (canvas.width - panX) / zoom, vMaxY = (canvas.height - panY) / zoom;
  const startX = Math.floor(vMinX / GRID_SPACING) * GRID_SPACING;
  const startY = Math.floor(vMinY / GRID_SPACING) * GRID_SPACING;
  ctx.beginPath();
  for (let gx = startX; gx <= vMaxX; gx += GRID_SPACING) {
    ctx.moveTo(gx, vMinY);
    ctx.lineTo(gx, vMaxY);
  }
  for (let gy = startY; gy <= vMaxY; gy += GRID_SPACING) {
    ctx.moveTo(vMinX, gy);
    ctx.lineTo(vMaxX, gy);
  }
  ctx.stroke();

  const allObjects = preview ? [...objects, preview] : objects;
  const freeObjects = allObjects.filter(o => o.type !== 'frame' && o.type !== 'group' && !o.parentId);
  const topFrames = allObjects.filter(o => o.type === 'frame' && !o.parentId);

  // Recursive frame renderer (supports nesting)
  function drawFrame(frame: CanvasObject) {
    if (frame.type !== 'frame' || !ctx) return;
    const fx = Math.min(frame.x, frame.x + frame.w);
    const fy = Math.min(frame.y, frame.y + frame.h);
    const fw = Math.abs(frame.w);
    const fh = Math.abs(frame.h);

    // Label
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.font = '12px PP Mori, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(frame.label, fx, fy - 6);

    // Background + border
    ctx.save();
    ctx.fillStyle = frame.fill || 'rgba(0,0,0,0)';
    ctx.fillRect(fx, fy, fw, fh);
    const frameBorderColor = frame.style?.strokeColor || 'rgba(255,255,255,0.4)';
    ctx.strokeStyle = selectedIds.has(frame.id) ? 'rgba(255,255,255,0.6)' : frameBorderColor;
    ctx.lineWidth = (frame.style?.strokeWidth ?? 1) / zoom;
    ctx.strokeRect(fx, fy, fw, fh);

    // Drop target highlight
    if (frame.id === dropTargetId) {
      ctx.save();
      ctx.strokeStyle = 'rgba(100, 149, 237, 0.8)';
      ctx.lineWidth = 3 / zoom;
      ctx.setLineDash([6 / zoom, 3 / zoom]);
      ctx.strokeRect(fx - 2 / zoom, fy - 2 / zoom, fw + 4 / zoom, fh + 4 / zoom);
      ctx.fillStyle = 'rgba(100, 149, 237, 0.06)';
      ctx.fillRect(fx, fy, fw, fh);
      ctx.restore();
    }

    // Clip + draw children
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx, fy, fw, fh);
    ctx.clip();
    const children = getFrameChildren(frame.id, allObjects);
    for (const child of children) {
      if (child.type === 'frame') {
        drawFrame(child); // nested frame
      } else {
        drawObject(ctx, child, colors.stroke, zoom);
        if (selectedIds.has(child.id)) drawSelectionOutline(ctx, child, allObjects, zoom);
      }
    }
    ctx.restore();
    ctx.restore();

    if (selectedIds.has(frame.id)) drawSelectionOutline(ctx, frame, allObjects, zoom);
  }

  // Draw top-level frames (recurses into nested ones)
  for (const frame of topFrames) drawFrame(frame);

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

export function renderObjectsToCanvas(
  objects: CanvasObject[],
  targetIds: Set<string>,
  defaultStroke: string,
  padding = 0,
  scale = 2,
): HTMLCanvasElement | null {
  const exportObjs: CanvasObject[] = [];
  for (const obj of objects) {
    if (targetIds.has(obj.id)) {
      exportObjs.push(obj);
      if (obj.type === 'frame') {
        for (const c of objects) {
          if (c.parentId === obj.id && !targetIds.has(c.id)) exportObjs.push(c);
        }
      }
    }
  }
  if (exportObjs.length === 0) return null;

  const b = combineBounds(exportObjs.map(o => getBounds(o, objects)));
  const w = b.maxX - b.minX + padding * 2;
  const h = b.maxY - b.minY + padding * 2;

  const offscreen = document.createElement('canvas');
  offscreen.width = w * scale;
  offscreen.height = h * scale;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.translate(-b.minX + padding, -b.minY + padding);

  const frames = exportObjs.filter(o => o.type === 'frame');
  const frameIds = new Set(frames.map(f => f.id));
  for (const frame of frames) {
    if (frame.type !== 'frame') continue;
    const fx = Math.min(frame.x, frame.x + frame.w);
    const fy = Math.min(frame.y, frame.y + frame.h);
    const fw = Math.abs(frame.w);
    const fh = Math.abs(frame.h);
    ctx.fillStyle = frame.fill || 'rgba(255,255,255,1)';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx, fy, fw, fh);
    ctx.clip();
    for (const child of objects.filter(o => o.parentId === frame.id)) {
      drawObject(ctx, child, defaultStroke, 1);
    }
    ctx.restore();
  }

  for (const obj of exportObjs) {
    if (obj.type === 'frame' || obj.type === 'group') continue;
    if (obj.parentId && frameIds.has(obj.parentId)) continue;
    drawObject(ctx, obj, defaultStroke, 1);
  }

  return offscreen;
}
