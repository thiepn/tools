const splitOutside=(input:string,separator:string)=>{
  const out:string[]=[];let quote='',depth=0,start=0;
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue}
    if(c==='"'||c==="'"){quote=c;continue}
    if('([{'.includes(c))depth++;
    else if(')]}'.includes(c))depth--;
    else if(c===separator&&depth===0){out.push(input.slice(start,i));start=i+1}
  }
  out.push(input.slice(start));return out;
};

const splitKeyValue=(line:string)=>{
  let quote='';
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue}
    if(c==='"'||c==="'")quote=c;
    else if(c===':')return[line.slice(0,i).trim(),line.slice(i+1).trim()]as const;
  }
  throw new Error(`Expected key: value near “${line}”.`);
};

const stripYamlComment=(line:string)=>{
  let quote='';
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue}
    if(c==='"'||c==="'")quote=c;
    else if(c==='#'&&(i===0||/\s/.test(line[i-1])))return line.slice(0,i);
  }
  return line;
};

function parseScalar(raw:string):unknown{
  const s=raw.trim();
  if(!s)return'';
  if(s==='null'||s==='~')return null;
  if(s==='true')return true;
  if(s==='false')return false;
  if(/^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(s))return Number(s);
  if((s.startsWith('"')&&s.endsWith('"'))||(s.startsWith("'")&&s.endsWith("'"))){
    if(s[0]==='"')return JSON.parse(s);
    return s.slice(1,-1).replace(/''/g,"'");
  }
  if((s.startsWith('[')&&s.endsWith(']'))||(s.startsWith('{')&&s.endsWith('}'))){
    try{return JSON.parse(s)}catch{/* keep as plain text */}
  }
  return s;
}

type YLine={indent:number;text:string};
export function parseYamlSubset(input:string):unknown{
  const lines:YLine[]=input.replace(/\t/g,'  ').split(/\r?\n/).map(stripYamlComment).map(raw=>({indent:raw.match(/^ */)?.[0].length??0,text:raw.trim()})).filter(line=>line.text&&line.text!=='---'&&line.text!=='...');
  if(!lines.length)return{};
  const parse=(start:number,indent:number):[unknown,number]=>{
    const sequence=lines[start]?.indent===indent&&lines[start].text.startsWith('-');
    if(sequence){
      const arr:unknown[]=[];let i=start;
      while(i<lines.length&&lines[i].indent===indent&&lines[i].text.startsWith('-')){
        const rest=lines[i].text.slice(1).trim();
        if(!rest){
          if(lines[i+1]&&lines[i+1].indent>indent){const[value,next]=parse(i+1,lines[i+1].indent);arr.push(value);i=next}
          else{arr.push(null);i++}
          continue;
        }
        if(/^[^:]+:\s*/.test(rest)){
          const[key,raw]=splitKeyValue(rest),obj:Record<string,unknown>={[key]:raw?parseScalar(raw):null};i++;
          while(i<lines.length&&lines[i].indent>indent){
            const childIndent=lines[i].indent;
            if(lines[i].text.startsWith('-')){
              if(obj[key]===null){const[value,next]=parse(i,childIndent);obj[key]=value;i=next;continue}
              break;
            }
            const[childKey,childRaw]=splitKeyValue(lines[i].text);
            if(childRaw){obj[childKey]=parseScalar(childRaw);i++}
            else if(lines[i+1]&&lines[i+1].indent>childIndent){const[value,next]=parse(i+1,lines[i+1].indent);obj[childKey]=value;i=next}
            else{obj[childKey]=null;i++}
          }
          arr.push(obj);
        }else{arr.push(parseScalar(rest));i++}
      }
      return[arr,i];
    }
    const obj:Record<string,unknown>={};let i=start;
    while(i<lines.length&&lines[i].indent===indent&&!lines[i].text.startsWith('-')){
      const[key,raw]=splitKeyValue(lines[i].text);
      if(raw){obj[key]=parseScalar(raw);i++}
      else if(lines[i+1]&&lines[i+1].indent>indent){const[value,next]=parse(i+1,lines[i+1].indent);obj[key]=value;i=next}
      else{obj[key]=null;i++}
    }
    return[obj,i];
  };
  return parse(0,lines[0].indent)[0];
}

