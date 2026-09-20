import { describe, expect, it } from 'vitest';
import { registerAllPublicTools } from '../registry/register-all';
import { TOOLS_REGISTRY } from '../registry/tools';
import {
  analyzeInvisibleCharacters,
  cleanText,
  defaultCleanerOptions,
} from '../utilities/text-cleaner';
import {
  inspectFont,
  readStructuredData,
  type ViewerFileLike,
} from '../utilities/p17-viewers';

registerAllPublicTools();

function textFile(name: string, text: string): ViewerFileLike {
  const bytes = new TextEncoder().encode(text);
  return {
    name,
    size: bytes.byteLength,
    type: 'text/plain',
    async text() { return text; },
    async arrayBuffer() { return bytes.slice().buffer; },
  };
}

describe('Phase 9 final singleton coverage map', () => {
  it('keeps the three remaining families at their authoritative route counts', () => {
    expect(TOOLS_REGISTRY.filter((tool) => tool.category === 'text')).toHaveLength(21);
    expect(TOOLS_REGISTRY.filter((tool) => tool.category === 'developer')).toHaveLength(52);
    expect(TOOLS_REGISTRY.filter((tool) => tool.category === 'design')).toHaveLength(14);
  });

  it('contains the exact three Phase 9 singleton targets', () => {
    expect(TOOLS_REGISTRY.some((tool) => tool.id === 'text-cleaner' && tool.category === 'text')).toBe(true);
    expect(TOOLS_REGISTRY.some((tool) => tool.id === 'structured-data-viewer' && tool.category === 'developer')).toBe(true);
    expect(TOOLS_REGISTRY.some((tool) => tool.id === 'font-viewer' && tool.category === 'design')).toBe(true);
  });
});

describe('Phase 9 Text Cleaner contracts', () => {
  it('applies the default cleaner transformations deterministically', () => {
    const input = '  “Hello”—world  \r\n\r\n  second\tline\u200B  ';
    const { output, stats } = cleanText(input, defaultCleanerOptions);

    expect(output).toBe('"Hello"-world\n\nsecond line');
    expect(stats.invisibleCharsRemoved).toBe(1);
    expect(stats.inputLines).toBe(3);
    expect(stats.outputLines).toBe(3);
    expect(stats.outputChars).toBeLessThan(stats.inputChars);
  });

  it('preserves joiners by default while reporting them separately', () => {
    const input = 'Persian\u200Cjoiner emoji 👨‍👩‍👧';
    const report = analyzeInvisibleCharacters(input);
    expect(report.joiners).toBeGreaterThan(0);

    const { output } = cleanText(input, defaultCleanerOptions);
    expect(output).toContain('\u200C');
    expect(output).toContain('👨‍👩‍👧');
  });
});

describe('Phase 9 Structured Data Viewer contracts', () => {
  it('parses nested JSON and reports exact node/depth statistics', async () => {
    const view = await readStructuredData(
      textFile('fixture.json', JSON.stringify({
        user: { name: 'Ada', skills: ['math', 'code'] },
        active: true,
      }))
    );

    expect(view.format).toBe('JSON');
    expect(view.value).toEqual({
      user: { name: 'Ada', skills: ['math', 'code'] },
      active: true,
    });
    expect(view.nodeCount).toBe(7);
    expect(view.maxDepth).toBe(3);
  });

  it('rejects malformed JSON rather than fabricating a tree', async () => {
    await expect(readStructuredData(textFile('bad.json', '{"x": }'))).rejects.toThrow();
  });
});

describe('Phase 9 Font Viewer contracts', () => {
  it('identifies a TrueType header and table count', () => {
    const bytes = new Uint8Array(32);
    bytes.set([0x00, 0x01, 0x00, 0x00], 0);
    new DataView(bytes.buffer).setUint16(4, 7);

    expect(inspectFont(bytes, 'fixture.ttf')).toEqual({
      format: 'TrueType (TTF)',
      signature: '00 01 00 00',
      tableCount: 7,
      size: 32,
      extension: 'ttf',
    });
  });

  it('identifies OTF, WOFF, and WOFF2 signatures', () => {
    const make = (signature: string, name: string, tableOffset: number) => {
      const bytes = new Uint8Array(32);
      bytes.set(new TextEncoder().encode(signature), 0);
      if (tableOffset >= 0) new DataView(bytes.buffer).setUint16(tableOffset, 3);
      return inspectFont(bytes, name);
    };

    expect(make('OTTO', 'a.otf', 4).format).toBe('OpenType CFF (OTF)');
    expect(make('wOFF', 'a.woff', 12).format).toBe('Web Open Font Format (WOFF)');
    expect(make('wOF2', 'a.woff2', 12).format).toBe('Web Open Font Format 2 (WOFF2)');
  });

  it('rejects unsupported binary signatures', () => {
    expect(() => inspectFont(new Uint8Array(32), 'fake.ttf')).toThrow(/Unsupported font signature/);
  });
});
