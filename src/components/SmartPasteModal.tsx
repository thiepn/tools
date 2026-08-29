import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clipboard, Sparkles, X, Zap } from 'lucide-react';
import { detectSmartPasteSuggestions } from '../utilities/smart-paste';
import { readFromClipboard } from '../utilities/clipboard';
import { setPendingTransfer } from '../storage/transfer';
import type { SmartPasteSuggestion } from '../types';
import { ModalSurface } from './ModalSurface';

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
    }
  }, [isOpen]);

  const suggestions: SmartPasteSuggestion[] = useMemo(() => {
    if (!pastedText.trim()) return [];
    return detectSmartPasteSuggestions(pastedText);
  }, [pastedText]);

  const handlePasteFromClipboardButton = async () => {
    setClipboardError(null);
    const text = await readFromClipboard();
    if (text && text.trim()) {
      setPastedText(text);
    } else {
      setClipboardError(
        'Clipboard access was blocked or the clipboard is empty. Paste into the box manually instead.'
      );
    }
  };

  const handleSelectSuggestion = (suggestion: SmartPasteSuggestion) => {
    const textToSend = suggestion.initialValue ?? pastedText;
    setPendingTransfer(suggestion.toolId, textToSend);
    onClose();
    window.location.hash = `#/tool/${suggestion.toolId}`;
  };

  return (
    <ModalSurface
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="smart-paste-title"
      describedBy="smart-paste-description"
      overlayClassName="flex items-center justify-center p-4"
      className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] focus:outline-none"
    >
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
            <Zap className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="smart-paste-title" className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Smart Paste
            </h2>
            <p id="smart-paste-description" className="text-xs text-neutral-500">
              Paste text to detect a few relevant Tiny Tools. Clipboard access only happens when you request it.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0"
          aria-label="Close Smart Paste"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
            <label htmlFor="smart-paste-textarea" className="font-semibold text-neutral-700 dark:text-neutral-300">
              Inspect content
            </label>
            <button
              type="button"
              onClick={handlePasteFromClipboardButton}
              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium self-start sm:self-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <Clipboard className="w-3.5 h-3.5" aria-hidden="true" />
              Read clipboard
            </button>
          </div>

          <textarea
            id="smart-paste-textarea"
            data-autofocus="true"
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            placeholder="Paste JSON, a URL, color value, list, dimensions, or unclean text…"
            rows={5}
            className="w-full p-2.5 font-mono text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />

          {clipboardError && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400" role="status">
              {clipboardError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Suggestions ({suggestions.length})</span>
          </div>

          {suggestions.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-400 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800" role="status">
              {pastedText.trim()
                ? 'No specific format pattern detected yet.'
                : 'Paste or type text above to see up to three tool suggestions.'}
            </div>
          ) : (
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.toolId}-${suggestion.actionTitle}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 hover:bg-blue-50 dark:bg-neutral-950 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-800 text-left transition-colors group flex items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {suggestion.actionTitle}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {suggestion.description}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-blue-600 shrink-0" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-md text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Close
        </button>
      </div>
    </ModalSurface>
  );
};

export default SmartPasteModal;
