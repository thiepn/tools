import type{ToolCategory}from'../types';
export type EverydayTaskGroup='document'|'planning';
export interface PublicEverydayTask{id:string;name:string;shortName:string;description:string;keywords:string[];group:EverydayTaskGroup;category:ToolCategory;featured?:boolean}
type Raw=[string,string,string,string,EverydayTaskGroup,ToolCategory,string?,boolean?];
const RAW:Raw[]=[
['invoice-generator','Invoice Generator','Make and print a local invoice.','invoice maker|bill','document','everyday','Invoice',true],
['quote-estimate-generator','Quote & Estimate Generator','Make and print a quote or estimate.','quote|estimate','document','everyday','Quote & Estimate',true],
['receipt-generator','Simple Receipt Generator','Make and print a generic receipt.','receipt maker|payment receipt','document','everyday','Receipt',true],
['email-signature-generator','Email Signature Generator','Build HTML and text email signatures.','email signature|mail signature','document','productivity','Email Signature',true],
['printable-label-maker','Printable Label Maker','Arrange printable text labels.','label maker|print labels','document','productivity','Label Maker'],
['printable-calendar-generator','Printable Calendar Generator','Make a printable monthly calendar.','printable calendar|month planner','document','time','Printable Calendar',true],
['weekly-schedule-builder','Weekly Schedule Builder','Make a printable weekly schedule.','weekly schedule|timetable','document','time','Weekly Schedule',true],
['resume-builder','Resume Builder','Make a simple printable resume.','resume builder|cv maker','document','productivity','Resume Builder',true],
['countdown-to-date','Countdown to Date','Count down to a date and time.','countdown|days until','planning','time','Countdown',true],
['work-hours-timesheet','Work Hours & Timesheet Calculator','Total shifts after unpaid breaks.','work hours|timesheet','planning','time','Work Hours',true],
['week-number-weekday','Week Number & Weekday','Find ISO week and weekday.','week number|iso week','planning','time','Week Number'],
['time-duration-calculator','Time Duration Calculator','Find time between two date-times.','time duration|elapsed time','planning','time','Time Duration',true],
['birthday-age-calculator','Birthday & Age Calculator','Find age on a chosen date.','age calculator|birthday calculator','planning','time','Age Calculator',true],
];
export const PUBLIC_EVERYDAY_TASKS:PublicEverydayTask[]=RAW.map(([id,name,description,keys,group,category,shortName,featured])=>({id,name,shortName:shortName||name,description,keywords:keys.split('|'),group,category,featured}));
export function getPublicEverydayTask(id:string|null|undefined){return id?PUBLIC_EVERYDAY_TASKS.find(t=>t.id===id):undefined}
