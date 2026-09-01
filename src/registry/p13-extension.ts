import{lazy}from'react';
import{PUBLIC_P13_TASKS}from'../expansion/publicP13Tasks';
import{registerFamily}from'./register-family';
const OfficeEbookInterchangeTools=lazy(()=>import('../tools/p13/OfficeEbookInterchangeTools'));
const INPUT=new Set(['markdown-to-docx','text-to-docx','markdown-to-epub','text-to-epub']);
const OUTPUT=new Set(['docx-to-markdown','docx-to-html','docx-to-text','epub-to-markdown','epub-to-html','epub-to-text','pptx-to-text','pptx-to-markdown']);
export function registerP13Tools():void{registerFamily(PUBLIC_P13_TASKS,null,'FileArchive',OfficeEbookInterchangeTools,t=>({category:t.category,keywords:[...t.keywords,'p13','office','ebook',t.format],acceptsTextTransfer:INPUT.has(t.id),producesTextTransfer:OUTPUT.has(t.id)}))}
