import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Beaker,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileSearch,
  FlaskConical,
  History,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  buildWorkbenchCsv,
  diffWorkbenchSnapshots,
  formatWorkbenchBytes,
  isSensitiveWorkbenchField,
  numericScenarios,
  parseBatchCases,
  parseWorkbenchSnapshot,
  safeSnapshotStorageKey,
  sanitizeWorkbenchOutput,
  textDiagnostics,
  type WorkbenchFieldKind,
  type WorkbenchFieldState,
  type WorkbenchSnapshot,
  type WorkbenchSnapshotDiff,
} from '../../utilities/s-tier-b-workbench';

const WORKBENCH_SELECTOR = '[data-s-tier-workbench]';
const MAX_SNAPSHOTS = 12;
const MAX_TRACE_ROWS = 120;

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

type FieldDescriptor = WorkbenchFieldState & {
  control: Control;
};

interface FileReport {
  name: string;
  size: number;
  type: string;
  lastModified: string;
  sha256: string;
  signature: string;
  dimensions?: string;
  duration?: string;
  note?: string;
}

interface BatchRow {
  index: number;
  input: string;
  output: string;
}

interface SensitivityRow {
  label: string;
  value: string;
  output: string;
  changedLines: string[];
  valid: boolean;
}

interface TraceRow {
  timestamp: string;
  output: string;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function toolShell(toolId: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(`[data-tool-id="${CSS.escape(toolId)}"]`);
}

function coreContent(toolId: string): HTMLElement | null {
  return toolShell(toolId)?.querySelector<HTMLElement>('.tt-tool-content') ?? null;
}

function isWorkbenchNode(node: Element | null): boolean {
  return Boolean(node?.closest(WORKBENCH_SELECTOR));
}

function labelText(control: Control): string {
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
  const name = control.getAttribute('name')?.trim();
  if (name) return name.replace(/[-_]+/g, ' ');
  return control instanceof HTMLTextAreaElement ? 'Text input' : control instanceof HTMLSelectElement ? 'Select option' : control.type || 'Input';
}

function fieldKind(control: Control): WorkbenchFieldKind {
  if (control instanceof HTMLTextAreaElement) return 'text';
  if (control instanceof HTMLSelectElement) return 'select';
  const type = (control.type || 'text').toLowerCase();
  const allowed = new Set<WorkbenchFieldKind>(['text','number','range','checkbox','radio','date','time','datetime-local','month','week','color','email','url','tel','password']);
  return allowed.has(type as WorkbenchFieldKind) ? type as WorkbenchFieldKind : 'other';
}

function externalControls(toolId: string): Control[] {
  const root = coreContent(toolId);
  if (!root) return [];
  return [...root.querySelectorAll<Control>('input, textarea, select')].filter((control) => {
    if (isWorkbenchNode(control)) return false;
    if (control instanceof HTMLInputElement && ['hidden','file','submit','button','reset','image'].includes(control.type)) return false;
    return true;
  });
}

function describeFields(toolId: string): FieldDescriptor[] {
  const occurrences = new Map<string, number>();
  return externalControls(toolId).map((control, index) => {
    const kind = fieldKind(control);
    const label = labelText(control);
    const token = (control.id || control.getAttribute('name') || label || `field-${index + 1}`).replace(/\s+/g, '-').toLowerCase();
    const occurrence = (occurrences.get(`${token}:${kind}`) ?? 0) + 1;
    occurrences.set(`${token}:${kind}`, occurrence);
    const key = `${token}:${kind}:${occurrence}`;
    const sensitive = isSensitiveWorkbenchField(label, kind);
    const value = control instanceof HTMLInputElement && (kind === 'checkbox' || kind === 'radio')
      ? String(control.checked)
      : control.value;
    return { key, label, kind, value: sensitive ? '' : value, sensitive, control };
  });
}

function setControlValue(control: Control, kind: WorkbenchFieldKind, value: string) {
  if (control instanceof HTMLInputElement && (kind === 'checkbox' || kind === 'radio')) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
    if (setter) setter.call(control, value === 'true');
    else control.checked = value === 'true';
  } else {
    const proto = control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : control instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(control, value);
    else control.value = value;
  }
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function captureOutput(toolId: string): string {
  const root = coreContent(toolId);
  if (!root) return '';
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(WORKBENCH_SELECTOR).forEach((node) => node.remove());
  clone.querySelectorAll('script,style').forEach((node) => node.remove());
  const visibleText = clone.innerText || clone.textContent || '';
  const outputValues = [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[readonly], textarea[readonly]')]
    .filter((control) => !isWorkbenchNode(control))
    .map((control) => `${labelText(control)}: ${control.value}`)
    .filter((line) => line.trim() && !line.endsWith(': '));
  return sanitizeWorkbenchOutput([visibleText, ...outputValues].join('\n'));
}

function captureSnapshot(toolId: string, name: string): WorkbenchSnapshot {
  return {
    version: 1,
    toolId,
    name,
    createdAt: new Date().toISOString(),
    fields: describeFields(toolId).map(({ control: _control, ...field }) => field),
    output: captureOutput(toolId),
  };
}

function applySnapshot(toolId: string, snapshot: WorkbenchSnapshot) {
  const current = new Map(describeFields(toolId).map((field) => [field.key, field]));
  for (const field of snapshot.fields) {
    if (field.sensitive) continue;
    const target = current.get(field.key);
    if (!target || target.control.disabled || target.control.readOnly) continue;
    setControlValue(target.control, target.kind, field.value);
  }
}

function readStoredSnapshots(toolId: string): WorkbenchSnapshot[] {
  try {
    const raw = localStorage.getItem(safeSnapshotStorageKey(toolId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        try { return parseWorkbenchSnapshot(JSON.stringify(item), toolId); } catch { return null; }
      })
      .filter((item): item is WorkbenchSnapshot => Boolean(item))
      .slice(0, MAX_SNAPSHOTS);
  } catch {
    return [];
  }
}

function persistSnapshots(toolId: string, snapshots: WorkbenchSnapshot[]): boolean {
  try {
    localStorage.setItem(safeSnapshotStorageKey(toolId), JSON.stringify(snapshots.slice(0, MAX_SNAPSHOTS)));
    return true;
  } catch {
    return false;
  }
}

function downloadText(text: string, name: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
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

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join(' ');
}

function digestHex(buffer: ArrayBuffer) {
  return crypto.subtle.digest('SHA-256', buffer).then((digest) => [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''));
}

async function imageDimensions(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return undefined;
  try {
    const image = await createImageBitmap(file);
    const result = `${image.width} × ${image.height}px`;
    image.close();
    return result;
  } catch {
    return undefined;
  }
}

async function mediaDuration(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) return undefined;
  return new Promise((resolve) => {
    const element = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
    const url = URL.createObjectURL(file);
    const done = (value?: string) => {
      URL.revokeObjectURL(url);
      element.removeAttribute('src');
      resolve(value);
    };
    const timer = window.setTimeout(() => done(), 5000);
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      clearTimeout(timer);
      done(Number.isFinite(element.duration) ? `${element.duration.toFixed(2)} s` : undefined);
    };
    element.onerror = () => { clearTimeout(timer); done(); };
    element.src = url;
  });
}

