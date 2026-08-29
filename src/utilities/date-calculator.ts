export interface CalendarDate {
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 31
}

export function parseDateString(str: string): CalendarDate | null {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > getDaysInMonth(year, month)) return null;

  return { year, month, day };
}

export function formatDateString(date: CalendarDate): string {
  const y = String(date.year).padStart(4, '0');
  const m = String(date.month).padStart(2, '0');
  const d = String(date.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

// Convert CalendarDate to UTC timestamp (midnight) to completely eliminate DST bugs
export function toUtcTimestamp(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

export function fromUtcTimestamp(ms: number): CalendarDate {
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

// 1. Difference between dates
export function calculateDateDifference(
  start: CalendarDate,
  end: CalendarDate,
  includeEndDate = false
): {
  totalDays: number;
  weeks: number;
  remainingDays: number;
  isNegative: boolean;
} {
  const t1 = toUtcTimestamp(start);
  const t2 = toUtcTimestamp(end);

  const diffMs = t2 - t1;
  const isNegative = diffMs < 0;
  const oneDayMs = 86400000;

  let totalDays = Math.round(Math.abs(diffMs) / oneDayMs);
  if (includeEndDate) {
    totalDays += 1;
  }

  const weeks = Math.floor(totalDays / 7);
  const remainingDays = totalDays % 7;

  return {
    totalDays,
    weeks,
    remainingDays,
    isNegative,
  };
}

// 2. Add / Subtract time from a date with month-end clamping
export function addSubtractTime(
  base: CalendarDate,
  amount: number,
  unit: 'days' | 'weeks' | 'months' | 'years',
  operation: 'add' | 'subtract'
): CalendarDate {
  const multiplier = operation === 'add' ? 1 : -1;
  const delta = amount * multiplier;

  if (unit === 'days' || unit === 'weeks') {
    const daysToAdd = unit === 'weeks' ? delta * 7 : delta;
    const currentMs = toUtcTimestamp(base);
    const newMs = currentMs + daysToAdd * 86400000;
    return fromUtcTimestamp(newMs);
  }

  if (unit === 'years') {
    const targetYear = base.year + delta;
    const maxDays = getDaysInMonth(targetYear, base.month);
    const targetDay = Math.min(base.day, maxDays);
    return { year: targetYear, month: base.month, day: targetDay };
  }

  if (unit === 'months') {
    let totalMonths = base.year * 12 + (base.month - 1) + delta;
    const targetYear = Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1;
    const maxDays = getDaysInMonth(targetYear, targetMonth);
    const targetDay = Math.min(base.day, maxDays);
    return { year: targetYear, month: targetMonth, day: targetDay };
  }

  return base;
}

// 3. Age calculator (years, months, days + countdown to next birthday)
export function calculateAge(
  birthDate: CalendarDate,
  asOfDate: CalendarDate
): {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  daysToNextBirthday: number;
  isInvalid: boolean;
} {
  const tBirth = toUtcTimestamp(birthDate);
  const tAsOf = toUtcTimestamp(asOfDate);

  if (tAsOf < tBirth) {
    return {
      years: 0,
      months: 0,
      days: 0,
      totalDays: 0,
      daysToNextBirthday: 0,
      isInvalid: true,
    };
  }

  let years = asOfDate.year - birthDate.year;
  let months = asOfDate.month - birthDate.month;
  let days = asOfDate.day - birthDate.day;

  if (days < 0) {
    months -= 1;
    // previous month's max days
    const prevMonth = asOfDate.month === 1 ? 12 : asOfDate.month - 1;
    const prevYear = asOfDate.month === 1 ? asOfDate.year - 1 : asOfDate.year;
    days += getDaysInMonth(prevYear, prevMonth);
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = Math.round((tAsOf - tBirth) / 86400000);

  // Next birthday
  let nextBdayYear = asOfDate.year;
  let nextBdayDaysInMonth = getDaysInMonth(nextBdayYear, birthDate.month);
  let nextBdayDay = Math.min(birthDate.day, nextBdayDaysInMonth);
  let nextBdayDate: CalendarDate = { year: nextBdayYear, month: birthDate.month, day: nextBdayDay };

  if (toUtcTimestamp(nextBdayDate) < tAsOf) {
    nextBdayYear += 1;
    nextBdayDaysInMonth = getDaysInMonth(nextBdayYear, birthDate.month);
    nextBdayDay = Math.min(birthDate.day, nextBdayDaysInMonth);
    nextBdayDate = { year: nextBdayYear, month: birthDate.month, day: nextBdayDay };
  }

  const daysToNextBirthday = Math.round((toUtcTimestamp(nextBdayDate) - tAsOf) / 86400000);

  return {
    years,
    months,
    days,
    totalDays,
    daysToNextBirthday,
    isInvalid: false,
  };
}

// 4. Working days calculation (Monday - Friday, excluding Sat & Sun)
export function calculateWorkingDays(
  start: CalendarDate,
  end: CalendarDate,
  includeEndDate = true
): {
  workingDays: number;
  weekendDays: number;
  totalCalendarDays: number;
} {
  const t1 = toUtcTimestamp(start);
  const t2 = toUtcTimestamp(end);

  if (t2 < t1) {
    return { workingDays: 0, weekendDays: 0, totalCalendarDays: 0 };
  }

  const oneDayMs = 86400000;
  let currentMs = t1;
  const endMs = includeEndDate ? t2 : t2 - oneDayMs;

  let workingDays = 0;
  let weekendDays = 0;
  let totalCalendarDays = 0;

  while (currentMs <= endMs) {
    totalCalendarDays++;
    const d = new Date(currentMs);
    const dayOfWeek = d.getUTCDay(); // 0 = Sun, 6 = Sat

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDays++;
    } else {
      workingDays++;
    }

    currentMs += oneDayMs;
  }

  return {
    workingDays,
    weekendDays,
    totalCalendarDays,
  };
}
