import{lazy}from'react';
import{PUBLIC_EVERYDAY_TASKS}from'../everyday/publicEverydayTasks';
import{registerFamily}from'./register-family';
const DocumentGeneratorTools=lazy(()=>import('../tools/everyday-docs/DocumentGeneratorTools')),PlanningTools=lazy(()=>import('../tools/everyday-docs/PlanningTools'));
const ICONS:Record<string,string>={'email-signature-generator':'PenTool','printable-label-maker':'Tag','printable-calendar-generator':'CalendarDays','weekly-schedule-builder':'CalendarPlus','countdown-to-date':'Timer','work-hours-timesheet':'Clock','week-number-weekday':'CalendarDays','time-duration-calculator':'Clock','birthday-age-calculator':'CalendarDays'};
export function registerEverydayTools():void{registerFamily(PUBLIC_EVERYDAY_TASKS,null,'FileText',null,t=>({category:t.category,iconName:ICONS[t.id]||'FileText',keywords:[...t.keywords,t.group],producesTextTransfer:t.id==='email-signature-generator',component:t.group==='document'?DocumentGeneratorTools:PlanningTools}))}
