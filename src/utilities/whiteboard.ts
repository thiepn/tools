/**
 * Whiteboard & Sketchpad Canvas Utilities
 */

export type WhiteboardTool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'marker';

export type BackgroundPattern = 'white' | 'dark' | 'grid' | 'dots';

export interface BoardPoint {
  x: number;
  y: number;
}

export interface BoardElement {
  id: string;
  type: 'path' | 'line' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'marker';
  points?: BoardPoint[];
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  strokeWidth: number;
  opacity: number;
  text?: string;
  fontSize?: number;
  markerNumber?: number;
  fill?: string;
}

export interface BoardState {
  version: 1;
  id: string;
  title: string;
  elements: BoardElement[];
  background: BackgroundPattern;
  updatedAt: number;
}

/**
 * Calculates element bounding box
 */
export function getElementBoundingBox(el: BoardElement): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (el.points && el.points.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const pad = el.strokeWidth / 2 + 4;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }

  const w = Math.abs(el.width || 0);
  const h = Math.abs(el.height || 0);
  const minX = Math.min(el.x, el.x + (el.width || 0));
  const minY = Math.min(el.y, el.y + (el.height || 0));

  return {
    minX,
    minY,
    maxX: minX + w,
    maxY: minY + h,
    width: w,
    height: h,
  };
}

/**
 * Checks if a point (px, py) is inside or near a BoardElement
 */
export function isPointInsideElement(
  px: number,
  py: number,
  el: BoardElement,
  hitThreshold = 8
): boolean {
  const box = getElementBoundingBox(el);
  if (
    px < box.minX - hitThreshold ||
    px > box.maxX + hitThreshold ||
    py < box.minY - hitThreshold ||
    py > box.maxY + hitThreshold
  ) {
    return false;
  }

  if (el.type === 'rectangle' || el.type === 'text' || el.type === 'marker') {
    return true;
  }

  if (el.points && el.points.length > 1) {
    for (let i = 0; i < el.points.length - 1; i++) {
      const p1 = el.points[i];
      const p2 = el.points[i + 1];
      const dist = distanceToSegment(px, py, p1.x, p1.y, p2.x, p2.y);
      if (dist <= (el.strokeWidth / 2 + hitThreshold)) return true;
    }
    return false;
  }

  return true;
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

/**
 * Draws background pattern on canvas context
 */
export function drawBoardBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pattern: BackgroundPattern
) {
  if (pattern === 'dark') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (pattern === 'grid') {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    const step = 28;
    ctx.beginPath();
    for (let x = step; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = step; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  } else if (pattern === 'dots') {
    ctx.fillStyle = '#cbd5e1';
    const step = 24;
    for (let x = step / 2; x < width; x += step) {
      for (let y = step / 2; y < height; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
