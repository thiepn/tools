export interface TimeZoneItem { id:string; city:string; country?:string; region:string; }
export interface WallClockParts { year:number; month:number; day:number; hour:number; minute:number; second:number; }
export interface ConvertedTimeRow { zoneId:string; city:string; country?:string; formattedTime:string; formattedDate:string; utcOffset:string; dayDifference:string; isBusinessHours:boolean; isoString:string; }
export interface ZonedDateResolution { date:Date; status:'exact'|'ambiguous'|'nonexistent'; candidates:Date[]; shiftedByMinutes:number; }
export interface MeetingSlot { instant:Date; endInstant:Date; score:number; allBusinessHours:boolean; rows:ConvertedTimeRow[]; }

export const POPULAR_TIMEZONES:TimeZoneItem[]=[
{id:'UTC',city:'UTC',country:'Universal Time',region:'Global'},
{id:'America/New_York',city:'New York',country:'United States',region:'Americas'},
{id:'America/Los_Angeles',city:'Los Angeles',country:'United States',region:'Americas'},
{id:'America/Chicago',city:'Chicago',country:'United States',region:'Americas'},
{id:'America/Toronto',city:'Toronto',country:'Canada',region:'Americas'},
{id:'America/Sao_Paulo',city:'São Paulo',country:'Brazil',region:'Americas'},
{id:'Europe/London',city:'London',country:'United Kingdom',region:'Europe'},
{id:'Europe/Paris',city:'Paris',country:'France',region:'Europe'},
{id:'Europe/Berlin',city:'Berlin',country:'Germany',region:'Europe'},
{id:'Europe/Amsterdam',city:'Amsterdam',country:'Netherlands',region:'Europe'},
{id:'Europe/Zurich',city:'Zurich',country:'Switzerland',region:'Europe'},
{id:'Europe/Madrid',city:'Madrid',country:'Spain',region:'Europe'},
{id:'Europe/Rome',city:'Rome',country:'Italy',region:'Europe'},
{id:'Europe/Athens',city:'Athens',country:'Greece',region:'Europe'},
{id:'Europe/Istanbul',city:'Istanbul',country:'Turkey',region:'Europe'},
{id:'Asia/Dubai',city:'Dubai',country:'United Arab Emirates',region:'Middle East'},
{id:'Asia/Kolkata',city:'Mumbai / New Delhi',country:'India',region:'Asia'},
{id:'Asia/Bangkok',city:'Bangkok',country:'Thailand',region:'Asia'},
{id:'Asia/Singapore',city:'Singapore',country:'Singapore',region:'Asia'},
{id:'Asia/Hong_Kong',city:'Hong Kong',country:'China',region:'Asia'},
{id:'Asia/Shanghai',city:'Shanghai / Beijing',country:'China',region:'Asia'},
{id:'Asia/Tokyo',city:'Tokyo',country:'Japan',region:'Asia'},
{id:'Asia/Seoul',city:'Seoul',country:'South Korea',region:'Asia'},
{id:'Australia/Sydney',city:'Sydney',country:'Australia',region:'Oceania'},
{id:'Australia/Melbourne',city:'Melbourne',country:'Australia',region:'Oceania'},
{id:'Pacific/Auckland',city:'Auckland',country:'New Zealand',region:'Oceania'},
{id:'Pacific/Honolulu',city:'Honolulu',country:'United States',region:'Americas'},
{id:'Africa/Cairo',city:'Cairo',country:'Egypt',region:'Africa'},
{id:'Africa/Johannesburg',city:'Johannesburg',country:'South Africa',region:'Africa'},
];

