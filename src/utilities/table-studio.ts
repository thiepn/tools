export type TableInputFormat = 'auto' | 'csv' | 'tsv' | 'json';
export type TableOutputFormat = 'csv' | 'tsv' | 'json' | 'markdown' | 'html';
export type TableDelimiter = ',' | '\t' | ';' | '|';
export type TableColumnTarget = 'all' | number;

export interface TableData {
  headers: string[];
  rows: string[][];
  detectedFormat: Exclude<TableInputFormat, 'auto'>;
  delimiter?: TableDelimiter;
}

export interface TableParseOptions {
  format?: TableInputFormat;
  hasHeader?: boolean;
  trimCells?: boolean;
  skipEmptyRows?: boolean;
}

export interface TableStats {
  rowCount: number;
  columnCount: number;
  emptyCellCount: number;
  duplicateRowCount: number;
  nonEmptyCellCount: number;
}

export interface TableParseResult {
  data: TableData;
  stats: TableStats;
  raggedRowCount: number;
}

const DELIMITER_CANDIDATES: TableDelimiter[] = [',', '\t', ';', '|'];
const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value);
}

function makeUniqueHeaders(values: string[], count: number): string[] {
  const seen = new Map<string, number>();
  const headers: string[] = [];

  for (let i = 0; i < count; i++) {
    const raw = (values[i] ?? '').trim() || `Column ${i + 1}`;
    const previous = seen.get(raw) ?? 0;
    seen.set(raw, previous + 1);
    headers.push(previous === 0 ? raw : `${raw} (${previous + 1})`);
  }

  return headers;
}

function padRows(rows: string[][], columnCount: number): string[][] {
  return rows.map((row) => {
    if (row.length === columnCount) return [...row];
    const next = row.slice(0, columnCount);
    while (next.length < columnCount) next.push('');
    return next;
  });
}

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === '');
}

function countDelimiterByRecord(input: string, delimiter: TableDelimiter, maxRecords = 20): number[] {
  const counts: number[] = [];
  let inQuotes = false;
  let current = 0;

  for (let i = 0; i < input.length && counts.length < maxRecords; i++) {
    const char = input[i];
    if (char === '"') {
      if (inQuotes && input[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === delimiter) {
      current++;
      continue;
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && input[i + 1] === '\n') i++;
      if (current > 0) counts.push(current);
      current = 0;
    }
  }

  if (current > 0 && counts.length < maxRecords) counts.push(current);
  return counts;
}

export function detectTableDelimiter(input: string): TableDelimiter {
  let best: TableDelimiter = ',';
  let bestScore = -Infinity;

  for (const candidate of DELIMITER_CANDIDATES) {
    const counts = countDelimiterByRecord(input, candidate);
    if (counts.length === 0) continue;

    const frequency = new Map<number, number>();
    for (const count of counts) frequency.set(count, (frequency.get(count) ?? 0) + 1);
    let modeCount = 0;
    let modeFrequency = 0;
    for (const [count, freq] of frequency) {
      if (freq > modeFrequency || (freq === modeFrequency && count > modeCount)) {
        modeFrequency = freq;
        modeCount = count;
      }
    }

    const consistency = modeFrequency / counts.length;
    const score = consistency * 100 + modeFrequency * 10 + modeCount;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

export function parseDelimitedRows(input: string, delimiter: TableDelimiter): string[][] {
  const source = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell.length === 0) {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (inQuotes) {
    throw new Error('Unclosed quoted field. Check the final quoted value and try again.');
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function parseJsonRows(input: string, hasHeader: boolean): { headers: string[]; rows: string[][] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON input.');
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return { headers: [], rows: [] };

    const first = parsed[0];
    if (Array.isArray(first)) {
      const matrix = parsed.map((entry) => (Array.isArray(entry) ? entry.map(normalizeCell) : [normalizeCell(entry)]));
      const maxColumns = Math.max(0, ...matrix.map((row) => row.length));
      if (hasHeader && matrix.length > 0) {
        return {
          headers: makeUniqueHeaders(matrix[0], maxColumns),
          rows: padRows(matrix.slice(1), maxColumns),
        };
      }
      return {
        headers: makeUniqueHeaders([], maxColumns),
        rows: padRows(matrix, maxColumns),
      };
    }

    if (first !== null && typeof first === 'object') {
      const keys: string[] = [];
      const keySet = new Set<string>();
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        for (const key of Object.keys(entry as Record<string, unknown>)) {
          if (!keySet.has(key)) {
            keySet.add(key);
            keys.push(key);
          }
        }
      }
      return {
        headers: makeUniqueHeaders(keys, keys.length),
        rows: parsed.map((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return keys.map(() => '');
          }
          const record = entry as Record<string, unknown>;
          return keys.map((key) => normalizeCell(record[key]));
        }),
      };
    }

    return {
      headers: ['Value'],
      rows: parsed.map((value) => [normalizeCell(value)]),
    };
  }

  if (parsed && typeof parsed === 'object') {
    return {
      headers: ['Key', 'Value'],
      rows: Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, normalizeCell(value)]),
    };
  }

  return { headers: ['Value'], rows: [[normalizeCell(parsed)]] };
}