const needsYamlQuotes=(s:string)=>!s||/^(?:null|true|false|~|[-+]?\d+(?:\.\d+)?|[-?:,\[\]{}#&*!|>'"%@`]|.*:\s|.*\s#)/i.test(s);
const yamlScalar=(value:unknown)=>value===null?'null':typeof value==='string'?(needsYamlQuotes(value)?JSON.stringify(value):value):typeof value==='number'||typeof value==='boolean'?String(value):JSON.stringify(value);
export function jsonToYaml(value:unknown,indent=0):string{
  const pad=' '.repeat(indent);
  if(Array.isArray(value))return value.map(item=>item!==null&&typeof item==='object'?`${pad}-\n${jsonToYaml(item,indent+2)}`:`${pad}- ${yamlScalar(item)}`).join('\n');
  if(value&&typeof value==='object')return Object.entries(value as Record<string,unknown>).map(([key,item])=>item!==null&&typeof item==='object'?`${pad}${key}:\n${jsonToYaml(item,indent+2)}`:`${pad}${key}: ${yamlScalar(item)}`).join('\n');
  return`${pad}${yamlScalar(value)}`;
}
export const formatYaml=(input:string)=>jsonToYaml(parseYamlSubset(input));

function tomlValue(raw:string):unknown{
  const s=raw.trim();
  if((s.startsWith('"')&&s.endsWith('"'))||(s.startsWith("'")&&s.endsWith("'")))return s.slice(1,-1).replace(/\\"/g,'"').replace(/\\n/g,'\n');
  if(s==='true'||s==='false')return s==='true';
  if(/^[-+]?\d+(?:\.\d+)?$/.test(s))return Number(s);
  if(s.startsWith('[')&&s.endsWith(']'))return splitOutside(s.slice(1,-1),',').map(v=>v.trim()).filter(Boolean).map(tomlValue);
  return s;
}
const setPath=(root:Record<string,unknown>,path:string[],value:unknown)=>{
  let node=root;
  for(const part of path.slice(0,-1)){
    const next=node[part];
    if(next&&typeof next==='object'&&!Array.isArray(next))node=next as Record<string,unknown>;
    else{const created:Record<string,unknown>={};node[part]=created;node=created}
  }
  node[path.at(-1)!]=value;
};
export function parseTomlSubset(input:string):Record<string,unknown>{
  const root:Record<string,unknown>={};let section:string[]=[];
  for(const rawLine of input.split(/\r?\n/)){
    const line=rawLine.replace(/\s+#.*$/,'').trim();if(!line)continue;
    if(/^\[.+\]$/.test(line)){section=line.slice(1,-1).split('.').map(v=>v.trim().replace(/^['"]|['"]$/g,''));continue}
    const eq=line.indexOf('=');if(eq<1)throw new Error(`Expected key = value near “${line}”.`);
    const key=line.slice(0,eq).trim().replace(/^['"]|['"]$/g,'');
    setPath(root,[...section,...key.split('.')],tomlValue(line.slice(eq+1)));
  }
  return root;
}
const tomlScalar=(value:unknown):string=>typeof value==='string'?JSON.stringify(value):typeof value==='number'||typeof value==='boolean'?String(value):value===null?'""':Array.isArray(value)?`[${value.map(tomlScalar).join(', ')}]`:JSON.stringify(value);
export function jsonToToml(value:unknown):string{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('TOML root must be a JSON object.');
  const lines:string[]=[];
  const emit=(obj:Record<string,unknown>,path:string[])=>{
    if(path.length)lines.push(`[${path.join('.')}]`);
    for(const[key,item]of Object.entries(obj))if(item===null||typeof item!=='object'||Array.isArray(item))lines.push(`${key} = ${tomlScalar(item)}`);
    for(const[key,item]of Object.entries(obj))if(item&&typeof item==='object'&&!Array.isArray(item)){
      if(lines.length&&lines.at(-1)!=='')lines.push('');
      emit(item as Record<string,unknown>,[...path,key]);
    }
  };
  emit(value as Record<string,unknown>,[]);
  return lines.join('\n').replace(/\n{3,}/g,'\n\n');
}
export const formatToml=(input:string)=>jsonToToml(parseTomlSubset(input));

const SQL_KEYWORDS=['SELECT','FROM','WHERE','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET','VALUES','SET','RETURNING','UNION ALL','UNION','LEFT JOIN','RIGHT JOIN','INNER JOIN','OUTER JOIN','FULL JOIN','CROSS JOIN','JOIN','ON','INSERT INTO','UPDATE','DELETE FROM','CREATE TABLE','ALTER TABLE','DROP TABLE'];
const protectStrings=(input:string)=>{
  const strings:string[]=[];let out='';
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(c==='"'||c==="'"||c==='`'){
      const quote=c;let buf=c;
      for(i++;i<input.length;i++){buf+=input[i];if(input[i]===quote&&input[i-1]!=='\\')break}
      strings.push(buf);out+=`§${strings.length-1}§`;
    }else out+=c;
  }
  return{out,strings};
};
const restoreStrings=(input:string,strings:string[])=>input.replace(/§(\d+)§/g,(_,n)=>strings[Number(n)]??'');
export function minifySql(input:string){
  const{out,strings}=protectStrings(input);
  return restoreStrings(out.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g,' ').replace(/\s+/g,' ').replace(/\s*([(),;=<>+*/-])\s*/g,'$1').trim(),strings);
}
export function formatSql(input:string){
  const{out,strings}=protectStrings(minifySql(input));let formatted=out;
  for(const keyword of [...SQL_KEYWORDS].sort((a,b)=>b.length-a.length))formatted=formatted.replace(new RegExp(`\\b${keyword.replace(/ /g,'\\s+')}\\b`,'gi'),`\n${keyword}`);
  formatted=formatted.replace(/^\n/,'').replace(/,\s*/g,',\n  ').replace(/\b(AND|OR)\b/gi,'\n  $1').replace(/;/g,';\n\n').replace(/\n{3,}/g,'\n\n');
  return restoreStrings(formatted.trim(),strings);
}

export type SchemaIssue={path:string;message:string};
export function validateJsonSchema(value:unknown,schema:unknown):SchemaIssue[]{
  const issues:SchemaIssue[]=[];
  const visit=(current:unknown,currentSchema:any,path:string)=>{
    if(!currentSchema||typeof currentSchema!=='object')return;
    const type=currentSchema.type as string|undefined;
    if(type){
      const valid=type==='array'?Array.isArray(current):type==='null'?current===null:type==='integer'?Number.isInteger(current):type==='number'?typeof current==='number'&&Number.isFinite(current):type==='object'?!!current&&typeof current==='object'&&!Array.isArray(current):typeof current===type;
      if(!valid){issues.push({path,message:`Expected ${type}.`});return}
    }
    if(Array.isArray(currentSchema.enum)&&!currentSchema.enum.some((item:unknown)=>JSON.stringify(item)===JSON.stringify(current)))issues.push({path,message:'Value is not in enum.'});
    if(typeof current==='string'){
      if(typeof currentSchema.minLength==='number'&&current.length<currentSchema.minLength)issues.push({path,message:`Minimum length is ${currentSchema.minLength}.`});
      if(typeof currentSchema.maxLength==='number'&&current.length>currentSchema.maxLength)issues.push({path,message:`Maximum length is ${currentSchema.maxLength}.`});
      if(typeof currentSchema.pattern==='string'){
        try{if(!new RegExp(currentSchema.pattern).test(current))issues.push({path,message:`Does not match /${currentSchema.pattern}/.`})}
        catch{issues.push({path,message:'Schema pattern is not a valid regular expression.'})}
      }
    }
    if(typeof current==='number'){
      if(typeof currentSchema.minimum==='number'&&current<currentSchema.minimum)issues.push({path,message:`Must be ≥ ${currentSchema.minimum}.`});
      if(typeof currentSchema.maximum==='number'&&current>currentSchema.maximum)issues.push({path,message:`Must be ≤ ${currentSchema.maximum}.`});
    }
    if(Array.isArray(current)){
      if(typeof currentSchema.minItems==='number'&&current.length<currentSchema.minItems)issues.push({path,message:`Requires at least ${currentSchema.minItems} items.`});
      if(typeof currentSchema.maxItems==='number'&&current.length>currentSchema.maxItems)issues.push({path,message:`Allows at most ${currentSchema.maxItems} items.`});
      if(currentSchema.items)current.forEach((item,index)=>visit(item,currentSchema.items,`${path}[${index}]`));
    }
    if(current&&typeof current==='object'&&!Array.isArray(current)){
      const object=current as Record<string,unknown>;
      if(Array.isArray(currentSchema.required))for(const key of currentSchema.required)if(!(key in object))issues.push({path:`${path}.${key}`,message:'Required property is missing.'});
      if(currentSchema.properties&&typeof currentSchema.properties==='object')for(const[key,childSchema]of Object.entries(currentSchema.properties))if(key in object)visit(object[key],childSchema,`${path}.${key}`);
      if(currentSchema.additionalProperties===false&&currentSchema.properties)for(const key of Object.keys(object))if(!(key in currentSchema.properties))issues.push({path:`${path}.${key}`,message:'Additional property is not allowed.'});
    }
  };
  visit(value,schema,'$');return issues;
}

export function evaluateJsonPath(root:unknown,path:string):unknown[]{
  let i=0;if(path[i]!=='$')throw new Error('JSONPath must start with $.');i++;
  let nodes:unknown[]=[root];
  const applyKey=(key:string)=>{nodes=nodes.flatMap(node=>node&&typeof node==='object'&&!Array.isArray(node)&&key in(node as Record<string,unknown>)?[(node as Record<string,unknown>)[key]]:[])};
  const applyIndex=(index:number)=>{nodes=nodes.flatMap(node=>Array.isArray(node)&&index>=0&&index<node.length?[node[index]]:[])};
  const wildcard=()=>{nodes=nodes.flatMap(node=>Array.isArray(node)?node:node&&typeof node==='object'?Object.values(node as Record<string,unknown>):[])};
  while(i<path.length){
    if(path[i]==='.'){
      i++;if(path[i]==='*'){wildcard();i++;continue}
      const match=path.slice(i).match(/^[A-Za-z_$][\w$-]*/);if(!match)throw new Error(`Invalid property selector near ${path.slice(i)}.`);
      applyKey(match[0]);i+=match[0].length;continue;
    }
    if(path[i]==='['){
      const end=path.indexOf(']',i);if(end<0)throw new Error('Missing closing ].');
      const body=path.slice(i+1,end).trim();
      if(body==='*')wildcard();
      else if(/^\d+$/.test(body))applyIndex(Number(body));
      else if(/^(['"]).*\1$/.test(body))applyKey(body.slice(1,-1));
      else throw new Error(`Unsupported bracket selector [${body}].`);
      i=end+1;continue;
    }
    throw new Error(`Unexpected JSONPath token “${path[i]}”.`);
  }
  return nodes;
}

const textEncoder=new TextEncoder(),textDecoder=new TextDecoder();
export function encodeBase32Bytes(bytes:Uint8Array){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0,out='';
  for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5}}
  if(bits)out+=alphabet[(value<<(5-bits))&31];while(out.length%8)out+='=';return out;
}
export function decodeBase32Bytes(input:string){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',clean=input.toUpperCase().replace(/[\s=-]/g,'');let bits=0,value=0;const out:number[]=[];
  for(const char of clean){const index=alphabet.indexOf(char);if(index<0)throw new Error(`Invalid Base32 character: ${char}`);value=(value<<5)|index;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8}}
  return new Uint8Array(out);
}
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function encodeBase58Bytes(bytes:Uint8Array){
  let number=0n;for(const byte of bytes)number=(number<<8n)|BigInt(byte);let out='';while(number){out=B58[Number(number%58n)]+out;number/=58n}for(const byte of bytes){if(byte===0)out='1'+out;else break}return out||'1';
}
export function decodeBase58Bytes(input:string){
  let number=0n;for(const char of input.trim()){const index=B58.indexOf(char);if(index<0)throw new Error(`Invalid Base58 character: ${char}`);number=number*58n+BigInt(index)}const out:number[]=[];while(number){out.unshift(Number(number&255n));number>>=8n}for(const char of input){if(char==='1')out.unshift(0);else break}return new Uint8Array(out);
}
export function encodeAscii85Bytes(bytes:Uint8Array){
  let out='<~';
  for(let i=0;i<bytes.length;i+=4){const chunk=bytes.slice(i,i+4);let number=0;for(let j=0;j<4;j++)number=number*256+(chunk[j]??0);if(chunk.length===4&&number===0){out+='z';continue}const chars=Array(5).fill('');for(let j=4;j>=0;j--){chars[j]=String.fromCharCode(number%85+33);number=Math.floor(number/85)}out+=chars.slice(0,chunk.length+1).join('')}
  return out+'~>';
}
export function decodeAscii85Bytes(input:string){
  const source=input.trim().replace(/^<~/,'').replace(/~>$/,'').replace(/\s/g,'');const out:number[]=[];let group='';
  const emit=(value:string,partial=false)=>{const originalLength=value.length;while(value.length<5)value+='u';let number=0;for(const char of value)number=number*85+(char.charCodeAt(0)-33);const bytes=[number>>>24,(number>>>16)&255,(number>>>8)&255,number&255];out.push(...bytes.slice(0,partial?Math.max(0,originalLength-1):4))};
  for(const char of source){if(char==='z'){if(group)throw new Error('Ascii85 z shorthand must align to a 4-byte group.');out.push(0,0,0,0);continue}const code=char.charCodeAt(0);if(code<33||code>117)throw new Error(`Invalid Ascii85 character: ${char}`);group+=char;if(group.length===5){emit(group);group=''}}
  if(group)emit(group,true);return new Uint8Array(out);
}
export type BaseEncoding='base32'|'base58'|'base85';
export function encodeBaseText(text:string,encoding:BaseEncoding){const bytes=textEncoder.encode(text);return encoding==='base32'?encodeBase32Bytes(bytes):encoding==='base58'?encodeBase58Bytes(bytes):encodeAscii85Bytes(bytes)}
export function decodeBaseText(text:string,encoding:BaseEncoding){const bytes=encoding==='base32'?decodeBase32Bytes(text):encoding==='base58'?decodeBase58Bytes(text):decodeAscii85Bytes(text);return textDecoder.decode(bytes)}

const ipToInt=(ip:string)=>{const parts=ip.split('.').map(Number);if(parts.length!==4||parts.some(value=>!Number.isInteger(value)||value<0||value>255))throw new Error('Enter a valid IPv4 address.');return(((parts[0]<<24)>>>0)+(parts[1]<<16)+(parts[2]<<8)+parts[3])>>>0};
const intToIp=(value:number)=>[value>>>24,(value>>>16)&255,(value>>>8)&255,value&255].join('.');
export function calculateSubnet(input:string){
  const[ip,prefixRaw]=input.trim().split('/'),prefix=Number(prefixRaw);if(!Number.isInteger(prefix)||prefix<0||prefix>32)throw new Error('CIDR prefix must be between /0 and /32.');
  const address=ipToInt(ip),mask=prefix===0?0:(0xffffffff<<(32-prefix))>>>0,network=(address&mask)>>>0,broadcast=(network|(~mask>>>0))>>>0,totalAddresses=2**(32-prefix),usableHosts=prefix>=31?totalAddresses:Math.max(0,totalAddresses-2);
  return{address:ip,prefix,mask:intToIp(mask),wildcard:intToIp((~mask)>>>0),network:intToIp(network),broadcast:intToIp(broadcast),firstHost:intToIp(prefix>=31?network:(network+1)>>>0),lastHost:intToIp(prefix>=31?broadcast:(broadcast-1)>>>0),totalAddresses,usableHosts};
}

export function parseUserAgent(ua:string){
  const edge=/Edg\/([^\s]+)/.exec(ua),opera=/OPR\/([^\s]+)/.exec(ua),firefox=/Firefox\/([^\s]+)/.exec(ua),chrome=/Chrome\/([^\s]+)/.exec(ua),safari=/Version\/([^\s]+).*Safari/.exec(ua);
  const browser=edge?['Edge',edge[1]]:opera?['Opera',opera[1]]:firefox?['Firefox',firefox[1]]:chrome?['Chrome',chrome[1]]:safari?['Safari',safari[1]]:['Unknown',''];
  const android=/Android ([^;]+)/.exec(ua),iphone=/iPhone OS ([\d_]+)/.exec(ua),ipad=/iPad.*OS ([\d_]+)/.exec(ua),mac=/Mac OS X ([\d_]+)/.exec(ua),webkit=/AppleWebKit\/([\d.]+)/.exec(ua);
  const os=/Windows NT/.test(ua)?'Windows':android?`Android ${android[1]}`:iphone?`iOS ${iphone[1].replace(/_/g,'.')}`:ipad?`iPadOS ${ipad[1].replace(/_/g,'.')}`:mac?`macOS ${mac[1].replace(/_/g,'.')}`:/Linux/.test(ua)?'Linux':'Unknown';
  const engine=webkit?`WebKit ${webkit[1]}`:/Gecko\/\d+/.test(ua)?'Gecko':'Unknown',device=/Mobile|Android|iPhone|iPad/.test(ua)?(/iPad|Tablet/.test(ua)?'Tablet':'Mobile'):'Desktop';
  return{browser:browser[0],version:browser[1],engine,os,device};
}

export function buildUtmUrl(base:string,params:{source?:string;medium?:string;campaign?:string;term?:string;content?:string}){
  const url=new URL(base),map:[keyof typeof params,string][]=[['source','utm_source'],['medium','utm_medium'],['campaign','utm_campaign'],['term','utm_term'],['content','utm_content']];
  for(const[key,param]of map){const value=params[key]?.trim();if(value)url.searchParams.set(param,value);else url.searchParams.delete(param)}return url.toString();
}

const escapeHtml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const inlineMarkdown=(value:string)=>escapeHtml(value).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" rel="noopener noreferrer">$1</a>');
export function markdownToHtml(input:string){
  const lines=input.split(/\r?\n/),out:string[]=[];let inCode=false,code:string[]=[],list=false;
  for(const line of lines){
    if(/^```/.test(line)){if(inCode){out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);code=[];inCode=false}else{if(list){out.push('</ul>');list=false}inCode=true}continue}
    if(inCode){code.push(line);continue}
    const heading=/^(#{1,6})\s+(.*)$/.exec(line);if(heading){if(list){out.push('</ul>');list=false}out.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);continue}
    const item=/^[-*+]\s+(.*)$/.exec(line);if(item){if(!list){out.push('<ul>');list=true}out.push(`<li>${inlineMarkdown(item[1])}</li>`);continue}
    if(list){out.push('</ul>');list=false}
    if(/^>\s?/.test(line)){out.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/,''))}</blockquote>`);continue}
    if(!line.trim()){out.push('');continue}
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  if(inCode)out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);if(list)out.push('</ul>');return out.join('\n').replace(/\n{3,}/g,'\n\n');
}
export function htmlToMarkdown(input:string){
  return input.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,'').replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,(_,value)=>`\n\`\`\`\n${value.replace(/<[^>]+>/g,'')}\n\`\`\`\n`).replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,(_,level,value)=>`\n${'#'.repeat(Number(level))} ${value.replace(/<[^>]+>/g,'')}\n`).replace(/<li[^>]*>([\s\S]*?)<\/li>/gi,(_,value)=>`\n- ${value.replace(/<[^>]+>/g,'')}`).replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,(_,value)=>`\n> ${value.replace(/<[^>]+>/g,'')}\n`).replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi,'**$2**').replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi,'*$2*').replace(/<code[^>]*>([\s\S]*?)<\/code>/gi,'`$1`').replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,'[$2]($1)').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|ul|ol|section)>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\n{3,}/g,'\n\n').trim();
}
