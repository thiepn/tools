/**
 * Calendar Event & RFC 5545 (.ics) Generator Utilities
 */

export type EventRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type EventReminder = 0 | 5 | 10 | 15 | 30 | 60 | 1440; // in minutes (0 = none)

export interface CalendarEventData {
  title: string;
  description: string;
  location: string;
  url: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate: string; // YYYY-MM-DD
  endTime: string; // HH:mm
  isAllDay: boolean;
  timezone: string;
  reminderMinutes: EventReminder;
  recurrence: EventRecurrence;
  repeatCount?: number;
  repeatUntil?: string; // YYYY-MM-DD
  organizerName?: string;
  organizerEmail?: string;
}

export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

let fallbackUidCounter = 0;

/** Escapes RFC 5545 TEXT values. */
export function escapeIcsText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Quotes/escapes a parameter value such as ORGANIZER CN. */
export function escapeIcsParameter(str: string): string {
  const value = str.replace(/[\r\n]/g, ' ').trim();
  if (!value) return '';
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return /[,:;\s]/.test(escaped) ? `"${escaped}"` : escaped;
}

/**
 * RFC 5545 content lines SHOULD be folded at 75 octets. Continuation lines
 * begin with one space. This implementation counts UTF-8 bytes, not JS code units.
 */
export function foldIcsLine(line: string, maxOctets = 75): string[] {
  const encoder = new TextEncoder();
  const limit = Math.max(16, maxOctets);
  if (encoder.encode(line).length <= limit) return [line];

  const output: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    const effectiveLimit = output.length === 0 ? limit : limit - 1; // continuation leading space
    if (current && currentBytes + charBytes > effectiveLimit) {
      output.push(output.length === 0 ? current : ` ${current}`);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }

  if (current) output.push(output.length === 0 ? current : ` ${current}`);
  return output;
}

/** Formats a Date to ICS UTC timestamp (YYYYMMDDTHHMMSSZ). */
export function formatIcsUtcTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** Formats date and time into ICS DTSTART/DTEND string. */
export function formatIcsDateTime(
  dateStr: string,
  timeStr: string,
  isAllDay: boolean,
  timezone: string
): { icsKey: string; icsValue: string } {
  const cleanDate = dateStr.replace(/-/g, '');

  if (isAllDay) {
    return { icsKey: ';VALUE=DATE', icsValue: cleanDate };
  }

  const cleanTime = (timeStr || '09:00').replace(/:/g, '') + '00';
  if (timezone === 'UTC') {
    return { icsKey: '', icsValue: `${cleanDate}T${cleanTime}Z` };
  }

  return { icsKey: `;TZID=${timezone}`, icsValue: `${cleanDate}T${cleanTime}` };
}

export function validateCalendarEvent(event: CalendarEventData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!event.title.trim()) errors.push('Event title is required.');
  if (!event.startDate) errors.push('Start date is required.');
  if (!event.isAllDay && !event.startTime) errors.push('Start time is required for timed events.');

  if (event.startDate && event.endDate) {
    const startIso = event.isAllDay
      ? `${event.startDate}T00:00:00`
      : `${event.startDate}T${event.startTime || '00:00'}:00`;
    const endIso = event.isAllDay
      ? `${event.endDate}T23:59:59`
      : `${event.endDate}T${event.endTime || '00:00'}:00`;

    const startTs = new Date(startIso).getTime();
    const endTs = new Date(endIso).getTime();
    if (endTs < startTs) errors.push('End date/time cannot be earlier than start date/time.');
  }

  if (event.organizerEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.organizerEmail.trim())) {
    errors.push('Organizer email address is invalid.');
  }

  if (event.repeatCount !== undefined && (!Number.isInteger(event.repeatCount) || event.repeatCount < 1)) {
    errors.push('Repeat count must be a positive whole number.');
  }

  return { isValid: errors.length === 0, errors };
}

export function createCalendarUid(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `${randomUuid}@tinytools.local`;
  fallbackUidCounter += 1;
  return `event-${Date.now()}-${fallbackUidCounter.toString(36)}@tinytools.local`;
}

/** Generates RFC 5545 compliant .ics file content. */
export function generateIcsFile(event: CalendarEventData): string {
  const now = new Date();
  const dtStamp = formatIcsUtcTimestamp(now);
  const uid = createCalendarUid();

  const startDt = formatIcsDateTime(
    event.startDate,
    event.startTime,
    event.isAllDay,
    event.timezone || 'UTC'
  );

  // RFC 5545 all-day DTEND is exclusive. The UI treats endDate as inclusive,
  // so add one calendar day when serializing an all-day event.
  const selectedEndDate = event.endDate || event.startDate;
  const effectiveEndDate = event.isAllDay ? addDaysToDateString(selectedEndDate, 1) : selectedEndDate;
  const effectiveEndTime = event.endTime || event.startTime;
  const endDt = formatIcsDateTime(
    effectiveEndDate,
    effectiveEndTime,
    event.isAllDay,
    event.timezone || 'UTC'
  );

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tiny Tools//Calendar Event Maker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART${startDt.icsKey}:${startDt.icsValue}`,
    `DTEND${endDt.icsKey}:${endDt.icsValue}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (event.description.trim()) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location.trim()) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.url.trim()) lines.push(`URL:${event.url.trim()}`);

  if (event.organizerEmail?.trim()) {
    const name = event.organizerName?.trim();
    const orgName = name ? `;CN=${escapeIcsParameter(name)}` : '';
    lines.push(`ORGANIZER${orgName}:mailto:${event.organizerEmail.trim()}`);
  }

  if (event.recurrence !== 'NONE') {
    let rrule = `RRULE:FREQ=${event.recurrence}`;
    if (event.repeatCount && event.repeatCount > 0) {
      rrule += `;COUNT=${event.repeatCount}`;
    } else if (event.repeatUntil) {
      const cleanUntil = event.repeatUntil.replace(/-/g, '');
      rrule += event.isAllDay ? `;UNTIL=${cleanUntil}` : `;UNTIL=${cleanUntil}T235959Z`;
    }
    lines.push(rrule);
  }

  if (event.reminderMinutes > 0) {
    let trigger = `-PT${event.reminderMinutes}M`;
    if (event.reminderMinutes === 1440) trigger = '-P1D';
    else if (event.reminderMinutes >= 60 && event.reminderMinutes % 60 === 0) {
      trigger = `-PT${event.reminderMinutes / 60}H`;
    }

    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(event.title)}`,
      `TRIGGER:${trigger}`,
      'END:VALARM'
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.flatMap((line) => foldIcsLine(line)).join('\r\n');
}
