import React, { useState, useMemo } from 'react';
import {
  GitCompare,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRightLeft,
  FileCode,
  CheckCircle2,
  Sliders,
  Maximize2,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  computeTextDiff,
  formatToMarkdownDiff,
  DiffOptions,
} from '../../utilities/text-diff';

const SAMPLE_ORIGINAL = `function calculateTotal(items, discountRate) {
  let subtotal = 0;
  for (let i = 0; i < items.length; i++) {
    subtotal += items[i].price;
  }
  const discount = subtotal * discountRate;
  const tax = (subtotal - discount) * 0.08;
  return subtotal - discount + tax;
}`;

const SAMPLE_REVISED = `function calculateTotal(items, discountRate = 0, taxRate = 0.08) {
  const subtotal = items.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0);
  const discountAmount = subtotal * discountRate;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tax = taxableAmount * taxRate;
  return Number((taxableAmount + tax).toFixed(2));
}`;

export const TextDiffCheckerTool: React.FC = () => {
  const [originalText, setOriginalText] = useState<string>(SAMPLE_ORIGINAL);
  const [revisedText, setRevisedText] = useState<string>(SAMPLE_REVISED);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [copiedDiff, setCopiedDiff] = useState<boolean>(false);

  const [options, setOptions] = useState<DiffOptions>({
    ignoreCase: false,
    ignoreWhitespace: false,
    ignoreBlankLines: false,
  });

  const diffSummary = useMemo(() => {
    return computeTextDiff(originalText, revisedText, options);
  }, [originalText, revisedText, options]);

  const handleSwap = () => {
    const temp = originalText;
    setOriginalText(revisedText);
    setRevisedText(temp);
  };

  const handleClear = () => {
    setOriginalText('');
    setRevisedText('');
  };

  const handleCopyMarkdownDiff = () => {
    const md = formatToMarkdownDiff(diffSummary);
    navigator.clipboard.writeText(md);
    setCopiedDiff(true);
    setTimeout(() => setCopiedDiff(false), 2000);
  };

  return (
    <ToolShell
      toolId="text-diff"
      title="Text & Code Diff Checker"
      description="Compare two texts, documents, or code snippets side-by-side with word-level highlight precision, similarity percentage, and unified diff exports."
      category="developer"
      relatedToolIds={['text-cleaner', 'json-formatter', 'word-counter']}
    >
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  viewMode === 'split'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                Split View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('unified')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  viewMode === 'unified'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                Unified View
              </button>
            </div>

            {/* Options Checkboxes */}
            <div className="flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.ignoreWhitespace}
                  onChange={(e) =>
                    setOptions({ ...options, ignoreWhitespace: e.target.checked })
                  }
                />
                <span>Ignore Whitespace</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.ignoreCase}
                  onChange={(e) => setOptions({ ...options, ignoreCase: e.target.checked })}
                />
                <span>Ignore Case</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSwap}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Swap</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMarkdownDiff}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs inline-flex items-center gap-1.5"
            >
              {copiedDiff ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDiff ? 'Copied' : 'Copy Markdown Diff'}</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg"
              title="Clear all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Input Textareas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Original */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-700 dark:text-neutral-300">
                Original Version
              </span>
              <span className="text-neutral-400 font-mono text-[11px]">
                {originalText.split('\n').length} lines
              </span>
            </div>
            <textarea
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              placeholder="Paste original text here..."
              rows={8}
              className="w-full p-3 font-mono text-xs border rounded-xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Revised */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-700 dark:text-neutral-300">
                Revised Version
              </span>
              <span className="text-neutral-400 font-mono text-[11px]">
                {revisedText.split('\n').length} lines
              </span>
            </div>
            <textarea
              value={revisedText}
              onChange={(e) => setRevisedText(e.target.value)}
              placeholder="Paste revised text here..."
              rows={8}
              className="w-full p-3 font-mono text-xs border rounded-xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>

        {/* Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block">Similarity</span>
            <span className="text-base font-bold text-blue-600 dark:text-blue-400">
              {diffSummary.similarityScore}%
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Added Lines</span>
            <span className="text-base font-bold text-emerald-600 font-mono">
              +{diffSummary.addedCount}
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center">
            <span className="text-[10px] uppercase font-bold text-rose-600 block">Removed Lines</span>
            <span className="text-base font-bold text-rose-600 font-mono">
              -{diffSummary.removedCount}
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center">
            <span className="text-[10px] uppercase font-bold text-amber-600 block">Modified</span>
            <span className="text-base font-bold text-amber-600 font-mono">
              ~{diffSummary.modifiedCount}
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block">Unchanged</span>
            <span className="text-base font-bold text-neutral-600 dark:text-neutral-400 font-mono">
              {diffSummary.unchangedCount}
            </span>
          </div>
        </div>

        {/* Diff Render Canvas */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-2xs">
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <GitCompare className="w-4 h-4 text-blue-600" />
              <span>Visual Difference Comparison</span>
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              {diffSummary.lines.length} total diff segments
            </span>
          </div>

          {viewMode === 'split' ? (
            /* Split View Table */
            <div className="overflow-x-auto font-mono text-xs">
              <table className="w-full border-collapse">
                <tbody>
                  {diffSummary.lines.map((line, idx) => {
                    const isAdded = line.type === 'added';
                    const isRemoved = line.type === 'removed';
                    const isModified = line.type === 'modified';

                    return (
                      <tr key={idx} className="border-b border-neutral-100 dark:border-neutral-800/40">
                        {/* Original Side */}
                        <td
                          className={`w-10 py-1 px-2 text-right text-[10px] select-none ${
                            isRemoved || isModified
                              ? 'bg-rose-100/60 dark:bg-rose-950/60 text-rose-600'
                              : 'bg-neutral-50 dark:bg-neutral-800/40 text-neutral-400'
                          }`}
                        >
                          {line.originalLineNum || ''}
                        </td>
                        <td
                          className={`w-1/2 py-1 px-3 break-all whitespace-pre-wrap ${
                            isRemoved
                              ? 'bg-rose-50/70 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200'
                              : isModified
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 text-neutral-800 dark:text-neutral-200'
                              : isAdded
                              ? 'bg-neutral-50/50 dark:bg-neutral-900/50 text-transparent'
                              : 'text-neutral-800 dark:text-neutral-200'
                          }`}
                        >
                          {line.originalText || ''}
                        </td>

                        {/* Revised Side */}
                        <td
                          className={`w-10 py-1 px-2 text-right text-[10px] select-none border-l border-neutral-200 dark:border-neutral-800 ${
                            isAdded || isModified
                              ? 'bg-emerald-100/60 dark:bg-emerald-950/60 text-emerald-600'
                              : 'bg-neutral-50 dark:bg-neutral-800/40 text-neutral-400'
                          }`}
                        >
                          {line.revisedLineNum || ''}
                        </td>
                        <td
                          className={`w-1/2 py-1 px-3 break-all whitespace-pre-wrap ${
                            isAdded
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                              : isModified
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 text-neutral-800 dark:text-neutral-200'
                              : isRemoved
                              ? 'bg-neutral-50/50 dark:bg-neutral-900/50 text-transparent'
                              : 'text-neutral-800 dark:text-neutral-200'
                          }`}
                        >
                          {line.wordTokens ? (
                            line.wordTokens.map((t, i) => (
                              <span
                                key={i}
                                className={
                                  t.added
                                    ? 'bg-emerald-200 dark:bg-emerald-800/80 text-emerald-950 dark:text-emerald-100 px-0.5 rounded'
                                    : ''
                                }
                              >
                                {t.text}
                              </span>
                            ))
                          ) : (
                            line.revisedText || ''
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Unified View */
            <div className="overflow-x-auto font-mono text-xs divide-y divide-neutral-100 dark:divide-neutral-800/40">
              {diffSummary.lines.map((line, idx) => {
                if (line.type === 'added') {
                  return (
                    <div
                      key={idx}
                      className="p-1 px-3 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 flex items-start gap-3"
                    >
                      <span className="text-emerald-600 select-none font-bold">+</span>
                      <span className="text-[10px] text-neutral-400 w-8 select-none">
                        {line.revisedLineNum}
                      </span>
                      <span className="flex-1 whitespace-pre-wrap break-all">{line.revisedText}</span>
                    </div>
                  );
                }
                if (line.type === 'removed') {
                  return (
                    <div
                      key={idx}
                      className="p-1 px-3 bg-rose-50/80 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 flex items-start gap-3"
                    >
                      <span className="text-rose-600 select-none font-bold">-</span>
                      <span className="text-[10px] text-neutral-400 w-8 select-none">
                        {line.originalLineNum}
                      </span>
                      <span className="flex-1 whitespace-pre-wrap break-all">{line.originalText}</span>
                    </div>
                  );
                }
                if (line.type === 'modified') {
                  return (
                    <React.Fragment key={idx}>
                      <div className="p-1 px-3 bg-rose-50/80 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 flex items-start gap-3">
                        <span className="text-rose-600 select-none font-bold">-</span>
                        <span className="text-[10px] text-neutral-400 w-8 select-none">
                          {line.originalLineNum}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap break-all">{line.originalText}</span>
                      </div>
                      <div className="p-1 px-3 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 flex items-start gap-3">
                        <span className="text-emerald-600 select-none font-bold">+</span>
                        <span className="text-[10px] text-neutral-400 w-8 select-none">
                          {line.revisedLineNum}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap break-all">
                          {line.wordTokens ? (
                            line.wordTokens.map((t, i) => (
                              <span
                                key={i}
                                className={
                                  t.added
                                    ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-950 dark:text-emerald-100 px-0.5 rounded'
                                    : ''
                                }
                              >
                                {t.text}
                              </span>
                            ))
                          ) : (
                            line.revisedText
                          )}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                }
                return (
                  <div
                    key={idx}
                    className="p-1 px-3 text-neutral-700 dark:text-neutral-300 flex items-start gap-3"
                  >
                    <span className="text-neutral-400 select-none">&nbsp;</span>
                    <span className="text-[10px] text-neutral-400 w-8 select-none">
                      {line.originalLineNum}
                    </span>
                    <span className="flex-1 whitespace-pre-wrap break-all">{line.originalText}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ToolShell>
  );
};

export default TextDiffCheckerTool;
