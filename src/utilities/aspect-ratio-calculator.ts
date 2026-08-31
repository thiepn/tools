export interface RatioPreset { name: string; w: number; h: number; }
export const RATIO_PRESETS: RatioPreset[] = [
  { name: '1:1 Square', w: 1, h: 1 }, { name: '4:3 Standard Display', w: 4, h: 3 },
  { name: '3:2 Classic Photo / 35mm', w: 3, h: 2 }, { name: '16:9 Widescreen / HD', w: 16, h: 9 },
  { name: '16:10 Modern Laptop', w: 16, h: 10 }, { name: '18:9 Mobile Display', w: 18, h: 9 },
  { name: '21:9 Ultrawide Cinematic', w: 21, h: 9 }, { name: '9:16 Vertical / Stories', w: 9, h: 16 },
];

export function calculateGcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a)); let y = Math.abs(Math.trunc(b));
  while (y) { const t = y; y = x % y; x = t; }
  return x || 1;
}

function decimalPlaces(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = value.toString().toLowerCase();
  if (text.includes('e-')) return Math.min(6, Number(text.split('e-')[1]) || 0);
  return Math.min(6, (text.split('.')[1] || '').length);
}

/** Converts decimal dimensions to integers before reducing, so 1.5:1 becomes 3:2. */
export function simplifyRatio(width: number, height: number): {
  ratioW: number; ratioH: number; ratioString: string; decimal: number;
  orientation: 'Landscape' | 'Portrait' | 'Square'; gcd: number;
} {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { ratioW: 0, ratioH: 0, ratioString: 'Invalid dimensions', decimal: 0, orientation: 'Square', gcd: 1 };
  }
  const places = Math.max(decimalPlaces(width), decimalPlaces(height));
  const factor = 10 ** places;
  const integerW = Math.round(width * factor);
  const integerH = Math.round(height * factor);
  const gcd = calculateGcd(integerW, integerH);
  const ratioW = integerW / gcd;
  const ratioH = integerH / gcd;
  const orientation = width > height ? 'Landscape' : height > width ? 'Portrait' : 'Square';
  return { ratioW, ratioH, ratioString: `${ratioW}:${ratioH}`, decimal: Number((width / height).toFixed(4)), orientation, gcd };
}

export function calculateMissingDimension(ratioW: number, ratioH: number, knownValue: number, knownDimension: 'width' | 'height', roundToInteger = true): number | null {
  if (![ratioW, ratioH, knownValue].every(Number.isFinite) || ratioW <= 0 || ratioH <= 0 || knownValue <= 0) return null;
  const calculated = knownDimension === 'width' ? knownValue * (ratioH / ratioW) : knownValue * (ratioW / ratioH);
  return roundToInteger ? Math.round(calculated) : Number(calculated.toFixed(4));
}

export function scaleResolution(origW: number, origH: number, newW?: number, newH?: number, roundToInteger = true): { targetW: number; targetH: number; scaleFactor: number } | null {
  if (![origW, origH].every(Number.isFinite) || origW <= 0 || origH <= 0) return null;
  if (newW && Number.isFinite(newW) && newW > 0) {
    const scaleFactor = newW / origW; const height = origH * scaleFactor;
    return { targetW: newW, targetH: roundToInteger ? Math.round(height) : Number(height.toFixed(4)), scaleFactor: Number(scaleFactor.toFixed(6)) };
  }
  if (newH && Number.isFinite(newH) && newH > 0) {
    const scaleFactor = newH / origH; const width = origW * scaleFactor;
    return { targetW: roundToInteger ? Math.round(width) : Number(width.toFixed(4)), targetH: newH, scaleFactor: Number(scaleFactor.toFixed(6)) };
  }
  return null;
}

export interface FitCalculation {
  mode: 'contain' | 'cover';
  outputWidth: number;
  outputHeight: number;
  scale: number;
  overflowWidth: number;
  overflowHeight: number;
  cropPercentX: number;
  cropPercentY: number;
}

/** Calculates contain/cover scaling of one rectangle into another. */
export function calculateFit(sourceW: number, sourceH: number, boxW: number, boxH: number, mode: 'contain' | 'cover'): FitCalculation | null {
  if (![sourceW, sourceH, boxW, boxH].every(Number.isFinite) || sourceW <= 0 || sourceH <= 0 || boxW <= 0 || boxH <= 0) return null;
  const scale = mode === 'cover' ? Math.max(boxW / sourceW, boxH / sourceH) : Math.min(boxW / sourceW, boxH / sourceH);
  const outputWidth = sourceW * scale;
  const outputHeight = sourceH * scale;
  const overflowWidth = Math.max(0, outputWidth - boxW);
  const overflowHeight = Math.max(0, outputHeight - boxH);
  return {
    mode,
    outputWidth: Number(outputWidth.toFixed(4)), outputHeight: Number(outputHeight.toFixed(4)), scale: Number(scale.toFixed(6)),
    overflowWidth: Number(overflowWidth.toFixed(4)), overflowHeight: Number(overflowHeight.toFixed(4)),
    cropPercentX: outputWidth ? Number(((overflowWidth / outputWidth) * 100).toFixed(2)) : 0,
    cropPercentY: outputHeight ? Number(((overflowHeight / outputHeight) * 100).toFixed(2)) : 0,
  };
}
