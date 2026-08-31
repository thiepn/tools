/**
 * Document Scanner Utility
 * High-quality 4-corner projective correction and scan enhancement.
 */

export interface Point2D { x: number; y: number }
export type ScanFilterMode = 'original' | 'enhanced' | 'grayscale' | 'bw';
export interface ScanOptions {
  filter: ScanFilterMode;
  brightness: number;
  contrast: number;
  bwThreshold: number;
  sharpen: boolean;
  rotation: 0 | 90 | 180 | 270;
}

export function orderQuadCorners(points: Point2D[]): [Point2D, Point2D, Point2D, Point2D] {
  if (points.length !== 4) throw new Error('Exactly 4 points are required for quadrilateral corner ordering.');
  const sorted = [...points].sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2).sort((a, b) => a.x - b.x);
  const ordered: [Point2D, Point2D, Point2D, Point2D] = [top[0], top[1], bottom[1], bottom[0]];
  if (!validateDocumentQuad(ordered)) {
    const center = points.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 });
    const ring = [...points].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
    const start = ring.reduce((best, p, index) => p.x + p.y < ring[best].x + ring[best].y ? index : best, 0);
    return [ring[start], ring[(start + 1) % 4], ring[(start + 2) % 4], ring[(start + 3) % 4]] as [Point2D, Point2D, Point2D, Point2D];
  }
  return ordered;
}

export function validateDocumentQuad(corners: [Point2D, Point2D, Point2D, Point2D]): boolean {
  const cross = (a: Point2D, b: Point2D, c: Point2D) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  const signs = corners.map((p, i) => cross(p, corners[(i + 1) % 4], corners[(i + 2) % 4]));
  const nonZero = signs.filter((value) => Math.abs(value) > 1e-6);
  if (nonZero.length !== 4) return false;
  return nonZero.every((value) => Math.sign(value) === Math.sign(nonZero[0]));
}

export function euclideanDistance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function calculateWarpDimensions(corners: [Point2D, Point2D, Point2D, Point2D]): { width: number; height: number } {
  const [tl, tr, br, bl] = corners;
  return {
    width: Math.max(100, Math.round(Math.max(euclideanDistance(tl, tr), euclideanDistance(bl, br)))),
    height: Math.max(100, Math.round(Math.max(euclideanDistance(tl, bl), euclideanDistance(tr, br)))),
  };
}

export function detectDefaultCorners(imgWidth: number, imgHeight: number): [Point2D, Point2D, Point2D, Point2D] {
  const marginX = Math.max(8, imgWidth * 0.08);
  const marginY = Math.max(8, imgHeight * 0.08);
  return [
    { x: marginX, y: marginY },
    { x: imgWidth - marginX, y: marginY },
    { x: imgWidth - marginX, y: imgHeight - marginY },
    { x: marginX, y: imgHeight - marginY },
  ];
}

interface ProjectiveMap { a: number; b: number; c: number; d: number; e: number; f: number; g: number; h: number }
function createUnitSquareToQuadMap([p0, p1, p2, p3]: [Point2D, Point2D, Point2D, Point2D]): ProjectiveMap {
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < 1e-8) {
    return { a: p1.x - p0.x, b: p3.x - p0.x, c: p0.x, d: p1.y - p0.y, e: p3.y - p0.y, f: p0.y, g: 0, h: 0 };
  }
  const g = (dx3 * dy2 - dx2 * dy3) / denominator;
  const h = (dx1 * dy3 - dx3 * dy1) / denominator;
  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  };
}

function sourceDimensions(source: HTMLImageElement | HTMLCanvasElement): { width: number; height: number } {
  if (source instanceof HTMLCanvasElement) return { width: source.width, height: source.height };
  return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
}

