/** Pure-JS GIF89a encoder with adaptive global color quantization. */
export interface GifFrameInput { canvas: HTMLCanvasElement; delayMs: number }
export interface GifCaption { text: string; position: 'top' | 'bottom' | 'center'; fontSize: number; color: string; stroke: boolean }
export interface GifSettings { width: number; height: number; fps: number; loopCount: number; quality: number; caption?: GifCaption }
type Rgb = [number, number, number];

export function generateStandardPalette(): Rgb[] {
  const palette: Rgb[] = [], steps = [0, 51, 102, 153, 204, 255];
  for (const r of steps) for (const g of steps) for (const b of steps) palette.push([r, g, b]);
  for (let i = 0; i < 40; i++) { const gray = Math.round((i / 39) * 255); palette.push([gray, gray, gray]); }
  return palette;
}

/** Backward-compatible fast lookup for the standard 6×6×6 palette. */
export function findClosestPaletteIndex(r: number, g: number, b: number, palette: Rgb[]): number {
  if (palette.length >= 216 && palette[0]?.[0] === 0 && palette[215]?.[0] === 255 && palette[215]?.[1] === 255 && palette[215]?.[2] === 255) {
    return Math.min(5, Math.round(r / 51)) * 36 + Math.min(5, Math.round(g / 51)) * 6 + Math.min(5, Math.round(b / 51));
  }
  let best = 0, bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const color = palette[i], dr = r - color[0], dg = g - color[1], db = b - color[2];
    // Green-weighted distance better approximates visible error than equal RGB weights.
    const distance = dr * dr * 2 + dg * dg * 4 + db * db * 3;
    if (distance < bestDistance) { bestDistance = distance; best = i; }
  }
  return best;
}

interface ColorBox { colors: Rgb[]; rRange: number; gRange: number; bRange: number }
function makeColorBox(colors: Rgb[]): ColorBox {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (const [r, g, b] of colors) { rMin = Math.min(rMin, r); rMax = Math.max(rMax, r); gMin = Math.min(gMin, g); gMax = Math.max(gMax, g); bMin = Math.min(bMin, b); bMax = Math.max(bMax, b); }
  return { colors, rRange: rMax - rMin, gRange: gMax - gMin, bRange: bMax - bMin };
}
function averageColor(colors: Rgb[]): Rgb {
  if (!colors.length) return [0, 0, 0];
  let r = 0, g = 0, b = 0; for (const color of colors) { r += color[0]; g += color[1]; b += color[2]; }
  return [Math.round(r / colors.length), Math.round(g / colors.length), Math.round(b / colors.length)];
}

/** Median-cut palette generated from a bounded sample of all animation frames. */
export function generateAdaptivePalette(samples: Rgb[], colorCount = 256): Rgb[] {
  if (!samples.length) return generateStandardPalette();
  const uniqueMap = new Map<number, Rgb>();
  for (const [r, g, b] of samples) {
    const key = (Math.round(r / 4) << 12) | (Math.round(g / 4) << 6) | Math.round(b / 4);
    if (!uniqueMap.has(key)) uniqueMap.set(key, [r, g, b]);
  }
  const unique = [...uniqueMap.values()];
  if (unique.length <= colorCount) {
    const palette = [...unique]; while (palette.length < 256) palette.push(palette[palette.length - 1] || [0, 0, 0]); return palette.slice(0, 256);
  }
  let boxes: ColorBox[] = [makeColorBox(unique)];
  while (boxes.length < Math.min(256, colorCount)) {
    let splitIndex = -1, splitScore = -1;
    boxes.forEach((box, index) => { const range = Math.max(box.rRange, box.gRange, box.bRange); const score = range * Math.sqrt(box.colors.length); if (box.colors.length > 1 && score > splitScore) { splitScore = score; splitIndex = index; } });
    if (splitIndex < 0) break;
    const box = boxes.splice(splitIndex, 1)[0];
    const channel = box.gRange >= box.rRange && box.gRange >= box.bRange ? 1 : box.rRange >= box.bRange ? 0 : 2;
    box.colors.sort((a, b) => a[channel] - b[channel]);
    const midpoint = Math.ceil(box.colors.length / 2);
    boxes.push(makeColorBox(box.colors.slice(0, midpoint)), makeColorBox(box.colors.slice(midpoint)));
  }
  const palette = boxes.map((box) => averageColor(box.colors));
  while (palette.length < 256) palette.push(palette[palette.length - 1] || [0, 0, 0]);
  return palette.slice(0, 256);
}

function collectPaletteSamples(frames: GifFrameInput[], width: number, height: number, maxSamples = 60_000): Rgb[] {
  const totalPixels = Math.max(1, frames.length * width * height);
  const stride = Math.max(1, Math.ceil(totalPixels / maxSamples));
  const samples: Rgb[] = []; let globalIndex = 0;
  for (const frame of frames) {
    const ctx = frame.canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) continue;
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let i = 0; i < data.length; i += 4, globalIndex++) if (globalIndex % stride === 0 && data[i + 3] >= 16) samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  return samples;
}

