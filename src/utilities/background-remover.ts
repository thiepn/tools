/**
 * Client-Side Background Remover Utility
 * User image content is processed locally. The optional ML runtime/model is lazy-loaded.
 */

export interface SegmentationResult {
  segmentedBlob: Blob;
  segmentedDataUrl: string;
  width: number;
  height: number;
  maskCanvas: HTMLCanvasElement;
}

export type BackgroundStyle = 'transparent' | 'white' | 'black' | 'custom-color' | 'custom-image';

export interface BgRemoverOptions {
  backgroundStyle: BackgroundStyle;
  customColor: string;
  customImage?: HTMLImageElement | null;
  smoothing: number; // 0 to 10
  feather: number; // 0 to 10
  quality: number; // 0.1 to 1.0
  format: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function colorDistance(r: number, g: number, b: number, target: RgbColor): number {
  return Math.hypot(r - target.r, g - target.g, b - target.b);
}

/**
 * Samples small corner blocks instead of one pixel per corner, making the
 * fallback less sensitive to JPEG noise and isolated edge pixels.
 */
export function estimateCornerBackgroundColor(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  radius = 2
): RgbColor {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    return { r: 255, g: 255, b: 255 };
  }

  const anchors = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (const [anchorX, anchorY] of anchors) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = Math.max(0, Math.min(width - 1, anchorX + dx));
        const y = Math.max(0, Math.min(height - 1, anchorY + dy));
        const index = (y * width + x) * 4;
        r += rgba[index];
        g += rgba[index + 1];
        b += rgba[index + 2];
        count++;
      }
    }
  }

  return {
    r: r / Math.max(1, count),
    g: g / Math.max(1, count),
    b: b / Math.max(1, count),
  };
}

/**
 * Builds a background mask using edge-connected flood fill. A foreground pixel
 * that happens to share the background color is retained unless it is actually
 * connected to a matching image border. This prevents the old fallback from
 * punching transparent holes through clothing, logos, paper, etc.
 */
export function buildConnectedBackgroundMask(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance = 45,
  background = estimateCornerBackgroundColor(rgba, width, height)
): Uint8Array {
  const pixelCount = Math.max(0, width * height);
  const mask = new Uint8Array(pixelCount);
  if (pixelCount === 0 || rgba.length < pixelCount * 4) return mask;

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const matchesBackground = (pixelIndex: number) => {
    const dataIndex = pixelIndex * 4;
    return colorDistance(
      rgba[dataIndex],
      rgba[dataIndex + 1],
      rgba[dataIndex + 2],
      background
    ) <= tolerance;
  };

  const enqueueSeed = (pixelIndex: number) => {
    if (visited[pixelIndex]) return;
    visited[pixelIndex] = 1;
    if (!matchesBackground(pixelIndex)) return;
    mask[pixelIndex] = 1;
    queue[tail++] = pixelIndex;
  };

  for (let x = 0; x < width; x++) {
    enqueueSeed(x);
    if (height > 1) enqueueSeed((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueueSeed(y * width);
    if (width > 1) enqueueSeed(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < width ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y + 1 < height ? index + width : -1,
    ];

    for (const neighbor of neighbors) {
      if (neighbor < 0 || visited[neighbor]) continue;
      visited[neighbor] = 1;
      if (!matchesBackground(neighbor)) continue;
      mask[neighbor] = 1;
      queue[tail++] = neighbor;
    }
  }

  return mask;
}

export async function removeBackgroundLocal(
  imageBlob: Blob,
  onProgress?: (stage: string, percent: number) => void
): Promise<Blob> {
  onProgress?.('Loading local ML model...', 20);

  try {
    const { removeBackground } = await import('@imgly/background-removal');
    onProgress?.('Segmenting foreground with local neural network...', 50);

    const resultBlob = await removeBackground(imageBlob, {
      progress: (_key: string, current: number, total: number) => {
        if (total > 0) {
          const pct = Math.min(95, Math.round(50 + (current / total) * 45));
          onProgress?.(`Processing image (${pct}%)...`, pct);
        }
      },
      output: {
        format: 'image/png',
        quality: 0.95,
      },
    });

    onProgress?.('Refining edges...', 98);
    return resultBlob;
  } catch (mlErr) {
    console.warn('ML background removal encountered error, falling back to connected canvas segmenter:', mlErr);
    onProgress?.('Applying connected client-side background segmenter...', 60);
    return removeBackgroundCanvasFallback(imageBlob, onProgress);
  }
}

/** High-speed fallback segmenter for simple/flat backgrounds. */
export async function removeBackgroundCanvasFallback(
  imageBlob: Blob,
  onProgress?: (stage: string, percent: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      onProgress?.('Analyzing edge-connected background...', 70);

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx || canvas.width === 0 || canvas.height === 0) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const background = estimateCornerBackgroundColor(data, canvas.width, canvas.height);
      const tolerance = 45;
      const mask = buildConnectedBackgroundMask(data, canvas.width, canvas.height, tolerance, background);

      onProgress?.('Generating connected transparency mask...', 85);

      for (let pixel = 0; pixel < mask.length; pixel++) {
        if (mask[pixel]) {
          data[pixel * 4 + 3] = 0;
          continue;
        }

        // Feather only foreground pixels touching the connected background edge.
        const x = pixel % canvas.width;
        const y = Math.floor(pixel / canvas.width);
        const touchesMask =
          (x > 0 && mask[pixel - 1]) ||
          (x + 1 < canvas.width && mask[pixel + 1]) ||
          (y > 0 && mask[pixel - canvas.width]) ||
          (y + 1 < canvas.height && mask[pixel + canvas.width]);
        if (!touchesMask) continue;

        const i = pixel * 4;
        const dist = colorDistance(data[i], data[i + 1], data[i + 2], background);
        if (dist < tolerance + 24) {
          const alphaFactor = Math.max(0.2, Math.min(1, (dist - tolerance) / 24));
          data[i + 3] = Math.round(data[i + 3] * alphaFactor);
        }
      }

      ctx.putImageData(imgData, 0, 0);
      onProgress?.('Done!', 100);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Blob generation failed'));
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for fallback segmentation'));
    };

    img.src = url;
  });
}

export function compositeSegmentedImage(
  foregroundImg: HTMLImageElement,
  options: BgRemoverOptions,
  destCanvas: HTMLCanvasElement
): void {
  destCanvas.width = foregroundImg.naturalWidth;
  destCanvas.height = foregroundImg.naturalHeight;
  const ctx = destCanvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, destCanvas.width, destCanvas.height);

  if (options.backgroundStyle === 'white') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, destCanvas.width, destCanvas.height);
  } else if (options.backgroundStyle === 'black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, destCanvas.width, destCanvas.height);
  } else if (options.backgroundStyle === 'custom-color') {
    ctx.fillStyle = options.customColor || '#3B82F6';
    ctx.fillRect(0, 0, destCanvas.width, destCanvas.height);
  } else if (options.backgroundStyle === 'custom-image' && options.customImage) {
    ctx.drawImage(options.customImage, 0, 0, destCanvas.width, destCanvas.height);
  }

  ctx.drawImage(foregroundImg, 0, 0);
}
