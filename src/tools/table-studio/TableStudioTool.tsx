import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Rows3,
  Table2,
  Upload,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  AccessibleDropZone,
  CopyButton,
  ToolActionBar,
  ToolStatus,
} from '../../components/tool-ui/ToolControls';
import { consumePendingTransfer } from '../../storage/transfer';
import {
  calculateTableStats,
  deduplicateTableRows,
  filterTableRows,
  formatTableOutput,
  getTableOutputExtension,
  parseTableInput,
  sortTableRows,
  transposeTable,
  type TableColumnTarget,
  type TableData,
  type TableInputFormat,
  type TableOutputFormat,
} from '../../utilities/table-studio';

const SAMPLE_CSV = `Name,Team,Score,Notes
Ada,Blue,97,"Fast, accurate"
Grace,Green,91,"Multi-line
note"
Linus,Blue,88,Kernel work
Ada,Blue,97,"Fast, accurate"`;

const PREVIEW_ROW_LIMIT = 150;

function formatDetectedSource(data: TableData): string {
  if (data.detectedFormat === 'json') return 'JSON';
  if (data.delimiter === '\t') return 'TSV';
  if (data.delimiter === ';') return 'semicolon-delimited';
  if (data.delimiter === '|') return 'pipe-delimited';
  return 'CSV';
}

function downloadText(text: string, format: TableOutputFormat) {
  const mime =
    format === 'json'
      ? 'application/json;charset=utf-8'
      : format === 'html'
        ? 'text/html;charset=utf-8'
        : 'text/plain;charset=utf-8';
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `table-studio.${getTableOutputExtension(format)}`;
  link.click();
  URL.revokeObjectURL(url);
}

