/**
 * Barcode Generation & Scanning Utilities
 * Supports Code 128, Code 39, EAN-13, EAN-8, UPC-A, ITF, and Codabar
 */

export type BarcodeFormat =
  | 'CODE128'
  | 'CODE39'
  | 'EAN13'
  | 'EAN8'
  | 'UPCA'
  | 'ITF'
  | 'codabar';

export interface BarcodeFormatOption {
  id: BarcodeFormat;
  name: string;
  description: string;
  example: string;
  patternHelp: string;
}

export const BARCODE_FORMATS: BarcodeFormatOption[] = [
  {
    id: 'CODE128',
    name: 'Code 128 (Universal)',
    description: 'High-density alphanumeric barcode standard used worldwide.',
    example: 'TINY-TOOLS-2026',
    patternHelp: 'Accepts standard ASCII characters.',
  },
  {
    id: 'EAN13',
    name: 'EAN-13 (Retail Product)',
    description: 'Standard 13-digit retail barcode with check digit.',
    example: '590123412345',
    patternHelp: 'Enter 12 or 13 digits. (13th check digit auto-calculated if 12 entered).',
  },
  {
    id: 'UPCA',
    name: 'UPC-A (North America Retail)',
    description: 'Standard 12-digit retail barcode used in the US and Canada.',
    example: '01234567890',
    patternHelp: 'Enter 11 or 12 digits. (12th check digit auto-calculated if 11 entered).',
  },
  {
    id: 'EAN8',
    name: 'EAN-8 (Compact Retail)',
    description: 'Compact 8-digit retail barcode for small packages.',
    example: '9638507',
    patternHelp: 'Enter 7 or 8 digits. (8th check digit auto-calculated if 7 entered).',
  },
  {
    id: 'CODE39',
    name: 'Code 39 (Alphanumeric)',
    description: 'Widely used in industrial, military, and inventory systems.',
    example: 'ITEM-4092',
    patternHelp: 'Uppercase letters (A-Z), digits (0-9), and symbols (- . $ / + % space).',
  },
  {
    id: 'ITF',
    name: 'ITF / Interleaved 2 of 5',
    description: 'Numeric-only high-density barcode used in shipping and cartons.',
    example: '1234567890',
    patternHelp: 'Even number of numeric digits.',
  },
  {
    id: 'codabar',
    name: 'Codabar (Libraries & Logistics)',
    description: 'Self-checking symbology used in blood banks and libraries.',
    example: 'A123456789B',
    patternHelp: 'Starts and ends with A, B, C, or D; digits and symbols in between.',
  },
];

/**
 * Calculates EAN-13 / UPC-A check digit using standard modulo-10 algorithm
 */
export function calculateEanCheckDigit(digitsWithoutCheck: string): number {
  const digits = digitsWithoutCheck.split('').map(Number);
  let sum = 0;
  // Starting from right to left
  const isOddLen = digits.length % 2 === 1;
  for (let i = digits.length - 1; i >= 0; i--) {
    const posFromRight = digits.length - i;
    const weight = posFromRight % 2 === 1 ? 3 : 1;
    sum += digits[i] * weight;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Calculates EAN-8 check digit
 */
export function calculateEan8CheckDigit(digitsWithoutCheck: string): number {
  const digits = digitsWithoutCheck.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const weight = i % 2 === 0 ? 3 : 1;
    sum += digits[i] * weight;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Validates barcode payload based on symbology requirements
 */
export function validateBarcodePayload(
  format: BarcodeFormat,
  value: string
): { isValid: boolean; normalizedValue: string; error?: string } {
  const clean = value.trim();
  if (!clean) {
    return { isValid: false, normalizedValue: '', error: 'Please enter a barcode value.' };
  }

  switch (format) {
    case 'EAN13': {
      if (!/^\d{12,13}$/.test(clean)) {
        return { isValid: false, normalizedValue: clean, error: 'EAN-13 requires 12 or 13 numeric digits.' };
      }
      if (clean.length === 12) {
        const check = calculateEanCheckDigit(clean);
        return { isValid: true, normalizedValue: `${clean}${check}` };
      }
      const expectedCheck = calculateEanCheckDigit(clean.slice(0, 12));
      const actualCheck = Number(clean[12]);
      if (expectedCheck !== actualCheck) {
        return {
          isValid: false,
          normalizedValue: clean,
          error: `Invalid EAN-13 check digit. Expected ${expectedCheck}, got ${actualCheck}.`,
        };
      }
      return { isValid: true, normalizedValue: clean };
    }

    case 'UPCA': {
      if (!/^\d{11,12}$/.test(clean)) {
        return { isValid: false, normalizedValue: clean, error: 'UPC-A requires 11 or 12 numeric digits.' };
      }
      if (clean.length === 11) {
        const check = calculateEanCheckDigit(clean);
        return { isValid: true, normalizedValue: `${clean}${check}` };
      }
      const expectedCheck = calculateEanCheckDigit(clean.slice(0, 11));
      const actualCheck = Number(clean[11]);
      if (expectedCheck !== actualCheck) {
        return {
          isValid: false,
          normalizedValue: clean,
          error: `Invalid UPC-A check digit. Expected ${expectedCheck}, got ${actualCheck}.`,
        };
      }
      return { isValid: true, normalizedValue: clean };
    }

    case 'EAN8': {
      if (!/^\d{7,8}$/.test(clean)) {
        return { isValid: false, normalizedValue: clean, error: 'EAN-8 requires 7 or 8 numeric digits.' };
      }
      if (clean.length === 7) {
        const check = calculateEan8CheckDigit(clean);
        return { isValid: true, normalizedValue: `${clean}${check}` };
      }
      const expectedCheck = calculateEan8CheckDigit(clean.slice(0, 7));
      const actualCheck = Number(clean[7]);
      if (expectedCheck !== actualCheck) {
        return {
          isValid: false,
          normalizedValue: clean,
          error: `Invalid EAN-8 check digit. Expected ${expectedCheck}, got ${actualCheck}.`,
        };
      }
      return { isValid: true, normalizedValue: clean };
    }

    case 'CODE39': {
      const validCode39 = /^[A-Z0-9\-\.\ \$\/\+\%]+$/i;
      if (!validCode39.test(clean)) {
        return {
          isValid: false,
          normalizedValue: clean,
          error: 'Code 39 only supports uppercase letters, numbers, and - . $ / + % space.',
        };
      }
      return { isValid: true, normalizedValue: clean.toUpperCase() };
    }

    case 'ITF': {
      if (!/^\d+$/.test(clean)) {
        return { isValid: false, normalizedValue: clean, error: 'ITF only supports numeric digits.' };
      }
      // ITF requires an even number of digits
      const padded = clean.length % 2 !== 0 ? `0${clean}` : clean;
      return { isValid: true, normalizedValue: padded };
    }

    case 'codabar': {
      const validCodabar = /^[A-D][0-9\-\$\:\/\.\+]+[A-D]$/i;
      if (!validCodabar.test(clean)) {
        return {
          isValid: false,
          normalizedValue: clean,
          error: 'Codabar must start and end with A, B, C, or D and contain digits/symbols.',
        };
      }
      return { isValid: true, normalizedValue: clean.toUpperCase() };
    }

    case 'CODE128':
    default: {
      // Code 128 supports ASCII 0-127
      if (!/^[\x00-\x7F]+$/.test(clean)) {
        return { isValid: false, normalizedValue: clean, error: 'Code 128 requires standard ASCII text.' };
      }
      return { isValid: true, normalizedValue: clean };
    }
  }
}
