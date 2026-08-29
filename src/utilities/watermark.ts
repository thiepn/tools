/**
 * Watermark Processing Utilities
 * Supports text, logo, presets, tiled patterns, and batch rendering
 */

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'custom'
  | 'tiled';

export interface WatermarkConfig {
  type: 'text' | 'logo';
  text: string;
  fontFamily: string;
  fontSizeRatio: number; // percentage of image height (e.g. 0.05 = 5%)
  fontWeight: 'normal' | 'bold' | '900';
  color: string;
  opacity: number; // 0..1
  rotationDeg: number; // -180..180
  position: WatermarkPosition;
  customXPercent: number; // 0..100
  customYPercent: number; // 0..100
  paddingPx: number;
  tileSpacingPx: number;
  logoDataUrl?: string;
  logoScaleRatio: number; // percentage of image width/height (0.1..0.8)
}

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  type: 'text',
  text: 'CONFIDENTIAL',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSizeRatio: 0.05,
  fontWeight: 'bold',
  color: '#ffffff',
  opacity: 0.7,
  rotationDeg: 0,
  position: 'bottom-right',
  customXPercent: 50,
  customYPercent: 50,
  paddingPx: 24,
  tileSpacingPx: 120,
  logoScaleRatio: 0.2,
};

/**
 * Calculates absolute (x, y) coordinates on a canvas based on position preset
 */
export function calculateWatermarkCoordinates(
  canvasWidth: number,
  canvasHeight: number,
  elementWidth: number,
  elementHeight: number,
  position: WatermarkPosition,
  padding: number,
  customXPercent = 50,
  customYPercent = 50
): { x: number; y: number } {
  switch (position) {
    case 'top-left':
      return { x: padding, y: padding };
    case 'top-center':
      return { x: (canvasWidth - elementWidth) / 2, y: padding };
    case 'top-right':
      return { x: canvasWidth - elementWidth - padding, y: padding };
    case 'center-left':
      return { x: padding, y: (canvasHeight - elementHeight) / 2 };
    case 'center':
      return { x: (canvasWidth - elementWidth) / 2, y: (canvasHeight - elementHeight) / 2 };
    case 'center-right':
      return { x: canvasWidth - elementWidth - padding, y: (canvasHeight - elementHeight) / 2 };
    case 'bottom-left':
      return { x: padding, y: canvasHeight - elementHeight - padding };
    case 'bottom-center':
      return { x: (canvasWidth - elementWidth) / 2, y: canvasHeight - elementHeight - padding };
    case 'bottom-right':
      return { x: canvasWidth - elementWidth - padding, y: canvasHeight - elementHeight - padding };
    case 'custom':
      return {
        x: (canvasWidth * customXPercent) / 100 - elementWidth / 2,
        y: (canvasHeight * customYPercent) / 100 - elementHeight / 2,
      };
    default:
      return { x: padding, y: padding };
  }
}

/**
 * Renders watermark onto an Image element and returns a Canvas
 */
export async function applyWatermarkToImage(
  imageSource: HTMLImageElement | ImageBitmap,
  config: WatermarkConfig,
  logoImg?: HTMLImageElement | null
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const width = imageSource.width;
  const height = imageSource.height;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain canvas 2D rendering context.');

  // 1. Draw base image
  ctx.drawImage(imageSource, 0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, config.opacity));

  if (config.position === 'tiled') {
    // Tiled repeat mode across the entire canvas
    const fontSize = Math.max(14, Math.round(height * config.fontSizeRatio));
    ctx.font = `${config.fontWeight} ${fontSize}px ${config.fontFamily}`;
    ctx.fillStyle = config.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const spacing = Math.max(60, config.tileSpacingPx);
    const rad = (config.rotationDeg * Math.PI) / 180;

    for (let y = -height; y < height * 2; y += spacing) {
      for (let x = -width; x < width * 2; x += spacing * 1.5) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rad);
        if (config.type === 'text') {
          ctx.fillText(config.text, 0, 0);
        } else if (config.type === 'logo' && logoImg) {
          const logoW = Math.max(20, width * config.logoScaleRatio);
          const logoH = (logoW / logoImg.width) * logoImg.height;
          ctx.drawImage(logoImg, -logoW / 2, -logoH / 2, logoW, logoH);
        }
        ctx.restore();
      }
    }
  } else if (config.type === 'text') {
    const fontSize = Math.max(14, Math.round(height * config.fontSizeRatio));
    ctx.font = `${config.fontWeight} ${fontSize}px ${config.fontFamily}`;
    const metrics = ctx.measureText(config.text);
    const textW = metrics.width;
    const textH = fontSize;

    const coords = calculateWatermarkCoordinates(
      width,
      height,
      textW,
      textH,
      config.position,
      config.paddingPx,
      config.customXPercent,
      config.customYPercent
    );

    const centerX = coords.x + textW / 2;
    const centerY = coords.y + textH / 2;

    ctx.translate(centerX, centerY);
    ctx.rotate((config.rotationDeg * Math.PI) / 180);
    ctx.fillStyle = config.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.text, 0, 0);
  } else if (config.type === 'logo' && logoImg) {
    const logoW = Math.max(20, width * config.logoScaleRatio);
    const logoH = (logoW / logoImg.width) * logoImg.height;

    const coords = calculateWatermarkCoordinates(
      width,
      height,
      logoW,
      logoH,
      config.position,
      config.paddingPx,
      config.customXPercent,
      config.customYPercent
    );

    const centerX = coords.x + logoW / 2;
    const centerY = coords.y + logoH / 2;

    ctx.translate(centerX, centerY);
    ctx.rotate((config.rotationDeg * Math.PI) / 180);
    ctx.drawImage(logoImg, -logoW / 2, -logoH / 2, logoW, logoH);
  }

  ctx.restore();
  return canvas;
}
