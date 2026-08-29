import type { ThemeMode, UserPreferences } from '../types';

const PREFERENCES_KEY = 'tiny_tools_preferences_v1';

const defaultPreferences: UserPreferences = {
  version: 1,
  theme: 'system',
  favorites: ['text-cleaner', 'json-formatter', 'percentage-calculator'],
  recents: [],
};

export function getStoredPreferences(): UserPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaultPreferences;
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return defaultPreferences;

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return defaultPreferences;
    }

    return {
      version: 1,
      theme: ['light', 'dark', 'system'].includes(parsed.theme) ? parsed.theme : 'system',
      favorites: Array.isArray(parsed.favorites)
        ? parsed.favorites.filter((f: unknown) => typeof f === 'string')
        : defaultPreferences.favorites,
      recents: Array.isArray(parsed.recents)
        ? parsed.recents.filter((r: unknown) => typeof r === 'string').slice(0, 6)
        : [],
    };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // Gracefully handle storage quota or privacy mode errors
  }
}

export function toggleFavorite(toolId: string): string[] {
  const prefs = getStoredPreferences();
  const index = prefs.favorites.indexOf(toolId);
  if (index === -1) {
    prefs.favorites.push(toolId);
  } else {
    prefs.favorites.splice(index, 1);
  }
  savePreferences(prefs);
  return prefs.favorites;
}

export function recordRecentTool(toolId: string): string[] {
  const prefs = getStoredPreferences();
  // Filter out duplicate and prepend
  const updated = [toolId, ...prefs.recents.filter((id) => id !== toolId)].slice(0, 6);
  prefs.recents = updated;
  savePreferences(prefs);
  return updated;
}

export function setThemePreference(theme: ThemeMode): void {
  const prefs = getStoredPreferences();
  prefs.theme = theme;
  savePreferences(prefs);
}

export const updateThemePreference = setThemePreference;

