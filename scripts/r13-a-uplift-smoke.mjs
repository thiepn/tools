import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const HOST = '127.0.0.1';
const PORT = 4184;
const DEBUG_PORT = 9234;
const BASE_URL = `http://${HOST}:${PORT}/tools/`;
const EXPECTED = 126;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, label, timeoutMs = 20000) {
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

async function targetIds() {
  const source = await readFile(path.join(ROOT, 'src/s-tier-a/manifest.ts'), 'utf8');
  const start = source.indexOf('STIER_A_TARGET_IDS');
  const end = source.indexOf('] as const', start);
  if (start < 0 || end < 0) throw new Error('Unable to locate STIER_A_TARGET_IDS.');
  const ids = [...source.slice(start, end).matchAll(/^\s*'([^']+)',?$/gm)].map((match) => match[1]);
  if (ids.length !== EXPECTED || new Set(ids).size !== EXPECTED) throw new Error(`Expected ${EXPECTED} unique A-tier IDs, found ${ids.length}.`);
  return ids;
}

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.wasm', 'application/wasm'],
  ['.woff', 'font/woff'], ['.woff2', 'font/woff2'],
]);

async function createStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
      if (url.pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
      if (!url.pathname.startsWith('/tools')) { response.writeHead(404).end('Not found'); return; }
      const relative = url.pathname === '/tools' || url.pathname === '/tools/' ? 'index.html' : url.pathname.slice('/tools/'.length);
      const candidate = path.resolve(DIST, relative);
      const rel = path.relative(DIST, candidate);
      if (rel.startsWith('..') || path.isAbsolute(rel)) { response.writeHead(403).end('Forbidden'); return; }
      const info = await stat(candidate);
      const file = info.isDirectory() ? path.join(candidate, 'index.html') : candidate;
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
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Browser evaluation failed');
  return result.result?.value;
}

