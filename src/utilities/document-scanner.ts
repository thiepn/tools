/**
 * Document Scanner Utility
 * 4-corner perspective correction, homography warp, scan filtering and document enhancement
 */

export interface Point2D {
  x: number;
  y: number;
}

export type ScanFilterMode = 'original' | 'enhanced' | 'grayscale' | 'bw';

export interface ScanOptions {
  filter: ScanFilterMode;
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  bwThreshold: number; // 0 to 255
  sharpen: boolean;
  rotation: 0 | 90 | 180 | 270;
}

export function orderQuadCorners(points: Point2D[]): [Point2D, Point2D, Point2D, Point2D] {
  if (points.length !== 4) {
    throw new Error('Exactly 4 points are required for quadrilateral corner ordering.');
  }

  const centerX = points.reduce((s, p) => s + p.x, 0) / 4;
  const centerY = points.reduce((s, p) => s + p.y, 0) / 4;
  const sorted = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - centerY, a.x - centerX);
    const angleB = Math.atan2(b.y - centerY, b.x - centerX);
    return angleA - angleB;
  });

  let minSumIndex = 0;
  let minSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      minSumIndex = i;
    }
  }

  return [
    sorted[minSumIndex],
    sorted[(minSumIndex + 1) % 4],
    sorted[(minSumIndex + 2) % 4],
    sorted[(minSumIndex + 3) % 4],
  ];
}

export function euclideanDistance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function calculateWarpDimensions(corners: [Point2D, Point2D, Point2D, Point2D]): {
  width: number;
  height: number;
} {
  const [tl, tr, br, bl] = corners;
  return {
    width: Math.max(100, Math.round(Math.max(euclideanDistance(tl, tr), euclideanDistance(bl, br)))),
    height: Math.max(100, Math.round(Math.max(euclideanDistance(tl, bl), euclideanDistance(tr, br)))),
  };
}

export function detectDefaultCorners(imgWidth: number, imgHeight: number): [Point2D, Point2D, Point2D, Point2D] {
  const marginX = imgWidth * 0.08;
  const marginY = imgHeight * 0.08;
  return [
    { x: marginX, y: marginY },
    { x: imgWidth - marginX, y: marginY },
    { x: imgWidth - marginX, y: imgHeight - marginY },
    { x: marginX, y: imgHeight - marginY },
  ];
}

export function warpPerspectiveCanvas(
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  corners: [Point2D, Point2D, Point2D, Point2D],
  destWidth: number,
  destHeight: number
): HTMLCanvasElement {
  const destCanvas = document.createElement('canvas');
  destCanvas.width = destWidth;
  destCanvas.height = destHeight;
  const ctx = destCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return destCanvas;

  const [p0, p1, p2, p3] = corners;
  const GRID_SIZE = 16;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const u0 = x / GRID_SIZE;
      const v0 = y / GRID_SIZE;
      const u1 = (x + 1) / GRID_SIZE;
      const v1 = (y + 1) / GRID_SIZE;

      const pt00 = bilinearInterpolate(p0, p1, p2, p3, u0, v0);
      const pt10 = bilinearInterpolate(p0, p1, p2, p3, u1, v0);
      const pt11 = bilinearInterpolate(p0, p1, p2, p3, u1, v1);
      const pt01 = bilinearInterpolate(p0, p1, p2, p3, u0, v1);

      const dx0 = u0 * destWidth;
      const dy0 = v0 * destHeight;
      const dx1 = u1 * destWidth;
      const dy1 = v1 * destHeight;

      drawTexturedTriangle(ctx, sourceImg, pt00, pt10, pt01, { x: dx0, y: dy0 }, { x: dx1, y: dy0 }, { x: dx0, y: dy1 });
      drawTexturedTriangle(ctx, sourceImg, pt10, pt11, pt01, { x: dx1, y: dy0 }, { x: dx1, y: dy1 }, { x: dx0, y: dy1 });
    }
  }

  return destCanvas;
}

function bilinearInterpolate(
  tl: Point2D,
  tr: Point2D,
  br: Point2D,
  bl: Point2D,
  u: number,
  v: number
): Point2D {
  const topX = tl.x + (tr.x - tl.x) * u;
  const topY = tl.y + (tr.y - tl.y) * u;
  const bottomX = bl.x + (br.x - bl.x) * u;
  const bottomY = bl.y + (br.y - bl.y) * u;
  return {
    x: topX + (bottomX - topX) * v,
    y: topY + (bottomY - topY) * v,
  };
}

