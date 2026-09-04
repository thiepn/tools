export type WorkbenchFieldKind = 'text' | 'number' | 'range' | 'select' | 'checkbox' | 'radio' | 'date' | 'time' | 'datetime-local' | 'month' | 'week' | 'color' | 'email' | 'url' | 'tel' | 'password' | 'other';

export interface WorkbenchFieldState {
  key: string;
  label: string;
  kind: WorkbenchFieldKind;
  value: string;
  sensitive?: boolean;
}

export interface WorkbenchSnapshot {
  version: 1;
  toolId: string;
  name: string;
  createdAt: string;
  fields: WorkbenchFieldState[];
  output: string;
}

export interface WorkbenchFieldDiff {
  key: string;
  label: string;
  before: string;
  after: string;
}

export interface WorkbenchSnapshotDiff {
  changedFields: WorkbenchFieldDiff[];
  addedOutputLines: string[];
  removedOutputLines: string[];
  outputChanged: boolean;
}

export interface TextDiagnostics {
  characters: number;
  graphemes: number;
  utf8Bytes: number;
  words: number;
  lines: number;
  nonEmptyLines: number;
  uniqueWords: number;
  longestLine: number;
  whitespaceCharacters: number;
  digitCharacters: number;
  letterCharacters: number;
  nonAsciiCharacters: number;
}

export interface NumericScenario {
  label: string;
  value: number;
  delta: number;
  percentDelta: number;
}

const SENSITIVE_PATTERN = /(?:password|passphrase|secret|private\s*key|api\s*key|token|otp\s*secret|seed\s*phrase|recovery\s*phrase)/i;

function graphemeLength(value: string): number {
  const Segmenter = (Intl as unknown as { Segmenter?: new(locale?: string, options?: { granularity: 'grapheme' }) => { segment: (input: string) => Iterable<unknown> } }).Segmenter;
  if (!Segmenter) return Array.from(value).length;
  return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)).length;
}

export function isSensitiveWorkbenchField(label: string, kind: WorkbenchFieldKind): boolean {
  return kind === 'password' || SENSITIVE_PATTERN.test(label);
}

