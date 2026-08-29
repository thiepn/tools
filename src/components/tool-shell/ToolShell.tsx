import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Share2, ShieldCheck, Sparkles, Star } from 'lucide-react';
import type { ToolCategory } from '../../types';
import { getStoredPreferences, toggleFavorite } from '../../storage/preferences';
import { setPendingTransfer } from '../../storage/transfer';
import { TOOLS_REGISTRY } from '../../registry/tools';
import { getCategoryPresentation } from '../../registry/category-presentation';

interface ToolShellProps {
  toolId: string;
  title: string;
  description: string;
  category: ToolCategory;
  relatedToolIds?: string[];
  outputToTransfer?: string;
  children: React.ReactNode;
}

export const ToolShell: React.FC<ToolShellProps> = ({
  toolId,
  title,
  description,
  category,
  relatedToolIds = [],
  outputToTransfer,
  children,
}) => {
  const [isFavorite, setIsFavorite] = useState(
    () => getStoredPreferences().favorites.includes(toolId)
  );
  const [showTransferMenu, setShowTransferMenu] = useState(false);
  const transferMenuRef = useRef<HTMLDivElement>(null);
  const transferButtonRef = useRef<HTMLButtonElement>(null);

  const categoryPresentation = getCategoryPresentation(category);
  const titleId = `tool-title-${toolId}`;
  const descriptionId = `tool-description-${toolId}`;

  const handleToggleFavorite = () => {
    const updated = toggleFavorite(toolId);
    setIsFavorite(updated.includes(toolId));
  };

  const compatibleTransferTools = TOOLS_REGISTRY.filter(
    (tool) => tool.id !== toolId && tool.acceptsTextTransfer
  );

  const handleSendTo = (targetToolId: string) => {
    if (!outputToTransfer) return;
    setPendingTransfer(targetToolId, outputToTransfer);
    setShowTransferMenu(false);
    window.location.hash = `#/tool/${targetToolId}`;
  };

  useEffect(() => {
    if (!showTransferMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !transferMenuRef.current?.contains(target) &&
        !transferButtonRef.current?.contains(target)
      ) {
        setShowTransferMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowTransferMenu(false);
        transferButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showTransferMenu]);

  const relatedTools = TOOLS_REGISTRY.filter((tool) => relatedToolIds.includes(tool.id));

  return (
    <section
      className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6"
      data-tool-id={toolId}
      data-tool-category={category}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <a
          id="back-to-tools-btn"
          href="#/"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>All tools</span>
        </a>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Processes locally</span>
          </div>

          {outputToTransfer && outputToTransfer.trim().length > 0 && compatibleTransferTools.length > 0 && (
            <div className="relative">
              <button
                ref={transferButtonRef}
                id="send-output-menu-btn"
                type="button"
                onClick={() => setShowTransferMenu((open) => !open)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Transfer this output to another compatible tool"
                aria-expanded={showTransferMenu}
                aria-controls="transfer-menu-popup"
                aria-haspopup="menu"
              >
                <Share2 className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
                <span>Send output to…</span>
              </button>

              {showTransferMenu && (
                <div
                  ref={transferMenuRef}
                  id="transfer-menu-popup"
                  role="menu"
                  aria-label="Compatible tools"
                  className="absolute right-0 mt-1 w-[min(16rem,calc(100vw-1.5rem))] max-h-72 overflow-y-auto rounded-md shadow-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-1 z-30"
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
                    Compatible tools
                  </div>
                  {compatibleTransferTools.map((tool) => {
                    const targetCategory = getCategoryPresentation(tool.category);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        role="menuitem"
                        onClick={() => handleSendTo(tool.id)}
                        className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                      >
                        <span className="truncate">{tool.name}</span>
                        <span className="text-[10px] text-neutral-400 shrink-0">
                          {targetCategory.shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button
            id={`favorite-btn-${toolId}`}
            type="button"
            onClick={handleToggleFavorite}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isFavorite
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:text-neutral-900 dark:hover:text-white'
            }`}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isFavorite}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isFavorite ? 'fill-amber-500 text-amber-500' : 'text-neutral-400'
              }`}
              aria-hidden="true"
            />
            <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>
        </div>
      </div>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <h1
            id={titleId}
            className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
          >
            {title}
          </h1>
          <span
            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider border ${categoryPresentation.badge.bg} ${categoryPresentation.badge.text} ${categoryPresentation.badge.border}`}
          >
            {categoryPresentation.shortLabel}
          </span>
        </div>
        <p
          id={descriptionId}
          className="text-sm text-neutral-600 dark:text-neutral-400 max-w-3xl"
        >
          {description}
        </p>
      </header>

      <div className="tt-tool-content w-full min-w-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 sm:p-6 shadow-xs">
        {children}
      </div>

      {relatedTools.length > 0 && (
        <aside className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800" aria-label="Related tools">
          <h2 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
            <span>Related tools</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {relatedTools.map((tool) => {
              const relatedCategory = getCategoryPresentation(tool.category);
              return (
                <a
                  key={tool.id}
                  href={`#/tool/${tool.id}`}
                  className="group p-3 rounded-md bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {tool.name}
                    </div>
                    <span className="text-[10px] text-neutral-400 shrink-0">
                      {relatedCategory.shortLabel}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5">
                    {tool.description}
                  </div>
                </a>
              );
            })}
          </div>
        </aside>
      )}
    </section>
  );
};