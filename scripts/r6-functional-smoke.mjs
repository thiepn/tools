import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const HOST = '127.0.0.1';
const PORT = 4174;
const DEBUG_PORT = 9223;
const BASE_PATH = '/tools/';
const BASE_URL = `http://${HOST}:${PORT}${BASE_PATH}`;

const DESKTOP = { name: 'desktop', width: 1440, height: 1000, mobile: false };
const MOBILE = { name: 'mobile-320', width: 320, height: 844, mobile: true };

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

async function waitFor(check, label, timeoutMs = 10_000) {
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
    const handlers = this.listeners.get(method) ?? [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
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
    throw new Error(
      response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text ??
        'Browser evaluation failed'
    );
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

async function openPage(viewport) {
  const target = await newTarget();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Log.enable')]);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
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
    if (entry?.level === 'error') {
      errors.push(`browser log: ${entry.text ?? 'unknown error'}${entry.url ? ` (${entry.url})` : ''}`);
    }
  });
  return errors;
}

async function withPage(viewport, run) {
  const { target, cdp } = await openPage(viewport);
  const errors = collectErrors(cdp);
  try {
    const findings = await run(cdp);
    return [...findings, ...errors];
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function navigate(cdp, hash = '#/') {
  await cdp.send('Page.navigate', { url: `${BASE_URL}${hash}` });
  await waitFor(
    () => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.getElementById('main-content'))`),
    `route ${hash}`
  );
}

async function navigateTool(cdp, toolId) {
  await navigate(cdp, `#/tool/${toolId}`);
  await waitFor(
    () => evaluate(cdp, `Boolean(document.querySelector('[data-tool-id="${toolId}"]'))`),
    `${toolId} ToolShell`
  );
}

async function setValue(cdp, selector, value) {
  return evaluate(
    cdp,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing input: ${selector}');
      const proto = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(element, ${JSON.stringify(value)});
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`
  );
}

async function clickText(cdp, text, selector = 'button') {
  return evaluate(
    cdp,
    `(() => {
      const wanted = ${JSON.stringify(text)};
      const element = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find((node) => node.textContent?.replace(/\\s+/g, ' ').trim().includes(wanted));
      if (!element) throw new Error('Missing clickable text: ' + wanted);
      element.click();
      return true;
    })()`
  );
}

async function clearLocalStorage(cdp) {
  await evaluate(cdp, `localStorage.clear(); true`);
}

async function flowDashboardSearch() {
  return withPage(MOBILE, async (cdp) => {
    const findings = [];
    await navigate(cdp);
    await waitFor(() => evaluate(cdp, `Boolean(document.getElementById('dashboard-search-input'))`), 'dashboard search');
    await setValue(cdp, '#dashboard-search-input', 'unit converter');
    await waitFor(
      () => evaluate(cdp, `Boolean(document.querySelector('a[href="#/tool/unit-converter"]'))`),
      'Unit Converter search result'
    );
    await evaluate(cdp, `document.querySelector('a[href="#/tool/unit-converter"]')?.click(); true`);
    await waitFor(
      () => evaluate(cdp, `Boolean(document.querySelector('[data-tool-id="unit-converter"]'))`),
      'search-result navigation'
    );
    if ((await evaluate(cdp, `window.innerWidth`)) !== 320) {
      findings.push('mobile search journey lost the 320px viewport');
    }
    return findings;
  });
}

async function flowTextCleaner() {
  return withPage(MOBILE, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'text-cleaner');
    await setValue(cdp, '#cleaner-input-textarea', '  “Hello”   world   \n  second   line  ');
    await waitFor(
      () => evaluate(cdp, `document.getElementById('cleaner-output-textarea')?.value === '"Hello" world\\nsecond line'`),
      'cleaned text output'
    );
    const disabled = await evaluate(cdp, `document.getElementById('copy-clean-text-btn')?.disabled ?? true`);
    if (disabled) findings.push('Text Cleaner copy action remained disabled after producing output');
    return findings;
  });
}

async function flowCaseConverter() {
  return withPage(DESKTOP, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'case-converter');
    await setValue(cdp, '#case-converter-input', 'hello world example');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('helloWorldExample')`), 'camelCase output');
    if (!(await evaluate(cdp, `document.body.innerText.includes('HELLO_WORLD_EXAMPLE')`))) {
      findings.push('Case Converter did not render CONSTANT_CASE output');
    }
    return findings;
  });
}

