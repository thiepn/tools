import{createElement,lazy,type ComponentType}from'react';
import{STRICT_A_TO_S_TARGET_SET}from'../strict-a-to-s/manifest';
import{TOOLS_REGISTRY}from'./tools';
const MARKER='r17 strict a-to-s core';
export function applyStrictAToSUpgrades():void{for(const tool of TOOLS_REGISTRY){if(!STRICT_A_TO_S_TARGET_SET.has(tool.id)||tool.keywords.includes(MARKER))continue;const Base=tool.component,toolId=tool.id;tool.keywords=[...new Set([...tool.keywords,MARKER])];tool.component=lazy(async()=>{const{StrictARouteWrapper}=await import('../tools/strict-a-to-s/StrictARouteWrapper');const Wrapped:ComponentType<{initialText?:string}>=(props)=>createElement(StrictARouteWrapper,{toolId,Base,initialText:props.initialText});return{default:Wrapped}})}}
