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
  headerPaddingTop: number;
}

export const MEME_FONTS = [
  { id: 'Impact, sans-serif', name: 'Impact (Classic Meme)' },
  { id: 'Arial Black, sans-serif', name: 'Arial Black (Bold)' },
  { id: 'system-ui, -apple-system, sans-serif', name: 'Modern Sans' },
  { id: 'Georgia, serif', name: 'Georgia (Quote)' },
  { id: 'Courier New, monospace', name: 'Monospace' },
];

export function getPresetTextBoxes(preset: MemePreset): MemeTextBox[] {
  switch (preset) {
    case 'top-bottom':
      return [
        {
          id: 'text-top', text: 'TOP TEXT', xPercent: 50, yPercent: 8,
          fontSize: 48, fontFamily: 'Impact, sans-serif', color: '#ffffff',
          strokeColor: '#000000', strokeWidth: 6, isUppercase: true,
          alignment: 'center', rotationDeg: 0,
        },
        {
          id: 'text-bottom', text: 'BOTTOM TEXT', xPercent: 50, yPercent: 88,
          fontSize: 48, fontFamily: 'Impact, sans-serif', color: '#ffffff',
          strokeColor: '#000000', strokeWidth: 6, isUppercase: true,
          alignment: 'center', rotationDeg: 0,
        },
      ];
    case 'top-caption':
      return [{
        id: 'text-top-only', text: 'WHEN YOU FINALLY FIX THE BUG', xPercent: 50, yPercent: 10,
        fontSize: 44, fontFamily: 'Impact, sans-serif', color: '#ffffff', strokeColor: '#000000',
        strokeWidth: 5, isUppercase: true, alignment: 'center', rotationDeg: 0,
      }];
    case 'bottom-caption':
      return [{
        id: 'text-bottom-only', text: 'NOBODY WARNED ME ABOUT THIS', xPercent: 50, yPercent: 88,
        fontSize: 44, fontFamily: 'Impact, sans-serif', color: '#ffffff', strokeColor: '#000000',
        strokeWidth: 5, isUppercase: true, alignment: 'center', rotationDeg: 0,
      }];
    case 'center-quote':
      return [{
        id: 'text-quote', text: '"Simplicity is prerequisite for reliability."', xPercent: 50, yPercent: 50,
        fontSize: 36, fontFamily: 'Georgia, serif', color: '#ffffff', strokeColor: '#000000',
        strokeWidth: 4, isUppercase: false, alignment: 'center', rotationDeg: 0,
      }];
    case 'blank-white-header':
      return [{
        id: 'text-white-banner', text: 'Me writing unit tests at 2 AM', xPercent: 50, yPercent: 5,
        fontSize: 32, fontFamily: 'Arial Black, sans-serif', color: '#0f172a', strokeColor: 'transparent',
        strokeWidth: 0, isUppercase: false, alignment: 'center', rotationDeg: 0,
      }];
  }
}

/**
 * Width-aware text wrapper with explicit-newline preservation. `measure` is
 * injected so this logic can be unit-tested without a browser canvas.
 */
export function wrapMemeText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number
): string[] {
  const safeWidth = Math.max(1, maxWidth);
  const output: string[] = [];

  const splitOversizedWord = (word: string): string[] => {
    if (measure(word) <= safeWidth) return [word];
    const parts: string[] = [];
    let current = '';
    for (const char of Array.from(word)) {
      const candidate = current + char;
      if (current && measure(candidate) > safeWidth) {
        parts.push(current);
        current = char;
      } else {
        current = candidate;
      }
    }
    if (current) parts.push(current);
    return parts;
  };

  for (const paragraph of text.split('\n')) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      output.push('');
      continue;
    }

    let line = '';
    for (const rawWord of words) {
      for (const word of splitOversizedWord(rawWord)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && measure(candidate) > safeWidth) {
          output.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
    }
    if (line) output.push(line);
  }

  return output.length ? output : [''];
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const sourceW = image.naturalWidth || image.width;
  const sourceH = image.naturalHeight || image.height;
  if (sourceW <= 0 || sourceH <= 0 || width <= 0 || height <= 0) return;

  const scale = Math.max(width / sourceW, height / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const drawX = x + (width - drawW) / 2;
  const drawY = y + (height - drawH) / 2;
  ctx.drawImage(image, drawX, drawY, drawW, drawH);
}

export function renderMemeCanvas(
  sourceImage: HTMLImageElement | null,
  textBoxes: MemeTextBox[],
  config: MemeLayoutConfig,
  baseWidth = 800
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const imgW = sourceImage ? sourceImage.naturalWidth || sourceImage.width : 800;
  const imgH = sourceImage ? sourceImage.naturalHeight || sourceImage.height : 600;
  const safeBaseWidth = Math.max(1, Math.round(baseWidth));
  const targetImgH = Math.round(imgH * (safeBaseWidth / Math.max(1, imgW)));
  const headerPadding = config.preset === 'blank-white-header'
    ? Math.max(0, Math.round(config.headerPaddingTop || 100))
    : 0;

  let canvasW = safeBaseWidth;
  let canvasH = targetImgH + headerPadding;
  if (config.aspectRatio === '1:1') canvasH = canvasW;
  else if (config.aspectRatio === '4:5') canvasH = Math.round(canvasW * 1.25);
  else if (config.aspectRatio === '16:9') canvasH = Math.round((canvasW * 9) / 16);

  canvas.width = canvasW;
  canvas.height = Math.max(1, canvasH);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = config.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (sourceImage) {
    const imageAreaY = Math.min(headerPadding, canvasH);
    const imageAreaHeight = Math.max(0, canvasH - imageAreaY);
    drawImageCover(ctx, sourceImage, 0, imageAreaY, canvasW, imageAreaHeight);
  }

  for (const box of textBoxes) {
    if (!box.text.trim()) continue;

    const textToDraw = box.isUppercase ? box.text.toUpperCase() : box.text;
    const posX = (canvasW * box.xPercent) / 100;
    const posY = (canvasH * box.yPercent) / 100;

    ctx.save();
    ctx.translate(posX, posY);
    if (box.rotationDeg !== 0) ctx.rotate((box.rotationDeg * Math.PI) / 180);

    ctx.font = `bold ${box.fontSize}px ${box.fontFamily}`;
    ctx.textAlign = box.alignment;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = box.color;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    const leftSpace = Math.max(20, posX);
    const rightSpace = Math.max(20, canvasW - posX);
    const maxTextWidth = box.alignment === 'center'
      ? Math.max(40, Math.min(leftSpace, rightSpace) * 1.85)
      : box.alignment === 'left'
        ? Math.max(40, rightSpace * 0.92)
        : Math.max(40, leftSpace * 0.92);

    const lines = wrapMemeText(textToDraw, maxTextWidth, (value) => ctx.measureText(value).width);
    const lineHeight = box.fontSize * 1.15;
    const totalHeight = lines.length * lineHeight;
    const startY = -(totalHeight / 2) + lineHeight / 2;

    lines.forEach((line, idx) => {
      const lineY = startY + idx * lineHeight;
      if (box.strokeWidth > 0 && box.strokeColor !== 'transparent') {
        ctx.strokeStyle = box.strokeColor;
        ctx.lineWidth = box.strokeWidth;
        ctx.strokeText(line, 0, lineY, maxTextWidth);
      }
      ctx.fillText(line, 0, lineY, maxTextWidth);
    });

    ctx.restore();
  }

  return canvas;
}
