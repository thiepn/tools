import type{ToolCategory}from'../types';
export type P17ViewerKind='document'|'spreadsheet'|'presentation'|'ebook'|'structured'|'archive'|'svg'|'font';
export interface PublicP17Task{id:string;name:string;shortName:string;description:string;keywords:string[];kind:P17ViewerKind;category:ToolCategory;featured:boolean}
type Raw=[string,string,string,string,string,P17ViewerKind,ToolCategory,boolean?];
const RAW:Raw[]=[
['document-viewer','Document Viewer','Document Viewer','Open and inspect DOCX, ODT, RTF, TXT, Markdown, and HTML documents locally with searchable extracted content and metadata.','docx viewer|word viewer|odt viewer|rtf viewer|document reader|open docx|markdown viewer|html viewer','document','files',true],
['spreadsheet-viewer','Spreadsheet Viewer','Spreadsheet Viewer','Open CSV, TSV, JSON tables, XML tables, XLS, XLSX, and ODS locally with worksheet navigation, search, sorting, and row/column inspection.','excel viewer|xlsx viewer|xls viewer|ods viewer|csv viewer|spreadsheet reader|open excel|table viewer','spreadsheet','files',true],
['presentation-viewer','Presentation Viewer','Presentation Viewer','Open PPTX and ODP presentations locally with slide navigation, searchable extracted text, and presentation metadata.','pptx viewer|powerpoint viewer|odp viewer|presentation reader|open powerpoint|slide viewer','presentation','files',true],
['ebook-reader','EPUB Reader','EPUB Reader','Read EPUB books locally with chapter navigation, search, book metadata, and a distraction-light reading view.','epub reader|ebook viewer|ebook reader|open epub|read epub|book viewer','ebook','files',true],
['structured-data-viewer','Structured Data Viewer','Data Tree Viewer','Inspect JSON, XML, YAML, and TOML locally as expandable trees with raw source, search, depth, and node statistics.','json tree viewer|xml tree viewer|yaml viewer|toml viewer|structured data viewer|data inspector','structured','developer',true],
['archive-browser','Archive Browser','Archive Browser','Browse ZIP, TAR, TGZ/TAR.GZ, RAR, and 7Z archives locally with safe path inspection, file sizes, filtering, and archive summaries.','zip viewer|rar viewer|7z viewer|archive viewer|archive browser|tar viewer|browse archive','archive','files',true],
['svg-viewer','SVG Viewer & Inspector','SVG Viewer','Preview and inspect local SVG files safely with source, dimensions, viewBox, element counts, and structural warnings.','svg viewer|svg inspector|open svg|svg preview|svg source|vector viewer','svg','design',true],
['font-viewer','Font Viewer & Character Map','Font Viewer','Preview local TTF, OTF, WOFF, and WOFF2 fonts with sample text, glyph characters, format detection, and basic file metadata.','font viewer|ttf viewer|otf viewer|woff viewer|woff2 viewer|font preview|character map|glyph viewer','font','design',true],
];
export const PUBLIC_P17_TASKS:PublicP17Task[]=RAW.map(([id,name,shortName,description,keys,kind,category,featured])=>({id,name,shortName,description,keywords:keys.split('|'),kind,category,featured:Boolean(featured)}));
export function getPublicP17Task(id:string|null|undefined){return id?PUBLIC_P17_TASKS.find(t=>t.id===id):undefined}
