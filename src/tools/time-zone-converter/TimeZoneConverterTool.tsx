import React, { useState, useMemo } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Sun,
  Moon,
  Briefcase,
  ArrowUpDown,
  Search,
  Calendar,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import {
  POPULAR_TIMEZONES,
  createDateInZone,
  formatZoneTime,
  generateComparisonSummary,
  ConvertedTimeRow,
} from '../../utilities/time-zone-converter';

interface TimeZoneConverterToolProps {
  initialText?: string;
}

export const TimeZoneConverterTool: React.FC<TimeZoneConverterToolProps> = () => {
  // Detect local timezone
  const userLocalZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  // Current Date & Time State
  const [sourceZone, setSourceZone] = useState<string>(userLocalZone);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [selectedHour, setSelectedHour] = useState<number>(() => new Date().getHours());
  const [selectedMinute, setSelectedMinute] = useState<number>(() => new Date().getMinutes());
  const [is24Hour, setIs24Hour] = useState<boolean>(true);

  // Selected Zones for Comparison
  const [activeZoneIds, setActiveZoneIds] = useState<string[]>([
    userLocalZone,
    'UTC',
    'America/New_York',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Seoul',
    'Asia/Tokyo',
  ]);

  // Zone Search & Add State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  // Calculate current reference Date
  const currentUtcDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return createDateInZone(y || 2026, m || 1, d || 1, selectedHour, selectedMinute, sourceZone);
  }, [selectedDate, selectedHour, selectedMinute, sourceZone]);

  // Comparison Rows
  const comparisonRows: ConvertedTimeRow[] = useMemo(() => {
    // Unique active zones
    const uniqueIds = Array.from(new Set(activeZoneIds));
    return uniqueIds.map((zoneId) =>
      formatZoneTime(currentUtcDate, zoneId, currentUtcDate, is24Hour)
    );
  }, [activeZoneIds, currentUtcDate, is24Hour]);

  // Set to current time ("Now")
  const handleSetNow = () => {
    const now = new Date();
    setSelectedDate(now.toISOString().split('T')[0]);
    setSelectedHour(now.getHours());
    setSelectedMinute(now.getMinutes());
  };

  // Slider change (minutes from 0 to 1439)
  const totalMinutes = selectedHour * 60 + selectedMinute;
  const handleSliderChange = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    setSelectedHour(h);
    setSelectedMinute(m);
  };

  // Add Zone
  const handleAddZone = (zoneId: string) => {
    if (!activeZoneIds.includes(zoneId)) {
      setActiveZoneIds([...activeZoneIds, zoneId]);
    }
    setSearchQuery('');
  };

  // Remove Zone
  const handleRemoveZone = (zoneId: string) => {
    setActiveZoneIds(activeZoneIds.filter((id) => id !== zoneId));
  };

  // Move Zone Up / Down
  const handleMoveZone = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= activeZoneIds.length) return;
    const updated = [...activeZoneIds];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;
    setActiveZoneIds(updated);
  };

  // Filter available zones for adding
  const filteredAvailableZones = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return POPULAR_TIMEZONES.filter(
      (z) =>
        (z.city.toLowerCase().includes(q) ||
          z.id.toLowerCase().includes(q) ||
          (z.country && z.country.toLowerCase().includes(q))) &&
        !activeZoneIds.includes(z.id)
    );
  }, [searchQuery, activeZoneIds]);

  // Copy Single Time
  const handleCopySingle = (row: ConvertedTimeRow) => {
    copyToClipboard(`${row.city}: ${row.formattedDate} ${row.formattedTime} (${row.utcOffset})`);
    setCopiedId(row.zoneId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy Full Comparison
  const handleCopyFull = () => {
    const summary = generateComparisonSummary(comparisonRows);
    copyToClipboard(summary);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <ToolShell
      toolId="time-zone-converter"
      title="Time Zone Converter"
      description="Compare times across global cities, check working hours, and resolve meeting times with native IANA time zone support."
      category="time"
      relatedToolIds={['date-calculator', 'timer-stopwatch', 'percentage-calculator']}
      outputToTransfer={generateComparisonSummary(comparisonRows)}
    >
      <div className="space-y-6">
        {/* Reference Time Selection Bar */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                Source Reference Time
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSetNow}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Now</span>
              </button>

              <button
                type="button"
                onClick={() => setIs24Hour(!is24Hour)}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 font-mono"
              >
                {is24Hour ? '24-Hour' : '12-Hour (AM/PM)'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Timezone Selector */}
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Source Time Zone
              </label>
              <select
                value={sourceZone}
                onChange={(e) => setSourceZone(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded font-medium"
              >
                {POPULAR_TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.city} ({tz.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Input */}
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Reference Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
              />
            </div>

            {/* Time Inputs */}
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Time ({sourceZone.split('/').pop()?.replace(/_/g, ' ')})
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(Math.min(23, Math.max(0, Number(e.target.value))))}
                  className="w-1/2 px-2.5 py-1.5 text-xs font-mono text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                />
                <span className="font-bold text-neutral-400">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={selectedMinute}
                  onChange={(e) => setSelectedMinute(Math.min(59, Math.max(0, Number(e.target.value))))}
                  className="w-1/2 px-2.5 py-1.5 text-xs font-mono text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                />
              </div>
            </div>
          </div>

          {/* Interactive Global Time Scroller Slider */}
          <div className="space-y-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800/80">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span className="text-[11px]">Slide to shift time:</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1439}
              step={15}
              value={totalMinutes}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:59</span>
            </div>
          </div>
        </div>

        {/* Add Location Search Bar */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search to add city or timezone (e.g. Sydney, Paris, Tokyo, Singapore)..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-2xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={handleCopyFull}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1.5 shrink-0"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Copied Summary' : 'Copy All Times'}</span>
            </button>
          </div>

          {/* Autocomplete dropdown for search */}
          {filteredAvailableZones.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredAvailableZones.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => handleAddZone(z.id)}
                  className="w-full px-3.5 py-2 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between text-neutral-800 dark:text-neutral-200"
                >
                  <div className="font-medium">
                    <span>{z.city}</span>
                    {z.country && <span className="text-neutral-400 ml-1.5">({z.country})</span>}
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">{z.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comparison Locations List Table / Cards */}
        <div className="space-y-2">
          {comparisonRows.map((row, index) => {
            const isSource = row.zoneId === sourceZone;

            return (
              <div
                key={row.zoneId}
                className={`p-3.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSource
                    ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800/80 shadow-2xs'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                }`}
              >
                {/* Left: City & Zone Meta */}
                <div className="flex items-center gap-3 min-w-0 sm:w-1/3">
                  <div className="flex flex-col gap-0.5 text-neutral-400">
                    <button
                      type="button"
                      onClick={() => handleMoveZone(index, 'up')}
                      disabled={index === 0}
                      className="hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-20 text-[10px]"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveZone(index, 'down')}
                      disabled={index === comparisonRows.length - 1}
                      className="hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-20 text-[10px]"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                        {row.city}
                      </span>
                      {isSource && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                          Source
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono truncate">
                      {row.zoneId} ({row.utcOffset})
                    </div>
                  </div>
                </div>

                {/* Center: Time, Date & Business Hour Badge */}
                <div className="flex items-center gap-4 sm:justify-center">
                  <div className="text-left sm:text-center">
                    <div className="text-base sm:text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100">
                      {row.formattedTime}
                    </div>
                    <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                      <span>{row.formattedDate}</span>
                      {row.dayDifference !== 'Same day' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          {row.dayDifference}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Business Hours Pill */}
                  <div
                    className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      row.isBusinessHours
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    {row.isBusinessHours ? <Sun className="w-3 h-3 text-amber-500" /> : <Moon className="w-3 h-3" />}
                    <span>{row.isBusinessHours ? 'Business Hours (9–18)' : 'Off Hours'}</span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopySingle(row)}
                    className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                    title="Copy this location time"
                  >
                    {copiedId === row.zoneId ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveZone(row.zoneId)}
                    disabled={comparisonRows.length <= 1}
                    className="p-1.5 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded disabled:opacity-20"
                    title="Remove from comparison list"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ToolShell>
  );
};

export default TimeZoneConverterTool;
