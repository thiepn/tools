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

/**
 * Escapes characters for RFC 5545 text values
 * Escapes backslashes, semicolons, commas, and newlines
 */
export function escapeIcsText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Formats a Date or date string to ICS UTC timestamp (YYYYMMDDTHHMMSSZ)
 */
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

/**
 * Formats date and time into ICS DTSTART/DTEND string
 */
export function formatIcsDateTime(
  dateStr: string,
  timeStr: string,
  isAllDay: boolean,
  timezone: string
): { icsKey: string; icsValue: string } {
  const cleanDate = dateStr.replace(/-/g, '');

  if (isAllDay) {
    return {
      icsKey: ';VALUE=DATE',
      icsValue: cleanDate,
    };
  }

  const cleanTime = (timeStr || '09:00').replace(/:/g, '') + '00';
  if (timezone === 'UTC') {
    return {
      icsKey: '',
      icsValue: `${cleanDate}T${cleanTime}Z`,
    };
  }

  return {
    icsKey: `;TZID=${timezone}`,
    icsValue: `${cleanDate}T${cleanTime}`,
  };
}

/**
 * Validates calendar event inputs
 */
export function validateCalendarEvent(event: CalendarEventData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!event.title.trim()) {
    errors.push('Event title is required.');
  }

  if (!event.startDate) {
    errors.push('Start date is required.');
  }

  if (!event.isAllDay && !event.startTime) {
    errors.push('Start time is required for timed events.');
  }

  if (event.startDate && event.endDate) {
    const startIso = event.isAllDay
      ? `${event.startDate}T00:00:00`
      : `${event.startDate}T${event.startTime || '00:00'}:00`;
    const endIso = event.isAllDay
      ? `${event.endDate}T23:59:59`
      : `${event.endDate}T${event.endTime || '00:00'}:00`;

    const startTs = new Date(startIso).getTime();
    const endTs = new Date(endIso).getTime();

    if (endTs < startTs) {
      errors.push('End date/time cannot be earlier than start date/time.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generates RFC 5545 compliant .ics file content
 */
export function generateIcsFile(event: CalendarEventData): string {
  const now = new Date();
  const dtStamp = formatIcsUtcTimestamp(now);
  const uid = `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@tinytools.local`;

  const startDt = formatIcsDateTime(
    event.startDate,
    event.startTime,
    event.isAllDay,
    event.timezone || 'UTC'
  );

  const effectiveEndDate = event.endDate || event.startDate;
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

  if (event.description.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }

  if (event.location.trim()) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }

  if (event.url.trim()) {
    lines.push(`URL:${event.url.trim()}`);
  }

  if (event.organizerEmail?.trim()) {
    const orgName = event.organizerName?.trim()
      ? `;CN=${escapeIcsText(event.organizerName.trim())}`
      : '';
    lines.push(`ORGANIZER${orgName}:mailto:${event.organizerEmail.trim()}`);
  }

  // Recurrence rule
  if (event.recurrence !== 'NONE') {
    let rrule = `RRULE:FREQ=${event.recurrence}`;
    if (event.repeatCount && event.repeatCount > 0) {
      rrule += `;COUNT=${event.repeatCount}`;
    } else if (event.repeatUntil) {
      const cleanUntil = event.repeatUntil.replace(/-/g, '');
      rrule += `;UNTIL=${cleanUntil}T235959Z`;
    }
    lines.push(rrule);
  }

  // Reminder / Alarm
  if (event.reminderMinutes > 0) {
    let trigger = `-PT${event.reminderMinutes}M`;
    if (event.reminderMinutes === 1440) {
      trigger = '-P1D';
    } else if (event.reminderMinutes >= 60 && event.reminderMinutes % 60 === 0) {
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

  // RFC 5545 requires CRLF line endings
  return lines.join('\r\n');
}
