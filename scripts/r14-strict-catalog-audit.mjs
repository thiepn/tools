import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const OUTPUT_DIR = path.resolve(ROOT, 'artifacts');
const HOST = '127.0.0.1';
const PORT = 4184;
const DEBUG_PORT = 9234;
const BASE_PATH = '/tools/';
const BASE_URL = `http://${HOST}:${PORT}${BASE_PATH}`;
const EXPECTED_TOOLS = 351;
const DESKTOP = { width: 1440, height: 1000, mobile: false };
const MOBILE = { width: 360, height: 800, mobile: true };
const MAX_FINDINGS_PER_KIND = 12;

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.wasm', 'application/wasm'],
  ['.woff', 'font/woff'], ['.woff2', 'font/woff2'],
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(80);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function getTools() {
  const vite = await createViteServer({ root: ROOT, appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
  try {
    const toolsModule = await vite.ssrLoadModule('/src/registry/tools.ts');
    const registerModule = await vite.ssrLoadModule('/src/registry/register-all.ts');
    registerModule.registerAllPublicTools();
    const tools = toolsModule.TOOLS_REGISTRY;
    if (!Array.isArray(tools) || tools.length !== EXPECTED_TOOLS) {
      throw new Error(`Expected ${EXPECTED_TOOLS} tools, found ${Array.isArray(tools) ? tools.length : 'non-array registry'}.`);
    }
    return tools.map(({ id, name, description, category }) => ({ id, name, description, category }));
  } finally {
    await vite.close();
  }
}

function resolveDistPath(requestPath) {
  const decoded = decodeURIComponent(requestPath);
  if (decoded === '/tools' || decoded === BASE_PATH) return path.join(DIST, 'index.html');
  if (!decoded.startsWith(BASE_PATH)) return null;
  const candidate = path.resolve(DIST, decoded.slice(BASE_PATH.length));
  const relative = path.relative(DIST, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
}

async function createStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
      if (url.pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
      const requested = resolveDistPath(url.pathname);
      if (!requested) { response.writeHead(404).end('Not found'); return; }
      const info = await stat(requested);
      const file = info.isDirectory() ? path.join(requested, 'index.html') : requested;
      response.writeHead(200, { 'Content-Type': MIME.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(await readFile(file));
    } catch (error) {
      if (error?.code === 'ENOENT') response.writeHead(404).end('Not found');
      else response.writeHead(500).end('Server error');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, HOST, resolve); });
  return server;
}

function findChrome() {
  const candidates = [process.env.CHROME_BIN, '/usr/bin/google-chrome', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) if (spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0) return candidate;
  throw new Error('Chrome/Chromium not found.');
}

class Cdp {
  constructor(url) { this.url = url; this.ws = null; this.id = 1; this.pending = new Map(); this.listeners = new Map(); }
  async open() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', () => reject(new Error('Unable to open CDP socket')), { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
        return;
      }
      for (const handler of this.listeners.get(message.method) ?? []) handler(message.params ?? {});
    });
  }
  on(method, handler) { const list = this.listeners.get(method) ?? []; list.push(handler); this.listeners.set(method, list); }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  close() { if (this.ws?.readyState === WebSocket.OPEN) this.ws.close(); for (const pending of this.pending.values()) pending.reject(new Error('CDP closed')); this.pending.clear(); }
}

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Browser evaluation failed');
  return response.result?.value;
}

async function openPage(viewport = DESKTOP) {
  const targetResponse = await fetch(`http://${HOST}:${DEBUG_PORT}/json/new?about%3Ablank`, { method: 'PUT' });
  if (!targetResponse.ok) throw new Error(`Unable to create Chrome target: HTTP ${targetResponse.status}`);
  const target = await targetResponse.json();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Log.enable'), cdp.send('Network.enable')]);
  await setViewport(cdp, viewport);
  return { target, cdp };
}

async function setViewport(cdp, viewport) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width, height: viewport.height, screenWidth: viewport.width, screenHeight: viewport.height,
    deviceScaleFactor: viewport.mobile ? 2 : 1, mobile: viewport.mobile,
  });
}

async function closeTarget(id) { await fetch(`http://${HOST}:${DEBUG_PORT}/json/close/${id}`).catch(() => null); }

