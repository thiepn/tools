/**
 * Screenshot Stitcher Utility
 * Vertical/horizontal overlap estimation and aspect-preserving canvas rendering.
 */

export interface StitchItem {
  id: string;
  file: File;
  img: HTMLImageElement;
  width: number;
  height: number;
  overlapPx: number; // overlap with previous image
}

export type StitchDirection = 'vertical' | 'horizontal';

function getSourceDimensions(source: HTMLCanvasElement | HTMLImageElement): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
  }
  return { width: source.width, height: source.height };
}

function estimateOverlap(
  first: HTMLCanvasElement | HTMLImageElement,
  second: HTMLCanvasElement | HTMLImageElement,
  direction: StitchDirection,
  maxSearchPx = 300
): number {
  try {
    const firstSize = getSourceDimensions(first);
    const secondSize = getSourceDimensions(second);
    const searchDepth = Math.min(
      maxSearchPx,
      (direction === 'vertical' ? firstSize.height : firstSize.width) - 10,
      (direction === 'vertical' ? secondSize.height : secondSize.width) - 10
    );
    if (searchDepth <= 10) return 0;

    const crossSize = Math.min(
      direction === 'vertical' ? firstSize.width : firstSize.height,
      direction === 'vertical' ? secondSize.width : secondSize.height,
      300
    );
    if (crossSize <= 0) return 0;

    const canvasA = document.createElement('canvas');
    const canvasB = document.createElement('canvas');
    if (direction === 'vertical') {
      canvasA.width = canvasB.width = crossSize;
      canvasA.height = canvasB.height = searchDepth;
    } else {
      canvasA.width = canvasB.width = searchDepth;
      canvasA.height = canvasB.height = crossSize;
    }

    const ctxA = canvasA.getContext('2d', { willReadFrequently: true });
    const ctxB = canvasB.getContext('2d', { willReadFrequently: true });
    if (!ctxA || !ctxB) return 0;

    if (direction === 'vertical') {
      ctxA.drawImage(
        first,
        0,
        firstSize.height - searchDepth,
        crossSize,
        searchDepth,
        0,
        0,
        crossSize,
        searchDepth
      );
      ctxB.drawImage(second, 0, 0, crossSize, searchDepth, 0, 0, crossSize, searchDepth);
    } else {
      ctxA.drawImage(
        first,
        firstSize.width - searchDepth,
        0,
        searchDepth,
        crossSize,
        0,
        0,
        searchDepth,
        crossSize
      );
      ctxB.drawImage(second, 0, 0, searchDepth, crossSize, 0, 0, searchDepth, crossSize);
    }

    const dataA = ctxA.getImageData(0, 0, canvasA.width, canvasA.height).data;
    const dataB = ctxB.getImageData(0, 0, canvasB.width, canvasB.height).data;
    let bestOverlap = 0;
    let minDiff = Infinity;

    for (let candidate = 10; candidate < searchDepth; candidate += 2) {
      let diff = 0;
      let count = 0;

      if (direction === 'vertical') {
        for (let y = 0; y < candidate; y += 2) {
          const rowA = (searchDepth - candidate + y) * crossSize * 4;
          const rowB = y * crossSize * 4;
          for (let x = 0; x < crossSize; x += 4) {
            const idxA = rowA + x * 4;
            const idxB = rowB + x * 4;
            diff +=
              Math.abs(dataA[idxA] - dataB[idxB]) +
              Math.abs(dataA[idxA + 1] - dataB[idxB + 1]) +
              Math.abs(dataA[idxA + 2] - dataB[idxB + 2]);
            count++;
          }
        }
      } else {
        for (let x = 0; x < candidate; x += 2) {
          const sourceX = searchDepth - candidate + x;
          for (let y = 0; y < crossSize; y += 4) {
            const idxA = (y * searchDepth + sourceX) * 4;
            const idxB = (y * searchDepth + x) * 4;
            diff +=
              Math.abs(dataA[idxA] - dataB[idxB]) +
              Math.abs(dataA[idxA + 1] - dataB[idxB + 1]) +
              Math.abs(dataA[idxA + 2] - dataB[idxB + 2]);
            count++;
          }
        }
      }

      const avgDiff = diff / Math.max(1, count);
      if (avgDiff < minDiff) {
        minDiff = avgDiff;
        bestOverlap = candidate;
      }
    }

    return minDiff < 45 ? bestOverlap : 0;
  } catch {
    return 0;
  }
}

