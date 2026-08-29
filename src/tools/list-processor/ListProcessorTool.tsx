import React, { useState } from 'react';
import {
  Copy,
  Check,
  Trash2,
  ListFilter,
  ArrowDownAZ,
  ArrowUpAZ,
  Shuffle,
  Undo,
  Download,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  parseListItems,
  trimItems,
  removeEmptyItems,
  removeDuplicateItems,
  sortAZ,
  sortZA,
  naturalSort,
  numericSort,
  reverseItems,
  shuffleItems,
  addLineNumbers,
  removeLineNumbers,
  addPrefixSuffix,
} from '../../utilities/list-processor';
import { copyToClipboard } from '../../utilities/clipboard';

interface ListProcessorToolProps {
  initialText?: string;
}

const SAMPLE_LIST = `3. Banana
10. Apple
1. Orange
2. Grape
10. Apple
100. Watermelon
non-numeric item
4. Mango`;

export const ListProcessorTool: React.FC<ListProcessorToolProps> = ({ initialText = '' }) => {
  const [text, setText] = useState(initialText || '');
  const [history, setHistory] = useState<string[]>([]);
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [numberingFormat, setNumberingFormat] = useState<string>('1. ');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [copied, setCopied] = useState(false);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);
  const [nonNumericWarning, setNonNumericWarning] = useState<number | null>(null);

  const applyChange = (newItems: string[], actionName: string, extraMsg?: string) => {
    setHistory((prev) => [...prev.slice(-10), text]);
    const newText = newItems.join('\n');
    setText(newText);
    setLastActionMessage(extraMsg ? `${actionName}: ${extraMsg}` : actionName);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setText(previous);
    setLastActionMessage('Undone last operation');
    setNonNumericWarning(null);
  };

  const items = parseListItems(text);
  const nonBlankItemsCount = items.filter((i) => i.trim().length > 0).length;

  const handleTrim = () => {
    applyChange(trimItems(items), 'Trimmed whitespace from all items');
  };

  const handleRemoveEmpty = () => {
    const before = items.length;
    const after = removeEmptyItems(items);
    applyChange(after, 'Removed empty lines', `${before - after.length} empty items removed`);
  };

  const handleDeduplicate = () => {
    const { items: deduped, duplicatesRemoved } = removeDuplicateItems(items, caseSensitive);
    applyChange(deduped, 'Removed duplicates', `${duplicatesRemoved} duplicates removed`);
  };

  const handleSortAZ = () => {
    applyChange(sortAZ(items), 'Sorted A → Z');
  };

  const handleSortZA = () => {
    applyChange(sortZA(items), 'Sorted Z → A');
  };

  const handleNaturalSort = () => {
    applyChange(naturalSort(items), 'Natural alphanumeric sort');
  };

  const handleNumericSort = (asc: boolean) => {
    const { items: sorted, nonNumericCount } = numericSort(items, asc);
    if (nonNumericCount > 0) {
      setNonNumericWarning(nonNumericCount);
    } else {
      setNonNumericWarning(null);
    }
    applyChange(
      sorted,
      `Numeric sort (${asc ? 'Ascending' : 'Descending'})`,
      nonNumericCount > 0 ? `${nonNumericCount} non-numeric lines placed at end` : undefined
    );
  };

  const handleReverse = () => {
    applyChange(reverseItems(items), 'Reversed order');
  };

  const handleShuffle = () => {
    applyChange(shuffleItems(items), 'Randomly shuffled items');
  };

  const handleAddNumbers = () => {
    applyChange(addLineNumbers(items, numberingFormat), `Added line numbers (${numberingFormat})`);
  };

  const handleRemoveNumbers = () => {
    applyChange(removeLineNumbers(items), 'Stripped existing line numbers');
  };

  const handleAddPrefixSuffix = () => {
    if (!prefix && !suffix) return;
    applyChange(addPrefixSuffix(items, prefix, suffix), 'Added prefix/suffix');
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `processed-list-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ToolShell
      toolId="list-processor"
      title="List Processor"
      description="Sort, deduplicate, prefix, suffix, shuffle, number, and clean line-delimited lists."
      category="text"
      relatedToolIds={['text-cleaner', 'case-converter', 'word-counter']}
      outputToTransfer={text}
    >
      <div className="space-y-6">
        {/* Operations Control Panel */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <ListFilter className="w-3.5 h-3.5 text-neutral-500" />
              List Operations
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length === 0}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors ${
                  history.length > 0
                    ? 'bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100'
                    : 'text-neutral-400 border-neutral-200 dark:border-neutral-800 cursor-not-allowed'
                }`}
              >
                <Undo className="w-3 h-3" />
                <span>Undo</span>
                {history.length > 0 && <span className="text-[10px] text-neutral-400">({history.length})</span>}
              </button>
            </div>
          </div>

          {/* Quick Action Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
            {/* Deduplication */}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={handleDeduplicate}
                disabled={!text}
                className="w-full py-1.5 px-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium text-left transition-colors"
              >
                Remove duplicates
              </button>
              <label className="flex items-center gap-1 text-[11px] text-neutral-500 px-1 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                  className="rounded border-neutral-300 text-blue-600"
                />
                <span>Case-sensitive</span>
              </label>
            </div>

            {/* Sorting */}
            <button
              type="button"
              onClick={handleSortAZ}
              disabled={!text}
              className="py-1.5 px-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium flex items-center justify-between transition-colors"
            >
              <span>Sort A → Z</span>
              <ArrowDownAZ className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            <button
              type="button"
              onClick={handleSortZA}
              disabled={!text}
              className="py-1.5 px-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium flex items-center justify-between transition-colors"
            >
              <span>Sort Z → A</span>
              <ArrowUpAZ className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            <button
              type="button"
              onClick={handleNaturalSort}
              disabled={!text}
              className="py-1.5 px-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium text-left transition-colors"
              title="Sort natural alphanumerics (e.g., item 2 before item 10)"
            >
              Natural sort (1, 2, 10)
            </button>

            <button
              type="button"
              onClick={() => handleNumericSort(true)}
              disabled={!text}
              className="py-1.5 px-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium text-left transition-colors"
            >
              Numeric sort (0 → 9)
            </button>

            <button
              type="button"
              onClick={() => handleNumericSort(false)}
              disabled={!text}
              className="py-1.5 px-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium text-left transition-colors"
            >
              Numeric sort (9 → 0)
            </button>

            <button
              type="button"
              onClick={handleReverse}
              disabled={!text}
              className="py-1.5 px-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium text-left transition-colors"
            >
              Reverse list
            </button>

            <button
              type="button"
              onClick={handleShuffle}
              disabled={!text}
              className="py-1.5 px-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium flex items-center justify-between transition-colors"
            >
              <span>Shuffle items</span>
              <Shuffle className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            <button
              type="button"
              onClick={handleTrim}
              disabled={!text}
              className="py-1.5 px-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium text-left transition-colors"
            >
              Trim item spaces
            </button>

            <button
              type="button"
              onClick={handleRemoveEmpty}
              disabled={!text}
              className="py-1.5 px-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium text-left transition-colors"
            >
              Remove blank lines
            </button>

            <button
              type="button"
              onClick={handleRemoveNumbers}
              disabled={!text}
              className="py-1.5 px-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium text-left transition-colors"
            >
              Strip line numbers
            </button>
          </div>

          {/* Numbering & Prefix/Suffix sub-controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800 text-xs">
            {/* Numbering */}
            <div className="flex items-center gap-2">
              <span className="font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                Add numbering:
              </span>
              <select
                value={numberingFormat}
                onChange={(e) => setNumberingFormat(e.target.value)}
                className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1"
              >
                <option value="1. ">1. Item</option>
                <option value="1) ">1) Item</option>
                <option value="[1] ">[1] Item</option>
                <option value="1 - ">1 - Item</option>
                <option value="01. ">01. Item</option>
              </select>
              <button
                type="button"
                onClick={handleAddNumbers}
                disabled={!text}
                className="px-2.5 py-1 rounded bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 font-medium hover:opacity-90 transition-opacity"
              >
                Apply
              </button>
            </div>

            {/* Prefix / Suffix */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="Prefix (e.g. - )"
                className="w-1/3 px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
              />
              <input
                type="text"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="Suffix (e.g. ,)"
                className="w-1/3 px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
              />
              <button
                type="button"
                onClick={handleAddPrefixSuffix}
                disabled={!text || (!prefix && !suffix)}
                className="px-2.5 py-1 rounded bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Wrap
              </button>
            </div>
          </div>
        </div>

        {/* Warning notification banner if numeric sort had non-numeric entries */}
        {nonNumericWarning !== null && nonNumericWarning > 0 && (
          <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {nonNumericWarning} line{nonNumericWarning > 1 ? 's' : ''} did not contain numeric values and {nonNumericWarning > 1 ? 'were' : 'was'} placed at the end of the list.
            </span>
          </div>
        )}

        {/* Editor Area */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                List Items ({items.length} total, {nonBlankItemsCount} non-empty)
              </span>
              {lastActionMessage && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  {lastActionMessage}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setText(SAMPLE_LIST)}
                className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
              >
                Load example
              </button>

              {text.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setHistory((prev) => [...prev.slice(-10), text]);
                    setText('');
                  }}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={handleDownload}
                disabled={!text}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 text-xs transition-colors"
                title="Download as .txt"
              >
                <Download className="w-3 h-3" />
                <span>Save .txt</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                disabled={!text}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium border transition-colors ${
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
                    <span>Copy list</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <textarea
            id="list-processor-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter one list item per line..."
            rows={12}
            className="w-full p-3 font-mono text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-y"
            spellCheck={false}
          />
        </div>
      </div>
    </ToolShell>
  );
};

export default ListProcessorTool;
