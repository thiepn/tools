import React, { useState, useMemo } from 'react';
import { Copy, Check, Trash2, RotateCcw, FileText, CheckSquare, Square } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { cleanText, defaultCleanerOptions, type TextCleanerOptions } from '../../utilities/text-cleaner';
import { copyToClipboard } from '../../utilities/clipboard';

interface TextCleanerToolProps {
  initialText?: string;
}

const EXAMPLE_TEXT = `  "Hello — World!"   Here’s a ‘sample’ text…  
	This line has a tab and trailing spaces.    
This line is a duplicate.
This line is a duplicate.
THIS LINE IS A DUPLICATE.

  
Another line with   multiple    spaces    and   smart quotes: “quoted text”.
`;

export const TextCleanerTool: React.FC<TextCleanerToolProps> = ({ initialText = '' }) => {
  const [input, setInput] = useState(initialText || '');
  const [options, setOptions] = useState<TextCleanerOptions>(defaultCleanerOptions);
  const [copied, setCopied] = useState(false);

  const { output, stats } = useMemo(() => {
    return cleanText(input, options);
  }, [input, options]);

  const handleCopy = async () => {
    const success = await copyToClipboard(output);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSelectAllOptions = () => {
    setOptions({
      trimEntireText: true,
      trimEachLine: true,
      collapseSpaces: true,
      tabsToSpaces: true,
      tabSize: 2,
      normalizeLineEndings: true,
      removeTrailingSpaces: true,
      removeEmptyLines: true,
      collapseEmptyLines: false,
      removeDuplicates: true,
      caseSensitiveDuplicates: true,
      removeInvisibleChars: true,
      removeZeroWidthJoiners: false,
      normalizeSmartQuotes: true,
      normalizeDashes: true,
    });
  };

  const handleResetOptions = () => {
    setOptions(defaultCleanerOptions);
  };

  const handleLoadExample = () => {
    setInput(EXAMPLE_TEXT);
  };

  const handleClear = () => {
    setInput('');
  };

  return (
    <ToolShell
      toolId="text-cleaner"
      title="Text Cleaner"
      description="Clean, normalize, trim, and format pasted text with selectable transformations."
      category="text"
      relatedToolIds={['case-converter', 'word-counter', 'list-processor']}
      outputToTransfer={output}
    >
      <div className="space-y-6">
        {/* Options Bar */}
        <div className="bg-neutral-50 dark:bg-neutral-950 p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Cleaning Transformations
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllOptions}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <CheckSquare className="w-3 h-3" />
                Select all
              </button>
              <span className="text-neutral-300 dark:text-neutral-700">•</span>
              <button
                type="button"
                onClick={handleResetOptions}
                className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset defaults
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-neutral-800 dark:text-neutral-200">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.trimEntireText}
                onChange={(e) => setOptions({ ...options, trimEntireText: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Trim entire text</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.trimEachLine}
                onChange={(e) => setOptions({ ...options, trimEachLine: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Trim each line</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.collapseSpaces}
                onChange={(e) => setOptions({ ...options, collapseSpaces: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Collapse repeated spaces</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.removeTrailingSpaces}
                onChange={(e) => setOptions({ ...options, removeTrailingSpaces: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Remove trailing spaces</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.removeEmptyLines}
                onChange={(e) => setOptions({ ...options, removeEmptyLines: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Remove all empty lines</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.collapseEmptyLines && !options.removeEmptyLines}
                disabled={options.removeEmptyLines}
                onChange={(e) => setOptions({ ...options, collapseEmptyLines: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Reduce multiple blank lines to one</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.normalizeSmartQuotes}
                onChange={(e) => setOptions({ ...options, normalizeSmartQuotes: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Normalize smart quotes (“ ” ‘ ’)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.normalizeDashes}
                onChange={(e) => setOptions({ ...options, normalizeDashes: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Normalize dashes (— –)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.removeInvisibleChars}
                onChange={(e) => setOptions({ ...options, removeInvisibleChars: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Remove invisible/zero-width spaces & BOM</span>
            </label>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.tabsToSpaces}
                  onChange={(e) => setOptions({ ...options, tabsToSpaces: e.target.checked })}
                  className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Tabs to spaces:</span>
              </label>
              <select
                value={options.tabSize}
                onChange={(e) => setOptions({ ...options, tabSize: parseInt(e.target.value, 10) })}
                className="text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5"
                disabled={!options.tabsToSpaces}
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
                <option value={8}>8 spaces</option>
              </select>
            </div>

            <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.removeDuplicates}
                  onChange={(e) => setOptions({ ...options, removeDuplicates: e.target.checked })}
                  className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Remove duplicate lines</span>
              </label>
              {options.removeDuplicates && (
                <label className="flex items-center gap-1 text-[11px] text-neutral-500 ml-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={options.caseSensitiveDuplicates}
                    onChange={(e) => setOptions({ ...options, caseSensitiveDuplicates: e.target.checked })}
                    className="rounded border-neutral-300 text-blue-600"
                  />
                  <span>Case-sensitive</span>
                </label>
              )}
            </div>

            {/* Advanced Joiner Cleaning Option */}
            <div className="col-span-1 sm:col-span-2 md:col-span-3 pt-2 mt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={options.removeZeroWidthJoiners}
                    onChange={(e) => setOptions({ ...options, removeZeroWidthJoiners: e.target.checked })}
                    className="rounded border-neutral-300 dark:border-neutral-700 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-medium">Strip ZWNJ (U+200C) & ZWJ (U+200D) joiners</span>
                </label>
                <span className="text-[10px] text-amber-700 dark:text-amber-400">
                  (Warning: May alter Persian/Arabic word meanings, Indic script ligatures, or break composite emojis like 👨‍👩‍👧)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Text Areas (Side-by-side on desktop, stacked on mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Input Box */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Input Text
              </span>
              <div className="flex items-center gap-2">
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
                    onClick={handleClear}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <textarea
              id="cleaner-input-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste or type text to clean here..."
              rows={12}
              className="w-full p-3 font-mono text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-y"
              spellCheck={false}
            />

            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between px-1">
              <span>{stats.inputChars.toLocaleString()} characters</span>
              <span>{stats.inputLines.toLocaleString()} lines</span>
            </div>
          </div>

          {/* Output Box */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                Cleaned Output
              </span>
              <div className="flex items-center gap-2">
                <button
                  id="copy-clean-text-btn"
                  type="button"
                  onClick={handleCopy}
                  disabled={!output}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    copied
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : output
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white border-transparent'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-neutral-200 dark:border-neutral-700 cursor-not-allowed'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Result</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              id="cleaner-output-textarea"
              value={output}
              readOnly
              placeholder="Cleaned output will appear here live..."
              rows={12}
              className="w-full p-3 font-mono text-sm bg-neutral-100/70 dark:bg-neutral-950/80 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none resize-y text-neutral-800 dark:text-neutral-200"
              spellCheck={false}
            />

            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center justify-between gap-1 px-1">
              <div className="flex items-center gap-3">
                <span>{stats.outputChars.toLocaleString()} characters</span>
                <span>{stats.outputLines.toLocaleString()} lines</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                {stats.charsRemoved > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    -{stats.charsRemoved} chars
                  </span>
                )}
                {stats.linesRemoved > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    -{stats.linesRemoved} lines
                  </span>
                )}
                {stats.duplicatesRemoved > 0 && (
                  <span className="text-blue-600 dark:text-blue-400">
                    -{stats.duplicatesRemoved} duplicates
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default TextCleanerTool;