/** True projective warp with bilinear pixel sampling rather than a coarse mesh approximation. */
export function warpPerspectiveCanvas(
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  corners: [Point2D, Point2D, Point2D, Point2D],
  destWidth: number,
  destHeight: number
): HTMLCanvasElement {
  const width = Math.max(1, Math.round(destWidth));
  const height = Math.max(1, Math.round(destHeight));
  const destCanvas = document.createElement('canvas');
  destCanvas.width = width;
  destCanvas.height = height;
  const destCtx = destCanvas.getContext('2d', { willReadFrequently: true });
  if (!destCtx) return destCanvas;

  const sourceSize = sourceDimensions(sourceImg);
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceSize.width;
  sourceCanvas.height = sourceSize.height;
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx) return destCanvas;
  sourceCtx.drawImage(sourceImg, 0, 0, sourceSize.width, sourceSize.height);

  const sourceData = sourceCtx.getImageData(0, 0, sourceSize.width, sourceSize.height).data;
  const output = destCtx.createImageData(width, height);
  const map = createUnitSquareToQuadMap(orderQuadCorners(corners));
  const maxX = sourceSize.width - 1;
  const maxY = sourceSize.height - 1;

  for (let y = 0; y < height; y++) {
    const v = height === 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = width === 1 ? 0 : x / (width - 1);
      const w = map.g * u + map.h * v + 1;
      const sx = Math.max(0, Math.min(maxX, (map.a * u + map.b * v + map.c) / w));
      const sy = Math.max(0, Math.min(maxY, (map.d * u + map.e * v + map.f) / w));
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(maxX, x0 + 1), y1 = Math.min(maxY, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * sourceSize.width + x0) * 4;
      const i10 = (y0 * sourceSize.width + x1) * 4;
      const i01 = (y1 * sourceSize.width + x0) * 4;
      const i11 = (y1 * sourceSize.width + x1) * 4;
      const out = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel++) {
        const top = sourceData[i00 + channel] * (1 - fx) + sourceData[i10 + channel] * fx;
        const bottom = sourceData[i01 + channel] * (1 - fx) + sourceData[i11 + channel] * fx;
        output.data[out + channel] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  destCtx.putImageData(output, 0, 0);
  return destCanvas;
}

export function calculateOtsuThreshold(values: Uint8Array | Uint8ClampedArray): number {
  if (values.length === 0) return 128;
  const histogram = new Uint32Array(256);
  let sum = 0;
  for (const value of values) { histogram[value]++; sum += value; }
  let backgroundWeight = 0, backgroundSum = 0, bestVariance = -1, best = 128;
  for (let threshold = 0; threshold < 256; threshold++) {
    backgroundWeight += histogram[threshold];
    if (backgroundWeight === 0) continue;
    const foregroundWeight = values.length - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += threshold * histogram[threshold];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) { bestVariance = variance; best = threshold; }
  }
  return best;
}

export function sharpenRgbaPixels(source: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  if (width < 3 || height < 3 || source.length !== width * height * 4) return new Uint8ClampedArray(source);
  const output = new Uint8ClampedArray(source);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const dest = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        let value = 0, k = 0;
        for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) value += source[((y + ky) * width + (x + kx)) * 4 + channel] * kernel[k++];
        output[dest + channel] = Math.max(0, Math.min(255, Math.round(value)));
      }
      output[dest + 3] = source[dest + 3];
    }
  }
  return output;
}

export function applyScanFilters(canvas: HTMLCanvasElement, options: ScanOptions): HTMLCanvasElement {
  let workCanvas = canvas;
  if (options.rotation !== 0) {
    const rotated = document.createElement('canvas');
    rotated.width = options.rotation === 90 || options.rotation === 270 ? canvas.height : canvas.width;
    rotated.height = options.rotation === 90 || options.rotation === 270 ? canvas.width : canvas.height;
    const rctx = rotated.getContext('2d');
    if (rctx) {
      rctx.translate(rotated.width / 2, rotated.height / 2);
      rctx.rotate((options.rotation * Math.PI) / 180);
      rctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      workCanvas = rotated;
    }
  }
  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return workCanvas;
  const image = ctx.getImageData(0, 0, workCanvas.width, workCanvas.height);
  const data = image.data;
  const contrast = Math.max(-254, Math.min(254, options.contrast));
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const luminance = new Uint8Array(workCanvas.width * workCanvas.height);
  for (let p = 0, i = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    luminance[p] = Math.max(0, Math.min(255, Math.round(factor * (lum - 128) + 128 + options.brightness)));
  }
  const autoThreshold = calculateOtsuThreshold(luminance);
  const threshold = options.bwThreshold === 128 ? autoThreshold : Math.max(0, Math.min(255, options.bwThreshold));
  for (let p = 0, i = 0; i < data.length; i += 4, p++) {
    if (options.filter === 'bw') {
      const value = luminance[p] >= threshold ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = value;
    } else if (options.filter === 'grayscale') {
      data[i] = data[i + 1] = data[i + 2] = luminance[p];
    } else if (options.filter === 'enhanced' || options.brightness !== 0 || options.contrast !== 0) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128 + options.brightness));
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128 + options.brightness));
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128 + options.brightness));
    }
  }
  if (options.sharpen) image.data.set(sharpenRgbaPixels(data, workCanvas.width, workCanvas.height));
  ctx.putImageData(image, 0, 0);
  return workCanvas;
}
