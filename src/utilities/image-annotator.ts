export type AnnotationTool =
  | 'select'
  | 'arrow'
  | 'line'
  | 'rect'
  | 'circle'
  | 'highlighter'
  | 'redact'
  | 'text'
  | 'stepBadge';

export interface BaseAnnotation {
  id: string;
  type: AnnotationTool;
  color: string;
  strokeWidth: number;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleAnnotation extends BaseAnnotation {
  type: 'circle';
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
}

export interface HighlighterAnnotation extends BaseAnnotation {
  type: 'highlighter';
  points: { x: number; y: number }[];
}

export interface RedactAnnotation extends BaseAnnotation {
  type: 'redact';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export interface StepBadgeAnnotation extends BaseAnnotation {
  type: 'stepBadge';
  x: number;
  y: number;
  number: number;
}

export type AnnotationItem =
  | ArrowAnnotation
  | LineAnnotation
  | RectAnnotation
  | CircleAnnotation
  | HighlighterAnnotation
  | RedactAnnotation
  | TextAnnotation
  | StepBadgeAnnotation;

// Render all annotations onto canvas context
export function renderAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: AnnotationItem[],
  sourceImage: HTMLImageElement
): void {
  // Clear and draw base image
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(sourceImage, 0, 0);

  // Render Redact blocks first (needs image pixel data manipulation)
  annotations.forEach((item) => {
    if (item.type === 'redact') {
      applyPixelate(ctx, item.x, item.y, item.width, item.height, 10);
    }
  });

  // Render standard vector shapes
  annotations.forEach((item) => {
    ctx.save();
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = item.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (item.type) {
      case 'arrow': {
        drawArrow(ctx, item.startX, item.startY, item.endX, item.endY, item.strokeWidth);
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(item.startX, item.startY);
        ctx.lineTo(item.endX, item.endY);
        ctx.stroke();
        break;
      }
      case 'rect': {
        ctx.strokeRect(item.x, item.y, item.width, item.height);
        break;
      }
      case 'circle': {
        ctx.beginPath();
        ctx.ellipse(
          item.centerX,
          item.centerY,
          Math.abs(item.radiusX),
          Math.abs(item.radiusY),
          0,
          0,
          2 * Math.PI
        );
        ctx.stroke();
        break;
      }
      case 'highlighter': {
        if (item.points.length > 1) {
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(item.points[0].x, item.points[0].y);
          for (let i = 1; i < item.points.length; i++) {
            ctx.lineTo(item.points[i].x, item.points[i].y);
          }
          ctx.stroke();
        }
        break;
      }
      case 'text': {
        ctx.font = `bold ${item.fontSize}px sans-serif`;
        const textMetrics = ctx.measureText(item.text);
        const padding = 6;

        // Draw background pill
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        ctx.roundRect(
          item.x - padding,
          item.y - item.fontSize,
          textMetrics.width + padding * 2,
          item.fontSize + padding * 2,
          4
        );
        ctx.fill();

        ctx.fillStyle = item.color;
        ctx.fillText(item.text, item.x, item.y);
        break;
      }
      case 'stepBadge': {
        const radius = Math.max(14, item.strokeWidth * 4);
        // Outer Circle
        ctx.beginPath();
        ctx.arc(item.x, item.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Inner Number
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.round(radius * 1.1)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(item.number), item.x, item.y + 1);
        break;
      }
      default:
        break;
    }
    ctx.restore();
  });
}

// Arrow helper with clean arrowhead
function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  strokeWidth: number
): void {
  const headLength = Math.max(12, strokeWidth * 3.5);
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  // Line
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

// Pixelate / Redact helper
function applyPixelate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  blockSize = 8
): void {
  const normX = Math.max(0, Math.min(x, ctx.canvas.width));
  const normY = Math.max(0, Math.min(y, ctx.canvas.height));
  const normW = Math.min(w, ctx.canvas.width - normX);
  const normH = Math.min(h, ctx.canvas.height - normY);

  if (normW <= 0 || normH <= 0) return;

  const imgData = ctx.getImageData(normX, normY, normW, normH);
  const data = imgData.data;

  for (let py = 0; py < normH; py += blockSize) {
    for (let px = 0; px < normW; px += blockSize) {
      const redIdx = (py * normW + px) * 4;
      const r = data[redIdx];
      const g = data[redIdx + 1];
      const b = data[redIdx + 2];

      for (let subY = 0; subY < blockSize && py + subY < normH; subY++) {
        for (let subX = 0; subX < blockSize && px + subX < normW; subX++) {
          const idx = ((py + subY) * normW + (px + subX)) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
        }
      }
    }
  }

  ctx.putImageData(imgData, normX, normY);
}
