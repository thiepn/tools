import React,{useEffect,useState,type ComponentType}from'react';
import{createPortal}from'react-dom';
import{StrictDeviceAddon}from'./StrictDeviceAddon';
import{StrictCalculatorAddon}from'./StrictCalculatorAddon';
import{StrictArchiveAddon}from'./StrictArchiveAddon';
import{StrictMediaAddon}from'./StrictMediaAddon';
import{StrictTextPlanningAddon}from'./StrictTextPlanningAddon';
import{StrictP20Addon}from'./StrictP20Addon';

interface Props{toolId:string;Base:ComponentType<{initialText?:string}>;initialText?:string}
export function StrictSTierRouteWrapper({toolId,Base,initialText}:Props){const[target,setTarget]=useState<HTMLElement|null>(null);useEffect(()=>{let cancelled=false,observer:MutationObserver|null=null;const find=()=>{if(cancelled)return true;const shell=document.querySelector<HTMLElement>(`[data-tool-id="${CSS.escape(toolId)}"]`),next=shell?.querySelector<HTMLElement>('.tt-tool-content')??null;if(!next)return false;setTarget(next);return true};if(!find()){observer=new MutationObserver(()=>{if(find())observer?.disconnect()});observer.observe(document.body,{childList:true,subtree:true})}return()=>{cancelled=true;observer?.disconnect();setTarget(null)}},[toolId]);return<><Base initialText={initialText}/>{target?createPortal(<><StrictDeviceAddon toolId={toolId}/><StrictCalculatorAddon toolId={toolId}/><StrictArchiveAddon toolId={toolId}/><StrictMediaAddon toolId={toolId}/><StrictTextPlanningAddon toolId={toolId}/><StrictP20Addon toolId={toolId}/></>,target):null}</>}
export default StrictSTierRouteWrapper;