async function flowJsonFormatterAndDownload() {
  return withPage(DESKTOP, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'json-formatter');
    await evaluate(cdp, `(() => {
      window.__r6Download = null;
      window.__r6Blob = null;
      URL.createObjectURL = (blob) => { window.__r6Blob = blob; return 'blob:r6-functional'; };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function () {
        window.__r6Download = { download: this.download, href: this.href };
      };
      return true;
    })()`);
    await setValue(cdp, '#json-input-textarea', '{"b":2,"a":1}');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Valid JSON document')`), 'valid JSON state');
    await clickText(cdp, 'Sort Object Keys', 'label');
    await waitFor(
      () => evaluate(cdp, `(() => {
        const value = document.getElementById('json-output-textarea')?.value ?? '';
        return value.indexOf('"a"') < value.indexOf('"b"');
      })()`),
      'sorted JSON output'
    );
    await clickText(cdp, 'Download');
    await waitFor(() => evaluate(cdp, `Boolean(window.__r6Download?.download)`), 'JSON download action');
    const download = await evaluate(cdp, `window.__r6Download`);
    if (!download.download.endsWith('.json')) findings.push(`JSON export filename is not .json: ${download.download}`);
    const blobText = await evaluate(cdp, `window.__r6Blob ? window.__r6Blob.text() : ''`);
    if (!blobText.includes('"a"') || !blobText.includes('"b"')) {
      findings.push('JSON export Blob did not contain formatted JSON');
    }
    await setValue(cdp, '#json-input-textarea', '{"a":}');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('JSON Syntax Error')`), 'invalid JSON state');
    return findings;
  });
}

async function flowUnitConverter() {
  return withPage(DESKTOP, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'unit-converter');
    await setValue(cdp, '#unit-converter-input', '1');
    await setValue(cdp, '#unit-converter-from-unit', 'm');
    await setValue(cdp, '#unit-converter-to-unit', 'ft');
    await waitFor(
      () => evaluate(cdp, `document.getElementById('unit-converter-output')?.value === '3.2808399'`),
      'metres-to-feet conversion'
    );
    await evaluate(cdp, `document.querySelector('button[aria-label="Swap source and target units"]')?.click(); true`);
    await waitFor(
      () => evaluate(cdp, `document.getElementById('unit-converter-output')?.value === '0.3048'`),
      'swapped feet-to-metres conversion'
    );
    return findings;
  });
}

async function flowPercentageCalculator() {
  return withPage(DESKTOP, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'percentage-calculator');
    const resultSelector = `(() => {
      const label = [...document.querySelectorAll('div')].find((node) => node.textContent?.trim() === 'Calculated Result');
      return label?.parentElement?.querySelector('.text-3xl')?.textContent?.trim() ?? '';
    })()`;
    await waitFor(() => evaluate(cdp, `${resultSelector} === '37.5'`), 'default percentage result');
    const inputs = await evaluate(cdp, `[...document.querySelectorAll('[data-tool-id="percentage-calculator"] input[type="text"]')].length`);
    if (inputs < 2) return ['Percentage Calculator did not expose the expected numeric inputs'];
    await evaluate(cdp, `(() => {
      const inputs = [...document.querySelectorAll('[data-tool-id="percentage-calculator"] input[type="text"]')];
      const set = (element, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(inputs[0], '20');
      set(inputs[1], '50');
      return true;
    })()`);
    await waitFor(() => evaluate(cdp, `${resultSelector} === '10'`), '20 percent of 50');
    return findings;
  });
}

async function flowCrossToolTransfer() {
  return withPage(DESKTOP, async (cdp) => {
    const findings = [];
    const payload = 'alpha beta gamma';
    await navigateTool(cdp, 'text-cleaner');
    await setValue(cdp, '#cleaner-input-textarea', payload);
    await waitFor(
      () => evaluate(cdp, `document.getElementById('cleaner-output-textarea')?.value === ${JSON.stringify(payload)}`),
      'transfer source output'
    );
    await evaluate(cdp, `document.getElementById('send-output-menu-btn')?.click(); true`);
    await waitFor(() => evaluate(cdp, `Boolean(document.getElementById('transfer-menu-popup'))`), 'transfer menu');
    await clickText(cdp, 'Word & Character Counter');
    await waitFor(
      () => evaluate(cdp, `document.getElementById('word-counter-input')?.value === ${JSON.stringify(payload)}`),
      'transferred Word Counter input'
    );
    const storageContainsPayload = await evaluate(
      cdp,
      `[...Array(localStorage.length)].some((_, index) => (localStorage.getItem(localStorage.key(index)) ?? '').includes(${JSON.stringify(payload)}))`
    );
    if (storageContainsPayload) findings.push('Transient cross-tool payload leaked into localStorage');
    return findings;
  });
}

async function flowNotepadPersistence() {
  return withPage(DESKTOP, async (cdp) => {
    const findings = [];
    await navigate(cdp);
    await clearLocalStorage(cdp);
    await navigateTool(cdp, 'notepad');
    const selector = '[data-tool-id="notepad"] textarea';
    await setValue(cdp, selector, 'R6 persistent note');
    await waitFor(
      () => evaluate(cdp, `[...Array(localStorage.length)].some((_, index) => (localStorage.getItem(localStorage.key(index)) ?? '').includes('R6 persistent note'))`),
      'Notepad local save'
    );
    await cdp.send('Page.reload');
    await waitFor(
      () => evaluate(cdp, `document.querySelector('[data-tool-id="notepad"] textarea')?.value === 'R6 persistent note'`),
      'Notepad persisted content'
    );
    return findings;
  });
}

async function flowChecklistPersistence() {
  return withPage(DESKTOP, async (cdp) => {
    const findings = [];
    await navigate(cdp);
    await clearLocalStorage(cdp);

    // Checklist intentionally ships with a populated travel example. Seed a
    // valid empty list so this journey deterministically tests add/check/reload
    // persistence rather than making assumptions about product defaults.
    await evaluate(cdp, `(() => {
      localStorage.setItem('tiny_tools_checklist_store_v1', JSON.stringify({
        version: 1,
        activeListId: 'r6-checklist',
        lists: [{
          id: 'r6-checklist',
          title: 'R6 Checklist',
          updatedAt: Date.now(),
          items: []
        }]
      }));
      return true;
    })()`);

    await navigateTool(cdp, 'checklist');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('0 of 0 completed (0%)')`), 'empty R6 checklist');
    const selector = 'input[placeholder="Add new checklist item..."]';
    await setValue(cdp, selector, 'Passport');
    await evaluate(cdp, `document.querySelector(${JSON.stringify(selector)})?.closest('form')?.requestSubmit(); true`);
    await waitFor(
      () => evaluate(cdp, `document.body.innerText.includes('Passport') && document.body.innerText.includes('0 of 1 completed (0%)')`),
      'new checklist item'
    );
    await clickText(cdp, 'Check All');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('1 of 1 completed (100%)')`), 'checked checklist state');
    await waitFor(
      () => evaluate(cdp, `[...Array(localStorage.length)].some((_, index) => {
        const value = localStorage.getItem(localStorage.key(index)) ?? '';
        return value.includes('Passport') && value.includes('"completed":true');
      })`),
      'Checklist local save'
    );
    await cdp.send('Page.reload');
    await waitFor(
      () => evaluate(cdp, `document.body.innerText.includes('Passport') && document.body.innerText.includes('1 of 1 completed (100%)')`),
      'persisted checklist state'
    );
    return findings;
  });
}

async function flowDuplicateFinder() {
  return withPage(DESKTOP, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'duplicate-finder');
    await evaluate(cdp, `(() => {
      const heading = [...document.querySelectorAll('h3')]
        .find((node) => node.textContent?.includes('Choose or Drop Files to Find Duplicates'));
      const dropzone = heading?.parentElement;
      if (!dropzone) throw new Error('Duplicate Finder dropzone not found');
      const transfer = new DataTransfer();
      transfer.items.add(new File(['same-r6-content'], 'copy-a.txt', { type: 'text/plain', lastModified: 1000 }));
      transfer.items.add(new File(['same-r6-content'], 'copy-b.txt', { type: 'text/plain', lastModified: 2000 }));
      transfer.items.add(new File(['different-r6-content'], 'unique.txt', { type: 'text/plain', lastModified: 3000 }));
      dropzone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      return true;
    })()`);
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Found 1 Duplicate Sets')`), 'SHA-256 duplicate scan', 15_000);
    const state = await evaluate(
      cdp,
      `({
        a: document.body.innerText.includes('copy-a.txt'),
        b: document.body.innerText.includes('copy-b.txt'),
        unique: document.body.innerText.includes('unique.txt')
      })`
    );
    if (!state.a || !state.b) findings.push('Duplicate Finder result omitted one of the matching files');
    if (state.unique) findings.push('Duplicate Finder incorrectly listed the unique file inside duplicate results');
    return findings;
  });
}

