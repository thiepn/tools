/**
 * Screenshot Stitcher Utility
 * Automatic vertical/horizontal screenshot overlap calculation, seam blending, and canvas rendering
 */

export interface StitchItem {
  id: string;
  file: File;
  img: HTMLImageElement;
  width: number;
  height: number;
  overlapPx: number; // calculated or manual overlap with previous image
}

export type StitchDirection = 'vertical' | 'horizontal';

/**
 * Calculates optimal vertical overlap between two consecutive images using row luminance comparison
 */
export function estimateVerticalOverlap(
  topCanvas: HTMLCanvasElement | HTMLImageElement,
  bottomCanvas: HTMLCanvasElement | HTMLImageElement,
  maxSearchPx = 300
): number {
  try {
    const topW = topCanvas.width || (topCanvas as HTMLImageElement).naturalWidth;
    const topH = topCanvas.height || (topCanvas as HTMLImageElement).naturalHeight;
    const botW = bottomCanvas.width || (bottomCanvas as HTMLImageElement).naturalWidth;
    const botH = bottomCanvas.height || (bottomCanvas as HTMLImageElement).naturalHeight;

    const sampleW = Math.min(topW, botW, 300);
    const searchDepth = Math.min(maxSearchPx, topH - 10, botH - 10);
    if (searchDepth <= 10) return 0;

    const canvasA = document.createElement('canvas');
    canvasA.width = sampleW;
    canvasA.height = searchDepth;
    const ctxA = canvasA.getContext('2d', { willReadFrequently: true });

    const canvasB = document.createElement('canvas');
    canvasB.width = sampleW;
    canvasB.height = searchDepth;
    const ctxB = canvasB.getContext('2d', { willReadFrequently: true });

    if (!ctxA || !ctxB) return 0;

    // Draw bottom strip of top image
    ctxA.drawImage(topCanvas, 0, topH - searchDepth, sampleW, searchDepth, 0, 0, sampleW, searchDepth);
    // Draw top strip of bottom image
    ctxB.drawImage(bottomCanvas, 0, 0, sampleW, searchDepth, 0, 0, sampleW, searchDepth);

    const dataA = ctxA.getImageData(0, 0, sampleW, searchDepth).data;
    const dataB = ctxB.getImageData(0, 0, sampleW, searchDepth).data;

    let bestOverlap = 0;
    let minDiff = Infinity;

    // Test candidate overlap heights from 10px to searchDepth
    for (let candidate = 10; candidate < searchDepth; candidate += 2) {
      let diff = 0;
      let count = 0;

      for (let y = 0; y < candidate; y += 2) {
        const rowA = (searchDepth - candidate + y) * sampleW * 4;
        const rowB = y * sampleW * 4;

        for (let x = 0; x < sampleW; x += 4) {
          const idxA = rowA + x * 4;
          const idxB = rowB + x * 4;
          const dr = Math.abs(dataA[idxA] - dataB[idxB]);
          const dg = Math.abs(dataA[idxA + 1] - dataB[idxB + 1]);
          const db = Math.abs(dataA[idxA + 2] - dataB[idxB + 2]);
          diff += dr + dg + db;
          count++;
        }
      }

      const avgDiff = diff / Math.max(1, count);
      if (avgDiff < minDiff) {
        minDiff = avgDiff;
        bestOverlap = candidate;
      }
    }

    // Only accept if error is small (strong match)
    if (minDiff < 45) {
      return bestOverlap;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Calculates stitched output dimensions
 */
export function calculateStitchDimensions(
  items: StitchItem[],
  direction: StitchDirection,
  edgeTrimPx = 0
): { width: number; height: number } {
  if (items.length === 0) return { width: 0, height: 0 };

  if (direction === 'vertical') {
    const maxWidth = Math.max(...items.map((it) => it.width)) - edgeTrimPx * 2;
    let totalHeight = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (i === 0) {
        totalHeight += it.height;
      } else {
        totalHeight += Math.max(0, it.height - it.overlapPx);
      }
    }

    return {
      width: Math.max(1, maxWidth),
      height: Math.max(1, totalHeight),
    };
  } else {
    const maxHeight = Math.max(...items.map((it) => it.height)) - edgeTrimPx * 2;
    let totalWidth = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (i === 0) {
        totalWidth += it.width;
      } else {
        totalWidth += Math.max(0, it.width - it.overlapPx);
      }
    }

    return {
      width: Math.max(1, totalWidth),
      height: Math.max(1, maxHeight),
    };
  }
}

/**
 * Renders stitched canvas from ordered screenshot items
 */
export function renderStitchedCanvas(
  items: StitchItem[],
  direction: StitchDirection,
  edgeTrimPx = 0,
  bgColor = '#FFFFFF'
): HTMLCanvasElement {
  const { width, height } = calculateStitchDimensions(items, direction, edgeTrimPx);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  if (direction === 'vertical') {
    let currentY = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const srcX = edgeTrimPx;
      const srcW = it.width - edgeTrimPx * 2;

      let drawY = currentY;
      let srcY = 0;
      let srcH = it.height;

      if (i > 0) {
        srcY = it.overlapPx;
        srcH = it.height - it.overlapPx;
      }

      ctx.drawImage(it.img, srcX, srcY, srcW, srcH, 0, drawY, width, srcH);
      currentY += srcH;
    }
  } else {
    let currentX = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const srcY = edgeTrimPx;
      const srcH = it.height - edgeTrimPx * 2;

      let drawX = currentX;
      let srcX = 0;
      let srcW = it.width;

      if (i > 0) {
        srcX = it.overlapPx;
        srcW = it.width - it.overlapPx;
      }

      ctx.drawImage(it.img, srcX, srcY, srcW, srcH, drawX, 0, srcW, height);
      currentX += srcW;
    }
  }

  return canvas;
}
