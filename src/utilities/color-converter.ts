export interface RGBA {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
  a: number; // 0 - 1
}

export interface HSLA {
  h: number; // 0 - 360
  s: number; // 0 - 100
  l: number; // 0 - 100
  a: number; // 0 - 1
}

export interface ColorConversionResult {
  hex: string;
  hex8: string;
  rgb: string;
  rgba: string;
  hsl: string;
  hsla: string;
  rawRgba: RGBA;
  rawHsla: HSLA;
}

export interface ContrastResult {
  ratio: number;
  wcagAANormal: boolean;
  wcagAALarge: boolean;
  wcagAAANormal: boolean;
  wcagAAALarge: boolean;
  luminance1: number;
  luminance2: number;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

// Convert RGB to HSL
export function rgbToHsl(r: number, g: number, b: number, a = 1): HSLA {
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
    a,
  };
}

// Convert HSL to RGB
export function hslToRgb(h: number, s: number, l: number, a = 1): RGBA {
  const hNorm = (h % 360) / 360;
  const sNorm = clamp(s / 100, 0, 1);
  const lNorm = clamp(l / 100, 0, 1);

  if (sNorm === 0) {
    const val = Math.round(lNorm * 255);
    return { r: val, g: val, b: val, a };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tAdj = t;
    if (tAdj < 0) tAdj += 1;
    if (tAdj > 1) tAdj -= 1;
    if (tAdj < 1 / 6) return p + (q - p) * 6 * tAdj;
    if (tAdj < 1 / 2) return q;
    if (tAdj < 2 / 3) return p + (q - p) * (2 / 3 - tAdj) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  const r = Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hNorm) * 255);
  const b = Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255);

  return { r, g, b, a };
}

// Parse any color string: #hex, rgb(...), rgba(...), hsl(...), hsla(...)
export function parseColor(input: string): RGBA | null {
  const str = input.trim().toLowerCase();
  if (!str) return null;

  // 1. HEX format: #RGB, #RGBA, #RRGGBB, #RRGGBBAA or without #
  const hexClean = str.startsWith('#') ? str.slice(1) : str;
  if (/^[0-9a-f]{3,8}$/i.test(hexClean)) {
    if (hexClean.length === 3) {
      return {
        r: parseInt(hexClean[0] + hexClean[0], 16),
        g: parseInt(hexClean[1] + hexClean[1], 16),
        b: parseInt(hexClean[2] + hexClean[2], 16),
        a: 1,
      };
    }
    if (hexClean.length === 4) {
      return {
        r: parseInt(hexClean[0] + hexClean[0], 16),
        g: parseInt(hexClean[1] + hexClean[1], 16),
        b: parseInt(hexClean[2] + hexClean[2], 16),
        a: Number((parseInt(hexClean[3] + hexClean[3], 16) / 255).toFixed(2)),
      };
    }
    if (hexClean.length === 6) {
      return {
        r: parseInt(hexClean.slice(0, 2), 16),
        g: parseInt(hexClean.slice(2, 4), 16),
        b: parseInt(hexClean.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hexClean.length === 8) {
      return {
        r: parseInt(hexClean.slice(0, 2), 16),
        g: parseInt(hexClean.slice(2, 4), 16),
        b: parseInt(hexClean.slice(4, 6), 16),
        a: Number((parseInt(hexClean.slice(6, 8), 16) / 255).toFixed(2)),
      };
    }
  }

  // 2. RGB / RGBA: rgb(255, 0, 0) or rgba(255, 0, 0, 0.5) or rgb(255 0 0 / 0.5)
  const rgbMatch = str.match(/^rgba?\s*\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    const r = clamp(parseInt(rgbMatch[1], 10), 0, 255);
    const g = clamp(parseInt(rgbMatch[2], 10), 0, 255);
    const b = clamp(parseInt(rgbMatch[3], 10), 0, 255);
    let a = 1;
    if (rgbMatch[4] !== undefined) {
      a = clamp(parseFloat(rgbMatch[4]), 0, 1);
    }
    return { r, g, b, a };
  }

  // 3. HSL / HSLA: hsl(120, 100%, 50%) or hsla(120, 100%, 50%, 0.8)
  const hslMatch = str.match(/^hsla?\s*\(\s*(\d{1,3}(?:\.\d+)?)\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%?\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%?(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) % 360;
    const s = clamp(parseFloat(hslMatch[2]), 0, 100);
    const l = clamp(parseFloat(hslMatch[3]), 0, 100);
    let a = 1;
    if (hslMatch[4] !== undefined) {
      a = clamp(parseFloat(hslMatch[4]), 0, 1);
    }
    return hslToRgb(h, s, l, a);
  }

  return null;
}

export function formatColorRepresentations(rgba: RGBA): ColorConversionResult {
  const { r, g, b, a } = rgba;
  const hexR = r.toString(16).padStart(2, '0').toUpperCase();
  const hexG = g.toString(16).padStart(2, '0').toUpperCase();
  const hexB = b.toString(16).padStart(2, '0').toUpperCase();
  const hex = `#${hexR}${hexG}${hexB}`;

  const alpha255 = Math.round(a * 255);
  const hexA = alpha255.toString(16).padStart(2, '0').toUpperCase();
  const hex8 = `#${hexR}${hexG}${hexB}${hexA}`;

  const rgb = `rgb(${r}, ${g}, ${b})`;
  const rgbaStr = `rgba(${r}, ${g}, ${b}, ${a})`;

  const hsla = rgbToHsl(r, g, b, a);
  const hsl = `hsl(${hsla.h}, ${hsla.s}%, ${hsla.l}%)`;
  const hslaStr = `hsla(${hsla.h}, ${hsla.s}%, ${hsla.l}%, ${hsla.a})`;

  return {
    hex,
    hex8,
    rgb,
    rgba: rgbaStr,
    hsl,
    hsla: hslaStr,
    rawRgba: rgba,
    rawHsla: hsla,
  };
}

// Calculate relative luminance according to WCAG 2.1 specifications
export function getRelativeLuminance(rgba: RGBA): number {
  const transform = (val: number) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  const R = transform(rgba.r);
  const G = transform(rgba.g);
  const B = transform(rgba.b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Calculate contrast ratio between two colors (1:1 to 21:1)
export function getContrastRatio(color1: RGBA, color2: RGBA): ContrastResult {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  const ratio = Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));

  return {
    ratio,
    wcagAANormal: ratio >= 4.5,
    wcagAALarge: ratio >= 3.0,
    wcagAAANormal: ratio >= 7.0,
    wcagAAALarge: ratio >= 4.5,
    luminance1: Number(lum1.toFixed(4)),
    luminance2: Number(lum2.toFixed(4)),
  };
}
