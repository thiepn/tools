import{lazy}from'react';
import{PUBLIC_P13_TASKS}from'../expansion/publicP13Tasks';
import{registerFamily}from'./register-family';
const OfficeEbookInterchangeTools=lazy(()=>import('../tools/p13/OfficeEbookInterchangeTools')),UnifiedConverters=lazy(()=>import('../tools/converters/UnifiedConverters'));
export function registerP13Tools():void{registerFamily(PUBLIC_P13_TASKS,null,'FileArchive',OfficeEbookInterchangeTools,t=>({category:t.category,keywords:[...t.keywords,'p13','office','ebook',t.format],acceptsTextTransfer:t.id==='document-converter',producesTextTransfer:t.id==='document-converter',component:t.id==='document-converter'?UnifiedConverters:OfficeEbookInterchangeTools}))}
