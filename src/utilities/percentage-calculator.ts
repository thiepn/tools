import { formatHumanNumber, parseHumanNumber } from './human-number';

export function parseNumberInput(input: string): number | null {
  return parseHumanNumber(input, { allowPercentSuffix: true });
}

export function formatPreciseNumber(val: number, maxDecimals = 6): string {
  if (Number.isNaN(val)) return 'Invalid number';
  if (!Number.isFinite(val)) return val > 0 ? 'Infinity' : '-Infinity';
  return formatHumanNumber(val, maxDecimals);
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

// Mode 1: What is X% of Y?
export function calculatePercentOf(percent: number, total: number): {
  result: number;
  formatted: string;
  formula: string;
} {
  const safePercent = finiteOrZero(percent);
  const safeTotal = finiteOrZero(total);
  const result = (safePercent / 100) * safeTotal;
  return {
    result,
    formatted: formatPreciseNumber(result),
    formula: `(${formatPreciseNumber(safePercent)} ÷ 100) × ${formatPreciseNumber(safeTotal)} = ${formatPreciseNumber(result)}`,
  };
}

// Mode 2: X is what percent of Y?
export function calculateWhatPercent(part: number, total: number): {
  result: number | null;
  formatted: string;
  formula: string;
  error?: string;
} {
  const safePart = finiteOrZero(part);
  const safeTotal = finiteOrZero(total);
  if (safeTotal === 0) {
    return {
      result: null,
      formatted: 'Undefined',
      formula: 'Division by zero is undefined',
      error: 'Cannot calculate percentage of zero (division by zero)',
    };
  }
  const result = (safePart / safeTotal) * 100;
  return {
    result,
    formatted: `${formatPreciseNumber(result)}%`,
    formula: `(${formatPreciseNumber(safePart)} ÷ ${formatPreciseNumber(safeTotal)}) × 100 = ${formatPreciseNumber(result)}%`,
  };
}

// Mode 3: Percentage change from X to Y
export function calculatePercentChange(fromVal: number, toVal: number): {
  result: number | null;
  formatted: string;
  formula: string;
  isIncrease: boolean;
  error?: string;
} {
  const from = finiteOrZero(fromVal);
  const to = finiteOrZero(toVal);
  if (from === 0) {
    return {
      result: null,
      formatted: 'Undefined',
      formula: 'Division by initial value of zero is undefined',
      isIncrease: to >= 0,
      error: 'Initial value cannot be zero for percentage change calculation',
    };
  }

  const diff = to - from;
  const result = (diff / Math.abs(from)) * 100;
  const isIncrease = diff >= 0;
  const sign = isIncrease && result !== 0 ? '+' : '';

  return {
    result,
    formatted: `${sign}${formatPreciseNumber(result)}%`,
    formula: `((${formatPreciseNumber(to)} - ${formatPreciseNumber(from)}) ÷ |${formatPreciseNumber(from)}|) × 100 = ${sign}${formatPreciseNumber(result)}%`,
    isIncrease,
  };
}

/** Symmetric percentage difference between two values. */
export function calculatePercentDifference(valueA: number, valueB: number): {
  result: number | null;
  formatted: string;
  formula: string;
  error?: string;
} {
  const a = finiteOrZero(valueA);
  const b = finiteOrZero(valueB);
  const denominator = (Math.abs(a) + Math.abs(b)) / 2;
  if (denominator === 0) {
    return {
      result: null,
      formatted: 'Undefined',
      formula: 'Average magnitude is zero',
      error: 'Percentage difference is undefined when both values are zero',
    };
  }
  const result = (Math.abs(a - b) / denominator) * 100;
  return {
    result,
    formatted: `${formatPreciseNumber(result)}%`,
    formula: `|${formatPreciseNumber(a)} - ${formatPreciseNumber(b)}| ÷ ((|${formatPreciseNumber(a)}| + |${formatPreciseNumber(b)}|) ÷ 2) × 100 = ${formatPreciseNumber(result)}%`,
  };
}

// Mode 4: Reverse percentage
// If final value Y resulted from an increase or decrease of X%, what was the original?
export function calculateReversePercent(
  finalVal: number,
  percentChange: number,
  type: 'increase' | 'decrease'
): {
  result: number | null;
  formatted: string;
  formula: string;
  error?: string;
} {
  const finalValue = finiteOrZero(finalVal);
  const change = finiteOrZero(percentChange);
  if (type === 'increase') {
    const factor = 1 + change / 100;
    if (factor === 0) {
      return { result: null, formatted: 'Undefined', formula: '', error: 'Invalid percentage resulting in division by zero' };
    }
    const original = finalValue / factor;
    return {
      result: original,
      formatted: formatPreciseNumber(original),
      formula: `${formatPreciseNumber(finalValue)} ÷ (1 + ${formatPreciseNumber(change)}%) = ${formatPreciseNumber(original)}`,
    };
  }

  const factor = 1 - change / 100;
  if (factor === 0) {
    return { result: null, formatted: 'Undefined', formula: '', error: 'Cannot reverse a 100% decrease' };
  }
  const original = finalValue / factor;
  return {
    result: original,
    formatted: formatPreciseNumber(original),
    formula: `${formatPreciseNumber(finalValue)} ÷ (1 - ${formatPreciseNumber(change)}%) = ${formatPreciseNumber(original)}`,
  };
}