export function sanitizeWorkbenchOutput(value: string, maxLength = 12000): string {
  const normalized = value.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}\n…[truncated]`;
}

export function normalizeWorkbenchSnapshot(snapshot: WorkbenchSnapshot): WorkbenchSnapshot {
  const fields = snapshot.fields.map((field) => ({
    key: String(field.key),
    label: String(field.label || field.key),
    kind: field.kind,
    value: field.sensitive ? '' : String(field.value ?? ''),
    ...(field.sensitive ? { sensitive: true } : {}),
  }));
  return {
    version: 1,
    toolId: String(snapshot.toolId),
    name: String(snapshot.name || 'Snapshot').slice(0, 100),
    createdAt: Number.isFinite(Date.parse(snapshot.createdAt)) ? new Date(snapshot.createdAt).toISOString() : new Date().toISOString(),
    fields,
    output: sanitizeWorkbenchOutput(snapshot.output),
  };
}

export function parseWorkbenchSnapshot(input: string, expectedToolId: string): WorkbenchSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('Snapshot JSON is invalid.');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Snapshot must be a JSON object.');
  const candidate = parsed as Partial<WorkbenchSnapshot>;
  if (candidate.version !== 1) throw new Error('Unsupported snapshot version.');
  if (candidate.toolId !== expectedToolId) throw new Error(`This snapshot belongs to ${candidate.toolId || 'another tool'}, not ${expectedToolId}.`);
  if (!Array.isArray(candidate.fields)) throw new Error('Snapshot fields are missing.');
  const validKinds = new Set<WorkbenchFieldKind>(['text','number','range','select','checkbox','radio','date','time','datetime-local','month','week','color','email','url','tel','password','other']);
  const fields: WorkbenchFieldState[] = candidate.fields.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error(`Snapshot field ${index + 1} is invalid.`);
    const field = value as Partial<WorkbenchFieldState>;
    if (typeof field.key !== 'string' || !field.key) throw new Error(`Snapshot field ${index + 1} has no key.`);
    const kind = validKinds.has(field.kind as WorkbenchFieldKind) ? field.kind as WorkbenchFieldKind : 'other';
    return {
      key: field.key,
      label: typeof field.label === 'string' && field.label ? field.label : field.key,
      kind,
      value: field.sensitive ? '' : String(field.value ?? ''),
      ...(field.sensitive ? { sensitive: true } : {}),
    };
  });
  return normalizeWorkbenchSnapshot({
    version: 1,
    toolId: expectedToolId,
    name: typeof candidate.name === 'string' ? candidate.name : 'Imported snapshot',
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    fields,
    output: typeof candidate.output === 'string' ? candidate.output : '',
  });
}

function lineSet(value: string): Set<string> {
  return new Set(value.split('\n').map((line) => line.trim()).filter(Boolean));
}

export function diffWorkbenchSnapshots(before: WorkbenchSnapshot, after: WorkbenchSnapshot): WorkbenchSnapshotDiff {
  const previous = new Map(before.fields.map((field) => [field.key, field]));
  const current = new Map(after.fields.map((field) => [field.key, field]));
  const keys = new Set([...previous.keys(), ...current.keys()]);
  const changedFields: WorkbenchFieldDiff[] = [];
  for (const key of keys) {
    const a = previous.get(key);
    const b = current.get(key);
    const av = a?.sensitive ? '[omitted]' : a?.value ?? '';
    const bv = b?.sensitive ? '[omitted]' : b?.value ?? '';
    if (av !== bv) changedFields.push({ key, label: b?.label || a?.label || key, before: av, after: bv });
  }
  const beforeLines = lineSet(before.output);
  const afterLines = lineSet(after.output);
  const addedOutputLines = [...afterLines].filter((line) => !beforeLines.has(line)).slice(0, 30);
  const removedOutputLines = [...beforeLines].filter((line) => !afterLines.has(line)).slice(0, 30);
  return {
    changedFields,
    addedOutputLines,
    removedOutputLines,
    outputChanged: before.output !== after.output,
  };
}

export function textDiagnostics(input: string): TextDiagnostics {
  const lines = input === '' ? [] : input.replace(/\r\n?/g, '\n').split('\n');
  const words = input.trim() ? input.trim().split(/\s+/u) : [];
  const uniqueWords = new Set(words.map((word) => word.toLocaleLowerCase())).size;
  return {
    characters: Array.from(input).length,
    graphemes: graphemeLength(input),
    utf8Bytes: new TextEncoder().encode(input).length,
    words: words.length,
    lines: lines.length,
    nonEmptyLines: lines.filter((line) => line.trim()).length,
    uniqueWords,
    longestLine: lines.reduce((max, line) => Math.max(max, Array.from(line).length), 0),
    whitespaceCharacters: Array.from(input.matchAll(/\s/gu)).length,
    digitCharacters: Array.from(input.matchAll(/\p{N}/gu)).length,
    letterCharacters: Array.from(input.matchAll(/\p{L}/gu)).length,
    nonAsciiCharacters: Array.from(input).filter((character) => (character.codePointAt(0) ?? 0) > 127).length,
  };
}

export function parseBatchCases(input: string, limit = 30): string[] {
  const normalized = input.replace(/\r\n?/g, '\n');
  const sections = normalized.includes('\n---\n')
    ? normalized.split(/\n---\n/g)
    : normalized.split('\n');
  return sections.map((item) => item.trim()).filter((item) => item.length > 0).slice(0, Math.max(1, Math.min(100, limit)));
}

export function numericScenarios(current: number, percentages: number[] = [-20, -10, -5, 5, 10, 20]): NumericScenario[] {
  if (!Number.isFinite(current)) return [];
  return percentages
    .filter(Number.isFinite)
    .map((percentDelta) => {
      const delta = current * percentDelta / 100;
      return { label: `${percentDelta > 0 ? '+' : ''}${percentDelta}%`, value: current + delta, delta, percentDelta };
    });
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildWorkbenchCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\n');
}

export function formatWorkbenchBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B','KiB','MiB','GiB','TiB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: index ? 2 : 0 })} ${units[index]}`;
}

export function safeSnapshotStorageKey(toolId: string): string {
  return `tiny-tools:s-tier-b:v1:${toolId.replace(/[^a-z0-9-]/gi, '-')}`;
}
