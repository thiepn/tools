import React, { useState, useMemo } from 'react';
import { Copy, Check, Trash2, Type } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { convertAllCases, type CaseType } from '../../utilities/case-converter';
import { copyToClipboard } from '../../utilities/clipboard';

interface CaseConverterToolProps {
  initialText?: string;
}

const EXAMPLE_CASE_TEXT = 'userProfileSettings_v2-beta';

export const CaseConverterTool: React.FC<CaseConverterToolProps> = ({ initialText = '' }) => {
  const [input, setInput] = useState(initialText || '');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [selectedOutput, setSelectedOutput] = useState<string>('');

  const conversions = useMemo(() => {
    return convertAllCases(input);
  }, [input]);

  const handleCopy = async (type: CaseType, text: string) => {
    if (!text) return;
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedType(type);
      setSelectedOutput(text);
      setTimeout(() => setCopiedType(null), 1800);
    }
  };

  return (
    <ToolShell
      toolId="case-converter"
      title="Case Converter"
      description="Convert text between camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, and more."
      category="text"
      relatedToolIds={['text-cleaner', 'word-counter', 'list-processor']}
      outputToTransfer={selectedOutput || (conversions[0]?.result ?? '')}
    >
      <div className="space-y-6">
        {/* Input Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="case-converter-input" className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5" />
              Source Text
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInput(EXAMPLE_CASE_TEXT)}
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
            </div>
          </div>

          <textarea
            id="case-converter-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or paste text to convert across all cases..."
            rows={3}
            className="w-full p-3 font-mono text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            spellCheck={false}
          />
        </div>

        {/* Conversion Cards Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 pb-1 border-b border-neutral-200 dark:border-neutral-800">
            <span>Converted Outputs ({conversions.length} formats)</span>
            <span>Click card or button to copy</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {conversions.map((conv) => {
              const isCopied = copiedType === conv.type;
              return (
                <div
                  key={conv.type}
                  onClick={() => handleCopy(conv.type, conv.result)}
                  className={`group relative p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    isCopied
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700'
                      : 'bg-neutral-50/70 dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-100/80 dark:hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      {conv.type}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(conv.type, conv.result);
                      }}
                      disabled={!conv.result}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                        isCopied
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 group-hover:border-neutral-400'
                      }`}
                      aria-label={`Copy ${conv.type} result`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-neutral-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="font-mono text-sm text-neutral-900 dark:text-neutral-100 break-all select-all min-h-[1.5rem]">
                    {conv.result || (
                      <span className="text-neutral-400 text-xs italic font-sans">
                        (e.g., {conv.example})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default CaseConverterTool;