function collectRuntimeSignals(cdp) {
  const errors = [];
  const externalRequests = [];
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(`uncaught: ${exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'unknown exception'}`));
  cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
    if (!['error', 'assert'].includes(type)) return;
    const text = (args ?? []).map((arg) => arg.value ?? arg.description ?? '').filter(Boolean).join(' ');
    errors.push(`console.${type}: ${text || 'unknown console error'}`);
  });
  cdp.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level !== 'error' || (entry.url ?? '').endsWith('/favicon.ico')) return;
    errors.push(`browser log: ${entry.text ?? 'unknown error'}${entry.url ? ` (${entry.url})` : ''}`);
  });
  cdp.on('Network.requestWillBeSent', ({ request }) => {
    try {
      const url = new URL(request.url);
      if (!['http:', 'https:'].includes(url.protocol)) return;
      if (url.hostname === HOST && Number(url.port || (url.protocol === 'https:' ? 443 : 80)) === PORT) return;
      externalRequests.push(request.url);
    } catch { /* ignore non-URL requests */ }
  });
  return { errors, externalRequests };
}

const CORE_SELECTOR = '.tt-tool-content';
const AUX_SELECTOR = '[data-s-tier-workbench], [data-s-tier-a-console]';

function pageInspectionExpression(toolId) {
  return `(() => {
    const shell = document.querySelector('[data-tool-id="${toolId}"]');
    if (!shell) return { missingShell: true };
    const visible = (el) => {
      const style = getComputedStyle(el); const r = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && r.width > 0 && r.height > 0;
    };
    const aux = (el) => Boolean(el.closest('${AUX_SELECTOR}'));
    const core = shell.querySelector('${CORE_SELECTOR}');
    const coreNodes = (selector) => [...(core?.querySelectorAll(selector) ?? [])].filter((el) => !aux(el));
    const textOf = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim();
    const refIds = (value) => (value || '').trim().split(/\\s+/).filter(Boolean);
    const missingRefIds = (el, attr) => refIds(el.getAttribute(attr)).filter((id) => !document.getElementById(id));
    const hasName = (el) => {
      const aria = el.getAttribute('aria-label')?.trim();
      if (aria) return true;
      const labelled = refIds(el.getAttribute('aria-labelledby'));
      if (labelled.length && labelled.every((id) => document.getElementById(id)) && labelled.some((id) => textOf(document.getElementById(id)))) return true;
      if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement) return Boolean(textOf(el));
      if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return true;
      if (el.closest('label')) return true;
      return false;
    };
    const descriptor = (el) => {
      const tag = el.tagName.toLowerCase(); const id = el.id ? '#' + el.id : '';
      const type = el.getAttribute('type') ? '[' + el.getAttribute('type') + ']' : '';
      const text = textOf(el).slice(0, 40); return tag + id + type + (text ? ':' + text : '');
    };
    const interactives = coreNodes('button, a[href], input:not([type="hidden"]), textarea, select').filter(visible);
    const missingNames = interactives.filter((el) => !hasName(el)).map(descriptor);
    const brokenAria = [];
    for (const el of coreNodes('[aria-labelledby], [aria-describedby]')) {
      for (const attr of ['aria-labelledby', 'aria-describedby']) {
        const missing = missingRefIds(el, attr);
        if (missing.length) brokenAria.push(descriptor(el) + ' ' + attr + '→' + missing.join(','));
      }
    }
    const ids = coreNodes('[id]').map((el) => el.id).filter(Boolean);
    const counts = ids.reduce((map, id) => (map[id] = (map[id] || 0) + 1, map), {});
    const duplicateIds = Object.entries(counts).filter(([, count]) => count > 1).map(([id, count]) => id + '×' + count);
    const brokenLabels = coreNodes('label[for]').map((label) => label.getAttribute('for')).filter((id) => id && !document.getElementById(id));
    const positiveTabindex = coreNodes('[tabindex]').filter(visible).filter((el) => Number(el.getAttribute('tabindex')) > 0).map(descriptor);
    const nestedInteractive = coreNodes('button, a[href]').filter((el) => el.querySelector('button, a[href], input, textarea, select')).map(descriptor);
    const missingAlt = coreNodes('img').filter(visible).filter((img) => !img.hasAttribute('alt')).map(descriptor);
    const tinyIconTargets = interactives.filter((el) => {
      if (!(el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement)) return false;
      if (textOf(el)) return false;
      if (!el.querySelector('svg, img')) return false;
      const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24;
    }).map((el) => { const r = el.getBoundingClientRect(); return descriptor(el) + '@' + Math.round(r.width) + '×' + Math.round(r.height); });
    const unfocusable = interactives.filter((el) => !el.hasAttribute('disabled') && el.tabIndex < 0).map(descriptor);
    const h1s = [...shell.querySelectorAll('h1')].filter(visible);
    const heading = h1s[0]?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
    const body = shell.innerText || '';
    const coreText = (() => {
      if (!core) return '';
      const clone = core.cloneNode(true);
      clone.querySelectorAll('${AUX_SELECTOR}').forEach((node) => node.remove());
      return (clone.innerText || clone.textContent || '').replace(/\\r/g, '').trim();
    })();
    const marker = /(?:coming soon|not implemented|under construction|todo\\b|replace me)/i.exec(coreText)?.[0] ?? '';
    return {
      missingShell: false,
      heading, h1Count: h1s.length, bodyLength: body.trim().length, coreTextLength: coreText.length, coreText,
      contentChildren: core?.children.length ?? 0,
      errorBoundary: document.body.innerText.includes('Something went wrong in this tool'), marker,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
      missingNames, brokenAria, duplicateIds, brokenLabels: [...new Set(brokenLabels)], positiveTabindex,
      nestedInteractive, missingAlt, tinyIconTargets, unfocusable,
      visibleInteractives: interactives.length,
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
      hasMain: Boolean(document.querySelector('main')),
    };
  })()`;
}

