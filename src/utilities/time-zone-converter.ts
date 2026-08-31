export interface TimeZoneItem {
  id: string;
  city: string;
  country?: string;
  region: string;
}

export const POPULAR_TIMEZONES: TimeZoneItem[] = [
  { id: 'UTC', city: 'UTC', country: 'Universal Time', region: 'Global' },
  { id: 'America/New_York', city: 'New York', country: 'United States', region: 'Americas' },
  { id: 'America/Los_Angeles', city: 'Los Angeles', country: 'United States', region: 'Americas' },
  { id: 'America/Chicago', city: 'Chicago', country: 'United States', region: 'Americas' },
  { id: 'America/Toronto', city: 'Toronto', country: 'Canada', region: 'Americas' },
  { id: 'America/Sao_Paulo', city: 'São Paulo', country: 'Brazil', region: 'Americas' },
  { id: 'Europe/London', city: 'London', country: 'United Kingdom', region: 'Europe' },
  { id: 'Europe/Paris', city: 'Paris', country: 'France', region: 'Europe' },
  { id: 'Europe/Berlin', city: 'Berlin', country: 'Germany', region: 'Europe' },
  { id: 'Europe/Amsterdam', city: 'Amsterdam', country: 'Netherlands', region: 'Europe' },
  { id: 'Europe/Zurich', city: 'Zurich', country: 'Switzerland', region: 'Europe' },
  { id: 'Europe/Madrid', city: 'Madrid', country: 'Spain', region: 'Europe' },
  { id: 'Europe/Rome', city: 'Rome', country: 'Italy', region: 'Europe' },
  { id: 'Europe/Athens', city: 'Athens', country: 'Greece', region: 'Europe' },
  { id: 'Europe/Istanbul', city: 'Istanbul', country: 'Turkey', region: 'Europe' },
  { id: 'Asia/Dubai', city: 'Dubai', country: 'United Arab Emirates', region: 'Middle East' },
  { id: 'Asia/Kolkata', city: 'Mumbai / New Delhi', country: 'India', region: 'Asia' },
  { id: 'Asia/Bangkok', city: 'Bangkok', country: 'Thailand', region: 'Asia' },
  { id: 'Asia/Singapore', city: 'Singapore', country: 'Singapore', region: 'Asia' },
  { id: 'Asia/Hong_Kong', city: 'Hong Kong', country: 'China', region: 'Asia' },
  { id: 'Asia/Shanghai', city: 'Shanghai / Beijing', country: 'China', region: 'Asia' },
  { id: 'Asia/Tokyo', city: 'Tokyo', country: 'Japan', region: 'Asia' },
  { id: 'Asia/Seoul', city: 'Seoul', country: 'South Korea', region: 'Asia' },
  { id: 'Australia/Sydney', city: 'Sydney', country: 'Australia', region: 'Oceania' },
  { id: 'Australia/Melbourne', city: 'Melbourne', country: 'Australia', region: 'Oceania' },
  { id: 'Pacific/Auckland', city: 'Auckland', country: 'New Zealand', region: 'Oceania' },
  { id: 'Pacific/Honolulu', city: 'Honolulu', country: 'United States', region: 'Americas' },
  { id: 'Africa/Cairo', city: 'Cairo', country: 'Egypt', region: 'Africa' },
  { id: 'Africa/Johannesburg', city: 'Johannesburg', country: 'South Africa', region: 'Africa' },
];

export interface ConvertedTimeRow {
  zoneId: string;
  city: string;
  country?: string;
  formattedTime: string;
  formattedDate: string;
  utcOffset: string;
  dayDifference: string;
  isBusinessHours: boolean;
  isoString: string;
}

export interface ZonedDateResolution {
  date: Date;
  status: 'exact' | 'ambiguous' | 'nonexistent';
  candidates: Date[];
  shiftedByMinutes: number;
}

interface WallClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const zonedPartsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(zoneId: string): Intl.DateTimeFormat {
  let formatter = zonedPartsFormatterCache.get(zoneId);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zoneId,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    zonedPartsFormatterCache.set(zoneId, formatter);
  }
  return formatter;
}

function getWallClockParts(date: Date, zoneId: string): WallClockParts {
  const map: Record<string, number> = {};
  for (const part of getPartsFormatter(zoneId).formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = Number(part.value);
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
    second: map.second || 0,
  };
}

