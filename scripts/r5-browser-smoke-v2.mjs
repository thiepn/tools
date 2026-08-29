import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const REGISTRY = path.resolve(ROOT, 'src/registry/tools.ts');
const HOST = '127.0.0.1';
const PORT = 4173;
const DEBUG_PORT = 9222;
const BASE_PATH = '/tools/';
const BASE_URL = `http://${HOST}:${PORT}${BASE_PATH}`;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
  { name: 'mobile-320', width: 320, height: 844, mobile: true },
];

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

const KEY_CODES = {
  Tab: 9,
  Enter: 13,
  Escape: 27,
  '/': 191,
};

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
    await sleep(100);
  }
  throw new Error(
    `Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`
  );
}

async function getToolIds() {
  const source = await readFile(REGISTRY, 'utf8');
  const registryOnly = source.split('export const CATEGORIES')[0];
  const ids = [...registryOnly.matchAll(/^\s*id:\s*'([^']+)'/gm)].map((match) => match[1]);
  if (ids.length !== 50 || new Set(ids).size !== 50) {
    throw new Error(`Expected 50 unique registered tools; found ${ids.length}.`);
  }
  return ids;
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
      this.ws.addEventListener(
        'error',
        () => reject(new Error(`Unable to open CDP WebSocket ${this.url}`)),
        { once: true }
      );
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

      for (const handler of this.listeners.get(message.method) ?? []) {
        handler(message.params ?? {});
      }
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
    for (const pending of this.pending.values()) {
      pending.reject(new Error('CDP session closed.'));
    }
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
        'Browser evaluation failed.'
    );
  }
  return response.result?.value;
}

async function newTarget() {
  const response = await fetch(`http://${HOST}:${DEBUG_PORT}/json/new?about%3Ablank`, {
    method: 'PUT',
  });
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
  await Promise.all([
    cdp.send('Page.enable'),
    cdp.send('Runtime.enable'),
    cdp.send('Log.enable'),
  ]);
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
    errors.push(
      `uncaught: ${exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'unknown exception'}`
    );
  });
  cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
    if (type !== 'error' && type !== 'assert') return;
    const text = (args ?? [])
      .map((arg) => arg.value ?? arg.description ?? '')
      .filter(Boolean)
      .join(' ');
    errors.push(`console.${type}: ${text || 'unknown console error'}`);
  });
  cdp.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level === 'error') errors.push(`browser log: ${entry.text ?? 'unknown error'}`);
  });
  return errors;
}

async function pressKey(cdp, key, code, text = '') {
  const virtualKeyCode = KEY_CODES[key] ?? 0;
  const common = {
    key,
    code,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  };
  await cdp.send('Input.dispatchKeyEvent', {
    ...common,
    type: 'keyDown',
    text,
    unmodifiedText: text,
  });
  await cdp.send('Input.dispatchKeyEvent', { ...common, type: 'keyUp' });
}

async function withPage(viewport, run) {
  const { target, cdp } = await openPage(viewport);
  try {
    return await run(cdp);
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function waitForTool(cdp, toolId) {
  await cdp.send('Page.navigate', { url: `${BASE_URL}#/tool/${toolId}` });
  await waitFor(
    () =>
      evaluate(
        cdp,
        `document.readyState === 'complete' && document.querySelector('[data-tool-id="${toolId}"]') !== null`
      ),
    `${toolId} shell`
  );
  await evaluate(
    cdp,
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))`
  );
}

async function checkTool(toolId, viewport) {
  return withPage(viewport, async (cdp) => {
    const errors = collectErrors(cdp);
    await waitForTool(cdp, toolId);
    const state = await evaluate(
      cdp,
      `(() => {
        const shell = document.querySelector('[data-tool-id="${toolId}"]');
        const viewportWidth = window.innerWidth;
        const rootWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        return {
          shellCount: document.querySelectorAll('[data-tool-id="${toolId}"]').length,
          category: shell?.getAttribute('data-tool-category') ?? '',
          title: document.title,
          hasMain: Boolean(document.getElementById('main-content')),
          errorBoundary: document.body.innerText.includes('Something went wrong in this tool'),
          overflow: rootWidth > viewportWidth + 1 || bodyWidth > viewportWidth + 1,
          rootWidth,
          bodyWidth,
          viewportWidth,
        };
      })()`
    );

    const findings = [];
    if (state.shellCount !== 1) findings.push(`expected 1 ToolShell, found ${state.shellCount}`);
    if (!state.category) findings.push('missing canonical category metadata');
    if (!state.title.includes('Tiny Tools')) findings.push(`unexpected title: ${state.title}`);
    if (!state.hasMain) findings.push('missing #main-content');
    if (state.errorBoundary) findings.push('ErrorBoundary fallback visible');
    if (state.overflow) {
      findings.push(
        `horizontal overflow (${state.rootWidth}/${state.bodyWidth}px > ${state.viewportWidth}px)`
      );
    }
    findings.push(...errors);
    return findings;
  });
}

async function checkDashboard(viewport) {
  return withPage(viewport, async (cdp) => {
    const errors = collectErrors(cdp);
    await cdp.send('Page.navigate', { url: BASE_URL });
    await waitFor(
      () => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.getElementById('dashboard-title'))`),
      `${viewport.name} dashboard`
    );

    const state = await evaluate(
      cdp,
      `(() => {
        const links = [...document.querySelectorAll('a[href^="#/tool/"]')]
          .map((link) => link.getAttribute('href'))
          .filter(Boolean);
        return {
          uniqueTools: new Set(links.map((href) => href.replace('#/tool/', ''))).size,
          title: document.title,
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1,
          scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          viewportWidth: window.innerWidth,
        };
      })()`
    );

    const findings = [];
    if (state.uniqueTools !== 50) findings.push(`dashboard exposes ${state.uniqueTools}/50 tool links`);
    if (!state.title.includes('Tiny Tools')) findings.push(`unexpected dashboard title: ${state.title}`);
    if (state.overflow) findings.push(`dashboard overflow (${state.scrollWidth}px > ${state.viewportWidth}px)`);
    findings.push(...errors);
    return findings;
  });
}

