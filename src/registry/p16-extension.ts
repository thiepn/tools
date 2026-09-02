import{lazy}from'react';
import{PUBLIC_P16_TASKS}from'../expansion/publicP16Tasks';
import{registerFamily}from'./register-family';
const SubtitleMediaCompletionTools=lazy(()=>import('../tools/p16/SubtitleMediaCompletionTools')),UnifiedConverters=lazy(()=>import('../tools/converters/UnifiedConverters'));
export function registerP16Tools():void{registerFamily(PUBLIC_P16_TASKS,null,null,null,t=>({category:t.category,keywords:[...t.keywords,'p16',t.engine,'subtitle','captions'],iconName:'Film',acceptsTextTransfer:true,producesTextTransfer:true,component:t.id==='subtitle-converter'?UnifiedConverters:SubtitleMediaCompletionTools}))}
