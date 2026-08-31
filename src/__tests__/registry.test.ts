import { describe, it, expect } from 'vitest';
import { TOOLS_REGISTRY, CATEGORIES, getToolById, searchTools } from '../registry/tools';
import { registerPdfPublicTools } from '../registry/pdf-extension';
import { registerDeviceDiagnosticTools } from '../registry/device-extension';

registerPdfPublicTools();
registerDeviceDiagnosticTools();

const EXPECTED_TOOL_COUNT = 86;

describe('Tools Registry Verification', () => {
  it(`contains exactly ${EXPECTED_TOOL_COUNT} public tool routes after P2`, () => {
    expect(TOOLS_REGISTRY.length).toBe(EXPECTED_TOOL_COUNT);
  });

  it('has unique IDs with no duplicates', () => {
    const ids = TOOLS_REGISTRY.map((t) => t.id);
    expect(new Set(ids).size).toBe(EXPECTED_TOOL_COUNT);
  });

  it('has unique routes with no duplicates', () => {
    const routes = TOOLS_REGISTRY.map((t) => t.route);
    expect(new Set(routes).size).toBe(EXPECTED_TOOL_COUNT);
  });

  it('ensures all tools belong to a registered category', () => {
    const validCategoryIds = new Set(CATEGORIES.map((c) => c.id));
    for (const tool of TOOLS_REGISTRY) expect(validCategoryIds.has(tool.category)).toBe(true);
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
    for (const tool of TOOLS_REGISTRY) expect(getToolById(tool.id)?.id).toBe(tool.id);
  });

  it('verifies established and public-completeness search intents', () => {
    expect(searchTools('diff').some((t) => t.id === 'text-diff')).toBe(true);
    expect(searchTools('merge pdf').some((t) => t.id === 'merge-pdf')).toBe(true);
    expect(searchTools('pdf to text').some((t) => t.id === 'export-pdf')).toBe(true);
    expect(searchTools('jpg to pdf').some((t) => t.id === 'scan-to-pdf')).toBe(true);
    expect(searchTools('microphone test')[0]?.id).toBe('microphone-test');
    expect(searchTools('webcam test')[0]?.id).toBe('webcam-test');
    expect(searchTools('stick drift test')[0]?.id).toBe('gamepad-test');
    expect(searchTools('dead pixel test')[0]?.id).toBe('dead-pixel-test');
    expect(searchTools('keyboard ghosting test')[0]?.id).toBe('keyboard-ghosting-test');
  });
});
