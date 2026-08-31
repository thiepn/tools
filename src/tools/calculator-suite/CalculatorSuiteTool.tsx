import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, RefreshCw, ShieldCheck, Wifi } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { getPublicCalculatorTask, PUBLIC_CALCULATOR_TASKS } from '../../calculators/publicCalculatorTasks';
import {
  createDefaultCalculatorValues,
  getCalculatorDefinition,
  type CalculatorInput,
  type CalculatorResult,
} from '../../calculators/calculatorDefinitions';

function readTaskId(hash: string): string | null {
  const clean = hash.replace(/^#\/?/, '').split('?')[0];
  if (clean.startsWith('tool/')) return clean.slice(5).split('/')[0] || null;
  return clean.split('/')[0] || null;
}

const CURRENCIES = ['EUR','USD','GBP','CHF','JPY','KRW','CAD','AUD','NZD','CNY','HKD','SGD','SEK','NOK','DKK','PLN','CZK','HUF','RON','TRY'];

function InputControl({ input, value, onChange }: { input: CalculatorInput; value: string; onChange: (value: string) => void }) {
  const base = 'w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-blue-500/40';
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-3 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
        <span>{input.label}</span>
        {input.unit && <span className="font-normal text-neutral-400">{input.unit}</span>}
      </span>
      {input.type === 'select' ? (
        <select className={base} value={value} onChange={(event) => onChange(event.target.value)}>
          {(input.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <input
          className={base}
          type={input.type === 'number' ? 'number' : 'text'}
          value={value}
          min={input.min}
          max={input.max}
          step={input.step ?? (input.type === 'number' ? 'any' : undefined)}
          placeholder={input.placeholder}
          inputMode={input.type === 'number' ? 'decimal' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {input.help && <span className="mt-1 block text-[11px] leading-4 text-neutral-500">{input.help}</span>}
    </label>
  );
}

function ResultGrid({ results }: { results: CalculatorResult[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {results.map((item, index) => (
        <div key={`${item.label}-${index}`} className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{item.label}</div>
          <div className="mt-1 break-words text-xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">{item.value}</div>
          {item.note && <p className="mt-2 text-xs leading-5 text-neutral-500">{item.note}</p>}
        </div>
      ))}
    </div>
  );
}

function CurrencyPanel() {
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('EUR');
  const [to, setTo] = useState('USD');
  const [rate, setRate] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const convert = async () => {
    const numericAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numericAmount)) { setError('Enter a valid amount.'); return; }
    if (from === to) { setRate(1); setDate('Same currency'); setError(''); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}?providers=ECB`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Rate service returned ${response.status}.`);
      const data = await response.json() as { rate?: number; date?: string };
      if (!Number.isFinite(data.rate)) throw new Error('The rate service returned an invalid rate.');
      setRate(data.rate as number);
      setDate(data.date ?? 'Latest available reference date');
    } catch (reason) {
      setRate(null);
      setError(reason instanceof Error ? reason.message : 'Unable to load the exchange rate.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void convert(); }, []);
  const converted = rate === null ? null : Number(amount.replace(',', '.')) * rate;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
        <label className="block"><span className="mb-1.5 block text-xs font-semibold">Amount</span><input className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm" inputMode="decimal" value={amount} onChange={(e)=>setAmount(e.target.value)} /></label>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold">From</span><select className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm" value={from} onChange={(e)=>setFrom(e.target.value)}>{CURRENCIES.map((c)=><option key={c}>{c}</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold">To</span><select className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm" value={to} onChange={(e)=>setTo(e.target.value)}>{CURRENCIES.map((c)=><option key={c}>{c}</option>)}</select></label>
        <button type="button" onClick={() => void convert()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Convert
        </button>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
      {converted !== null && Number.isFinite(converted) && (
        <ResultGrid results={[
          { label: `${amount || '0'} ${from}`, value: `${new Intl.NumberFormat(undefined,{maximumFractionDigits:6}).format(converted)} ${to}` },
          { label: 'Reference rate', value: `1 ${from} = ${new Intl.NumberFormat(undefined,{maximumFractionDigits:8}).format(rate ?? 0)} ${to}`, note: date },
        ]} />
      )}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200">
        <Wifi className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Current exchange rates require a network request to Frankfurter using ECB reference-rate data. Only the selected currency pair is requested; this route is therefore not fully offline. Reference rates are informational and can differ from card, bank, cash, or transfer quotes.</span>
      </div>
    </div>
  );
}

export const CalculatorSuiteTool: React.FC = () => {
  const task = useMemo(() => {
    const id = typeof window !== 'undefined' ? readTaskId(window.location.hash) : null;
    return getPublicCalculatorTask(id) ?? PUBLIC_CALCULATOR_TASKS[0];
  }, []);
  const definition = useMemo(() => getCalculatorDefinition(task.id), [task.id]);
  const [values, setValues] = useState<Record<string, string>>(() => definition ? createDefaultCalculatorValues(definition) : {});

  useEffect(() => {
    if (definition) setValues(createDefaultCalculatorValues(definition));
  }, [definition]);

  const calculation = useMemo(() => {
    if (!definition || definition.externalData) return { results: [] as CalculatorResult[], error: '' };
    try { return { results: definition.calculate(values), error: '' }; }
    catch (reason) { return { results: [] as CalculatorResult[], error: reason instanceof Error ? reason.message : 'Unable to calculate.' }; }
  }, [definition, values]);

  const related = task.group === 'money' ? ['percentage-calculator', 'discount-vat', 'unit-price-comparator'] : task.group === 'fitness' ? ['unit-converter', 'timer-stopwatch', 'word-counter'] : ['percentage-calculator', 'unit-converter', 'date-calculator'];

  return (
    <ToolShell toolId={task.id} title={task.name} description={task.description} category="calculator" relatedToolIds={related}>
      <div className="space-y-5">
        <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/70 dark:bg-blue-950/20">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-blue-200 bg-white p-2 dark:border-blue-900 dark:bg-neutral-950"><Calculator className="h-5 w-5 text-blue-600" /></div>
            <div><h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Instant calculation</h2><p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">Values update immediately in your browser. Formula-based calculators do not upload inputs or require an account.</p></div>
          </div>
        </section>

        {definition?.externalData === 'currency' ? <CurrencyPanel /> : definition ? (
          <>
            <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {definition.inputs.map((input) => <InputControl key={input.id} input={input} value={values[input.id] ?? ''} onChange={(value)=>setValues((current)=>({...current,[input.id]:value}))} />)}
              </div>
            </section>
            {calculation.error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{calculation.error}</div> : <ResultGrid results={calculation.results} />}
            {(definition.formula || definition.notice) && (
              <section className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                {definition.formula && <p><strong className="text-neutral-800 dark:text-neutral-200">Method:</strong> {definition.formula}</p>}
                {definition.notice && <p><strong className="text-neutral-800 dark:text-neutral-200">Important:</strong> {definition.notice}</p>}
              </section>
            )}
          </>
        ) : <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Calculator configuration is unavailable.</div>}

        {task.group === 'fitness' && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Fitness calculators provide general estimates from published equations. They are not diagnoses, treatment recommendations, or individualized medical/nutrition advice.</span>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default CalculatorSuiteTool;
