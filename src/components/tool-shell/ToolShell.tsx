import React, { useState } from 'react';
import { ArrowLeft, Star, ShieldCheck, Share2, Sparkles } from 'lucide-react';
import type { ToolCategory } from '../../types';
import { toggleFavorite, getStoredPreferences } from '../../storage/preferences';
import { setPendingTransfer } from '../../storage/transfer';
import { TOOLS_REGISTRY } from '../../registry/tools';

interface ToolShellProps {
  toolId: string;
  title: string;
  description: string;
  category: ToolCategory;
  relatedToolIds?: string[];
  outputToTransfer?: string;
  children: React.ReactNode;
}

const CATEGORY_COLORS: Record<ToolCategory, { bg: string; text: string; border: string }> = {
  text: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  developer: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
  math: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  time: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  design: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  everyday: { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  image: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
  media: { bg: 'bg-pink-50 dark:bg-pink-950/40', text: 'text-pink-700 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
  productivity: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800' },
  files: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
};

export const ToolShell: React.FC<ToolShellProps> = ({
  toolId,
  title,
  description,
  category,
  relatedToolIds = [],
  outputToTransfer,
  children,
}) => {
  const [isFavorite, setIsFavorite] = useState(() => {
    const prefs = getStoredPreferences();
    return prefs.favorites.includes(toolId);
  });
  const [showTransferMenu, setShowTransferMenu] = useState(false);

  const handleToggleFavorite = () => {
    const updated = toggleFavorite(toolId);
    setIsFavorite(updated.includes(toolId));
  };

  const compatibleTransferTools = TOOLS_REGISTRY.filter(
    (t) => t.id !== toolId && t.acceptsTextTransfer
  );

  const handleSendTo = (targetToolId: string) => {
    if (!outputToTransfer) return;
    setPendingTransfer(targetToolId, outputToTransfer);
    setShowTransferMenu(false);
    window.location.hash = `#/tool/${targetToolId}`;
  };

  const relatedTools = TOOLS_REGISTRY.filter((t) => relatedToolIds.includes(t.id));
  const catStyle = CATEGORY_COLORS[category];

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <a
          id="back-to-tools-btn"
          href="#/"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All tools</span>
        </a>

        <div className="flex items-center gap-2">
          {/* Privacy badge */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Local processing only</span>
          </div>

          {/* Send output to... dropdown */}
          {outputToTransfer && outputToTransfer.trim().length > 0 && compatibleTransferTools.length > 0 && (
            <div className="relative">
              <button
                id="send-output-menu-btn"
                type="button"
                onClick={() => setShowTransferMenu(!showTransferMenu)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 transition-colors"
                title="Transfer output to another tool"
              >
                <Share2 className="w-3.5 h-3.5 text-neutral-500" />
                <span>Send output to…</span>
              </button>

              {showTransferMenu && (
                <div
                  id="transfer-menu-popup"
                  className="absolute right-0 mt-1 w-56 rounded-md shadow-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-1 z-30"
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
                    Compatible Tools
                  </div>
                  {compatibleTransferTools.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSendTo(t.id)}
                      className="w-full text-left px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between"
                    >
                      <span>{t.name}</span>
                      <span className="text-[10px] text-neutral-400">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Favorite Toggle Button */}
          <button
            id={`favorite-btn-${toolId}`}
            type="button"
            onClick={handleToggleFavorite}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium border transition-colors ${
              isFavorite
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:text-neutral-900 dark:hover:text-white'
            }`}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-500 text-amber-500' : 'text-neutral-400'}`} />
            <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>
        </div>
      </div>

      {/* Tool Header Details */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {title}
          </h1>
          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
            {category}
          </span>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-3xl">
          {description}
        </p>
      </div>

      {/* Main Tool Content Container */}
      <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 sm:p-6 shadow-xs">
        {children}
      </div>

      {/* Related Tools Footer */}
      {relatedTools.length > 0 && (
        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
            <span>Related Tools</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {relatedTools.map((t) => (
              <a
                key={t.id}
                href={`#/tool/${t.id}`}
                className="group p-3 rounded-md bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700 transition-colors"
              >
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {t.name}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                  {t.description}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
