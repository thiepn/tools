import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CornerDownLeft, Search, X } from 'lucide-react';
import { TOOLS_REGISTRY } from '../registry/tools';
import { searchTools } from '../registry/search';
import { getCategoryPresentation } from '../registry/category-presentation';
import { getStoredPreferences } from '../storage/preferences';
import { getWrappedIndex } from '../utilities/navigation';
import type { ToolDefinition } from '../types';
import { ModalSurface } from './ModalSurface';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (toolId: string) => void;
}

function getQuickAccessTools(): ToolDefinition[] {
  const prefs = getStoredPreferences();
  const orderedIds = [
    ...prefs.recents,
    ...prefs.favorites,
    ...TOOLS_REGISTRY.filter((tool) => tool.featured).map((tool) => tool.id),
  ];

  const seen = new Set<string>();
  const tools: ToolDefinition[] = [];

  for (const id of orderedIds) {
    if (seen.has(id)) continue;
    const tool = TOOLS_REGISTRY.find((candidate) => candidate.id === id);
    if (!tool) continue;

    seen.add(id);
    tools.push(tool);
    if (tools.length >= 12) break;
  }

  return tools;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectTool,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => (query.trim() ? searchTools(query).slice(0, 20) : getQuickAccessTools()),
    [query, isOpen]
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current
      .querySelector(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = (tool: ToolDefinition) => {
    onSelectTool(tool.id);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((previous) => getWrappedIndex(previous, 1, results.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((previous) => getWrappedIndex(previous, -1, results.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[selectedIndex];
      if (selected) handleSelect(selected);
    }
  };

  const selectedResult = results[selectedIndex];

  return (
    <ModalSurface
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="command-palette-title"
      overlayClassName="flex items-start justify-center pt-16 sm:pt-24 px-4"
      className="w-full max-w-xl bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[75vh] focus:outline-none"
    >
      <h2 id="command-palette-title" className="sr-only">
        Search Tiny Tools
      </h2>

      <div className="relative p-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
        <Search className="w-4 h-4 text-neutral-400 shrink-0 ml-1" aria-hidden="true" />
        <input
          data-autofocus="true"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search a tool or task…"
          className="w-full bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-label="Search Tiny Tools"
          aria-expanded="true"
          aria-controls="command-palette-results"
          aria-autocomplete="list"
          aria-activedescendant={
            selectedResult ? `command-palette-option-${selectedResult.id}` : undefined
          }
        />
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close tool search"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {query.trim() ? 'Search results' : 'Quick access'}
      </div>

      <div
        id="command-palette-results"
        ref={listRef}
        role="listbox"
        className="p-2 overflow-y-auto max-h-96 space-y-1"
      >
        {results.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-400" role="status">
            No matching tools found for “{query}”.
          </div>
        ) : (
          results.map((tool, index) => {
            const isSelected = index === selectedIndex;
            const category = getCategoryPresentation(tool.category);

            return (
              <button
                id={`command-palette-option-${tool.id}`}
                key={tool.id}
                data-index={index}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(tool)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full p-2.5 rounded-lg text-left transition-colors flex items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-transparent text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold truncate">{tool.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${
                        isSelected
                          ? 'bg-blue-700 text-blue-100'
                          : `${category.badge.bg} ${category.badge.text}`
                      }`}
                    >
                      {category.shortLabel}
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
              </button>
            );
          })
        )}
      </div>

      <div className="p-2.5 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded font-mono text-[10px]">↑</kbd>
            <kbd className="px-1 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded font-mono text-[10px]">↓</kbd>
            <span>navigate</span>
          </span>
          <span className="hidden sm:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded font-mono text-[10px]">↵</kbd>
            <span>open</span>
          </span>
        </div>

        <span className="font-mono text-[10px]">
          {query.trim()
            ? `${results.length} result${results.length === 1 ? '' : 's'}`
            : `${results.length} quick tools`}
        </span>
      </div>
    </ModalSurface>
  );
};

export default CommandPaletteModal;
