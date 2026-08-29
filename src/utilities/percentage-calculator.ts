export function parseNumberInput(input: string): number | null {
  if (!input || !input.trim()) return null;
  // Replace comma with dot if unambiguous
  const normalized = input.trim().replace(/,/g, '.');
  const num = Number(normalized);
  return isNaN(num) ? null : num;
}

export function formatPreciseNumber(val: number, maxDecimals = 6): string {
  if (isNaN(val)) return 'Invalid number';
  if (!isFinite(val)) return val > 0 ? 'Infinity' : '-Infinity';

  // If very large or very small, use scientific notation
  if (Math.abs(val) > 1e12 || (Math.abs(val) < 1e-6 && val !== 0)) {
    return val.toExponential(4);
  }

  // Strip floating point noise (e.g. 0.30000000000000004 -> 0.3)
  const rounded = Number(val.toFixed(maxDecimals));
  return rounded.toString();
}

// Mode 1: What is X% of Y?
export function calculatePercentOf(percent: number, total: number): {
  result: number;
  formatted: string;
  formula: string;
} {
  const result = (percent / 100) * total;
  return {
    result,
    formatted: formatPreciseNumber(result),
    formula: `(${percent} ÷ 100) × ${total} = ${formatPreciseNumber(result)}`,
  };
}

// Mode 2: X is what percent of Y?
export function calculateWhatPercent(part: number, total: number): {
  result: number | null;
  formatted: string;
  formula: string;
  error?: string;
} {
  if (total === 0) {
    return {
      result: null,
      formatted: 'Undefined',
      formula: 'Division by zero is undefined',
      error: 'Cannot calculate percentage of zero (division by zero)',
    };
  }
  const result = (part / total) * 100;
  return {
    result,
    formatted: `${formatPreciseNumber(result)}%`,
    formula: `(${part} ÷ ${total}) × 100 = ${formatPreciseNumber(result)}%`,
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
  if (fromVal === 0) {
    return {
      result: null,
      formatted: 'Undefined',
      formula: 'Division by initial value of zero is undefined',
      isIncrease: toVal >= 0,
      error: 'Initial value cannot be zero for percentage change calculation',
    };
  }

  const diff = toVal - fromVal;
  const result = (diff / Math.abs(fromVal)) * 100;
  const isIncrease = diff >= 0;
  const sign = isIncrease ? '+' : '';

  return {
    result,
    formatted: `${sign}${formatPreciseNumber(result)}%`,
    formula: `((${toVal} - ${fromVal}) ÷ |${fromVal}|) × 100 = ${sign}${formatPreciseNumber(result)}%`,
    isIncrease,
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
  if (type === 'increase') {
    const factor = 1 + percentChange / 100;
    if (factor === 0) {
      return { result: null, formatted: 'Undefined', formula: '', error: 'Invalid percentage resulting in division by zero' };
    }
    const original = finalVal / factor;
    return {
      result: original,
      formatted: formatPreciseNumber(original),
      formula: `${finalVal} ÷ (1 + ${percentChange}%) = ${finalVal} ÷ ${factor} = ${formatPreciseNumber(original)}`,
    };
  } else {
    const factor = 1 - percentChange / 100;
    if (factor === 0) {
      return { result: null, formatted: 'Undefined', formula: '', error: 'Cannot reverse a 100% decrease' };
    }
    const original = finalVal / factor;
    return {
      result: original,
      formatted: formatPreciseNumber(original),
      formula: `${finalVal} ÷ (1 - ${percentChange}%) = ${finalVal} ÷ ${factor} = ${formatPreciseNumber(original)}`,
    };
  }
}