async function inspectFile(file: File): Promise<FileReport> {
  const prefix = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  let sha256 = 'Skipped (file is larger than 128 MiB)';
  let note: string | undefined;
  if (file.size <= 128 * 1024 * 1024) {
    try { sha256 = await digestHex(await file.arrayBuffer()); }
    catch { sha256 = 'Hash unavailable'; note = 'The browser could not compute SHA-256 for this file.'; }
  }
  const [dimensions, duration] = await Promise.all([imageDimensions(file), mediaDuration(file)]);
  return {
    name: file.name,
    size: file.size,
    type: file.type || 'unknown / not declared',
    lastModified: Number.isFinite(file.lastModified) ? new Date(file.lastModified).toISOString() : 'unknown',
    sha256,
    signature: bytesToHex(prefix) || 'empty file',
    dimensions,
    duration,
    note,
  };
}

function validationIssues(toolId: string) {
  return describeFields(toolId)
    .filter((field) => !field.control.disabled && typeof field.control.checkValidity === 'function' && !field.control.checkValidity())
    .map((field) => ({ label: field.label, message: field.control.validationMessage || 'Invalid value' }));
}

function shortOutput(value: string, max = 900) {
  const clean = sanitizeWorkbenchOutput(value, max);
  return clean || '(No text output was exposed by the tool.)';
}

function sectionButton(active: boolean) {
  return `inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active
    ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900'}`;
}

function TinyMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"><div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-1 break-words text-sm font-bold tabular-nums text-neutral-900 dark:text-neutral-100">{value}</div></div>;
}

function ScenarioPanel({ toolId, fields, initialSnapshot, refresh }: { toolId: string; fields: FieldDescriptor[]; initialSnapshot: WorkbenchSnapshot | null; refresh: () => void }) {
  const [snapshots, setSnapshots] = useState<WorkbenchSnapshot[]>(() => readStoredSnapshots(toolId));
  const [name, setName] = useState('Scenario 1');
  const [selected, setSelected] = useState('');
  const [diff, setDiff] = useState<WorkbenchSnapshotDiff | null>(null);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setSnapshots(readStoredSnapshots(toolId));
    setSelected('');
    setDiff(null);
  }, [toolId]);

  const saveCurrent = () => {
    const snapshot = captureSnapshot(toolId, name.trim() || `Scenario ${snapshots.length + 1}`);
    const next = [snapshot, ...snapshots].slice(0, MAX_SNAPSHOTS);
    setSnapshots(next);
    setSelected(snapshot.createdAt);
    setMessage(persistSnapshots(toolId, next) ? 'Scenario saved locally.' : 'Scenario captured for this session, but browser storage is unavailable.');
    setName(`Scenario ${Math.min(MAX_SNAPSHOTS, next.length + 1)}`);
    refresh();
  };

  const chosen = snapshots.find((snapshot) => snapshot.createdAt === selected) ?? null;

  const restore = async (snapshot: WorkbenchSnapshot) => {
    applySnapshot(toolId, snapshot);
    await delay(180);
    refresh();
    setMessage('Scenario restored. Sensitive fields were intentionally not persisted.');
  };

  const remove = (createdAt: string) => {
    const next = snapshots.filter((snapshot) => snapshot.createdAt !== createdAt);
    setSnapshots(next);
    persistSnapshots(toolId, next);
    if (selected === createdAt) setSelected('');
    setDiff(null);
  };

  const compare = () => {
    if (!chosen) return;
    setDiff(diffWorkbenchSnapshots(chosen, captureSnapshot(toolId, 'Current')));
  };

  const exportCurrent = () => {
    downloadText(JSON.stringify(captureSnapshot(toolId, 'Exported current state'), null, 2), `${toolId}-scenario.json`, 'application/json;charset=utf-8');
  };

  const importSnapshot = async () => {
    try {
      const snapshot = parseWorkbenchSnapshot(importText, toolId);
      await restore(snapshot);
      setMessage('Imported snapshot applied.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to import snapshot.');
    }
  };

  const omitted = fields.filter((field) => field.sensitive).length;

  return <div className="space-y-4">
    <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Scenario name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950" /></label>
      <button type="button" onClick={saveCurrent} className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white dark:bg-neutral-100 dark:text-neutral-900"><Save className="h-4 w-4" />Save state</button>
      <button type="button" onClick={exportCurrent} className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold dark:border-neutral-700"><Download className="h-4 w-4" />Export JSON</button>
    </div>

    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
      <ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Snapshots are opt-in and stay in this browser. Password/secret-like fields are omitted automatically{omitted ? ` (${omitted} omitted now)` : ''}.
    </div>

    {snapshots.length > 0 ? <div className="space-y-2">
      {snapshots.map((snapshot) => <div key={snapshot.createdAt} className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 ${selected === snapshot.createdAt ? 'border-blue-300 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/20' : 'border-neutral-200 dark:border-neutral-800'}`}>
        <button type="button" onClick={() => { setSelected(snapshot.createdAt); setDiff(null); }} className="min-w-0 flex-1 text-left"><div className="truncate text-sm font-semibold">{snapshot.name}</div><div className="text-[11px] text-neutral-500">{new Date(snapshot.createdAt).toLocaleString()} · {snapshot.fields.length} fields</div></button>
        <button type="button" onClick={() => void restore(snapshot)} className="rounded-md border px-2.5 py-1.5 text-xs font-semibold dark:border-neutral-700"><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Restore</button>
        <button type="button" onClick={() => remove(snapshot.createdAt)} aria-label={`Delete ${snapshot.name}`} className="rounded-md border px-2 py-1.5 text-xs text-red-600 dark:border-neutral-700 dark:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>)}
    </div> : <p className="text-xs text-neutral-500">No saved scenarios yet. Capture two or more configurations to compare inputs and output changes.</p>}

    {chosen && <div className="flex flex-wrap gap-2"><button type="button" onClick={compare} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold dark:border-neutral-700"><BarChart3 className="mr-1 inline h-4 w-4" />Compare selected → current</button>{initialSnapshot && <button type="button" onClick={() => void restore(initialSnapshot)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold dark:border-neutral-700"><History className="mr-1 inline h-4 w-4" />Restore page defaults</button>}</div>}

    {diff && <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><div className="text-xs font-bold">Changed inputs · {diff.changedFields.length}</div><div className="mt-2 max-h-56 space-y-1 overflow-auto text-xs">{diff.changedFields.length ? diff.changedFields.map((item) => <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-neutral-100 py-1.5 dark:border-neutral-800"><span className="truncate font-medium">{item.label}</span><span className="max-w-52 truncate font-mono text-neutral-500">{item.before} → {item.after}</span></div>) : <span className="text-neutral-500">No input changes.</span>}</div></div>
      <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><div className="text-xs font-bold">Output delta</div><div className="mt-2 max-h-56 overflow-auto text-xs"><div className="font-semibold text-emerald-700 dark:text-emerald-400">Added / changed</div>{diff.addedOutputLines.slice(0, 12).map((line, index) => <div key={`a-${index}`} className="mt-1 break-words">+ {line}</div>)}<div className="mt-3 font-semibold text-red-700 dark:text-red-400">Removed / previous</div>{diff.removedOutputLines.slice(0, 12).map((line, index) => <div key={`r-${index}`} className="mt-1 break-words">− {line}</div>)}</div></div>
    </div>}

    <details className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><summary className="cursor-pointer text-xs font-semibold">Import a scenario JSON</summary><div className="mt-3 space-y-2"><textarea rows={5} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Paste a scenario JSON exported from this same tool" className="w-full rounded-lg border border-neutral-300 bg-white p-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950" /><button type="button" onClick={() => void importSnapshot()} disabled={!importText.trim()} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900">Apply imported state</button></div></details>
    {message && <div role="status" className="text-xs text-neutral-600 dark:text-neutral-400">{message}</div>}
  </div>;
}

function BatchPanel({ toolId, fields, refresh }: { toolId: string; fields: FieldDescriptor[]; refresh: () => void }) {
  const usable = fields.filter((field) => !field.sensitive && !['checkbox','radio','password'].includes(field.kind) && !field.control.disabled && !field.control.readOnly);
  const numeric = usable.filter((field) => field.kind === 'number' || field.kind === 'range');
  const textLike = usable.filter((field) => field.kind === 'text' || field.control instanceof HTMLTextAreaElement || ['url','email','tel','other'].includes(field.kind));
  const [fieldKey, setFieldKey] = useState('');
  const [cases, setCases] = useState('');
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [running, setRunning] = useState(false);
  const [sensitivityKey, setSensitivityKey] = useState('');
  const [sensitivityRows, setSensitivityRows] = useState<SensitivityRow[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!usable.some((field) => field.key === fieldKey)) setFieldKey(usable[0]?.key ?? '');
    if (!numeric.some((field) => field.key === sensitivityKey)) setSensitivityKey(numeric[0]?.key ?? '');
  }, [fields]);

  const diagnosticsField = textLike.sort((a, b) => b.value.length - a.value.length)[0];
  const diagnostics = diagnosticsField ? textDiagnostics(diagnosticsField.value) : null;

  const runBatch = async () => {
    const target = describeFields(toolId).find((field) => field.key === fieldKey);
    if (!target) { setMessage('Choose an input field first.'); return; }
    const batchCases = parseBatchCases(cases, 30);
    if (!batchCases.length) { setMessage('Enter one case per line. Use a line containing only --- to separate multiline cases.'); return; }
    const baseline = captureSnapshot(toolId, 'Batch baseline');
    setRunning(true); setRows([]); setMessage('');
    try {
      const next: BatchRow[] = [];
      for (let index = 0; index < batchCases.length; index += 1) {
        const currentTarget = describeFields(toolId).find((field) => field.key === fieldKey);
        if (!currentTarget) throw new Error('The target field disappeared while the batch was running.');
        setControlValue(currentTarget.control, currentTarget.kind, batchCases[index]);
        await delay(140);
        next.push({ index: index + 1, input: batchCases[index], output: shortOutput(captureOutput(toolId)) });
        setRows([...next]);
      }
      setMessage(`Completed ${next.length} cases. The original form state was restored.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Batch run failed.');
    } finally {
      applySnapshot(toolId, baseline);
      await delay(160);
      setRunning(false);
      refresh();
    }
  };

  const runSensitivity = async () => {
    const target = describeFields(toolId).find((field) => field.key === sensitivityKey);
    if (!target) return;
    const value = Number(target.value);
    if (!Number.isFinite(value)) { setMessage('The selected field is not currently numeric.'); return; }
    const baseline = captureSnapshot(toolId, 'Sensitivity baseline');
    setRunning(true); setSensitivityRows([]); setMessage('');
    try {
      const next: SensitivityRow[] = [];
      for (const scenario of numericScenarios(value, [-20,-10,-5,5,10,20])) {
        const currentTarget = describeFields(toolId).find((field) => field.key === sensitivityKey);
        if (!currentTarget) throw new Error('The sensitivity field disappeared.');
        setControlValue(currentTarget.control, currentTarget.kind, String(scenario.value));
        await delay(140);
        const valid = currentTarget.control.checkValidity();
        const current = captureSnapshot(toolId, scenario.label);
        const delta = diffWorkbenchSnapshots(baseline, current);
        next.push({
          label: scenario.label,
          value: String(scenario.value),
          output: shortOutput(current.output, 700),
          changedLines: delta.addedOutputLines.slice(0, 6),
          valid,
        });
        setSensitivityRows([...next]);
      }
      setMessage('Sensitivity sweep complete. Original inputs restored.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sensitivity sweep failed.');
    } finally {
      applySnapshot(toolId, baseline);
      await delay(160);
      setRunning(false);
      refresh();
    }
  };

  const downloadBatch = () => {
    downloadText(buildWorkbenchCsv(rows.map((row) => ({ case: row.index, input: row.input, output: row.output }))), `${toolId}-batch.csv`, 'text/csv;charset=utf-8');
  };

  return <div className="space-y-5">
    {usable.length ? <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center gap-2 text-sm font-bold"><FlaskConical className="h-4 w-4 text-blue-600" />Batch runner</div>
      <p className="mt-1 text-xs leading-5 text-neutral-500">Drive one existing tool input through up to 30 cases and capture the resulting screen output. The original state is restored afterwards.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <label className="text-xs font-semibold">Target input<select value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950">{usable.map((field) => <option key={field.key} value={field.key}>{field.label} · {field.kind}</option>)}</select></label>
        <label className="text-xs font-semibold">Cases<textarea rows={5} value={cases} onChange={(event) => setCases(event.target.value)} placeholder={'One case per line\nOr multiline case\n---\nNext multiline case'} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950" /></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void runBatch()} disabled={running || !fieldKey || !cases.trim()} className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"><Play className="h-3.5 w-3.5" />{running ? 'Running…' : 'Run batch'}</button>{rows.length > 0 && <button type="button" onClick={downloadBatch} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold dark:border-neutral-700"><Download className="h-3.5 w-3.5" />CSV</button>}</div>
      {rows.length > 0 && <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Input</th><th className="px-3 py-2">Captured output</th></tr></thead><tbody>{rows.map((row) => <tr key={row.index} className="border-t border-neutral-100 align-top dark:border-neutral-800"><td className="px-3 py-2 tabular-nums">{row.index}</td><td className="max-w-56 whitespace-pre-wrap break-words px-3 py-2 font-mono">{row.input}</td><td className="max-w-xl whitespace-pre-wrap break-words px-3 py-2 text-neutral-600 dark:text-neutral-400">{row.output}</td></tr>)}</tbody></table></div>}
    </div> : <div className="rounded-lg border border-neutral-200 p-3 text-xs text-neutral-500 dark:border-neutral-800">This route does not currently expose a restorable text/number/select input, so the batch runner is unavailable until such an input appears.</div>}

    {numeric.length > 0 && <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center gap-2 text-sm font-bold"><BarChart3 className="h-4 w-4 text-violet-600" />Sensitivity sweep</div>
      <p className="mt-1 text-xs leading-5 text-neutral-500">Automatically test −20%, −10%, −5%, +5%, +10%, and +20% around one numeric input and record how the tool output changes.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3"><label className="min-w-56 flex-1 text-xs font-semibold">Numeric input<select value={sensitivityKey} onChange={(event) => setSensitivityKey(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950">{numeric.map((field) => <option key={field.key} value={field.key}>{field.label} · current {field.value}</option>)}</select></label><button type="button" onClick={() => void runSensitivity()} disabled={running || !sensitivityKey} className="rounded-lg bg-violet-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Run sweep</button></div>
      {sensitivityRows.length > 0 && <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{sensitivityRows.map((row) => <div key={row.label} className={`rounded-lg border p-3 ${row.valid ? 'border-neutral-200 dark:border-neutral-800' : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold">{row.label}</span><span className="font-mono text-[11px] text-neutral-500">{row.value}</span></div><div className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-4 text-neutral-600 dark:text-neutral-400">{row.valid ? (row.changedLines.length ? row.changedLines.join('\n') : row.output) : 'Outside this input’s declared validity range.'}</div></div>)}</div>}
    </div>}

    {diagnostics && diagnosticsField && <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><div className="flex items-center gap-2 text-sm font-bold"><Beaker className="h-4 w-4 text-emerald-600" />Live text diagnostics · {diagnosticsField.label}</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><TinyMetric label="Graphemes" value={diagnostics.graphemes} /><TinyMetric label="UTF-8 bytes" value={diagnostics.utf8Bytes} /><TinyMetric label="Words" value={diagnostics.words} /><TinyMetric label="Unique words" value={diagnostics.uniqueWords} /><TinyMetric label="Lines" value={diagnostics.lines} /><TinyMetric label="Longest line" value={diagnostics.longestLine} /><TinyMetric label="Non-ASCII" value={diagnostics.nonAsciiCharacters} /><TinyMetric label="Whitespace" value={diagnostics.whitespaceCharacters} /></div></div>}
    {message && <div role="status" className="text-xs text-neutral-600 dark:text-neutral-400">{message}</div>}
  </div>;
}

function FilePanel({ toolId, fileCount }: { toolId: string; fileCount: number }) {
  const [reports, setReports] = useState<FileReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const analyze = async () => {
    const root = coreContent(toolId);
    const inputs = root ? [...root.querySelectorAll<HTMLInputElement>('input[type="file"]')].filter((input) => !isWorkbenchNode(input)) : [];
    const files = inputs.flatMap((input) => [...(input.files ?? [])]);
    if (!files.length) { setMessage('Choose file(s) in the tool first, then analyze them here.'); setReports([]); return; }
    setBusy(true); setMessage('');
    try {
      const next: FileReport[] = [];
      for (const file of files.slice(0, 40)) {
        next.push(await inspectFile(file));
        setReports([...next]);
      }
      setMessage(`Analyzed ${next.length} file${next.length === 1 ? '' : 's'} locally.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'File analysis failed.');
    } finally {
      setBusy(false);
    }
  };

  const duplicates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const report of reports) if (/^[a-f0-9]{64}$/.test(report.sha256)) counts.set(report.sha256, (counts.get(report.sha256) ?? 0) + 1);
    return new Set([...counts].filter(([, count]) => count > 1).map(([hash]) => hash));
  }, [reports]);

  const exportJson = () => downloadText(JSON.stringify({ toolId, analyzedAt: new Date().toISOString(), files: reports }, null, 2), `${toolId}-file-report.json`, 'application/json;charset=utf-8');

  return <div className="space-y-4">
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><div className="flex items-center gap-2 text-sm font-bold"><FileSearch className="h-4 w-4 text-blue-600" />Local file dossier</div><p className="mt-1 text-xs leading-5 text-neutral-500">Inspect the files already selected in this tool: declared MIME type, size, modification time, first-byte signature, SHA-256, image dimensions, and media duration when the browser can read it. Files are never uploaded or stored by this workspace.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void analyze()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"><FileSearch className="h-3.5 w-3.5" />{busy ? 'Analyzing…' : 'Analyze selected files'}</button>{reports.length > 0 && <button type="button" onClick={exportJson} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold dark:border-neutral-700"><Download className="h-3.5 w-3.5" />Export report</button>}</div><div className="mt-2 text-[11px] text-neutral-500">Detected {fileCount} file input{fileCount === 1 ? '' : 's'} on this route. SHA-256 is skipped above 128 MiB to avoid excessive browser memory use.</div></div>
    {reports.length > 0 && <div className="grid gap-3 lg:grid-cols-2">{reports.map((report, index) => <div key={`${report.name}-${index}`} className={`min-w-0 rounded-xl border p-4 ${duplicates.has(report.sha256) ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20' : 'border-neutral-200 dark:border-neutral-800'}`}><div className="truncate text-sm font-bold" title={report.name}>{report.name}</div><div className="mt-3 grid grid-cols-2 gap-2"><TinyMetric label="Size" value={formatWorkbenchBytes(report.size)} /><TinyMetric label="Type" value={report.type} />{report.dimensions && <TinyMetric label="Dimensions" value={report.dimensions} />}{report.duration && <TinyMetric label="Duration" value={report.duration} />}</div><div className="mt-3 text-[11px] text-neutral-500"><div><span className="font-semibold">Modified:</span> {report.lastModified}</div><div className="mt-1 break-all font-mono"><span className="font-sans font-semibold">Signature:</span> {report.signature}</div><div className="mt-1 break-all font-mono"><span className="font-sans font-semibold">SHA-256:</span> {report.sha256}</div>{duplicates.has(report.sha256) && <div className="mt-2 font-semibold text-amber-700 dark:text-amber-400">Duplicate content detected in this selection.</div>}{report.note && <div className="mt-1">{report.note}</div>}</div></div>)}</div>}
    {message && <div role="status" className="text-xs text-neutral-600 dark:text-neutral-400">{message}</div>}
  </div>;
}

