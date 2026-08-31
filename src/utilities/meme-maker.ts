/** Meme & Caption Maker rendering utilities. */
export interface MemeTextBox {
  id: string; text: string; xPercent: number; yPercent: number; fontSize: number; fontFamily: string;
  color: string; strokeColor: string; strokeWidth: number; isUppercase: boolean;
  alignment: 'left' | 'center' | 'right'; rotationDeg: number;
  autoFit?: boolean; maxWidthPercent?: number; backgroundColor?: string; padding?: number;
}
export type MemePreset = 'top-bottom' | 'top-caption' | 'bottom-caption' | 'center-quote' | 'blank-white-header';
export interface MemeLayoutConfig { preset: MemePreset; aspectRatio: 'original' | '1:1' | '4:5' | '16:9'; backgroundColor: string; headerPaddingTop: number }
export const MEME_FONTS = [
  { id: 'Impact, sans-serif', name: 'Impact (Classic Meme)' }, { id: 'Arial Black, sans-serif', name: 'Arial Black (Bold)' },
  { id: 'system-ui, -apple-system, sans-serif', name: 'Modern Sans' }, { id: 'Georgia, serif', name: 'Georgia (Quote)' },
  { id: 'Courier New, monospace', name: 'Monospace' },
];

export function getPresetTextBoxes(preset: MemePreset): MemeTextBox[] {
  const common = { autoFit: true, maxWidthPercent: 92 };
  switch (preset) {
    case 'top-bottom': return [
      { ...common, id: 'text-top', text: 'TOP TEXT', xPercent: 50, yPercent: 10, fontSize: 54, fontFamily: 'Impact, sans-serif', color: '#ffffff', strokeColor: '#000000', strokeWidth: 6, isUppercase: true, alignment: 'center', rotationDeg: 0 },
      { ...common, id: 'text-bottom', text: 'BOTTOM TEXT', xPercent: 50, yPercent: 88, fontSize: 54, fontFamily: 'Impact, sans-serif', color: '#ffffff', strokeColor: '#000000', strokeWidth: 6, isUppercase: true, alignment: 'center', rotationDeg: 0 },
    ];
    case 'top-caption': return [{ ...common, id: 'text-top-only', text: 'WHEN YOU FINALLY FIX THE BUG', xPercent: 50, yPercent: 11, fontSize: 48, fontFamily: 'Impact, sans-serif', color: '#ffffff', strokeColor: '#000000', strokeWidth: 5, isUppercase: true, alignment: 'center', rotationDeg: 0 }];
    case 'bottom-caption': return [{ ...common, id: 'text-bottom-only', text: 'NOBODY WARNED ME ABOUT THIS', xPercent: 50, yPercent: 88, fontSize: 48, fontFamily: 'Impact, sans-serif', color: '#ffffff', strokeColor: '#000000', strokeWidth: 5, isUppercase: true, alignment: 'center', rotationDeg: 0 }];
    case 'center-quote': return [{ ...common, id: 'text-quote', text: '"Simplicity is prerequisite for reliability."', xPercent: 50, yPercent: 50, fontSize: 40, fontFamily: 'Georgia, serif', color: '#ffffff', strokeColor: '#000000', strokeWidth: 4, isUppercase: false, alignment: 'center', rotationDeg: 0, backgroundColor: 'rgba(0,0,0,0.35)', padding: 12 }];
    case 'blank-white-header': return [{ ...common, id: 'text-white-banner', text: 'Me writing unit tests at 2 AM', xPercent: 50, yPercent: 8, fontSize: 34, fontFamily: 'Arial Black, sans-serif', color: '#0f172a', strokeColor: 'transparent', strokeWidth: 0, isUppercase: false, alignment: 'center', rotationDeg: 0 }];
  }
}

export function wrapMemeText(text: string, maxWidth: number, measure: (value: string) => number): string[] {
  const safeWidth = Math.max(1, maxWidth), output: string[] = [];
  const splitOversizedWord = (word: string): string[] => {
    if (measure(word) <= safeWidth) return [word];
    const parts: string[] = []; let current = '';
    for (const char of Array.from(word)) { const candidate = current + char; if (current && measure(candidate) > safeWidth) { parts.push(current); current = char; } else current = candidate; }
    if (current) parts.push(current); return parts;
  };
  for (const paragraph of text.split('\n')) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { output.push(''); continue; }
    let line = '';
    for (const rawWord of words) for (const word of splitOversizedWord(rawWord)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate) > safeWidth) { output.push(line); line = word; } else line = candidate;
    }
    if (line) output.push(line);
  }
  return output.length ? output : [''];
}

