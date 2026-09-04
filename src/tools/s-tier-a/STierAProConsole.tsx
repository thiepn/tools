import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  Download,
  Eye,
  FileJson,
  Focus,
  Gauge,
  ListChecks,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  analyzeProfessionalRepeatability,
  buildProfessionalJsonReport,
  buildProfessionalMarkdownReport,
  isProfessionalSensitiveField,
  normalizeProfessionalOutput,
  professionalFingerprint,
  sanitizeProfessionalValue,
  summarizeProfessionalSnapshot,
  type ProfessionalControlState,
  type ProfessionalSnapshot,
  type RepeatabilityResult,
} from '../../utilities/s-tier-a-professional';

const AUXILIARY_SELECTOR = '[data-s-tier-workbench], [data-s-tier-a-console]';
type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type AnyControl = FormControl | HTMLButtonElement;

interface InventoryItem {
  index: number;
  label: string;
  kind: string;
  value: string;
  sensitive: boolean;
  disabled: boolean;
  valid: boolean;
  accessible: boolean;
  element: AnyControl;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function rootFor(toolId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tool-id="${CSS.escape(toolId)}"] .tt-tool-content`);
}

function isAuxiliary(element: Element | null): boolean {
  return Boolean(element?.closest(AUXILIARY_SELECTOR));
}

function controlLabel(control: AnyControl): string {
  const aria = control.getAttribute('aria-label')?.trim();
  if (aria) return aria;
  const labelledBy = control.getAttribute('aria-labelledby')?.trim();
  if (labelledBy) {
    const text = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
    if (text) return text;
  }
  if (control.id) {
    const explicit = document.querySelector(`label[for="${CSS.escape(control.id)}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    if (explicit) return explicit;
  }
  const wrapping = control.closest('label')?.textContent?.replace(/\s+/g, ' ').trim();
  if (wrapping) return wrapping;
  const placeholder = control.getAttribute('placeholder')?.trim();
  if (placeholder) return placeholder.replace(/\.{3}$/g, '');
  const title = control.getAttribute('title')?.trim();
  if (title) return title;
  if (control instanceof HTMLButtonElement) return control.textContent?.replace(/\s+/g, ' ').trim() || 'Button';
  const name = control.getAttribute('name')?.trim();
  if (name) return name.replace(/[-_]+/g, ' ');
  return control instanceof HTMLTextAreaElement ? 'Text input' : control instanceof HTMLSelectElement ? 'Select' : control.type || 'Input';
}

function hasAccessibleName(control: AnyControl): boolean {
  if (control.getAttribute('aria-label')?.trim() || control.getAttribute('aria-labelledby')?.trim()) return true;
  if (control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)) return true;
  if (control.closest('label')) return true;
  if (control instanceof HTMLButtonElement && control.textContent?.trim()) return true;
  return false;
}

function kindFor(control: AnyControl): string {
  if (control instanceof HTMLButtonElement) return 'button';
  if (control instanceof HTMLTextAreaElement) return 'textarea';
  if (control instanceof HTMLSelectElement) return 'select';
  return control.type || 'text';
}

function valueFor(control: AnyControl): string {
  if (control instanceof HTMLButtonElement) return control.textContent?.replace(/\s+/g, ' ').trim() || '';
  if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) return String(control.checked);
  if (control instanceof HTMLInputElement && control.type === 'file') {
    return [...(control.files ?? [])].map((file) => `${file.name} (${file.size} B)`).join(', ');
  }
  return control.value;
}

function inventory(toolId: string): InventoryItem[] {
  const root = rootFor(toolId);
  if (!root) return [];
  return [...root.querySelectorAll<AnyControl>('input, textarea, select, button')]
    .filter((control) => !isAuxiliary(control) && !(control instanceof HTMLInputElement && control.type === 'hidden'))
    .map((control, index) => {
      const label = controlLabel(control);
      const kind = kindFor(control);
      const sensitive = isProfessionalSensitiveField(label, kind);
      const valid = control instanceof HTMLButtonElement || typeof control.checkValidity !== 'function' ? true : control.checkValidity();
      return {
        index,
        label,
        kind,
        value: sanitizeProfessionalValue(label, kind, valueFor(control)),
        sensitive,
        disabled: control.disabled,
        valid,
        accessible: hasAccessibleName(control),
        element: control,
      };
    });
}

function outputFor(toolId: string): string {
  const root = rootFor(toolId);
  if (!root) return '';
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(AUXILIARY_SELECTOR).forEach((node) => node.remove());
  clone.querySelectorAll('script, style').forEach((node) => node.remove());
  const text = clone.textContent ?? '';
  const readonly = [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[readonly], textarea[readonly]')]
    .filter((control) => !isAuxiliary(control))
    .map((control) => `${controlLabel(control)}: ${control.value}`)
    .filter((line) => !line.endsWith(': '));
  return normalizeProfessionalOutput([text, ...readonly].join('\n'));
}

function snapshotFor(toolId: string): ProfessionalSnapshot {
  const items = inventory(toolId).filter((item) => item.kind !== 'button');
  const controls: ProfessionalControlState[] = items.map((item) => ({
    key: `${item.index}:${item.kind}:${item.label.toLocaleLowerCase().replace(/\s+/g, '-')}`,
    label: item.label,
    kind: item.kind,
    value: item.sensitive ? '[omitted]' : item.value,
    sensitive: item.sensitive,
    disabled: item.disabled,
    valid: item.valid,
  }));
  return {
    version: 1,
    toolId,
    capturedAt: new Date().toISOString(),
    controls,
    output: outputFor(toolId),
  };
}

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"><div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-1 break-words text-sm font-extrabold text-neutral-900 dark:text-neutral-100">{value}</div></div>;
}

