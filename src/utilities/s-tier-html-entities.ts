export type HtmlEntityEncoding='named'|'decimal'|'hex';
export type HtmlEntityScope='special'|'non-ascii'|'all';

const NAMED_BY_CHAR=new Map<string,string>([
 ['&','amp'],['<','lt'],['>','gt'],['"','quot'],["'",'apos'],['\u00a0','nbsp'],['©','copy'],['®','reg'],['™','trade'],['€','euro'],['£','pound'],['¥','yen'],['¢','cent'],['§','sect'],['¶','para'],['–','ndash'],['—','mdash'],['‘','lsquo'],['’','rsquo'],['“','ldquo'],['”','rdquo'],['…','hellip'],['·','middot'],['×','times'],['÷','divide'],
]);
const CHAR_BY_NAMED=new Map([...NAMED_BY_CHAR].map(([char,name])=>[name,char]));

export interface HtmlEntityOptions{encoding:HtmlEntityEncoding;scope:HtmlEntityScope;preserveExisting?:boolean;}
function shouldEncode(char:string,scope:HtmlEntityScope){const cp=char.codePointAt(0)??0;if(scope==='all')return char!=='\n'&&char!=='\r'&&char!=='\t'&&char!==' ';if(scope==='non-ascii')return cp>127||'&<>"\''.includes(char);return'&<>"\''.includes(char);}
function entityFor(char:string,encoding:HtmlEntityEncoding){const cp=char.codePointAt(0)??0;if(encoding==='named'){const named=NAMED_BY_CHAR.get(char);if(named)return`&${named};`;}
 return encoding==='hex'?`&#x${cp.toString(16).toUpperCase()};`:`&#${cp};`;}

export function encodeHtmlEntities(input:string,options:HtmlEntityOptions):string{
 const preserve=options.preserveExisting!==false;const existing=/^&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i;let out='';
 for(let i=0;i<input.length;){const rest=input.slice(i);if(preserve&&rest.startsWith('&')){const match=rest.match(existing);if(match){out+=match[0];i+=match[0].length;continue;}}
  const cp=input.codePointAt(i);if(cp==null)break;const char=String.fromCodePoint(cp);out+=shouldEncode(char,options.scope)?entityFor(char,options.encoding):char;i+=char.length;
 }
 return out;
}

export function decodeHtmlEntitiesBasic(input:string):string{
 return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,(full,body:string)=>{
  if(body[0]==='#'){const hex=body[1]?.toLowerCase()==='x';const raw=body.slice(hex?2:1);const cp=Number.parseInt(raw,hex?16:10);return Number.isInteger(cp)&&cp>=0&&cp<=0x10ffff?String.fromCodePoint(cp):full;}
  return CHAR_BY_NAMED.get(body.toLowerCase())??full;
 });
}

export function entityStats(input:string){const matches:string[]=input.match(/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi)??[];return{entities:matches.length,named:matches.filter(x=>!x.startsWith('&#')).length,numeric:matches.filter(x=>x.startsWith('&#')).length,unique:new Set(matches.map(x=>x.toLowerCase())).size};}

export function entityReference(){return[...NAMED_BY_CHAR.entries()].map(([char,name])=>({char,name:`&${name};`,decimal:`&#${char.codePointAt(0)};`,hex:`&#x${char.codePointAt(0)!.toString(16).toUpperCase()};`}));}
