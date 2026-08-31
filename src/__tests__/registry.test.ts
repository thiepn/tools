import { describe, it, expect } from 'vitest';
import { TOOLS_REGISTRY, CATEGORIES, getToolById, searchTools } from '../registry/tools';
import { registerPdfPublicTools } from '../registry/pdf-extension';
import { registerDeviceDiagnosticTools } from '../registry/device-extension';
import { registerCalculatorTools } from '../registry/calculator-extension';
import { registerFileConversionTools } from '../registry/file-conversion-extension';

registerPdfPublicTools();
registerDeviceDiagnosticTools();
registerCalculatorTools();
registerFileConversionTools();

const EXPECTED_TOOL_COUNT = 150;

describe('Tools Registry Verification', () => {
  it(`contains exactly ${EXPECTED_TOOL_COUNT} public tool routes after P4`, () => {
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
    expect(searchTools('microphone test')[0]?.id).toBe('microphone-test');
    expect(searchTools('mortgage calculator')[0]?.id).toBe('mortgage-calculator');
    expect(searchTools('csv to excel')[0]?.id).toBe('csv-to-xlsx');
    expect(searchTools('excel to json')[0]?.id).toBe('xlsx-to-json');
    expect(searchTools('xml to csv')[0]?.id).toBe('xml-to-csv');
    expect(searchTools('split csv')[0]?.id).toBe('csv-splitter');
    expect(searchTools('zip to tar')[0]?.id).toBe('archive-converter');
    expect(searchTools('what file type')[0]?.id).toBe('file-type-inspector');
  });
});
