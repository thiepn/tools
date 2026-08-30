import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const rawUrl = process.argv[2] || process.env.TINY_TOOLS_LIVE_URL;
if (!rawUrl) {
  throw new Error('Usage: node scripts/r9-live-site-smoke.mjs <https://owner.github.io/repo/>');
}

const baseUrl = new URL(rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`);
if (baseUrl.protocol !== 'https:') {
  throw new Error(`R9 requires an HTTPS live-site URL, received ${baseUrl.href}`);
}

const HOST = '127.0.0.1';
const DEBUG_PORT = 9227;
const EXPECTED_TOOLS = ['text-cleaner', 'barcode-studio', 'speech-to-text'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, label, timeoutMs = 120_000, intervalMs = 500) {
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

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return { response, text: await response.text() };
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

async function verifyStaticSite() {
  const { response, text: html } = await waitFor(
    async () => {
      try {
        const result = await fetchText(baseUrl.href);
        if (!/Tiny Tools/i.test(result.text)) return false;
        return result;
      } catch {
        return false;
      }
    },
    `published Tiny Tools index at ${baseUrl.href}`
  );

  if (!response.url.startsWith(baseUrl.origin)) {
    throw new Error(`Live-site redirect left the expected origin: ${response.url}`);
  }

  const scriptSrc = html.match(/<script[^>]+src=["']([^"']+\.js)["']/i)?.[1];
  const stylesheetHref =
    html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css)["']/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+\.css)["'][^>]+rel=["']stylesheet["']/i)?.[1];

  if (!scriptSrc || !stylesheetHref) {
    throw new Error('Published index.html does not expose the expected initial JavaScript and CSS assets.');
  }

  for (const asset of [scriptSrc, stylesheetHref]) {
    const resolved = new URL(asset, baseUrl);
    if (resolved.origin !== baseUrl.origin) {
      throw new Error(`Initial asset escaped the Pages origin: ${resolved.href}`);
    }
    if (!resolved.pathname.startsWith(baseUrl.pathname)) {
      throw new Error(`Initial asset is not repository-subpath safe: ${resolved.pathname}`);
    }
    const assetResponse = await fetch(resolved, { redirect: 'follow', cache: 'no-store' });
    if (!assetResponse.ok) throw new Error(`Initial asset failed: ${assetResponse.status} ${resolved.href}`);
  }

  return { scriptSrc, stylesheetHref };
}

async function verifyBrowserRoutes() {
  const chromeBinary = findChrome();
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-r9-chrome-'));
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
    await waitFor(async () => (await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(() => null))?.ok, 'Chrome DevTools endpoint', 20_000, 100);
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
        if (!response?.url?.startsWith(baseUrl.origin)) return;
        if (response.status >= 400 && !response.url.endsWith('/favicon.ico')) {
          failures.push(`HTTP ${response.status}: ${response.url}`);
        }
      });
      cdp.on('Network.loadingFailed', ({ errorText, canceled }) => {
        if (!canceled) failures.push(`network load failed: ${errorText}`);
      });

      await cdp.send('Page.navigate', { url: `${baseUrl.href}#/` });
      await waitFor(
        () => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.getElementById('main-content')) && document.body.innerText.includes('Tiny Tools')`),
        'live dashboard render',
        20_000,
        150
      );

      const liveLocation = await evaluate(cdp, `({ origin: location.origin, pathname: location.pathname, hash: location.hash })`);
      if (liveLocation.origin !== baseUrl.origin || liveLocation.pathname !== baseUrl.pathname || liveLocation.hash !== '#/') {
        failures.push(`unexpected live dashboard location: ${JSON.stringify(liveLocation)}`);
      }

      for (const toolId of EXPECTED_TOOLS) {
        await cdp.send('Page.navigate', { url: `${baseUrl.href}#/tool/${toolId}` });
        await waitFor(
          () => evaluate(cdp, `Boolean(document.querySelector('[data-tool-id="${toolId}"]'))`),
          `live route ${toolId}`,
          20_000,
          150
        );
        const route = await evaluate(cdp, `location.pathname + location.hash`);
        if (route !== `${baseUrl.pathname}#/tool/${toolId}`) failures.push(`route mismatch for ${toolId}: ${route}`);
      }

      await sleep(500);
      if (failures.length) throw new Error(`Live browser acceptance failed:\n- ${failures.join('\n- ')}`);
    } finally {
      cdp.close();
      await closeTarget(target.id);
    }
  } catch (error) {
    if (chromeStderr.trim()) console.error(`Chrome stderr (tail):\n${chromeStderr.slice(-3000)}`);
    throw error;
  } finally {
    if (chrome.exitCode === null) {
      chrome.kill('SIGTERM');
      await Promise.race([once(chrome, 'exit'), sleep(2_000)]);
      if (chrome.exitCode === null) chrome.kill('SIGKILL');
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

console.log(`R9 live-site acceptance: ${baseUrl.href}`);
const assets = await verifyStaticSite();
console.log(`✓ published index and initial assets (${assets.scriptSrc}, ${assets.stylesheetHref})`);
await verifyBrowserRoutes();
console.log(`✓ dashboard + ${EXPECTED_TOOLS.length} representative lazy routes rendered from the public Pages origin`);
console.log('✓ no uncaught browser errors or failed same-origin production assets detected');
console.log('\nR9 live-site acceptance PASSED');
