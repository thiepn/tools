import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';
import { TOOLS_REGISTRY, searchTools } from '../registry/tools';
import type { ToolDefinition } from '../types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (toolId: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectTool,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const results = useMemo(() => {
    return searchTools(query);
  }, [query]);

  // Save previous focus and autofocus on open
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setSelectedIndex(0);
      // Small timeout to ensure modal is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    } else {
      // Restore focus
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen]);

  // Keep selected index in bounds when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeItem = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Handle Keyboard Navigation inside Command Palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length > 0 ? (prev - 1 + results.length) % results.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // Focus trapping: keep focus on input or close
      e.preventDefault();
    }
  };

  const handleSelect = (tool: ToolDefinition) => {
    onSelectTool(tool.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Input */}
        <div className="relative p-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-neutral-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            id="command-palette-title"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a tool name, task, or keyword (e.g. 'json', 'clean', 'age')..."
            className="w-full bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-500">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="p-2 overflow-y-auto max-h-96 space-y-1">
          {results.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400 italic">
              No matching tools found for &quot;{query}&quot;.
            </div>
          ) : (
            results.map((tool, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={tool.id}
                  data-index={idx}
                  onClick={() => handleSelect(tool)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full p-2.5 rounded-lg text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-transparent text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate">{tool.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wider ${
                          isSelected
                            ? 'bg-blue-700 text-blue-100'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        {tool.category}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] truncate ${
                        isSelected ? 'text-blue-100' : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {tool.description}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-[11px] font-mono text-blue-100">
                        <span>Open</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="p-2.5 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded font-mono text-[10px]">
                ↑
              </kbd>
              <kbd className="px-1 py-0.2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded font-mono text-[10px]">
                ↓
              </kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded font-mono text-[10px]">
                ↵
              </kbd>
              <span>to select</span>
            </span>
          </div>

          <span className="font-mono text-[10px]">
            {results.length} of {TOOLS_REGISTRY.length} tools
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPaletteModal;
