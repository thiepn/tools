import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync, gzipSync } from 'node:zlib';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';

const ROOT=process.cwd(),DIST=path.resolve(ROOT,'dist'),OUT=path.resolve(ROOT,process.env.FUNCTIONAL_WIRING_OUT||'artifacts/functional-wiring');
const HOST='127.0.0.1',PORT=4191,DEBUG_PORT=9241,BASE=`http://${HOST}:${PORT}/tools/`,EXPECTED=351;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const WEBM_BASE64='GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAs2EU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggGJTbuMU6uEHFO7a1Osggsg7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjEuNy4xMDNXQYxMYXZmNjEuNy4xMDNEiYhAeYAAAAAAABZUrmtAra4BAAAAAAAAP9eBAXPFiOZNxrWT6OWlnIEAIrWcg3VuZIiBAIaFVl9WUDiDgQEj44OEAmJaAOCQsIGguoFamoECVbCEVbmBAa4BAAAAAAAAXNeBAnPFiJ+TeGsJ6I+/nIEAIrWcg3VuZIiBAIaGQV9PUFVTVqqDYy6gVruEBMS0AIOBAuGRn4EBtYhA53AAAAAAAGJkgRBjopNPcHVzSGVhZAEBOAGAuwAAAAAAElTDZ0DVc3OfY8CAZ8iZRaOHRU5DT0RFUkSHjExhdmY2MS43LjEwM3Nz1mPAi2PFiOZNxrWT6OWlZ8ihRaOHRU5DT0RFUkSHlExhdmM2MS4xOS4xMDEgbGlidnB4Z8ihRaOIRFVSQVRJT05Eh5MwMDowMDowMC40MDAwMDAwMDAAc3PXY8CLY8WIn5N4awnoj79nyKJFo4dFTkNPREVSRIeVTGF2YzYxLjE5LjEwMSBsaWJvcHVzZ8ihRaOIRFVSQVRJT05Eh5MwMDowMDowMC40MDgwMDAwMDAAH0O2dUi254EAo/eCAACAeIF7xhF29HUAAAeOymnbu+Kf06wbDr3g/ksG+D3NDKeRGDpdS+HJFO//UgTwz6uMXJz3YABXE3uXqQQBEJxOWZ+WGkGC0D+mFnigLQ/o80C8PcxEKBjmMYN5QGA/7LMmZIOi2U40Qf9ZIhxNw2NOtI6JTaPWgQAAgPAFAJ0BKqAAWgAARwiFhYiFhIgCAgJ1qgP4AgaaE+CGqpNdxDqqTXcQ6qk13EOqpNdxDqqTXcQYAP7/TRL//FhX8WFfxYV/8WFf/PzO7cX85gCjyYIAFYB4nh6h5/+DXu6hxW2yUMBWdFrmGU5Zq8oD/zZwpEM43qvEJP9CD7r4PY+jVc7eJVU3MirA58Aq1LzPK5UeJNnV2Lr3FdGjzIIAKYB4mcJfcy3SMzo5I/EJJuwXgi5ecQccfcj9fwUPw6w5HiuHkYprVnNTKbJ13F6yvGbMG/ZplOMQ0m2zbZbMSib4NE+45udnRF+jmIEAKAARAgABEBAAGAAYWC/0AAiAgQAAAKPRggA9gHiZwl9zLdIxSRBCPb+Atu8mGNVc0sgF5y2ULscmgExomA7PrrPAYBdXXaf3ZgCiTLKPQj+xeqJCq58hqAXDo9fLFN5jB+8clum8LT5Po9CCAFGAeJnCX3Mt0i3QxZMdCFvR0t/QuhWc2LG3iLpxi7wxruV1vS0EzURtGbv7WTART6Eyo2eVQ96weWD6VyXrUhJ5jToGfZUB6u+D2CwSTaOYgQBQABECAAEQEAAYABhYL/QACICBAAAAo9SCAGWAeJnCX3Wc/EkyyHtmCSHYgVwvgKSoiYOPxfth4WasbVhcmePogNfGNT8ZYoIh1/WZwE5Zi1elgqBsEGwAs4lFpvUIm1CWY0/esI65Ort9NGGjzYIAeYB4mcJfcykgZacoMmVk1OYdsKRl3+vLPu2bq8f3lFVUFab1lEjCm9xT3si31FNofXI5U8ZXHGGF5Dprb6YGCjkdA+NJK5Gb2stNo5iBAHgAEQIAARAQABgAGFgv9AAIgIEAAACjz4IAjYB4mcJfcy3SMzpFrNancUV+qR1gMhU0WNrPmaEEpqFAJh9hUenVZOoYHikRrvdUA2uJtaq8pj75f8mq3oezbZbMSiuSAcjVjvgoH1ajzYIAoYB4mcJfcy3SLe3Xfk0o7jvzsr/xbPXu14Z8edz2ZvrxH2M6eu4Ysl4oNC++6HawtBgHEoPHWabvx0Sbz5KULc/eMNBuvlFt9p9Yo5iBAKAAEQIAARAQABgAGFgv9AAIgIEAAACj1IIAtYBomcJfcy3SLdDFlCy4L9V2O+Dw8S0EP0qIjzCHJzVzVV0wlaMOVewJCINXDD9kJAzmpbrzJdIaA3H0VKrMFxFELh8EODWMadDoiGaznbAXjaPSggDJgGiZwl91nPxJMTJ2m5T20uFmboka3fssThAH8DoEimPKm0iRxVSKpY5HQI2pou8MWxu7HcDFNpCWMcEigFssgCw1n+tQlMRPpO1ObyTDoaOYgQDIABECAAEQEAAYABhYL/QACICBAAAAo9WCAN2AaJnCX3Mt0jEyvcF5zB8CtJoClONg4JOTw3BjUdFc6dXuTuLAVbdwZ7qj5Ddb1WS2j1QLl9aVT9cWlm4aEmKj/GDrSwi7pIHMYGCjQt1BYmtOo8+CAPGAaJnCX3Wc/Es6TbWBVX/i168RXfBiOeFvLXq9qoV0kfAMgBv1HIJN+QIf6m5NTA5x0CCh0Exa7HmXBmqR46Nmy05BXJAKyoA8CgsWo5iBAPAAEQIAARAQABgAGFgv9AAIgIEAAACjzoIBBYBomcJfcy3SLe3XvP4GZk6NtWsZTkmf6HJltqvH1czbkcdEba8CjA5TbLsLhUvetEKkToT1rAeHreRUnfy5HeYw+jvGpEBzS33roKPPggEZgGiZwl9zLdIt0LRFEJsI7FDzGp4bt/OnmzjLdHfIDh97Khzvmjbeugv2Suff6m8/Yijdq2QdW7Y6TX6E+RkY9AhuoR6xJbZg5/G3DaOXgQEYAPEBAAEQEBRgAGFgv9AAIgIEAACjyoIBLYBomcJfdZz8SQtd9cr7KuAQgcLwV3nZ5ZPVoy06n7McL55TSrclOdLC14kI21JFnjh5GYfGRhO8EK/GInmQ869zYDs3wt3ho8+CAUGAaJnCX3Mt0i3vTY3FXL1VKEZb34xg5L2kH2BQX2yRTDOyRBRp5CaTYJML9Wd3pmjHDYJspCEf+sd0Jvo+Qx2wuRPHYlg1KoKfC3UOo5iBAUAAEQIAARAQABgAGFgv9AAIgIEAAACj9YIBVYBomcJfcy3SMzo4cWrlOgSj52ujwFDuwo0NN7bUxADk0IItRr/GSdTXcv16S2VZGBTAC0IW6lLU1PJXFctGikJaHjZRAIavUDwKCxZlC6TyIof1r2hDSsMTbkONscetV+Zhxmh7nJayZ0xSdhawbT/mg6PgggFpgNisfbriu5q6iL0PisqKZhQj8dkOkbJv4cQ9vHC3Ti3lG43zXV3ntzClh9FiUIXMU+r6b8uOp7QXIJRCLLc6/PgsVE2ID21nuMv1rzK48jYlXoScT1pAySo8+I2uo5iBAWgAEQIAARAQABgAGFgv9AAIgIEAAACj3YIBfYDYr+lQV1BAGGZJlBF2V6BEfu4d0xxeZyKqVNAIpdtYq8UP86EIKpAl5Uj88jqnfLHojvLbr5unNofv2bEYVtgpKM2nE9i5IdH6ULKFS69wsP8/1f00jv0LrqBAq6FAoYIBkQDYtTea5NXXANXvNHiGzWIZMONFzpidgSk9nRUirgsM8yNA0b8jRsimVCLFJBiWuvZY5oNi35oz9o4KzuIYyorXgOJac1YNchzsdFE9vvTKyvxFrCLCAZmucHouSPXKK3xYOAlIF75pWypQUT+5Qvc3riRL2+jci/ExR/xV/eMHyDM9jNieGhIcpkDlvOBP+3E3C4+0iKtFSCH95pCtdaKEAM3+YBxTu2uRu4+zgQC3iveBAfGCAmTwgXw=';

