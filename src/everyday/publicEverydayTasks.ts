import type{ToolCategory}from'../types';
export type EverydayTaskGroup='document'|'planning';
export interface PublicEverydayTask{id:string;name:string;shortName:string;description:string;keywords:string[];group:EverydayTaskGroup;category:ToolCategory;featured?:boolean}
type Raw=[string,string,string,EverydayTaskGroup,ToolCategory,boolean?];
const RAW:Raw[]=[
['invoice-generator','Invoice Generator','invoice maker','document','everyday',true],
['quote-estimate-generator','Quote & Estimate Generator','quotation','document','everyday',true],
['receipt-generator','Simple Receipt Generator','payment receipt','document','everyday',true],
['email-signature-generator','Email Signature Generator','mail signature','document','productivity',true],
['printable-label-maker','Printable Label Maker','address labels','document','productivity'],
['printable-calendar-generator','Printable Calendar Generator','month planner','document','time',true],
['weekly-schedule-builder','Weekly Schedule Builder','timetable','document','time',true],
['resume-builder','Resume Builder','cv maker','document','productivity',true],
['countdown-to-date','Countdown to Date','days until','planning','time',true],
['work-hours-timesheet','Work Hours & Timesheet Calculator','shift hours','planning','time',true],
['week-number-weekday','Week Number & Weekday','iso week','planning','time'],
['time-duration-calculator','Time Duration Calculator','elapsed time','planning','time',true],
['birthday-age-calculator','Birthday & Age Calculator','date of birth','planning','time',true],
];
export const PUBLIC_EVERYDAY_TASKS:PublicEverydayTask[]=RAW.map(([id,name,keyword,group,category,featured])=>({id,name,shortName:name,description:`Local ${name.toLowerCase()}.`,keywords:[keyword],group,category,featured}));
export function getPublicEverydayTask(id:string|null|undefined){return id?PUBLIC_EVERYDAY_TASKS.find(t=>t.id===id):undefined}
