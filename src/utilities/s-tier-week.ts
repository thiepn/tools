export interface WeekCalendarInfo{
  dateKey:string;
  isoYear:number;
  isoWeek:number;
  isoWeekday:number;
  isoWeekCode:string;
  weekdayName:string;
  dayOfYear:number;
  daysInYear:number;
  daysElapsed:number;
  daysRemaining:number;
  quarter:number;
  weekStart:string;
  weekEnd:string;
  leapYear:boolean;
}

function parseDateKey(key:string):Date{
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(key);if(!m)throw new Error('Use a date in YYYY-MM-DD format.');
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);const date=new Date(Date.UTC(y,mo-1,d));
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d)throw new Error('That calendar date does not exist.');return date;
}
function key(date:Date){return date.toISOString().slice(0,10)}
export function isLeapYear(year:number){return year%4===0&&(year%100!==0||year%400===0)}
export function isoWeekFromDate(date:Date){const target=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));const isoWeekday=target.getUTCDay()||7;target.setUTCDate(target.getUTCDate()+4-isoWeekday);const isoYear=target.getUTCFullYear();const yearStart=new Date(Date.UTC(isoYear,0,1));const isoWeek=Math.ceil((((target.getTime()-yearStart.getTime())/86400000)+1)/7);return{isoYear,isoWeek,isoWeekday};}
export function dateFromIsoWeek(isoYear:number,isoWeek:number,isoWeekday:number):string{
  if(!Number.isInteger(isoYear)||isoYear<1||isoYear>9999)throw new Error('ISO year must be from 1 to 9999.');if(!Number.isInteger(isoWeek)||isoWeek<1||isoWeek>53)throw new Error('ISO week must be 1–53.');if(!Number.isInteger(isoWeekday)||isoWeekday<1||isoWeekday>7)throw new Error('ISO weekday must be 1–7.');
  const jan4=new Date(Date.UTC(isoYear,0,4));const jan4Weekday=jan4.getUTCDay()||7;const monday=new Date(jan4);monday.setUTCDate(jan4.getUTCDate()-(jan4Weekday-1)+(isoWeek-1)*7);const date=new Date(monday);date.setUTCDate(monday.getUTCDate()+isoWeekday-1);const check=isoWeekFromDate(date);if(check.isoYear!==isoYear||check.isoWeek!==isoWeek)throw new Error(`ISO year ${isoYear} does not contain week ${isoWeek}.`);return key(date);
}
export function weekCalendarInfo(dateKey:string,locale?:string):WeekCalendarInfo{
  const date=parseDateKey(dateKey);const {isoYear,isoWeek,isoWeekday}=isoWeekFromDate(date);const year=date.getUTCFullYear();const start=new Date(Date.UTC(year,0,1));const dayOfYear=Math.floor((date.getTime()-start.getTime())/86400000)+1;const daysInYear=isLeapYear(year)?366:365;const monday=new Date(date);monday.setUTCDate(date.getUTCDate()-(isoWeekday-1));const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6);
  return{dateKey:key(date),isoYear,isoWeek,isoWeekday,isoWeekCode:`${isoYear}-W${String(isoWeek).padStart(2,'0')}-${isoWeekday}`,weekdayName:new Intl.DateTimeFormat(locale,{weekday:'long',timeZone:'UTC'}).format(date),dayOfYear,daysInYear,daysElapsed:dayOfYear,daysRemaining:daysInYear-dayOfYear,quarter:Math.floor(date.getUTCMonth()/3)+1,weekStart:key(monday),weekEnd:key(sunday),leapYear:isLeapYear(year)};
}
export function weekDates(isoYear:number,isoWeek:number){return Array.from({length:7},(_,index)=>dateFromIsoWeek(isoYear,isoWeek,index+1));}
export function isoWeeksInYear(year:number){return isoWeekFromDate(new Date(Date.UTC(year,11,28))).isoWeek;}
