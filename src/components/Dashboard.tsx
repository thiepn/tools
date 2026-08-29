import React, { useMemo, useState } from 'react';
import {
  Search,
  Star,
  Clock,
  Sparkles,
  Type,
  FileText,
  ListOrdered,
  Code2,
  Regex,
  Globe,
  Pipette,
  Percent,
  CalendarDays,
  Ruler,
  Ratio,
  KeyRound,
  Scale,
  Tag,
  Timer,
  QrCode,
  Image as ImageIcon,
  Pencil,
  LayoutGrid,
  Scissors,
  ScanText,
  Video,
  Mic,
  Volume2,
  Dice5,
  Utensils,
  CheckSquare,
  ArrowRight,
  ShieldCheck,
  Zap,
  X,
  GitCompare,
  Layers,
  FolderArchive,
  ShieldAlert,
  Film,
  Barcode,
  Stamp,
  PenTool,
  Presentation,
  Monitor,
  Palette,
  CalendarPlus,
  Music,
  Files,
  Smile,
} from 'lucide-react';
import { TOOLS_REGISTRY } from '../registry/tools';
import { searchTools } from '../registry/search';
import {
  CATEGORY_ORDER,
  getCategoryPresentation,
} from '../registry/category-presentation';
import type { ToolCategory, ToolDefinition } from '../types';
import { getStoredPreferences, toggleFavorite } from '../storage/preferences';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Type,
  FileText,
  ListOrdered,
  Code2,
  Regex,
  Globe,
  Pipette,
  Percent,
  CalendarDays,
  Ruler,
  Ratio,
  KeyRound,
  Scale,
  Tag,
  Clock,
  Timer,
  QrCode,
  Image: ImageIcon,
  Pencil,
  LayoutGrid,
  Scissors,
  ScanText,
  Video,
  Mic,
  Volume2,
  Dice5,
  Utensils,
  CheckSquare,
  GitCompare,
  Layers,
  FolderArchive,
  ShieldAlert,
  Film,
  Barcode,
  Stamp,
  PenTool,
  Presentation,
  Monitor,
  Palette,
  CalendarPlus,
  Music,
  Files,
  Smile,
};

interface DashboardProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSmartPaste: () => void;
}