export function calculateTableStats(data: Pick<TableData, 'headers' | 'rows'>): TableStats {
  let emptyCellCount = 0;
  const seen = new Set<string>();
  let duplicateRowCount = 0;

  for (const row of data.rows) {
    for (const cell of row) {
      if (cell.trim() === '') emptyCellCount++;
    }
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicateRowCount++;
    else seen.add(key);
  }

  const cellCount = data.rows.length * data.headers.length;
  return {
    rowCount: data.rows.length,
    columnCount: data.headers.length,
    emptyCellCount,
    duplicateRowCount,
    nonEmptyCellCount: Math.max(0, cellCount - emptyCellCount),
  };
}

export function parseTableInput(input: string, options: TableParseOptions = {}): TableParseResult {
  const {
    format = 'auto',
    hasHeader = true,
    trimCells = true,
    skipEmptyRows = true,
  } = options;
  const trimmed = input.trim();
  if (!trimmed) {
    const data: TableData = { headers: [], rows: [], detectedFormat: format === 'json' ? 'json' : 'csv', delimiter: ',' };
    return { data, stats: calculateTableStats(data), raggedRowCount: 0 };
  }

  const shouldTryJson = format === 'json' || (format === 'auto' && (trimmed.startsWith('[') || trimmed.startsWith('{')));
  if (shouldTryJson) {
    try {
      const json = parseJsonRows(trimmed, hasHeader);
      const rows = json.rows.map((row) => row.map((cell) => (trimCells ? cell.trim() : cell)));
      const filteredRows = skipEmptyRows ? rows.filter((row) => !isEmptyRow(row)) : rows;
      const data: TableData = { headers: json.headers, rows: filteredRows, detectedFormat: 'json' };
      return { data, stats: calculateTableStats(data), raggedRowCount: 0 };
    } catch (error) {
      if (format === 'json') throw error;
    }
  }

  const delimiter: TableDelimiter = format === 'tsv' ? '\t' : format === 'csv' ? ',' : detectTableDelimiter(input);
  let rows = parseDelimitedRows(input, delimiter);
  if (trimCells) rows = rows.map((row) => row.map((cell) => cell.trim()));
  if (skipEmptyRows) rows = rows.filter((row) => !isEmptyRow(row));

  const maxColumns = Math.max(0, ...rows.map((row) => row.length));
  const raggedRowCount = rows.filter((row) => row.length !== maxColumns).length;
  const headers = hasHeader && rows.length > 0
    ? makeUniqueHeaders(rows[0], maxColumns)
    : makeUniqueHeaders([], maxColumns);
  const body = hasHeader ? rows.slice(1) : rows;
  const normalized = padRows(body, maxColumns);
  const data: TableData = {
    headers,
    rows: normalized,
    detectedFormat: delimiter === '\t' ? 'tsv' : 'csv',
    delimiter,
  };
  return { data, stats: calculateTableStats(data), raggedRowCount };
}

function compareCells(a: string, b: string): number {
  const aTrim = a.trim();
  const bTrim = b.trim();
  const aNumber = Number(aTrim);
  const bNumber = Number(bTrim);
  const bothNumeric = aTrim !== '' && bTrim !== '' && Number.isFinite(aNumber) && Number.isFinite(bNumber);
  return bothNumeric ? aNumber - bNumber : COLLATOR.compare(a, b);
}