async function main() {
  await stat(path.join(DIST, 'index.html')).catch(() => { throw new Error('dist/index.html missing. Run npm run build first.'); });
  const ids = await targetIds();
  const server = await createStaticServer();
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-r13-'));
  const chrome = spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--metrics-recording-only', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeStderr = '';
  chrome.stderr.on('data', (chunk) => { chromeStderr += chunk.toString(); });

  try {
    await waitFor(async () => {
      if (chrome.exitCode !== null) throw new Error(`Chrome exited early with ${chrome.exitCode}`);
      return (await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(() => null))?.ok;
    }, 'Chrome DevTools endpoint', 30000);
    const target = await (await fetch(`http://${HOST}:${DEBUG_PORT}/json/new?about%3Ablank`, { method: 'PUT' })).json();
    const cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.open();
    await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Log.enable')]);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, screenWidth: 1280, screenHeight: 900, deviceScaleFactor: 1, mobile: false });
    const runtimeErrors = [];
    cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeErrors.push(exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'unknown exception'));
    cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
      if (type !== 'error' && type !== 'assert') return;
      runtimeErrors.push((args ?? []).map((arg) => arg.value ?? arg.description ?? '').join(' ') || `console.${type}`);
    });

    console.log(`R13 A→S browser acceptance: ${ids.length} routes`);
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      const errorsBefore = runtimeErrors.length;
      await cdp.send('Page.navigate', { url: `${BASE_URL}#/tool/${id}` });
      await waitFor(() => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.querySelector('[data-tool-id="${id}"] [data-s-tier-workbench="${id}"]')) && Boolean(document.querySelector('[data-tool-id="${id}"] [data-s-tier-a-console="${id}"]'))`), `${id} S-tier workspaces`, 22000);
      await evaluate(cdp, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
      const state = await evaluate(cdp, `(() => {
        const shell = document.querySelector('[data-tool-id="${id}"]');
        const expert = shell?.querySelector('[data-s-tier-workbench="${id}"]');
        const pro = shell?.querySelector('[data-s-tier-a-console="${id}"]');
        const buttons = [...(expert?.querySelectorAll('button') ?? []), ...(pro?.querySelectorAll('button') ?? [])];
        return {
          expertHeading: expert?.querySelector('h2')?.textContent?.trim() ?? '',
          expertTabs: expert?.querySelectorAll('[role="tab"]').length ?? 0,
          proHeading: pro?.querySelector('h2')?.textContent?.trim() ?? '',
          proTabs: pro?.querySelectorAll('[role="tab"]').length ?? 0,
          fingerprint: /Fingerprint/i.test(pro?.innerText || ''),
          unnamedButtons: buttons.filter((button) => !(button.textContent?.trim() || button.getAttribute('aria-label') || button.getAttribute('title'))).length,
          errorBoundary: document.body.innerText.includes('Something went wrong in this tool'),
          overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
        };
      })()`);
      const findings = [];
      if (state.expertHeading !== 'Expert workspace') findings.push(`expert heading=${JSON.stringify(state.expertHeading)}`);
      if (state.expertTabs !== 4) findings.push(`expert tabs=${state.expertTabs}/4`);
      if (state.proHeading !== 'Professional QA console') findings.push(`pro heading=${JSON.stringify(state.proHeading)}`);
      if (state.proTabs !== 3) findings.push(`pro tabs=${state.proTabs}/3`);
      if (!state.fingerprint) findings.push('fingerprint surface missing');
      if (state.unnamedButtons) findings.push(`${state.unnamedButtons} unnamed buttons`);
      if (state.errorBoundary) findings.push('ErrorBoundary visible');
      if (state.overflow) findings.push('horizontal overflow');
      if (runtimeErrors.length > errorsBefore) findings.push(`runtime errors: ${runtimeErrors.slice(errorsBefore).join(' | ')}`);
      if (findings.length) throw new Error(`[${id}] ${findings.join('; ')}`);
      if ((index + 1) % 20 === 0 || index === ids.length - 1) console.log(`✓ ${index + 1}/${ids.length}`);
    }

    const representative = 'mortgage-calculator';
    await cdp.send('Page.navigate', { url: `${BASE_URL}#/tool/${representative}` });
    await waitFor(() => evaluate(cdp, `Boolean(document.querySelector('[data-s-tier-a-console="${representative}"]'))`), 'representative professional console');
    const tabsOpened = await evaluate(cdp, `(() => {
      const shell = document.querySelector('[data-tool-id="${representative}"]');
      const expert = shell?.querySelector('[data-s-tier-workbench="${representative}"]');
      const pro = shell?.querySelector('[data-s-tier-a-console="${representative}"]');
      const batch = [...(expert?.querySelectorAll('[role="tab"]') ?? [])].find((button) => /Batch & sensitivity/i.test(button.textContent || ''));
      const controls = [...(pro?.querySelectorAll('[role="tab"]') ?? [])].find((button) => /Control map/i.test(button.textContent || ''));
      batch?.click(); controls?.click();
      return Boolean(batch && controls);
    })()`);
    if (!tabsOpened) throw new Error('Representative expert/professional tabs are missing.');
    await waitFor(() => evaluate(cdp, `(() => {
      const shell=document.querySelector('[data-tool-id="${representative}"]');
      return /Batch runner/.test(shell?.innerText||'') && /Sensitivity sweep/.test(shell?.innerText||'') && /Filter controls by name or type/.test(shell?.innerText||'');
    })()`), 'representative advanced surfaces', 6000);

    console.log('R13 A→S browser acceptance PASSED');
    console.log(`- ${ids.length}/${ids.length} former A-tier routes mount both S-tier workspaces`);
    console.log('- expert scenarios/batch/sensitivity/file/trace plus professional QA/control/repeatability surfaces are present');
    console.log('- no route introduced ErrorBoundary fallback, unnamed workspace buttons, runtime exceptions, or horizontal overflow');
    cdp.close();
  } catch (error) {
    if (chromeStderr.trim()) console.error(`\nChrome stderr (tail):\n${chromeStderr.slice(-4000)}`);
    throw error;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (chrome.exitCode === null) {
      chrome.kill('SIGTERM');
      await Promise.race([once(chrome, 'exit'), sleep(2000)]);
      if (chrome.exitCode === null) chrome.kill('SIGKILL');
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