const MUTATE_CORE = `(() => {
  const shell = document.querySelector('[data-tool-id]');
  const core = shell?.querySelector('${CORE_SELECTOR}');
  if (!core) return { mutated: 0, controls: 0 };
  const aux = (el) => Boolean(el.closest('${AUX_SELECTOR}'));
  const visible = (el) => { const s=getComputedStyle(el), r=el.getBoundingClientRect(); return s.display!=='none' && s.visibility!=='hidden' && r.width>0 && r.height>0; };
  const label = (el) => {
    const parts = [el.getAttribute('aria-label'), el.getAttribute('name'), el.id, el.closest('label')?.textContent];
    if (el.id) parts.push(document.querySelector('label[for="' + CSS.escape(el.id) + '"]')?.textContent);
    return parts.filter(Boolean).join(' ').toLowerCase();
  };
  const nativeSet = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const semantic = (name) => {
    if (/json/.test(name)) return '{"audit":"Ångström","emoji":"🧪","value":42}';
    if (/yaml|yml/.test(name)) return 'audit: Ångström\\nvalue: 42';
    if (/xml/.test(name)) return '<root><value>Ångström 42</value></root>';
    if (/html/.test(name)) return '<p>Ångström &amp; audit 42</p>';
    if (/css/.test(name)) return '.audit { color: #2563eb; }';
    if (/sql/.test(name)) return 'SELECT 42 AS audit;';
    if (/markdown|md\\b/.test(name)) return '# Audit\\n\\nÅngström 🧪 42';
    if (/regex|pattern/.test(name)) return '[A-Za-z]+';
    if (/url|uri|website|link/.test(name)) return 'https://example.com/audit?x=1';
    if (/email/.test(name)) return 'audit@example.com';
    if (/phone|tel/.test(name)) return '+491234567890';
    if (/color|hex/.test(name)) return '#2563EB';
    if (/cron/.test(name)) return '0 9 * * 1-5';
    if (/cidr|subnet/.test(name)) return '192.168.1.0/24';
    if (/ip(?:v4)?|address/.test(name)) return '192.168.1.10';
    return 'Ångström 🧪 日本語 audit 42';
  };
  const controls = [...core.querySelectorAll('input,textarea,select')].filter((el) => !aux(el) && visible(el));
  let mutated = 0;
  for (const el of controls) {
    if (el.disabled || el.readOnly) continue;
    if (el instanceof HTMLSelectElement) {
      const option = [...el.options].find((o) => !o.disabled && o.value !== el.value);
      if (option) { nativeSet(el, option.value); mutated++; }
      continue;
    }
    if (el instanceof HTMLTextAreaElement) {
      let value = semantic(label(el)); if (el.maxLength > -1) value = value.slice(0, el.maxLength);
      nativeSet(el, value); mutated++; continue;
    }
    const type = (el.type || 'text').toLowerCase();
    if (['hidden','file','submit','button','reset','image','password'].includes(type)) continue;
    if (type === 'checkbox') { el.click(); mutated++; continue; }
    if (type === 'radio') continue;
    if (type === 'range' || type === 'number') {
      const min = el.min !== '' && Number.isFinite(Number(el.min)) ? Number(el.min) : 0;
      const max = el.max !== '' && Number.isFinite(Number(el.max)) ? Number(el.max) : Math.max(min + 100, 100);
      const step = el.step && el.step !== 'any' && Number.isFinite(Number(el.step)) ? Number(el.step) : 1;
      const current = Number(el.value);
      let value = Number.isFinite(current) ? current + step : Math.max(min, 1);
      value = Math.min(max, Math.max(min, value));
      nativeSet(el, String(value)); mutated++; continue;
    }
    const fixed = { date:'2026-09-05', 'datetime-local':'2026-09-05T12:34', time:'12:34', month:'2026-09', week:'2026-W36', color:'#2563eb', email:'audit@example.com', url:'https://example.com/audit', tel:'+491234567890' }[type];
    let value = fixed || semantic(label(el)); if (el.maxLength > -1) value = value.slice(0, el.maxLength);
    nativeSet(el, value); mutated++;
  }
  return { mutated, controls: controls.length };
})()`;