export function sortTableRows(rows: string[][], columnIndex: number, direction: 'asc' | 'desc' = 'asc'): string[][] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row: [...row], index }))
    .sort((a, b) => {
      const comparison = compareCells(a.row[columnIndex] ?? '', b.row[columnIndex] ?? '');
      return comparison === 0 ? a.index - b.index : comparison * multiplier;
    })
    .map(({ row }) => row);
}

export function filterTableRows(
  rows: string[][],
  query: string,
  target: TableColumnTarget = 'all',
  caseSensitive = false
): string[][] {
  // Preserve row identity so filtered preview edits can resolve back to the
  // exact source row, including duplicate rows with identical values.
  if (!query) return [...rows];
  const needle = caseSensitive ? query : query.toLocaleLowerCase();
  return rows.filter((row) => {
    const cells = target === 'all' ? row : [row[target] ?? ''];
    return cells.some((cell) => {
      const value = caseSensitive ? cell : cell.toLocaleLowerCase();
      return value.includes(needle);
    });
  });
}

export function deduplicateTableRows(
  rows: string[][],
  target: TableColumnTarget = 'all',
  caseSensitive = false
): string[][] {
  const seen = new Set<string>();
  const output: string[][] = [];
  for (const row of rows) {
    const rawKey = target === 'all' ? JSON.stringify(row) : row[target] ?? '';
    const key = caseSensitive ? rawKey : rawKey.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push([...row]);
  }
  return output;
}

export function transposeTable(data: TableData): TableData {
  const matrix = [data.headers, ...data.rows];
  if (matrix.length === 0 || data.headers.length === 0) return { ...data, headers: [], rows: [] };
  const width = Math.max(...matrix.map((row) => row.length));
  const normalized = padRows(matrix, width);
  const transposed = Array.from({ length: width }, (_, column) => normalized.map((row) => row[column] ?? ''));
  const maxColumns = transposed[0]?.length ?? 0;
  return {
    headers: makeUniqueHeaders(transposed[0] ?? [], maxColumns),
    rows: padRows(transposed.slice(1), maxColumns),
    detectedFormat: data.detectedFormat,
    delimiter: data.delimiter,
  };
}

function escapeDelimitedCell(value: string, delimiter: TableDelimiter): string {
  if (value.includes('"') || value.includes(delimiter) || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeDelimitedTable(data: Pick<TableData, 'headers' | 'rows'>, delimiter: TableDelimiter): string {
  return [data.headers, ...data.rows]
    .map((row) => row.map((cell) => escapeDelimitedCell(cell ?? '', delimiter)).join(delimiter))
    .join('\r\n');
}

export function tableToJson(data: Pick<TableData, 'headers' | 'rows'>): string {
  const records = data.rows.map((row) => Object.fromEntries(data.headers.map((header, index) => [header, row[index] ?? ''])));
  return JSON.stringify(records, null, 2);
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

export function tableToMarkdown(data: Pick<TableData, 'headers' | 'rows'>): string {
  if (data.headers.length === 0) return '';
  const header = `| ${data.headers.map(escapeMarkdownCell).join(' | ')} |`;
  const separator = `| ${data.headers.map(() => '---').join(' | ')} |`;
  const body = data.rows.map((row) => `| ${data.headers.map((_, index) => escapeMarkdownCell(row[index] ?? '')).join(' | ')} |`);
  return [header, separator, ...body].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function tableToHtml(data: Pick<TableData, 'headers' | 'rows'>): string {
  const head = data.headers.map((header) => `      <th>${escapeHtml(header)}</th>`).join('\n');
  const body = data.rows
    .map((row) => `    <tr>\n${data.headers.map((_, index) => `      <td>${escapeHtml(row[index] ?? '')}</td>`).join('\n')}\n    </tr>`)
    .join('\n');
  return `<table>\n  <thead>\n    <tr>\n${head}\n    </tr>\n  </thead>\n  <tbody>\n${body}\n  </tbody>\n</table>`;
}

export function formatTableOutput(data: TableData, format: TableOutputFormat): string {
  switch (format) {
    case 'tsv':
      return serializeDelimitedTable(data, '\t');
    case 'json':
      return tableToJson(data);
    case 'markdown':
      return tableToMarkdown(data);
    case 'html':
      return tableToHtml(data);
    case 'csv':
    default:
      return serializeDelimitedTable(data, ',');
  }
}

export function getTableOutputExtension(format: TableOutputFormat): string {
  return format === 'markdown' ? 'md' : format;
}
