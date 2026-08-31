export type FileConversionGroup='table'|'xml'|'archive'|'inspect';
export interface PublicFileConversionTask{id:string;name:string;shortName:string;description:string;keywords:string[];group:FileConversionGroup;featured:boolean}
type Raw=[string,string,string,string,FileConversionGroup,string?,boolean?];
const RAW:Raw[]=[
['csv-to-xlsx','CSV to Excel','Convert CSV data into a real XLSX workbook locally in your browser.','csv to excel|csv to xlsx|spreadsheet converter','table','CSV → Excel',true],
['xlsx-to-csv','Excel to CSV','Extract the first worksheet from an XLSX workbook as standards-friendly CSV.','excel to csv|xlsx to csv|spreadsheet to csv','table','Excel → CSV',true],
['csv-to-json','CSV to JSON','Convert CSV rows into a JSON array of objects while preserving quoted fields.','csv to json|convert csv json','table','CSV → JSON',true],
['json-to-csv','JSON to CSV','Convert arrays of JSON records into CSV with correct quoting and stable column order.','json to csv|convert json csv','table','JSON → CSV',true],
['json-to-xlsx','JSON to Excel','Convert JSON records into a downloadable XLSX workbook locally.','json to excel|json to xlsx','table','JSON → Excel'],
['xlsx-to-json','Excel to JSON','Convert the first XLSX worksheet into a JSON array of row objects.','excel to json|xlsx to json','table','Excel → JSON'],
['xml-to-json','XML to JSON','Parse well-formed XML into a readable JSON representation without uploading it.','xml to json|convert xml json','xml','XML → JSON',true],
['json-to-xml','JSON to XML','Convert JSON into deterministic XML with valid escaping and predictable structure.','json to xml|convert json xml','xml','JSON → XML'],
['xml-to-csv','XML to CSV','Convert repeated XML records into a flat CSV table for spreadsheets.','xml to csv|convert xml csv','xml','XML → CSV'],
['csv-to-xml','CSV to XML','Convert CSV rows into a simple records-and-fields XML document.','csv to xml|convert csv xml','xml','CSV → XML'],
['csv-splitter','CSV Splitter','Split a large CSV into smaller valid CSV files while repeating the header row.','split csv|csv chunks|large csv splitter','table','Split CSV',true],
['csv-merger','CSV Merger','Merge multiple compatible CSV files into one clean file with one header row.','merge csv|combine csv files','table','Merge CSV',true],
['file-type-inspector','File Type Inspector','Inspect a local file using extension, MIME hint, signatures, size, and text/binary heuristics.','what file type|file inspector|mime type|magic bytes','inspect','File Inspector',true],
['tar-pack','Create TAR Archive','Pack local files into a standard uncompressed TAR archive entirely in your browser.','create tar|tar pack|files to tar','archive','Create TAR'],
['tar-extract','Extract TAR Archive','Inspect and extract files from standard TAR archives locally.','extract tar|open tar|untar','archive','Extract TAR'],
['gzip-compress','GZIP Compress','Compress one file to .gz using the browser CompressionStream when supported.','gzip file|compress gz|create gzip','archive'],
['gzip-decompress','GZIP Decompress','Decompress a .gz file locally using the browser DecompressionStream when supported.','decompress gzip|extract gz|gunzip','archive'],
['archive-converter','ZIP ↔ TAR Converter','Convert ZIP archives to TAR or TAR archives to ZIP without uploading the files.','zip to tar|tar to zip|archive converter','archive','ZIP ↔ TAR'],
];
export const PUBLIC_FILE_CONVERSION_TASKS:PublicFileConversionTask[]=RAW.map(([id,name,description,keys,group,shortName,featured])=>({id,name,shortName:shortName||name,description,keywords:keys.split('|'),group,featured:Boolean(featured)}));
export function getPublicFileConversionTask(id:string|null|undefined){return id?PUBLIC_FILE_CONVERSION_TASKS.find(task=>task.id===id):undefined}
