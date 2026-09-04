import{lazy}from'react';
import{PUBLIC_P14_TASKS}from'../expansion/publicP14Tasks';
import{registerFamily}from'./register-family';
const DeveloperSecurityCompletionTools=lazy(()=>import('../tools/p14/DeveloperSecurityCompletionTools')),SlugStudio=lazy(()=>import('../tools/s-tier-slug/SlugStudio'));
const INPUT=new Set(PUBLIC_P14_TASKS.map(t=>t.id)),OUTPUT=new Set(PUBLIC_P14_TASKS.map(t=>t.id));
export function registerP14Tools():void{registerFamily(PUBLIC_P14_TASKS,null,null,null,t=>{const slug=t.id==='slug-generator';return{category:t.category,description:slug?'Generate production-ready URL slugs in batches with ASCII folding or Unicode preservation, separator choice, stop-word removal, length limits, and automatic duplicate suffixes.':t.description,keywords:[...t.keywords,'p14',t.engine,...(slug?['batch slug','SEO URL','unique slug','diacritics','unicode slug']:[])],iconName:t.engine==='security'?'ShieldCheck':t.category==='design'?'Search':'Code2',acceptsTextTransfer:INPUT.has(t.id),producesTextTransfer:OUTPUT.has(t.id),component:slug?SlugStudio:DeveloperSecurityCompletionTools}})}
