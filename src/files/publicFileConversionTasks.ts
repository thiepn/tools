export type FileConversionGroup = 'table' | 'xml' | 'archive' | 'inspect';

export interface PublicFileConversionTask {
  id: string;
  name: string;
  shortName: string;
  description: string;
  keywords: string[];
  group: FileConversionGroup;
  featured: boolean;
}

export const PUBLIC_FILE_CONVERSION_TASKS: PublicFileConversionTask[] = [
  { id: 'csv-to-xlsx', name: 'CSV to Excel', shortName: 'CSV → Excel', description: 'Convert CSV data into a real XLSX workbook locally in your browser.', keywords: ['csv to excel', 'csv to xlsx', 'spreadsheet converter'], group: 'table', featured: true },
  { id: 'xlsx-to-csv', name: 'Excel to CSV', shortName: 'Excel → CSV', description: 'Extract the first worksheet from an XLSX workbook as standards-friendly CSV.', keywords: ['excel to csv', 'xlsx to csv', 'spreadsheet to csv'], group: 'table', featured: true },
  { id: 'csv-to-json', name: 'CSV to JSON', shortName: 'CSV → JSON', description: 'Convert CSV rows into a JSON array of objects while preserving quoted fields.', keywords: ['csv to json', 'convert csv json'], group: 'table', featured: true },
  { id: 'json-to-csv', name: 'JSON to CSV', shortName: 'JSON → CSV', description: 'Convert arrays of JSON records into CSV with correct quoting and stable column order.', keywords: ['json to csv', 'convert json csv'], group: 'table', featured: true },
  { id: 'json-to-xlsx', name: 'JSON to Excel', shortName: 'JSON → Excel', description: 'Convert JSON records into a downloadable XLSX workbook locally.', keywords: ['json to excel', 'json to xlsx'], group: 'table', featured: false },
  { id: 'xlsx-to-json', name: 'Excel to JSON', shortName: 'Excel → JSON', description: 'Convert the first XLSX worksheet into a JSON array of row objects.', keywords: ['excel to json', 'xlsx to json'], group: 'table', featured: false },
  { id: 'xml-to-json', name: 'XML to JSON', shortName: 'XML → JSON', description: 'Parse well-formed XML into a readable JSON representation without uploading it.', keywords: ['xml to json', 'convert xml json'], group: 'xml', featured: true },
  { id: 'json-to-xml', name: 'JSON to XML', shortName: 'JSON → XML', description: 'Convert JSON into deterministic XML with valid escaping and predictable structure.', keywords: ['json to xml', 'convert json xml'], group: 'xml', featured: false },
  { id: 'xml-to-csv', name: 'XML to CSV', shortName: 'XML → CSV', description: 'Convert repeated XML records into a flat CSV table for spreadsheets.', keywords: ['xml to csv', 'convert xml csv'], group: 'xml', featured: false },
  { id: 'csv-to-xml', name: 'CSV to XML', shortName: 'CSV → XML', description: 'Convert CSV rows into a simple records-and-fields XML document.', keywords: ['csv to xml', 'convert csv xml'], group: 'xml', featured: false },
  { id: 'csv-splitter', name: 'CSV Splitter', shortName: 'Split CSV', description: 'Split a large CSV into smaller valid CSV files while repeating the header row.', keywords: ['split csv', 'csv chunks', 'large csv splitter'], group: 'table', featured: true },
  { id: 'csv-merger', name: 'CSV Merger', shortName: 'Merge CSV', description: 'Merge multiple compatible CSV files into one clean file with one header row.', keywords: ['merge csv', 'combine csv files'], group: 'table', featured: true },
  { id: 'file-type-inspector', name: 'File Type Inspector', shortName: 'File Inspector', description: 'Inspect a local file using extension, MIME hint, signatures, size, and text/binary heuristics.', keywords: ['what file type', 'file inspector', 'mime type', 'magic bytes'], group: 'inspect', featured: true },
  { id: 'tar-pack', name: 'Create TAR Archive', shortName: 'Create TAR', description: 'Pack local files into a standard uncompressed TAR archive entirely in your browser.', keywords: ['create tar', 'tar pack', 'files to tar'], group: 'archive', featured: false },
  { id: 'tar-extract', name: 'Extract TAR Archive', shortName: 'Extract TAR', description: 'Inspect and extract files from standard TAR archives locally.', keywords: ['extract tar', 'open tar', 'untar'], group: 'archive', featured: false },
  { id: 'gzip-compress', name: 'GZIP Compress', shortName: 'GZIP Compress', description: 'Compress one file to .gz using the browser CompressionStream when supported.', keywords: ['gzip file', 'compress gz', 'create gzip'], group: 'archive', featured: false },
  { id: 'gzip-decompress', name: 'GZIP Decompress', shortName: 'GZIP Decompress', description: 'Decompress a .gz file locally using the browser DecompressionStream when supported.', keywords: ['decompress gzip', 'extract gz', 'gunzip'], group: 'archive', featured: false },
  { id: 'archive-converter', name: 'ZIP ↔ TAR Converter', shortName: 'ZIP ↔ TAR', description: 'Convert ZIP archives to TAR or TAR archives to ZIP without uploading the files.', keywords: ['zip to tar', 'tar to zip', 'archive converter'], group: 'archive', featured: false },
];

export function getPublicFileConversionTask(id: string | null | undefined): PublicFileConversionTask | undefined {
  return id ? PUBLIC_FILE_CONVERSION_TASKS.find((task) => task.id === id) : undefined;
}
