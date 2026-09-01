import{lazy}from'react';
import{PUBLIC_MEDIA_TASKS}from'../media/publicMediaTasks';
import{registerFamily}from'./register-family';
const AudioMicroTools=lazy(()=>import('../tools/audio-micro-tools/AudioMicroTools')),VideoMicroTools=lazy(()=>import('../tools/video-micro-tools/VideoMicroTools'));
export function registerMediaMicroTools():void{registerFamily(PUBLIC_MEDIA_TASKS,'media',null,null,t=>({keywords:[...t.keywords,t.engine,'media'],iconName:t.engine==='audio'?'Music':'Film',component:t.engine==='audio'?AudioMicroTools:VideoMicroTools}))}
