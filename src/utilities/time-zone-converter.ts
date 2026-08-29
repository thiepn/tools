export interface TimeZoneItem {
  id: string; // IANA identifier, e.g. "America/New_York"
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
  dayDifference: string; // "+1 day", "-1 day", "Same day"
  isBusinessHours: boolean; // 9:00 - 18:00
  isoString: string;
}

// Convert a given source date/time in sourceTimezone to exact UTC Date object
export function createDateInZone(
  year: number,
  month: number, // 1-12
  day: number,
  hours: number,
  minutes: number,
  sourceZoneId: string
): Date {
  // Use Intl to get parts of arbitrary UTC timestamp in sourceZoneId
  // and binary search or offset deduction to find exact matching UTC point.
  // 1. Initial approximation using basic ISO string (assumed UTC)
  const approxUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  // Determine the timezone's offset at approxUtc
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: sourceZoneId,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(approxUtc);
  const partMap: Record<string, number> = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') {
      partMap[p.type] = parseInt(p.value, 10);
    }
  });

  // Calculate local date millis at approxUtc
  const localTargetMillis = Date.UTC(year, month - 1, day, hours, minutes, 0);
  const localActualMillis = Date.UTC(
    partMap.year,
    partMap.month - 1,
    partMap.day,
    partMap.hour === 24 ? 0 : partMap.hour,
    partMap.minute,
    partMap.second || 0
  );

  const diff = localTargetMillis - localActualMillis;
  return new Date(approxUtc.getTime() + diff);
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

  const offsetParts = offsetFormatter.formatToParts(utcDate);
  const offsetPart = offsetParts.find((p) => p.type === 'timeZoneName')?.value || 'UTC';

  // Calculate day difference relative to reference source date
  const refPartsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: targetZoneId,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hour12: false,
  });

  const parts = refPartsFormatter.formatToParts(utcDate);
  const zYear = parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10);
  const zMonth = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
  const zDay = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);
  const zHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);

  // Compare calendar days
  const targetDayTimestamp = Date.UTC(zYear, zMonth - 1, zDay);
  const refDayTimestamp = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );

  const dayDiffMs = targetDayTimestamp - refDayTimestamp;
  const dayDiffDays = Math.round(dayDiffMs / (1000 * 60 * 60 * 24));

  let dayDiffStr = 'Same day';
  if (dayDiffDays > 0) {
    dayDiffStr = `+${dayDiffDays} day${dayDiffDays > 1 ? 's' : ''}`;
  } else if (dayDiffDays < 0) {
    dayDiffStr = `${dayDiffDays} day${dayDiffDays < -1 ? 's' : ''}`;
  }

  const isBusinessHours = zHour >= 9 && zHour < 18;

  // Lookup city label
  const foundItem = POPULAR_TIMEZONES.find((t) => t.id === targetZoneId);
  const cityName = foundItem?.city || targetZoneId.split('/').pop()?.replace(/_/g, ' ') || targetZoneId;
  const countryName = foundItem?.country;

  return {
    zoneId: targetZoneId,
    city: cityName,
    country: countryName,
    formattedTime: timeFormatter.format(utcDate),
    formattedDate: dateFormatter.format(utcDate),
    utcOffset: offsetPart,
    dayDifference: dayDiffStr,
    isBusinessHours,
    isoString: utcDate.toISOString(),
  };
}

export function generateComparisonSummary(rows: ConvertedTimeRow[]): string {
  return rows
    .map(
      (r) =>
        `${r.city.padEnd(20)} ${r.formattedDate.padEnd(14)} ${r.formattedTime.padEnd(10)} (${r.utcOffset}) ${r.dayDifference !== 'Same day' ? `[${r.dayDifference}]` : ''}`.trim()
    )
    .join('\n');
}
