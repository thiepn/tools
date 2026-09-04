import { describe, expect, it } from 'vitest';
import { registerAllPublicTools } from '../registry/register-all';
import { TOOLS_REGISTRY } from '../registry/tools';
import { STIER_B_TARGET_COUNT, STIER_B_TARGET_IDS } from '../s-tier-b/manifest';
import {
  buildWorkbenchCsv,
  diffWorkbenchSnapshots,
  isSensitiveWorkbenchField,
  numericScenarios,
  parseBatchCases,
  parseWorkbenchSnapshot,
  textDiagnostics,
  type WorkbenchSnapshot,
} from '../utilities/s-tier-b-workbench';

registerAllPublicTools();

const snapshot = (name: string, values: Array<[string, string]>, output: string): WorkbenchSnapshot => ({
  version: 1,
  toolId: 'basic-calculator',
  name,
  createdAt: '2026-09-04T00:00:00.000Z',
  fields: values.map(([key, value]) => ({ key, label: key, kind: 'number', value })),
  output,
});

describe('R12 S-tier uplift for the explicit former B-tier catalog', () => {
  it('binds exactly 154 unique routes from the explicit ranking list', () => {
    expect(STIER_B_TARGET_COUNT).toBe(154);
    expect(new Set(STIER_B_TARGET_IDS).size).toBe(154);
  });

  it('keeps every targeted route registered and marks the real expert-workspace capability', () => {
    for (const id of STIER_B_TARGET_IDS) {
      const tool = TOOLS_REGISTRY.find((candidate) => candidate.id === id);
      expect(tool, id).toBeTruthy();
      expect(tool?.keywords, id).toContain('expert workspace');
      expect(tool?.keywords, id).toContain('batch runner');
      expect(tool?.keywords, id).toContain('sensitivity analysis');
      expect(tool?.description, id).toMatch(/expert workspace/i);
      expect(tool?.component, id).toBeTruthy();
    }
  });

  it('does not change the certified 351-route public catalog size', () => {
    expect(TOOLS_REGISTRY).toHaveLength(351);
  });

  it('diffs reproducible scenarios at both field and visible-output level', () => {
    const before = snapshot('Before', [['price', '100'], ['rate', '5']], 'Total 105\nStatus baseline');
    const after = snapshot('After', [['price', '120'], ['rate', '5']], 'Total 126\nStatus changed');
    const diff = diffWorkbenchSnapshots(before, after);
    expect(diff.changedFields).toEqual([{ key: 'price', label: 'price', before: '100', after: '120' }]);
    expect(diff.addedOutputLines).toContain('Total 126');
    expect(diff.removedOutputLines).toContain('Total 105');
    expect(diff.outputChanged).toBe(true);
  });

  it('parses bounded batch cases including multiline separators', () => {
    expect(parseBatchCases('alpha\nbeta\ngamma')).toEqual(['alpha', 'beta', 'gamma']);
    expect(parseBatchCases('first line\nsecond line\n---\nnext case')).toEqual(['first line\nsecond line', 'next case']);
    expect(parseBatchCases(Array.from({ length: 60 }, (_, i) => `case-${i}`).join('\n'))).toHaveLength(30);
  });

  it('creates symmetric numeric sensitivity scenarios', () => {
    const rows = numericScenarios(200, [-10, 10]);
    expect(rows.map((row) => row.value)).toEqual([180, 220]);
    expect(rows.map((row) => row.label)).toEqual(['-10%', '+10%']);
  });

  it('provides Unicode-aware text diagnostics suitable for text/developer routes', () => {
    const stats = textDiagnostics('Hello 👨‍👩‍👧‍👦\nhello 42');
    expect(stats.lines).toBe(2);
    expect(stats.words).toBe(4);
    expect(stats.uniqueWords).toBe(3);
    expect(stats.nonAsciiCharacters).toBeGreaterThan(0);
    expect(stats.utf8Bytes).toBeGreaterThan(stats.characters);
  });

  it('protects secrets from snapshot persistence and rejects cross-tool imports', () => {
    expect(isSensitiveWorkbenchField('TOTP secret', 'text')).toBe(true);
    expect(isSensitiveWorkbenchField('Password', 'password')).toBe(true);
    const raw = JSON.stringify({
      version: 1,
      toolId: 'basic-calculator',
      name: 'Safe',
      createdAt: '2026-09-04T00:00:00.000Z',
      fields: [{ key: 'secret', label: 'API key', kind: 'text', value: 'do-not-keep', sensitive: true }],
      output: 'ok',
    });
    expect(parseWorkbenchSnapshot(raw, 'basic-calculator').fields[0].value).toBe('');
    expect(() => parseWorkbenchSnapshot(raw, 'ratio-calculator')).toThrow(/belongs to/i);
  });

  it('exports batch results as valid quote-safe CSV', () => {
    const csv = buildWorkbenchCsv([{ input: 'a,b', output: 'line 1\nline 2' }, { input: 'plain', output: 'ok' }]);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"line 1\nline 2"');
  });
});
