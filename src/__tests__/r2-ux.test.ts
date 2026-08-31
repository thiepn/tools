import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CATEGORIES, TOOLS_REGISTRY } from '../registry/tools';
import { registerPdfPublicTools } from '../registry/pdf-extension';
import { registerDeviceDiagnosticTools } from '../registry/device-extension';
import { searchTools } from '../registry/search';
import {
  CATEGORY_ORDER,
  getCategoryPresentation,
} from '../registry/category-presentation';
import {
  getStoredPreferences,
  recordRecentTool,
  toggleFavorite,
} from '../storage/preferences';

registerPdfPublicTools();
registerDeviceDiagnosticTools();

describe('R2 catalog information architecture', () => {
  it('covers every registered category exactly once in the discovery order', () => {
    const registered = CATEGORIES.map((category) => category.id);
    expect(CATEGORY_ORDER).toHaveLength(registered.length);
    expect(new Set(CATEGORY_ORDER).size).toBe(registered.length);
    for (const categoryId of registered) expect(CATEGORY_ORDER).toContain(categoryId);
  });

  it('keeps general-use discovery ahead of developer utilities', () => {
    expect(CATEGORY_ORDER[0]).toBe('productivity');
    expect(CATEGORY_ORDER[1]).toBe('pdf');
    expect(CATEGORY_ORDER.indexOf('device')).toBeLessThan(CATEGORY_ORDER.indexOf('developer'));
    expect(CATEGORY_ORDER.at(-1)).toBe('developer');
  });

  it('provides complete presentation metadata for every category', () => {
    for (const category of CATEGORIES) {
      const presentation = getCategoryPresentation(category.id);
      expect(presentation.label).toBeTruthy();
      expect(presentation.shortLabel).toBeTruthy();
      expect(presentation.description).toBeTruthy();
      expect(presentation.searchTerms.length).toBeGreaterThan(0);
      expect(presentation.badge.bg).toBeTruthy();
      expect(presentation.badge.text).toBeTruthy();
      expect(presentation.badge.border).toBeTruthy();
    }
  });
});

describe('R2 ranked tool discovery', () => {
  it('ranks an exact tool name ahead of partial matches', () => {
    expect(searchTools('unit converter')[0]?.id).toBe('unit-converter');
  });

  it('supports multi-word task searches instead of only phrase substrings', () => {
    expect(searchTools('resize image')[0]?.id).toBe('image-optimizer');
  });

  it('uses category vocabulary and everyday synonyms in discovery', () => {
    const photoResults = searchTools('photos');
    expect(photoResults.some((tool) => tool.category === 'image')).toBe(true);

    const officeResults = searchTools('office');
    expect(officeResults.some((tool) => tool.category === 'productivity')).toBe(true);

    const pdfResults = searchTools('pdf');
    expect(pdfResults.length).toBeGreaterThan(10);

    const diagnosticResults = searchTools('hardware diagnostics');
    expect(diagnosticResults.length).toBeGreaterThan(5);
    expect(diagnosticResults.every((tool) => tool.category === 'device')).toBe(true);
  });

  it('respects category filtering while preserving ranked matches', () => {
    const imageResults = searchTools('image', 'image');
    expect(imageResults.length).toBeGreaterThan(1);
    expect(imageResults.every((tool) => tool.category === 'image')).toBe(true);

    const pdfResults = searchTools('pdf', 'pdf');
    expect(pdfResults.length).toBe(20);
    expect(pdfResults.every((tool) => tool.category === 'pdf')).toBe(true);

    const deviceResults = searchTools('', 'device');
    expect(deviceResults.length).toBe(16);
    expect(deviceResults.every((tool) => tool.category === 'device')).toBe(true);
  });

  it('finds task-oriented queries across names, descriptions, and keywords', () => {
    expect(searchTools('scan document')[0]?.id).toBe('document-scanner');
    expect(searchTools('make qr code')[0]?.id).toBe('qr-studio');
    expect(searchTools('remove background')[0]?.id).toBe('background-remover');
    expect(searchTools('merge pdf')[0]?.id).toBe('merge-pdf');
    expect(searchTools('compress pdf')[0]?.id).toBe('compress-pdf');
    expect(searchTools('mouse polling rate')[0]?.id).toBe('polling-rate-test');
    expect(searchTools('guitar tuner')[0]?.id).toBe('instrument-tuner');
  });

  it('returns the unfiltered registry order for an empty query', () => {
    expect(searchTools('').map((tool) => tool.id)).toEqual(TOOLS_REGISTRY.map((tool) => tool.id));
  });
});

describe('R2 preference defaults and isolation', () => {
  const PREFERENCES_KEY = 'tiny_tools_preferences_v1';
  const originalWindow = globalThis.window;
  let storageStore: Record<string, string> = {};

  beforeEach(() => {
    storageStore = {};
    const mockStorage = {
      getItem: (key: string) => storageStore[key] || null,
      setItem: (key: string, value: string) => { storageStore[key] = value; },
      removeItem: (key: string) => { delete storageStore[key]; },
      clear: () => { storageStore = {}; },
      length: 0,
      key: () => null,
    };
    (globalThis as unknown as { window: unknown }).window = { localStorage: mockStorage };
  });

  afterEach(() => {
    storageStore = {};
    (globalThis as unknown as { window: Window }).window = originalWindow;
  });

  it('uses general-purpose favorites for a fresh install', () => {
    expect(getStoredPreferences().favorites).toEqual(['text-cleaner', 'image-optimizer', 'qr-studio']);
  });

  it('returns fresh default arrays instead of a shared mutable singleton', () => {
    const first = getStoredPreferences();
    first.favorites.push('mutated-only-in-memory');
    expect(getStoredPreferences().favorites).not.toContain('mutated-only-in-memory');
  });

  it('keeps favorite and recent writes scoped to preference metadata only', () => {
    toggleFavorite('word-counter');
    recordRecentTool('word-counter');
    const persisted = JSON.parse(storageStore[PREFERENCES_KEY]);
    expect(persisted.favorites).toContain('word-counter');
    expect(persisted.recents).toEqual(['word-counter']);
  });
});
