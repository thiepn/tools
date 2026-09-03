import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { getPublicP20Task, PUBLIC_P20_TASKS } from '../../expansion/publicP20Tasks';
import { copyToClipboard } from '../../utilities/clipboard';
import {
  bestTextColor,
  calculateHabitStats,
  calculateScreenDensity,
  categorizeEisenhower,
  englishWordsToNumber,
  estimateTransferTime,
  formatCompactDuration,
  generateColorPalette,
  normalizeHexColor,
  numberToEnglishWords,
  rankDecisionOptions,
  recentDateKeys,
  summarizeBudget,
  type DecisionCriterion,
  type DecisionOption,
  type FileSizeUnit,
  type PaletteHarmony,
  type PriorityTask,
  type TransferSpeedUnit,
} from '../../utilities/p20-final-tools';

const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100';
const smallInputClass =
  'w-full min-w-20 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100';

function readId() {
  const clean = location.hash.replace(/^#\/?/, '').split('?')[0];
  return clean.startsWith('tool/') ? clean.slice(5).split('/')[0] : clean.split('/')[0];
}

function related(id: string): string[] {
  if (id === 'decision-matrix') return ['weighted-average-calculator', 'checklist', 'random-picker'];
  if (id === 'monthly-budget-planner') return ['savings-goal-calculator', 'bill-splitter', 'compound-interest-calculator'];
  if (id === 'number-words-converter') return ['number-base-converter', 'case-converter', 'text-cleaner'];
  if (id === 'screen-ppi-calculator') return ['aspect-ratio-calculator', 'dpi-print-size-calculator', 'device-info'];
  if (id === 'download-time-calculator') return ['internet-speed-test', 'unit-converter', 'connection-stability-test'];
  if (id === 'color-palette-generator') return ['color-converter', 'color-contrast-checker', 'palette-extractor'];
  if (id === 'habit-consistency-tracker') return ['checklist', 'timer-stopwatch', 'countdown-to-date'];
  return ['checklist', 'weekly-schedule-builder', 'decision-matrix'];
}

function Button({
  children,
  onClick,
  disabled = false,
  tone = 'primary',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  const style =
    tone === 'primary'
      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
      : tone === 'danger'
        ? 'border border-red-300 bg-white text-red-700 dark:border-red-900 dark:bg-neutral-950 dark:text-red-300'
        : 'border border-neutral-300 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${style}`}
    >
      {children}
    </button>
  );
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-neutral-950 dark:text-neutral-50">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
      {children}
    </div>
  );
}

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!(await copyToClipboard(value))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button onClick={() => void copy()} tone="secondary" disabled={!value}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

export default function FinalGeneralUtilityTools() {
  const task = useMemo(
    () => getPublicP20Task(typeof window !== 'undefined' ? readId() : '') ?? PUBLIC_P20_TASKS[0],
    []
  );

  return (
    <ToolShell
      toolId={task.id}
      title={task.name}
      description={task.description}
      category={task.category}
      relatedToolIds={related(task.id)}
    >
      {task.mode === 'decision-matrix' ? (
        <DecisionMatrixTool />
      ) : task.mode === 'budget-planner' ? (
        <BudgetPlannerTool />
      ) : task.mode === 'number-words' ? (
        <NumberWordsTool />
      ) : task.mode === 'screen-ppi' ? (
        <ScreenPpiTool />
      ) : task.mode === 'download-time' ? (
        <DownloadTimeTool />
      ) : task.mode === 'palette-generator' ? (
        <PaletteGeneratorTool />
      ) : task.mode === 'habit-tracker' ? (
        <HabitTrackerTool />
      ) : (
        <EisenhowerTool />
      )}
    </ToolShell>
  );
}

