export type SlugSeparator='-'|'_'|'.';
export interface SlugOptions{separator:SlugSeparator;lowercase:boolean;unicode:boolean;removeStopWords:boolean;maxLength:number;trimBoundary:boolean;}
const STOP_WORDS=new Set('a an and are as at be but by for from has have in into is it of on or that the this to was were will with your you'.split(' '));
function asciiFold(input:string){return input.normalize('NFKD').replace(/\p{M}/gu,'').replace(/ß/g,'ss').replace(/æ/gi,m=>m===m.toUpperCase()?'AE':'ae').replace(/œ/gi,m=>m===m.toUpperCase()?'OE':'oe');}
function cleanPart(part:string,options:SlugOptions){let value=options.unicode?part.normalize('NFKC'):asciiFold(part);if(options.lowercase)value=value.toLocaleLowerCase();const allowed=options.unicode?/[^\p{L}\p{N}]+/gu:/[^a-zA-Z0-9]+/g;return value.replace(allowed,' ').trim().split(/\s+/).filter(Boolean).filter(word=>!options.removeStopWords||!STOP_WORDS.has(word.toLocaleLowerCase()));}
const cpLength=(value:string)=>Array.from(value).length;
const cpSlice=(value:string,max:number)=>Array.from(value).slice(0,Math.max(0,max)).join('');
function trimSeparator(value:string,separator:SlugSeparator){while(value.startsWith(separator))value=value.slice(separator.length);while(value.endsWith(separator))value=value.slice(0,-separator.length);return value;}
export function slugifyAdvanced(input:string,options:SlugOptions):string{
 const max=Math.max(1,Math.min(300,Math.floor(options.maxLength||300)));const words=cleanPart(input,options);let slug=words.join(options.separator);
 if(cpLength(slug)>max){const cut=cpSlice(slug,max);const boundary=cut.lastIndexOf(options.separator);slug=boundary>=Math.floor(max*.55)?cut.slice(0,boundary):cut;}
 if(options.trimBoundary!==false)slug=trimSeparator(slug,options.separator);
 return slug;
}
export function uniqueSlugs(lines:string[],options:SlugOptions){const max=Math.max(1,Math.min(300,Math.floor(options.maxLength||300)));const counts=new Map<string,number>();return lines.map(source=>{const base=slugifyAdvanced(source,{...options,maxLength:max})||'item';const seen=(counts.get(base)??0)+1;counts.set(base,seen);let slug=base;if(seen>1){const suffix=`${options.separator}${seen}`,room=Math.max(1,max-cpLength(suffix));slug=cpLength(base)+cpLength(suffix)<=max?base+suffix:trimSeparator(cpSlice(base,room),options.separator)+suffix;}return{source,slug,duplicateIndex:seen};});}
export function slugQuality(slug:string){const words=slug.split(/[-_.]+/).filter(Boolean);return{length:cpLength(slug),words:words.length,hasUppercase:/[A-Z]/.test(slug),hasNonAscii:/[^\x00-\x7f]/.test(slug),empty:slug.length===0};}
