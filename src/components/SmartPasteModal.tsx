import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  Clipboard,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { detectSmartPasteSuggestions } from '../utilities/smart-paste';
import { readFromClipboard } from '../utilities/clipboard';
import { setPendingTransfer } from '../storage/transfer';
import type { SmartPasteSuggestion } from '../types';

interface SmartPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SmartPasteModal: React.FC<SmartPasteModalProps> = ({ isOpen, onClose }) => {
  const [pastedText, setPastedText] = useState('');
  const [clipboardError, setClipboardError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPastedText('');
      setClipboardError(null);
      // Attempt to auto-read clipboard if permission allows
      readFromClipboard().then((text) => {
        if (text && text.trim()) {
          setPastedText(text);
        }
      });
    }
  }, [isOpen]);

  const suggestions: SmartPasteSuggestion[] = useMemo(() => {
    if (!pastedText.trim()) return [];
    return detectSmartPasteSuggestions(pastedText);
  }, [pastedText]);

  if (!isOpen) return null;

  const handlePasteFromClipboardButton = async () => {
    setClipboardError(null);
    const text = await readFromClipboard();
    if (text && text.trim()) {
      setPastedText(text);
    } else {
      setClipboardError('Clipboard access was blocked or clipboard is empty. Please paste into the box manually.');
    }
  };

  const handleSelectSuggestion = (sug: SmartPasteSuggestion) => {
    const textToSend = sug.initialValue !== undefined ? sug.initialValue : pastedText;
    setPendingTransfer(sug.toolId, textToSend);
    onClose();
    window.location.hash = `#/tool/${sug.toolId}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="smart-paste-title"
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 id="smart-paste-title" className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Smart Paste Inspector
              </h2>
              <p className="text-xs text-neutral-500">
                Paste any text or snippet to automatically detect matching tools
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="smart-paste-textarea" className="font-semibold text-neutral-700 dark:text-neutral-300">
                Inspect Content
              </label>
              <button
                type="button"
                onClick={handlePasteFromClipboardButton}
                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
              >
                <Clipboard className="w-3.5 h-3.5" />
                Read from Clipboard
              </button>
            </div>
            <textarea
              id="smart-paste-textarea"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste JSON, URLs, colors (#fff), lists, regex, or uncleaned text here..."
              rows={4}
              className="w-full p-2.5 font-mono text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
            {clipboardError && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">{clipboardError}</p>
            )}
          </div>

          {/* Suggestions list */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Matching Utilities ({suggestions.length})</span>
            </div>

            {suggestions.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-400 italic bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
                {pastedText.trim()
                  ? 'No specific format pattern detected. You can still open any text tool.'
                  : 'Paste or type text above to see smart tool routing.'}
              </div>
            ) : (
              <div className="space-y-2">
                {suggestions.map((sug) => (
                  <button
                    key={`${sug.toolId}-${sug.actionTitle}`}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    className="w-full p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 hover:bg-blue-50 dark:bg-neutral-950 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-800 text-left transition-all group flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {sug.actionTitle}
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {sug.description}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-400 group-hover:text-blue-600 group-hover:border-blue-300 shrink-0">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartPasteModal;
