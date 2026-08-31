import React, { useMemo, useState } from 'react';
import { CalendarDays, Copy, Download, ExternalLink } from 'lucide-react';
import {
  COMMON_TIMEZONES,
  generateGoogleCalendarUrl,
  generateIcsFile,
  generateOutlookCalendarUrl,
  validateCalendarEvent,
  type CalendarEventData,
  type EventRecurrence,
  type EventReminder,
} from '../../utilities/calendar-event';

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const SAMPLE: CalendarEventData = {
  title: 'Project Kickoff & Architecture Review', description: 'Discuss milestones and next actions.', location: 'Design Studio / Virtual Meet', url: '',
  startDate: tomorrow(), startTime: '10:00', endDate: tomorrow(), endTime: '11:00', isAllDay: false, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  reminderMinutes: 15, recurrence: 'WEEKLY', repeatCount: 4, recurrenceInterval: 1, status: 'CONFIRMED', transparency: 'OPAQUE', attendees: [], additionalReminders: [],
};
const WEEKDAYS = ['MO','TU','WE','TH','FR','SA','SU'];

export const CalendarEventMakerTool: React.FC = () => {
  const [event, setEvent] = useState<CalendarEventData>(SAMPLE);
  const [attendeeText, setAttendeeText] = useState('');
  const [copied, setCopied] = useState(false);
  const validation = useMemo(() => validateCalendarEvent(event), [event]);
  const ics = useMemo(() => validation.isValid ? generateIcsFile(event) : '', [event, validation.isValid]);
  const patch = <K extends keyof CalendarEventData>(key: K, value: CalendarEventData[K]) => setEvent((current) => ({ ...current, [key]: value }));
  const syncAttendees = (value: string) => { setAttendeeText(value); patch('attendees', value.split(/[;,\n]/).map((v) => v.trim()).filter(Boolean)); };
  const download = () => { if (!ics) return; const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'}.ics`; a.click(); URL.revokeObjectURL(url); };
  const copy = async () => { if (!ics) return; await navigator.clipboard.writeText(ics); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  return <div className="space-y-5">
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="space-y-3">
        <label className="text-xs font-semibold block">Event title<input value={event.title} onChange={(e) => patch('title', e.target.value)} className="mt-1 block w-full p-2.5 border rounded-lg bg-white dark:bg-neutral-900" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Start date<input type="date" value={event.startDate} onChange={(e) => patch('startDate', e.target.value)} className="mt-1 block w-full p-2 border rounded bg-white dark:bg-neutral-900" /></label>
          <label className="text-xs">End date<input type="date" value={event.endDate} onChange={(e) => patch('endDate', e.target.value)} className="mt-1 block w-full p-2 border rounded bg-white dark:bg-neutral-900" /></label>
          {!event.isAllDay && <><label className="text-xs">Start time<input type="time" value={event.startTime} onChange={(e) => patch('startTime', e.target.value)} className="mt-1 block w-full p-2 border rounded bg-white dark:bg-neutral-900" /></label><label className="text-xs">End time<input type="time" value={event.endTime} onChange={(e) => patch('endTime', e.target.value)} className="mt-1 block w-full p-2 border rounded bg-white dark:bg-neutral-900" /></label></>}
        </div>
        <label className="text-xs inline-flex gap-2 items-center"><input type="checkbox" checked={event.isAllDay} onChange={(e) => patch('isAllDay', e.target.checked)} />All-day event</label>
        <label className="text-xs block">IANA timezone<select value={event.timezone} onChange={(e) => patch('timezone', e.target.value)} className="mt-1 block w-full p-2 border rounded bg-white dark:bg-neutral-900">{COMMON_TIMEZONES.map((zone) => <option key={zone}>{zone}</option>)}</select></label>
        <label className="text-xs block">Location<input value={event.location} onChange={(e) => patch('location', e.target.value)} className="mt-1 block w-full p-2 border rounded bg-white dark:bg-neutral-900" /></label>
        <label className="text-xs block">Description<textarea value={event.description} onChange={(e) => patch('description', e.target.value)} rows={4} className="mt-1 block w-full p-2 border rounded bg-white dark:bg-neutral-900" /></label>
        <label className="text-xs block">Attendees (email, comma/semicolon separated)<textarea value={attendeeText} onChange={(e) => syncAttendees(e.target.value)} rows={2} placeholder="alice@example.com, bob@example.com" className="mt-1 block w-full p-2 border rounded bg-white dark:bg-neutral-900" /></label>
      </div>

      <div className="space-y-3">
        <div className="p-4 border rounded-xl space-y-3">
          <div className="font-semibold text-xs flex items-center gap-1"><CalendarDays className="w-4 h-4" />Recurrence</div>
          <div className="grid grid-cols-2 gap-2"><select value={event.recurrence} onChange={(e) => patch('recurrence', e.target.value as EventRecurrence)} className="p-2 border rounded bg-white dark:bg-neutral-900 text-xs"><option>NONE</option><option>DAILY</option><option>WEEKLY</option><option>MONTHLY</option><option>YEARLY</option></select><label className="text-xs">Interval<input type="number" min={1} value={event.recurrenceInterval || 1} onChange={(e) => patch('recurrenceInterval', Math.max(1, Number(e.target.value)))} className="mt-1 w-full p-1.5 border rounded bg-white dark:bg-neutral-900" /></label></div>
          {event.recurrence === 'WEEKLY' && <div className="flex flex-wrap gap-1">{WEEKDAYS.map((day) => { const active = event.recurrenceByWeekday?.includes(day) || false; return <button type="button" key={day} onClick={() => patch('recurrenceByWeekday', active ? (event.recurrenceByWeekday || []).filter((v) => v !== day) : [...(event.recurrenceByWeekday || []), day])} className={`px-2 py-1 text-[11px] border rounded ${active ? 'bg-indigo-600 text-white' : ''}`}>{day}</button>; })}</div>}
          {event.recurrence !== 'NONE' && <div className="grid grid-cols-2 gap-2"><label className="text-xs">Repeat count<input type="number" min={1} value={event.repeatCount || ''} onChange={(e) => setEvent((c) => ({ ...c, repeatCount: e.target.value ? Number(e.target.value) : undefined, repeatUntil: e.target.value ? undefined : c.repeatUntil }))} className="mt-1 w-full p-1.5 border rounded bg-white dark:bg-neutral-900" /></label><label className="text-xs">Or until<input type="date" value={event.repeatUntil || ''} onChange={(e) => setEvent((c) => ({ ...c, repeatUntil: e.target.value || undefined, repeatCount: e.target.value ? undefined : c.repeatCount }))} className="mt-1 w-full p-1.5 border rounded bg-white dark:bg-neutral-900" /></label></div>}
        </div>
        <div className="p-4 border rounded-xl space-y-3"><div className="font-semibold text-xs">Delivery & metadata</div><div className="grid grid-cols-2 gap-2"><label className="text-xs">Primary reminder<select value={event.reminderMinutes} onChange={(e) => patch('reminderMinutes', Number(e.target.value) as EventReminder)} className="block mt-1 w-full p-2 border rounded bg-white dark:bg-neutral-900"><option value={0}>none</option><option value={5}>5 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 hour</option><option value={1440}>1 day</option></select></label><label className="text-xs">Extra reminder<select value={event.additionalReminders?.[0] || 0} onChange={(e) => patch('additionalReminders', Number(e.target.value) ? [Number(e.target.value)] : [])} className="block mt-1 w-full p-2 border rounded bg-white dark:bg-neutral-900"><option value={0}>none</option><option value={30}>30 min</option><option value={60}>1 hour</option><option value={1440}>1 day</option></select></label><label className="text-xs">Status<select value={event.status || 'CONFIRMED'} onChange={(e) => patch('status', e.target.value as CalendarEventData['status'])} className="block mt-1 w-full p-2 border rounded bg-white dark:bg-neutral-900"><option>CONFIRMED</option><option>TENTATIVE</option><option>CANCELLED</option></select></label><label className="text-xs">Calendar visibility<select value={event.transparency || 'OPAQUE'} onChange={(e) => patch('transparency', e.target.value as CalendarEventData['transparency'])} className="block mt-1 w-full p-2 border rounded bg-white dark:bg-neutral-900"><option value="OPAQUE">Busy</option><option value="TRANSPARENT">Free</option></select></label></div></div>
        {!validation.isValid && <div role="alert" className="p-3 border border-red-300 rounded text-xs text-red-700">{validation.errors.join(' ')}</div>}
        {validation.isValid && <div className="p-3 border border-emerald-300 rounded text-xs text-emerald-700">Portable event is valid. Timed recurrence UNTIL values are normalized to UTC while DTSTART/DTEND preserve the selected IANA zone.</div>}
        <div className="flex flex-wrap gap-2"><button onClick={download} disabled={!validation.isValid} className="px-3 py-2 text-xs rounded bg-emerald-600 text-white disabled:opacity-40 inline-flex gap-1"><Download className="w-3.5 h-3.5" />Download .ics</button><button onClick={copy} disabled={!validation.isValid} className="px-3 py-2 text-xs border rounded inline-flex gap-1"><Copy className="w-3.5 h-3.5" />{copied ? 'Copied' : 'Copy ICS'}</button><button onClick={() => open(generateGoogleCalendarUrl(event))} disabled={!validation.isValid} className="px-3 py-2 text-xs border rounded inline-flex gap-1"><ExternalLink className="w-3.5 h-3.5" />Google Calendar</button><button onClick={() => open(generateOutlookCalendarUrl(event))} disabled={!validation.isValid} className="px-3 py-2 text-xs border rounded inline-flex gap-1"><ExternalLink className="w-3.5 h-3.5" />Outlook</button></div>
      </div>
    </div>
  </div>;
};

export default CalendarEventMakerTool;
