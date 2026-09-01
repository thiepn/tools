import{lazy}from'react';
import{PUBLIC_P12_TASKS}from'../expansion/publicP12Tasks';
import{registerFamily}from'./register-family';
const DeveloperAuthoringTools=lazy(()=>import('../tools/p12/DeveloperAuthoringTools')),WebAuthoringTools=lazy(()=>import('../tools/p12/WebAuthoringTools'));
const INPUT=new Set(['xml-formatter','url-parser','query-string-tool','semver-comparator','chmod-calculator','json-to-typescript','http-header-parser','mime-type-lookup','unicode-normalizer','dotenv-formatter','html-minifier','html-table-generator']),OUTPUT=new Set(PUBLIC_P12_TASKS.map(t=>t.id));
export function registerP12Tools():void{registerFamily(PUBLIC_P12_TASKS,null,null,null,t=>({category:t.category,keywords:[...t.keywords,'p12',t.engine],iconName:t.category==='design'?'Palette':t.category==='text'?'TextCursorInput':'Code2',acceptsTextTransfer:INPUT.has(t.id),producesTextTransfer:OUTPUT.has(t.id),component:t.engine==='developer'?DeveloperAuthoringTools:WebAuthoringTools}))}