async function registry(){
  const vite=await createViteServer({root:ROOT,appType:'custom',logLevel:'error',server:{middlewareMode:true}});
  try{
    const tm=await vite.ssrLoadModule('/src/registry/tools.ts'),rm=await vite.ssrLoadModule('/src/registry/register-all.ts');
    rm.registerAllPublicTools();
    if(!Array.isArray(tm.TOOLS_REGISTRY)||tm.TOOLS_REGISTRY.length!==EXPECTED)throw new Error(`Expected ${EXPECTED} tools`);
    return tm.TOOLS_REGISTRY.map(({id,name,category})=>({id,name,category}));
  }finally{await vite.close()}
}
const MIME=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json'],['.svg','image/svg+xml'],['.png','image/png'],['.wasm','application/wasm'],['.woff','font/woff'],['.woff2','font/woff2']]);
async function serve(){
  const s=createServer(async(req,res)=>{
    try{
      const u=new URL(req.url??'/',BASE);
      if(!u.pathname.startsWith('/tools')){res.writeHead(404).end('Not found');return}
      const rel=u.pathname==='/tools'||u.pathname==='/tools/'?'index.html':u.pathname.slice('/tools/'.length);
      const candidate=path.resolve(DIST,rel),safe=path.relative(DIST,candidate);
      if(safe.startsWith('..')||path.isAbsolute(safe)){res.writeHead(403).end('Forbidden');return}
      const info=await stat(candidate),file=info.isDirectory()?path.join(candidate,'index.html'):candidate;
      res.writeHead(200,{'Content-Type':MIME.get(path.extname(file).toLowerCase())??'application/octet-stream','Cache-Control':'no-store'});
      res.end(await readFile(file));
    }catch(e){res.writeHead(e?.code==='ENOENT'?404:500).end(e?.code==='ENOENT'?'Not found':'Server error')}
  });
  await new Promise((r,j)=>{s.once('error',j);s.listen(PORT,HOST,r)});
  return s;
}
function chrome(){for(const c of[process.env.CHROME_BIN,'/usr/bin/google-chrome','google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean))if(spawnSync(c,['--version'],{stdio:'ignore'}).status===0)return c;throw new Error('Chrome/Chromium not found')}
class Cdp{
  constructor(url){this.url=url;this.ws=null;this.id=1;this.pending=new Map;this.listeners=new Map}
  async open(){this.ws=new WebSocket(this.url);await new Promise((r,j)=>{this.ws.addEventListener('open',r,{once:true});this.ws.addEventListener('error',()=>j(new Error('CDP socket failed')),{once:true})});this.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);return}for(const h of this.listeners.get(m.method)??[])h(m.params??{})})}
  on(m,h){const a=this.listeners.get(m)??[];a.push(h);this.listeners.set(m,a)}
  send(method,params={}){const id=this.id++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  close(){if(this.ws?.readyState===WebSocket.OPEN)this.ws.close()}
}
async function ev(cdp,expression,byValue=true){
  const x=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:byValue});
  if(x.exceptionDetails)throw new Error(x.exceptionDetails.exception?.description??x.exceptionDetails.text??'evaluation failed');
  return byValue?x.result?.value:x.result;
}
async function waitFor(check,label,timeout=18000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const v=await check();if(v)return v}catch(e){last=e}await sleep(70)}throw new Error(`Timed out waiting for ${label}${last?': '+last.message:''}`)}

