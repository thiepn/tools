import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const OUT = process.env.PHASE9_FINAL_OUT
  ? path.resolve(ROOT, process.env.PHASE9_FINAL_OUT)
  : path.resolve(ROOT, 'artifacts', 'phase9-final-certification');
const FIXTURES = path.join(OUT, 'fixtures');
const HOST = '127.0.0.1';
const PORT = 4199;
const DEBUG_PORT = 9249;
const BASE = `http://${HOST}:${PORT}/tools/`;
const TARGET_IDS = ['text-cleaner', 'structured-data-viewer', 'font-viewer'];

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.wasm', 'application/wasm'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(40);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function getTargets() {
  const vite = await createViteServer({ root: ROOT, appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
  try {
    const toolsModule = await vite.ssrLoadModule('/src/registry/tools.ts');
    const registerModule = await vite.ssrLoadModule('/src/registry/register-all.ts');
    registerModule.registerAllPublicTools();

    const counts = Object.fromEntries(['text', 'developer', 'design'].map((category) => [
      category,
      toolsModule.TOOLS_REGISTRY.filter((tool) => tool.category === category).length,
    ]));
    if (counts.text !== 21 || counts.developer !== 52 || counts.design !== 14) {
      throw new Error(`Unexpected final-family counts: ${JSON.stringify(counts)}`);
    }

    return TARGET_IDS.map((id) => {
      const tool = toolsModule.TOOLS_REGISTRY.find((row) => row.id === id);
      if (!tool) throw new Error(`Missing Phase 9 target: ${id}`);
      return { id: tool.id, name: tool.name, category: tool.category };
    });
  } finally {
    await vite.close();
  }
}

async function findFont() {
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
  ];
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.size > 10_000) return candidate;
    } catch {}
  }
  throw new Error('No supported system TTF font was found on the CI image.');
}

async function makeFixtures() {
  await mkdir(FIXTURES, { recursive: true });
  const structured = path.join(FIXTURES, 'phase9-structured.json');
  const font = path.join(FIXTURES, 'phase9-font.ttf');

  await writeFile(structured, JSON.stringify({
    project: 'Tiny Tools',
    owner: { name: 'Ada', role: 'engineer' },
    tags: ['phase9', 'final'],
    active: true,
  }, null, 2));

  await copyFile(await findFont(), font);
  return { structured, font };
}

async function createStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
      if (url.pathname === '/favicon.ico') return response.writeHead(204).end();
      if (!url.pathname.startsWith('/tools')) return response.writeHead(404).end('Not found');
      const rel = url.pathname === '/tools' || url.pathname === '/tools/' ? 'index.html' : url.pathname.slice('/tools/'.length);
      const candidate = path.resolve(DIST, rel);
      const safe = path.relative(DIST, candidate);
      if (safe.startsWith('..') || path.isAbsolute(safe)) return response.writeHead(403).end('Forbidden');
      const info = await stat(candidate);
      const file = info.isDirectory() ? path.join(candidate, 'index.html') : candidate;
      response.writeHead(200, {
        'Content-Type': MIME.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(await readFile(file));
    } catch (error) {
      if (error?.code === 'ENOENT') response.writeHead(404).end('Not found');
      else response.writeHead(500).end('Server error');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });
  return server;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0) return candidate;
  }
  throw new Error('Chrome/Chromium not found.');
}

class Cdp {
  constructor(url) { this.url=url; this.ws=null; this.id=1; this.pending=new Map(); this.listeners=new Map(); }
  async open() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve,reject)=>{
      this.ws.addEventListener('open',resolve,{once:true});
      this.ws.addEventListener('error',()=>reject(new Error('Unable to open CDP WebSocket')),{once:true});
    });
    this.ws.addEventListener('message',(event)=>{
      const message=JSON.parse(event.data);
      if(message.id){
        const pending=this.pending.get(message.id);
        if(!pending)return;
        this.pending.delete(message.id);
        if(message.error)pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
        return;
      }
      for(const handler of this.listeners.get(message.method)??[])handler(message.params??{});
    });
  }
  on(method,handler){const list=this.listeners.get(method)??[];list.push(handler);this.listeners.set(method,list);}
  send(method,params={}){const id=this.id++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  close(){if(this.ws?.readyState===WebSocket.OPEN)this.ws.close();for(const pending of this.pending.values())pending.reject(new Error('CDP session closed.'));this.pending.clear();}
}

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true });
  if(response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Browser evaluation failed');
  return response.result?.value;
}

