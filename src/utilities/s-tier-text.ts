export type ReverseMode='graphemes'|'words'|'words-per-line'|'lines';
export type WrapMode='soft'|'hard';
export type LoremUnit='paragraphs'|'sentences'|'words';

const WORD_BANK=('adipiscing aliquam amet arcu auctor augue blandit commodo condimentum consectetur consequat convallis cursus dignissim dolor donec dui efficitur eleifend elit enim erat eros est etiam facilisis faucibus felis fermentum finibus fringilla fusce gravida hendrerit ipsum justo lacus laoreet lectus libero ligula lorem luctus magna mauris metus molestie mollis neque nibh nisl nulla odio orci ornare pellentesque pharetra porta porttitor posuere praesent pretium purus quam quis risus rutrum sagittis sapien scelerisque sed semper sit sollicitudin suscipit tellus tempus tincidunt tristique turpis ullamcorper urna varius vehicula velit venenatis vestibulum vitae vivamus volutpat').split(' ');

export function graphemes(input:string):string[]{
  const Segmenter=(Intl as unknown as{Segmenter?:new(locale?:string,options?:{granularity:string})=>{segment:(value:string)=>Iterable<{segment:string}>}}).Segmenter;
  if(Segmenter){const segmenter=new Segmenter(undefined,{granularity:'grapheme'});return[...segmenter.segment(input)].map(item=>item.segment);}
  return Array.from(input);
}

export function reverseText(input:string,mode:ReverseMode):string{
  if(mode==='graphemes')return graphemes(input).reverse().join('');
  if(mode==='lines')return input.split(/\r?\n/).reverse().join('\n');
  if(mode==='words-per-line')return input.split(/\r?\n/).map(line=>reverseWords(line)).join('\n');
  return reverseWords(input);
}

function reverseWords(input:string):string{
  const tokens=input.split(/(\s+)/);const words=tokens.filter(token=>!/^\s+$/.test(token)).reverse();let index=0;
  return tokens.map(token=>/^\s+$/.test(token)?token:words[index++]??'').join('');
}

export function isGraphemePalindrome(input:string,ignoreCase=true,ignoreNonAlphanumeric=true):boolean{
  let value=input.normalize('NFKC');
  if(ignoreCase)value=value.toLocaleLowerCase();
  const units=graphemes(value).filter(g=>!ignoreNonAlphanumeric||/[\p{L}\p{N}]/u.test(g));
  return units.length>0&&units.every((g,i)=>g===units[units.length-1-i]);
}

export interface RepeatOptions{count:number;separator:string;prefix?:string;suffix?:string;numberLines?:boolean;startNumber?:number;}
export function repeatText(input:string,options:RepeatOptions):string{
  const count=Math.max(0,Math.min(10000,Math.floor(Number.isFinite(options.count)?options.count:0)));
  if(input.length*count>2_000_000)throw new Error('Result would exceed the 2,000,000-character safety limit. Reduce repeats or input size.');
  const start=Math.floor(options.startNumber??1);
  return Array.from({length:count},(_,i)=>`${options.prefix??''}${options.numberLines?`${start+i}. `:''}${input}${options.suffix??''}`).join(options.separator);
}

export interface WrapOptions{width:number;mode:WrapMode;firstIndent?:string;restIndent?:string;preserveParagraphs?:boolean;trimLines?:boolean;}
export function wrapText(input:string,options:WrapOptions):string{
  const width=Math.max(1,Math.min(500,Math.floor(options.width)));
  const first=options.firstIndent??'',rest=options.restIndent??'';
  const paragraphs=(options.preserveParagraphs??true)?input.replace(/\r/g,'').split(/\n\s*\n/):[input.replace(/\r/g,'').replace(/\n+/g,' ')];
  return paragraphs.map(paragraph=>{
    const normalized=options.trimLines===false?paragraph.replace(/\n/g,' '):paragraph.split('\n').map(line=>line.trim()).join(' ');
    return options.mode==='hard'?hardWrap(normalized,width,first,rest):softWrap(normalized,width,first,rest);
  }).join('\n\n');
}
function hardWrap(text:string,width:number,first:string,rest:string){const out:string[]=[];let remaining=text;let indent=first;while(remaining.length){const available=Math.max(1,width-graphemes(indent).length);const units=graphemes(remaining);out.push(indent+units.slice(0,available).join(''));remaining=units.slice(available).join('');indent=rest;}return out.join('\n');}
function softWrap(text:string,width:number,first:string,rest:string){const words=text.trim().split(/\s+/).filter(Boolean);if(!words.length)return first;const lines:string[]=[];let indent=first,current=indent;for(const word of words){const candidate=current===indent?indent+word:`${current} ${word}`;if(graphemes(candidate).length<=width||current===indent){current=candidate;}else{lines.push(current);indent=rest;current=indent+word;}}if(current!==indent)lines.push(current);return lines.join('\n');}

function hashSeed(seed:string):number{let h=2166136261;for(const ch of seed){h^=ch.codePointAt(0)??0;h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(seed:number){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function pick<T>(rng:()=>number,values:T[]):T{return values[Math.floor(rng()*values.length)]!;}
function sentence(rng:()=>number,minWords:number,maxWords:number){const count=minWords+Math.floor(rng()*(maxWords-minWords+1));const words=Array.from({length:count},()=>pick(rng,WORD_BANK));const text=words.join(' ');return text.charAt(0).toUpperCase()+text.slice(1)+pick(rng,['.','.','.','?',';']);}

export interface LoremOptions{unit:LoremUnit;count:number;seed:string;minSentenceWords:number;maxSentenceWords:number;sentencesPerParagraph:number;startClassic:boolean;}
export function generateLorem(options:LoremOptions):string{
  const count=Math.max(1,Math.min(500,Math.floor(options.count)));
  const min=Math.max(3,Math.min(30,Math.floor(options.minSentenceWords)));
  const max=Math.max(min,Math.min(60,Math.floor(options.maxSentenceWords)));
  const per=Math.max(1,Math.min(20,Math.floor(options.sentencesPerParagraph)));
  const rng=mulberry32(hashSeed(options.seed||'tiny-tools'));
  let output='';
  if(options.unit==='words')output=Array.from({length:count},()=>pick(rng,WORD_BANK)).join(' ')+'.';
  else if(options.unit==='sentences')output=Array.from({length:count},()=>sentence(rng,min,max)).join(' ');
  else output=Array.from({length:count},()=>Array.from({length:per},()=>sentence(rng,min,max)).join(' ')).join('\n\n');
  if(options.startClassic){const classic='Lorem ipsum dolor sit amet, consectetur adipiscing elit.';if(options.unit==='words'){const words=output.split(/\s+/);const prefix=classic.replace(/[,.]/g,'').split(/\s+/);output=[...prefix,...words.slice(prefix.length)].slice(0,count).join(' ')+'.';}else output=classic+(output?` ${output}`:'');}
  if(output.length>2_000_000)throw new Error('Generated result exceeds the 2,000,000-character safety limit.');
  return output;
}

export function textMetrics(input:string){const lines=input?input.split(/\r?\n/).length:0;const words=input.trim()?input.trim().split(/\s+/).length:0;return{characters:[...input].length,graphemes:graphemes(input).length,words,lines};}
