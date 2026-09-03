import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const HOST = '127.0.0.1';
const PORT = 4178;
const DEBUG_PORT = 9228;
const BASE_PATH = '/tools/';
const BASE_URL = `http://${HOST}:${PORT}${BASE_PATH}`;
const EXPECTED_TOOLS = 351;
const VIEWPORT = { width: 1280, height: 900, mobile: false };

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
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
    await sleep(80);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function getTools() {
  const vite = await createViteServer({
    root: ROOT,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
  });
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
      if (url.pathname === '/favicon.ico') {
        response.writeHead(204).end();
        return;
      }
      const requested = resolveDistPath(url.pathname);
      if (!requested) {
        response.writeHead(404).end('Not found');
        return;
      }
      const info = await stat(requested);
      const file = info.isDirectory() ? path.join(requested, 'index.html') : requested;
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': MIME.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(body);
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
  throw new Error('Chrome/Chromium not found. Set CHROME_BIN to a usable binary.');
}

class Cdp {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async open() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', () => reject(new Error('Unable to open CDP WebSocket')), { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const handler of this.listeners.get(message.method) ?? []) handler(message.params ?? {});
    });
  }
  on(method, handler) {
    const list = this.listeners.get(method) ?? [];
    list.push(handler);
    this.listeners.set(method, list);
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.close();
    for (const pending of this.pending.values()) pending.reject(new Error('CDP session closed.'));
    this.pending.clear();
  }
}

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Browser evaluation failed');
  }
  return response.result?.value;
}

async function newTarget() {
  const response = await fetch(`http://${HOST}:${DEBUG_PORT}/json/new?about%3Ablank`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Unable to create Chrome target: HTTP ${response.status}`);
  return response.json();
}

async function closeTarget(id) {
  await fetch(`http://${HOST}:${DEBUG_PORT}/json/close/${id}`).catch(() => null);
}

async function openPage() {
  const target = await newTarget();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Log.enable')]);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    screenWidth: VIEWPORT.width,
    screenHeight: VIEWPORT.height,
    deviceScaleFactor: 1,
    mobile: VIEWPORT.mobile,
  });
  return { target, cdp };
}

function collectErrors(cdp) {
  const errors = [];
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    errors.push(`uncaught: ${exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'unknown exception'}`);
  });
  cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
    if (type !== 'error' && type !== 'assert') return;
    const text = (args ?? []).map((arg) => arg.value ?? arg.description ?? '').filter(Boolean).join(' ');
    errors.push(`console.${type}: ${text || 'unknown console error'}`);
  });
  cdp.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level !== 'error') return;
    const url = entry.url ?? '';
    if (url.endsWith('/favicon.ico')) return;
    errors.push(`browser log: ${entry.text ?? 'unknown error'}${url ? ` (${url})` : ''}`);
  });
  return errors;
}

