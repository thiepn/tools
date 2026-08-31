export interface HumanNumberParseOptions {
  allowPercentSuffix?: boolean;
}

/**
 * Parses numbers as people commonly paste/type them into utility forms.
 * Supports decimal comma/dot, mixed thousands+decimal separators, spaces,
 * narrow/non-breaking spaces, apostrophe grouping, leading currency text and
 * accounting-style negative parentheses. A single comma or dot is treated as a
 * decimal separator because that is the least surprising cross-locale choice;
 * repeated 3-digit groups are treated as thousands separators.
 */
export function parseHumanNumber(
  input: string | number,
  options: HumanNumberParseOptions = {}
): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  let raw = input.trim();
  if (!raw) return null;

  let negative = false;
  if (/^\(.*\)$/.test(raw)) {
    negative = true;
    raw = raw.slice(1, -1).trim();
  }

  if (options.allowPercentSuffix) raw = raw.replace(/%\s*$/, '').trim();

  // Keep only characters that can participate in a decimal number after
  // removing common grouping spaces/apostrophes and surrounding labels.
  raw = raw
    .replace(/[\s\u00A0\u202F'_]/g, '')
    .replace(/^[^+\-\d.,]+/, '')
    .replace(/[^\d.,]+$/, '');
  if (!raw || !/\d/.test(raw)) return null;

  let sign = 1;
  if (raw.startsWith('-')) {
    sign = -1;
    raw = raw.slice(1);
  } else if (raw.startsWith('+')) {
    raw = raw.slice(1);
  }
  if (!raw || !/\d/.test(raw)) return null;

  const commaCount = (raw.match(/,/g) || []).length;
  const dotCount = (raw.match(/\./g) || []).length;
  let normalized = raw;

  if (commaCount > 0 && dotCount > 0) {
    // The right-most punctuation is the decimal separator; all others are
    // grouping separators. Handles 1,234.56 and 1.234,56 symmetrically.
    const decimalIndex = Math.max(raw.lastIndexOf(','), raw.lastIndexOf('.'));
    const integerPart = raw.slice(0, decimalIndex).replace(/[.,]/g, '');
    const fractionalPart = raw.slice(decimalIndex + 1).replace(/[.,]/g, '');
    normalized = fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
  } else if (commaCount + dotCount > 0) {
    const separator = commaCount > 0 ? ',' : '.';
    const pieces = raw.split(separator);
    if (pieces.length > 2 && pieces.slice(1).every((part) => part.length === 3)) {
      // 1,234,567 or 1.234.567
      normalized = pieces.join('');
    } else if (pieces.length > 2) {
      // For malformed/mixed grouping with one separator type, use the final
      // separator as decimal and treat earlier occurrences as grouping.
      normalized = `${pieces.slice(0, -1).join('')}.${pieces.at(-1) || ''}`;
    } else {
      normalized = `${pieces[0]}.${pieces[1] || ''}`;
    }
  }

  if (!/^\d+(?:\.\d*)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  const value = parsed * sign * (negative ? -1 : 1);
  return Object.is(value, -0) ? 0 : value;
}

export function formatHumanNumber(value: number, maxDecimals = 6): string {
  if (!Number.isFinite(value)) return 'Invalid number';
  const decimals = Math.max(0, Math.min(12, Math.floor(maxDecimals)));
  if (Math.abs(value) >= 1e15 || (Math.abs(value) > 0 && Math.abs(value) < 10 ** -decimals)) {
    return value.toExponential(Math.min(6, Math.max(2, decimals)));
  }
  return Number(value.toFixed(decimals)).toString();
}