function wallClockMillis(parts: WallClockParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function getOffsetMillis(date: Date, zoneId: string): number {
  const parts = getWallClockParts(date, zoneId);
  // Compare the displayed wall-clock tuple with the same instant rounded to seconds.
  const instant = Math.floor(date.getTime() / 1000) * 1000;
  return wallClockMillis(parts) - instant;
}

function sameWallClock(a: WallClockParts, b: WallClockParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute;
}

function candidateOffsets(targetWallMillis: number, zoneId: string): number[] {
  const offsets = new Set<number>();
  for (const hours of [-48, -24, -12, 0, 12, 24, 48]) {
    offsets.add(getOffsetMillis(new Date(targetWallMillis + hours * 3600_000), zoneId));
  }
  return [...offsets];
}

/**
 * Resolves a local wall-clock time in an IANA zone and explicitly reports DST
 * folds (ambiguous times) and gaps (nonexistent times). For a fold the earlier
 * instant is selected. For a gap, the wall time is shifted forward by the gap
 * duration, matching the common "compatible" behavior used by modern date APIs.
 */
export function resolveDateInZone(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  sourceZoneId: string
): ZonedDateResolution {
  const desired: WallClockParts = { year, month, day, hour: hours, minute: minutes, second: 0 };
  const desiredMillis = wallClockMillis(desired);
  const offsets = candidateOffsets(desiredMillis, sourceZoneId);
  const exactCandidates = offsets
    .map((offset) => new Date(desiredMillis - offset))
    .filter((candidate) => sameWallClock(getWallClockParts(candidate, sourceZoneId), desired))
    .sort((a, b) => a.getTime() - b.getTime())
    .filter((candidate, index, array) => index === 0 || candidate.getTime() !== array[index - 1].getTime());

  if (exactCandidates.length > 0) {
    return {
      date: exactCandidates[0],
      status: exactCandidates.length > 1 ? 'ambiguous' : 'exact',
      candidates: exactCandidates,
      shiftedByMinutes: 0,
    };
  }

  // Gap: inspect candidate instants produced by the before/after offsets and
  // choose the smallest positive wall-clock shift. Example: 02:30 in a 1-hour
  // spring-forward gap becomes 03:30 rather than silently becoming 03:00.
  const shifted = offsets
    .map((offset) => {
      const date = new Date(desiredMillis - offset);
      const displayed = wallClockMillis(getWallClockParts(date, sourceZoneId));
      return { date, diffMinutes: Math.round((displayed - desiredMillis) / 60_000) };
    })
    .filter((entry) => entry.diffMinutes > 0)
    .sort((a, b) => a.diffMinutes - b.diffMinutes || a.date.getTime() - b.date.getTime());

  const fallback = shifted[0] || { date: new Date(desiredMillis - offsets[0]), diffMinutes: 0 };
  return {
    date: fallback.date,
    status: 'nonexistent',
    candidates: [],
    shiftedByMinutes: fallback.diffMinutes,
  };
}

export function createDateInZone(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  sourceZoneId: string
): Date {
  return resolveDateInZone(year, month, day, hours, minutes, sourceZoneId).date;
}

export function formatZoneTime(
  utcDate: Date,
  targetZoneId: string,
  referenceDate: Date,
  is24Hour: boolean
): ConvertedTimeRow {
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: targetZoneId,
    hour: 'numeric',
    minute: '2-digit',
    hour12: !is24Hour,
  });
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: targetZoneId,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const offsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: targetZoneId,
    timeZoneName: 'shortOffset',
  });
  const offsetPart = offsetFormatter.formatToParts(utcDate).find((part) => part.type === 'timeZoneName')?.value || 'UTC';
  const parts = getWallClockParts(utcDate, targetZoneId);

  const targetDayTimestamp = Date.UTC(parts.year, parts.month - 1, parts.day);
  const refDayTimestamp = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate());
  const dayDiffDays = Math.round((targetDayTimestamp - refDayTimestamp) / 86_400_000);
  let dayDifference = 'Same day';
  if (dayDiffDays > 0) dayDifference = `+${dayDiffDays} day${dayDiffDays > 1 ? 's' : ''}`;
  else if (dayDiffDays < 0) dayDifference = `${dayDiffDays} day${dayDiffDays < -1 ? 's' : ''}`;

  const foundItem = POPULAR_TIMEZONES.find((zone) => zone.id === targetZoneId);
  return {
    zoneId: targetZoneId,
    city: foundItem?.city || targetZoneId.split('/').pop()?.replace(/_/g, ' ') || targetZoneId,
    country: foundItem?.country,
    formattedTime: timeFormatter.format(utcDate),
    formattedDate: dateFormatter.format(utcDate),
    utcOffset: offsetPart,
    dayDifference,
    isBusinessHours: parts.hour >= 9 && parts.hour < 18,
    isoString: utcDate.toISOString(),
  };
}

export function generateComparisonSummary(rows: ConvertedTimeRow[]): string {
  return rows
    .map((row) => `${row.city.padEnd(20)} ${row.formattedDate.padEnd(14)} ${row.formattedTime.padEnd(10)} (${row.utcOffset}) ${row.dayDifference !== 'Same day' ? `[${row.dayDifference}]` : ''}`.trim())
    .join('\n');
}
