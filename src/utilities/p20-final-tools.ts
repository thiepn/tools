export interface DecisionCriterion {
  name: string;
  weight: number;
}

export interface DecisionOption {
  name: string;
  scores: number[];
}

export interface RankedDecisionOption {
  name: string;
  score: number;
  contributions: number[];
}

const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function rankDecisionOptions(
  criteria: DecisionCriterion[],
  options: DecisionOption[]
): RankedDecisionOption[] {
  const weights = criteria.map((criterion) => Math.max(0, finite(criterion.weight)));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);

  return options
    .map((option) => {
      const contributions = weights.map((weight, index) => {
        if (totalWeight <= 0) return 0;
        const score = clamp(finite(option.scores[index]), 0, 10);
        return (score * weight) / totalWeight;
      });
      return {
        name: option.name.trim() || 'Untitled option',
        score: round(contributions.reduce((sum, value) => sum + value, 0), 3),
        contributions: contributions.map((value) => round(value, 3)),
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export interface BudgetExpense {
  category: string;
  amount: number;
}

export interface BudgetSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number | null;
  categoryTotals: Array<{ category: string; amount: number; share: number }>;
}

export function summarizeBudget(income: number[], expenses: BudgetExpense[]): BudgetSummary {
  const totalIncome = income.reduce((sum, value) => sum + Math.max(0, finite(value)), 0);
  const categoryMap = new Map<string, number>();
  for (const expense of expenses) {
    const category = expense.category.trim() || 'Other';
    const amount = Math.max(0, finite(expense.amount));
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + amount);
  }
  const totalExpenses = [...categoryMap.values()].reduce((sum, value) => sum + value, 0);
  const balance = totalIncome - totalExpenses;
  const categoryTotals = [...categoryMap.entries()]
    .map(([category, amount]) => ({
      category,
      amount: round(amount, 2),
      share: totalExpenses > 0 ? round((amount / totalExpenses) * 100, 1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  return {
    totalIncome: round(totalIncome, 2),
    totalExpenses: round(totalExpenses, 2),
    balance: round(balance, 2),
    savingsRate: totalIncome > 0 ? round((balance / totalIncome) * 100, 1) : null,
    categoryTotals,
  };
}

const SMALL_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
] as const;
const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;
const SCALE_WORDS = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion'] as const;

function underThousandToWords(value: number): string {
  const parts: string[] = [];
  let rest = value;
  if (rest >= 100) {
    parts.push(`${SMALL_WORDS[Math.floor(rest / 100)]} hundred`);
    rest %= 100;
  }
  if (rest >= 20) {
    const tens = TENS_WORDS[Math.floor(rest / 10)];
    const ones = rest % 10;
    parts.push(ones ? `${tens}-${SMALL_WORDS[ones]}` : tens);
  } else if (rest > 0) {
    parts.push(SMALL_WORDS[rest]);
  }
  return parts.join(' ');
}

function normalizeNumericText(value: string | number | bigint): string {
  if (typeof value === 'bigint') return value.toString();
  const raw = String(value).trim().replace(/[,_\s]/g, '');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(raw)) {
    throw new Error('Enter a regular signed decimal number, for example 1234.56.');
  }
  return raw;
}

export function numberToEnglishWords(value: string | number | bigint): string {
  const normalized = normalizeNumericText(value);
  const negative = normalized.startsWith('-');
  const unsigned = normalized.replace(/^[+-]/, '');
  const [integerRaw, fractionalRaw] = unsigned.split('.');
  const integer = BigInt(integerRaw || '0');
  const chunks: number[] = [];
  let rest = integer;
  while (rest > 0n) {
    chunks.push(Number(rest % 1000n));
    rest /= 1000n;
  }
  if (chunks.length > SCALE_WORDS.length) {
    throw new Error(`Values above ${SCALE_WORDS[SCALE_WORDS.length - 1]} range are not supported.`);
  }

  const integerWords: string[] = [];
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const chunk = chunks[index];
    if (!chunk) continue;
    const words = underThousandToWords(chunk);
    integerWords.push(SCALE_WORDS[index] ? `${words} ${SCALE_WORDS[index]}` : words);
  }
  if (integerWords.length === 0) integerWords.push('zero');

  const fractionalWords = fractionalRaw
    ? ` point ${fractionalRaw.split('').map((digit) => SMALL_WORDS[Number(digit)]).join(' ')}`
    : '';
  const hasNonZeroValue = integer !== 0n || /[1-9]/.test(fractionalRaw ?? '');
  return `${negative && hasNonZeroValue ? 'minus ' : ''}${integerWords.join(' ')}${fractionalWords}`;
}

const WORD_VALUES = new Map<string, bigint>([
  ...SMALL_WORDS.map((word, value) => [word, BigInt(value)] as [string, bigint]),
  ...TENS_WORDS.map((word, value) => [word, BigInt(value * 10)] as [string, bigint]).filter(([word]) => Boolean(word)),
]);
const SCALE_VALUES = new Map<string, bigint>(
  SCALE_WORDS.slice(1).map((word, index) => [word, 1000n ** BigInt(index + 1)])
);

export function englishWordsToNumber(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ');
  if (!normalized) throw new Error('Enter English number words, for example “one hundred twenty-three”.');

  const rawTokens = normalized.split(' ');
  let negative = false;
  if (rawTokens[0] === 'minus' || rawTokens[0] === 'negative') {
    negative = true;
    rawTokens.shift();
  }
  const pointIndex = rawTokens.indexOf('point');
  if (pointIndex !== -1 && rawTokens.indexOf('point', pointIndex + 1) !== -1) {
    throw new Error('Use at most one “point” separator.');
  }
  const integerTokens = (pointIndex === -1 ? rawTokens : rawTokens.slice(0, pointIndex)).filter((token) => token !== 'and');
  const fractionTokens = pointIndex === -1 ? [] : rawTokens.slice(pointIndex + 1).filter((token) => token !== 'and');
  if (integerTokens.length === 0) integerTokens.push('zero');

  let total = 0n;
  let current = 0n;
  for (const token of integerTokens) {
    const small = WORD_VALUES.get(token);
    if (small !== undefined) {
      current += small;
      continue;
    }
    if (token === 'hundred') {
      current = (current || 1n) * 100n;
      continue;
    }
    const scale = SCALE_VALUES.get(token);
    if (scale !== undefined) {
      total += (current || 1n) * scale;
      current = 0n;
      continue;
    }
    throw new Error(`Unrecognized number word: “${token}”.`);
  }
  const integerValue = total + current;

  let fraction = '';
  for (const token of fractionTokens) {
    const value = WORD_VALUES.get(token);
    if (value === undefined || value < 0n || value > 9n) {
      throw new Error('After “point”, spell each decimal digit separately (for example “point zero five”).');
    }
    fraction += value.toString();
  }
  if (pointIndex !== -1 && fraction.length === 0) throw new Error('Add decimal digits after “point”.');

  const sign = negative && (integerValue !== 0n || /[1-9]/.test(fraction)) ? '-' : '';
  return `${sign}${integerValue.toString()}${pointIndex === -1 ? '' : `.${fraction}`}`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

export interface ScreenDensityResult {
  ppi: number;
  pixelPitchMm: number;
  megapixels: number;
  aspectWidth: number;
  aspectHeight: number;
}

export function calculateScreenDensity(widthPx: number, heightPx: number, diagonalInches: number): ScreenDensityResult {
  const width = Math.max(1, Math.round(finite(widthPx, 1)));
  const height = Math.max(1, Math.round(finite(heightPx, 1)));
  const diagonal = finite(diagonalInches);
  if (diagonal <= 0) throw new Error('Diagonal size must be greater than zero.');
  const ppi = Math.hypot(width, height) / diagonal;
  const divisor = gcd(width, height);
  return {
    ppi: round(ppi, 2),
    pixelPitchMm: round(25.4 / ppi, 4),
    megapixels: round((width * height) / 1_000_000, 2),
    aspectWidth: width / divisor,
    aspectHeight: height / divisor,
  };
}

export type FileSizeUnit = 'B' | 'KB' | 'MB' | 'GB' | 'TB' | 'KiB' | 'MiB' | 'GiB' | 'TiB';
export type TransferSpeedUnit = 'Kbps' | 'Mbps' | 'Gbps' | 'KB/s' | 'MB/s' | 'GB/s';

const SIZE_BYTES: Record<FileSizeUnit, number> = {
  B: 1,
  KB: 1_000,
  MB: 1_000_000,
  GB: 1_000_000_000,
  TB: 1_000_000_000_000,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
};
const SPEED_BITS: Record<TransferSpeedUnit, number> = {
  Kbps: 1_000,
  Mbps: 1_000_000,
  Gbps: 1_000_000_000,
  'KB/s': 8_000,
  'MB/s': 8_000_000,
  'GB/s': 8_000_000_000,
};

export interface TransferEstimate {
  seconds: number;
  bytes: number;
  bitsPerSecond: number;
}

export function estimateTransferTime(
  sizeValue: number,
  sizeUnit: FileSizeUnit,
  speedValue: number,
  speedUnit: TransferSpeedUnit
): TransferEstimate {
  const size = finite(sizeValue);
  const speed = finite(speedValue);
  if (size < 0) throw new Error('File size cannot be negative.');
  if (speed <= 0) throw new Error('Connection speed must be greater than zero.');
  const bytes = size * SIZE_BYTES[sizeUnit];
  const bitsPerSecond = speed * SPEED_BITS[speedUnit];
  return { seconds: (bytes * 8) / bitsPerSecond, bytes, bitsPerSecond };
}

export function formatCompactDuration(secondsInput: number): string {
  const seconds = Math.max(0, finite(secondsInput));
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  const total = Math.round(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);
  return parts.slice(0, 3).join(' ');
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type PaletteHarmony =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'tetradic'
  | 'split-complementary'
  | 'monochromatic';

export function normalizeHexColor(value: string): string {
  const raw = value.trim().replace(/^#/, '');
  const expanded = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) throw new Error('Enter a 3- or 6-digit hexadecimal color.');
  return `#${expanded.toUpperCase()}`;
}

export function hexToRgb(value: string): RgbColor {
  const hex = normalizeHexColor(value).slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: RgbColor): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let rgb: [number, number, number];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const toHex = (channel: number) => Math.round((channel + m) * 255).toString(16).padStart(2, '0');
  return `#${rgb.map(toHex).join('').toUpperCase()}`;
}

export function generateColorPalette(baseColor: string, harmony: PaletteHarmony): string[] {
  const base = rgbToHsl(hexToRgb(baseColor));
  if (harmony === 'monochromatic') {
    const levels = [-24, -12, 0, 12, 24].map((offset) => clamp(base.l + offset, 8, 92));
    return [...new Set(levels.map((lightness) => hslToHex(base.h, base.s, lightness)))];
  }
  const offsets: Record<Exclude<PaletteHarmony, 'monochromatic'>, number[]> = {
    complementary: [0, 180],
    analogous: [-30, 0, 30],
    triadic: [0, 120, 240],
    tetradic: [0, 90, 180, 270],
    'split-complementary': [0, 150, 210],
  };
  return offsets[harmony].map((offset) => hslToHex(base.h + offset, base.s, base.l));
}

function linearChannel(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function bestTextColor(background: string): '#000000' | '#FFFFFF' {
  const { r, g, b } = hexToRgb(background);
  const luminance = 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return blackContrast >= whiteContrast ? '#000000' : '#FFFFFF';
}

function dateKeyToDay(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const value = Date.UTC(year, month - 1, date);
  const parsed = new Date(value);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) return null;
  return Math.floor(value / 86_400_000);
}

function dayToDateKey(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  completedInWindow: number;
  completionRate: number;
}

export function calculateHabitStats(
  completionKeys: string[],
  windowDays: number,
  todayKey: string
): HabitStats {
  const todayDay = dateKeyToDay(todayKey);
  if (todayDay === null) throw new Error('Invalid today date key.');
  const window = Math.max(1, Math.floor(windowDays));
  const uniqueDays = new Set<number>();
  for (const key of completionKeys) {
    const day = dateKeyToDay(key);
    if (day !== null) uniqueDays.add(day);
  }

  let currentStreak = 0;
  for (let day = todayDay; uniqueDays.has(day); day -= 1) currentStreak += 1;

  const sorted = [...uniqueDays].sort((a, b) => a - b);
  let bestStreak = 0;
  let running = 0;
  let previous: number | null = null;
  for (const day of sorted) {
    running = previous !== null && day === previous + 1 ? running + 1 : 1;
    bestStreak = Math.max(bestStreak, running);
    previous = day;
  }

  const windowStart = todayDay - window + 1;
  const completedInWindow = sorted.filter((day) => day >= windowStart && day <= todayDay).length;
  return {
    currentStreak,
    bestStreak,
    completedInWindow,
    completionRate: round((completedInWindow / window) * 100, 1),
  };
}

export function recentDateKeys(days: number, todayKey: string): string[] {
  const todayDay = dateKeyToDay(todayKey);
  if (todayDay === null) throw new Error('Invalid today date key.');
  const count = Math.max(1, Math.floor(days));
  return Array.from({ length: count }, (_, index) => dayToDateKey(todayDay - (count - 1 - index)));
}

export interface PriorityTask {
  id: string;
  text: string;
  urgent: boolean;
  important: boolean;
}

export interface EisenhowerGroups {
  doNow: PriorityTask[];
  schedule: PriorityTask[];
  delegate: PriorityTask[];
  eliminate: PriorityTask[];
}

export function categorizeEisenhower(tasks: PriorityTask[]): EisenhowerGroups {
  const groups: EisenhowerGroups = { doNow: [], schedule: [], delegate: [], eliminate: [] };
  for (const task of tasks) {
    if (task.urgent && task.important) groups.doNow.push(task);
    else if (!task.urgent && task.important) groups.schedule.push(task);
    else if (task.urgent && !task.important) groups.delegate.push(task);
    else groups.eliminate.push(task);
  }
  return groups;
}