const partsCache=new Map<string,Intl.DateTimeFormat>();
const displayCache=new Map<string,Intl.DateTimeFormat>();
const supportedZoneCache:{value:TimeZoneItem[]|null}={value:null};
function getPartsFormatter(zoneId:string):Intl.DateTimeFormat{let f=partsCache.get(zoneId);if(!f){f=new Intl.DateTimeFormat('en-CA',{timeZone:zoneId,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});partsCache.set(zoneId,f);}return f;}
export function getWallClockParts(date:Date,zoneId:string):WallClockParts{const map:Record<string,number>={};for(const part of getPartsFormatter(zoneId).formatToParts(date)){if(part.type!=='literal')map[part.type]=Number(part.value);}return{year:map.year,month:map.month,day:map.day,hour:map.hour===24?0:map.hour,minute:map.minute,second:map.second||0};}
function wallClockMillis(parts:WallClockParts):number{return Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second);}
function getOffsetMillis(date:Date,zoneId:string):number{const parts=getWallClockParts(date,zoneId);const instant=Math.floor(date.getTime()/1000)*1000;return wallClockMillis(parts)-instant;}
function sameWallClock(a:WallClockParts,b:WallClockParts):boolean{return a.year===b.year&&a.month===b.month&&a.day===b.day&&a.hour===b.hour&&a.minute===b.minute;}
function candidateOffsets(targetWallMillis:number,zoneId:string):number[]{const offsets=new Set<number>();for(const hours of[-72,-48,-24,-12,0,12,24,48,72])offsets.add(getOffsetMillis(new Date(targetWallMillis+hours*3600_000),zoneId));return[...offsets];}
export function isTimeZoneSupported(zoneId:string):boolean{try{new Intl.DateTimeFormat('en',{timeZone:zoneId}).format(0);return true;}catch{return false;}}
function zoneLabel(zoneId:string):TimeZoneItem{const known=POPULAR_TIMEZONES.find(z=>z.id===zoneId);if(known)return known;const pieces=zoneId.split('/');const city=(pieces.at(-1)||zoneId).replace(/_/g,' ');const region=pieces.length>1?pieces[0]:'Global';return{id:zoneId,city,region};}
/** Full native IANA catalog where Intl.supportedValuesOf is available, with a deterministic fallback. */
export function getSupportedTimeZones():TimeZoneItem[]{if(supportedZoneCache.value)return supportedZoneCache.value.map(z=>({...z}));const intl=Intl as unknown as{supportedValuesOf?:(key:string)=>string[]};let ids:string[]=[];try{ids=intl.supportedValuesOf?.('timeZone')||[];}catch{}const unique=new Set<string>(['UTC',...POPULAR_TIMEZONES.map(z=>z.id),...ids]);supportedZoneCache.value=[...unique].filter(isTimeZoneSupported).map(zoneLabel).sort((a,b)=>a.region.localeCompare(b.region)||a.city.localeCompare(b.city)||a.id.localeCompare(b.id));return supportedZoneCache.value.map(z=>({...z}));}
export function getZonedNowFields(zoneId:string,now=new Date()):{date:string;hour:number;minute:number}{const p=getWallClockParts(now,zoneId);return{date:`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`,hour:p.hour,minute:p.minute};}

