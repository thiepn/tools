export type FileConversionGroup='table'|'archive'|'inspect';
export interface PublicFileConversionTask{id:string;name:string;shortName:string;description:string;keywords:string[];group:FileConversionGroup;featured:boolean}
type Raw=[string,string,string,string,FileConversionGroup,string?,boolean?];
const RAW:Raw[]=[
['data-converter','Data & Spreadsheet Converter','Convert mainstream CSV, TSV, JSON, XML, XLS, XLSX, ODS, YAML, TOML, and HTML tables locally in one workspace.','csv json xml xls xlsx yaml toml tsv ods html table converter|spreadsheet converter|data converter|excel converter|openoffice spreadsheet|convert json csv|json to csv|csv to json|csv to excel|excel to csv|csv to xlsx|xlsx to csv|xls to xlsx|xlsx to xls|xls to csv|csv to xls|ods to xlsx|xlsx to ods|tsv to csv|csv to tsv|json to ods|ods to json|html table to csv|csv to html|xml to json|json to xml|yaml to json|json to yaml|toml to json|json to toml','table','Data Converter',true],
['csv-splitter','CSV Splitter','Split a large CSV into smaller valid CSV files while repeating the header row.','split csv|csv chunks|large csv splitter','table','Split CSV',true],
['csv-merger','CSV Merger','Merge multiple compatible CSV files into one clean file with one header row.','merge csv|combine csv files','table','Merge CSV',true],
['file-type-inspector','File Type Inspector','Inspect a local file using extension, MIME hint, signatures, size, and text/binary heuristics.','what file type|file inspector|mime type|magic bytes','inspect','File Inspector',true],
['tar-pack','Create TAR Archive','Pack local files into a standard uncompressed TAR archive entirely in your browser.','create tar|tar pack|files to tar','archive','Create TAR'],
['tar-extract','Extract TAR Archive','Inspect and extract files from standard TAR archives locally.','extract tar|open tar|untar','archive','Extract TAR'],
['gzip-compress','GZIP Compress','Compress one file to .gz using the browser CompressionStream when supported.','gzip file|compress gz|create gzip','archive'],
['gzip-decompress','GZIP Decompress','Decompress a .gz file locally using the browser DecompressionStream when supported.','decompress gzip|extract gz|gunzip','archive'],
['archive-converter','Archive Converter','Convert ZIP, TAR, and TGZ/TAR.GZ locally, and convert mainstream RAR or 7Z inputs to ZIP/TAR/TGZ using an on-demand local archive reader.','zip to tar|tar to zip|tgz to zip|zip to tgz|tar gz converter|archive converter|rar to zip|rar to tar|rar to tgz|7z to zip|7z to tar|7z to tgz|open rar|open 7z','archive','Archive Converter'],
];
export const PUBLIC_FILE_CONVERSION_TASKS:PublicFileConversionTask[]=RAW.map(([id,name,description,keys,group,shortName,featured])=>({id,name,shortName:shortName||name,description,keywords:keys.split('|'),group,featured:Boolean(featured)}));
export function getPublicFileConversionTask(id:string|null|undefined){return id?PUBLIC_FILE_CONVERSION_TASKS.find(task=>task.id===id):undefined}
