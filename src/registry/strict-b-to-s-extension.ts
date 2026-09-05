import{createElement,lazy,type ComponentType}from'react';
import{STRICT_B_TO_S_TARGET_SET}from'../strict-b-to-s/manifest';
import{getStrictBProfile}from'../strict-b-to-s/profiles';
import{TOOLS_REGISTRY}from'./tools';
const MARKER='r16 specialist core';
export function applyStrictBToSUpgrades():void{for(const tool of TOOLS_REGISTRY){if(!STRICT_B_TO_S_TARGET_SET.has(tool.id)||tool.keywords.includes(MARKER))continue;const profile=getStrictBProfile(tool.id);if(!profile)continue;const Base=tool.component,toolId=tool.id;tool.description=`${tool.description.replace(/\s+$/,'')} Adds a route-specific ${profile.label} with explicit assumptions, intermediate evidence and exportable specialist results.`;tool.keywords=[...new Set([...tool.keywords,MARKER,profile.label,'route specific analysis','precision evidence'])];tool.component=lazy(async()=>{const{StrictBRouteWrapper}=await import('../tools/strict-b-to-s/StrictBRouteWrapper');const Wrapped:ComponentType<{initialText?:string}>=(props)=>createElement(StrictBRouteWrapper,{toolId,Base,initialText:props.initialText});return{default:Wrapped}})}}
