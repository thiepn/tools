import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Calendar,
  CalendarDays,
  Clock,
  CalendarPlus,
  Briefcase,
  Cake,
  Info,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  parseDateString,
  formatDateString,
  calculateDateDifference,
  addSubtractTime,
  calculateAge,
  calculateWorkingDays,
  type CalendarDate,
} from '../../utilities/date-calculator';
import { copyToClipboard } from '../../utilities/clipboard';

const getTodayString = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const DateCalculatorTool: React.FC = () => {
  const todayStr = useMemo(() => getTodayString(), []);
  const [activeTab, setActiveTab] = useState<'diff' | 'addsub' | 'age' | 'workdays'>('diff');

  // Tab 1: Difference
  const [diffStart, setDiffStart] = useState(todayStr);
  const [diffEnd, setDiffEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [includeEndDate, setIncludeEndDate] = useState(false);

  // Tab 2: Add / Subtract
  const [baseDate, setBaseDate] = useState(todayStr);
  const [amount, setAmount] = useState(14);
  const [unit, setUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('days');
  const [operation, setOperation] = useState<'add' | 'subtract'>('add');

  // Tab 3: Age
  const [birthDate, setBirthDate] = useState('1995-06-15');
  const [asOfDate, setAsOfDate] = useState(todayStr);

  // Tab 4: Working Days
  const [workStart, setWorkStart] = useState(todayStr);
  const [workEnd, setWorkEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [includeWorkEndDate, setIncludeWorkEndDate] = useState(true);

  const [copied, setCopied] = useState(false);

  // Calcs
  const diffResult = useMemo(() => {
    const d1 = parseDateString(diffStart);
    const d2 = parseDateString(diffEnd);
    if (!d1 || !d2) return null;
    return calculateDateDifference(d1, d2, includeEndDate);
  }, [diffStart, diffEnd, includeEndDate]);

  const addSubResult = useMemo(() => {
    const d = parseDateString(baseDate);
    if (!d) return null;
    const res = addSubtractTime(d, amount, unit, operation);
    return formatDateString(res);
  }, [baseDate, amount, unit, operation]);

  const ageResult = useMemo(() => {
    const b = parseDateString(birthDate);
    const a = parseDateString(asOfDate);
    if (!b || !a) return null;
    return calculateAge(b, a);
  }, [birthDate, asOfDate]);

  const workDaysResult = useMemo(() => {
    const s = parseDateString(workStart);
    const e = parseDateString(workEnd);
    if (!s || !e) return null;
    return calculateWorkingDays(s, e, includeWorkEndDate);
  }, [workStart, workEnd, includeWorkEndDate]);

  const currentSummaryResult = useMemo(() => {
    if (activeTab === 'diff' && diffResult) {
      return `${diffResult.totalDays} days (${diffResult.weeks} weeks, ${diffResult.remainingDays} days)`;
    }
    if (activeTab === 'addsub' && addSubResult) {
      return addSubResult;
    }
    if (activeTab === 'age' && ageResult && !ageResult.isInvalid) {
      return `${ageResult.years} years, ${ageResult.months} months, ${ageResult.days} days`;
    }
    if (activeTab === 'workdays' && workDaysResult) {
      return `${workDaysResult.workingDays} working days`;
    }
    return '';
  }, [activeTab, diffResult, addSubResult, ageResult, workDaysResult]);

  const handleCopy = async () => {
    if (!currentSummaryResult) return;
    const success = await copyToClipboard(currentSummaryResult);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ToolShell
      toolId="date-calculator"
      title="Date Calculator"
      description="Calculate differences between dates, add/subtract calendar units, find exact age, and compute working days."
      category="time"
      relatedToolIds={['unit-converter', 'percentage-calculator', 'word-counter']}
      outputToTransfer={currentSummaryResult}
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm font-medium overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('diff')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'diff'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Date Difference</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('addsub')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'addsub'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Add / Subtract Time</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('age')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'age'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Cake className="w-4 h-4" />
            <span>Age Calculator</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workdays')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'workdays'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Working Days</span>
          </button>
        </div>

        {/* Tab 1: Date Difference */}
        {activeTab === 'diff' && (
          <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Start Date
                </label>
                <input
                  type="date"
                  value={diffStart}
                  onChange={(e) => setDiffStart(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  End Date
                </label>
                <input
                  type="date"
                  value={diffEnd}
                  onChange={(e) => setDiffEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm font-mono"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeEndDate}
                onChange={(e) => setIncludeEndDate(e.target.checked)}
                className="rounded border-neutral-300 text-blue-600"
              />
              <span>Include end date in calculation (inclusive)</span>
            </label>

            {diffResult && (
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800 text-center">
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                    {diffResult.totalDays.toLocaleString()}
                  </div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">
                    Total Days
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800 text-center">
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                    {diffResult.weeks}
                  </div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">
                    Weeks
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800 text-center">
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                    {diffResult.remainingDays}
                  </div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">
                    Remaining Days
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Add / Subtract */}
        {activeTab === 'addsub' && (
          <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Starting Date
                </label>
                <input
                  type="date"
                  value={baseDate}
                  onChange={(e) => setBaseDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Operation & Amount
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={operation}
                    onChange={(e) => setOperation(e.target.value as 'add' | 'subtract')}
                    className="px-2.5 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm font-medium"
                  >
                    <option value="add">Add (+)</option>
                    <option value="subtract">Subtract (-)</option>
                  </select>

                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-20 px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm font-mono text-center"
                  />

                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as 'days' | 'weeks' | 'months' | 'years')}
                    className="flex-1 px-2.5 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm font-medium"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
              </div>
            </div>

            {addSubResult && (
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Calculated Target Date
                </div>
                <div className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 font-mono mt-1">
                  {addSubResult}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Age */}
        {activeTab === 'age' && (
          <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Age As Of Date
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm font-mono"
                />
              </div>
            </div>

            {ageResult && !ageResult.isInvalid && (
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                      {ageResult.years}
                    </div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">Years</div>
                  </div>

                  <div className="p-3 bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                      {ageResult.months}
                    </div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">Months</div>
                  </div>

                  <div className="p-3 bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                      {ageResult.days}
                    </div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">Days</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400 pt-1">
                  <span>Total lifetime days: <strong className="font-mono text-neutral-900 dark:text-neutral-100">{ageResult.totalDays.toLocaleString()}</strong></span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    Next birthday in: {ageResult.daysToNextBirthday} day{ageResult.daysToNextBirthday !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Working Days */}
        {activeTab === 'workdays' && (
          <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Start Date
                </label>
                <input
                  type="date"
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  End Date
                </label>
                <input
                  type="date"
                  value={workEnd}
                  onChange={(e) => setWorkEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm font-mono"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeWorkEndDate}
                onChange={(e) => setIncludeWorkEndDate(e.target.checked)}
                className="rounded border-neutral-300 text-blue-600"
              />
              <span>Include end date</span>
            </label>

            {/* Disclaimer note */}
            <div className="p-2.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Working-day calculations exclude weekends but do not account for public holidays.</span>
            </div>

            {workDaysResult && (
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {workDaysResult.workingDays}
                  </div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">Working Days</div>
                </div>

                <div className="p-3 bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800">
                  <div className="text-2xl font-bold text-neutral-500 font-mono">
                    {workDaysResult.weekendDays}
                  </div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">Weekend Days</div>
                </div>

                <div className="p-3 bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800">
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                    {workDaysResult.totalCalendarDays}
                  </div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">Total Days</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Global Copy Result Bar */}
        {currentSummaryResult && (
          <div className="flex items-center justify-between p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs">
            <span className="font-mono text-neutral-900 dark:text-neutral-100 font-medium">
              {currentSummaryResult}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded font-medium border transition-colors ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800'
              }`}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy result'}</span>
            </button>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default DateCalculatorTool;
