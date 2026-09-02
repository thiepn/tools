export interface LatencySummary{samples:number;successes:number;failures:number;failurePercent:number;minMs:number|null;averageMs:number|null;medianMs:number|null;maxMs:number|null;jitterMs:number|null;stdDevMs:number|null;slowSpikes:number}
export interface IceCandidateInfo{raw:string;protocol:string;address:string;port:number|null;type:string;family:'ipv4'|'ipv6'|'mdns'|'unknown';scope:'private'|'public'|'mdns'|'unknown'}
export interface CapabilityItem{group:string;name:string;supported:boolean;detail?:string}
export interface CodecProbe{kind:'audio'|'video';label:string;mime:string}
export interface CodecSupportRow extends CodecProbe{decode:'probably'|'maybe'|'no';record:boolean}

const round=(n:number,digits=2)=>Number(n.toFixed(digits));
export function throughputMbps(bytes:number,elapsedMs:number){if(!(bytes>=0)||!(elapsedMs>0))return 0;return round(bytes*8/(elapsedMs/1000)/1_000_000,2)}
export function analyzeLatency(samples:Array<number|null|undefined>):LatencySummary{
 const valid=samples.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0),failures=samples.length-valid.length,sorted=[...valid].sort((a,b)=>a-b),avg=valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null,median=sorted.length?sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2:null;
 let jitter:number|null=null,stdDev:number|null=null;if(valid.length>1){let delta=0;for(let i=1;i<valid.length;i++)delta+=Math.abs(valid[i]-valid[i-1]);jitter=delta/(valid.length-1);const mean=avg??0;stdDev=Math.sqrt(valid.reduce((s,v)=>s+(v-mean)**2,0)/valid.length)}
 const threshold=avg===null?Infinity:Math.max(avg*1.75,avg+40),slowSpikes=valid.filter(v=>v>threshold).length;
 return{samples:samples.length,successes:valid.length,failures,failurePercent:samples.length?round(failures/samples.length*100,1):0,minMs:sorted.length?round(sorted[0],1):null,averageMs:avg===null?null:round(avg,1),medianMs:median===null?null:round(median,1),maxMs:sorted.length?round(sorted[sorted.length-1],1):null,jitterMs:jitter===null?null:round(jitter,1),stdDevMs:stdDev===null?null:round(stdDev,1),slowSpikes};
}
export function gradeConnection(summary:LatencySummary){if(!summary.successes)return{label:'Unavailable',score:0};let score=100;score-=Math.min(55,summary.failurePercent*5);if(summary.averageMs!==null)score-=Math.min(20,Math.max(0,(summary.averageMs-30)/5));if(summary.jitterMs!==null)score-=Math.min(25,summary.jitterMs/2);score=Math.max(0,Math.round(score));return{label:score>=90?'Excellent':score>=75?'Good':score>=55?'Fair':score>=30?'Poor':'Very poor',score}}
export function classifyIpReachability(ipv4:boolean,ipv6:boolean){return ipv4&&ipv6?'Dual-stack (IPv4 + IPv6)':ipv6?'IPv6 only':ipv4?'IPv4 only':'No tested IP reachability'}