function quantizeFrame(data: Uint8ClampedArray, palette: Rgb[], width: number, height: number): Uint8Array {
  const indexed = new Uint8Array(width * height), cache = new Map<number, number>();
  for (let p = 0; p < indexed.length; p++) {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let index = cache.get(key);
    if (index === undefined) { index = findClosestPaletteIndex(r, g, b, palette); cache.set(key, index); }
    indexed[p] = index;
  }
  return indexed;
}

export function encodeGif(frames: GifFrameInput[], width: number, height: number, loopCount = 0, onProgress?: (pct: number) => void): Blob {
  const safeWidth = Math.max(1, Math.min(65535, Math.round(width))), safeHeight = Math.max(1, Math.min(65535, Math.round(height)));
  if (!frames.length) throw new Error('At least one GIF frame is required.');
  const bytes: number[] = []; writeString(bytes, 'GIF89a'); writeUint16(bytes, safeWidth); writeUint16(bytes, safeHeight);
  bytes.push(0xf7, 0x00, 0x00);
  const palette = generateAdaptivePalette(collectPaletteSamples(frames, safeWidth, safeHeight));
  for (let i = 0; i < 256; i++) { const rgb = palette[i] || [0, 0, 0]; bytes.push(rgb[0], rgb[1], rgb[2]); }
  if (loopCount >= 0) { bytes.push(0x21, 0xff, 0x0b); writeString(bytes, 'NETSCAPE2.0'); bytes.push(0x03, 0x01); writeUint16(bytes, Math.max(0, Math.min(65535, Math.floor(loopCount)))); bytes.push(0x00); }
  for (let f = 0; f < frames.length; f++) {
    const frame = frames[f], ctx = frame.canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) continue;
    const data = ctx.getImageData(0, 0, safeWidth, safeHeight).data, delay = Math.max(2, Math.round(frame.delayMs / 10));
    bytes.push(0x21, 0xf9, 0x04, 0x04); writeUint16(bytes, delay); bytes.push(0x00, 0x00);
    bytes.push(0x2c); writeUint16(bytes, 0); writeUint16(bytes, 0); writeUint16(bytes, safeWidth); writeUint16(bytes, safeHeight); bytes.push(0x00);
    encodeLZW(bytes, quantizeFrame(data, palette, safeWidth, safeHeight), 8);
    onProgress?.(Math.round(((f + 1) / frames.length) * 100));
  }
  bytes.push(0x3b); return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

function writeString(bytes: number[], value: string) { for (let i = 0; i < value.length; i++) bytes.push(value.charCodeAt(i)); }
function writeUint16(bytes: number[], value: number) { bytes.push(value & 0xff, (value >> 8) & 0xff); }
function encodeLZW(bytes: number[], pixels: Uint8Array, minCodeSize: number) {
  const clearCode = 1 << minCodeSize, eoiCode = clearCode + 1; bytes.push(minCodeSize);
  let codeSize = minCodeSize + 1, maxCode = (1 << codeSize) - 1, nextCode = eoiCode + 1;
  const dictionary = new Map<string, number>(); const reset = () => { dictionary.clear(); for (let i = 0; i < clearCode; i++) dictionary.set(String(i), i); }; reset();
  const output: number[] = []; let bitBuffer = 0, bitCount = 0;
  const emit = (code: number) => { bitBuffer |= code << bitCount; bitCount += codeSize; while (bitCount >= 8) { output.push(bitBuffer & 0xff); bitBuffer >>= 8; bitCount -= 8; } };
  emit(clearCode); let current = '';
  for (const pixel of pixels) {
    const candidate = current ? `${current},${pixel}` : String(pixel);
    if (dictionary.has(candidate)) current = candidate;
    else {
      if (current) emit(dictionary.get(current)!);
      if (nextCode <= 4095) { dictionary.set(candidate, nextCode++); if (nextCode > maxCode && codeSize < 12) { codeSize++; maxCode = (1 << codeSize) - 1; } }
      else { emit(clearCode); reset(); codeSize = minCodeSize + 1; maxCode = (1 << codeSize) - 1; nextCode = eoiCode + 1; }
      current = String(pixel);
    }
  }
  if (current) emit(dictionary.get(current)!); emit(eoiCode); if (bitCount > 0) output.push(bitBuffer & 0xff);
  for (let offset = 0; offset < output.length;) { const size = Math.min(255, output.length - offset); bytes.push(size); for (let i = 0; i < size; i++) bytes.push(output[offset + i]); offset += size; }
  bytes.push(0x00);
}
