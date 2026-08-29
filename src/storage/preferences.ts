import type { ThemeMode, UserPreferences } from '../types';

const PREFERENCES_KEY = 'tiny_tools_preferences_v1';

function createDefaultPreferences(): UserPreferences {
  return {
    version: 1,
    theme: 'system',
    favorites: ['text-cleaner', 'image-optimizer', 'qr-studio'],
    recents: [],
  };
}

export function getStoredPreferences(): UserPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultPreferences();
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return createDefaultPreferences();

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return createDefaultPreferences();
    }

    const defaults = createDefaultPreferences();

    return {
      version: 1,
      theme: ['light', 'dark', 'system'].includes(parsed.theme)
        ? parsed.theme
        : 'system',
      favorites: Array.isArray(parsed.favorites)
        ? parsed.favorites.filter((favorite: unknown) => typeof favorite === 'string')
        : defaults.favorites,
      recents: Array.isArray(parsed.recents)
        ? parsed.recents
            .filter((recent: unknown) => typeof recent === 'string')
            .slice(0, 6)
        : [],
    };
  } catch {
    return createDefaultPreferences();
  }
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // Gracefully handle storage quota or privacy mode errors.
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
  return [...prefs.favorites];
}

export function recordRecentTool(toolId: string): string[] {
  const prefs = getStoredPreferences();
  const updated = [toolId, ...prefs.recents.filter((id) => id !== toolId)].slice(0, 6);
  prefs.recents = updated;
  savePreferences(prefs);
  return [...updated];
}

export function setThemePreference(theme: ThemeMode): void {
  const prefs = getStoredPreferences();
  prefs.theme = theme;
  savePreferences(prefs);
}

export const updateThemePreference = setThemePreference;