export function estimateVerticalOverlap(
  topCanvas: HTMLCanvasElement | HTMLImageElement,
  bottomCanvas: HTMLCanvasElement | HTMLImageElement,
  maxSearchPx = 300
): number {
  return estimateOverlap(topCanvas, bottomCanvas, 'vertical', maxSearchPx);
}

export function estimateHorizontalOverlap(
  leftCanvas: HTMLCanvasElement | HTMLImageElement,
  rightCanvas: HTMLCanvasElement | HTMLImageElement,
  maxSearchPx = 300
): number {
  return estimateOverlap(leftCanvas, rightCanvas, 'horizontal', maxSearchPx);
}

export function estimateStitchOverlap(
  first: HTMLCanvasElement | HTMLImageElement,
  second: HTMLCanvasElement | HTMLImageElement,
  direction: StitchDirection,
  maxSearchPx = 300
): number {
  return estimateOverlap(first, second, direction, maxSearchPx);
}

export function calculateStitchDimensions(
  items: StitchItem[],
  direction: StitchDirection,
  edgeTrimPx = 0
): { width: number; height: number } {
  if (items.length === 0) return { width: 0, height: 0 };
  const trim = Math.max(0, edgeTrimPx);

  if (direction === 'vertical') {
    const maxWidth = Math.max(...items.map((item) => Math.max(1, item.width - trim * 2)));
    let totalHeight = items[0].height;
    for (let i = 1; i < items.length; i++) {
      const overlap = Math.min(Math.max(0, items[i].overlapPx), Math.max(0, items[i].height - 1));
      totalHeight += Math.max(1, items[i].height - overlap);
    }
    return { width: Math.max(1, maxWidth), height: Math.max(1, totalHeight) };
  }

  const maxHeight = Math.max(...items.map((item) => Math.max(1, item.height - trim * 2)));
  let totalWidth = items[0].width;
  for (let i = 1; i < items.length; i++) {
    const overlap = Math.min(Math.max(0, items[i].overlapPx), Math.max(0, items[i].width - 1));
    totalWidth += Math.max(1, items[i].width - overlap);
  }
  return { width: Math.max(1, totalWidth), height: Math.max(1, maxHeight) };
}

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
  const trim = Math.max(0, edgeTrimPx);

  if (direction === 'vertical') {
    let currentY = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const srcX = Math.min(trim, Math.max(0, Math.floor((item.width - 1) / 2)));
      const srcW = Math.max(1, item.width - srcX * 2);
      const overlap = i === 0 ? 0 : Math.min(Math.max(0, item.overlapPx), Math.max(0, item.height - 1));
      const srcY = overlap;
      const srcH = Math.max(1, item.height - overlap);
      const drawX = Math.round((width - srcW) / 2);

      // Preserve the screenshot's own pixel aspect ratio instead of stretching
      // narrower images to the width of the widest item.
      ctx.drawImage(item.img, srcX, srcY, srcW, srcH, drawX, currentY, srcW, srcH);
      currentY += srcH;
    }
  } else {
    let currentX = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const srcY = Math.min(trim, Math.max(0, Math.floor((item.height - 1) / 2)));
      const srcH = Math.max(1, item.height - srcY * 2);
      const overlap = i === 0 ? 0 : Math.min(Math.max(0, item.overlapPx), Math.max(0, item.width - 1));
      const srcX = overlap;
      const srcW = Math.max(1, item.width - overlap);
      const drawY = Math.round((height - srcH) / 2);

      ctx.drawImage(item.img, srcX, srcY, srcW, srcH, currentX, drawY, srcW, srcH);
      currentX += srcW;
    }
  }

  return canvas;
}
