import { describe, it, expect } from 'vitest';
import { TOOLS_REGISTRY, CATEGORIES, getToolById, searchTools } from '../registry/tools';
import { registerPdfPublicTools } from '../registry/pdf-extension';

registerPdfPublicTools();

const EXPECTED_TOOL_COUNT = 70;

describe('Tools Registry Verification', () => {
  it(`contains exactly ${EXPECTED_TOOL_COUNT} public tool routes after P1`, () => {
    expect(TOOLS_REGISTRY.length).toBe(EXPECTED_TOOL_COUNT);
  });

  it('has unique IDs with no duplicates', () => {
    const ids = TOOLS_REGISTRY.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(EXPECTED_TOOL_COUNT);
  });

  it('has unique routes with no duplicates', () => {
    const routes = TOOLS_REGISTRY.map((t) => t.route);
    const uniqueRoutes = new Set(routes);
    expect(uniqueRoutes.size).toBe(EXPECTED_TOOL_COUNT);
  });

  it('ensures all tools belong to a registered category', () => {
    const validCategoryIds = new Set(CATEGORIES.map((c) => c.id));
    for (const tool of TOOLS_REGISTRY) {
      expect(validCategoryIds.has(tool.category)).toBe(true);
    }
  });

  it('ensures all tools have required metadata', () => {
    for (const tool of TOOLS_REGISTRY) {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.shortName).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.keywords.length).toBeGreaterThan(0);
      expect(tool.iconName).toBeTruthy();
      expect(typeof tool.component).toBe('object');
    }
  });

  it('finds every registered tool using getToolById', () => {
    for (const tool of TOOLS_REGISTRY) {
      const found = getToolById(tool.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(tool.id);
    }
  });

  it('verifies established and new public search intents', () => {
    expect(searchTools('diff').some((t) => t.id === 'text-diff')).toBe(true);
    expect(searchTools('passport').some((t) => t.id === 'id-photo-maker')).toBe(true);
    expect(searchTools('video').some((t) => t.id === 'video-toolkit')).toBe(true);
    expect(searchTools('barcode').some((t) => t.id === 'barcode-studio')).toBe(true);
    expect(searchTools('metronome').some((t) => t.id === 'metronome')).toBe(true);
    expect(searchTools('merge pdf').some((t) => t.id === 'merge-pdf')).toBe(true);
    expect(searchTools('pdf to text').some((t) => t.id === 'export-pdf')).toBe(true);
    expect(searchTools('jpg to pdf').some((t) => t.id === 'scan-to-pdf')).toBe(true);
  });
});
