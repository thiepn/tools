import{lazy}from'react';
import{PUBLIC_P17_TASKS}from'../expansion/publicP17Tasks';
import{registerFamily}from'./register-family';
const FileViewerTools=lazy(()=>import('../tools/p17/FileViewerTools'));
export function registerP17Tools():void{registerFamily(PUBLIC_P17_TASKS,null,'FileSearch',FileViewerTools,t=>({category:t.category,keywords:[...t.keywords,'p17','viewer','inspect',t.kind],component:FileViewerTools}))}
