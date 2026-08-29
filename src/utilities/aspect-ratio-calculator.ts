export interface RatioPreset {
  name: string;
  w: number;
  h: number;
}

export const RATIO_PRESETS: RatioPreset[] = [
  { name: '1:1 Square', w: 1, h: 1 },
  { name: '4:3 Standard Display', w: 4, h: 3 },
  { name: '3:2 Classic Photo / 35mm', w: 3, h: 2 },
  { name: '16:9 Widescreen / HD', w: 16, h: 9 },
  { name: '16:10 Modern Laptop', w: 16, h: 10 },
  { name: '18:9 Mobile Display', w: 18, h: 9 },
  { name: '21:9 Ultrawide Cinematic', w: 21, h: 9 },
  { name: '9:16 Vertical / Stories', w: 9, h: 16 },
];

export function calculateGcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function simplifyRatio(width: number, height: number): {
  ratioW: number;
  ratioH: number;
  ratioString: string;
  decimal: number;
  orientation: 'Landscape' | 'Portrait' | 'Square';
  gcd: number;
} {
  if (width <= 0 || height <= 0 || isNaN(width) || isNaN(height)) {
    return {
      ratioW: 0,
      ratioH: 0,
      ratioString: 'Invalid dimensions',
      decimal: 0,
      orientation: 'Square',
      gcd: 1,
    };
  }

  const gcd = calculateGcd(width, height);
  const ratioW = Math.round(width / gcd);
  const ratioH = Math.round(height / gcd);
  const decimal = Number((width / height).toFixed(4));

  let orientation: 'Landscape' | 'Portrait' | 'Square' = 'Square';
  if (width > height) orientation = 'Landscape';
  else if (height > width) orientation = 'Portrait';

  return {
    ratioW,
    ratioH,
    ratioString: `${ratioW}:${ratioH}`,
    decimal,
    orientation,
    gcd,
  };
}

export function calculateMissingDimension(
  ratioW: number,
  ratioH: number,
  knownValue: number,
  knownDimension: 'width' | 'height',
  roundToInteger = true
): number | null {
  if (ratioW <= 0 || ratioH <= 0 || knownValue <= 0) return null;

  let calculated: number;
  if (knownDimension === 'width') {
    // Known width, calculate height: height = width * (ratioH / ratioW)
    calculated = knownValue * (ratioH / ratioW);
  } else {
    // Known height, calculate width: width = height * (ratioW / ratioH)
    calculated = knownValue * (ratioW / ratioH);
  }

  return roundToInteger ? Math.round(calculated) : Number(calculated.toFixed(2));
}

export function scaleResolution(
  origW: number,
  origH: number,
  newW?: number,
  newH?: number,
  roundToInteger = true
): { targetW: number; targetH: number; scaleFactor: number } | null {
  if (origW <= 0 || origH <= 0) return null;

  if (newW && newW > 0) {
    const scaleFactor = newW / origW;
    const targetH = origH * scaleFactor;
    return {
      targetW: newW,
      targetH: roundToInteger ? Math.round(targetH) : Number(targetH.toFixed(2)),
      scaleFactor: Number(scaleFactor.toFixed(4)),
    };
  }

  if (newH && newH > 0) {
    const scaleFactor = newH / origH;
    const targetW = origW * scaleFactor;
    return {
      targetW: roundToInteger ? Math.round(targetW) : Number(targetW.toFixed(2)),
      targetH: newH,
      scaleFactor: Number(scaleFactor.toFixed(4)),
    };
  }

  return null;
}
