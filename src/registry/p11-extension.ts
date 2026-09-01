import{lazy}from'react';
import{PUBLIC_P11_TASKS}from'../expansion/publicP11Tasks';
import{registerFamily}from'./register-family';
const DeveloperExpansionTools=lazy(()=>import('../tools/p11/DeveloperExpansionTools')),MathExpansionTools=lazy(()=>import('../tools/p11/MathExpansionTools')),WebExpansionTools=lazy(()=>import('../tools/p11/WebExpansionTools'));
export function registerP11Tools():void{registerFamily(PUBLIC_P11_TASKS,null,null,null,t=>({category:t.category,keywords:t.keywords,iconName:t.category==='files'?'Files':t.engine==='math'?'Percent':t.category==='design'?'Palette':t.engine==='web'?'Globe':'Code2',acceptsTextTransfer:false,producesTextTransfer:false,component:t.engine==='developer'?DeveloperExpansionTools:t.engine==='math'?MathExpansionTools:WebExpansionTools}))}