function tabClass(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${active ? 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900'}`;
}

export function STierAProConsole({ toolId }: { toolId: string }) {
  const [tab, setTab] = useState<'qa' | 'controls' | 'repeatability'>('qa');
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [repeatability, setRepeatability] = useState<RepeatabilityResult | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const items = useMemo(() => inventory(toolId), [toolId, tick]);
  const snapshot = useMemo(() => snapshotFor(toolId), [toolId, tick]);
  const summary = useMemo(() => summarizeProfessionalSnapshot(snapshot), [snapshot]);
  const fingerprint = useMemo(() => professionalFingerprint(snapshot), [snapshot]);
  const unnamed = items.filter((item) => !item.accessible).length;
  const duplicateIds = useMemo(() => {
    const root = rootFor(toolId);
    if (!root) return 0;
    const counts = new Map<string, number>();
    [...root.querySelectorAll<HTMLElement>('[id]')].filter((element) => !isAuxiliary(element)).forEach((element) => counts.set(element.id, (counts.get(element.id) ?? 0) + 1));
    return [...counts.values()].filter((count) => count > 1).length;
  }, [toolId, tick]);

  const filtered = items.filter((item) => `${item.label} ${item.kind}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));

  useEffect(() => {
    const root = rootFor(toolId);
    if (!root) return;
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTick((value) => value + 1), 90);
    };
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => !isAuxiliary(mutation.target instanceof Element ? mutation.target : mutation.target.parentElement))) schedule();
    });
    observer.observe(root, { childList: true, subtree: true });
    const onChange = (event: Event) => {
      if (event.target instanceof Element && !isAuxiliary(event.target)) schedule();
    };
    root.addEventListener('input', onChange, true);
    root.addEventListener('change', onChange, true);
    return () => {
      observer.disconnect();
      root.removeEventListener('input', onChange, true);
      root.removeEventListener('change', onChange, true);
      window.clearTimeout(timer);
    };
  }, [toolId]);

  const runRepeatability = async () => {
    setRunning(true);
    try {
      const samples: string[] = [];
      for (let index = 0; index < 4; index += 1) {
        samples.push(outputFor(toolId));
        if (index < 3) await delay(250);
      }
      setRepeatability(analyzeProfessionalRepeatability(samples));
    } finally {
      setRunning(false);
      setTick((value) => value + 1);
    }
  };

  const copyReport = async () => {
    await copyText(buildProfessionalMarkdownReport(snapshot, repeatability ?? undefined));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const focusItem = (item: InventoryItem) => {
    item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item.element.focus({ preventScroll: true });
  };

  const focusInvalid = () => {
    const item = items.find((candidate) => !candidate.valid && !candidate.disabled);
    if (item) focusItem(item);
  };

  return <section data-s-tier-a-console={toolId} className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-800" aria-label="Professional QA console">
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50/70 to-white p-4 shadow-sm dark:border-violet-900/70 dark:from-violet-950/20 dark:to-neutral-950 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3"><div className="rounded-lg border border-violet-200 bg-white p-2 dark:border-violet-900 dark:bg-neutral-950"><Gauge className="h-4 w-4 text-violet-600" /></div><div><h2 className="text-sm font-extrabold">Professional QA console</h2><p className="text-[11px] text-neutral-500">Reproducibility · control map · validation · report export · repeatability</p></div></div>
        <div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"><ShieldCheck className="h-3 w-3" />Console stays local</span><button type="button" onClick={() => setTick((value) => value + 1)} aria-label="Refresh professional QA console" className="rounded-lg border border-neutral-300 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-950"><RefreshCw className="h-3.5 w-3.5" /></button></div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"><Metric label="Controls" value={items.length} /><Metric label="Writable" value={summary.writableControls} /><Metric label="Invalid" value={summary.invalidControls} /><Metric label="Unnamed" value={unnamed} /><Metric label="Duplicate IDs" value={duplicateIds} /><Metric label="Fingerprint" value={<span className="font-mono text-xs">{fingerprint.slice(0, 10)}</span>} /></div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Professional QA console modes">
        <button type="button" role="tab" aria-selected={tab === 'qa'} onClick={() => setTab('qa')} className={tabClass(tab === 'qa')}><ListChecks className="h-3.5 w-3.5" />QA report</button>
        <button type="button" role="tab" aria-selected={tab === 'controls'} onClick={() => setTab('controls')} className={tabClass(tab === 'controls')}><Focus className="h-3.5 w-3.5" />Control map</button>
        <button type="button" role="tab" aria-selected={tab === 'repeatability'} onClick={() => setTab('repeatability')} className={tabClass(tab === 'repeatability')}><Eye className="h-3.5 w-3.5" />Repeatability</button>
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950 sm:p-4">
        {tab === 'qa' && <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2"><div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><div className="text-xs font-bold">Current quality gate</div><div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400"><div className="flex items-center gap-2"><CheckCircle2 className={`h-3.5 w-3.5 ${summary.invalidControls ? 'text-amber-600' : 'text-emerald-600'}`} />Native form validity: {summary.invalidControls ? `${summary.invalidControls} issue(s)` : 'clean'}</div><div>Programmatic control names: {unnamed ? `${unnamed} missing` : 'clean'}</div><div>Duplicate element IDs: {duplicateIds || 'none detected'}</div><div>Visible output capture: {summary.outputCharacters.toLocaleString()} characters / {summary.outputLines} lines</div><div>Sensitive values omitted: {summary.sensitiveControls}</div></div></div><div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><div className="text-xs font-bold">Reproducibility fingerprint</div><div className="mt-2 break-all font-mono text-sm font-bold">{fingerprint}</div><p className="mt-2 text-[11px] leading-4 text-neutral-500">The fingerprint covers the current non-sensitive control state and captured visible output. The capture timestamp is excluded, so identical states produce the same fingerprint.</p></div></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void copyReport()} className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white dark:bg-neutral-100 dark:text-neutral-900"><ClipboardCopy className="h-3.5 w-3.5" />{copied ? 'Copied' : 'Copy Markdown report'}</button><button type="button" onClick={() => downloadText(buildProfessionalMarkdownReport(snapshot, repeatability ?? undefined), `${toolId}-professional-report.md`, 'text/markdown;charset=utf-8')} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold dark:border-neutral-700"><Download className="h-3.5 w-3.5" />Markdown</button><button type="button" onClick={() => downloadText(buildProfessionalJsonReport(snapshot, repeatability ?? undefined), `${toolId}-professional-report.json`, 'application/json;charset=utf-8')} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold dark:border-neutral-700"><FileJson className="h-3.5 w-3.5" />JSON</button>{summary.invalidControls > 0 && <button type="button" onClick={focusInvalid} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"><Focus className="h-3.5 w-3.5" />Focus first invalid input</button>}</div>
        </div>}

        {tab === 'controls' && <div className="space-y-3"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter controls by name or type" className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" /></label><div className="max-h-[28rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900"><tr><th className="px-3 py-2">Control</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Action</th></tr></thead><tbody>{filtered.map((item) => <tr key={`${item.index}-${item.label}`} className="border-t border-neutral-100 align-top dark:border-neutral-800"><td className="px-3 py-2"><div className="font-semibold">{item.label}</div><div className="mt-0.5 text-[10px] text-neutral-500">{item.accessible ? 'named' : 'fallback name only'}{item.sensitive ? ' · value omitted' : ''}</div></td><td className="px-3 py-2 font-mono text-[11px]">{item.kind}</td><td className="max-w-72 break-words px-3 py-2 text-neutral-600 dark:text-neutral-400">{item.sensitive ? '[omitted]' : item.value || '(empty)'}{!item.valid ? <div className="mt-1 font-semibold text-amber-700 dark:text-amber-400">invalid</div> : null}</td><td className="px-3 py-2"><button type="button" onClick={() => focusItem(item)} className="rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-semibold dark:border-neutral-700">Focus</button></td></tr>)}</tbody></table></div><div className="text-[11px] text-neutral-500">Showing {filtered.length} of {items.length} controls. Values matching password/token/private-key patterns are never displayed here.</div></div>}

        {tab === 'repeatability' && <div className="space-y-4"><div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><div className="text-xs font-bold">Visible-output repeatability check</div><p className="mt-1 text-xs leading-5 text-neutral-500">Capture the current visible output four times over roughly 750 ms without changing inputs. Stable calculators/converters should normally match; timers, live diagnostics, media progress, clocks, and intentionally random tools may change by design.</p><button type="button" onClick={() => void runRepeatability()} disabled={running} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Gauge className="h-3.5 w-3.5" />{running ? 'Sampling…' : 'Run repeatability check'}</button></div>{repeatability && <div className={`rounded-xl border p-4 ${repeatability.stable ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20'}`}><div className="text-sm font-bold">{repeatability.stable ? 'Output remained stable' : 'Output changed during sampling'}</div><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"><Metric label="Unique samples" value={repeatability.uniqueSamples} /><Metric label="Changed samples" value={repeatability.changedSamples} /><Metric label="Interpretation" value={repeatability.stable ? 'deterministic now' : 'dynamic now'} /></div>{repeatability.firstDifference && <div className="mt-3 break-words rounded-lg border border-amber-200 bg-white/70 p-2 font-mono text-[11px] dark:border-amber-900 dark:bg-neutral-950">{repeatability.firstDifference}</div>}</div>}</div>}
      </div>
    </div>
  </section>;
}
