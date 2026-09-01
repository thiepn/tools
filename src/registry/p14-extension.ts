import{lazy}from'react';
import{PUBLIC_P14_TASKS}from'../expansion/publicP14Tasks';
import{registerFamily}from'./register-family';
const DeveloperSecurityCompletionTools=lazy(()=>import('../tools/p14/DeveloperSecurityCompletionTools'));
const INPUT=new Set(PUBLIC_P14_TASKS.map(t=>t.id)),OUTPUT=new Set(PUBLIC_P14_TASKS.map(t=>t.id));
export function registerP14Tools():void{registerFamily(PUBLIC_P14_TASKS,null,null,null,t=>({category:t.category,keywords:[...t.keywords,'p14',t.engine],iconName:t.engine==='security'?'ShieldCheck':t.category==='design'?'Search':'Code2',acceptsTextTransfer:INPUT.has(t.id),producesTextTransfer:OUTPUT.has(t.id),component:DeveloperSecurityCompletionTools}))}