const CLICK_SAFE_ACTIONS = `(() => {
  const shell = document.querySelector('[data-tool-id]'); const core = shell?.querySelector('${CORE_SELECTOR}'); if (!core) return [];
  const aux = (el) => Boolean(el.closest('${AUX_SELECTOR}'));
  const visible = (el) => { const s=getComputedStyle(el), r=el.getBoundingClientRect(); return s.display!=='none' && s.visibility!=='hidden' && r.width>0 && r.height>0; };
  const allow = /\\b(calculate|convert|generate|format|encode|decode|analy[sz]e|check|validate|solve|apply|update|process|compare|extract|clean|normalize|render|preview)\\b/i;
  const deny = /\\b(download|save|share|print|copy|delete|remove|reset|clear|start|stop|record|camera|microphone|webcam|upload|choose|browse|play|pause|listen|speak|scan|connect|open|export|import|permission)\\b/i;
  const buttons = [...core.querySelectorAll('button:not([disabled])')].filter((b) => !aux(b) && visible(b)).filter((b) => allow.test(b.textContent||'') && !deny.test(b.textContent||'')).slice(0, 2);
  buttons.forEach((b) => b.click()); return buttons.map((b) => (b.textContent||'').replace(/\\s+/g,' ').trim());
})()`;

function collectFindings(tool, desktop, after, mobile, runtime, clicks, mutation, mountMs) {
  const findings = [];
  const addMany = (prefix, items) => {
    for (const item of (items ?? []).slice(0, MAX_FINDINGS_PER_KIND)) findings.push(`${prefix}: ${item}`);
    if ((items?.length ?? 0) > MAX_FINDINGS_PER_KIND) findings.push(`${prefix}: +${items.length - MAX_FINDINGS_PER_KIND} more`);
  };
  if (desktop.missingShell) findings.push('ToolShell missing');
  if (desktop.heading !== tool.name) findings.push(`heading mismatch: expected ${JSON.stringify(tool.name)}, found ${JSON.stringify(desktop.heading)}`);
  if (desktop.h1Count !== 1) findings.push(`expected exactly one visible h1, found ${desktop.h1Count}`);
  if (!desktop.hasMain) findings.push('page has no <main> landmark');
  if (!desktop.coreTextLength || !desktop.contentChildren) findings.push('core tool content is empty');
  if (desktop.errorBoundary || after.errorBoundary || mobile.errorBoundary) findings.push('ErrorBoundary became visible');
  if (desktop.marker || after.marker || mobile.marker) findings.push(`unfinished-product marker visible: ${desktop.marker || after.marker || mobile.marker}`);
  if (desktop.overflow) findings.push(`desktop horizontal overflow (${desktop.viewport.scrollWidth}px > ${desktop.viewport.width}px)`);
  if (after.overflow) findings.push('horizontal overflow after interaction');
  if (mobile.overflow) findings.push(`mobile horizontal overflow (${mobile.viewport.scrollWidth}px > ${mobile.viewport.width}px)`);
  addMany('missing programmatic name', desktop.missingNames);
  addMany('broken ARIA reference', desktop.brokenAria);
  addMany('duplicate id', desktop.duplicateIds);
  addMany('label points to missing id', desktop.brokenLabels);
  addMany('positive tabindex', desktop.positiveTabindex);
  addMany('nested interactive element', desktop.nestedInteractive);
  addMany('visible image lacks alt attribute', desktop.missingAlt);
  addMany('icon-only target smaller than 24×24', desktop.tinyIconTargets);
  addMany('visible enabled control is not keyboard-focusable', desktop.unfocusable);
  addMany('mobile missing programmatic name', mobile.missingNames);
  addMany('mobile icon-only target smaller than 24×24', mobile.tinyIconTargets);
  addMany('runtime/console error', runtime.errors);
  addMany('automatic external request on route load', [...new Set(runtime.externalRequests)]);
  const suspicious = ['NaN', 'undefined', '[object Object]'];
  for (const token of suspicious) if (!desktop.coreText.includes(token) && after.coreText.includes(token)) findings.push(`interaction introduced suspicious output token ${JSON.stringify(token)}`);
  if (mountMs > 5000) findings.push(`route mount exceeded strict 5s local threshold (${mountMs} ms)`);
  return [...new Set(findings)].map((message) => ({ severity: 'error', message }));
}

