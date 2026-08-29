import type { ComponentType, LazyExoticComponent } from 'react';

export type ToolCategory = 'text' | 'developer' | 'math' | 'time' | 'design' | 'everyday' | 'image' | 'media' | 'productivity' | 'files';

export type ToolShellMode = 'self' | 'app';

export interface ToolDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: ToolCategory;
  keywords: string[];
  iconName: string;
  route: string;
  featured: boolean;
  acceptsTextTransfer: boolean;
  producesTextTransfer: boolean;
  /**
   * Most tools render ToolShell themselves. A small set of legacy/bare tools
   * are wrapped by App so every route receives the same navigation, favorite,
   * category, and accessibility chrome without rewriting the tool algorithm.
   */
  shellMode?: ToolShellMode;
  relatedToolIds?: string[];
  component: LazyExoticComponent<ComponentType<{ initialText?: string }>>;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserPreferences {
  version: number;
  theme: ThemeMode;
  favorites: string[];
  recents: string[];
}

export interface SmartPasteSuggestion {
  toolId: string;
  toolName: string;
  actionTitle: string;
  description: string;
  initialValue?: string;
}