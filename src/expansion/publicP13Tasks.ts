import type{ToolCategory}from'../types';
export type P13Format='document'|'docx'|'epub'|'pptx';
export interface PublicP13Task{id:string;name:string;shortName:string;description:string;keywords:string[];format:P13Format;category:ToolCategory;mode:'convert'|'import'|'export'|'inspect'|'edit'}
type Raw=[string,string,string,P13Format,'convert'|'import'|'export'|'inspect'|'edit'];
const RAW:Raw[]=[
['document-converter','Document & eBook Converter','document converter docx markdown html text epub pdf pptx','document','convert'],
['docx-metadata-inspector','DOCX Metadata Inspector','docx metadata','docx','inspect'],
['epub-metadata-editor','EPUB Metadata Editor','epub metadata','epub','edit'],
];
export const PUBLIC_P13_TASKS:PublicP13Task[]=RAW.map(([id,name,key,format,mode])=>({id,name,shortName:name,description:id==='document-converter'?'Upload TXT, Markdown, HTML, DOCX, EPUB, PPTX, or PDF and convert to compatible document/eBook outputs locally in the browser.':`Local ${name.toLowerCase()} workflow for content-oriented Office/eBook interchange without uploading the source file.`,keywords:[key,...key.split(' ')],format,mode,category:'files'}));
export function getPublicP13Task(id:string|null|undefined){return id?PUBLIC_P13_TASKS.find(t=>t.id===id):undefined}