interface ToolCardProps {
  tool: ToolDefinition;
  isFavorite: boolean;
  onToggleFavorite: (event: React.MouseEvent, toolId: string) => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, isFavorite, onToggleFavorite }) => {
  const IconComp = ICON_MAP[tool.iconName] || Zap;
  const category = getCategoryPresentation(tool.category);

  return (
    <article className="group p-4 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-400 dark:hover:border-blue-700 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between">
      <div className="flex items-start gap-3">
        <a
          href={`#/tool/${tool.id}`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="p-2.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 group-hover:bg-blue-50 dark:group-hover:bg-blue-950 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0">
            <IconComp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {tool.name}
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
              {tool.description}
            </p>
          </div>
        </a>

        <button
          type="button"
          onClick={(event) => onToggleFavorite(event, tool.id)}
          className={`p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0 ${
            isFavorite
              ? 'text-amber-500'
              : 'text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-300'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-label={isFavorite ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`}
          aria-pressed={isFavorite}
        >
          <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-500' : ''}`} />
        </button>
      </div>

      <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-3">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${category.badge.bg} ${category.badge.text} ${category.badge.border}`}
        >
          {category.shortLabel}
        </span>

        <a
          href={`#/tool/${tool.id}`}
          className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span>Open tool</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </article>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({
  searchQuery,
  onSearchChange,
  onOpenSmartPaste,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>('all');
  const [favorites, setFavorites] = useState<string[]>(() => getStoredPreferences().favorites);
  const [recents] = useState<string[]>(() => getStoredPreferences().recents);

  const cleanSearchQuery = searchQuery.trim();

  const filteredTools = useMemo(
    () => searchTools(searchQuery, selectedCategory),
    [searchQuery, selectedCategory]
  );

  const favoriteTools = useMemo(
    () =>
      favorites
        .map((id) => TOOLS_REGISTRY.find((tool) => tool.id === id))
        .filter((tool): tool is ToolDefinition => tool !== undefined),
    [favorites]
  );

  const recentTools = useMemo(
    () =>
      recents
        .map((id) => TOOLS_REGISTRY.find((tool) => tool.id === id))
        .filter((tool): tool is ToolDefinition => tool !== undefined)
        .slice(0, 6),
    [recents]
  );

  const handleToggleFavorite = (event: React.MouseEvent, toolId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setFavorites(toggleFavorite(toolId));
  };

  const showGroupedCatalog = selectedCategory === 'all' && !cleanSearchQuery;
  const selectedCategoryPresentation =
    selectedCategory === 'all' ? null : getCategoryPresentation(selectedCategory);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <section className="space-y-5" aria-labelledby="dashboard-title">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1
              id="dashboard-title"
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100"
            >
              Small tools. Zero friction.
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1.5 max-w-2xl leading-relaxed">
              50 browser utilities for text, images, files, media, time, and everyday tasks.
              Your content is processed locally; advanced tools may download static runtime or
              model assets when needed.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenSmartPaste}
            className="self-start inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white shadow-xs transition-transform active:scale-95"
          >
            <Zap className="w-4 h-4 text-amber-400 dark:text-amber-500" />
            <span>Smart Paste</span>
          </button>
        </div>

        <div className="relative max-w-3xl">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="dashboard-search-input"
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search a task: resize image, convert units, scan a document, make a QR code…"
            className="w-full pl-10 pr-10 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
            aria-label="Search all Tiny Tools"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-r-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Clear search"
              aria-label="Clear tool search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs" aria-label="Tool categories">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            aria-pressed={selectedCategory === 'all'}
            className={`px-3 py-1.5 rounded-md font-medium border transition-colors whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900 dark:border-neutral-100'
                : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            All ({TOOLS_REGISTRY.length})
          </button>

          {CATEGORY_ORDER.map((categoryId) => {
            const category = getCategoryPresentation(categoryId);
            const count = TOOLS_REGISTRY.filter((tool) => tool.category === categoryId).length;
            const isSelected = selectedCategory === categoryId;

            return (
              <button
                key={categoryId}
                type="button"
                onClick={() => setSelectedCategory(categoryId)}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 rounded-md font-medium border transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900 dark:border-neutral-100'
                    : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {category.shortLabel} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {(favoriteTools.length > 0 || recentTools.length > 0) &&
        !cleanSearchQuery &&
        selectedCategory === 'all' && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-labelledby="quick-access-heading">
            <h2 id="quick-access-heading" className="sr-only">
              Quick access
            </h2>

            {favoriteTools.length > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/70 bg-amber-50/40 dark:bg-amber-950/20 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-3">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  <span>Favorites</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {favoriteTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="inline-flex items-center rounded-md bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-800 overflow-hidden"
                    >
                      <a
                        href={`#/tool/${tool.id}`}
                        className="px-2.5 py-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        {tool.shortName}
                      </a>
                      <button
                        type="button"
                        onClick={(event) => handleToggleFavorite(event, tool.id)}
                        className="px-2 py-1.5 border-l border-amber-200 dark:border-amber-800 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        aria-label={`Remove ${tool.name} from favorites`}
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentTools.length > 0 && (
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/70 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                  <Clock className="w-4 h-4" />
                  <span>Recently used</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentTools.map((tool) => {
                    const IconComp = ICON_MAP[tool.iconName] || Zap;
                    return (
                      <a
                        key={tool.id}
                        href={`#/tool/${tool.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-blue-300 dark:hover:border-blue-800 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <IconComp className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{tool.shortName}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

      {showGroupedCatalog ? (
        <div className="space-y-9">
          {CATEGORY_ORDER.map((categoryId) => {
            const category = getCategoryPresentation(categoryId);
            const tools = TOOLS_REGISTRY.filter((tool) => tool.category === categoryId);
            if (tools.length === 0) return null;

            return (
              <section key={categoryId} aria-labelledby={`category-${categoryId}`}>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
                  <div>
                    <h2
                      id={`category-${categoryId}`}
                      className="text-sm font-bold text-neutral-900 dark:text-neutral-100"
                    >
                      {category.label}
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {category.description}
                    </p>
                  </div>
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">
                    {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tools.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      isFavorite={favorites.includes(tool.id)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section aria-labelledby="filtered-tools-heading" className="space-y-4">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2">
            <h2
              id="filtered-tools-heading"
              className="text-sm font-bold text-neutral-900 dark:text-neutral-100"
            >
              {cleanSearchQuery
                ? `Search results for “${cleanSearchQuery}”`
                : selectedCategoryPresentation?.label}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {cleanSearchQuery
                ? `${filteredTools.length} matching ${filteredTools.length === 1 ? 'tool' : 'tools'}${
                    selectedCategoryPresentation
                      ? ` in ${selectedCategoryPresentation.label}`
                      : ''
                  }.`
                : selectedCategoryPresentation?.description}
            </p>
          </div>

          {filteredTools.length === 0 ? (
            <div className="p-10 text-center bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                No tools match your current search and category.
              </p>
              <p className="text-xs text-neutral-500">
                Try a task such as “resize image”, “convert units”, “timer”, or “scan document”.
              </p>
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  setSelectedCategory('all');
                }}
                className="mt-3 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  isFavorite={favorites.includes(tool.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <aside className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong>Local processing:</strong> Tiny Tools does not upload your files or inputs to an
            application backend. Some advanced tools fetch static runtime or model files when first
            used.
          </span>
        </div>
        <div className="text-[11px] text-neutral-400 whitespace-nowrap">
          Static · no account · no telemetry
        </div>
      </aside>
    </div>
  );
};

export default Dashboard;