async function checkKeyboard() {
  return withPage(VIEWPORTS[0], async (cdp) => {
    const errors = collectErrors(cdp);
    const findings = [];
    await cdp.send('Page.navigate', { url: BASE_URL });
    await waitFor(() => evaluate(cdp, `Boolean(document.getElementById('dashboard-title'))`), 'keyboard dashboard');

    await pressKey(cdp, 'Tab', 'Tab');
    const firstFocus = await evaluate(cdp, `document.activeElement?.textContent?.trim() ?? ''`);
    if (!firstFocus.includes('Skip to main content')) {
      findings.push(`first Tab missed skip control: ${JSON.stringify(firstFocus)}`);
    } else {
      await pressKey(cdp, 'Enter', 'Enter');
      await waitFor(
        () => evaluate(cdp, `document.activeElement?.id === 'main-content'`),
        'skip link to focus main content',
        2_000
      ).catch(() => findings.push('activating skip control did not focus #main-content'));
    }

    await evaluate(cdp, `document.body.setAttribute('tabindex', '-1'); document.body.focus(); true`);
    await pressKey(cdp, '/', 'Slash', '/');
    await waitFor(() => evaluate(cdp, `Boolean(document.querySelector('[role="dialog"]'))`), 'command palette');

    const palette = await evaluate(
      cdp,
      `({
        count: document.querySelectorAll('[role="dialog"]').length,
        activeRole: document.activeElement?.getAttribute('role') ?? '',
        activeTag: document.activeElement?.tagName ?? '',
      })`
    );
    if (palette.count !== 1) findings.push(`expected one command dialog, found ${palette.count}`);
    if (palette.activeRole !== 'combobox' && palette.activeTag !== 'INPUT') {
      findings.push('command palette search field was not focused');
    }

    await pressKey(cdp, 'Escape', 'Escape');
    await waitFor(
      () => evaluate(cdp, `document.querySelector('[role="dialog"]') === null`),
      'command palette dismissal'
    );

    findings.push(...errors);
    return findings;
  });
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

  const toolIds = await getToolIds();
  const server = await createStaticServer();
  const chromeBinary = findChrome();
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-r5-chrome-'));
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

    console.log(`R5 Chromium smoke: ${toolIds.length} tools × ${VIEWPORTS.length} viewports + dashboard + keyboard`);
    console.log(`Serving ${BASE_URL} to emulate thiepn.github.io/tools/`);
    console.log(`Chrome: ${chromeBinary}`);

    const failures = [];
    for (const viewport of VIEWPORTS) {
      const dashboard = await checkDashboard(viewport);
      failures.push(...dashboard.map((finding) => `[dashboard/${viewport.name}] ${finding}`));

      for (const [index, toolId] of toolIds.entries()) {
        const findings = await checkTool(toolId, viewport);
        failures.push(...findings.map((finding) => `[${toolId}/${viewport.name}] ${finding}`));
        process.stdout.write(`\r${viewport.name}: ${index + 1}/${toolIds.length} routes`);
      }
      process.stdout.write('\n');
    }

    const keyboard = await checkKeyboard();
    failures.push(...keyboard.map((finding) => `[keyboard] ${finding}`));

    if (failures.length) {
      console.error(`\nR5 browser acceptance FAILED with ${failures.length} finding(s):`);
      failures.forEach((finding) => console.error(`- ${finding}`));
      process.exitCode = 1;
      return;
    }

    console.log('\nR5 browser acceptance PASSED');
    console.log('- 50/50 routes rendered at 1440px');
    console.log('- 50/50 routes rendered at 320px');
    console.log('- 0 route-level horizontal overflow findings');
    console.log('- 0 uncaught browser/page errors');
    console.log('- dashboard exposes all 50 tools at both viewports');
    console.log('- skip-to-main and command-palette keyboard checks passed');
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
