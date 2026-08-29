import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Minimize2,
  Maximize2,
  ArrowDownNarrowWide,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { formatAndValidateJson, type JsonFormatOptions } from '../../utilities/json-formatter';
import { copyToClipboard } from '../../utilities/clipboard';

interface JsonFormatterToolProps {
  initialText?: string;
}

const SAMPLE_JSON = `{
  "appName": "Tiny Tools",
  "version": 1.0,
  "privacy": "local-only",
  "tools": [
    { "id": "json-formatter", "category": "developer", "active": true },
    { "id": "regex-tester", "category": "developer", "active": true }
  ],
  "author": { "name": "DeepMind", "verified": true }
}`;

export const JsonFormatterTool: React.FC<JsonFormatterToolProps> = ({ initialText = '' }) => {
  const [input, setInput] = useState(initialText || '');
  const [indentOption, setIndentOption] = useState<2 | 4 | 'minify'>(2);
  const [sortKeys, setSortKeys] = useState(false);
  const [copied, setCopied] = useState(false);

  const validation = useMemo(() => {
    const opts: JsonFormatOptions = {
      indent: indentOption,
      sortKeys,
    };
    return formatAndValidateJson(input, opts);
  }, [input, indentOption, sortKeys]);

  const handleCopy = async () => {
    const textToCopy = validation.isValid && validation.formatted ? validation.formatted : input;
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const content = validation.isValid && validation.formatted ? validation.formatted : input;
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadExample = () => {
    setInput(SAMPLE_JSON);
  };

  const handleFormatInPlace = (indent: 2 | 4 | 'minify') => {
    setIndentOption(indent);
    if (validation.isValid && validation.formatted) {
      setInput(validation.formatted);
    }
  };

  return (
    <ToolShell
      toolId="json-formatter"
      title="JSON Formatter & Validator"
      description="Format, prettify, minify, sort keys, and validate JSON data with line error detection."
      category="developer"
      relatedToolIds={['encoding-tools', 'regex-tester', 'text-cleaner']}
      outputToTransfer={validation.formatted || input}
    >
      <div className="space-y-6">
        {/* Toolbar & Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleFormatInPlace(2)}
              className={`px-2.5 py-1.5 rounded font-medium border flex items-center gap-1.5 transition-colors ${
                indentOption === 2
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <Maximize2 className="w-3 h-3" />
              <span>2 Spaces</span>
            </button>

            <button
              type="button"
              onClick={() => handleFormatInPlace(4)}
              className={`px-2.5 py-1.5 rounded font-medium border flex items-center gap-1.5 transition-colors ${
                indentOption === 4
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <Maximize2 className="w-3 h-3" />
              <span>4 Spaces</span>
            </button>

            <button
              type="button"
              onClick={() => handleFormatInPlace('minify')}
              className={`px-2.5 py-1.5 rounded font-medium border flex items-center gap-1.5 transition-colors ${
                indentOption === 'minify'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <Minimize2 className="w-3 h-3" />
              <span>Minify</span>
            </button>

            <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1 hidden sm:block" />

            <label className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sortKeys}
                onChange={(e) => setSortKeys(e.target.checked)}
                className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <ArrowDownNarrowWide className="w-3.5 h-3.5 text-neutral-500" />
              <span>Sort Object Keys</span>
            </label>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleLoadExample}
              className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
            >
              Load example
            </button>

            {input.length > 0 && (
              <button
                type="button"
                onClick={() => setInput('')}
                className="text-xs text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={!validation.isValid}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 disabled:opacity-40 transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!input}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded font-medium border transition-colors ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white border-transparent'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Validation Status Indicator */}
        {input.trim().length > 0 && (
          <div>
            {validation.isValid ? (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Valid JSON document</span>
                </div>
                {validation.stats && (
                  <div className="flex items-center gap-4 text-emerald-800 dark:text-emerald-300">
                    <span>{validation.stats.sizeBytes.toLocaleString()} bytes</span>
                    <span>{validation.stats.lines} lines</span>
                    <span>{validation.stats.keysCount} keys</span>
                    <span>depth {validation.stats.depth}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 text-xs">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold">JSON Syntax Error</div>
                  <div className="font-mono text-xs">{validation.error}</div>
                  {(validation.line !== undefined || validation.column !== undefined) && (
                    <div className="text-[11px] text-red-700 dark:text-red-300 font-mono">
                      Approximate position: Line {validation.line}, Column {validation.column}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dual Pane Layout (Input & Formatted) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="json-input-textarea" className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" />
              Source Input
            </label>
            <textarea
              id="json-input-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste JSON string or object here..."
              rows={16}
              className="w-full p-3 font-mono text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-y"
              spellCheck={false}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <span>Formatted Output</span>
              {validation.isValid && validation.formatted && (
                <button
                  type="button"
                  onClick={() => setInput(validation.formatted!)}
                  className="text-blue-600 dark:text-blue-400 font-normal hover:underline"
                >
                  Use as input
                </button>
              )}
            </div>
            <textarea
              id="json-output-textarea"
              value={validation.formatted || ''}
              readOnly
              placeholder="Formatted result will be displayed here..."
              rows={16}
              className="w-full p-3 font-mono text-xs sm:text-sm bg-neutral-100/60 dark:bg-neutral-950/80 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none resize-y text-neutral-900 dark:text-neutral-100"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default JsonFormatterTool;