function TracePanel({ toolId }: { toolId: string }) {
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<TraceRow[]>([]);
  const lastRef = useRef('');

  useEffect(() => {
    if (!running) return;
    const capture = () => {
      const output = shortOutput(captureOutput(toolId), 1400);
      if (output === lastRef.current) return;
      lastRef.current = output;
      setRows((current) => [...current, { timestamp: new Date().toISOString(), output }].slice(-MAX_TRACE_ROWS));
    };
    capture();
    const interval = window.setInterval(capture, 1000);
    return () => window.clearInterval(interval);
  }, [running, toolId]);

  const download = () => downloadText(buildWorkbenchCsv(rows.map((row) => ({ time: row.timestamp, output: row.output }))), `${toolId}-trace.csv`, 'text/csv;charset=utf-8');

  return <div className="space-y-4"><div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><div className="flex items-center gap-2 text-sm font-bold"><Activity className="h-4 w-4 text-emerald-600" />Live output trace</div><p className="mt-1 text-xs leading-5 text-neutral-500">Record meaningful changes in the tool’s visible output once per second. Identical frames are deduplicated, up to {MAX_TRACE_ROWS} changes. Useful for diagnostics, timers, device tests, progress tools, and reproducible bug reports.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setRunning((value) => !value)} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold ${running ? 'bg-red-700 text-white' : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'}`}>{running ? 'Stop trace' : 'Start trace'}</button><button type="button" onClick={() => { setRows([]); lastRef.current = ''; }} disabled={!rows.length} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-neutral-700">Clear</button><button type="button" onClick={download} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-neutral-700"><Download className="h-3.5 w-3.5" />CSV</button></div></div>{rows.length > 0 && <div className="max-h-96 overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900"><tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Changed output</th></tr></thead><tbody>{rows.slice().reverse().map((row, index) => <tr key={`${row.timestamp}-${index}`} className="border-t border-neutral-100 align-top dark:border-neutral-800"><td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">{new Date(row.timestamp).toLocaleTimeString()}</td><td className="whitespace-pre-wrap break-words px-3 py-2 text-neutral-600 dark:text-neutral-400">{row.output}</td></tr>)}</tbody></table></div>}</div>;
}