async function newTarget() {
  const response=await fetch(`http://${HOST}:${DEBUG_PORT}/json/new?about%3Ablank`,{method:'PUT'});
  if(!response.ok)throw new Error(`Unable to create Chrome target: HTTP ${response.status}`);
  return response.json();
}
async function closeTarget(id){await fetch(`http://${HOST}:${DEBUG_PORT}/json/close/${id}`).catch(()=>null);}

async function setFiles(cdp, selector, files) {
  await cdp.send('DOM.enable');
  const {root}=await cdp.send('DOM.getDocument',{depth:-1,pierce:true});
  const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});
  if(!nodeId)throw new Error(`File input not found: ${selector}`);
  await cdp.send('DOM.setFileInputFiles',{nodeId,files});
}

const PRELOAD=`(() => {
  window.__ttCopiedText = '';
  try {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value) => { window.__ttCopiedText = String(value); } },
    });
  } catch {}
})();`;

function fixtureExpression(id) {
  return `(async () => {
    const id=${JSON.stringify(id)};
    const root=document.querySelector('[data-tool-id="' + CSS.escape(id) + '"] .tt-tool-content');
    if(!root)return{ok:false,message:'tool content missing'};
    const pause=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
    const body=()=> (root.innerText||'').replace(/\\s+/g,' ').trim();
    const until=async(check,label,timeout=8000)=>{const end=Date.now()+timeout;while(Date.now()<end){const value=check();if(value)return value;await pause(25);}throw new Error('Timed out waiting for '+label);};
    const setValue=(element,value)=>{
      const proto=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
      setter?setter.call(element,String(value)):element.value=String(value);
      element.dispatchEvent(new Event('input',{bubbles:true}));
      element.dispatchEvent(new Event('change',{bubbles:true}));
    };
    try {
      if(id==='text-cleaner'){
        const input=root.querySelector('#cleaner-input-textarea');
        const output=root.querySelector('#cleaner-output-textarea');
        const copy=root.querySelector('#copy-clean-text-btn');
        if(!input||!output||!copy)throw new Error('Text Cleaner controls missing');
        const dirty='  “Hello”—world  \\r\\n\\r\\n  second\\tline\\u200B  '.replace('\\u200B','\u200B');
        setValue(input,dirty);
        const expected='"Hello"-world\\n\\nsecond line';
        await until(()=>output.value===expected,'cleaned output');
        if(copy.disabled)throw new Error('Copy Result remained disabled');
        copy.click();
        await until(()=>window.__ttCopiedText===expected,'clipboard copy');
        return{ok:true,message:'default cleaning and Copy Result verified'};
      }

      if(id==='structured-data-viewer'){
        await until(()=>{const text=body().toLowerCase();return text.includes('json')&&text.includes('nodes')&&text.includes('max depth')&&text.includes('ada')&&text.includes('phase9');},'structured JSON tree');
        const search=root.querySelector('input[placeholder="Filter keys and values"]');
        if(!search)throw new Error('Structured search input missing');
        setValue(search,'Ada');
        await until(()=>body().includes('Ada'),'structured search result');
        return{ok:true,message:'real JSON upload parsed, measured, and filtered'};
      }

      if(id==='font-viewer'){
        await until(()=>{const text=body();return text.includes('TrueType (TTF)')&&text.includes('Character map')&&text.includes('Font loaded locally.');},'font load',12000);
        const preview=[...root.querySelectorAll('label')].find((node)=>(node.textContent||'').trim().startsWith('Preview text'))?.querySelector('input');
        if(!preview)throw new Error('Font preview input missing');
        setValue(preview,'Phase 9 Font Preview 123');
        await until(()=>body().includes('Phase 9 Font Preview 123'),'font preview update');
        return{ok:true,message:'real system TTF inspected, loaded with FontFace, and previewed'};
      }

      return{ok:false,message:'no Phase 9 fixture for '+id};
    } catch(error) {
      return{ok:false,message:error instanceof Error?error.message:String(error)};
    }
  })()`;
}

