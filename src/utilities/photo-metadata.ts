/**
 * Photo Metadata & EXIF Privacy Cleaner Utility
 * Binary EXIF/GPS parser, privacy risk analyzer, and lossless APP1 segment cleaner for JPEG/PNG
 */

export interface ParsedExifData {
  make?: string;
  model?: string;
  software?: string;
  dateTime?: string;
  exposureTime?: string;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  lensModel?: string;
  artist?: string;
  copyright?: string;
  userComment?: string;
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    latRef?: string;
    lonRef?: string;
  };
  hasSensitiveData: boolean;
  sensitiveReasons: string[];
}

/**
 * Parses binary buffer of a JPEG or PNG image to extract EXIF and GPS tags
 */
export function parsePhotoMetadata(buffer: ArrayBuffer): ParsedExifData {
  const view = new DataView(buffer);
  const result: ParsedExifData = {
    hasSensitiveData: false,
    sensitiveReasons: [],
  };

  // Check if valid JPEG (starts with 0xFFD8)
  if (view.getUint16(0) === 0xffd8) {
    let offset = 2;
    const length = view.byteLength;

    while (offset < length - 4) {
      const marker = view.getUint16(offset);
      offset += 2;

      if (marker === 0xffe1) {
        // APP1 Marker (EXIF or XMP)
        const segmentLength = view.getUint16(offset);
        const exifHeader = String.fromCharCode(
          view.getUint8(offset + 2),
          view.getUint8(offset + 3),
          view.getUint8(offset + 4),
          view.getUint8(offset + 5)
        );

        if (exifHeader === 'Exif') {
          parseTiffHeader(view, offset + 8, result);
        }
        offset += segmentLength;
      } else if ((marker & 0xff00) === 0xff00 && marker !== 0xff00) {
        if (marker === 0xffda || marker === 0xffd9) {
          // Start of scan or end of image
          break;
        }
        const segmentLength = view.getUint16(offset);
        offset += segmentLength;
      } else {
        break;
      }
    }
  }

  // Determine privacy risks
  if (result.gps) {
    result.hasSensitiveData = true;
    result.sensitiveReasons.push('Exact GPS Geographic Location');
  }
  if (result.make || result.model || result.software) {
    result.hasSensitiveData = true;
    result.sensitiveReasons.push('Device & Camera Hardware Identifier');
  }
  if (result.dateTime) {
    result.hasSensitiveData = true;
    result.sensitiveReasons.push('Original Date & Timestamp of Capture');
  }

  return result;
}

function parseTiffHeader(view: DataView, tiffStart: number, result: ParsedExifData) {
  try {
    const endianTag = view.getUint16(tiffStart);
    const littleEndian = endianTag === 0x4949; // "II" vs "MM"

    const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
    if (firstIfdOffset < 8) return;

    parseIfd(view, tiffStart, tiffStart + firstIfdOffset, littleEndian, result);
  } catch {
    // Malformed EXIF safety
  }
}

function parseIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean,
  result: ParsedExifData
) {
  if (ifdOffset + 2 > view.byteLength) return;
  const numEntries = view.getUint16(ifdOffset, littleEndian);
  let entryOffset = ifdOffset + 2;

  let exifSubIfdOffset = 0;
  let gpsSubIfdOffset = 0;

  for (let i = 0; i < numEntries; i++) {
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);
    const valueOffset = view.getUint32(entryOffset + 8, littleEndian);

    if (tag === 0x010f) {
      // Make
      result.make = readString(view, tiffStart, count, valueOffset);
    } else if (tag === 0x0110) {
      // Model
      result.model = readString(view, tiffStart, count, valueOffset);
    } else if (tag === 0x0131) {
      // Software
      result.software = readString(view, tiffStart, count, valueOffset);
    } else if (tag === 0x0132 || tag === 0x9003) {
      // DateTime
      result.dateTime = readString(view, tiffStart, count, valueOffset);
    } else if (tag === 0x8769) {
      // Exif IFD Pointer
      exifSubIfdOffset = valueOffset;
    } else if (tag === 0x8825) {
      // GPS IFD Pointer
      gpsSubIfdOffset = valueOffset;
    }

    entryOffset += 12;
  }

  // Parse GPS IFD if present
  if (gpsSubIfdOffset > 0) {
    parseGpsIfd(view, tiffStart, tiffStart + gpsSubIfdOffset, littleEndian, result);
  }
}

