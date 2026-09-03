import{lazy}from'react';
import{PUBLIC_EVERYDAY_TASKS}from'../everyday/publicEverydayTasks';
import{registerFamily}from'./register-family';
const Docs=lazy(()=>import('../tools/everyday-docs/DocumentGeneratorTools')),Plan=lazy(()=>import('../tools/everyday-docs/PlanningTools')),Week=lazy(()=>import('../tools/s-tier-week/WeekCalendarIntelligence'));
export function registerEverydayTools(){registerFamily(PUBLIC_EVERYDAY_TASKS,null,'FileText',null,t=>{const week=t.id==='week-number-weekday';return{category:t.category,description:week?'Inspect ISO week/year/weekday, week boundaries, day-of-year progress, quarter and leap-year context, or convert an ISO week date back to a calendar date.':t.description,keywords:[...t.keywords,...(week?['ISO week year','week range','day of year','ISO date converter','quarter']:[])],component:week?Week:t.group==='document'?Docs:Plan,featured:week||Boolean(t.featured)}})}
