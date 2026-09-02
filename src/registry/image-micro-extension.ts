import{lazy}from'react';
import{PUBLIC_IMAGE_TASKS}from'../image/publicImageTasks';
import{registerFamily}from'./register-family';
const ImageMicroTools=lazy(()=>import('../tools/image-micro-tools/ImageMicroTools')),UnifiedConverters=lazy(()=>import('../tools/converters/UnifiedConverters'));
export function registerImageMicroTools():void{registerFamily(PUBLIC_IMAGE_TASKS,'image','Image',ImageMicroTools,t=>({keywords:[...t.keywords,'image','photo'],component:t.id==='image-converter'?UnifiedConverters:ImageMicroTools}))}
