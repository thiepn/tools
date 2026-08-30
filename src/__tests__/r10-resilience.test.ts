import { describe, expect, it } from 'vitest';
import { cleanText, defaultCleanerOptions } from '../utilities/text-cleaner';
import { calculateWordStats } from '../utilities/word-counter';
import { processList } from '../utilities/list-processor';
import { convertCase } from '../utilities/case-converter';
import { formatAndValidateJson, sortJsonKeys } from '../utilities/json-formatter';

const LIST_OPTIONS = {
  removeDuplicates: true,
  duplicateMode: 'case-insensitive' as const,
  trimItems: true,
  sort: 'alpha-asc' as const,
  removeNumbering: false,
  removeEmpty: true,
  reverse: false,
  shuffle: false,
  joinWith: '\n',
};

describe('R10 large-input resilience', () => {
  it('cleans 50,000 lines while preserving deterministic duplicate statistics', () => {
    const uniqueLines = Array.from({ length: 25_000 }, (_, index) => `  Item   ${index}  `);
    const input = [...uniqueLines, ...uniqueLines].join('\r\n');

    const result = cleanText(input, {
      ...defaultCleanerOptions,
      removeDuplicates: true,
      caseSensitiveDuplicates: true,
      collapseSpaces: true,
      trimEachLine: true,
    });

    expect(result.stats.inputLines).toBe(50_000);
    expect(result.stats.outputLines).toBe(25_000);
    expect(result.stats.duplicatesRemoved).toBe(25_000);
    expect(result.output.startsWith('Item 0\nItem 1\n')).toBe(true);
    expect(result.output.endsWith('Item 24999')).toBe(true);
  }, 15_000);

  it('counts 100,000 words without losing frequency or timing accuracy', () => {
    const input = Array.from({ length: 100_000 }, (_, index) =>
      index % 4 === 0 ? 'alpha' : index % 4 === 1 ? 'beta' : index % 4 === 2 ? 'gamma' : 'delta'
    ).join(' ');

    const stats = calculateWordStats(input, { readingWpm: 250, speakingWpm: 125 });

    expect(stats.words).toBe(100_000);
    expect(stats.uniqueWords).toBe(4);
    expect(stats.topWords).toHaveLength(4);
    expect(stats.topWords.map((entry) => entry.count)).toEqual([25_000, 25_000, 25_000, 25_000]);
    expect(stats.readingTimeSeconds).toBe(24_000);
    expect(stats.speakingTimeSeconds).toBe(48_000);
  }, 15_000);

  it('deduplicates and sorts a 30,000-item list deterministically', () => {
    const input = Array.from({ length: 30_000 }, (_, index) => ` value-${index % 10_000} `);
    const result = processList(input, LIST_OPTIONS);

    expect(result.items).toHaveLength(10_000);
    expect(new Set(result.items).size).toBe(10_000);
    expect(result.items[0]).toBe('value-0');
    expect(result.items).toContain('value-9999');
  }, 15_000);

  it('converts a 20,000-word identifier input without truncation', () => {
    const input = Array.from({ length: 20_000 }, (_, index) => `word${index}`).join(' ');
    const output = convertCase(input, 'snake_case');

    expect(output.startsWith('word0_word1_word2_')).toBe(true);
    expect(output.endsWith('word19999')).toBe(true);
    expect(output.split('_')).toHaveLength(20_000);
  }, 15_000);

  it('sorts a deeply nested object without recursive call-stack growth', () => {
    const depth = 12_000;
    const root: Record<string, unknown> = {};
    let cursor = root;

    for (let index = 0; index < depth; index++) {
      const child: Record<string, unknown> = {};
      cursor.z = index;
      cursor.a = child;
      cursor = child;
    }
    cursor.final = true;

    const sorted = sortJsonKeys(root) as Record<string, unknown>;
    let sortedCursor = sorted;

    for (let index = 0; index < depth; index++) {
      expect(Object.keys(sortedCursor)).toEqual(['a', 'z']);
      sortedCursor = sortedCursor.a as Record<string, unknown>;
    }
    expect(sortedCursor.final).toBe(true);
  }, 15_000);

  it('formats and measures a wide 10,000-key JSON object with sorted keys', () => {
    const source: Record<string, unknown> = {};
    for (let index = 9_999; index >= 0; index--) {
      source[`key-${index.toString().padStart(5, '0')}`] = { index, enabled: index % 2 === 0 };
    }

    const input = JSON.stringify(source);
    const result = formatAndValidateJson(input, { indent: 'minify', sortKeys: true });

    expect(result.isValid).toBe(true);
    expect(result.stats?.keysCount).toBe(30_000);
    expect(result.stats?.depth).toBe(3);
    expect(result.formatted?.startsWith('{"key-00000"')).toBe(true);
    expect(result.formatted?.includes('"key-09999"')).toBe(true);
  }, 15_000);

  it('preserves the established JSON depth semantics after iterative traversal', () => {
    const result = formatAndValidateJson('{"a":{"b":[1,{"c":2}]}}', {
      indent: 'minify',
      sortKeys: false,
    });

    expect(result.isValid).toBe(true);
    expect(result.stats?.keysCount).toBe(3);
    expect(result.stats?.depth).toBe(5);
  });
});
