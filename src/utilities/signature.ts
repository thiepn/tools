/**
 * Signature Maker & Background Cleaning Utilities
 */

export interface Point {
  x: number;
  y: number;
  time?: number;
}

export interface SignatureStroke {
  points: Point[];
  color: string;
  width: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Finds the tight bounding box containing non-transparent pixels on a canvas
 */
export function getCanvasContentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  padding = 16
): BoundingBox | null {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) return null; // Canvas is empty

  // Apply padding
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width, maxX + padding);
  maxY = Math.min(height, maxY + padding);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Crops a canvas to its content bounding box
 */
export function cropCanvasToContent(
  sourceCanvas: HTMLCanvasElement,
  bounds: BoundingBox
): HTMLCanvasElement {
  const cropped = document.createElement('canvas');
  cropped.width = Math.max(1, bounds.width);
  cropped.height = Math.max(1, bounds.height);

  const ctx = cropped.getContext('2d');
  if (ctx) {
    ctx.drawImage(
      sourceCanvas,
      bounds.minX,
      bounds.minY,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );
  }
  return cropped;
}

/**
 * Cleans a photographed signature image by thresholding white background into transparent alpha
 */
export function cleanSignatureImage(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  threshold = 200, // 0..255
  contrast = 1.2,
  inkColor = '#0f172a'
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = sourceImage.width;
  const h = sourceImage.height;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(sourceImage, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Parse ink color
  const hex = inkColor.replace('#', '');
  const rInk = parseInt(hex.substring(0, 2), 16) || 0;
  const gInk = parseInt(hex.substring(2, 4), 16) || 0;
  const bInk = parseInt(hex.substring(4, 6), 16) || 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Compute luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Apply contrast
    const contrasted = (lum - 128) * contrast + 128;

    if (contrasted >= threshold) {
      // Background (white/light paper) -> completely transparent
      data[i + 3] = 0;
    } else {
      // Ink -> solid ink color with anti-aliasing alpha
      const inkAlpha = Math.round(255 * (1 - contrasted / threshold));
      data[i] = rInk;
      data[i + 1] = gInk;
      data[i + 2] = bInk;
      data[i + 3] = Math.min(255, Math.max(0, inkAlpha));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