const FLOWS = [
  ['dashboard search → tool', flowDashboardSearch],
  ['Text Cleaner live transform', flowTextCleaner],
  ['Case Converter outputs', flowCaseConverter],
  ['JSON validation + export', flowJsonFormatterAndDownload],
  ['Unit Converter + swap', flowUnitConverter],
  ['Percentage Calculator', flowPercentageCalculator],
  ['in-memory cross-tool transfer', flowCrossToolTransfer],
  ['Notepad persistence', flowNotepadPersistence],
  ['Checklist persistence', flowChecklistPersistence],
  ['Duplicate Finder SHA-256 scan', flowDuplicateFinder],
];

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

  const server = await createStaticServer();
  const chromeBinary = findChrome();
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-r6-chrome-'));
  const chrome = spawn(
    chromeBinary,
    [
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
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  let chromeStderr = '';
  chrome.stderr.on('data', (chunk) => {
    chromeStderr += chunk.toString();
  });

  try {
    await waitFor(
      async () => (await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(() => null))?.ok,
      'Chrome DevTools endpoint',
      15_000
    );

    console.log(`R6 functional Chromium acceptance: ${FLOWS.length} end-to-end journeys`);
    console.log(`Serving ${BASE_URL} under the GitHub Pages project-path model`);

    const failures = [];
    for (const [name, flow] of FLOWS) {
      try {
        const findings = await flow();
        if (findings.length) {
          findings.forEach((finding) => failures.push(`[${name}] ${finding}`));
          console.log(`✗ ${name}`);
        } else {
          console.log(`✓ ${name}`);
        }
      } catch (error) {
        failures.push(`[${name}] ${error instanceof Error ? error.message : String(error)}`);
        console.log(`✗ ${name}`);
      }
    }

    if (failures.length) {
      console.error(`\nR6 functional acceptance FAILED with ${failures.length} finding(s):`);
      failures.forEach((finding) => console.error(`- ${finding}`));
      process.exitCode = 1;
      return;
    }

    console.log('\nR6 functional acceptance PASSED');
    console.log(`- ${FLOWS.length}/${FLOWS.length} journeys passed`);
    console.log('- live text/math transformations verified');
    console.log('- JSON validation and browser export verified');
    console.log('- cross-tool transfer verified without localStorage payload persistence');
    console.log('- Notepad and Checklist intentional local persistence verified');
    console.log('- SHA-256 duplicate-file detection verified with synthetic browser Files');
    console.log('- representative mobile and desktop workflows passed');
  } catch (error) {
    if (chromeStderr.trim()) console.error(`\nChrome stderr (tail):\n${chromeStderr.slice(-4000)}`);
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
