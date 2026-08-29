import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const DIST_ROOT = path.resolve(REPO_ROOT, 'dist');
const REGISTRY_PATH = path.resolve(REPO_ROOT, 'src/registry/tools.ts');
const BASE_PATH = '/tools/';
const HOST = '127.0.0.1';
const PORT = 4173;
const DEBUG_PORT = 9222;
const BASE_URL = `http://${HOST}:${PORT}${BASE_PATH}`;

const DESKTOP = { name: 'desktop', width: 1440, height: 1000, mobile: false };
const MOBILE = { name: 'mobile-320', width: 320, height: 844, mobile: true };

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, { timeoutMs = 12_000, intervalMs = 100, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }

  const suffix = lastError ? ` Last error: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
}

async function getToolIds() {
  const source = await readFile(REGISTRY_PATH, 'utf8');
  const registryOnly = source.split('export const CATEGORIES')[0];
  const ids = [...registryOnly.matchAll(/^\s*id:\s*'([^']+)'/gm)].map((match) => match[1]);

  if (ids.length !== 50 || new Set(ids).size !== 50) {
    throw new Error(`Expected exactly 50 unique registered tool IDs, found ${ids.length}.`);
  }

  return ids;
}

function safeDistPath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  if (decoded === '/tools' || decoded === BASE_PATH) {
    return path.join(DIST_ROOT, 'index.html');
  }

  if (!decoded.startsWith(BASE_PATH)) return null;
  const relative = decoded.slice(BASE_PATH.length);
  const candidate = path.resolve(DIST_ROOT, relative);
  const relativeToDist = path.relative(DIST_ROOT, candidate);
  if (relativeToDist.startsWith('..') || path.isAbsolute(relativeToDist)) return null;
  return candidate;
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
      const filePath = safeDistPath(requestUrl.pathname);
      if (!filePath) {
        response.writeHead(404).end('Not found');
        return;
      }

      const info = await stat(filePath);
      const resolvedPath = info.isDirectory() ? path.join(filePath, 'index.html') : filePath;
      const body = await readFile(resolvedPath);
      const contentType = MIME_TYPES[path.extname(resolvedPath).toLowerCase()] ?? 'application/octet-stream';
      response.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(500).end('Server error');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });

  return server;
}

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }

  throw new Error(
    'No Chromium/Chrome binary found. Set CHROME_BIN or install Google Chrome/Chromium.'
  );
}

class CdpSession {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async open() {
    this.socket = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = (event) => {
        cleanup();
        reject(new Error(`CDP WebSocket failed to open: ${event?.message ?? 'unknown error'}`));
      };
      const cleanup = () => {
        this.socket?.removeEventListener('open', onOpen);
        this.socket?.removeEventListener('error', onError);
      };
      this.socket.addEventListener('open', onOpen);
      this.socket.addEventListener('error', onError);
    });

    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }

      const handlers = this.listeners.get(message.method) ?? [];
      for (const handler of handlers) handler(message.params ?? {});
    });
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) ?? [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.close();
    for (const { reject } of this.pending.values()) {
      reject(new Error('CDP session closed before response.'));
    }
    this.pending.clear();
  }
}

async function evaluate(session, expression) {
  const result = await session.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });

  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        'Runtime evaluation failed.'
    );
  }

  return result.result?.value;
}

async function createTarget(url = 'about:blank') {
  const endpoint = `http://${HOST}:${DEBUG_PORT}/json/new?${encodeURIComponent(url)}`;
  const response = await fetch(endpoint, { method: 'PUT' });
  if (!response.ok) throw new Error(`Failed to create Chrome target: HTTP ${response.status}`);
  return response.json();
}

async function closeTarget(targetId) {
  try {
    await fetch(`http://${HOST}:${DEBUG_PORT}/json/close/${targetId}`);
  } catch {
    // Best-effort cleanup; Chrome is terminated at the end of the suite.
  }
}

async function openPage(viewport) {
  const target = await createTarget();
  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.open();
  await Promise.all([
    session.send('Page.enable'),
    session.send('Runtime.enable'),
    session.send('Log.enable'),
    session.send('Network.enable'),
  ]);

  await session.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });

  return { target, session };
}

function dispatchKey(session, key, code = key, text = '') {
  return session.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    text,
  });
}

async function pressKey(session, key, code = key, text = '') {
  await dispatchKey(session, key, code, text);
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
}