async function auditTool(tool) {
  const { target, cdp } = await openPage(DESKTOP);
  const runtime = collectRuntimeSignals(cdp);
  try {
    const started = Date.now();
    await cdp.send('Page.navigate', { url: `${BASE_URL}#/tool/${tool.id}` });
    await waitFor(() => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.querySelector('[data-tool-id="${tool.id}"]'))`), `${tool.id} route`, 20_000);
    const mountMs = Date.now() - started;
    await evaluate(cdp, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const desktop = await evaluate(cdp, pageInspectionExpression(tool.id));
    const initialExternalCount = runtime.externalRequests.length;
    const mutation = await evaluate(cdp, MUTATE_CORE);
    await sleep(180);
    const clicks = await evaluate(cdp, CLICK_SAFE_ACTIONS);
    if (clicks.length) await sleep(220);
    const after = await evaluate(cdp, pageInspectionExpression(tool.id));
    await setViewport(cdp, MOBILE);
    await evaluate(cdp, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const mobile = await evaluate(cdp, pageInspectionExpression(tool.id));
    runtime.externalRequests = runtime.externalRequests.slice(0, initialExternalCount);
    const findings = collectFindings(tool, desktop, after, mobile, runtime, clicks, mutation, mountMs);
    return {
      id: tool.id, name: tool.name, category: tool.category, mountMs,
      controls: mutation.controls, mutations: mutation.mutated, safeActionsClicked: clicks,
      desktopInteractives: desktop.visibleInteractives, mobileInteractives: mobile.visibleInteractives,
      findings,
    };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

function markdownReport(results, elapsedMs) {
  const failing = results.filter((r) => r.findings.length);
  const totalFindings = failing.reduce((sum, r) => sum + r.findings.length, 0);
  const lines = [
    '# R14 Strict 351-Tool Audit', '',
    `- Routes audited: **${results.length}/${EXPECTED_TOOLS}**`,
    `- Routes with findings: **${failing.length}**`,
    `- Total strict findings: **${totalFindings}**`,
    `- Elapsed: **${(elapsedMs / 1000).toFixed(1)} s**`,
    `- Viewports: desktop ${DESKTOP.width}×${DESKTOP.height}, mobile ${MOBILE.width}×${MOBILE.height}`, '',
  ];
  if (!failing.length) lines.push('## Result', '', '**PASS — no R14 strict findings.**', '');
  else {
    lines.push('## Findings', '');
    for (const result of failing) {
      lines.push(`### ${result.id}`, '', `Mount: ${result.mountMs} ms · controls: ${result.controls} · mutations: ${result.mutations} · safe actions: ${result.safeActionsClicked.join(', ') || 'none'}`, '');
      for (const finding of result.findings) lines.push(`- ${finding.message}`);
      lines.push('');
    }
  }
  lines.push('## Strict contract', '',
    'R14 independently checks canonical intent, one visible H1, main landmark, non-empty core UI, desktop/mobile overflow, programmatic names without treating placeholders as labels, ARIA references, duplicate IDs, label targets, keyboard focusability/tab order, nested interactive controls, image alt attributes, 24×24 icon-button targets, safe Unicode/form mutations, safe action-button execution, runtime/console failures, suspicious output tokens, automatic cross-origin requests during route load, and a strict local mount-time ceiling.', '');
  return lines.join('\n');
}

