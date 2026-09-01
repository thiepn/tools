import type{ToolCategory}from'../types';
export type P13Format='docx'|'epub'|'pptx';
export interface PublicP13Task{id:string;name:string;shortName:string;description:string;keywords:string[];format:P13Format;category:ToolCategory;mode:'import'|'export'|'inspect'|'edit'}
type Raw=[string,string,string,P13Format,'import'|'export'|'inspect'|'edit'];
const RAW:Raw[]=[
['docx-to-markdown','DOCX → Markdown','docx markdown','docx','import'],
['docx-to-html','DOCX → HTML','docx html','docx','import'],
['docx-to-text','DOCX → Plain Text','docx text','docx','import'],
['markdown-to-docx','Markdown → DOCX','markdown docx','docx','export'],
['text-to-docx','Plain Text → DOCX','text docx','docx','export'],
['docx-metadata-inspector','DOCX Metadata Inspector','docx metadata','docx','inspect'],
['epub-to-markdown','EPUB → Markdown','epub markdown','epub','import'],
['epub-to-html','EPUB → HTML','epub html','epub','import'],
['epub-to-text','EPUB → Plain Text','epub text','epub','import'],
['markdown-to-epub','Markdown → EPUB','markdown epub','epub','export'],
['text-to-epub','Plain Text → EPUB','text epub','epub','export'],
['epub-metadata-editor','EPUB Metadata Editor','epub metadata','epub','edit'],
['pptx-to-text','PPTX → Plain Text','pptx text','pptx','import'],
['pptx-to-markdown','PPTX → Markdown','pptx markdown','pptx','import'],
];
export const PUBLIC_P13_TASKS:PublicP13Task[]=RAW.map(([id,name,key,format,mode])=>({id,name,shortName:name,description:`Local ${name.toLowerCase()} workflow for content-oriented Office/eBook interchange without uploading the source file.`,keywords:[key,...key.split(' ')],format,mode,category:'files'}));
export function getPublicP13Task(id:string|null|undefined){return id?PUBLIC_P13_TASKS.find(t=>t.id===id):undefined}