const MUTATION_SCRIPT = `(() => {
  const shell = document.querySelector('[data-tool-id]');
  if (!shell) throw new Error('ToolShell missing before mutation');
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  const labelFor = (element) => {
    const id = element.id;
    const explicit = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]')?.textContent : '';
    const wrapping = element.closest('label')?.textContent;
    return [element.getAttribute('aria-label'), element.getAttribute('title'), explicit, wrapping, element.getAttribute('placeholder'), element.getAttribute('name'), id]
      .filter(Boolean).join(' ').toLowerCase();
  };
  const setNativeValue = (element, value) => {
    const proto = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const semanticText = (label) => {
    if (/json/.test(label)) return '{"audit":true,"value":42}';
    if (/yaml|yml/.test(label)) return 'audit: true\\nvalue: 42';
    if (/xml/.test(label)) return '<root><value>42</value></root>';
    if (/html/.test(label)) return '<p>Tiny Tools audit</p>';
    if (/css/.test(label)) return '.audit { color: #2563eb; }';
    if (/sql/.test(label)) return 'SELECT 42 AS audit;';
    if (/markdown|md /.test(label)) return '# Audit\\n\\nTiny Tools sample.';
    if (/regex|pattern/.test(label)) return '[A-Za-z]+';
    if (/url|uri|website|link/.test(label)) return 'https://example.com/audit?x=1';
    if (/email/.test(label)) return 'audit@example.com';
    if (/phone|tel/.test(label)) return '+491234567890';
    if (/color|hex/.test(label)) return '#2563EB';
    if (/cron/.test(label)) return '0 9 * * 1-5';
    if (/ip(v4)?|address/.test(label)) return '192.168.1.10';
    if (/cidr|subnet/.test(label)) return '192.168.1.0/24';
    if (/date/.test(label)) return '2026-09-03';
    if (/time/.test(label)) return '12:34';
    return 'Tiny Tools audit sample 42';
  };

  const missingNames = [];
  const controls = [...shell.querySelectorAll('input, textarea, select, button')].filter(visible);
  for (const element of controls) {
    if (element.matches('input[type="hidden"]')) continue;
    const accessible = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.getAttribute('title') || element.closest('label') || (element.id && document.querySelector('label[for="' + CSS.escape(element.id) + '"]')) || (element instanceof HTMLButtonElement && element.textContent?.trim());
    if (!accessible && !(element instanceof HTMLInputElement && element.placeholder)) {
      missingNames.push(element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') + (element.getAttribute('type') ? '[' + element.getAttribute('type') + ']' : ''));
    }
  }

  let mutated = 0;
  for (const element of controls) {
    if (element.disabled || element.readOnly) continue;
    if (element instanceof HTMLButtonElement) continue;
    if (element instanceof HTMLSelectElement) {
      const option = [...element.options].find((item, index) => index > 0 && !item.disabled) ?? [...element.options].find((item) => !item.disabled);
      if (option && option.value !== element.value) {
        setNativeValue(element, option.value);
        mutated += 1;
      }
      continue;
    }
    if (element instanceof HTMLTextAreaElement) {
      setNativeValue(element, semanticText(labelFor(element)));
      mutated += 1;
      continue;
    }
    if (!(element instanceof HTMLInputElement)) continue;
    const type = (element.type || 'text').toLowerCase();
    if (['file', 'hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    if (type === 'checkbox') {
      element.click();
      mutated += 1;
      continue;
    }
    if (type === 'radio') continue;
    if (type === 'range') {
      const min = Number.isFinite(Number(element.min)) ? Number(element.min) : 0;
      const max = Number.isFinite(Number(element.max)) ? Number(element.max) : 100;
      setNativeValue(element, String((min + max) / 2));
      mutated += 1;
      continue;
    }
    if (type === 'number') {
      const min = element.min !== '' && Number.isFinite(Number(element.min)) ? Number(element.min) : 0;
      const max = element.max !== '' && Number.isFinite(Number(element.max)) ? Number(element.max) : Math.max(min + 100, 100);
      let value = Number(element.value);
      if (!Number.isFinite(value)) value = Math.max(min, 1);
      else value = Math.min(max, Math.max(min, value + (Number(element.step) || 1)));
      setNativeValue(element, String(value));
      mutated += 1;
      continue;
    }
    if (type === 'date') { setNativeValue(element, '2026-09-03'); mutated += 1; continue; }
    if (type === 'datetime-local') { setNativeValue(element, '2026-09-03T12:34'); mutated += 1; continue; }
    if (type === 'time') { setNativeValue(element, '12:34'); mutated += 1; continue; }
    if (type === 'month') { setNativeValue(element, '2026-09'); mutated += 1; continue; }
    if (type === 'week') { setNativeValue(element, '2026-W36'); mutated += 1; continue; }
    if (type === 'color') { setNativeValue(element, '#2563eb'); mutated += 1; continue; }
    if (type === 'email') { setNativeValue(element, 'audit@example.com'); mutated += 1; continue; }
    if (type === 'url') { setNativeValue(element, 'https://example.com/audit'); mutated += 1; continue; }
    if (type === 'tel') { setNativeValue(element, '+491234567890'); mutated += 1; continue; }
    if (type === 'password') { setNativeValue(element, 'Audit123!'); mutated += 1; continue; }
    setNativeValue(element, semanticText(labelFor(element)));
    mutated += 1;
  }

  const fileInputs = [...shell.querySelectorAll('input[type="file"]')].filter(visible).length;
  const enabledButtons = [...shell.querySelectorAll('button:not([disabled])')].filter(visible).length;
  return { controls: controls.length, mutated, fileInputs, enabledButtons, missingNames: [...new Set(missingNames)] };
})()`;

