/**
 * Color Palette Extraction & Harmony Utilities
 * Uses client-side median-cut color quantization and WCAG contrast algorithms
 */

export interface ExtractedColor {
  hex: string;
  r: number;
  g: number;
  b: number;
  h: number; // 0..360
  s: number; // 0..100
  l: number; // 0..100
  dominancePercent: number;
}

export type PaletteSortOption = 'dominance' | 'brightness' | 'hue';

export type HarmonyType = 'complementary' | 'analogous' | 'triadic' | 'monochromatic';

export interface ColorHarmony {
  name: string;
  type: HarmonyType;
  colors: string[];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  }
  return null;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hNorm = (h % 360) / 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  if (sNorm === 0) {
    const val = Math.round(lNorm * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  const r = Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hNorm) * 255);
  const b = Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255);

  return { r, g, b };
}

/**
 * Calculates relative luminance for WCAG contrast
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates WCAG 2.1 contrast ratio between two colors (e.g. 4.5:1)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;

  const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

interface Pixel {
  r: number;
  g: number;
  b: number;
}

/**
 * Median-cut color quantization algorithm
 */
function medianCut(pixels: Pixel[], depth: number): Pixel[][] {
  if (depth === 0 || pixels.length === 0) {
    return [pixels];
  }

  // Find color channel with the largest range
  let minR = 255, maxR = 0;
  let minG = 255, maxG = 0;
  let minB = 255, maxB = 0;

  for (const p of pixels) {
    if (p.r < minR) minR = p.r;
    if (p.r > maxR) maxR = p.r;
    if (p.g < minG) minG = p.g;
    if (p.g > maxG) maxG = p.g;
    if (p.b < minB) minB = p.b;
    if (p.b > maxB) maxB = p.b;
  }

  const rangeR = maxR - minR;
  const rangeG = maxG - minG;
  const rangeB = maxB - minB;

  let channel: 'r' | 'g' | 'b' = 'r';
  if (rangeG >= rangeR && rangeG >= rangeB) channel = 'g';
  else if (rangeB >= rangeR && rangeB >= rangeG) channel = 'b';

  pixels.sort((a, b) => a[channel] - b[channel]);
  const mid = Math.floor(pixels.length / 2);

  return [
    ...medianCut(pixels.slice(0, mid), depth - 1),
    ...medianCut(pixels.slice(mid), depth - 1),
  ];
}

/**
 * Extracts N dominant colors from an HTMLCanvasElement
 */
export function extractColorsFromCanvas(
  canvas: HTMLCanvasElement,
  paletteSize: number = 5
): ExtractedColor[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  // Downsample to max 120x120 for fast quantization
  const maxDim = 120;
  const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
  const sampleW = Math.max(10, Math.round(canvas.width * scale));
  const sampleH = Math.max(10, Math.round(canvas.height * scale));

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleW;
  sampleCanvas.height = sampleH;
  const sampleCtx = sampleCanvas.getContext('2d');
  if (!sampleCtx) return [];

  sampleCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
  const imgData = sampleCtx.getImageData(0, 0, sampleW, sampleH).data;

  const pixels: Pixel[] = [];
  for (let i = 0; i < imgData.length; i += 4) {
    const alpha = imgData[i + 3];
    if (alpha >= 128) {
      pixels.push({
        r: imgData[i],
        g: imgData[i + 1],
        b: imgData[i + 2],
      });
    }
  }

  if (pixels.length === 0) return [];

  // Determine median-cut recursion depth to get >= paletteSize buckets
  const depth = Math.ceil(Math.log2(paletteSize));
  const buckets = medianCut(pixels, depth);

  const totalPixels = pixels.length;
  const rawColors: ExtractedColor[] = buckets
    .filter((b) => b.length > 0)
    .map((bucket) => {
      let sumR = 0, sumG = 0, sumB = 0;
      for (const p of bucket) {
        sumR += p.r;
        sumG += p.g;
        sumB += p.b;
      }
      const avgR = Math.round(sumR / bucket.length);
      const avgG = Math.round(sumG / bucket.length);
      const avgB = Math.round(sumB / bucket.length);
      const hsl = rgbToHsl(avgR, avgG, avgB);

      return {
        hex: rgbToHex(avgR, avgG, avgB),
        r: avgR,
        g: avgG,
        b: avgB,
        h: hsl.h,
        s: hsl.s,
        l: hsl.l,
        dominancePercent: Number(((bucket.length / totalPixels) * 100).toFixed(1)),
      };
    });

  // Sort by dominance descending and slice to paletteSize
  rawColors.sort((a, b) => b.dominancePercent - a.dominancePercent);
  return rawColors.slice(0, paletteSize);
}

/**
 * Sorts extracted colors by dominance, brightness, or hue
 */
export function sortExtractedPalette(
  colors: ExtractedColor[],
  sortBy: PaletteSortOption
): ExtractedColor[] {
  const copy = [...colors];
  switch (sortBy) {
    case 'brightness':
      return copy.sort((a, b) => b.l - a.l);
    case 'hue':
      return copy.sort((a, b) => a.h - b.h);
    case 'dominance':
    default:
      return copy.sort((a, b) => b.dominancePercent - a.dominancePercent);
  }
}

/**
 * Generates color harmonies for a base HEX color
 */
export function generateHarmonies(baseHex: string): ColorHarmony[] {
  const rgb = hexToRgb(baseHex);
  if (!rgb) return [];
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const makeHex = (h: number, s: number, l: number) => {
    const c = hslToRgb((h + 360) % 360, s, l);
    return rgbToHex(c.r, c.g, c.b);
  };

  return [
    {
      name: 'Complementary',
      type: 'complementary',
      colors: [baseHex, makeHex(hsl.h + 180, hsl.s, hsl.l)],
    },
    {
      name: 'Analogous',
      type: 'analogous',
      colors: [
        makeHex(hsl.h - 30, hsl.s, hsl.l),
        baseHex,
        makeHex(hsl.h + 30, hsl.s, hsl.l),
      ],
    },
    {
      name: 'Triadic',
      type: 'triadic',
      colors: [
        baseHex,
        makeHex(hsl.h + 120, hsl.s, hsl.l),
        makeHex(hsl.h + 240, hsl.s, hsl.l),
      ],
    },
    {
      name: 'Monochromatic',
      type: 'monochromatic',
      colors: [
        makeHex(hsl.h, hsl.s, Math.max(15, hsl.l - 30)),
        makeHex(hsl.h, hsl.s, Math.max(25, hsl.l - 15)),
        baseHex,
        makeHex(hsl.h, hsl.s, Math.min(85, hsl.l + 15)),
        makeHex(hsl.h, hsl.s, Math.min(95, hsl.l + 30)),
      ],
    },
  ];
}

/**
 * Formats colors as CSS variables
 */
export function formatAsCssVariables(colors: ExtractedColor[]): string {
  const lines = colors.map((c, i) => `  --color-${i + 1}: ${c.hex}; /* RGB(${c.r}, ${c.g}, ${c.b}) */`);
  return `:root {\n${lines.join('\n')}\n}`;
}
