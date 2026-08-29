import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Regex as RegexIcon,
  Replace,
  Clock,
  Layers,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { testRegex, type RegexFlags } from '../../utilities/regex-tester';
import { copyToClipboard } from '../../utilities/clipboard';

interface RegexTesterToolProps {
  initialText?: string;
}

const SAMPLE_PATTERN = '(?<protocol>https?)://(?<domain>[a-zA-Z0-9.-]+)(?<path>/[\\w.-]*)*';
const SAMPLE_TEXT = `Welcome to Tiny Tools!
Visit https://example.com/docs or http://api.service.org/v1/status for documentation.
Also check out https://github.com/repository-name.`;
const SAMPLE_REPLACEMENT = '[$<protocol>://$<domain>]';

export const RegexTesterTool: React.FC<RegexTesterToolProps> = ({ initialText = '' }) => {
  const [pattern, setPattern] = useState(SAMPLE_PATTERN);
  const [flags, setFlags] = useState<RegexFlags>({
    global: true,
    ignoreCase: true,
    multiline: true,
    dotAll: false,
    unicode: true,
    sticky: false,
  });
  const [text, setText] = useState(initialText || SAMPLE_TEXT);
  const [replacement, setReplacement] = useState(SAMPLE_REPLACEMENT);
  const [copied, setCopied] = useState(false);

  const testResult = useMemo(() => {
    return testRegex(pattern, flags, text, replacement);
  }, [pattern, flags, text, replacement]);

  const handleCopyReplacement = async () => {
    const success = await copyToClipboard(testResult.replacementPreview);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    setPattern('');
    setText('');
    setReplacement('');
  };

  return (
    <ToolShell
      toolId="regex-tester"
      title="Regex Tester & Debugger"
      description="Test regular expressions, inspect captured groups, test flags, and preview replacements in real time."
      category="developer"
      relatedToolIds={['json-formatter', 'encoding-tools', 'text-cleaner']}
      outputToTransfer={testResult.replacementPreview}
    >
      <div className="space-y-6">
        {/* Pattern & Flags Header */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="regex-pattern-input" className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <RegexIcon className="w-3.5 h-3.5" />
              Regular Expression Pattern
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPattern(SAMPLE_PATTERN);
                  setText(SAMPLE_TEXT);
                  setReplacement(SAMPLE_REPLACEMENT);
                }}
                className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
              >
                Load example
              </button>
              {(pattern || text) && (
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

          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 font-mono text-neutral-400 text-sm">/</span>
              <input
                id="regex-pattern-input"
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="Enter regex pattern (e.g. \b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)"
                className="w-full pl-6 pr-6 py-2 font-mono text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-neutral-900 dark:text-neutral-100"
                spellCheck={false}
              />
              <span className="absolute right-3 top-2.5 font-mono text-neutral-400 text-sm">/</span>
            </div>

            {/* Flags selectors */}
            <div className="flex items-center flex-wrap gap-1.5 p-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-xs">
              <label
                className={`px-2 py-1 rounded cursor-pointer select-none font-mono font-medium transition-colors ${
                  flags.global
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Global search (g)"
              >
                <input
                  type="checkbox"
                  checked={flags.global}
                  onChange={(e) => setFlags({ ...flags, global: e.target.checked })}
                  className="sr-only"
                />
                <span>g</span>
              </label>

              <label
                className={`px-2 py-1 rounded cursor-pointer select-none font-mono font-medium transition-colors ${
                  flags.ignoreCase
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Case-insensitive (i)"
              >
                <input
                  type="checkbox"
                  checked={flags.ignoreCase}
                  onChange={(e) => setFlags({ ...flags, ignoreCase: e.target.checked })}
                  className="sr-only"
                />
                <span>i</span>
              </label>

              <label
                className={`px-2 py-1 rounded cursor-pointer select-none font-mono font-medium transition-colors ${
                  flags.multiline
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Multiline (m)"
              >
                <input
                  type="checkbox"
                  checked={flags.multiline}
                  onChange={(e) => setFlags({ ...flags, multiline: e.target.checked })}
                  className="sr-only"
                />
                <span>m</span>
              </label>

              <label
                className={`px-2 py-1 rounded cursor-pointer select-none font-mono font-medium transition-colors ${
                  flags.dotAll
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Dot matches all including newlines (s)"
              >
                <input
                  type="checkbox"
                  checked={flags.dotAll}
                  onChange={(e) => setFlags({ ...flags, dotAll: e.target.checked })}
                  className="sr-only"
                />
                <span>s</span>
              </label>

              <label
                className={`px-2 py-1 rounded cursor-pointer select-none font-mono font-medium transition-colors ${
                  flags.unicode
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Unicode mode (u)"
              >
                <input
                  type="checkbox"
                  checked={flags.unicode}
                  onChange={(e) => setFlags({ ...flags, unicode: e.target.checked })}
                  className="sr-only"
                />
                <span>u</span>
              </label>

              <label
                className={`px-2 py-1 rounded cursor-pointer select-none font-mono font-medium transition-colors ${
                  flags.sticky
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Sticky matching (y)"
              >
                <input
                  type="checkbox"
                  checked={flags.sticky}
                  onChange={(e) => setFlags({ ...flags, sticky: e.target.checked })}
                  className="sr-only"
                />
                <span>y</span>
              </label>
            </div>
          </div>

          {/* Validation Banner */}
          {testResult.isValid ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  Valid pattern: {testResult.matchCount} match{testResult.matchCount !== 1 ? 'es' : ''} found
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-neutral-400" />
                  {testResult.executionTimeMs} ms
                </span>
                {testResult.isTruncated && (
                  <span className="text-amber-600 font-medium">(Matches capped at 2,500)</span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Invalid Regular Expression</div>
                <div className="font-mono text-[11px] mt-0.5">{testResult.error}</div>
              </div>
            </div>
          )}
        </div>

        {/* Test Text & Replacement Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Test Input Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <span>Test Subject Text</span>
              <span className="text-neutral-500 font-normal">{text.length} chars</span>
            </div>
            <textarea
              id="regex-test-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter or paste text to test regex against..."
              rows={8}
              className="w-full p-3 font-mono text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-y"
              spellCheck={false}
            />
          </div>

          {/* Replacement String & Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <span className="flex items-center gap-1.5">
                <Replace className="w-3.5 h-3.5" />
                Replacement Pattern
              </span>
              <button
                type="button"
                onClick={handleCopyReplacement}
                disabled={!testResult.replacementPreview}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium border transition-colors ${
                  copied
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800'
                }`}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy result'}</span>
              </button>
            </div>

            <input
              id="regex-replacement-input"
              type="text"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Replacement string (e.g. $1, $<name>, or replacement text)"
              className="w-full px-3 py-1.5 font-mono text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                Replacement Preview
              </span>
              <textarea
                value={testResult.replacementPreview}
                readOnly
                rows={5}
                className="w-full p-3 font-mono text-xs sm:text-sm bg-neutral-100/70 dark:bg-neutral-950/80 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none resize-y text-neutral-800 dark:text-neutral-200"
              />
            </div>
          </div>
        </div>

        {/* Captured Matches and Groups Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 pb-1 border-b border-neutral-200 dark:border-neutral-800">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-neutral-500" />
              Matches & Group Captures ({testResult.matches.length})
            </span>
          </div>

          {testResult.matches.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950/50 rounded-lg border border-neutral-200 dark:border-neutral-800">
              No matches found. Check your pattern or flags.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {testResult.matches.map((item, idx) => (
                <div
                  key={`${item.index}-${idx}`}
                  className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono text-[10px] font-bold">
                        Match #{idx + 1}
                      </span>
                      <span className="text-neutral-500 text-[11px]">
                        Indices: [{item.index} – {item.endIndex}] ({item.match.length} chars)
                      </span>
                    </div>
                  </div>

                  <div className="font-mono p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 break-all select-all">
                    {item.match}
                  </div>

                  {/* Captured groups */}
                  {(item.groups.length > 0 || item.namedGroups) && (
                    <div className="pt-1 space-y-1">
                      <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                        Captures:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {item.groups.map((grp, gIdx) => (
                          <div
                            key={gIdx}
                            className="flex items-start gap-2 p-1.5 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px]"
                          >
                            <span className="text-neutral-400 font-bold shrink-0">
                              ${gIdx + 1}:
                            </span>
                            <span className="text-neutral-800 dark:text-neutral-200 break-all">
                              {grp !== undefined ? grp : '<undefined>'}
                            </span>
                          </div>
                        ))}

                        {item.namedGroups &&
                          Object.entries(item.namedGroups).map(([name, val]) => (
                            <div
                              key={name}
                              className="flex items-start gap-2 p-1.5 rounded bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 font-mono text-[11px]"
                            >
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                                {name}:
                              </span>
                              <span className="text-neutral-800 dark:text-neutral-200 break-all">
                                {val !== undefined ? val : '<undefined>'}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ToolShell>
  );
};

export default RegexTesterTool;