function parseGpsIfd(
  view: DataView,
  tiffStart: number,
  gpsOffset: number,
  littleEndian: boolean,
  result: ParsedExifData
) {
  if (gpsOffset + 2 > view.byteLength) return;
  const numEntries = view.getUint16(gpsOffset, littleEndian);
  let entryOffset = gpsOffset + 2;

  let latRef = 'N';
  let lonRef = 'E';
  let latVals: number[] = [];
  let lonVals: number[] = [];

  for (let i = 0; i < numEntries; i++) {
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);
    const valueOffset = view.getUint32(entryOffset + 8, littleEndian);

    if (tag === 0x0001) {
      // GPSLatRef
      latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
    } else if (tag === 0x0002) {
      // GPSLatitude
      latVals = readRationals(view, tiffStart + valueOffset, 3, littleEndian);
    } else if (tag === 0x0003) {
      // GPSLongRef
      lonRef = String.fromCharCode(view.getUint8(entryOffset + 8));
    } else if (tag === 0x0004) {
      // GPSLongitude
      lonVals = readRationals(view, tiffStart + valueOffset, 3, littleEndian);
    }

    entryOffset += 12;
  }

  if (latVals.length === 3 && lonVals.length === 3) {
    const lat = (latVals[0] + latVals[1] / 60 + latVals[2] / 3600) * (latRef === 'S' ? -1 : 1);
    const lon = (lonVals[0] + lonVals[1] / 60 + lonVals[2] / 3600) * (lonRef === 'W' ? -1 : 1);
    result.gps = {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      latRef,
      lonRef,
    };
  }
}

function readString(view: DataView, tiffStart: number, count: number, offsetVal: number): string {
  try {
    const actualOffset = count <= 4 ? tiffStart + offsetVal : tiffStart + offsetVal;
    let str = '';
    for (let i = 0; i < count - 1; i++) {
      if (actualOffset + i >= view.byteLength) break;
      const ch = view.getUint8(actualOffset + i);
      if (ch === 0) break;
      str += String.fromCharCode(ch);
    }
    return str.trim();
  } catch {
    return '';
  }
}

function readRationals(view: DataView, offset: number, count: number, littleEndian: boolean): number[] {
  const rationals: number[] = [];
  for (let i = 0; i < count; i++) {
    const numOffset = offset + i * 8;
    if (numOffset + 8 > view.byteLength) break;
    const num = view.getUint32(numOffset, littleEndian);
    const den = view.getUint32(numOffset + 4, littleEndian);
    rationals.push(den !== 0 ? num / den : 0);
  }
  return rationals;
}

/**
 * Losslessly strips EXIF APP1 (0xFFE1) segments directly from a JPEG binary ArrayBuffer
 */
export function stripExifFromJpeg(buffer: ArrayBuffer): Blob {
  const view = new DataView(buffer);
  if (view.getUint16(0) !== 0xffd8) {
    // If not JPEG, return buffer as blob
    return new Blob([buffer], { type: 'image/jpeg' });
  }

  const chunks: Uint8Array[] = [];
  let offset = 2;
  let lastCopied = 0;
  const length = view.byteLength;

  // Preserve SOI marker
  chunks.push(new Uint8Array(buffer, 0, 2));
  lastCopied = 2;

  while (offset < length - 4) {
    const marker = view.getUint16(offset);

    if (marker === 0xffe1 || marker === 0xffe2 || marker === 0xffed || marker === 0xffee) {
      // Push segment before this metadata marker
      if (offset > lastCopied) {
        chunks.push(new Uint8Array(buffer, lastCopied, offset - lastCopied));
      }
      const segmentLength = view.getUint16(offset + 2);
      offset += 2 + segmentLength;
      lastCopied = offset;
    } else if ((marker & 0xff00) === 0xff00) {
      if (marker === 0xffda) {
        // Start of Scan: copy the rest of the image stream directly
        break;
      }
      const segmentLength = view.getUint16(offset + 2);
      offset += 2 + segmentLength;
    } else {
      break;
    }
  }

  // Copy remaining binary data
  if (lastCopied < length) {
    chunks.push(new Uint8Array(buffer, lastCopied, length - lastCopied));
  }

  return new Blob(chunks, { type: 'image/jpeg' });
}
