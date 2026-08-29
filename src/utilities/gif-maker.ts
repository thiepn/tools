/**
 * GIF Maker Utility
 * Pure JavaScript GIF89a LZW encoder, color quantizer, and animation builder
 */

export interface GifFrameInput {
  canvas: HTMLCanvasElement;
  delayMs: number;
}

export interface GifCaption {
  text: string;
  position: 'top' | 'bottom' | 'center';
  fontSize: number;
  color: string;
  stroke: boolean;
}

export interface GifSettings {
  width: number;
  height: number;
  fps: number;
  loopCount: number; // 0 for infinite
  quality: number; // 1 to 10
  caption?: GifCaption;
}

/**
 * Encodes a series of HTMLCanvas frames into a valid animated GIF89a Blob
 */
export function encodeGif(
  frames: GifFrameInput[],
  width: number,
  height: number,
  loopCount = 0,
  onProgress?: (pct: number) => void
): Blob {
  const bytes: number[] = [];

  // Header: GIF89a
  writeString(bytes, 'GIF89a');

  // Logical Screen Descriptor
  writeUint16(bytes, width);
  writeUint16(bytes, height);
  bytes.push(0xf7); // Global Color Table Flag: 1, Color Resolution: 7 (8 bits), Sort Flag: 0, Size of GCT: 7 (256 colors)
  bytes.push(0x00); // Background Color Index
  bytes.push(0x00); // Pixel Aspect Ratio

  // Build standard 256-color palette (Web-safe + Grayscale + Primary colors)
  const palette = generateStandardPalette();
  for (let i = 0; i < 256; i++) {
    const rgb = palette[i] || [0, 0, 0];
    bytes.push(rgb[0], rgb[1], rgb[2]);
  }

  // Netscape Application Extension for Looping
  if (loopCount >= 0) {
    bytes.push(0x21, 0xff, 0x0b);
    writeString(bytes, 'NETSCAPE2.0');
    bytes.push(0x03, 0x01);
    writeUint16(bytes, loopCount);
    bytes.push(0x00); // Block terminator
  }

  // Write Frames
  for (let f = 0; f < frames.length; f++) {
    const frame = frames[f];
    const ctx = frame.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;

    const imgData = ctx.getImageData(0, 0, width, height).data;
    const delayHundredths = Math.max(2, Math.round(frame.delayMs / 10));

    // Graphic Control Extension
    bytes.push(0x21, 0xf9, 0x04);
    bytes.push(0x04); // Packed field (Disposal method: 1 = do not dispose)
    writeUint16(bytes, delayHundredths);
    bytes.push(0x00); // Transparent color index
    bytes.push(0x00); // Block terminator

    // Image Descriptor
    bytes.push(0x2c); // Image Separator
    writeUint16(bytes, 0); // Left
    writeUint16(bytes, 0); // Top
    writeUint16(bytes, width);
    writeUint16(bytes, height);
    bytes.push(0x00); // Local Color Table Flag: 0

    // Quantize Frame pixels to Palette indices
    const indexedPixels = new Uint8Array(width * height);
    for (let p = 0; p < width * height; p++) {
      const r = imgData[p * 4];
      const g = imgData[p * 4 + 1];
      const b = imgData[p * 4 + 2];
      indexedPixels[p] = findClosestPaletteIndex(r, g, b, palette);
    }

    // LZW Compression
    encodeLZW(bytes, indexedPixels, 8);

    if (onProgress) {
      onProgress(Math.round(((f + 1) / frames.length) * 100));
    }
  }

  // Trailer
  bytes.push(0x3b);

  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

function writeString(bytes: number[], str: string) {
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i));
  }
}

function writeUint16(bytes: number[], val: number) {
  bytes.push(val & 0xff);
  bytes.push((val >> 8) & 0xff);
}

export function generateStandardPalette(): [number, number, number][] {
  const palette: [number, number, number][] = [];
  // 6x6x6 color cube (216 colors)
  const steps = [0, 51, 102, 153, 204, 255];
  for (const r of steps) {
    for (const g of steps) {
      for (const b of steps) {
        palette.push([r, g, b]);
      }
    }
  }
  // 40 grayscale levels
  for (let i = 0; i < 40; i++) {
    const gray = Math.round((i / 39) * 255);
    palette.push([gray, gray, gray]);
  }
  return palette;
}

export function findClosestPaletteIndex(
  r: number,
  g: number,
  b: number,
  palette: [number, number, number][]
): number {
  // Fast quantized color lookup with step division
  const rIdx = Math.min(5, Math.round(r / 51));
  const gIdx = Math.min(5, Math.round(g / 51));
  const bIdx = Math.min(5, Math.round(b / 51));
  return rIdx * 36 + gIdx * 6 + bIdx;
}

/**
 * Standard GIF LZW compression algorithm
 */
function encodeLZW(bytes: number[], pixels: Uint8Array, minCodeSize: number) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  bytes.push(minCodeSize);

  let curCodeSize = minCodeSize + 1;
  let maxCode = (1 << curCodeSize) - 1;

  const dictionary = new Map<string, number>();
  const resetDictionary = () => {
    dictionary.clear();
    for (let i = 0; i < clearCode; i++) {
      dictionary.set(String(i), i);
    }
  };
  resetDictionary();

  const outputBits: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;

  const emitCode = (code: number) => {
    bitBuf |= code << bitCount;
    bitCount += curCodeSize;
    while (bitCount >= 8) {
      outputBits.push(bitBuf & 0xff);
      bitBuf >>= 8;
      bitCount -= 8;
    }
  };

  emitCode(clearCode);

  let curStr = '';
  let nextCode = eoiCode + 1;

  for (let i = 0; i < pixels.length; i++) {
    const pix = pixels[i];
    const newStr = curStr === '' ? String(pix) : `${curStr},${pix}`;

    if (dictionary.has(newStr)) {
      curStr = newStr;
    } else {
      emitCode(dictionary.get(curStr)!);

      if (nextCode <= 4095) {
        dictionary.set(newStr, nextCode++);
        if (nextCode > maxCode && curCodeSize < 12) {
          curCodeSize++;
          maxCode = (1 << curCodeSize) - 1;
        }
      } else {
        emitCode(clearCode);
        resetDictionary();
        curCodeSize = minCodeSize + 1;
        maxCode = (1 << curCodeSize) - 1;
        nextCode = eoiCode + 1;
      }

      curStr = String(pix);
    }
  }

  if (curStr !== '') {
    emitCode(dictionary.get(curStr)!);
  }

  emitCode(eoiCode);

  if (bitCount > 0) {
    outputBits.push(bitBuf & 0xff);
  }

  // Write sub-blocks of max 254 bytes
  let offset = 0;
  while (offset < outputBits.length) {
    const chunkSize = Math.min(254, outputBits.length - offset);
    bytes.push(chunkSize);
    for (let i = 0; i < chunkSize; i++) {
      bytes.push(outputBits[offset + i]);
    }
    offset += chunkSize;
  }
  bytes.push(0x00); // Terminate sub-blocks
}
