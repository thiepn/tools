/** Whiteboard geometry, persistence and rendering helpers. */
export type WhiteboardTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'marker';
export type BackgroundPattern = 'white' | 'dark' | 'grid' | 'dots';
export interface BoardPoint { x: number; y: number }
export interface BoardElement {
  id: string; type: 'path' | 'line' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'marker';
  points?: BoardPoint[]; x: number; y: number; width?: number; height?: number;
  color: string; strokeWidth: number; opacity: number; text?: string; fontSize?: number; markerNumber?: number; fill?: string;
}
export interface BoardState { version: 1; id: string; title: string; elements: BoardElement[]; background: BackgroundPattern; updatedAt: number }
const MARKER_RADIUS = 14;

function getTextDimensions(el: BoardElement): { width: number; height: number } {
  const fontSize = Math.max(1, el.fontSize || 18), lines = (el.text || '').split('\n');
  const longest = lines.reduce((max, line) => Math.max(max, Array.from(line).length), 0);
  return { width: Math.max(fontSize * 0.6, longest * fontSize * 0.6), height: Math.max(fontSize * 1.2, lines.length * fontSize * 1.2) };
}

export function getElementBoundingBox(el: BoardElement): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (el.points?.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of el.points) { minX = Math.min(minX, point.x); minY = Math.min(minY, point.y); maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y); }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }
  if (el.type === 'text') { const size = getTextDimensions(el); return { minX: el.x, minY: el.y, maxX: el.x + size.width, maxY: el.y + size.height, width: size.width, height: size.height }; }
  if (el.type === 'marker') return { minX: el.x - MARKER_RADIUS, minY: el.y - MARKER_RADIUS, maxX: el.x + MARKER_RADIUS, maxY: el.y + MARKER_RADIUS, width: MARKER_RADIUS * 2, height: MARKER_RADIUS * 2 };
  const rawWidth = el.width || 0, rawHeight = el.height || 0;
  const minX = Math.min(el.x, el.x + rawWidth), minY = Math.min(el.y, el.y + rawHeight), maxX = Math.max(el.x, el.x + rawWidth), maxY = Math.max(el.y, el.y + rawHeight);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (!lengthSquared) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / lengthSquared));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export function isPointInsideElement(px: number, py: number, el: BoardElement, hitThreshold = 8): boolean {
  const box = getElementBoundingBox(el), padding = hitThreshold + Math.max(0, el.strokeWidth) / 2;
  if (px < box.minX - padding || px > box.maxX + padding || py < box.minY - padding || py > box.maxY + padding) return false;
  if (el.type === 'marker') return Math.hypot(px - el.x, py - el.y) <= MARKER_RADIUS + hitThreshold;
  if (el.type === 'text') return true;
  if (el.type === 'line' || el.type === 'arrow') return distanceToSegment(px, py, el.x, el.y, el.x + (el.width || 0), el.y + (el.height || 0)) <= el.strokeWidth / 2 + hitThreshold;
  if (el.type === 'ellipse') {
    const width = el.width || 0, height = el.height || 0, rx = Math.abs(width) / 2, ry = Math.abs(height) / 2;
    if (rx < 1 || ry < 1) return Math.hypot(px - el.x, py - el.y) <= hitThreshold;
    const cx = el.x + width / 2, cy = el.y + height / 2, nx = (px - cx) / (rx + hitThreshold), ny = (py - cy) / (ry + hitThreshold);
    return nx * nx + ny * ny <= 1;
  }
  if (el.type === 'rectangle') return true;
  if (el.points?.length === 1) return Math.hypot(px - el.points[0].x, py - el.points[0].y) <= el.strokeWidth / 2 + hitThreshold;
  if (el.points && el.points.length > 1) for (let i = 0; i < el.points.length - 1; i++) if (distanceToSegment(px, py, el.points[i].x, el.points[i].y, el.points[i + 1].x, el.points[i + 1].y) <= el.strokeWidth / 2 + hitThreshold) return true;
  return false;
}

export function findTopmostElementAt(elements: BoardElement[], x: number, y: number, threshold = 8): BoardElement | null {
  for (let i = elements.length - 1; i >= 0; i--) if (isPointInsideElement(x, y, elements[i], threshold)) return elements[i];
  return null;
}

export function translateBoardElement(element: BoardElement, dx: number, dy: number): BoardElement {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { ...element };
  return { ...element, x: element.x + dx, y: element.y + dy, points: element.points?.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
}

function pointSegmentDistance(point: BoardPoint, start: BoardPoint, end: BoardPoint): number { return distanceToSegment(point.x, point.y, start.x, start.y, end.x, end.y); }
export function simplifyBoardPath(points: BoardPoint[], tolerance = 0.8): BoardPoint[] {
  if (points.length <= 2) return [...points];
  const safeTolerance = Math.max(0, tolerance);
  let maxDistance = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) { const distance = pointSegmentDistance(points[i], points[0], points[points.length - 1]); if (distance > maxDistance) { maxDistance = distance; index = i; } }
  if (maxDistance <= safeTolerance) return [points[0], points[points.length - 1]];
  const first = simplifyBoardPath(points.slice(0, index + 1), safeTolerance), second = simplifyBoardPath(points.slice(index), safeTolerance);
  return [...first.slice(0, -1), ...second];
}

export function serializeBoardState(state: BoardState): string { return JSON.stringify({ ...state, version: 1, updatedAt: Number.isFinite(state.updatedAt) ? state.updatedAt : Date.now() }); }
export function parseBoardState(raw: string): BoardState | null {
  try {
    const value = JSON.parse(raw) as Partial<BoardState>;
    if (value.version !== 1 || !Array.isArray(value.elements)) return null;
    const background: BackgroundPattern = ['white', 'dark', 'grid', 'dots'].includes(String(value.background)) ? value.background as BackgroundPattern : 'grid';
    const elements = value.elements.filter((element): element is BoardElement => Boolean(element && typeof element.id === 'string' && typeof element.type === 'string' && Number.isFinite(element.x) && Number.isFinite(element.y)));
    return { version: 1, id: typeof value.id === 'string' ? value.id : 'default', title: typeof value.title === 'string' ? value.title.slice(0, 120) : 'Whiteboard', elements, background, updatedAt: Number.isFinite(value.updatedAt) ? Number(value.updatedAt) : Date.now() };
  } catch { return null; }
}

export function drawBoardBackground(ctx: CanvasRenderingContext2D, width: number, height: number, pattern: BackgroundPattern) {
  if (pattern === 'dark') { ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, width, height); return; }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  if (pattern === 'grid') {
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; const step = 28; ctx.beginPath();
    for (let x = step; x < width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = step; y < height; y += step) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
  } else if (pattern === 'dots') {
    ctx.fillStyle = '#cbd5e1'; const step = 24;
    for (let x = step / 2; x < width; x += step) for (let y = step / 2; y < height; y += step) { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill(); }
  }
}