async function auditTool(tool) {
  const { target, cdp } = await openPage();
  const errors = collectErrors(cdp);
  try {
    await cdp.send('Page.navigate', { url: `${BASE_URL}#/tool/${tool.id}` });
    await waitFor(
      () => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.querySelector('[data-tool-id="${tool.id}"]'))`),
      `${tool.id} route`
    );
    await evaluate(cdp, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))`);

    const before = await evaluate(cdp, `(() => {
      const shell = document.querySelector('[data-tool-id="${tool.id}"]');
      const heading = shell?.querySelector('h1')?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const body = shell?.innerText ?? '';
      const content = shell?.querySelector('.tt-tool-content');
      const marker = /(?:coming soon|not implemented|under construction|todo\b|replace me)/i.exec(body)?.[0] ?? '';
      return {
        heading,
        bodyLength: body.trim().length,
        contentTextLength: content?.innerText.trim().length ?? 0,
        contentChildren: content?.children.length ?? 0,
        errorBoundary: document.body.innerText.includes('Something went wrong in this tool'),
        marker,
        overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
      };
    })()`);

    const findings = [];
    if (before.heading !== tool.name) findings.push(`heading mismatch: expected ${JSON.stringify(tool.name)}, found ${JSON.stringify(before.heading)}`);
    if (before.errorBoundary) findings.push('ErrorBoundary visible before interaction');
    if (before.marker) findings.push(`unfinished-product marker visible: ${before.marker}`);
    if (before.overflow) findings.push('horizontal overflow before interaction');
    if (before.contentChildren === 0 || before.contentTextLength === 0) findings.push('tool content is empty');

    const mutation = await evaluate(cdp, MUTATION_SCRIPT);
    await sleep(140);
    const after = await evaluate(cdp, `(() => ({
      shell: Boolean(document.querySelector('[data-tool-id="${tool.id}"]')),
      errorBoundary: document.body.innerText.includes('Something went wrong in this tool'),
      overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
      marker: /(?:coming soon|not implemented|under construction|todo\b|replace me)/i.exec(document.querySelector('[data-tool-id="${tool.id}"]')?.innerText ?? '')?.[0] ?? ''
    }))()`);

    if (!after.shell) findings.push('ToolShell disappeared after safe control mutation');
    if (after.errorBoundary) findings.push('ErrorBoundary visible after safe control mutation');
    if (after.overflow) findings.push('horizontal overflow after safe control mutation');
    if (after.marker) findings.push(`unfinished-product marker visible after interaction: ${after.marker}`);
    for (const missing of mutation.missingNames.slice(0, 8)) findings.push(`visible control lacks accessible name: ${missing}`);
    if (mutation.missingNames.length > 8) findings.push(`${mutation.missingNames.length - 8} additional visible controls lack accessible names`);

    findings.push(...errors);
    return {
      id: tool.id,
      category: tool.category,
      findings: [...new Set(findings)],
      controls: mutation.controls,
      mutated: mutation.mutated,
      fileInputs: mutation.fileInputs,
      enabledButtons: mutation.enabledButtons,
    };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function stopChrome(chrome) {
  if (chrome.exitCode !== null) return;
  chrome.kill('SIGTERM');
  await Promise.race([once(chrome, 'exit'), sleep(2_000)]);
  if (chrome.exitCode === null) {
    chrome.kill('SIGKILL');
    await Promise.race([once(chrome, 'exit'), sleep(2_000)]);
  }
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function main() {
  await stat(path.join(DIST, 'index.html')).catch(() => {
    throw new Error('dist/index.html is missing; run npm run build first.');
  });
  const tools = await getTools();
  const server = await createStaticServer();
  const chromeBinary = findChrome();
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-r11-chrome-'));
  const chrome = spawn(chromeBinary, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--metrics-recording-only',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeStderr = '';
  chrome.stderr.on('data', (chunk) => { chromeStderr += chunk.toString(); });

  try {
    await waitFor(async () => (await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(() => null))?.ok, 'Chrome DevTools endpoint', 15_000);
    console.log(`R11 full-catalog audit: ${tools.length} registered routes`);
    const failures = [];
    const profiles = { reactive: 0, upload: 0, action: 0, informational: 0 };
    let mutatedTools = 0;
    let totalControls = 0;
    let totalMutations = 0;

    for (let index = 0; index < tools.length; index += 1) {
      const tool = tools[index];
      try {
        const result = await auditTool(tool);
        totalControls += result.controls;
        totalMutations += result.mutated;
        if (result.mutated > 0) {
          profiles.reactive += 1;
          mutatedTools += 1;
        } else if (result.fileInputs > 0) profiles.upload += 1;
        else if (result.enabledButtons > 0) profiles.action += 1;
        else profiles.informational += 1;

        if (result.findings.length) {
          for (const finding of result.findings) failures.push(`[${tool.id}] ${finding}`);
          console.log(`✗ ${index + 1}/${tools.length} ${tool.id} (${result.findings.length})`);
        } else {
          console.log(`✓ ${index + 1}/${tools.length} ${tool.id}`);
        }
      } catch (error) {
        failures.push(`[${tool.id}] audit harness failure: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`✗ ${index + 1}/${tools.length} ${tool.id} (harness)`);
      }
    }

    console.log(`\nInteraction profiles: ${JSON.stringify(profiles)}`);
    console.log(`Safe reactive mutation exercised ${mutatedTools}/${tools.length} tools, ${totalMutations} mutations across ${totalControls} visible controls.`);

    if (failures.length) {
      console.error(`\nR11 full-catalog audit FAILED with ${failures.length} finding(s):`);
      failures.forEach((finding) => console.error(`- ${finding}`));
      process.exitCode = 1;
      return;
    }

    console.log('\nR11 full-catalog audit PASSED');
    console.log(`- ${tools.length}/${tools.length} routes mounted with canonical intent metadata`);
    console.log('- no unfinished-product markers or ErrorBoundary fallbacks were visible');
    console.log('- safe form-state mutation produced no runtime/console errors');
    console.log('- visible form controls passed accessible-name checks');
    console.log('- no audit-induced horizontal overflow was detected');
  } catch (error) {
    if (chromeStderr.trim()) console.error(`\nChrome stderr (tail):\n${chromeStderr.slice(-5000)}`);
    throw error;
  } finally {
    await closeServer(server);
    await stopChrome(chrome);
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
