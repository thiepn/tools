import{lazy}from'react';
import type{ToolDefinition}from'../types';
import{PUBLIC_MEDIA_TASKS}from'../media/publicMediaTasks';
import{TOOLS_REGISTRY}from'./tools';
const AudioMicroTools=lazy(()=>import('../tools/audio-micro-tools/AudioMicroTools'));
const VideoMicroTools=lazy(()=>import('../tools/video-micro-tools/VideoMicroTools'));
export function registerMediaMicroTools():void{const known=new Set(TOOLS_REGISTRY.map(t=>t.id));for(const task of PUBLIC_MEDIA_TASKS){if(known.has(task.id))continue;const definition:ToolDefinition={id:task.id,name:task.name,shortName:task.shortName,description:task.description,category:'media',keywords:[...task.keywords,task.engine,'media'],iconName:task.engine==='audio'?'Music':'Film',route:`/${task.id}`,featured:Boolean(task.featured),acceptsTextTransfer:false,producesTextTransfer:false,component:task.engine==='audio'?AudioMicroTools:VideoMicroTools};TOOLS_REGISTRY.push(definition);known.add(task.id);}}
