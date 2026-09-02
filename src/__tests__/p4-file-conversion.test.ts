import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { PUBLIC_FILE_CONVERSION_TASKS } from '../files/publicFileConversionTasks';
import {
  createTar,
  csvTextToJson,
  csvTextToXlsx,
  jsonTextToCsv,
  jsonTextToXml,
  mergeCsvTexts,
  parseTar,
  splitCsv,
  tarToZip,
  xlsxToCsv,
  xlsxToJson,
  zipToTar,
} from '../utilities/file-format-conversion';
import { TOOLS_REGISTRY } from '../registry/tools';
import { registerPdfPublicTools } from '../registry/pdf-extension';
import { registerDeviceDiagnosticTools } from '../registry/device-extension';
import { registerCalculatorTools } from '../registry/calculator-extension';
import { registerFileConversionTools } from '../registry/file-conversion-extension';

registerPdfPublicTools();
registerDeviceDiagnosticTools();
registerCalculatorTools();
registerFileConversionTools();

describe('P4 public file conversion catalog', () => {
  it('contains 9 unique routes after pairwise data conversion consolidation', () => {
    expect(PUBLIC_FILE_CONVERSION_TASKS).toHaveLength(9);
    expect(new Set(PUBLIC_FILE_CONVERSION_TASKS.map((task) => task.id)).size).toBe(9);
    expect(PUBLIC_FILE_CONVERSION_TASKS.some((task)=>task.id==='data-converter')).toBe(true);
    for (const task of PUBLIC_FILE_CONVERSION_TASKS) {
      expect(TOOLS_REGISTRY.some((tool) => tool.id === task.id && tool.category === 'files')).toBe(true);
    }
  });

  it('keeps unsupported high-fidelity and specialist codecs out of P4 claims', () => {
    const ids = new Set(PUBLIC_FILE_CONVERSION_TASKS.map((task) => task.id));
    expect(ids.has('7z-extractor')).toBe(false);
    expect(ids.has('docx-to-pdf')).toBe(false);
    expect(ids.has('pdf-to-docx')).toBe(false);
    expect(ids.has('csv-to-json')).toBe(false);
    expect(ids.has('xlsx-to-csv')).toBe(false);
  });
});

describe('P4 table conversions', () => {
  it('preserves quoted CSV fields when converting through JSON', () => {
    const csv = 'name,note\r\nAda,"hello, world"\r\nLin,"line 1\nline 2"';
    const json = csvTextToJson(csv);
    expect(JSON.parse(json)).toEqual([
      { name: 'Ada', note: 'hello, world' },
      { name: 'Lin', note: 'line 1\nline 2' },
    ]);
    const roundTrip = jsonTextToCsv(json);
    expect(roundTrip).toContain('"hello, world"');
    expect(roundTrip).toContain('"line 1\nline 2"');
  });

  it('round-trips simple tabular values through XLSX', async () => {
    const source = 'name,score\r\nAda,98\r\nLin,91';
    const workbook = await csvTextToXlsx(source);
    const csv = await xlsxToCsv(workbook);
    expect(csv).toBe(source);
    const json = JSON.parse(await xlsxToJson(workbook));
    expect(json).toEqual([{ name: 'Ada', score: '98' }, { name: 'Lin', score: '91' }]);
  });

  it('splits valid CSV chunks and repeats the header', () => {
    const chunks = splitCsv('id,value\r\n1,a\r\n2,b\r\n3,c', 2);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe('id,value\r\n1,a\r\n2,b');
    expect(chunks[1]).toBe('id,value\r\n3,c');
  });

  it('merges compatible CSVs and rejects incompatible headers', () => {
    expect(mergeCsvTexts(['id,value\r\n1,a', 'id,value\r\n2,b'])).toBe('id,value\r\n1,a\r\n2,b');
    expect(() => mergeCsvTexts(['id,value\r\n1,a', 'value,id\r\nb,2'])).toThrow('different header');
  });

  it('escapes JSON values when serializing XML', () => {
    const xml = jsonTextToXml('{"message":"a < b & c","quote":"\\\"yes\\\""}');
    expect(xml).toContain('a &lt; b &amp; c');
    expect(xml).toContain('&quot;yes&quot;');
  });
});

describe('P4 archive conversions', () => {
  it('round-trips regular files through portable TAR', () => {
    const tar = createTar([
      { path: 'docs/readme.txt', bytes: new TextEncoder().encode('hello') },
      { path: 'data.csv', bytes: new TextEncoder().encode('a,b\n1,2') },
    ]);
    const entries = parseTar(tar);
    expect(entries.map((entry) => entry.path)).toEqual(['docs/readme.txt', 'data.csv']);
    expect(new TextDecoder().decode(entries[0].bytes)).toBe('hello');
  });

  it('normalizes traversal segments before writing TAR paths', () => {
    const tar = createTar([{ path: '../secret.txt', bytes: new TextEncoder().encode('x') }]);
    expect(parseTar(tar)[0].path).toBe('secret.txt');
  });

  it('converts TAR to ZIP and ZIP back to TAR without losing file bytes', async () => {
    const tar = createTar([{ path: 'hello.txt', bytes: new TextEncoder().encode('hello') }]);
    const zipBlob = await tarToZip(tar);
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(await zip.file('hello.txt')?.async('text')).toBe('hello');

    const rebuiltTar = await zipToTar(zipBlob);
    const entries = parseTar(rebuiltTar);
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe('hello.txt');
    expect(new TextDecoder().decode(entries[0].bytes)).toBe('hello');
  });
});
