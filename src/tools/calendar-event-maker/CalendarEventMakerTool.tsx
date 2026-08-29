import React, { useState } from 'react';
import {
  CalendarDays,
  Clock,
  MapPin,
  Globe,
  Bell,
  Repeat,
  Download,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  CalendarEventData,
  COMMON_TIMEZONES,
  validateCalendarEvent,
  generateIcsFile,
  EventReminder,
  EventRecurrence,
} from '../../utilities/calendar-event';

const SAMPLE_EVENT: CalendarEventData = {
  title: 'Project Kickoff & Architecture Review',
  description: 'Discuss technical milestones, repository setup, and Phase 5 deliverables.',
  location: 'Design Studio / Virtual Meet',
  url: 'https://meet.google.com/abc-defg-hij',
  startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  startTime: '10:00',
  endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  endTime: '11:00',
  isAllDay: false,
  timezone: 'UTC',
  reminderMinutes: 15,
  recurrence: 'WEEKLY',
  repeatCount: 4,
};

export const CalendarEventMakerTool: React.FC = () => {
  const [event, setEvent] = useState<CalendarEventData>(SAMPLE_EVENT);
  const [copied, setCopied] = useState(false);

  const validation = validateCalendarEvent(event);

  const handleDownloadIcs = () => {
    if (!validation.isValid) return;
    const icsContent = generateIcsFile(event);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'calendar-event';
    a.href = url;
    a.download = `${slug}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyIcs = () => {
    if (!validation.isValid) return;
    const icsContent = generateIcsFile(event);
    navigator.clipboard.writeText(icsContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    const today = new Date().toISOString().split('T')[0];
    setEvent({
      title: '',
      description: '',
      location: '',
      url: '',
      startDate: today,
      startTime: '09:00',
      endDate: today,
      endTime: '10:00',
      isAllDay: false,
      timezone: 'UTC',
      reminderMinutes: 0,
      recurrence: 'NONE',
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Event Title *
            </label>
            <input
              type="text"
              value={event.title}
              onChange={(e) => setEvent({ ...event, title: e.target.value })}
              placeholder="e.g. Quarterly Team Strategy Review"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Date & Time Settings */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                Schedule & Timezone
              </span>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={event.isAllDay}
                  onChange={(e) => setEvent({ ...event, isAllDay: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                All-Day Event
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Starts On</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={event.startDate}
                    onChange={(e) => setEvent({ ...event, startDate: e.target.value })}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  />
                  {!event.isAllDay && (
                    <input
                      type="time"
                      value={event.startTime}
                      onChange={(e) => setEvent({ ...event, startTime: e.target.value })}
                      className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Ends On</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={event.endDate}
                    onChange={(e) => setEvent({ ...event, endDate: e.target.value })}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  />
                  {!event.isAllDay && (
                    <input
                      type="time"
                      value={event.endTime}
                      onChange={(e) => setEvent({ ...event, endTime: e.target.value })}
                      className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    />
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Timezone</label>
              <select
                value={event.timezone}
                onChange={(e) => setEvent({ ...event, timezone: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location & URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Location
              </label>
              <input
                type="text"
                value={event.location}
                onChange={(e) => setEvent({ ...event, location: e.target.value })}
                placeholder="e.g. Conference Room 3 or Address"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                Meeting URL
              </label>
              <input
                type="url"
                value={event.url}
                onChange={(e) => setEvent({ ...event, url: e.target.value })}
                placeholder="https://..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Description / Agenda
            </label>
            <textarea
              value={event.description}
              onChange={(e) => setEvent({ ...event, description: e.target.value })}
              rows={3}
              placeholder="Notes, agenda items, or dial-in instructions..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Recurrence & Reminders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Repeat className="w-3.5 h-3.5" />
                Recurrence
              </label>
              <select
                value={event.recurrence}
                onChange={(e) => setEvent({ ...event, recurrence: e.target.value as EventRecurrence })}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="NONE">Does Not Repeat</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Bell className="w-3.5 h-3.5" />
                Alarm / Notification
              </label>
              <select
                value={event.reminderMinutes}
                onChange={(e) => setEvent({ ...event, reminderMinutes: Number(e.target.value) as EventReminder })}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value={0}>No Alarm</option>
                <option value={5}>5 Minutes Before</option>
                <option value={10}>10 Minutes Before</option>
                <option value={15}>15 Minutes Before</option>
                <option value={30}>30 Minutes Before</option>
                <option value={60}>1 Hour Before</option>
                <option value={1440}>1 Day Before</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Preview & Actions Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
              <CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Event Card Preview</span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-900 shadow-xs space-y-2.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {event.title || 'Untitled Event'}
              </h3>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {event.startDate} {event.isAllDay ? '(All day)' : `${event.startTime} - ${event.endTime}`}
                  </span>
                </div>

                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{event.location}</span>
                  </div>
                )}

                {event.url && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{event.url}</span>
                  </div>
                )}
              </div>

              {event.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 line-clamp-3">
                  {event.description}
                </p>
              )}
            </div>

            {!validation.isValid ? (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 space-y-1">
                {validation.errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ready to download standard .ics calendar file</span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={handleDownloadIcs}
                disabled={!validation.isValid}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Download className="w-4 h-4" />
                Download .ICS Event File
              </button>

              <button
                onClick={handleCopyIcs}
                disabled={!validation.isValid}
                className="w-full py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'ICS Code Copied' : 'Copy Raw ICS File Content'}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEvent(SAMPLE_EVENT)}
              className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Sample Event
            </button>
            <button
              onClick={handleClear}
              className="py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarEventMakerTool;
