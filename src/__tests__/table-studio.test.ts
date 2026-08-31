import { describe, expect, it } from 'vitest';
import {
  calculateTableStats,
  deduplicateTableRows,
  detectTableDelimiter,
  filterTableRows,
  formatTableOutput,
  getTableOutputExtension,
  parseDelimitedRows,
  parseTableInput,
  serializeDelimitedTable,
  sortTableRows,
  tableToHtml,
  tableToJson,
  tableToMarkdown,
  transposeTable,
  type TableData,
} from '../utilities/table-studio';

describe('CSV & Table Studio', () => {
  it('detects common delimiters from consistent records', () => {
    expect(detectTableDelimiter('a,b,c\n1,2,3\n4,5,6')).toBe(',');
    expect(detectTableDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(detectTableDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectTableDelimiter('a|b|c\n1|2|3')).toBe('|');
  });

  it('parses quoted separators, escaped quotes, and multiline cells', () => {
    const rows = parseDelimitedRows(
      'Name,Notes\r\nAda,"Fast, accurate"\r\nGrace,"Line one\nLine two"\r\nLinus,"Says ""hello"""',
      ','
    );
    expect(rows).toEqual([
      ['Name', 'Notes'],
      ['Ada', 'Fast, accurate'],
      ['Grace', 'Line one\nLine two'],
      ['Linus', 'Says "hello"'],
    ]);
  });

  it('rejects an unclosed quoted field instead of silently corrupting data', () => {
    expect(() => parseDelimitedRows('a,b\n1,"unfinished', ',')).toThrow(/Unclosed quoted field/);
  });

  it('auto-detects CSV, creates unique headers, and pads ragged rows', () => {
    const result = parseTableInput('Name,Name,Score\nAda,A,97\nGrace,G\nLinus,L,88,ignored');
    expect(result.data.headers).toEqual(['Name', 'Name (2)', 'Score', 'Column 4']);
    expect(result.data.rows[1]).toEqual(['Grace', 'G', '', '']);
    expect(result.raggedRowCount).toBe(3);
    expect(result.stats.rowCount).toBe(3);
    expect(result.stats.columnCount).toBe(4);
  });

  it('supports headerless tables with generated column names', () => {
    const result = parseTableInput('Ada,97\nGrace,91', { hasHeader: false });
    expect(result.data.headers).toEqual(['Column 1', 'Column 2']);
    expect(result.data.rows).toEqual([
      ['Ada', '97'],
      ['Grace', '91'],
    ]);
  });

  it('ingests JSON arrays of objects with the union of encountered keys', () => {
    const result = parseTableInput(
      JSON.stringify([
        { name: 'Ada', score: 97 },
        { name: 'Grace', team: 'Green' },
      ]),
      { format: 'json' }
    );
    expect(result.data.headers).toEqual(['name', 'score', 'team']);
    expect(result.data.rows).toEqual([
      ['Ada', '97', ''],
      ['Grace', '', 'Green'],
    ]);
    expect(result.data.detectedFormat).toBe('json');
  });

  it('ingests JSON matrices and respects the header option', () => {
    const input = JSON.stringify([
      ['Name', 'Score'],
      ['Ada', 97],
      ['Grace', 91],
    ]);
    const withHeader = parseTableInput(input, { format: 'json', hasHeader: true });
    expect(withHeader.data.headers).toEqual(['Name', 'Score']);
    expect(withHeader.data.rows[0]).toEqual(['Ada', '97']);

    const withoutHeader = parseTableInput(input, { format: 'json', hasHeader: false });
    expect(withoutHeader.data.headers).toEqual(['Column 1', 'Column 2']);
    expect(withoutHeader.data.rows[0]).toEqual(['Name', 'Score']);
  });

  it('sorts numeric values numerically and keeps equal values stable', () => {
    const rows = [
      ['A', '10'],
      ['B', '2'],
      ['C', '2'],
      ['D', '30'],
    ];
    expect(sortTableRows(rows, 1, 'asc')).toEqual([
      ['B', '2'],
      ['C', '2'],
      ['A', '10'],
      ['D', '30'],
    ]);
    expect(sortTableRows(rows, 1, 'desc')[0]).toEqual(['D', '30']);
  });

  it('filters globally or by one column with optional case sensitivity', () => {
    const rows = [
      ['Ada', 'Blue'],
      ['Grace', 'Green'],
      ['ADA Lovelace', 'History'],
    ];
    expect(filterTableRows(rows, 'ada')).toHaveLength(2);
    expect(filterTableRows(rows, 'ada', 0, true)).toHaveLength(0);
    expect(filterTableRows(rows, 'green', 0)).toHaveLength(0);
    expect(filterTableRows(rows, 'green', 1)).toEqual([['Grace', 'Green']]);
  });

  it('deduplicates exact rows or unique values in a selected column', () => {
    const rows = [
      ['Ada', 'Blue'],
      ['Ada', 'Blue'],
      ['Ada', 'Green'],
      ['Grace', 'Green'],
    ];
    expect(deduplicateTableRows(rows)).toHaveLength(3);
    expect(deduplicateTableRows(rows, 0)).toEqual([
      ['Ada', 'Blue'],
      ['Grace', 'Green'],
    ]);
  });

  it('transposes headers and rows into a valid table', () => {
    const source: TableData = {
      headers: ['Name', 'Score'],
      rows: [
        ['Ada', '97'],
        ['Grace', '91'],
      ],
      detectedFormat: 'csv',
      delimiter: ',',
    };
    const result = transposeTable(source);
    expect(result.headers).toEqual(['Name', 'Ada', 'Grace']);
    expect(result.rows).toEqual([['Score', '97', '91']]);
  });

  it('calculates empty and duplicate statistics deterministically', () => {
    const stats = calculateTableStats({
      headers: ['A', 'B'],
      rows: [
        ['x', ''],
        ['x', ''],
        ['y', 'z'],
      ],
    });
    expect(stats).toEqual({
      rowCount: 3,
      columnCount: 2,
      emptyCellCount: 2,
      duplicateRowCount: 1,
      nonEmptyCellCount: 4,
    });
  });

  it('serializes standards-safe CSV and TSV output', () => {
    const data = {
      headers: ['Name', 'Notes'],
      rows: [['Ada', 'Fast, "accurate"\nwork']],
    };
    expect(serializeDelimitedTable(data, ',')).toBe(
      'Name,Notes\r\nAda,"Fast, ""accurate""\nwork"'
    );
    expect(serializeDelimitedTable(data, '\t')).toContain('Name\tNotes');
  });

  it('exports JSON, Markdown, and escaped HTML safely', () => {
    const data = {
      headers: ['Name', 'A|B'],
      rows: [['<Ada>', 'x|y']],
    };
    expect(JSON.parse(tableToJson(data))).toEqual([{ Name: '<Ada>', 'A|B': 'x|y' }]);
    expect(tableToMarkdown(data)).toContain('A\\|B');
    expect(tableToMarkdown(data)).toContain('x\\|y');
    expect(tableToHtml(data)).toContain('&lt;Ada&gt;');
    expect(tableToHtml(data)).not.toContain('<td><Ada></td>');
  });

  it('formats all five output modes and extensions', () => {
    const data: TableData = {
      headers: ['Name', 'Score'],
      rows: [['Ada', '97']],
      detectedFormat: 'csv',
      delimiter: ',',
    };
    expect(formatTableOutput(data, 'csv')).toContain('Name,Score');
    expect(formatTableOutput(data, 'tsv')).toContain('Name\tScore');
    expect(formatTableOutput(data, 'json')).toContain('"Name": "Ada"');
    expect(formatTableOutput(data, 'markdown')).toContain('| Name | Score |');
    expect(formatTableOutput(data, 'html')).toContain('<table>');
    expect(getTableOutputExtension('markdown')).toBe('md');
    expect(getTableOutputExtension('json')).toBe('json');
  });

  it('handles a 10,000-row CSV without truncating data', () => {
    const input = ['id,value'];
    for (let i = 0; i < 10_000; i++) input.push(`${i},item-${i}`);
    const result = parseTableInput(input.join('\n'));
    expect(result.stats.rowCount).toBe(10_000);
    expect(result.data.rows[9_999]).toEqual(['9999', 'item-9999']);
  });
});
