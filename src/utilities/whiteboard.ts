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

const MARKER_RADIUS = 14;

function getTextDimensions(el: BoardElement): { width: number; height: number } {
  const fontSize = Math.max(1, el.fontSize || 18);
  const lines = (el.text || '').split('\n');
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return {
    width: Math.max(fontSize * 0.6, longest * fontSize * 0.6),
    height: Math.max(fontSize * 1.2, lines.length * fontSize * 1.2),
  };
}

/** Returns the geometric element bounds without interaction padding. */
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

    for (const point of el.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  if (el.type === 'text') {
    const size = getTextDimensions(el);
    return {
      minX: el.x,
      minY: el.y,
      maxX: el.x + size.width,
      maxY: el.y + size.height,
      width: size.width,
      height: size.height,
    };
  }

  if (el.type === 'marker') {
    return {
      minX: el.x - MARKER_RADIUS,
      minY: el.y - MARKER_RADIUS,
      maxX: el.x + MARKER_RADIUS,
      maxY: el.y + MARKER_RADIUS,
      width: MARKER_RADIUS * 2,
      height: MARKER_RADIUS * 2,
    };
  }

  const rawWidth = el.width || 0;
  const rawHeight = el.height || 0;
  const minX = Math.min(el.x, el.x + rawWidth);
  const minY = Math.min(el.y, el.y + rawHeight);
  const maxX = Math.max(el.x, el.x + rawWidth);
  const maxY = Math.max(el.y, el.y + rawHeight);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Checks if a point is inside or near a BoardElement. Paths and line-like
 * elements use segment distance; ellipses use the actual ellipse equation.
 */
export function isPointInsideElement(
  px: number,
  py: number,
  el: BoardElement,
  hitThreshold = 8
): boolean {
  const box = getElementBoundingBox(el);
  const coarsePadding = hitThreshold + Math.max(0, el.strokeWidth) / 2;
  if (
    px < box.minX - coarsePadding ||
    px > box.maxX + coarsePadding ||
    py < box.minY - coarsePadding ||
    py > box.maxY + coarsePadding
  ) {
    return false;
  }

  if (el.type === 'marker') {
    return Math.hypot(px - el.x, py - el.y) <= MARKER_RADIUS + hitThreshold;
  }

  if (el.type === 'text') {
    return px >= box.minX - hitThreshold && px <= box.maxX + hitThreshold && py >= box.minY - hitThreshold && py <= box.maxY + hitThreshold;
  }

  if (el.type === 'line' || el.type === 'arrow') {
    const x2 = el.x + (el.width || 0);
    const y2 = el.y + (el.height || 0);
    return distanceToSegment(px, py, el.x, el.y, x2, y2) <= el.strokeWidth / 2 + hitThreshold;
  }

  if (el.type === 'ellipse') {
    const width = el.width || 0;
    const height = el.height || 0;
    const rx = Math.abs(width) / 2;
    const ry = Math.abs(height) / 2;
    if (rx < 1 || ry < 1) return Math.hypot(px - el.x, py - el.y) <= hitThreshold;
    const cx = el.x + width / 2;
    const cy = el.y + height / 2;
    const nx = (px - cx) / (rx + hitThreshold);
    const ny = (py - cy) / (ry + hitThreshold);
    return nx * nx + ny * ny <= 1;
  }

  if (el.type === 'rectangle') return true;

  if (el.points && el.points.length === 1) {
    const point = el.points[0];
    return Math.hypot(px - point.x, py - point.y) <= el.strokeWidth / 2 + hitThreshold;
  }

  if (el.points && el.points.length > 1) {
    for (let i = 0; i < el.points.length - 1; i++) {
      const first = el.points[i];
      const second = el.points[i + 1];
      if (distanceToSegment(px, py, first.x, first.y, second.x, second.y) <= el.strokeWidth / 2 + hitThreshold) {
        return true;
      }
    }
  }

  return false;
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (lengthSquared === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

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