function registerErrorCollectors(session) {
  const errors = [];

  session.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    errors.push(
      `Uncaught exception: ${
        exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'unknown exception'
      }`
    );
  });

  session.on('Runtime.consoleAPICalled', ({ type, args }) => {
    if (type !== 'error' && type !== 'assert') return;
    const text = (args ?? [])
      .map((arg) => arg.value ?? arg.description ?? '')
      .filter(Boolean)
      .join(' ');
    errors.push(`console.${type}: ${text || 'unknown console error'}`);
  });

  session.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level === 'error') {
      errors.push(`browser log error: ${entry.text ?? 'unknown log error'}`);
    }
  });

  return errors;
}

async function navigateAndWaitForShell(session, toolId) {
  await session.send('Page.navigate', {
    url: `${BASE_URL}#/tool/${encodeURIComponent(toolId)}`,
  });

  await waitFor(
    async () =>
      evaluate(
        session,
        `document.readyState === 'complete' && document.querySelector('[data-tool-id="${toolId}"]') !== null`
      ),
    { label: `${toolId} shell` }
  );

  // Let one additional frame settle so layout/console failures after lazy mount
  // are included in the acceptance result.
  await evaluate(
    session,
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))`
  );
}

async function auditToolRoute(toolId, viewport) {
  const { target, session } = await openPage(viewport);
  const errors = registerErrorCollectors(session);

  try {
    await navigateAndWaitForShell(session, toolId);

    const result = await evaluate(
      session,
      `(() => {
        const shell = document.querySelector('[data-tool-id="${toolId}"]');
        const shellCount = document.querySelectorAll('[data-tool-id="${toolId}"]').length;
        const rootWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const viewportWidth = window.innerWidth;
        return {
          shellCount,
          hasShell: Boolean(shell),
          category: shell?.getAttribute('data-tool-category') ?? null,
          title: document.title,
          mainPresent: Boolean(document.getElementById('main-content')),
          errorBoundaryVisible: document.body.innerText.includes('Something went wrong in this tool'),
          rootWidth,
          bodyWidth,
          viewportWidth,
          overflow: rootWidth > viewportWidth + 1 || bodyWidth > viewportWidth + 1,
        };
      })()`
    );

    const failures = [];
    if (!result.hasShell || result.shellCount !== 1) {
      failures.push(`expected exactly one canonical ToolShell, found ${result.shellCount}`);
    }
    if (!result.category) failures.push('missing data-tool-category');
    if (!result.title || !result.title.includes('Tiny Tools')) {
      failures.push(`unexpected document title: ${JSON.stringify(result.title)}`);
    }
    if (!result.mainPresent) failures.push('missing #main-content');
    if (result.errorBoundaryVisible) failures.push('ErrorBoundary fallback is visible');
    if (result.overflow) {
      failures.push(
        `horizontal page overflow (${result.rootWidth}/${result.bodyWidth}px > ${result.viewportWidth}px viewport)`
      );
    }
    failures.push(...errors);

    return failures;
  } finally {
    session.close();
    await closeTarget(target.id);
  }
}

async function auditDashboard(viewport) {
  const { target, session } = await openPage(viewport);
  const errors = registerErrorCollectors(session);

  try {
    await session.send('Page.navigate', { url: BASE_URL });
    await waitFor(
      () => evaluate(session, `document.readyState === 'complete' && Boolean(document.getElementById('dashboard-title'))`),
      { label: `${viewport.name} dashboard` }
    );

    const result = await evaluate(
      session,
      `(() => {
        const hrefs = [...document.querySelectorAll('a[href^="#/tool/"]')].map((link) => link.getAttribute('href'));
        const uniqueTools = new Set(hrefs.map((href) => href?.replace('#/tool/', '')).filter(Boolean));
        return {
          uniqueToolLinks: uniqueTools.size,
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1,
          viewportWidth: window.innerWidth,
          scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          title: document.title,
        };
      })()`
    );

    const failures = [];
    if (result.uniqueToolLinks !== 50) {
      failures.push(`dashboard exposes ${result.uniqueToolLinks}/50 unique tool links`);
    }
    if (result.overflow) {
      failures.push(`dashboard horizontal overflow (${result.scrollWidth}px > ${result.viewportWidth}px)`);
    }
    if (result.title !== 'Tiny Tools') failures.push(`unexpected dashboard title: ${result.title}`);
    failures.push(...errors);
    return failures;
  } finally {
    session.close();
    await closeTarget(target.id);
  }
}

async function auditKeyboardNavigation() {
  const { target, session } = await openPage(DESKTOP);
  const errors = registerErrorCollectors(session);

  try {
    await session.send('Page.navigate', { url: BASE_URL });
    await waitFor(() => evaluate(session, `Boolean(document.getElementById('dashboard-title'))`), {
      label: 'dashboard for keyboard checks',
    });

    const failures = [];

    // On a fresh route, first Tab should reveal/focus the skip control.
    await pressKey(session, 'Tab', 'Tab');
    const firstFocusedText = await evaluate(
      session,
      `document.activeElement?.textContent?.trim() ?? ''`
    );
    if (!firstFocusedText.includes('Skip to main content')) {
      failures.push(`first Tab did not focus skip control (focused: ${JSON.stringify(firstFocusedText)})`);
    } else {
      await pressKey(session, 'Enter', 'Enter');
      const activeId = await evaluate(session, `document.activeElement?.id ?? ''`);
      if (activeId !== 'main-content') {
        failures.push(`skip control did not focus #main-content (focused: ${activeId || 'none'})`);
      }
    }

    // Slash should open global search when focus is not inside a text-entry surface.
    await evaluate(session, `document.body.focus()`);
    await pressKey(session, '/', 'Slash', '/');
    await waitFor(() => evaluate(session, `Boolean(document.querySelector('[role="dialog"]'))`), {
      label: 'command palette after slash shortcut',
    });

    const commandState = await evaluate(
      session,
      `({
        dialogCount: document.querySelectorAll('[role="dialog"]').length,
        activeRole: document.activeElement?.getAttribute('role') ?? null,
        activeTag: document.activeElement?.tagName ?? null,
      })`
    );
    if (commandState.dialogCount !== 1) failures.push(`expected one command palette dialog, found ${commandState.dialogCount}`);
    if (commandState.activeRole !== 'combobox' && commandState.activeTag !== 'INPUT') {
      failures.push('command palette did not focus its search input');
    }

    await pressKey(session, 'Escape', 'Escape');
    await waitFor(() => evaluate(session, `document.querySelector('[role="dialog"]') === null`), {
      label: 'command palette dismissal',
    });

    failures.push(...errors);
    return failures;
  } finally {
    session.close();
    await closeTarget(target.id);
  }
}

