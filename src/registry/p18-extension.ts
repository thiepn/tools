import{lazy}from'react';
import{PUBLIC_P18_TASKS}from'../expansion/publicP18Tasks';
import{registerFamily}from'./register-family';
const ImageRestorationTools=lazy(()=>import('../tools/p18/ImageRestorationTools'));
export function registerP18Tools():void{registerFamily(PUBLIC_P18_TASKS,'image','Sparkles',ImageRestorationTools,t=>({keywords:[...t.keywords,'p18','image restoration','photo enhancement',t.mode],featured:Boolean(t.featured)}))}
