import{lazy}from'react';
import{PUBLIC_EVERYDAY_TASKS}from'../everyday/publicEverydayTasks';
import{registerFamily}from'./register-family';
const Docs=lazy(()=>import('../tools/everyday-docs/DocumentGeneratorTools')),Plan=lazy(()=>import('../tools/everyday-docs/PlanningTools'));
export function registerEverydayTools(){registerFamily(PUBLIC_EVERYDAY_TASKS,null,'FileText',null,t=>({category:t.category,component:t.group==='document'?Docs:Plan}))}
