export interface CalendarDate { year: number; month: number; day: number; }

export function parseDateString(str: string): CalendarDate | null {
  if (!/^\d{4,}-\d{2}-\d{2}$/.test(str || '')) return null;
  const [year, month, day] = str.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite) || month < 1 || month > 12 || day < 1 || day > getDaysInMonth(year, month)) return null;
  return { year, month, day };
}

export function formatDateString(date: CalendarDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}
export function isLeapYear(year: number): boolean { return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0; }
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
export function toUtcTimestamp(date: CalendarDate): number { return Date.UTC(date.year, date.month - 1, date.day); }
export function fromUtcTimestamp(ms: number): CalendarDate {
  const date = new Date(ms); return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function calculateDateDifference(start: CalendarDate, end: CalendarDate, includeEndDate = false): { totalDays: number; weeks: number; remainingDays: number; isNegative: boolean } {
  const diff = toUtcTimestamp(end) - toUtcTimestamp(start);
  let totalDays = Math.round(Math.abs(diff) / 86_400_000) + (includeEndDate ? 1 : 0);
  return { totalDays, weeks: Math.floor(totalDays / 7), remainingDays: totalDays % 7, isNegative: diff < 0 };
}

function positiveModulo(value: number, divisor: number): number { return ((value % divisor) + divisor) % divisor; }

export function addSubtractTime(base: CalendarDate, amount: number, unit: 'days' | 'weeks' | 'months' | 'years', operation: 'add' | 'subtract'): CalendarDate {
  const safeAmount = Number.isFinite(amount) ? Math.trunc(amount) : 0;
  const delta = safeAmount * (operation === 'add' ? 1 : -1);
  if (unit === 'days' || unit === 'weeks') {
    return fromUtcTimestamp(toUtcTimestamp(base) + (unit === 'weeks' ? delta * 7 : delta) * 86_400_000);
  }
  if (unit === 'years') {
    const year = base.year + delta;
    return { year, month: base.month, day: Math.min(base.day, getDaysInMonth(year, base.month)) };
  }
  const totalMonths = base.year * 12 + (base.month - 1) + delta;
  const year = Math.floor(totalMonths / 12);
  const month = positiveModulo(totalMonths, 12) + 1;
  return { year, month, day: Math.min(base.day, getDaysInMonth(year, month)) };
}

export function calculateAge(birthDate: CalendarDate, asOfDate: CalendarDate): { years: number; months: number; days: number; totalDays: number; daysToNextBirthday: number; isInvalid: boolean } {
  const birth = toUtcTimestamp(birthDate); const asOf = toUtcTimestamp(asOfDate);
  if (asOf < birth) return { years: 0, months: 0, days: 0, totalDays: 0, daysToNextBirthday: 0, isInvalid: true };
  let years = asOfDate.year - birthDate.year;
  let months = asOfDate.month - birthDate.month;
  let days = asOfDate.day - birthDate.day;
  if (days < 0) {
    months -= 1;
    const previousMonth = asOfDate.month === 1 ? 12 : asOfDate.month - 1;
    const previousYear = asOfDate.month === 1 ? asOfDate.year - 1 : asOfDate.year;
    days += getDaysInMonth(previousYear, previousMonth);
  }
  if (months < 0) { years -= 1; months += 12; }
  let birthdayYear = asOfDate.year;
  const birthdayForYear = (year: number): CalendarDate => ({ year, month: birthDate.month, day: Math.min(birthDate.day, getDaysInMonth(year, birthDate.month)) });
  let nextBirthday = birthdayForYear(birthdayYear);
  if (toUtcTimestamp(nextBirthday) < asOf) nextBirthday = birthdayForYear(++birthdayYear);
  return {
    years, months, days, totalDays: Math.round((asOf - birth) / 86_400_000),
    daysToNextBirthday: Math.round((toUtcTimestamp(nextBirthday) - asOf) / 86_400_000), isInvalid: false,
  };
}

export interface BusinessDayOptions {
  includeEndDate?: boolean;
  weekendDays?: number[]; // UTC day numbers, Sunday=0 ... Saturday=6
  excludedDates?: CalendarDate[];
}

/** Working-day calculator with custom weekends and manual holiday/exclusion dates. */
export function calculateBusinessDays(start: CalendarDate, end: CalendarDate, options: BusinessDayOptions = {}): { workingDays: number; weekendDays: number; excludedDays: number; totalCalendarDays: number } {
  const startMs = toUtcTimestamp(start); const endMs = toUtcTimestamp(end);
  if (endMs < startMs) return { workingDays: 0, weekendDays: 0, excludedDays: 0, totalCalendarDays: 0 };
  const includeEnd = options.includeEndDate ?? true;
  const finalMs = includeEnd ? endMs : endMs - 86_400_000;
  if (finalMs < startMs) return { workingDays: 0, weekendDays: 0, excludedDays: 0, totalCalendarDays: 0 };
  const weekend = new Set((options.weekendDays?.length ? options.weekendDays : [0, 6]).map((day) => positiveModulo(Math.trunc(day), 7)));
  const excluded = new Set((options.excludedDates || []).map(formatDateString));
  let workingDays = 0; let weekendDays = 0; let excludedDays = 0; let totalCalendarDays = 0;
  for (let current = startMs; current <= finalMs; current += 86_400_000) {
    totalCalendarDays++;
    const date = new Date(current);
    if (weekend.has(date.getUTCDay())) { weekendDays++; continue; }
    if (excluded.has(formatDateString(fromUtcTimestamp(current)))) { excludedDays++; continue; }
    workingDays++;
  }
  return { workingDays, weekendDays, excludedDays, totalCalendarDays };
}

export function calculateWorkingDays(start: CalendarDate, end: CalendarDate, includeEndDate = true): { workingDays: number; weekendDays: number; totalCalendarDays: number } {
  const result = calculateBusinessDays(start, end, { includeEndDate });
  return { workingDays: result.workingDays, weekendDays: result.weekendDays, totalCalendarDays: result.totalCalendarDays };
}
