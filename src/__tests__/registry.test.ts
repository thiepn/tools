import { describe, it, expect } from 'vitest';
import { TOOLS_REGISTRY, CATEGORIES, getToolById, searchTools } from '../registry/tools';

describe('Tools Registry Verification (All 50 Tools)', () => {
  it('contains exactly 50 tools in TOOLS_REGISTRY', () => {
    expect(TOOLS_REGISTRY.length).toBe(50);
  });

  it('has 50 unique IDs with no duplicates', () => {
    const ids = TOOLS_REGISTRY.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(50);
  });

  it('has 50 unique routes with no duplicates', () => {
    const routes = TOOLS_REGISTRY.map((t) => t.route);
    const uniqueRoutes = new Set(routes);
    expect(uniqueRoutes.size).toBe(50);
  });

  it('ensures all tools belong to a registered category', () => {
    const validCategoryIds = new Set(CATEGORIES.map((c) => c.id));
    for (const tool of TOOLS_REGISTRY) {
      expect(validCategoryIds.has(tool.category)).toBe(true);
    }
  });

  it('ensures all tools have required metadata (name, shortName, description, keywords, iconName, component)', () => {
    for (const tool of TOOLS_REGISTRY) {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.shortName).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.keywords.length).toBeGreaterThan(0);
      expect(tool.iconName).toBeTruthy();
      expect(typeof tool.component).toBe('object'); // React.lazy returns an object
    }
  });

  it('finds tools using getToolById for all 50 tools', () => {
    for (const tool of TOOLS_REGISTRY) {
      const found = getToolById(tool.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(tool.id);
    }
  });

  it('verifies search functionality returns matching tools', () => {
    const diffMatches = searchTools('diff');
    expect(diffMatches.some((t) => t.id === 'text-diff')).toBe(true);

    const passportMatches = searchTools('passport');
    expect(passportMatches.some((t) => t.id === 'id-photo-maker')).toBe(true);

    const videoMatches = searchTools('video');
    expect(videoMatches.some((t) => t.id === 'video-toolkit')).toBe(true);

    const barcodeMatches = searchTools('barcode');
    expect(barcodeMatches.some((t) => t.id === 'barcode-studio')).toBe(true);

    const metronomeMatches = searchTools('metronome');
    expect(metronomeMatches.some((t) => t.id === 'metronome')).toBe(true);
  });
});
