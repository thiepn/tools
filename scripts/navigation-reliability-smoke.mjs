import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const HOST = '127.0.0.1';
const PORT = 4179;
const DEBUG_PORT = 9229;
const BASE_PATH = '/tools/';
const BASE_URL = `http://${HOST}:${PORT}${BASE_PATH}`;
const ROUTES = ['text-cleaner', 'qr-studio', 'image-optimizer'];

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

async function waitFor(check, label, timeoutMs = 15_000, intervalMs = 100) {
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

async function waitForTool(cdp, toolId, label) {
  await waitFor(
    () => evaluate(
      cdp,
      `location.hash === '#/tool/${toolId}' && Boolean(document.querySelector('[data-tool-id="${toolId}"]')) && !document.body.innerText.includes('Something went wrong in this tool') && !document.body.innerText.includes('Tiny Tools could not load this tool')`
    ),
    label
  );
}

await stat(path.join(DIST, 'index.html')).catch(() => {
  throw new Error('dist/index.html is missing; run npm run build first.');
});

const server = await createStaticServer();
const chromeBinary = findChrome();
const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-navigation-'));
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
chrome.stderr.on('data', (chunk) => { chromeStderr += chunk.toString(); });

try {
  await waitFor(async () => (await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(() => null))?.ok, 'Chrome DevTools endpoint');
  const target = await createTarget();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  const failures = [];
  try {
    await cdp.open();
    await Promise.all([
      cdp.send('Page.enable'),
      cdp.send('Runtime.enable'),
      cdp.send('Network.enable'),
      cdp.send('Log.enable'),
    ]);

    cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      failures.push(`uncaught: ${exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'unknown exception'}`);
    });
    cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
      if (type !== 'error' && type !== 'assert') return;
      const text = (args ?? []).map((arg) => arg.value ?? arg.description ?? '').filter(Boolean).join(' ');
      failures.push(`console.${type}: ${text || 'unknown browser error'}`);
    });
    cdp.on('Network.responseReceived', ({ response }) => {
      if (!response?.url?.startsWith(`http://${HOST}:${PORT}`)) return;
      if (response.status >= 400 && !response.url.endsWith('/favicon.ico')) {
        failures.push(`HTTP ${response.status}: ${response.url}`);
      }
    });
    cdp.on('Network.loadingFailed', ({ errorText, canceled }) => {
      if (!canceled) failures.push(`network load failed: ${errorText}`);
    });

    await cdp.send('Page.navigate', { url: `${BASE_URL}#/tool/${ROUTES[0]}` });
    await waitForTool(cdp, ROUTES[0], 'direct tool navigation');

    await cdp.send('Page.reload', { ignoreCache: true });
    await waitForTool(cdp, ROUTES[0], 'tool refresh');

    await evaluate(cdp, `location.hash = '#/tool/${ROUTES[1]}'; true`);
    await waitForTool(cdp, ROUTES[1], 'sequential lazy route 2');
    await evaluate(cdp, `location.hash = '#/tool/${ROUTES[2]}'; true`);
    await waitForTool(cdp, ROUTES[2], 'sequential lazy route 3');

    await evaluate(cdp, `history.back(); true`);
    await waitForTool(cdp, ROUTES[1], 'browser history back');
    await evaluate(cdp, `history.forward(); true`);
    await waitForTool(cdp, ROUTES[2], 'browser history forward');

    await cdp.send('Page.navigate', { url: BASE_URL });
    await waitFor(
      () => evaluate(cdp, `location.hash === '' && Boolean(document.getElementById('dashboard-title'))`),
      'direct dashboard navigation'
    );

    await sleep(250);
    if (failures.length) throw new Error(`Navigation reliability failed:\n- ${failures.join('\n- ')}`);
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }

  console.log('Navigation reliability smoke PASSED');
  console.log('- direct tool URL rendered');
  console.log('- refresh inside a tool preserved the route');
  console.log('- sequential lazy tool navigation rendered all requested tools');
  console.log('- browser back/forward restored tool routes');
  console.log('- direct Tiny Tools home navigation rendered');
  console.log('- no uncaught browser errors or failed same-origin assets');
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