export interface MemeTextLayout { fontSize: number; lines: string[]; lineHeight: number; totalHeight: number }
export function fitMemeTextLayout(
  text: string,
  requestedFontSize: number,
  maxWidth: number,
  maxHeight: number,
  setFont: (fontSize: number) => void,
  measure: (value: string) => number
): MemeTextLayout {
  let fontSize = Math.max(10, Math.min(160, requestedFontSize));
  let lines: string[] = [];
  for (; fontSize >= 10; fontSize -= 2) {
    setFont(fontSize);
    lines = wrapMemeText(text, maxWidth, measure);
    const lineHeight = fontSize * 1.12;
    if (lines.length * lineHeight <= maxHeight && lines.every((line) => measure(line) <= maxWidth + 0.5)) return { fontSize, lines, lineHeight, totalHeight: lines.length * lineHeight };
  }
  setFont(10); lines = wrapMemeText(text, maxWidth, measure);
  return { fontSize: 10, lines, lineHeight: 11.2, totalHeight: lines.length * 11.2 };
}

function drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const sourceW = image.naturalWidth || image.width, sourceH = image.naturalHeight || image.height;
  if (sourceW <= 0 || sourceH <= 0 || width <= 0 || height <= 0) return;
  const scale = Math.max(width / sourceW, height / sourceH), drawW = sourceW * scale, drawH = sourceH * scale;
  ctx.drawImage(image, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
}

export function renderMemeCanvas(sourceImage: HTMLImageElement | null, textBoxes: MemeTextBox[], config: MemeLayoutConfig, baseWidth = 800): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const imgW = sourceImage ? sourceImage.naturalWidth || sourceImage.width : 800, imgH = sourceImage ? sourceImage.naturalHeight || sourceImage.height : 600;
  const canvasW = Math.max(240, Math.round(baseWidth));
  const headerPadding = config.preset === 'blank-white-header' ? Math.max(0, Math.round(config.headerPaddingTop || 110)) : 0;
  let canvasH = Math.round(imgH * (canvasW / Math.max(1, imgW))) + headerPadding;
  if (config.aspectRatio === '1:1') canvasH = canvasW; else if (config.aspectRatio === '4:5') canvasH = Math.round(canvasW * 1.25); else if (config.aspectRatio === '16:9') canvasH = Math.round(canvasW * 9 / 16);
  canvas.width = canvasW; canvas.height = Math.max(180, canvasH);
  const ctx = canvas.getContext('2d'); if (!ctx) return canvas;
  ctx.fillStyle = config.backgroundColor || '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (sourceImage) { const y = Math.min(headerPadding, canvas.height); drawImageCover(ctx, sourceImage, 0, y, canvas.width, Math.max(0, canvas.height - y)); }

  for (const box of textBoxes) {
    if (!box.text.trim()) continue;
    const text = box.isUppercase ? box.text.toLocaleUpperCase() : box.text;
    const posX = canvas.width * Math.max(2, Math.min(98, box.xPercent)) / 100;
    const posY = canvas.height * Math.max(2, Math.min(98, box.yPercent)) / 100;
    const maxWidth = canvas.width * Math.max(20, Math.min(98, box.maxWidthPercent ?? 92)) / 100;
    // Keep each layer in a bounded vertical region so long captions cannot silently clip off-canvas.
    const maxHeight = Math.max(44, Math.min(canvas.height * 0.48, 2 * Math.min(posY, canvas.height - posY) + canvas.height * 0.08));
    ctx.save(); ctx.translate(posX, posY); if (box.rotationDeg) ctx.rotate(box.rotationDeg * Math.PI / 180);
    const setFont = (size: number) => { ctx.font = `bold ${size}px ${box.fontFamily}`; };
    setFont(box.fontSize);
    const layout = box.autoFit === false
      ? (() => { const lines = wrapMemeText(text, maxWidth, (value) => ctx.measureText(value).width); const lineHeight = box.fontSize * 1.12; return { fontSize: box.fontSize, lines, lineHeight, totalHeight: lines.length * lineHeight }; })()
      : fitMemeTextLayout(text, box.fontSize, maxWidth, maxHeight, setFont, (value) => ctx.measureText(value).width);
    setFont(layout.fontSize); ctx.textAlign = box.alignment; ctx.textBaseline = 'middle'; ctx.fillStyle = box.color; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    const startY = -layout.totalHeight / 2 + layout.lineHeight / 2;
    if (box.backgroundColor) {
      const pad = Math.max(0, box.padding ?? 8), rectW = maxWidth + pad * 2, rectH = layout.totalHeight + pad * 2;
      ctx.fillStyle = box.backgroundColor; ctx.fillRect(-rectW / 2, -rectH / 2, rectW, rectH); ctx.fillStyle = box.color;
    }
    layout.lines.forEach((line, index) => {
      const y = startY + index * layout.lineHeight;
      if (box.strokeWidth > 0 && box.strokeColor !== 'transparent') { ctx.strokeStyle = box.strokeColor; ctx.lineWidth = box.strokeWidth; ctx.strokeText(line, 0, y, maxWidth); }
      ctx.fillText(line, 0, y, maxWidth);
    });
    ctx.restore();
  }
  return canvas;
}