async function stopChrome(chrome) {
  if (chrome.exitCode !== null) return;
  chrome.kill('SIGTERM');
  await Promise.race([once(chrome, 'exit'), sleep(2000)]);
  if (chrome.exitCode === null) chrome.kill('SIGKILL');
}

async function main() {
  await stat(path.join(DIST, 'index.html')).catch(() => { throw new Error('dist/index.html missing. Run npm run build first.'); });
  const started = Date.now();
  const tools = await getTools();
  const server = await createStaticServer();
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-r14-'));
  const chrome = spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--metrics-recording-only', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeStderr = '';
  chrome.stderr.on('data', (chunk) => { chromeStderr += chunk.toString(); });
  const results = [];
  try {
    await waitFor(async () => (await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(() => null))?.ok, 'Chrome DevTools endpoint', 20_000);
    console.log(`R14 strict catalog audit: ${tools.length} routes`);
    for (let index = 0; index < tools.length; index++) {
      const tool = tools[index];
      try {
        const result = await auditTool(tool);
        results.push(result);
        console.log(`${result.findings.length ? '✗' : '✓'} ${index + 1}/${tools.length} ${tool.id}${result.findings.length ? ` (${result.findings.length})` : ''}`);
      } catch (error) {
        results.push({ id: tool.id, name: tool.name, category: tool.category, mountMs: 0, controls: 0, mutations: 0, safeActionsClicked: [], desktopInteractives: 0, mobileInteractives: 0, findings: [{ severity: 'error', message: `audit harness failure: ${error instanceof Error ? error.message : String(error)}` }] });
        console.log(`✗ ${index + 1}/${tools.length} ${tool.id} (harness)`);
      }
    }
  } catch (error) {
    if (chromeStderr.trim()) console.error(`\nChrome stderr (tail):\n${chromeStderr.slice(-5000)}`);
    throw error;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await stopChrome(chrome);
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }

  const elapsedMs = Date.now() - started;
  await mkdir(OUTPUT_DIR, { recursive: true });
  const summary = {
    version: 1,
    auditedAt: new Date().toISOString(),
    routes: results.length,
    routesWithFindings: results.filter((r) => r.findings.length).length,
    totalFindings: results.reduce((sum, r) => sum + r.findings.length, 0),
    totalMutations: results.reduce((sum, r) => sum + r.mutations, 0),
    totalSafeActions: results.reduce((sum, r) => sum + r.safeActionsClicked.length, 0),
    elapsedMs,
    results,
  };
  await writeFile(path.join(OUTPUT_DIR, 'r14-strict-audit.json'), JSON.stringify(summary, null, 2));
  await writeFile(path.join(OUTPUT_DIR, 'r14-strict-audit.md'), markdownReport(results, elapsedMs));

  console.log(`\nR14 strict summary: ${summary.routesWithFindings}/${results.length} routes with ${summary.totalFindings} finding(s)`);
  console.log(`- ${summary.totalMutations} safe input mutations`);
  console.log(`- ${summary.totalSafeActions} safe action-button clicks`);
  console.log(`- reports: artifacts/r14-strict-audit.{json,md}`);
  if (summary.totalFindings) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