export const TableStudioTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [inputFormat, setInputFormat] = useState<TableInputFormat>('auto');
  const [hasHeader, setHasHeader] = useState(true);
  const [trimCells, setTrimCells] = useState(true);
  const [skipEmptyRows, setSkipEmptyRows] = useState(true);
  const [workingData, setWorkingData] = useState<TableData | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterTarget, setFilterTarget] = useState<TableColumnTarget>('all');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [sortColumn, setSortColumn] = useState(0);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [dedupeTarget, setDedupeTarget] = useState<TableColumnTarget>('all');
  const [outputFormat, setOutputFormat] = useState<TableOutputFormat>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pending = consumePendingTransfer('table-studio');
    if (pending) setInput(pending);
  }, []);

  const parsed = useMemo(() => {
    try {
      return {
        result: parseTableInput(input, {
          format: inputFormat,
          hasHeader,
          trimCells,
          skipEmptyRows,
        }),
        error: null as string | null,
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'Could not parse this table.',
      };
    }
  }, [input, inputFormat, hasHeader, trimCells, skipEmptyRows]);

  useEffect(() => {
    if (!parsed.result) {
      setWorkingData(null);
      return;
    }
    setWorkingData({
      ...parsed.result.data,
      headers: [...parsed.result.data.headers],
      rows: parsed.result.data.rows.map((row) => [...row]),
    });
    setFilterQuery('');
    setFilterTarget('all');
    setDedupeTarget('all');
    setSortColumn(0);
  }, [parsed.result]);

  const filteredRows = useMemo(() => {
    if (!workingData) return [];
    return filterTableRows(workingData.rows, filterQuery, filterTarget, caseSensitive);
  }, [workingData, filterQuery, filterTarget, caseSensitive]);

  const outputData = useMemo<TableData | null>(() => {
    if (!workingData) return null;
    return { ...workingData, rows: filteredRows };
  }, [workingData, filteredRows]);

  const outputText = useMemo(
    () => (outputData ? formatTableOutput(outputData, outputFormat) : ''),
    [outputData, outputFormat]
  );

  const currentStats = useMemo(
    () => (workingData ? calculateTableStats(workingData) : null),
    [workingData]
  );

  const handleFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.tsv') && !lower.endsWith('.json') && !lower.endsWith('.txt')) {
      return;
    }
    const text = await file.text();
    setInput(text);
    if (lower.endsWith('.json')) setInputFormat('json');
    else if (lower.endsWith('.tsv')) setInputFormat('tsv');
    else if (lower.endsWith('.csv')) setInputFormat('csv');
    else setInputFormat('auto');
  };

  const handleResetWorkingData = () => {
    if (!parsed.result) return;
    setWorkingData({
      ...parsed.result.data,
      headers: [...parsed.result.data.headers],
      rows: parsed.result.data.rows.map((row) => [...row]),
    });
    setFilterQuery('');
  };

  const handleSort = () => {
    if (!workingData || workingData.headers.length === 0) return;
    setWorkingData({
      ...workingData,
      rows: sortTableRows(workingData.rows, sortColumn, sortDirection),
    });
  };

  const handleDeduplicate = () => {
    if (!workingData) return;
    setWorkingData({
      ...workingData,
      rows: deduplicateTableRows(workingData.rows, dedupeTarget, caseSensitive),
    });
  };

  const handleTranspose = () => {
    if (!workingData) return;
    setWorkingData(transposeTable(workingData));
    setFilterQuery('');
    setFilterTarget('all');
    setDedupeTarget('all');
    setSortColumn(0);
  };

  const updateHeader = (index: number, value: string) => {
    if (!workingData) return;
    const headers = [...workingData.headers];
    headers[index] = value || `Column ${index + 1}`;
    setWorkingData({ ...workingData, headers });
  };

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    if (!workingData) return;
    const rows = workingData.rows.map((row) => [...row]);
    rows[rowIndex][columnIndex] = value;
    setWorkingData({ ...workingData, rows });
  };

  const sourceStatus = parsed.error ? (
    <ToolStatus tone="error">{parsed.error}</ToolStatus>
  ) : workingData && currentStats ? (
    <ToolStatus tone={parsed.result?.raggedRowCount ? 'warning' : 'success'}>
      Parsed {formatDetectedSource(workingData)} · {currentStats.rowCount.toLocaleString()} rows ·{' '}
      {currentStats.columnCount.toLocaleString()} columns
      {parsed.result?.raggedRowCount
        ? ` · ${parsed.result.raggedRowCount} uneven row${parsed.result.raggedRowCount === 1 ? '' : 's'} padded`
        : ''}
    </ToolStatus>
  ) : (
    <ToolStatus>Paste or upload tabular data to begin.</ToolStatus>
  );

  return (
    <ToolShell
      toolId="table-studio"
      title="CSV & Table Studio"
      description="Parse, inspect, clean, sort, filter, deduplicate, transpose, edit, and convert tabular data entirely in your browser."
      category="productivity"
      relatedToolIds={['json-formatter', 'list-processor', 'text-cleaner']}
      outputToTransfer={outputText}
    >
      <div className="space-y-6">
        <section className="space-y-3" aria-labelledby="table-source-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="table-source-heading" className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                1. Import table data
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                CSV, TSV, semicolon/pipe-delimited text, or JSON. Quoted commas and multiline fields are supported.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setInput(SAMPLE_CSV);
                  setInputFormat('auto');
                }}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                Load sample
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Open file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.json,.txt,text/csv,text/tab-separated-values,application/json,text/plain"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.target.value = '';
                }}
              />
            </div>
          </div>

          <AccessibleDropZone
            ariaLabel="Drop CSV, TSV, JSON, or text table file"
            onActivate={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className="rounded-lg border-2 border-dashed border-neutral-300 p-2 dark:border-neutral-700"
          >
            <textarea
              value={input}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onChange={(event) => setInput(event.target.value)}
              placeholder={'Paste CSV/TSV here, for example:\nName,Score\nAda,97\nGrace,91'}
              rows={9}
              spellCheck={false}
              aria-label="Table source data"
              className="w-full resize-y rounded-md border border-neutral-200 bg-white p-3 font-mono text-sm text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </AccessibleDropZone>

          <div className="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-950">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Input format
              <select
                value={inputFormat}
                onChange={(event) => setInputFormat(event.target.value as TableInputFormat)}
                className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="auto">Auto-detect</option>
                <option value="csv">CSV (comma)</option>
                <option value="tsv">TSV (tab)</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end rounded-md px-1 py-2 text-xs text-neutral-700 dark:text-neutral-300">
              <input type="checkbox" checked={hasHeader} onChange={(event) => setHasHeader(event.target.checked)} />
              First row is header
            </label>
            <label className="flex items-center gap-2 self-end rounded-md px-1 py-2 text-xs text-neutral-700 dark:text-neutral-300">
              <input type="checkbox" checked={trimCells} onChange={(event) => setTrimCells(event.target.checked)} />
              Trim cell whitespace
            </label>
            <label className="flex items-center gap-2 self-end rounded-md px-1 py-2 text-xs text-neutral-700 dark:text-neutral-300">
              <input type="checkbox" checked={skipEmptyRows} onChange={(event) => setSkipEmptyRows(event.target.checked)} />
              Skip empty rows
            </label>
          </div>

          {sourceStatus}
        </section>

        {workingData && currentStats && workingData.headers.length > 0 && (
          <>
            <section className="space-y-3" aria-labelledby="table-transform-heading">
              <div>
                <h2 id="table-transform-heading" className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  2. Clean and transform
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  Transformations stay in memory. Reset returns to the current parsed source.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Rows', currentStats.rowCount],
                  ['Columns', currentStats.columnCount],
                  ['Empty cells', currentStats.emptyCellCount],
                  ['Duplicate rows', currentStats.duplicateRowCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
                    <div className="mt-1 text-xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {Number(value).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 p-3 lg:grid-cols-3 dark:border-neutral-800">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    <Filter className="h-3.5 w-3.5" aria-hidden="true" /> Filter rows
                  </div>
                  <input
                    value={filterQuery}
                    onChange={(event) => setFilterQuery(event.target.value)}
                    placeholder="Find text in rows…"
                    className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <select
                    value={String(filterTarget)}
                    onChange={(event) => setFilterTarget(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                    className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    <option value="all">All columns</option>
                    {workingData.headers.map((header, index) => (
                      <option key={`${header}-${index}`} value={index}>{header}</option>
                    ))}
                  </select>
                  <div className="text-[11px] text-neutral-500">
                    {filterQuery ? `${filteredRows.length.toLocaleString()} of ${workingData.rows.length.toLocaleString()} rows match` : 'No filter applied'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {sortDirection === 'asc' ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" />} Sort rows
                  </div>
                  <select
                    value={sortColumn}
                    onChange={(event) => setSortColumn(Number(event.target.value))}
                    className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    {workingData.headers.map((header, index) => (
                      <option key={`${header}-${index}`} value={index}>{header}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={sortDirection}
                      onChange={(event) => setSortDirection(event.target.value as 'asc' | 'desc')}
                      className="rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleSort}
                      className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      Apply sort
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    <Rows3 className="h-3.5 w-3.5" aria-hidden="true" /> Deduplicate
                  </div>
                  <select
                    value={String(dedupeTarget)}
                    onChange={(event) => setDedupeTarget(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                    className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    <option value="all">Exact full rows</option>
                    {workingData.headers.map((header, index) => (
                      <option key={`${header}-${index}`} value={index}>Unique by {header}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleDeduplicate}
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    Remove duplicates
                  </button>
                  <label className="flex items-center gap-2 text-[11px] text-neutral-500">
                    <input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />
                    Case-sensitive filter/dedupe
                  </label>
                </div>
              </div>

              <ToolActionBar align="between">
                <button
                  type="button"
                  onClick={handleTranspose}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Transpose rows ↔ columns
                </button>
                <button
                  type="button"
                  onClick={handleResetWorkingData}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Reset transformations
                </button>
              </ToolActionBar>
            </section>

            <section className="space-y-3" aria-labelledby="table-preview-heading">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="table-preview-heading" className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    3. Preview and edit
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    Headers and visible cells are editable. All rows remain in memory and export, even when preview is capped.
                  </p>
                </div>
                <ToolStatus tone="info">
                  Showing {Math.min(filteredRows.length, PREVIEW_ROW_LIMIT).toLocaleString()} of {filteredRows.length.toLocaleString()} filtered rows
                </ToolStatus>
              </div>

              <div className="max-h-[520px] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                <table className="min-w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-800">
                    <tr>
                      <th className="w-12 border-b border-r border-neutral-200 px-2 py-2 text-right font-mono text-neutral-500 dark:border-neutral-700">#</th>
                      {workingData.headers.map((header, columnIndex) => (
                        <th key={columnIndex} className="min-w-36 border-b border-r border-neutral-200 p-1.5 text-left dark:border-neutral-700">
                          <input
                            value={header}
                            onChange={(event) => updateHeader(columnIndex, event.target.value)}
                            aria-label={`Column ${columnIndex + 1} header`}
                            className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-bold text-neutral-900 hover:border-neutral-300 focus:border-blue-500 focus:outline-none dark:text-neutral-100"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.slice(0, PREVIEW_ROW_LIMIT).map((row, filteredIndex) => {
                      const originalIndex = workingData.rows.indexOf(row);
                      return (
                        <tr key={`${filteredIndex}-${row.join('\u0001')}`} className="odd:bg-white even:bg-neutral-50 dark:odd:bg-neutral-900 dark:even:bg-neutral-950">
                          <td className="border-b border-r border-neutral-200 px-2 py-1.5 text-right font-mono text-neutral-400 dark:border-neutral-800">
                            {filteredIndex + 1}
                          </td>
                          {workingData.headers.map((_, columnIndex) => (
                            <td key={columnIndex} className="border-b border-r border-neutral-200 p-1 dark:border-neutral-800">
                              <input
                                value={row[columnIndex] ?? ''}
                                onChange={(event) => {
                                  const targetIndex = originalIndex >= 0 ? originalIndex : filteredIndex;
                                  updateCell(targetIndex, columnIndex, event.target.value);
                                }}
                                aria-label={`Row ${filteredIndex + 1}, ${workingData.headers[columnIndex]}`}
                                className="w-full min-w-32 rounded border border-transparent bg-transparent px-1.5 py-1 text-neutral-800 hover:border-neutral-300 focus:border-blue-500 focus:outline-none dark:text-neutral-200"
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="table-export-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="table-export-heading" className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    4. Convert and export
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    The current filter is included in output. Sorting, dedupe, edits, and transpose are preserved.
                  </p>
                </div>
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Output format
                  <select
                    value={outputFormat}
                    onChange={(event) => setOutputFormat(event.target.value as TableOutputFormat)}
                    className="ml-2 rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    <option value="csv">CSV</option>
                    <option value="tsv">TSV</option>
                    <option value="json">JSON</option>
                    <option value="markdown">Markdown table</option>
                    <option value="html">HTML table</option>
                  </select>
                </label>
              </div>

              <textarea
                value={outputText}
                readOnly
                rows={10}
                spellCheck={false}
                aria-label="Converted table output"
                className="w-full resize-y rounded-lg border border-neutral-300 bg-neutral-50 p-3 font-mono text-xs text-neutral-800 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
              />

              <ToolActionBar align="between">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  {outputFormat === 'json' ? <FileJson className="h-4 w-4" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
                  <span>{filteredRows.length.toLocaleString()} rows · {workingData.headers.length.toLocaleString()} columns · {outputText.length.toLocaleString()} characters</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <CopyButton value={outputText} label="Copy output" />
                  <button
                    type="button"
                    disabled={!outputText}
                    onClick={() => downloadText(outputText, outputFormat)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Download .{getTableOutputExtension(outputFormat)}
                  </button>
                </div>
              </ToolActionBar>
            </section>
          </>
        )}
      </div>
    </ToolShell>
  );
};

export default TableStudioTool;