async function main() {
  await stat(path.join(DIST_ROOT, 'index.html')).catch(() => {
    throw new Error('dist/index.html is missing. Run npm run build before npm run browser:smoke.');
  });

  const toolIds = await getToolIds();
  const server = await startStaticServer();
  const chromeBinary = findChromeBinary();
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'tiny-tools-r5-chrome-'));

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
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  let chromeStderr = '';
  chrome.stderr.on('data', (chunk) => {
    chromeStderr += chunk.toString();
  });

  const cleanup = async () => {
    server.close();
    if (!chrome.killed) chrome.kill('SIGTERM');
    await rm(userDataDir, { recursive: true, force: true });
  };

  try {
    await waitFor(
      async () => {
        const response = await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(() => null);
        return response?.ok;
      },
      { timeoutMs: 15_000, label: 'Chrome DevTools endpoint' }
    );

    console.log(`R5 Chromium smoke: ${toolIds.length} tools × 2 viewports + dashboard + keyboard acceptance`);
    console.log(`Serving built app at ${BASE_URL} (GitHub Pages subpath emulation)`);
    console.log(`Chrome: ${chromeBinary}`);

    const failures = [];

    for (const viewport of [DESKTOP, MOBILE]) {
      const dashboardFailures = await auditDashboard(viewport);
      if (dashboardFailures.length) {
        failures.push(...dashboardFailures.map((failure) => `[dashboard/${viewport.name}] ${failure}`));
      }

      for (const [index, toolId] of toolIds.entries()) {
        const routeFailures = await auditToolRoute(toolId, viewport);
        if (routeFailures.length) {
          failures.push(...routeFailures.map((failure) => `[${toolId}/${viewport.name}] ${failure}`));
        }
        process.stdout.write(`\r${viewport.name}: ${index + 1}/${toolIds.length} routes`);
      }
      process.stdout.write('\n');
    }

    const keyboardFailures = await auditKeyboardNavigation();
    failures.push(...keyboardFailures.map((failure) => `[keyboard] ${failure}`));

    if (failures.length > 0) {
      console.error(`\nR5 browser acceptance FAILED with ${failures.length} finding(s):`);
      for (const failure of failures) console.error(`- ${failure}`);
      process.exitCode = 1;
    } else {
      console.log('\nR5 browser acceptance PASSED');
      console.log(`- 50/50 tool routes rendered at 1440px`);
      console.log(`- 50/50 tool routes rendered at 320px`);
      console.log(`- 0 route-level horizontal overflow findings`);
      console.log(`- 0 uncaught browser/page errors`);
      console.log(`- dashboard exposes all 50 tools at both viewports`);
      console.log(`- skip-link and command-palette keyboard checks passed`);
    }
  } catch (error) {
    if (chromeStderr.trim()) {
      console.error(`\nChrome stderr (tail):\n${chromeStderr.slice(-4000)}`);
    }
    throw error;
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