export function resolveDateInZone(year:number,month:number,day:number,hours:number,minutes:number,sourceZoneId:string):ZonedDateResolution{
 if(!isTimeZoneSupported(sourceZoneId))throw new Error(`Unsupported time zone: ${sourceZoneId}`);
 const desired:WallClockParts={year,month,day,hour:hours,minute:minutes,second:0};const desiredMillis=wallClockMillis(desired);const offsets=candidateOffsets(desiredMillis,sourceZoneId);
 const exact=offsets.map(offset=>new Date(desiredMillis-offset)).filter(candidate=>sameWallClock(getWallClockParts(candidate,sourceZoneId),desired)).sort((a,b)=>a.getTime()-b.getTime()).filter((candidate,index,array)=>index===0||candidate.getTime()!==array[index-1].getTime());
 if(exact.length)return{date:exact[0],status:exact.length>1?'ambiguous':'exact',candidates:exact,shiftedByMinutes:0};
 const shifted=offsets.map(offset=>{const date=new Date(desiredMillis-offset);const displayed=wallClockMillis(getWallClockParts(date,sourceZoneId));return{date,diffMinutes:Math.round((displayed-desiredMillis)/60_000)};}).filter(entry=>entry.diffMinutes>0).sort((a,b)=>a.diffMinutes-b.diffMinutes||a.date.getTime()-b.date.getTime());
 const fallback=shifted[0]||{date:new Date(desiredMillis-(offsets[0]||0)),diffMinutes:0};return{date:fallback.date,status:'nonexistent',candidates:[],shiftedByMinutes:fallback.diffMinutes};
}
export function createDateInZone(year:number,month:number,day:number,hours:number,minutes:number,sourceZoneId:string):Date{return resolveDateInZone(year,month,day,hours,minutes,sourceZoneId).date;}
function dayNumber(parts:Pick<WallClockParts,'year'|'month'|'day'>):number{return Math.floor(Date.UTC(parts.year,parts.month-1,parts.day)/86_400_000);}
export function formatZoneTime(utcDate:Date,targetZoneId:string,referenceDate:Date,is24Hour:boolean,referenceZoneId='UTC'):ConvertedTimeRow{
 const key=`${targetZoneId}:${is24Hour?'24':'12'}`;let timeFormatter=displayCache.get(key);if(!timeFormatter){timeFormatter=new Intl.DateTimeFormat('en-US',{timeZone:targetZoneId,hour:'numeric',minute:'2-digit',hour12:!is24Hour});displayCache.set(key,timeFormatter);}const dateFormatter=new Intl.DateTimeFormat('en-US',{timeZone:targetZoneId,weekday:'short',month:'short',day:'numeric'});const offsetFormatter=new Intl.DateTimeFormat('en-US',{timeZone:targetZoneId,timeZoneName:'shortOffset'});const offsetPart=offsetFormatter.formatToParts(utcDate).find(part=>part.type==='timeZoneName')?.value||'UTC';const parts=getWallClockParts(utcDate,targetZoneId);const refParts=getWallClockParts(referenceDate,referenceZoneId);const diff=dayNumber(parts)-dayNumber(refParts);const dayDifference=diff===0?'Same day':diff>0?`+${diff} day${diff===1?'':'s'}`:`${diff} day${diff===-1?'':'s'}`;const found=zoneLabel(targetZoneId);return{zoneId:targetZoneId,city:found.city,country:found.country,formattedTime:timeFormatter.format(utcDate),formattedDate:dateFormatter.format(utcDate),utcOffset:offsetPart,dayDifference,isBusinessHours:parts.hour>=9&&parts.hour<18,isoString:utcDate.toISOString()};
}
export function findBestMeetingSlots(startInstant:Date,zones:string[],options:{durationMinutes?:number;stepMinutes?:number;horizonHours?:number;businessStart?:number;businessEnd?:number;limit?:number;is24Hour?:boolean}={}):MeetingSlot[]{
 const unique=[...new Set(zones.filter(isTimeZoneSupported))];if(!unique.length)return[];const duration=Math.max(15,Math.min(480,options.durationMinutes??60));const step=Math.max(15,Math.min(180,options.stepMinutes??30));const horizon=Math.max(1,Math.min(168,options.horizonHours??24));const businessStart=Math.max(0,Math.min(23,options.businessStart??9));const businessEnd=Math.max(businessStart+1,Math.min(24,options.businessEnd??18));const slots:MeetingSlot[]=[];
 for(let offset=0;offset<=horizon*60-duration;offset+=step){const instant=new Date(startInstant.getTime()+offset*60_000);const endInstant=new Date(instant.getTime()+duration*60_000);let score=0;let allBusiness=true;for(const zone of unique){const start=getWallClockParts(instant,zone);const end=getWallClockParts(new Date(endInstant.getTime()-1),zone);const inBusiness=start.hour>=businessStart&&end.hour<businessEnd&&dayNumber(start)===dayNumber(end);if(!inBusiness)allBusiness=false;const center=start.hour+start.minute/60+duration/120;const target=(businessStart+businessEnd)/2;score+=Math.abs(center-target)+(inBusiness?0:12);}const rows=unique.map(zone=>formatZoneTime(instant,zone,instant,options.is24Hour??true,unique[0]));slots.push({instant,endInstant,score:Number(score.toFixed(3)),allBusinessHours:allBusiness,rows});}
 return slots.sort((a,b)=>Number(b.allBusinessHours)-Number(a.allBusinessHours)||a.score-b.score||a.instant.getTime()-b.instant.getTime()).slice(0,Math.max(1,Math.min(12,options.limit??5)));
}
export function generateComparisonSummary(rows:ConvertedTimeRow[]):string{return rows.map(row=>`${row.city.padEnd(20)} ${row.formattedDate.padEnd(14)} ${row.formattedTime.padEnd(10)} (${row.utcOffset}) ${row.dayDifference!=='Same day'?`[${row.dayDifference}]`:''}`.trim()).join('\n');}
