import React, { useEffect, useState } from 'react';
import {
  Wrench,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
  Search,
  Sparkles,
} from 'lucide-react';
import type { ThemeMode } from '../types';
import { getStoredPreferences, updateThemePreference } from '../storage/preferences';

interface HeaderProps {
  onOpenSearch?: () => void;
  onOpenSmartPaste?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch, onOpenSmartPaste }) => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const prefs = getStoredPreferences();
    return prefs.theme;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  const handleThemeToggle = () => {
    const nextTheme: ThemeMode = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
    updateThemePreference(nextTheme);
  };

  return (
    <header className="sticky top-0 z-20 w-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Brand & Home Link */}
        <a
          id="brand-home-link"
          href="#/"
          className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
        >
          <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900 shadow-xs group-hover:scale-105 transition-transform">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 tracking-tight leading-none">
              <span>Tiny Tools</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono font-medium border border-neutral-200 dark:border-neutral-700">
                v1.0
              </span>
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-tight hidden sm:block">
              Privacy-first local utilities
            </div>
          </div>
        </a>

        {/* Center/Right Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Smart Paste Quick Action */}
          {onOpenSmartPaste && (
            <button
              type="button"
              onClick={onOpenSmartPaste}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors"
              title="Detect clipboard content and route to matching tool"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden md:inline">Smart Paste</span>
            </button>
          )}

          {/* Quick Search Shortcut Trigger */}
          {onOpenSearch && (
            <button
              id="header-search-trigger"
              type="button"
              onClick={onOpenSearch}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search tools...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-400">
                /
              </kbd>
            </button>
          )}

          {/* Privacy badge */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% In-Browser</span>
          </div>

          {/* Theme switcher */}
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={handleThemeToggle}
            className="p-2 rounded-md text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 transition-colors"
            title={`Current theme: ${theme}. Click to cycle.`}
            aria-label="Toggle visual color theme"
          >
            {theme === 'light' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : theme === 'dark' ? (
              <Moon className="w-4 h-4 text-indigo-400" />
            ) : (
              <Monitor className="w-4 h-4 text-neutral-500" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