function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  s0: Point2D,
  s1: Point2D,
  s2: Point2D,
  d0: Point2D,
  d1: Point2D,
  d2: Point2D
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  const denom = s0.x * (s2.y - s1.y) - s1.x * s2.y + s2.x * s1.y + (s1.x - s2.x) * s0.y;
  if (Math.abs(denom) < 0.0001) {
    ctx.restore();
    return;
  }

  const m11 = -(s0.y * (d2.x - d1.x) - s1.y * d2.x + s2.y * d1.x + (s1.y - s2.y) * d0.x) / denom;
  const m12 = (s0.y * (d2.y - d1.y) - s1.y * d2.y + s2.y * d1.y + (s1.y - s2.y) * d0.y) / denom;
  const m21 = (s0.x * (d2.x - d1.x) - s1.x * d2.x + s2.x * d1.x + (s1.x - s2.x) * d0.x) / denom;
  const m22 = -(s0.x * (d2.y - d1.y) - s1.x * d2.y + s2.x * d1.y + (s1.x - s2.x) * d0.y) / denom;
  const dx = (s0.x * (s2.y * d1.x - s1.y * d2.x) + s0.y * (s1.x * d2.x - s2.x * d1.x) + (s1.y * s2.x - s1.x * s2.y) * d0.x) / denom;
  const dy = (s0.x * (s2.y * d1.y - s1.y * d2.y) + s0.y * (s1.x * d2.y - s2.x * d1.y) + (s1.y * s2.x - s1.x * s2.y) * d0.y) / denom;

  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/**
 * Applies a compact 3×3 unsharp kernel to RGBA pixels while preserving alpha.
 * Exported separately so the scanner's sharpen option has deterministic tests.
 */
export function sharpenRgbaPixels(
  source: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  if (width < 3 || height < 3 || source.length !== width * height * 4) return new Uint8ClampedArray(source);
  const output = new Uint8ClampedArray(source);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const dest = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        let value = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const src = ((y + ky) * width + (x + kx)) * 4 + channel;
            value += source[src] * kernel[k++];
          }
        }
        output[dest + channel] = Math.max(0, Math.min(255, Math.round(value)));
      }
      output[dest + 3] = source[dest + 3];
    }
  }

  return output;
}

export function applyScanFilters(
  canvas: HTMLCanvasElement,
  options: ScanOptions
): HTMLCanvasElement {
  let workCanvas = canvas;

  if (options.rotation !== 0) {
    const rotCanvas = document.createElement('canvas');
    if (options.rotation === 90 || options.rotation === 270) {
      rotCanvas.width = canvas.height;
      rotCanvas.height = canvas.width;
    } else {
      rotCanvas.width = canvas.width;
      rotCanvas.height = canvas.height;
    }

    const rotCtx = rotCanvas.getContext('2d');
    if (rotCtx) {
      rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rotCtx.rotate((options.rotation * Math.PI) / 180);
      rotCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      workCanvas = rotCanvas;
    }
  }

  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return workCanvas;

  const imgData = ctx.getImageData(0, 0, workCanvas.width, workCanvas.height);
  const d = imgData.data;
  const contrastFactor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast));
  const brightness = options.brightness;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (options.filter === 'bw') {
      const val = lum >= options.bwThreshold ? 255 : 0;
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    } else if (options.filter === 'grayscale') {
      let adj = contrastFactor * (lum - 128) + 128 + brightness;
      adj = Math.max(0, Math.min(255, adj));
      d[i] = adj;
      d[i + 1] = adj;
      d[i + 2] = adj;
    } else if (options.filter === 'enhanced') {
      r = Math.max(0, Math.min(255, contrastFactor * (r - 128) + 128 + brightness));
      g = Math.max(0, Math.min(255, contrastFactor * (g - 128) + 128 + brightness));
      b = Math.max(0, Math.min(255, contrastFactor * (b - 128) + 128 + brightness));
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    } else if (brightness !== 0 || options.contrast !== 0) {
      d[i] = Math.max(0, Math.min(255, contrastFactor * (r - 128) + 128 + brightness));
      d[i + 1] = Math.max(0, Math.min(255, contrastFactor * (g - 128) + 128 + brightness));
      d[i + 2] = Math.max(0, Math.min(255, contrastFactor * (b - 128) + 128 + brightness));
    }
  }

  if (options.sharpen) {
    imgData.data.set(sharpenRgbaPixels(d, workCanvas.width, workCanvas.height));
  }

  ctx.putImageData(imgData, 0, 0);
  return workCanvas;
}
