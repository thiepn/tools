import type { ComponentType, LazyExoticComponent } from 'react';

export type ToolCategory = 'text' | 'developer' | 'math' | 'time' | 'design' | 'everyday' | 'image' | 'media' | 'productivity' | 'files';

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