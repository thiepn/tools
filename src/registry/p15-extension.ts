import{lazy}from'react';
import{PUBLIC_P15_TASKS}from'../expansion/publicP15Tasks';
import{registerFamily}from'./register-family';
const MathDataVisualizationTools=lazy(()=>import('../tools/p15/MathDataVisualizationTools'));
export function registerP15Tools():void{registerFamily(PUBLIC_P15_TASKS,null,null,null,t=>({category:t.category,keywords:[...t.keywords,'p15',t.engine,'visualization'],iconName:'Calculator',acceptsTextTransfer:true,producesTextTransfer:true,component:MathDataVisualizationTools}))}