function DecisionMatrixTool() {
  const [criteria, setCriteria] = useState<DecisionCriterion[]>([
    { name: 'Impact', weight: 40 },
    { name: 'Cost / value', weight: 30 },
    { name: 'Ease', weight: 30 },
  ]);
  const [options, setOptions] = useState<DecisionOption[]>([
    { name: 'Option A', scores: [8, 6, 7] },
    { name: 'Option B', scores: [6, 9, 8] },
  ]);
  const ranked = useMemo(() => rankDecisionOptions(criteria, options), [criteria, options]);
  const totalWeight = criteria.reduce((sum, criterion) => sum + Math.max(0, Number(criterion.weight) || 0), 0);

  const setCriterion = (index: number, patch: Partial<DecisionCriterion>) => {
    setCriteria((current) => current.map((criterion, i) => (i === index ? { ...criterion, ...patch } : criterion)));
  };
  const setOptionName = (index: number, name: string) => {
    setOptions((current) => current.map((option, i) => (i === index ? { ...option, name } : option)));
  };
  const setScore = (optionIndex: number, criterionIndex: number, value: number) => {
    setOptions((current) =>
      current.map((option, i) => {
        if (i !== optionIndex) return option;
        const scores = [...option.scores];
        scores[criterionIndex] = Math.min(10, Math.max(0, Number.isFinite(value) ? value : 0));
        return { ...option, scores };
      })
    );
  };
  const addCriterion = () => {
    setCriteria((current) => [...current, { name: `Criterion ${current.length + 1}`, weight: 10 }]);
    setOptions((current) => current.map((option) => ({ ...option, scores: [...option.scores, 5] })));
  };
  const removeCriterion = (index: number) => {
    if (criteria.length <= 1) return;
    setCriteria((current) => current.filter((_, i) => i !== index));
    setOptions((current) => current.map((option) => ({ ...option, scores: option.scores.filter((_, i) => i !== index) })));
  };
  const addOption = () =>
    setOptions((current) => [
      ...current,
      { name: `Option ${String.fromCharCode(65 + current.length)}`, scores: criteria.map(() => 5) },
    ]);
  const removeOption = (index: number) => options.length > 1 && setOptions((current) => current.filter((_, i) => i !== index));

  const exportText = ranked
    .map((option, index) => `${index + 1}. ${option.name}: ${option.score.toFixed(2)}/10`)
    .join('\n');

  return (
    <div className="space-y-5">
      <Notice>
        Give each criterion a relative weight and score every option from 0–10, where 10 is best. Weights do not need to add to 100; they are normalized automatically.
      </Notice>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-[760px] w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-950">
            <tr>
              <th className="p-3 text-left">Option</th>
              {criteria.map((criterion, index) => (
                <th key={index} className="p-3 text-left align-top">
                  <input
                    aria-label={`Criterion ${index + 1} name`}
                    className={smallInputClass}
                    value={criterion.name}
                    onChange={(event) => setCriterion(index, { name: event.target.value })}
                  />
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      aria-label={`${criterion.name || `Criterion ${index + 1}`} weight`}
                      type="number"
                      min="0"
                      step="1"
                      className={smallInputClass}
                      value={criterion.weight}
                      onChange={(event) => setCriterion(index, { weight: Number(event.target.value) })}
                    />
                    <button
                      type="button"
                      disabled={criteria.length <= 1}
                      onClick={() => removeCriterion(index)}
                      className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950/20"
                      aria-label={`Remove ${criterion.name || `criterion ${index + 1}`}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="p-3 text-left">Weighted score</th>
              <th className="w-10 p-3" />
            </tr>
          </thead>
          <tbody>
            {options.map((option, optionIndex) => {
              const result = ranked.find((row) => row.name === (option.name.trim() || 'Untitled option'));
              return (
                <tr key={optionIndex} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="p-3">
                    <input
                      aria-label={`Option ${optionIndex + 1} name`}
                      className={smallInputClass}
                      value={option.name}
                      onChange={(event) => setOptionName(optionIndex, event.target.value)}
                    />
                  </td>
                  {criteria.map((criterion, criterionIndex) => (
                    <td key={criterionIndex} className="p-3">
                      <input
                        aria-label={`${option.name || `Option ${optionIndex + 1}`} score for ${criterion.name || `criterion ${criterionIndex + 1}`}`}
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        className={smallInputClass}
                        value={option.scores[criterionIndex] ?? 0}
                        onChange={(event) => setScore(optionIndex, criterionIndex, Number(event.target.value))}
                      />
                    </td>
                  ))}
                  <td className="p-3 font-bold tabular-nums">{totalWeight > 0 ? `${result?.score.toFixed(2) ?? '0.00'} / 10` : '—'}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      disabled={options.length <= 1}
                      onClick={() => removeOption(optionIndex)}
                      className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950/20"
                      aria-label={`Remove ${option.name || `option ${optionIndex + 1}`}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={addOption} tone="secondary"><Plus className="h-4 w-4" /> Add option</Button>
        <Button onClick={addCriterion} tone="secondary"><Plus className="h-4 w-4" /> Add criterion</Button>
        <CopyButton value={exportText} label="Copy ranking" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {ranked.map((option, index) => (
          <div key={`${option.name}-${index}`} className={`rounded-xl border p-4 ${index === 0 && totalWeight > 0 ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-neutral-200 dark:border-neutral-800'}`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">#{index + 1}</div>
            <div className="mt-1 font-bold">{option.name}</div>
            <div className="mt-2 text-2xl font-bold tabular-nums">{totalWeight > 0 ? option.score.toFixed(2) : '—'}<span className="text-sm font-medium text-neutral-500"> / 10</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetPlannerTool() {
  const [currency, setCurrency] = useState('EUR');
  const [income, setIncome] = useState([3000, 0]);
  const [expenses, setExpenses] = useState([
    { category: 'Housing', amount: 1100 },
    { category: 'Food', amount: 450 },
    { category: 'Transport', amount: 180 },
    { category: 'Utilities', amount: 220 },
    { category: 'Other', amount: 250 },
  ]);
  const summary = useMemo(() => summarizeBudget(income, expenses), [income, expenses]);
  const money = (value: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  };

  return (
    <div className="space-y-5">
      <Notice>This is a local planning worksheet, not financial advice. Nothing is saved or transmitted unless you copy the summary yourself.</Notice>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <section className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold">Monthly income</h3>
            <select className="rounded-md border bg-transparent px-2 py-1 text-sm dark:border-neutral-700" value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Currency">
              {['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'KRW', 'CAD', 'AUD'].map((code) => <option key={code}>{code}</option>)}
            </select>
          </div>
          {income.map((value, index) => (
            <label key={index} className="block text-sm font-medium">
              {index === 0 ? 'Primary income' : 'Other income'}
              <input type="number" min="0" step="0.01" className={`${inputClass} mt-1`} value={value} onChange={(event) => setIncome((current) => current.map((item, i) => (i === index ? Number(event.target.value) : item)))} />
            </label>
          ))}
        </section>

        <section className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Monthly expenses</h3><Button tone="secondary" onClick={() => setExpenses((current) => [...current, { category: 'New category', amount: 0 }])}><Plus className="h-4 w-4" /> Add</Button></div>
          <div className="space-y-2">
            {expenses.map((expense, index) => (
              <div key={index} className="grid grid-cols-[1fr_8rem_auto] gap-2">
                <input aria-label={`Expense ${index + 1} category`} className={smallInputClass} value={expense.category} onChange={(event) => setExpenses((current) => current.map((item, i) => (i === index ? { ...item, category: event.target.value } : item)))} />
                <input aria-label={`${expense.category || `Expense ${index + 1}`} amount`} type="number" min="0" step="0.01" className={smallInputClass} value={expense.amount} onChange={(event) => setExpenses((current) => current.map((item, i) => (i === index ? { ...item, amount: Number(event.target.value) } : item)))} />
                <button type="button" onClick={() => setExpenses((current) => current.filter((_, i) => i !== index))} className="rounded p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20" aria-label={`Remove ${expense.category || `expense ${index + 1}`}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        <Metric label="Income" value={money(summary.totalIncome)} />
        <Metric label="Expenses" value={money(summary.totalExpenses)} />
        <Metric label="Remaining" value={money(summary.balance)} sub={summary.balance < 0 ? 'Expenses exceed income' : 'Available after listed expenses'} />
        <Metric label="Savings rate" value={summary.savingsRate === null ? '—' : `${summary.savingsRate}%`} />
      </div>

      {summary.categoryTotals.length > 0 && (
        <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="font-bold">Expense breakdown</h3>
          <div className="mt-3 space-y-3">
            {summary.categoryTotals.map((row) => (
              <div key={row.category}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span>{row.category}</span><span className="font-semibold tabular-nums">{money(row.amount)} · {row.share}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><div className="h-full rounded-full bg-neutral-500" style={{ width: `${Math.min(100, row.share)}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NumberWordsTool() {
  const [direction, setDirection] = useState<'number' | 'words'>('number');
  const [input, setInput] = useState('1234567.89');
  const result = useMemo(() => {
    try {
      return { value: direction === 'number' ? numberToEnglishWords(input) : englishWordsToNumber(input), error: '' };
    } catch (error) {
      return { value: '', error: error instanceof Error ? error.message : String(error) };
    }
  }, [direction, input]);

  const switchDirection = (next: 'number' | 'words') => {
    if (next === direction) return;
    setDirection(next);
    setInput(next === 'number' ? '1234567.89' : 'one million two hundred thirty-four thousand five hundred sixty-seven point eight nine');
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-neutral-300 p-1 dark:border-neutral-700">
        <button type="button" onClick={() => switchDirection('number')} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${direction === 'number' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : ''}`}>Number → words</button>
        <button type="button" onClick={() => switchDirection('words')} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${direction === 'words' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : ''}`}>Words → number</button>
      </div>
      <label className="block text-sm font-semibold">{direction === 'number' ? 'Number' : 'English number words'}
        <textarea rows={5} className={`${inputClass} mt-1 font-mono`} value={input} onChange={(event) => setInput(event.target.value)} spellCheck={direction === 'words'} />
      </label>
      {result.error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{result.error}</div> : (
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Result</div>
          <div className="mt-2 whitespace-pre-wrap break-words text-lg font-semibold">{result.value}</div>
          <div className="mt-3"><CopyButton value={result.value} /></div>
        </div>
      )}
      <Notice>The converter uses English short-scale names and supports negative values plus decimal digits spoken after “point”.</Notice>
    </div>
  );
}

function ScreenPpiTool() {
  const [width, setWidth] = useState(2560);
  const [height, setHeight] = useState(1600);
  const [diagonal, setDiagonal] = useState(16);
  const result = useMemo(() => {
    try {
      return { value: calculateScreenDensity(width, height, diagonal), error: '' };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [width, height, diagonal]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">Horizontal pixels<input type="number" min="1" step="1" className={`${inputClass} mt-1`} value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
        <label className="text-sm font-semibold">Vertical pixels<input type="number" min="1" step="1" className={`${inputClass} mt-1`} value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
        <label className="text-sm font-semibold">Diagonal size (inches)<input type="number" min="0.1" step="0.1" className={`${inputClass} mt-1`} value={diagonal} onChange={(event) => setDiagonal(Number(event.target.value))} /></label>
      </div>
      {result.error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{result.error}</div>}
      {result.value && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        <Metric label="Pixel density" value={`${result.value.ppi} PPI`} />
        <Metric label="Pixel pitch" value={`${result.value.pixelPitchMm} mm`} sub="Physical size of one pixel" />
        <Metric label="Pixels" value={`${result.value.megapixels} MP`} />
        <Metric label="Aspect ratio" value={`${result.value.aspectWidth}:${result.value.aspectHeight}`} />
      </div>}
      <Notice>PPI is calculated from the panel’s native pixel resolution and physical diagonal. Browser zoom and operating-system scaling do not change the physical panel PPI.</Notice>
    </div>
  );
}

function DownloadTimeTool() {
  const [size, setSize] = useState(10);
  const [sizeUnit, setSizeUnit] = useState<FileSizeUnit>('GB');
  const [speed, setSpeed] = useState(100);
  const [speedUnit, setSpeedUnit] = useState<TransferSpeedUnit>('Mbps');
  const estimate = useMemo(() => {
    try {
      return { value: estimateTransferTime(size, sizeUnit, speed, speedUnit), error: '' };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [size, sizeUnit, speed, speedUnit]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">File size<div className="mt-1 grid grid-cols-[1fr_7rem] gap-2"><input type="number" min="0" step="0.01" className={inputClass} value={size} onChange={(event) => setSize(Number(event.target.value))} /><select className={inputClass} value={sizeUnit} onChange={(event) => setSizeUnit(event.target.value as FileSizeUnit)}>{['B', 'KB', 'MB', 'GB', 'TB', 'KiB', 'MiB', 'GiB', 'TiB'].map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
        <label className="text-sm font-semibold">Connection throughput<div className="mt-1 grid grid-cols-[1fr_7rem] gap-2"><input type="number" min="0.001" step="0.1" className={inputClass} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><select className={inputClass} value={speedUnit} onChange={(event) => setSpeedUnit(event.target.value as TransferSpeedUnit)}>{['Kbps', 'Mbps', 'Gbps', 'KB/s', 'MB/s', 'GB/s'].map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
      </div>
      {estimate.error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{estimate.error}</div>}
      {estimate.value && <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
        <Metric label="Estimated time" value={formatCompactDuration(estimate.value.seconds)} sub={`${estimate.value.seconds.toLocaleString(undefined, { maximumFractionDigits: 2 })} seconds theoretical`} />
        <Metric label="Data" value={estimate.value.bytes >= 1e9 ? `${(estimate.value.bytes / 1e9).toFixed(2)} GB` : `${(estimate.value.bytes / 1e6).toFixed(2)} MB`} />
        <Metric label="Throughput" value={`${(estimate.value.bitsPerSecond / 1e6).toFixed(2)} Mbps`} />
      </div>}
      <Notice>Real transfers are usually slower because of protocol overhead, server limits, Wi-Fi variation, congestion, encryption, disk speed, and connection ramp-up.</Notice>
    </div>
  );
}

function PaletteGeneratorTool() {
  const [base, setBase] = useState('#2563EB');
  const [harmony, setHarmony] = useState<PaletteHarmony>('analogous');
  const [error, setError] = useState('');
  const normalized = useMemo(() => {
    try {
      const color = normalizeHexColor(base);
      return { color, palette: generateColorPalette(color, harmony) };
    } catch (caught) {
      return { color: '', palette: [] as string[], error: caught instanceof Error ? caught.message : String(caught) };
    }
  }, [base, harmony]);
  const randomize = () => {
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    setBase(`#${[...bytes].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`);
    setError('');
  };
  const setTextBase = (value: string) => {
    setBase(value);
    setError('');
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-semibold">Base<input type="color" className="mt-1 h-10 w-16 cursor-pointer rounded border border-neutral-300 bg-transparent p-1 dark:border-neutral-700" value={normalized.color || '#2563EB'} onChange={(event) => setTextBase(event.target.value.toUpperCase())} /></label>
        <label className="text-sm font-semibold">HEX<input className={`${inputClass} mt-1 font-mono`} value={base} onChange={(event) => setTextBase(event.target.value)} onBlur={() => { try { setBase(normalizeHexColor(base)); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } }} /></label>
        <label className="text-sm font-semibold">Harmony<select className={`${inputClass} mt-1`} value={harmony} onChange={(event) => setHarmony(event.target.value as PaletteHarmony)}><option value="complementary">Complementary</option><option value="analogous">Analogous</option><option value="triadic">Triadic</option><option value="tetradic">Tetradic</option><option value="split-complementary">Split complementary</option><option value="monochromatic">Monochromatic</option></select></label>
        <Button tone="secondary" onClick={randomize}><RefreshCw className="h-4 w-4" /> Random base</Button>
      </div>
      {(error || normalized.error) && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{error || normalized.error}</div>}
      {normalized.palette.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-live="polite">
        {normalized.palette.map((color) => <PaletteCard key={color} color={color} />)}
      </div>}
      {normalized.palette.length > 0 && <CopyButton value={normalized.palette.join('\n')} label="Copy palette" />}
      <Notice>Harmony generation uses HSL hue relationships. Treat it as a starting point and verify text/background combinations with the Color Contrast Checker.</Notice>
    </div>
  );
}

function PaletteCard({ color }: { color: string }) {
  const [copied, setCopied] = useState(false);
  const foreground = bestTextColor(color);
  const copy = async () => {
    if (!(await copyToClipboard(color))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return <button type="button" onClick={() => void copy()} className="overflow-hidden rounded-xl border border-neutral-200 text-left shadow-sm dark:border-neutral-800" aria-label={`Copy ${color}`}><div className="flex h-28 items-center justify-center text-sm font-bold" style={{ background: color, color: foreground }}>{copied ? 'Copied' : color}</div><div className="bg-white px-3 py-2 font-mono text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">{color}</div></button>;
}

const HABIT_STORAGE_KEY = 'tiny-tools:p20:habit:v1';
function localDateKey() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function HabitTrackerTool() {
  const [habitName, setHabitName] = useState('Daily habit');
  const [windowDays, setWindowDays] = useState(30);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const today = localDateKey();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HABIT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { habitName?: unknown; completed?: unknown };
        if (typeof parsed.habitName === 'string') setHabitName(parsed.habitName);
        if (Array.isArray(parsed.completed)) setCompleted(parsed.completed.filter((value): value is string => typeof value === 'string'));
      }
    } catch {
      // Storage is optional; the tracker still works for the current tab.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify({ habitName, completed }));
    } catch {
      // Storage can be disabled in private/hardened contexts.
    }
  }, [completed, habitName, loaded]);

  const dates = useMemo(() => recentDateKeys(windowDays, today), [windowDays, today]);
  const stats = useMemo(() => calculateHabitStats(completed, windowDays, today), [completed, windowDays, today]);
  const completedSet = useMemo(() => new Set(completed), [completed]);
  const toggle = (key: string) => setCompleted((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key].sort());
  const clear = () => setCompleted([]);

  return (
    <div className="space-y-5">
      <Notice>Habit name and checked dates are stored only in this browser with localStorage. If storage is blocked, the tracker still works until the tab is closed.</Notice>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <label className="text-sm font-semibold">Habit<input className={`${inputClass} mt-1`} value={habitName} onChange={(event) => setHabitName(event.target.value)} /></label>
        <label className="text-sm font-semibold">Window<select className={`${inputClass} mt-1`} value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value))}><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></select></label>
        <Button tone="danger" onClick={clear} disabled={completed.length === 0}>Clear checks</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3" aria-live="polite"><Metric label="Current streak" value={`${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'}`} /><Metric label="Best streak" value={`${stats.bestStreak} day${stats.bestStreak === 1 ? '' : 's'}`} /><Metric label="Completion" value={`${stats.completionRate}%`} sub={`${stats.completedInWindow}/${windowDays} days in this window`} /></div>
      <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-bold">{habitName.trim() || 'Habit'}</h3><span className="text-xs text-neutral-500">Tap a day to toggle</span></div>
        <div className="grid grid-cols-7 gap-2">
          {dates.map((key) => {
            const active = completedSet.has(key);
            const date = new Date(`${key}T12:00:00`);
            const label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            return <button key={key} type="button" aria-pressed={active} title={label} onClick={() => toggle(key)} className={`aspect-square min-h-11 rounded-lg border text-xs font-semibold transition-colors ${active ? 'border-emerald-600 bg-emerald-600 text-white' : key === today ? 'border-blue-400 bg-blue-50 text-blue-800 dark:bg-blue-950/20 dark:text-blue-200' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}><span className="block text-[10px] opacity-75">{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>{date.getDate()}</button>;
          })}
        </div>
      </section>
    </div>
  );
}

function EisenhowerTool() {
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(true);
  const [important, setImportant] = useState(true);
  const [tasks, setTasks] = useState<PriorityTask[]>([
    { id: 'sample-1', text: 'Finish the task with the nearest real deadline', urgent: true, important: true },
    { id: 'sample-2', text: 'Block time for the important long-term project', urgent: false, important: true },
  ]);
  const groups = useMemo(() => categorizeEisenhower(tasks), [tasks]);
  const add = () => {
    const clean = text.trim();
    if (!clean) return;
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    setTasks((current) => [...current, { id, text: clean, urgent, important }]);
    setText('');
  };
  const remove = (id: string) => setTasks((current) => current.filter((task) => task.id !== id));
  const plan = [
    ['DO NOW', groups.doNow],
    ['SCHEDULE', groups.schedule],
    ['DELEGATE', groups.delegate],
    ['ELIMINATE / DEFER', groups.eliminate],
  ].map(([title, list]) => `${title}\n${(list as PriorityTask[]).length ? (list as PriorityTask[]).map((task) => `- ${task.text}`).join('\n') : '- None'}`).join('\n\n');

  return (
    <div className="space-y-5">
      <Notice>The matrix is a prioritization aid: important work contributes to goals; urgent work needs attention soon. Reclassify tasks when circumstances change.</Notice>
      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <label className="text-sm font-semibold">Task<input className={`${inputClass} mt-1`} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add(); }} placeholder="Add a task…" /></label>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={important} onChange={(event) => setImportant(event.target.checked)} /> Important</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} /> Urgent</label>
          <Button onClick={add} disabled={!text.trim()}><Plus className="h-4 w-4" /> Add task</Button>
          <CopyButton value={plan} label="Copy action plan" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PriorityQuadrant title="Do now" subtitle="Urgent + important" tasks={groups.doNow} remove={remove} emphasis="red" />
        <PriorityQuadrant title="Schedule" subtitle="Important, not urgent" tasks={groups.schedule} remove={remove} emphasis="blue" />
        <PriorityQuadrant title="Delegate" subtitle="Urgent, less important" tasks={groups.delegate} remove={remove} emphasis="amber" />
        <PriorityQuadrant title="Eliminate / defer" subtitle="Neither urgent nor important" tasks={groups.eliminate} remove={remove} emphasis="neutral" />
      </div>
    </div>
  );
}

function PriorityQuadrant({ title, subtitle, tasks, remove, emphasis }: { title: string; subtitle: string; tasks: PriorityTask[]; remove: (id: string) => void; emphasis: 'red' | 'blue' | 'amber' | 'neutral' }) {
  const styles = { red: 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/10', blue: 'border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/10', amber: 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/10', neutral: 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/40' }[emphasis];
  return <section className={`rounded-xl border p-4 ${styles}`}><div className="flex items-baseline justify-between gap-3"><div><h3 className="font-bold">{title}</h3><p className="text-xs text-neutral-500">{subtitle}</p></div><span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold dark:bg-neutral-900/70">{tasks.length}</span></div><div className="mt-3 space-y-2">{tasks.length === 0 ? <div className="rounded-lg border border-dashed border-neutral-300 p-3 text-sm text-neutral-500 dark:border-neutral-700">No tasks in this quadrant.</div> : tasks.map((task) => <div key={task.id} className="flex items-start justify-between gap-2 rounded-lg border border-white/80 bg-white p-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900"><span>{task.text}</span><button type="button" onClick={() => remove(task.id)} className="shrink-0 rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20" aria-label={`Remove ${task.text}`}><Trash2 className="h-4 w-4" /></button></div>)}</div></section>;
}