function ipv4Private(address:string){const parts=address.split('.').map(Number);if(parts.length!==4||parts.some(x=>!Number.isInteger(x)||x<0||x>255))return false;return parts[0]===10||parts[0]===127||(parts[0]===169&&parts[1]===254)||(parts[0]===172&&parts[1]>=16&&parts[1]<=31)||(parts[0]===192&&parts[1]===168)}
function ipv6Private(address:string){const a=address.toLowerCase();return a==='::1'||a.startsWith('fc')||a.startsWith('fd')||/^fe[89ab]/.test(a)}
export function parseIceCandidate(candidate:string):IceCandidateInfo{
 const raw=candidate.trim(),line=raw.replace(/^candidate:/i,''),tokens=line.split(/\s+/),protocol=(tokens[2]||'').toLowerCase(),address=tokens[4]||'',port=Number.isFinite(Number(tokens[5]))?Number(tokens[5]):null,typIndex=tokens.findIndex(t=>t==='typ'),type=typIndex>=0?(tokens[typIndex+1]||'unknown'):'unknown';
 let family:IceCandidateInfo['family']='unknown',scope:IceCandidateInfo['scope']='unknown';
 if(/\.local$/i.test(address)){family='mdns';scope='mdns'}else if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)){family='ipv4';scope=ipv4Private(address)?'private':'public'}else if(address.includes(':')){family='ipv6';scope=ipv6Private(address)?'private':'public'}
 return{raw,protocol,address,port,type,family,scope};
}
export function summarizeIceCandidates(candidates:IceCandidateInfo[]){const literal=candidates.filter(c=>c.family==='ipv4'||c.family==='ipv6'),privateCount=literal.filter(c=>c.scope==='private').length,publicCount=literal.filter(c=>c.scope==='public').length,mdnsCount=candidates.filter(c=>c.scope==='mdns').length;return{total:candidates.length,literalCount:literal.length,privateCount,publicCount,mdnsCount,privacyLabel:literal.length===0&&mdnsCount>0?'mDNS-protected host candidates':literal.length===0?'No literal IP candidates observed':publicCount>0?'Public IP candidate exposed':'Literal local/private IP candidate exposed'}}

export const CODEC_PROBES:CodecProbe[]=[
 {kind:'video',label:'MP4 · H.264 / AVC + AAC',mime:'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'},
 {kind:'video',label:'MP4 · HEVC / H.265',mime:'video/mp4; codecs="hvc1.1.6.L93.B0"'},
 {kind:'video',label:'MP4 · AV1',mime:'video/mp4; codecs="av01.0.05M.08"'},
 {kind:'video',label:'WebM · VP8 + Vorbis',mime:'video/webm; codecs="vp8, vorbis"'},
 {kind:'video',label:'WebM · VP9 + Opus',mime:'video/webm; codecs="vp09.00.10.08, opus"'},
 {kind:'video',label:'WebM · AV1 + Opus',mime:'video/webm; codecs="av01.0.05M.08, opus"'},
 {kind:'audio',label:'MP3',mime:'audio/mpeg'},
 {kind:'audio',label:'AAC / M4A',mime:'audio/mp4; codecs="mp4a.40.2"'},
 {kind:'audio',label:'Ogg Vorbis',mime:'audio/ogg; codecs="vorbis"'},
 {kind:'audio',label:'Ogg Opus',mime:'audio/ogg; codecs="opus"'},
 {kind:'audio',label:'WebM Opus',mime:'audio/webm; codecs="opus"'},
 {kind:'audio',label:'FLAC',mime:'audio/flac'},
 {kind:'audio',label:'WAV PCM',mime:'audio/wav; codecs="1"'},
];
export function evaluateCodecSupport(canPlay:(kind:'audio'|'video',mime:string)=>string,canRecord:(mime:string)=>boolean):CodecSupportRow[]{return CODEC_PROBES.map(p=>{const v=(canPlay(p.kind,p.mime)||'').toLowerCase();return{...p,decode:v==='probably'?'probably':v==='maybe'?'maybe':'no',record:Boolean(canRecord(p.mime))}})}
export function capabilitySummary(items:CapabilityItem[]){const supported=items.filter(i=>i.supported).length;return{supported,total:items.length,percent:items.length?Math.round(supported/items.length*100):0,groups:[...new Set(items.map(i=>i.group))].length}}
export function formatBytes(bytes:number|null|undefined){if(!(typeof bytes==='number'&&Number.isFinite(bytes)&&bytes>=0))return'Unavailable';if(bytes<1024)return`${Math.round(bytes)} B`;const units=['KiB','MiB','GiB','TiB'];let value=bytes/1024,i=0;while(value>=1024&&i<units.length-1){value/=1024;i++}return`${value>=100?value.toFixed(0):value>=10?value.toFixed(1):value.toFixed(2)} ${units[i]}`}
