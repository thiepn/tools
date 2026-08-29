export interface ImageMetadata {
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  aspectRatio: string;
}

export interface ResizeOptions {
  width: number;
  height: number;
  lockAspectRatio: boolean;
  preventUpscale: boolean;
  scalePercent?: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export function calculateAspectRatio(width: number, height: number): string {
  if (!width || !height) return '1:1';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.round(width), Math.round(height));
  const wRatio = Math.round(width) / divisor;
  const hRatio = Math.round(height) / divisor;
  if (wRatio > 50 || hRatio > 50) {
    return `${(width / height).toFixed(2)}:1`;
  }
  return `${wRatio}:${hRatio}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const formatted = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2);
  return `${formatted} ${units[i]}`;
}

export function calculateTargetDimensions(
  origW: number,
  origH: number,
  reqW: number,
  reqH: number,
  lockAspect: boolean,
  preventUpscale: boolean
): { width: number; height: number } {
  let w = Math.max(1, Math.round(reqW));
  let h = Math.max(1, Math.round(reqH));

  if (lockAspect && origW > 0 && origH > 0) {
    const ratio = origW / origH;
    if (w !== origW) {
      h = Math.max(1, Math.round(w / ratio));
    } else if (h !== origH) {
      w = Math.max(1, Math.round(h * ratio));
    }
  }

  if (preventUpscale && (w > origW || h > origH)) {
    if (lockAspect && origW > 0 && origH > 0) {
      const scale = Math.min(origW / w, origH / h, 1);
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
    } else {
      w = Math.min(w, origW);
      h = Math.min(h, origH);
    }
  }

  return { width: w, height: h };
}

export function applyScalePreset(
  origW: number,
  origH: number,
  preset: '25%' | '50%' | '75%' | '1920max' | '1080max'
): { width: number; height: number } {
  if (!origW || !origH) return { width: 100, height: 100 };

  switch (preset) {
    case '25%':
      return {
        width: Math.max(1, Math.round(origW * 0.25)),
        height: Math.max(1, Math.round(origH * 0.25)),
      };
    case '50%':
      return {
        width: Math.max(1, Math.round(origW * 0.5)),
        height: Math.max(1, Math.round(origH * 0.5)),
      };
    case '75%':
      return {
        width: Math.max(1, Math.round(origW * 0.75)),
        height: Math.max(1, Math.round(origH * 0.75)),
      };
    case '1920max': {
      if (origW <= 1920 && origH <= 1920) return { width: origW, height: origH };
      const scale = Math.min(1920 / origW, 1920 / origH);
      return {
        width: Math.max(1, Math.round(origW * scale)),
        height: Math.max(1, Math.round(origH * scale)),
      };
    }
    case '1080max': {
      if (origW <= 1080 && origH <= 1080) return { width: origW, height: origH };
      const scale = Math.min(1080 / origW, 1080 / origH);
      return {
        width: Math.max(1, Math.round(origW * scale)),
        height: Math.max(1, Math.round(origH * scale)),
      };
    }
    default:
      return { width: origW, height: origH };
  }
}

export async function processImageCanvas(
  imageSource: HTMLImageElement | ImageBitmap,
  options: {
    targetWidth: number;
    targetHeight: number;
    rotationDeg: number; // 0, 90, 180, 270
    flipH: boolean;
    flipV: boolean;
    crop?: CropRect | null;
    format: OutputFormat;
    quality: number; // 0.1 to 1.0
  }
): Promise<{ blob: Blob; width: number; height: number; url: string }> {
  // 1. First canvas for crop + rotate + flip
  const sourceW = imageSource.width;
  const sourceH = imageSource.height;

  // Compute crop box
  const crop = options.crop || { x: 0, y: 0, width: sourceW, height: sourceH };
  const cropX = Math.max(0, Math.min(crop.x, sourceW));
  const cropY = Math.max(0, Math.min(crop.y, sourceH));
  const cropW = Math.max(1, Math.min(crop.width, sourceW - cropX));
  const cropH = Math.max(1, Math.min(crop.height, sourceH - cropY));

  // Determine rotated canvas dimensions
  const isRotated90or270 = Math.abs(options.rotationDeg % 180) === 90;
  const intermediateW = isRotated90or270 ? cropH : cropW;
  const intermediateH = isRotated90or270 ? cropW : cropH;

  const canvas1 = document.createElement('canvas');
  canvas1.width = intermediateW;
  canvas1.height = intermediateH;
  const ctx1 = canvas1.getContext('2d');
  if (!ctx1) throw new Error('Canvas 2D context is not available');

  ctx1.save();
  ctx1.translate(intermediateW / 2, intermediateH / 2);
  ctx1.rotate((options.rotationDeg * Math.PI) / 180);
  ctx1.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);

  // Draw the cropped portion centered
  ctx1.drawImage(
    imageSource,
    cropX,
    cropY,
    cropW,
    cropH,
    -cropW / 2,
    -cropH / 2,
    cropW,
    cropH
  );
  ctx1.restore();

  // 2. Second canvas for final resize scaling
  const finalW = options.targetWidth || intermediateW;
  const finalH = options.targetHeight || intermediateH;

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalW;
  finalCanvas.height = finalH;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) throw new Error('Final canvas 2D context is not available');

  // Smooth image scaling
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = 'high';

  // Fill white background for JPEG if format is image/jpeg to prevent black transparent areas
  if (options.format === 'image/jpeg') {
    finalCtx.fillStyle = '#FFFFFF';
    finalCtx.fillRect(0, 0, finalW, finalH);
  }

  finalCtx.drawImage(canvas1, 0, 0, intermediateW, intermediateH, 0, 0, finalW, finalH);

  // Convert to Blob
  const blob: Blob = await new Promise((resolve, reject) => {
    finalCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Image export failed'));
      },
      options.format,
      options.format === 'image/png' ? undefined : options.quality
    );
  });

  const url = URL.createObjectURL(blob);
  return {
    blob,
    width: finalW,
    height: finalH,
    url,
  };
}

export function generateOptimizedFilename(originalName: string, format: OutputFormat): string {
  const baseName = originalName.replace(/\.[^/.]+$/, '').trim() || 'image';
  const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
  return `${baseName}-optimized.${ext}`;
}
