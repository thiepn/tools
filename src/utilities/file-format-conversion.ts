import JSZip from 'jszip';
import {
  parseTableInput,
  serializeDelimitedTable,
  tableToJson,
  type TableData,
} from './table-studio';
import { parseZipArchive, sanitizeZipPath } from './zip-manager';

export interface BinaryFileLike {
  name: string;
  size: number;
  type?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

export interface TarInputEntry {
  path: string;
  bytes: Uint8Array;
  mtime?: Date;
}

export interface TarEntry extends TarInputEntry {
  size: number;
}

export interface FileInspection {
  detectedType: string;
  mime: string;
  confidence: 'high' | 'medium' | 'low';
  extension: string;
  size: number;
  textLike: boolean;
  signature: string;
  notes: string[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: false });
const TAR_BLOCK = 512;
const MAX_TABLE_ROWS = 1_048_576;
const MAX_TABLE_COLUMNS = 16_384;
const MAX_TAR_ENTRIES = 5000;
const MAX_TAR_TOTAL = 2 * 1024 ** 3;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function tableRecords(data: Pick<TableData, 'headers' | 'rows'>): Array<Record<string, string>> {
  return data.rows.map((row) => Object.fromEntries(data.headers.map((header, index) => [header, row[index] ?? ''])));
}

export function csvTextToTable(text: string): TableData {
  return parseTableInput(text, { format: 'csv', hasHeader: true, trimCells: false }).data;
}

export function csvTextToJson(text: string): string {
  return tableToJson(csvTextToTable(text));
}

export function jsonTextToTable(text: string): TableData {
  return parseTableInput(text, { format: 'json', hasHeader: true, trimCells: false }).data;
}

export function jsonTextToCsv(text: string): string {
  return serializeDelimitedTable(jsonTextToTable(text), ',');
}

export function tableToRecordsXml(data: Pick<TableData, 'headers' | 'rows'>): string {
  const records = tableRecords(data)
    .map((record) => {
      const fields = Object.entries(record)
        .map(([name, value]) => `    <field name="${escapeXml(name)}">${escapeXml(value)}</field>`)
        .join('\n');
      return `  <record>\n${fields}\n  </record>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<records>\n${records}\n</records>\n`;
}

export function csvTextToXml(text: string): string {
  return tableToRecordsXml(csvTextToTable(text));
}

function jsonValueToXml(value: unknown, name = 'root'): string {
  const safeName = /^[A-Za-z_][\w.:-]*$/.test(name) ? name : 'item';
  if (value === null || value === undefined) return `<${safeName}/>`;
  if (Array.isArray(value)) {
    return `<${safeName}>${value.map((entry) => jsonValueToXml(entry, 'item')).join('')}</${safeName}>`;
  }
  if (typeof value === 'object') {
    const children = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => jsonValueToXml(entry, key))
      .join('');
    return `<${safeName}>${children}</${safeName}>`;
  }
  return `<${safeName}>${escapeXml(String(value))}</${safeName}>`;
}

export function jsonTextToXml(text: string): string {
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch (error) { throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON.'); }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${jsonValueToXml(parsed)}\n`;
}

function elementToJson(element: Element): unknown {
  const attributes = Object.fromEntries([...element.attributes].map((attr) => [`@${attr.name}`, attr.value]));
  const children = [...element.children];
  const text = [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE)
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();

  if (children.length === 0) {
    if (Object.keys(attributes).length === 0) return text;
    return { ...attributes, ...(text ? { '#text': text } : {}) };
  }

  const output: Record<string, unknown> = { ...attributes };
  for (const child of children) {
    const value = elementToJson(child);
    const existing = output[child.tagName];
    if (existing === undefined) output[child.tagName] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else output[child.tagName] = [existing, value];
  }
  if (text) output['#text'] = text;
  return output;
}

export function xmlTextToJson(text: string): string {
  if (typeof DOMParser === 'undefined') throw new Error('XML parsing is unavailable in this browser.');
  const document = new DOMParser().parseFromString(text, 'application/xml');
  const parseError = document.querySelector('parsererror');
  if (parseError) throw new Error(`Invalid XML: ${parseError.textContent?.trim() || 'parse error'}`);
  if (!document.documentElement) throw new Error('XML document has no root element.');
  return JSON.stringify({ [document.documentElement.tagName]: elementToJson(document.documentElement) }, null, 2);
}

function repeatedXmlRecords(root: Element): Element[] {
  const children = [...root.children];
  if (!children.length) return [];
  const counts = new Map<string, number>();
  for (const child of children) counts.set(child.tagName, (counts.get(child.tagName) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < 2) return children;
  return children.filter((child) => child.tagName === best[0]);
}

export function xmlTextToTable(text: string): TableData {
  if (typeof DOMParser === 'undefined') throw new Error('XML parsing is unavailable in this browser.');
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('Invalid XML document.');
  const root = document.documentElement;
  const records = repeatedXmlRecords(root);
  if (!records.length) return { headers: [], rows: [], detectedFormat: 'csv', delimiter: ',' };

  const headers: string[] = [];
  const seen = new Set<string>();
  const objects = records.map((record) => {
    const object: Record<string, string> = {};
    for (const attr of [...record.attributes]) object[`@${attr.name}`] = attr.value;
    for (const child of [...record.children]) {
      const key = child.getAttribute('name') && child.tagName === 'field' ? child.getAttribute('name')! : child.tagName;
      object[key] = child.textContent ?? '';
    }
    if (!record.children.length && record.textContent?.trim()) object.value = record.textContent.trim();
    for (const key of Object.keys(object)) if (!seen.has(key)) { seen.add(key); headers.push(key); }
    return object;
  });
  return { headers, rows: objects.map((object) => headers.map((header) => object[header] ?? '')), detectedFormat: 'csv', delimiter: ',' };
}

export function xmlTextToCsv(text: string): string {
  return serializeDelimitedTable(xmlTextToTable(text), ',');
}

function columnName(index: number): string {
  let value = index + 1;
  let out = '';
  while (value > 0) { value -= 1; out = String.fromCharCode(65 + (value % 26)) + out; value = Math.floor(value / 26); }
  return out;
}

function columnIndex(reference: string): number {
  const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? 'A';
  let value = 0;
  for (const char of letters) value = value * 26 + char.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

function cellXml(value: string, row: number, column: number): string {
  const ref = `${columnName(column)}${row + 1}`;
  const preserved = /^\s|\s$/.test(value) ? ' xml:space="preserve"' : '';
  return `<c r="${ref}" t="inlineStr"><is><t${preserved}>${escapeXml(value)}</t></is></c>`;
}

export async function tableToXlsxBlob(data: Pick<TableData, 'headers' | 'rows'>, sheetName = 'Sheet1'): Promise<Blob> {
  if (data.rows.length + 1 > MAX_TABLE_ROWS) throw new Error('XLSX supports at most 1,048,576 rows per worksheet.');
  if (data.headers.length > MAX_TABLE_COLUMNS) throw new Error('XLSX supports at most 16,384 columns per worksheet.');
  const rows = [data.headers, ...data.rows].map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, col) => cellXml(value ?? '', rowIndex, col)).join('')}</row>`).join('');
  const safeSheetName = sheetName.slice(0, 31).replace(/[\\/?*\[\]:]/g, '_') || 'Sheet1';
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(safeSheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.folder('_rels')!.file('.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.folder('xl')!.file('workbook.xml', workbook);
  zip.folder('xl')!.folder('_rels')!.file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  zip.folder('xl')!.folder('worksheets')!.file('sheet1.xml', sheet);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

function sharedStringsFromXml(xml: string): string[] {
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) => {
    const parts = [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => unescapeXml(part[1]));
    return parts.join('');
  });
}

function cellValue(cell: string, shared: string[]): string {
  const type = cell.match(/\bt="([^"]+)"/)?.[1] ?? '';
  if (type === 'inlineStr') return unescapeXml([...cell.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));
  const raw = cell.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1] ?? '';
  if (type === 's') return shared[Number(raw)] ?? '';
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE';
  return unescapeXml(raw);
}

export async function xlsxToTable(input: Blob | ArrayBuffer | Uint8Array): Promise<TableData> {
  const zip = await JSZip.loadAsync(input instanceof Blob ? await input.arrayBuffer() : input);
  const sheetFile = zip.file('xl/worksheets/sheet1.xml') ?? Object.values(zip.files).find((entry) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name) && !entry.dir);
  if (!sheetFile) throw new Error('No worksheet was found in this XLSX file.');
  const sheetXml = await sheetFile.async('text');
  const sharedFile = zip.file('xl/sharedStrings.xml');
  const shared = sharedFile ? sharedStringsFromXml(await sharedFile.async('text')) : [];
  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = cellMatch[1].match(/\br="([^"]+)"/)?.[1] ?? `${columnName(row.length)}1`;
      const index = columnIndex(ref);
      while (row.length < index) row.push('');
      row[index] = cellValue(`<c${cellMatch[1]}>${cellMatch[2]}</c>`, shared);
    }
    rows.push(row);
  }
  if (!rows.length) return { headers: [], rows: [], detectedFormat: 'csv', delimiter: ',' };
  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
  const headers = normalized[0].map((value, index) => value || `Column ${index + 1}`);
  return { headers, rows: normalized.slice(1), detectedFormat: 'csv', delimiter: ',' };
}

export async function csvTextToXlsx(text: string): Promise<Blob> { return tableToXlsxBlob(csvTextToTable(text)); }
export async function jsonTextToXlsx(text: string): Promise<Blob> { return tableToXlsxBlob(jsonTextToTable(text)); }
export async function xlsxToCsv(input: Blob | ArrayBuffer | Uint8Array): Promise<string> { return serializeDelimitedTable(await xlsxToTable(input), ','); }
export async function xlsxToJson(input: Blob | ArrayBuffer | Uint8Array): Promise<string> { return tableToJson(await xlsxToTable(input)); }

export function splitCsv(text: string, rowsPerFile: number): string[] {
  const size = Math.max(1, Math.floor(rowsPerFile));
  const data = csvTextToTable(text);
  if (!data.headers.length) return [];
  const chunks: string[] = [];
  for (let i = 0; i < data.rows.length; i += size) chunks.push(serializeDelimitedTable({ headers: data.headers, rows: data.rows.slice(i, i + size) }, ','));
  return chunks;
}

export function mergeCsvTexts(texts: string[]): string {
  if (!texts.length) throw new Error('Choose at least one CSV file.');
  const tables = texts.map(csvTextToTable);
  const baseHeaders = tables[0].headers;
  if (!baseHeaders.length) throw new Error('The first CSV has no header row.');
  for (let i = 1; i < tables.length; i++) {
    if (tables[i].headers.length !== baseHeaders.length || tables[i].headers.some((header, index) => header !== baseHeaders[index])) {
      throw new Error(`CSV ${i + 1} has a different header. Merge requires matching columns in the same order.`);
    }
  }
  return serializeDelimitedTable({ headers: baseHeaders, rows: tables.flatMap((table) => table.rows) }, ',');
}

function writeAscii(target: Uint8Array, offset: number, length: number, text: string): void {
  const bytes = encoder.encode(text);
  target.set(bytes.subarray(0, length), offset);
}

function octal(value: number, width: number): string {
  const digits = Math.max(0, Math.floor(value)).toString(8);
  return digits.padStart(width - 1, '0').slice(-(width - 1)) + '\0';
}

export function createTar(entries: TarInputEntry[]): Uint8Array {
  if (entries.length > MAX_TAR_ENTRIES) throw new Error(`TAR safety limit is ${MAX_TAR_ENTRIES} files.`);
  const total = entries.reduce((sum, entry) => sum + entry.bytes.byteLength, 0);
  if (total > MAX_TAR_TOTAL) throw new Error('TAR contents exceed the 2 GB browser safety limit.');
  const blocks = entries.reduce((sum, entry) => sum + 1 + Math.ceil(entry.bytes.byteLength / TAR_BLOCK), 0) + 2;
  const output = new Uint8Array(blocks * TAR_BLOCK);
  let offset = 0;
  const used = new Set<string>();
  for (const entry of entries) {
    const path = sanitizeZipPath(entry.path);
    if (!path) throw new Error('TAR file path cannot be empty.');
    if (encoder.encode(path).length > 100) throw new Error(`TAR path is too long for the portable ustar name field: ${path}`);
    const key = path.toLocaleLowerCase();
    if (used.has(key)) throw new Error(`Duplicate archive path: ${path}`);
    used.add(key);
    const header = output.subarray(offset, offset + TAR_BLOCK);
    writeAscii(header, 0, 100, path);
    writeAscii(header, 100, 8, octal(0o644, 8));
    writeAscii(header, 108, 8, octal(0, 8));
    writeAscii(header, 116, 8, octal(0, 8));
    writeAscii(header, 124, 12, octal(entry.bytes.byteLength, 12));
    writeAscii(header, 136, 12, octal(Math.floor((entry.mtime?.getTime() ?? Date.now()) / 1000), 12));
    header.fill(32, 148, 156);
    header[156] = '0'.charCodeAt(0);
    writeAscii(header, 257, 6, 'ustar\0');
    writeAscii(header, 263, 2, '00');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeAscii(header, 148, 8, checksum.toString(8).padStart(6, '0') + '\0 ');
    offset += TAR_BLOCK;
    output.set(entry.bytes, offset);
    offset += Math.ceil(entry.bytes.byteLength / TAR_BLOCK) * TAR_BLOCK;
  }
  return output;
}

function readTarString(bytes: Uint8Array, offset: number, length: number): string {
  const slice = bytes.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  return decoder.decode(end >= 0 ? slice.subarray(0, end) : slice).trim();
}

function readOctal(bytes: Uint8Array, offset: number, length: number): number {
  const text = readTarString(bytes, offset, length).replace(/\s/g, '');
  return text ? parseInt(text, 8) : 0;
}

export function parseTar(bytes: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let total = 0;
  while (offset + TAR_BLOCK <= bytes.length) {
    const header = bytes.subarray(offset, offset + TAR_BLOCK);
    if (header.every((byte) => byte === 0)) break;
    const rawPath = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const path = sanitizeZipPath(prefix ? `${prefix}/${rawPath}` : rawPath);
    const size = readOctal(header, 124, 12);
    const mtimeSeconds = readOctal(header, 136, 12);
    const type = String.fromCharCode(header[156] || 48);
    if (!path) throw new Error('TAR contains an unsafe or empty path.');
    if (!Number.isFinite(size) || size < 0 || offset + TAR_BLOCK + size > bytes.length) throw new Error(`Malformed TAR entry: ${path}`);
    if (type === '0' || type === '\0') {
      total += size;
      if (entries.length >= MAX_TAR_ENTRIES || total > MAX_TAR_TOTAL) throw new Error('TAR exceeds browser safety limits.');
      const contentStart = offset + TAR_BLOCK;
      entries.push({ path, bytes: bytes.slice(contentStart, contentStart + size), size, mtime: mtimeSeconds ? new Date(mtimeSeconds * 1000) : undefined });
    }
    offset += TAR_BLOCK + Math.ceil(size / TAR_BLOCK) * TAR_BLOCK;
  }
  return entries;
}

export async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') throw new Error('GZIP compression is not supported by this browser.');
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('GZIP decompression is not supported by this browser.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function zipToTar(input: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const parsed = await parseZipArchive(input);
  const entries: TarInputEntry[] = [];
  for (const entry of parsed.entries) {
    if (entry.isFolder) continue;
    const file = parsed.zipInstance.file(entry.path);
    if (!file) continue;
    entries.push({ path: entry.path, bytes: await file.async('uint8array'), mtime: entry.date });
  }
  return createTar(entries);
}

export async function tarToZip(bytes: Uint8Array): Promise<Blob> {
  const zip = new JSZip();
  for (const entry of parseTar(bytes)) zip.file(entry.path, entry.bytes, { date: entry.mtime });
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function inspectFile(file: BinaryFileLike): Promise<FileInspection> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = bytes.subarray(0, 512);
  const hex = [...head.subarray(0, 16)].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
  const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const notes: string[] = [];
  let detectedType = 'Unknown';
  let mime = file.type || 'application/octet-stream';
  let confidence: FileInspection['confidence'] = 'low';

  const starts = (...signature: number[]) => signature.every((value, index) => head[index] === value);
  if (starts(0x25, 0x50, 0x44, 0x46)) { detectedType = 'PDF'; mime = 'application/pdf'; confidence = 'high'; }
  else if (starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)) { detectedType='PNG image'; mime='image/png'; confidence='high'; }
  else if (starts(0xff,0xd8,0xff)) { detectedType='JPEG image'; mime='image/jpeg'; confidence='high'; }
  else if (decoder.decode(head.subarray(0,6)).startsWith('GIF8')) { detectedType='GIF image'; mime='image/gif'; confidence='high'; }
  else if (starts(0x50,0x4b,0x03,0x04) || starts(0x50,0x4b,0x05,0x06)) { detectedType = extension === 'xlsx' ? 'Excel XLSX workbook' : extension === 'docx' ? 'Word DOCX document' : 'ZIP / OOXML archive'; mime = extension === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/zip'; confidence='high'; notes.push('XLSX and DOCX are ZIP-based OOXML containers, so the extension helps distinguish them.'); }
  else if (starts(0x1f,0x8b)) { detectedType='GZIP archive'; mime='application/gzip'; confidence='high'; }
  else if (head.length >= 262 && decoder.decode(head.subarray(257,262)) === 'ustar') { detectedType='TAR archive'; mime='application/x-tar'; confidence='high'; }
  else {
    const sample = decoder.decode(bytes.subarray(0, Math.min(bytes.length, 8192))).trimStart();
    const nulCount = head.filter((byte) => byte === 0).length;
    const textLike = nulCount === 0;
    if (textLike && (sample.startsWith('{') || sample.startsWith('['))) { try { JSON.parse(sample); detectedType='JSON text'; mime='application/json'; confidence='high'; } catch {} }
    if (detectedType === 'Unknown' && textLike && sample.startsWith('<')) { detectedType='XML / markup text'; mime='application/xml'; confidence='medium'; }
    if (detectedType === 'Unknown' && textLike && /[,;\t].*(?:\r?\n|$)/.test(sample)) { detectedType='Delimited text / CSV'; mime='text/csv'; confidence='medium'; }
    if (detectedType === 'Unknown' && textLike) { detectedType='Plain text'; mime=file.type || 'text/plain'; confidence='medium'; }
  }
  const textLike = !head.includes(0) && !/^image\//.test(mime) && !/pdf|zip|gzip|tar/.test(mime);
  if (file.type && file.type !== mime) notes.push(`Browser MIME hint (${file.type}) differs from detected type (${mime}).`);
  return { detectedType, mime, confidence, extension, size: file.size, textLike, signature: hex || 'empty file', notes };
}
