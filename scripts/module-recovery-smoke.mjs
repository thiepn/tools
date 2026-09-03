import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const HOST = '127.0.0.1';
const PORT = 4178;
const DEBUG_PORT = 9228;
const BASE_PATH = '/tools/';
const BASE_URL = `http://${HOST}:${PORT}${BASE_PATH}`;
const RECOVERY_KEY = 'tiny-tools:module-load-recovery:v1';
const RECOVERY_PARAM = '__tiny_tools_recovery';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function waitFor(check, label, timeoutMs = 20_000, intervalMs = 100) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
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
  }

  async open() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', () => reject(new Error('Unable to open CDP WebSocket')), { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
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
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Browser evaluation failed');
  }
  return result.result?.value;
}

async function createTarget() {
  const response = await fetch(`http://${HOST}:${DEBUG_PORT}/json/new?about%3Ablank`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Unable to create Chrome target: HTTP ${response.status}`);
  return response.json();
}

async function closeTarget(id) {
  await fetch(`http://${HOST}:${DEBUG_PORT}/json/close/${id}`).catch(() => null);
}

const html = await readFile(path.join(DIST, 'index.html'), 'utf8');
const entryUrl = html.match(/<script[^>]+src=["']([^"']+\.js)["']/i)?.[1];
if (!entryUrl || !entryUrl.startsWith(BASE_PATH)) {
  throw new Error(`Expected a ${BASE_PATH} production entry script; received ${entryUrl ?? 'none'}.`);
}
const entryRelative = entryUrl.slice(BASE_PATH.length);
const currentEntry = await readFile(path.join(DIST, entryRelative), 'utf8');
const qrChunk = currentEntry.match(/QrStudioTool-[A-Za-z0-9_-]+\.js/)?.[0];
if (!qrChunk) throw new Error('Could not identify the QR Studio production chunk in the main entry.');

const staleA = 'QrStudioTool-stale-version-a.js';
const staleB = 'QrStudioTool-stale-version-b.js';
const versionAEntry = currentEntry.replaceAll(qrChunk, staleA);
const versionBEntry = currentEntry.replaceAll(qrChunk, staleB);
if (versionAEntry === currentEntry || versionBEntry === currentEntry) {
  throw new Error('Unable to synthesize stale version entry bundles.');
}

const scenario = { mode: 'recover', generation: 'A', documentRequests: 0, staleRequests: 0 };
function resetScenario(mode) {
  scenario.mode = mode;
  scenario.generation = 'A';
  scenario.documentRequests = 0;
  scenario.staleRequests = 0;
}

function resolveDistPath(requestPath) {
  if (!requestPath.startsWith(BASE_PATH)) return null;
  const candidate = path.resolve(DIST, requestPath.slice(BASE_PATH.length));
  const relative = path.relative(DIST, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
    const pathname = decodeURIComponent(url.pathname);
    const headers = { 'Cache-Control': 'no-store' };

    if (pathname === '/favicon.ico') return void response.writeHead(204, headers).end();
    if (pathname === '/tools' || pathname === BASE_PATH) {
      scenario.documentRequests += 1;
      response.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
      return void response.end(html);
    }
    if (pathname === `${BASE_PATH}${entryRelative}`) {
      const body = scenario.generation === 'A'
        ? versionAEntry
        : scenario.mode === 'recover'
          ? currentEntry
          : versionBEntry;
      response.writeHead(200, { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' });
      return void response.end(body);
    }
    if (pathname.endsWith(`/${staleA}`)) {
      scenario.staleRequests += 1;
      scenario.generation = 'B';
      response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      return void response.end('Version A chunk was removed by deployment B.');
    }
    if (pathname.endsWith(`/${staleB}`)) {
      scenario.staleRequests += 1;
      response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      return void response.end('Version B chunk is also unavailable.');
    }

    const file = resolveDistPath(pathname);
    if (!file) return void response.writeHead(404, headers).end('Not found');
    const info = await stat(file);
    const target = info.isDirectory() ? path.join(file, 'index.html') : file;
    response.writeHead(200, {
      ...headers,
      'Content-Type': MIME.get(path.extname(target).toLowerCase()) ?? 'application/octet-stream',
    });
    response.end(await readFile(target));
  } catch (error) {
    if (error?.code === 'ENOENT') response.writeHead(404).end('Not found');
    else response.writeHead(500).end('Server error');
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, HOST, resolve);
});

const chromeBinary = findChrome();
const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-module-recovery-'));
const chrome = spawn(chromeBinary, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-component-update', '--disable-sync', '--metrics-recording-only',
  `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let chromeStderr = '';
chrome.stderr.on('data', (chunk) => { chromeStderr += chunk.toString(); });

async function withTarget({ blockSessionStorage = false } = {}, run) {
  const target = await createTarget();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  try {
    await cdp.open();
    await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable')]);
    if (blockSessionStorage) {
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('sessionStorage blocked for test', 'SecurityError'); } });`,
      });
    }
    return await run(cdp);
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function runRecoverScenario({ blockSessionStorage = false } = {}) {
  resetScenario('recover');
  await withTarget({ blockSessionStorage }, async (cdp) => {
    await cdp.send('Page.navigate', { url: `${BASE_URL}#/tool/qr-studio` });
    await waitFor(
      () => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.querySelector('[data-tool-id="qr-studio"]'))`),
      blockSessionStorage ? 'storage-blocked stale-chunk recovery' : 'automatic stale-chunk recovery to QR Studio'
    );
    const state = await evaluate(cdp, `(() => ({
      hash: location.hash,
      queryMarker: new URL(location.href).searchParams.get(${JSON.stringify(RECOVERY_PARAM)}),
      storageMarker: (() => { try { return sessionStorage.getItem(${JSON.stringify(RECOVERY_KEY)}); } catch { return 'BLOCKED'; } })(),
      hasFallback: document.body.innerText.includes('Tiny Tools could not load this tool')
    }))()`);
    if (state.hash !== '#/tool/qr-studio') throw new Error(`Recovered route changed unexpectedly: ${state.hash}`);
    if (state.queryMarker !== null) throw new Error('Recovery URL marker was not cleared after successful render.');
    if (!blockSessionStorage && state.storageMarker !== null) throw new Error('sessionStorage marker was not cleared after successful render.');
    if (blockSessionStorage && state.storageMarker !== 'BLOCKED') throw new Error('Storage-blocked scenario did not actually block sessionStorage.');
    if (state.hasFallback) throw new Error('Error fallback remained visible after successful recovery.');
    if (scenario.documentRequests !== 2) throw new Error(`Expected exactly one automatic reload; saw ${scenario.documentRequests - 1}.`);
    if (scenario.staleRequests !== 1) throw new Error(`Expected one stale version-A chunk request; saw ${scenario.staleRequests}.`);
  });
}

async function runPersistentScenario({ blockSessionStorage = false } = {}) {
  resetScenario('persistent');
  await withTarget({ blockSessionStorage }, async (cdp) => {
    await cdp.send('Page.navigate', { url: `${BASE_URL}#/tool/qr-studio` });
    await waitFor(
      () => evaluate(cdp, `document.body.innerText.includes('Tiny Tools could not load this tool') && document.body.innerText.includes('Reload Tiny Tools')`),
      blockSessionStorage ? 'storage-blocked persistent module failure fallback' : 'persistent module failure fallback'
    );
    await sleep(1_000);
    const state = await evaluate(cdp, `(() => ({
      queryMarker: new URL(location.href).searchParams.get(${JSON.stringify(RECOVERY_PARAM)}),
      storageMarker: (() => { try { return sessionStorage.getItem(${JSON.stringify(RECOVERY_KEY)}); } catch { return 'BLOCKED'; } })(),
      details: Boolean(document.querySelector('details')),
      returnLink: Boolean(document.querySelector('a[href="#/"]'))
    }))()`);
    if (!state.queryMarker) throw new Error('Persistent failure lost its URL one-reload guard marker.');
    if (!blockSessionStorage && !state.storageMarker) throw new Error('Persistent failure lost its storage guard marker.');
    if (blockSessionStorage && state.storageMarker !== 'BLOCKED') throw new Error('Storage-blocked persistent scenario did not block sessionStorage.');
    if (!state.details) throw new Error('Persistent failure did not expose technical diagnostics.');
    if (!state.returnLink) throw new Error('Persistent failure did not expose Return to All Tools.');
    if (scenario.documentRequests !== 2) throw new Error(`Persistent failure entered a reload loop (${scenario.documentRequests} document requests).`);
    if (scenario.staleRequests !== 2) throw new Error(`Expected one missing chunk per simulated version; saw ${scenario.staleRequests}.`);
  });
}

try {
  await waitFor(async () => (await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(() => null))?.ok, 'Chrome DevTools endpoint', 15_000);

  await runRecoverScenario();
  console.log('✓ version A stale chunk triggers exactly one cache-busting reload and recovers on version B');
  await runPersistentScenario();
  console.log('✓ a second missing version-B chunk stops reloading and shows diagnostics');
  await runRecoverScenario({ blockSessionStorage: true });
  console.log('✓ recovery still succeeds when sessionStorage is completely blocked');
  await runPersistentScenario({ blockSessionStorage: true });
  console.log('✓ URL guard still prevents reload loops when sessionStorage is completely blocked');
  console.log('\nModule recovery deployment-upgrade smoke PASSED');
} catch (error) {
  if (chromeStderr.trim()) console.error(`Chrome stderr (tail):\n${chromeStderr.slice(-3000)}`);
  throw error;
} finally {
  if (chrome.exitCode === null) {
    chrome.kill('SIGTERM');
    await Promise.race([once(chrome, 'exit'), sleep(2_000)]);
    if (chrome.exitCode === null) chrome.kill('SIGKILL');
  }
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