function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),d=Buffer.from(data),out=Buffer.alloc(12+d.length);out.writeUInt32BE(d.length,0);t.copy(out,4);d.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([t,d])),8+d.length);return out}
function png(width=32,height=32){const raw=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++){const row=y*(width*4+1);raw[row]=0;for(let x=0;x<width;x++){const i=row+1+x*4;raw[i]=x<width/2?220:30;raw[i+1]=y<height/2?60:180;raw[i+2]=80;raw[i+3]=255}}const ih=Buffer.alloc(13);ih.writeUInt32BE(width,0);ih.writeUInt32BE(height,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])}
function wav(){const rate=8000,samples=2000,data=Buffer.alloc(samples*2);for(let i=0;i<samples;i++)data.writeInt16LE(Math.round(Math.sin(i/rate*2*Math.PI*440)*10000),i*2);const h=Buffer.alloc(44);h.write('RIFF',0);h.writeUInt32LE(36+data.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);return Buffer.concat([h,data])}
async function makeFixtures(){
  const dir=await mkdtemp(path.join(tmpdir(),'tiny-tools-functional-'));
  const put=async(name,data)=>{const p=path.join(dir,name);await writeFile(p,data);return p};
  const f={dir};
  f.txt=await put('sample.txt','Tiny Tools functional wiring sample 42\nSecond line\n');
  f.md=await put('sample.md','# Tiny Tools\n\n**Functional** sample.\n');
  f.csv=await put('sample.csv','name,value\nAlpha,1\nBeta,2\n');
  f.tsv=await put('sample.tsv','name\tvalue\nAlpha\t1\nBeta\t2\n');
  f.json=await put('sample.json',JSON.stringify({name:'Tiny Tools',value:42,nested:{ok:true}},null,2));
  f.xml=await put('sample.xml','<root><item id="1">Tiny Tools</item></root>');
  f.html=await put('sample.html','<!doctype html><html><body><h1>Tiny Tools</h1><p>Sample</p></body></html>');
  f.srt=await put('sample.srt','1\n00:00:00,000 --> 00:00:01,500\nHello Tiny Tools\n\n2\n00:00:02,000 --> 00:00:03,000\nSecond cue\n');
  f.vtt=await put('sample.vtt','WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nHello Tiny Tools\n');
  f.svg=await put('sample.svg','<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>');
  f.png=await put('sample.png',png());
  f.wav=await put('sample.wav',wav());
  f.pdf=await put('sample.pdf','%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  const zip=new JSZip();zip.file('hello.txt','Tiny Tools ZIP sample');f.zip=await put('sample.zip',await zip.generateAsync({type:'nodebuffer'}));
  f.bin=await put('sample.bin',Buffer.from([0,1,2,3,4,5,6,7,8,9]));
  f.gzip=await put('sample.txt.gz',gzipSync(Buffer.from('Tiny Tools gzip functional fixture')));
  const tarDir=path.join(dir,'tar-source');await mkdir(tarDir);await writeFile(path.join(tarDir,'hello.txt'),'Tiny Tools TAR fixture');f.tar=path.join(dir,'sample.tar');const tarRun=spawnSync('tar',['-cf',f.tar,'-C',tarDir,'.'],{stdio:'ignore'});if(tarRun.status!==0)throw new Error('Unable to create TAR fixture');
  f.video=await put('sample.webm',Buffer.from(WEBM_BASE64,'base64'));
  for(const font of ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'])if(existsSync(font)){f.font=font;break}
  return f;
}
function chooseFixture(id,accept,f){
  const a=(accept||'').toLowerCase(),s=id.toLowerCase();
  if(s==='tar-extract')return f.tar;
  if(s==='gzip-compress')return f.txt;
  if(s==='gzip-decompress')return f.gzip;
  if(a.includes('video')||/video|webcam/.test(s))return f.video||null;
  if(a.includes('audio')||/audio|ringtone/.test(s))return f.wav;
  if(a.includes('image')||/image|photo|favicon|watermark|palette|screenshot|meme|barcode|signature|red-eye|deskew|perspective|object-remover/.test(s))return f.png;
  if(a.includes('pdf')||/pdf/.test(s))return f.pdf;
  if(a.includes('font')||/font/.test(s))return f.font||f.bin;
  if(a.includes('.csv')||/csv|spreadsheet/.test(s))return f.csv;
  if(a.includes('.tsv'))return f.tsv;
  if(a.includes('.json')||/json|structured-data/.test(s))return f.json;
  if(a.includes('.xml')||/xml/.test(s))return f.xml;
  if(a.includes('.srt')||/subtitle/.test(s))return f.srt;
  if(a.includes('.vtt'))return f.vtt;
  if(a.includes('.svg'))return f.svg;
  if(a.includes('.zip')||/zip|archive/.test(s))return f.zip;
  if(a.includes('.md')||/markdown/.test(s))return f.md;
  if(a.includes('.html'))return f.html;
  return f.txt;
}
const SNAP=`(()=>{const core=document.querySelector('[data-tool-id] .tt-tool-content');if(!core)return null;const clone=core.cloneNode(true);clone.querySelectorAll('[data-s-tier-workbench],[data-s-tier-a-console]').forEach(n=>n.remove());const text=(clone.innerText||clone.textContent||'').replace(/\\s+/g,' ').trim();const result=[...clone.querySelectorAll('pre,code,table,[role="status"],[role="alert"],[aria-live],output,canvas,svg,img,audio,video')].map(e=>((e.innerText||e.textContent||e.getAttribute?.('aria-label')||e.tagName)||'').replace(/\\s+/g,' ').trim()).join('|');return{text:text.slice(0,10000),result:result.slice(0,6000),outputs:clone.querySelectorAll('pre,code,table,[role="status"],[role="alert"],[aria-live],output,canvas,svg,img,audio,video').length,files:[...core.querySelectorAll('input[type=file]')].map((e,i)=>({i,accept:e.accept||'',multiple:e.multiple})),buttons:[...core.querySelectorAll('button')].filter(e=>!e.closest('[data-s-tier-workbench],[data-s-tier-a-console]')).map((e,i)=>({i,text:(e.innerText||e.textContent||'').replace(/\\s+/g,' ').trim(),disabled:e.disabled}))}})()`;
const MUTATE=`(()=>{const core=document.querySelector('[data-tool-id] .tt-tool-content');if(!core)return{count:0};const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const label=e=>((e.getAttribute('aria-label')||e.closest('label')?.innerText||e.placeholder||e.name||'')+'').toLowerCase();const smart=e=>{const l=label(e);if(/json/.test(l))return '{"name":"Tiny Tools","value":42}';if(/xml/.test(l))return '<root><item>42</item></root>';if(/yaml/.test(l))return 'name: Tiny Tools\\nvalue: 42';if(/toml/.test(l))return 'name = "Tiny Tools"\\nvalue = 42';if(/sql/.test(l))return 'select id, name from users where active = true;';if(/csv/.test(l))return 'name,value\\nAlpha,1\\nBeta,2';if(/markdown|md /.test(l))return '# Tiny Tools\\n\\n**Sample**';if(/html/.test(l))return '<p>Tiny Tools</p>';if(/regex|pattern/.test(l))return '(\\\\w+)';if(/url|website|base url/.test(l))return 'https://example.com/path?a=1';if(/color|hex/.test(l))return '#336699';if(/cron/.test(l))return '*/5 * * * *';if(/cidr/.test(l))return '192.168.1.42/24';if(/email/.test(l))return 'audit@example.com';if(/date/.test(l))return '2026-09-21';return 'Tiny Tools functional sample 42'};const set=(e,v)=>{const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,s=Object.getOwnPropertyDescriptor(p,'value')?.set;s?s.call(e,v):e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))};let n=0;for(const e of[...core.querySelectorAll('input:not([type=file]):not([type=hidden]),textarea,select')].filter(visible).filter(e=>!e.disabled&&!e.readOnly).slice(0,4)){if(e instanceof HTMLSelectElement){const opts=[...e.options].filter(o=>!o.disabled);const o=opts.find(o=>o.value!==e.value)||opts[0];if(o){set(e,o.value);n++}continue}const t=(e.type||'text').toLowerCase();if(t==='checkbox'){e.click();n++;continue}if(t==='radio')continue;if(t==='number'||t==='range'){const cur=Number(e.value),step=Number(e.step)||1,min=e.min===''?-1e9:Number(e.min),max=e.max===''?1e9:Number(e.max);let v=Number.isFinite(cur)?cur+step:Math.max(1,min);if(v>max)v=Number.isFinite(cur)?cur-step:min;if(v>=min&&v<=max){set(e,String(v));n++}continue}if(t==='date'){set(e,'2026-09-21');n++;continue}if(t==='time'){set(e,'12:34');n++;continue}if(t==='datetime-local'){set(e,'2026-09-21T12:34');n++;continue}if(t==='month'){set(e,'2026-09');n++;continue}if(t==='week'){set(e,'2026-W39');n++;continue}if(t==='color'){set(e,'#336699');n++;continue}if(t==='email'){set(e,'audit@example.com');n++;continue}if(t==='url'){set(e,'https://example.com/path?a=1');n++;continue}set(e,smart(e));n++}return{count:n}})()`;
const ACTION=`(()=>{const core=document.querySelector('[data-tool-id] .tt-tool-content');if(!core)return null;const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const yes=/(calculate|convert|format|prettify|minify|generate|analy[sz]e|validate|check|compute|apply|preview|run|process|compare|solve|encode|decode|render|clean|normalize|transform|hash|parse|inspect|optimi[sz]e|simulate|build|create|sort|reverse|repeat|scale|pick|extract|split|merge|verify|test|update|refresh|find|make|start)\\b/i;const no=/(copy|download|export|save|print|share|reset|clear|delete|discard|cancel|close|back|choose|upload|browse|camera|microphone|record|stop|pause|resume|fullscreen|favorite)/i;const bs=[...core.querySelectorAll('button')].filter(visible).filter(b=>!b.disabled&&!b.closest('[data-s-tier-workbench],[data-s-tier-a-console]')).map((b,i)=>({b,i,t:(b.innerText||b.textContent||'').replace(/\\s+/g,' ').trim()}));const row=bs.find(x=>yes.test(x.t)&&!no.test(x.t))||bs.find(x=>x.t&&!no.test(x.t)&&!/^(add|remove|next|previous)$/i.test(x.t));if(!row)return null;row.b.click();return{index:row.i,text:row.t}})()`;

async function attachFirstFile(cdp,row,snap,fixtures){
  const fi=snap?.files?.[0];if(!fi)return null;
  const file=chooseFixture(row.id,fi.accept,fixtures);if(!file)return{attempted:false,reason:'fixture unavailable'};
  const expr=`(()=>document.querySelector('[data-tool-id="${row.id}"] .tt-tool-content')?.querySelectorAll('input[type=file]')[${fi.i}])()`;
  const obj=await ev(cdp,expr,false);if(!obj?.objectId)return{attempted:false,reason:'file input object missing'};
  const files=fi.multiple?[file,file]:[file];
  await cdp.send('DOM.setFileInputFiles',{files,objectId:obj.objectId});
  await cdp.send('Runtime.callFunctionOn',{objectId:obj.objectId,functionDeclaration:`function(){this.dispatchEvent(new Event('input',{bubbles:true}));this.dispatchEvent(new Event('change',{bubbles:true}));}`,awaitPromise:true});
  return{attempted:true,file:path.basename(file),multiple:fi.multiple};
}
function changed(a,b){return Boolean(a&&b)&&(a.result!==b.result||a.outputs!==b.outputs||a.text!==b.text)}

async function main(){
  await stat(path.join(DIST,'index.html')).catch(()=>{throw new Error('dist/index.html missing; run npm run build')});
  const rows=await registry(),fixtures=await makeFixtures(),server=await serve(),profile=await mkdtemp(path.join(tmpdir(),'tiny-tools-functional-chrome-'));
  const proc=spawn(chrome(),['--headless=new','--disable-gpu','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--metrics-recording-only',`--remote-debugging-port=${DEBUG_PORT}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let stderr='';
  proc.stderr.on('data',c=>stderr+=c.toString());
  try{
    await waitFor(async()=>(await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(()=>null))?.ok,'Chrome DevTools',25000);
    const target=await(await fetch(`http://${HOST}:${DEBUG_PORT}/json/new?about%3Ablank`,{method:'PUT'})).json(),cdp=new Cdp(target.webSocketDebuggerUrl);
    await cdp.open();await Promise.all([cdp.send('Page.enable'),cdp.send('Runtime.enable'),cdp.send('Log.enable'),cdp.send('DOM.enable')]);
    const errors=[];cdp.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails?.exception?.description??exceptionDetails?.text??'unknown exception'));cdp.on('Runtime.consoleAPICalled',({type,args})=>{if(type==='error'||type==='assert')errors.push((args??[]).map(a=>a.value??a.description??'').join(' ')||`console.${type}`)});
    const results=[];
    for(let i=0;i<rows.length;i++){
      const row=rows[i],e0=errors.length;
      const result={...row,status:'PASS',mode:'',mutated:0,mutationEffect:false,file:null,fileEffect:false,action:null,actionEffect:false,errors:[],notes:[]};
      try{
        await cdp.send('Page.navigate',{url:`${BASE}#/tool/${row.id}`});
        await waitFor(()=>ev(cdp,`Boolean(document.querySelector('[data-tool-id="${row.id}"] .tt-tool-content'))`),`${row.id} mount`);
        await ev(cdp,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
        const before=await ev(cdp,SNAP);
        if(row.category==='device'||row.category==='pdf'||row.id==='screen-recorder'){
          result.mode=row.id==='screen-recorder'?'delegated-recorder-certification':'delegated-browser-certification';
        }else{
          if(before?.files?.length){
            result.file=await attachFirstFile(cdp,row,before,fixtures);
            await sleep(700);
            const postFile=await ev(cdp,SNAP);result.fileEffect=changed(before,postFile);
          }
          const preMutation=await ev(cdp,SNAP),mut=await ev(cdp,MUTATE);result.mutated=mut?.count??0;await sleep(180);const postMutation=await ev(cdp,SNAP);result.mutationEffect=changed(preMutation,postMutation);
          const preAction=postMutation,action=await ev(cdp,ACTION);result.action=action;await sleep(action?650:80);const postAction=await ev(cdp,SNAP);result.actionEffect=Boolean(action)&&changed(preAction,postAction);
          const hasInteraction=Boolean(result.file?.attempted)||result.mutated>0||Boolean(action);
          const hasEffect=result.fileEffect||result.mutationEffect||result.actionEffect;
          if(hasEffect)result.mode=result.actionEffect?'action-wiring':result.fileEffect?'file-wiring':'reactive-wiring';
          else if(!hasInteraction&&before?.outputs>0)result.mode='initial-output-surface';
          else{result.status='INCONCLUSIVE';result.mode='no-proven-functional-effect';result.notes.push('Production route mounted but the functional probe did not observe a result/state effect.');}
        }
        result.errors=errors.slice(e0).filter(x=>!/ResizeObserver loop/i.test(x));
        if(result.errors.length){result.status='FAIL';result.notes.push('Runtime/console error during functional probe.')}
        const bad=await ev(cdp,`(()=>({boundary:document.body.innerText.includes('Something went wrong in this tool'),suspicious:/\\b(?:NaN|undefined)\\b|\\[object Object\\]/.test(document.querySelector('[data-tool-id="${row.id}"] .tt-tool-content')?.innerText||'')}))()`);
        if(bad.boundary){result.status='FAIL';result.notes.push('Error boundary rendered.')}
        if(bad.suspicious){result.status='FAIL';result.notes.push('Suspicious NaN/undefined/Object output rendered.')}
      }catch(e){result.status='FAIL';result.notes.push(e instanceof Error?e.message:String(e));result.errors=errors.slice(e0)}
      results.push(result);
      if((i+1)%25===0||i===rows.length-1)console.log(`Functional wiring ${i+1}/${rows.length}`);
    }
    const summary={total:results.length,PASS:results.filter(r=>r.status==='PASS').length,INCONCLUSIVE:results.filter(r=>r.status==='INCONCLUSIVE').length,FAIL:results.filter(r=>r.status==='FAIL').length};
    const families={};for(const r of results){const f=families[r.category]??{total:0,PASS:0,INCONCLUSIVE:0,FAIL:0};f.total++;f[r.status]++;families[r.category]=f}
    const report={schemaVersion:1,generatedAt:new Date().toISOString(),baselineCommit:process.env.GITHUB_SHA??null,summary,families,results};
    await mkdir(OUT,{recursive:true});await writeFile(path.join(OUT,'functional-wiring.json'),JSON.stringify(report,null,2)+'\n');
    const rowsMd=results.filter(r=>r.status!=='PASS').map(r=>`| \`${r.id}\` | ${r.category} | **${r.status}** | ${r.mode} | ${[...r.notes,...r.errors].join('; ').replaceAll('|','\\|')} |`).join('\n');
    await writeFile(path.join(OUT,'functional-wiring.md'),`# Tiny Tools — Functional Wiring Certification\n\n- Total: **${summary.total}**\n- PASS: **${summary.PASS}**\n- INCONCLUSIVE: **${summary.INCONCLUSIVE}**\n- FAIL: **${summary.FAIL}**\n\nThis gate complements deterministic unit/round-trip contracts by exercising the production build through its actual React controls. Device routes and PDF gateway routes remain delegated to their dedicated production browser certifications.\n\n## Non-passing routes\n\n| Tool | Family | Status | Probe | Finding |\n|---|---|---|---|---|\n${rowsMd||'| — | — | — | — | None |'}\n`);
    console.log('Functional wiring summary',summary);
    cdp.close();
    if(summary.FAIL||summary.INCONCLUSIVE)process.exitCode=1;
  }finally{
    await new Promise(r=>server.close(r));
    if(proc.exitCode===null){proc.kill('SIGTERM');await Promise.race([once(proc,'exit'),sleep(1800)]);if(proc.exitCode===null)proc.kill('SIGKILL')}
    await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures.dir,{recursive:true,force:true});
    if(process.exitCode&&stderr.trim())console.error(stderr.slice(-2500));
  }
}
main().catch(e=>{console.error(e instanceof Error?e.stack:e);process.exitCode=1});
