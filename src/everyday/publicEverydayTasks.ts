import type{ToolCategory}from'../types';
export type EverydayTaskGroup='document'|'planning';
export interface PublicEverydayTask{id:string;name:string;shortName:string;description:string;keywords:string[];group:EverydayTaskGroup;category:ToolCategory;featured?:boolean}
type Raw=[string,string,string,string,EverydayTaskGroup,ToolCategory,string?,boolean?];
const RAW:Raw[]=[
['invoice-generator','Invoice Generator','Create, total, and print a simple invoice locally.','invoice|bill|invoice maker|invoice template','document','everyday','Invoice',true],
['quote-estimate-generator','Quote & Estimate Generator','Create a printable quote or estimate with item totals.','quote|estimate|quotation|price estimate','document','everyday','Quote & Estimate',true],
['receipt-generator','Simple Receipt Generator','Create a printable generic receipt from local entries.','receipt|receipt maker|payment receipt|sales receipt','document','everyday','Receipt',true],
['email-signature-generator','Email Signature Generator','Build a clean HTML and plain-text email signature locally.','email signature|signature html|mail signature|contact signature','document','productivity','Email Signature',true],
['printable-label-maker','Printable Label Maker','Lay out text labels in a printable multi-column sheet.','label maker|print labels|address labels|name labels','document','productivity','Label Maker'],
['printable-calendar-generator','Printable Calendar Generator','Create a clean monthly calendar for printing or PDF saving.','printable calendar|monthly calendar|calendar maker|month planner','document','time','Printable Calendar',true],
['weekly-schedule-builder','Weekly Schedule Builder','Build and print a simple weekly timetable from local entries.','weekly schedule|timetable|schedule builder|weekly planner','document','time','Weekly Schedule',true],
['resume-builder','Resume Builder','Create a simple printable resume from structured local fields.','resume builder|cv maker|resume template|curriculum vitae','document','productivity','Resume Builder',true],
['countdown-to-date','Countdown to Date','See the exact remaining days, hours, minutes, and seconds.','countdown|days until|time until|countdown date','planning','time','Countdown',true],
['work-hours-timesheet','Work Hours & Timesheet Calculator','Total work shifts and subtract unpaid break minutes.','work hours|timesheet|shift hours|hours worked','planning','time','Work Hours',true],
['week-number-weekday','Week Number & Weekday','Find ISO week number, weekday, and day of year for a date.','week number|iso week|weekday|day of year','planning','time','Week Number'],
['time-duration-calculator','Time Duration Calculator','Calculate elapsed time between two date-times.','time duration|elapsed time|hours between|date time difference','planning','time','Time Duration',true],
['birthday-age-calculator','Birthday & Age Calculator','Calculate calendar age and total elapsed days to a chosen date.','age calculator|birthday calculator|how old|date of birth','planning','time','Age Calculator',true],
];
export const PUBLIC_EVERYDAY_TASKS:PublicEverydayTask[]=RAW.map(([id,name,description,keys,group,category,shortName,featured])=>({id,name,shortName:shortName||name,description,keywords:keys.split('|'),group,category,featured}));
export function getPublicEverydayTask(id:string|null|undefined){return id?PUBLIC_EVERYDAY_TASKS.find(t=>t.id===id):undefined}