async function auditTool(tool, fixtures) {
  const target=await newTarget();
  const cdp=new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  const errors=[];
  cdp.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(`uncaught: ${exceptionDetails?.exception?.description??exceptionDetails?.text??'unknown exception'}`));
  cdp.on('Runtime.consoleAPICalled',({type,args})=>{if(type==='error'||type==='assert'){const m=(args??[]).map(a=>a.value??a.description??'').filter(Boolean).join(' ');errors.push(`console.${type}: ${m||'unknown console error'}`);}});
  try {
    await Promise.all([cdp.send('Page.enable'),cdp.send('Runtime.enable')]);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,screenWidth:1280,screenHeight:900,deviceScaleFactor:1,mobile:false});
    await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:PRELOAD});
    await cdp.send('Page.navigate',{url:`${BASE}#/tool/${tool.id}`});
    await waitFor(()=>evaluate(cdp,`document.readyState==='complete'&&Boolean(document.querySelector('[data-tool-id="${tool.id}"] .tt-tool-content'))`),`${tool.id} mount`);

    if(tool.id==='structured-data-viewer') await setFiles(cdp,'input[type="file"][accept*=".json"]',[fixtures.structured]);
    if(tool.id==='font-viewer') await setFiles(cdp,'input[type="file"][accept*=".ttf"]',[fixtures.font]);

    const fixture=await evaluate(cdp,fixtureExpression(tool.id));
    await sleep(60);
    const findings=[];
    if(!fixture?.ok)findings.push(fixture?.message||'fixture did not report success');
    findings.push(...new Set(errors));
    return{id:tool.id,name:tool.name,status:findings.length?'FAIL':'PASS',fixture:fixture?.message??'',findings};
  } catch(error) {
    return{id:tool.id,name:tool.name,status:'FAIL',fixture:'',findings:[error instanceof Error?error.message:String(error)]};
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

function markdown(report){
  const rows=report.results.map((row)=>`| \`${row.id}\` | **${row.status}** | ${(row.fixture||row.findings.join('; ')||'—').replaceAll('|','\\|')} |`).join('\n');
  return `# Phase 9 — Final Functional Coverage

- Targets: **${report.summary.total}**
- PASS: **${report.summary.PASS}**
- FAIL: **${report.summary.FAIL}**

| Tool | Status | Evidence |
|---|---|---|
${rows}
`;
}

async function stopChrome(chrome){
  if(chrome.exitCode!==null)return;
  chrome.kill('SIGTERM');
  await Promise.race([once(chrome,'exit'),sleep(1800)]);
  if(chrome.exitCode===null)chrome.kill('SIGKILL');
}

async function main(){
  await stat(path.join(DIST,'index.html')).catch(()=>{throw new Error('dist/index.html is missing; run npm run build first.');});
  await rm(OUT,{recursive:true,force:true});
  await mkdir(OUT,{recursive:true});
  const tools=await getTargets();
  const fixtures=await makeFixtures();

  for(const tool of tools){
    const source=fixtureExpression(tool.id);
    try{new Function(`return ${source};`);}catch(error){throw new Error(`Generated Phase 9 fixture is invalid for ${tool.id}: ${error instanceof Error?error.message:String(error)}`);}
  }

  const server=await createStaticServer();
  const profile=await mkdtemp(path.join(tmpdir(),'tiny-tools-phase9-final-'));
  const chrome=spawn(findChrome(),[
    '--headless=new','--disable-gpu','--no-sandbox','--no-first-run','--no-default-browser-check',
    '--disable-background-networking','--disable-component-update','--disable-sync','--metrics-recording-only',
    `--remote-debugging-port=${DEBUG_PORT}`,`--user-data-dir=${profile}`,'about:blank'
  ],{stdio:['ignore','ignore','pipe']});
  let stderr='';chrome.stderr.on('data',(chunk)=>{stderr+=chunk.toString();});

  try{
    await waitFor(async()=>(await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(()=>null))?.ok,'Chrome DevTools',15000);
    const results=[];
    console.log(`Phase 9 final certification: ${tools.length} singleton workflows`);
    for(let i=0;i<tools.length;i++){
      const result=await auditTool(tools[i],fixtures);
      results.push(result);
      console.log(`${result.status==='PASS'?'✓':'✗'} ${i+1}/${tools.length} ${tools[i].id}${result.findings.length?` — ${result.findings[0]}`:''}`);
    }
    const summary={total:results.length,PASS:results.filter(x=>x.status==='PASS').length,FAIL:results.filter(x=>x.status==='FAIL').length};
    const report={generatedAt:new Date().toISOString(),baselineCommit:process.env.GITHUB_SHA??null,summary,results};
    await writeFile(path.join(OUT,'final-certification.json'),JSON.stringify(report,null,2));
    await writeFile(path.join(OUT,'final-certification.md'),markdown(report));
    console.log(`Phase 9 final summary ${JSON.stringify(summary)}`);
    if(summary.total!==3||summary.FAIL)process.exitCode=1;
  }catch(error){
    if(stderr.trim())console.error(`\nChrome stderr (tail):\n${stderr.slice(-4000)}`);
    throw error;
  }finally{
    await new Promise((resolve)=>server.close(resolve));
    await stopChrome(chrome);
    await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  }
}

main().catch((error)=>{console.error(error instanceof Error?error.stack:error);process.exitCode=1;});