export function STierBWorkbench({ toolId }: { toolId: string }) {
  const [active, setActive] = useState<'scenario' | 'lab' | 'files' | 'trace'>('scenario');
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const initialRef = useRef<WorkbenchSnapshot | null>(null);

  const fields = useMemo(() => describeFields(toolId), [toolId, tick]);
  const fileCount = useMemo(() => {
    const root = coreContent(toolId);
    return root ? [...root.querySelectorAll<HTMLInputElement>('input[type="file"]')].filter((input) => !isWorkbenchNode(input)).length : 0;
  }, [toolId, tick]);
  const issues = useMemo(() => validationIssues(toolId), [toolId, tick]);

  const refresh = () => setTick((value) => value + 1);

  useEffect(() => {
    const root = coreContent(toolId);
    if (!root) return;
    if (!initialRef.current) initialRef.current = captureSnapshot(toolId, 'Page defaults');
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTick((value) => value + 1), 70);
    };
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => !isWorkbenchNode(mutation.target instanceof Element ? mutation.target : mutation.target.parentElement))) schedule();
    });
    observer.observe(root, { childList: true, subtree: true });
    const onInput = (event: Event) => {
      if (event.target instanceof Element && !isWorkbenchNode(event.target)) schedule();
    };
    root.addEventListener('input', onInput, true);
    root.addEventListener('change', onInput, true);
    return () => {
      observer.disconnect();
      root.removeEventListener('input', onInput, true);
      root.removeEventListener('change', onInput, true);
      window.clearTimeout(timer);
    };
  }, [toolId]);

  const copyCurrent = async () => {
    const snapshot = captureSnapshot(toolId, 'Current state');
    await copyText(JSON.stringify(snapshot, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const sensitiveCount = fields.filter((field) => field.sensitive).length;

  return <section data-s-tier-workbench={toolId} className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800" aria-label="Expert workspace">
    <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/70 to-white p-4 shadow-sm dark:border-blue-900/70 dark:from-blue-950/20 dark:to-neutral-950 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><div className="rounded-lg border border-blue-200 bg-white p-2 dark:border-blue-900 dark:bg-neutral-950"><FlaskConical className="h-4 w-4 text-blue-600" /></div><div><h2 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100">Expert workspace</h2><p className="text-[11px] text-neutral-500">Scenarios · batch runs · sensitivity · file inspection · live trace</p></div></div></div>
        <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"><ShieldCheck className="h-3 w-3" />Local only</span><button type="button" onClick={() => void copyCurrent()} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold dark:border-neutral-700 dark:bg-neutral-950"><ClipboardCopy className="h-3.5 w-3.5" />{copied ? 'Copied' : 'Copy state'}</button><button type="button" onClick={refresh} aria-label="Refresh expert workspace" className="rounded-lg border border-neutral-300 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-950"><RefreshCw className="h-3.5 w-3.5" /></button></div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><TinyMetric label="Restorable fields" value={fields.filter((field) => !field.sensitive).length} /><TinyMetric label="Sensitive omitted" value={sensitiveCount} /><TinyMetric label="File inputs" value={fileCount} /><TinyMetric label="Form validity" value={issues.length ? `${issues.length} issue${issues.length === 1 ? '' : 's'}` : <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Valid</span>} /></div>

      {issues.length > 0 && <details className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-950/20"><summary className="cursor-pointer font-semibold text-amber-900 dark:text-amber-200">Review {issues.length} current validity issue{issues.length === 1 ? '' : 's'}</summary><ul className="mt-2 space-y-1 text-amber-800 dark:text-amber-300">{issues.slice(0, 12).map((issue, index) => <li key={`${issue.label}-${index}`}>• {issue.label}: {issue.message}</li>)}</ul></details>}

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Expert workspace modes">
        <button type="button" role="tab" aria-selected={active === 'scenario'} onClick={() => setActive('scenario')} className={sectionButton(active === 'scenario')}><Save className="h-3.5 w-3.5" />Scenarios</button>
        <button type="button" role="tab" aria-selected={active === 'lab'} onClick={() => setActive('lab')} className={sectionButton(active === 'lab')}><Beaker className="h-3.5 w-3.5" />Batch & sensitivity</button>
        <button type="button" role="tab" aria-selected={active === 'files'} onClick={() => setActive('files')} className={sectionButton(active === 'files')}><FileSearch className="h-3.5 w-3.5" />File lab{fileCount ? ` · ${fileCount}` : ''}</button>
        <button type="button" role="tab" aria-selected={active === 'trace'} onClick={() => setActive('trace')} className={sectionButton(active === 'trace')}><Activity className="h-3.5 w-3.5" />Live trace</button>
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950 sm:p-4">
        {active === 'scenario' && <ScenarioPanel toolId={toolId} fields={fields} initialSnapshot={initialRef.current} refresh={refresh} />}
        {active === 'lab' && <BatchPanel toolId={toolId} fields={fields} refresh={refresh} />}
        {active === 'files' && <FilePanel toolId={toolId} fileCount={fileCount} />}
        {active === 'trace' && <TracePanel toolId={toolId} />}
      </div>
    </div>
  </section>;
}
