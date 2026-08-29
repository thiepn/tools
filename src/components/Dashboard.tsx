import React, { useState, useMemo } from 'react';
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
import { TOOLS_REGISTRY, CATEGORIES, searchTools } from '../registry/tools';
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

const CATEGORY_TAG_COLORS: Record<ToolCategory, { bg: string; text: string; border: string }> = {
  text: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  developer: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
  math: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  time: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  design: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  everyday: { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
  image: { bg: 'bg-pink-50 dark:bg-pink-950/40', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
  media: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
  productivity: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
  files: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
};

interface DashboardProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSmartPaste: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  searchQuery,
  onSearchChange,
  onOpenSmartPaste,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>('all');
  const [favorites, setFavorites] = useState<string[]>(() => getStoredPreferences().favorites);
  const [recents] = useState<string[]>(() => getStoredPreferences().recents);

  const filteredTools = useMemo(() => {
    return searchTools(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  const favoriteTools = useMemo(() => {
    return favorites
      .map((id) => TOOLS_REGISTRY.find((t) => t.id === id))
      .filter((t): t is ToolDefinition => t !== undefined);
  }, [favorites]);

  const recentTools = useMemo(() => {
    return recents
      .map((id) => TOOLS_REGISTRY.find((t) => t.id === id))
      .filter((t): t is ToolDefinition => t !== undefined)
      .slice(0, 4);
  }, [recents]);

  const handleToggleFav = (e: React.MouseEvent, toolId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = toggleFavorite(toolId);
    setFavorites(updated);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Hero & Quick Search */}
      <div className="space-y-4 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
              Fast, Private Web Utilities
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl">
              50 lightweight browser tools for text, development, math, dates, design, media, files, and productivity. Zero server calls, no telemetry, and private in-memory transfer.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenSmartPaste}
            className="self-center sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white shadow-xs transition-transform active:scale-95"
          >
            <Zap className="w-4 h-4 text-amber-400 dark:text-amber-500" />
            <span>Smart Paste Clipboard</span>
          </button>
        </div>

        {/* Global Search Input Box */}
        <div className="relative max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="dashboard-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, category, or task (e.g. 'json', 'strip tags', 'contrast', 'diff')..."
            className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
            autoFocus={false}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-md font-medium border transition-colors whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            All Tools ({TOOLS_REGISTRY.length})
          </button>

          {CATEGORIES.map((cat) => {
            const count = TOOLS_REGISTRY.filter((t) => t.category === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-md font-medium border transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                    : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Favorites Section (if any and not searching) */}
      {!searchQuery && selectedCategory === 'all' && favoriteTools.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>Favorite Tools</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {favoriteTools.map((tool) => {
              const IconComp = ICON_MAP[tool.iconName] || Zap;
              const catStyle = CATEGORY_TAG_COLORS[tool.category];
              return (
                <a
                  key={tool.id}
                  href={`#/tool/${tool.id}`}
                  className="group relative p-3.5 rounded-lg bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 hover:border-amber-400 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleToggleFav(e, tool.id)}
                        className="text-amber-500 hover:text-neutral-400 p-1"
                        title="Remove from favorites"
                      >
                        <Star className="w-4 h-4 fill-amber-500" />
                      </button>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {tool.name}
                      </div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-0.5">
                        {tool.description}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 mt-2 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between text-[11px]">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${catStyle.text}`}>
                      {tool.category}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Open <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Recents Section (if any and not searching) */}
      {!searchQuery && selectedCategory === 'all' && recentTools.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Recently Used</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {recentTools.map((t) => {
              const IconComp = ICON_MAP[t.iconName] || Zap;
              return (
                <a
                  key={t.id}
                  href={`#/tool/${t.id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200 transition-colors"
                >
                  <IconComp className="w-3.5 h-3.5 text-neutral-500" />
                  <span>{t.name}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Tools Catalog Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            {selectedCategory === 'all' ? 'All Utilities' : `${selectedCategory.toUpperCase()} Utilities`} ({filteredTools.length})
          </h2>
        </div>

        {filteredTools.length === 0 ? (
          <div className="p-12 text-center bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              No matching tools found for "{searchQuery}"
            </p>
            <p className="text-xs text-neutral-500">
              Try searching for general terms like "text", "case", "json", "date", or "unit".
            </p>
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                setSelectedCategory('all');
              }}
              className="mt-3 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map((tool) => {
              const IconComp = ICON_MAP[tool.iconName] || Zap;
              const catStyle = CATEGORY_TAG_COLORS[tool.category];
              const isFav = favorites.includes(tool.id);

              return (
                <a
                  key={tool.id}
                  id={`tool-card-${tool.id}`}
                  href={`#/tool/${tool.id}`}
                  className="group p-4 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 group-hover:bg-blue-50 dark:group-hover:bg-blue-950 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        <IconComp className="w-5 h-5" />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleToggleFav(e, tool.id)}
                        className={`p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                          isFav ? 'text-amber-500' : 'text-neutral-300 dark:text-neutral-600 hover:text-neutral-500'
                        }`}
                        title={isFav ? 'Remove favorite' : 'Add to favorites'}
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-amber-500' : ''}`} />
                      </button>
                    </div>

                    <div>
                      <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {tool.name}
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                      {tool.category}
                    </span>

                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 inline-flex items-center gap-1">
                      <span>Open tool</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info & Privacy Guarantee */}
      <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            <strong>Client-Side Only:</strong> Your inputs never leave your device. Zero analytics, zero cookies, zero external API keys.
          </span>
        </div>
        <div className="text-[11px] text-neutral-400">
          Statically deployable on GitHub Pages
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
