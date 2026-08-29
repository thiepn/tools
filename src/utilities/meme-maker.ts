/**
 * Meme & Caption Maker Utilities
 */

export interface MemeTextBox {
  id: string;
  text: string;
  xPercent: number; // 0..100
  yPercent: number; // 0..100
  fontSize: number; // 16..120
  fontFamily: string;
  color: string;
  strokeColor: string;
  strokeWidth: number; // 0..12
  isUppercase: boolean;
  alignment: 'left' | 'center' | 'right';
  rotationDeg: number;
}

export type MemePreset =
  | 'top-bottom'
  | 'top-caption'
  | 'bottom-caption'
  | 'center-quote'
  | 'blank-white-header';

export interface MemeLayoutConfig {
  preset: MemePreset;
  aspectRatio: 'original' | '1:1' | '4:5' | '16:9';
  backgroundColor: string;
  headerPaddingTop: number; // px for white banner top caption style
}

export const MEME_FONTS = [
  { id: 'Impact, sans-serif', name: 'Impact (Classic Meme)' },
  { id: 'Arial Black, sans-serif', name: 'Arial Black (Bold)' },
  { id: 'system-ui, -apple-system, sans-serif', name: 'Modern Sans' },
  { id: 'Georgia, serif', name: 'Georgia (Quote)' },
  { id: 'Courier New, monospace', name: 'Monospace' },
];

/**
 * Creates default text boxes for a given preset
 */
export function getPresetTextBoxes(preset: MemePreset): MemeTextBox[] {
  switch (preset) {
    case 'top-bottom':
      return [
        {
          id: 'text-top',
          text: 'TOP TEXT',
          xPercent: 50,
          yPercent: 8,
          fontSize: 48,
          fontFamily: 'Impact, sans-serif',
          color: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 6,
          isUppercase: true,
          alignment: 'center',
          rotationDeg: 0,
        },
        {
          id: 'text-bottom',
          text: 'BOTTOM TEXT',
          xPercent: 50,
          yPercent: 88,
          fontSize: 48,
          fontFamily: 'Impact, sans-serif',
          color: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 6,
          isUppercase: true,
          alignment: 'center',
          rotationDeg: 0,
        },
      ];
    case 'top-caption':
      return [
        {
          id: 'text-top-only',
          text: 'WHEN YOU FINALLY FIX THE BUG',
          xPercent: 50,
          yPercent: 10,
          fontSize: 44,
          fontFamily: 'Impact, sans-serif',
          color: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 5,
          isUppercase: true,
          alignment: 'center',
          rotationDeg: 0,
        },
      ];
    case 'bottom-caption':
      return [
        {
          id: 'text-bottom-only',
          text: 'NOBODY WARNED ME ABOUT THIS',
          xPercent: 50,
          yPercent: 88,
          fontSize: 44,
          fontFamily: 'Impact, sans-serif',
          color: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 5,
          isUppercase: true,
          alignment: 'center',
          rotationDeg: 0,
        },
      ];
    case 'center-quote':
      return [
        {
          id: 'text-quote',
          text: '"Simplicity is prerequisite for reliability."',
          xPercent: 50,
          yPercent: 50,
          fontSize: 36,
          fontFamily: 'Georgia, serif',
          color: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 4,
          isUppercase: false,
          alignment: 'center',
          rotationDeg: 0,
        },
      ];
    case 'blank-white-header':
      return [
        {
          id: 'text-white-banner',
          text: 'Me writing unit tests at 2 AM',
          xPercent: 50,
          yPercent: 5,
          fontSize: 32,
          fontFamily: 'Arial Black, sans-serif',
          color: '#0f172a',
          strokeColor: 'transparent',
          strokeWidth: 0,
          isUppercase: false,
          alignment: 'center',
          rotationDeg: 0,
        },
      ];
  }
}

/**
 * Renders meme onto canvas with multi-line text wrapping and stroke outlines
 */
export function renderMemeCanvas(
  sourceImage: HTMLImageElement | null,
  textBoxes: MemeTextBox[],
  config: MemeLayoutConfig,
  baseWidth = 800
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  let imgW = sourceImage ? sourceImage.width : 800;
  let imgH = sourceImage ? sourceImage.height : 600;

  // Scale target width to baseWidth
  const scale = baseWidth / imgW;
  const targetImgW = baseWidth;
  const targetImgH = Math.round(imgH * scale);

  let canvasW = targetImgW;
  let canvasH = targetImgH;

  const headerPadding = config.preset === 'blank-white-header' ? 100 : 0;
  canvasH += headerPadding;

  // Handle aspect ratios if specified
  if (config.aspectRatio === '1:1') {
    canvasH = canvasW;
  } else if (config.aspectRatio === '4:5') {
    canvasH = Math.round(canvasW * 1.25);
  } else if (config.aspectRatio === '16:9') {
    canvasH = Math.round((canvasW * 9) / 16);
  }

  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Draw background
  ctx.fillStyle = config.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 2. Draw Image
  if (sourceImage) {
    const imgDrawY = headerPadding;
    ctx.drawImage(sourceImage, 0, imgDrawY, targetImgW, targetImgH);
  }

  // 3. Render Text Boxes
  for (const box of textBoxes) {
    if (!box.text.trim()) continue;

    const textToDraw = box.isUppercase ? box.text.toUpperCase() : box.text;
    const posX = (canvasW * box.xPercent) / 100;
    const posY = (canvasH * box.yPercent) / 100;

    ctx.save();
    ctx.translate(posX, posY);
    if (box.rotationDeg !== 0) {
      ctx.rotate((box.rotationDeg * Math.PI) / 180);
    }

    ctx.font = `bold ${box.fontSize}px ${box.fontFamily}`;
    ctx.textAlign = box.alignment;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = box.color;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    // Multi-line wrap
    const lines = textToDraw.split('\n');
    const lineHeight = box.fontSize * 1.15;
    const totalHeight = lines.length * lineHeight;
    const startY = -(totalHeight / 2) + lineHeight / 2;

    lines.forEach((line, idx) => {
      const lineY = startY + idx * lineHeight;
      if (box.strokeWidth > 0 && box.strokeColor !== 'transparent') {
        ctx.strokeStyle = box.strokeColor;
        ctx.lineWidth = box.strokeWidth;
        ctx.strokeText(line, 0, lineY);
      }
      ctx.fillText(line, 0, lineY);
    });

    ctx.restore();
  }

  return canvas;
}
