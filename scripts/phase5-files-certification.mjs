import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const OUT = process.env.PHASE5_FILES_OUT
  ? path.resolve(ROOT, process.env.PHASE5_FILES_OUT)
  : path.resolve(ROOT, 'artifacts', 'phase5-files-certification');
const FIXTURES = path.join(OUT, 'fixtures');
const HOST = '127.0.0.1';
const PORT = 4195;
const DEBUG_PORT = 9245;
const BASE = `http://${HOST}:${PORT}/tools/`;
const FAMILY_TOTAL = 24;
const TARGET_IDS = [
  'duplicate-finder',
  'csv-merger',
  'file-type-inspector',
  'tar-pack',
  'tar-extract',
  'gzip-compress',
  'gzip-decompress',
  'docx-metadata-inspector',
  'epub-metadata-editor',
  'presentation-viewer',
  'ebook-reader',
];

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
    await sleep(40);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function registryAndUtilities() {
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
    const files = toolsModule.TOOLS_REGISTRY.filter((tool) => tool.category === 'files');
    if (files.length !== FAMILY_TOTAL) throw new Error(`Expected ${FAMILY_TOTAL} files routes, found ${files.length}.`);

    const missing = TARGET_IDS.filter((id) => !files.some((tool) => tool.id === id));
    if (missing.length) throw new Error(`Missing Phase 5 target routes: ${missing.join(', ')}`);

    const fileUtils = await vite.ssrLoadModule('/src/utilities/file-format-conversion.ts');
    const office = await vite.ssrLoadModule('/src/utilities/p13-office.ts');
    const odp = await vite.ssrLoadModule('/src/utilities/mainstream-odp.ts');
    return {
      tools: TARGET_IDS.map((id) => {
        const tool = files.find((row) => row.id === id);
        return { id: tool.id, name: tool.name, route: tool.route, category: tool.category };
      }),
      fileUtils,
      office,
      odp,
    };
  } finally {
    await vite.close();
  }
}

async function makeFixtures(fileUtils, office, odp) {
  await mkdir(FIXTURES, { recursive: true });
  const enc = new TextEncoder();
  const files = {
    duplicateA: path.join(FIXTURES, 'duplicate-a.txt'),
    duplicateB: path.join(FIXTURES, 'duplicate-b.txt'),
    duplicateOther: path.join(FIXTURES, 'other.txt'),
    csvA: path.join(FIXTURES, 'a.csv'),
    csvB: path.join(FIXTURES, 'b.csv'),
    png: path.join(FIXTURES, 'mystery.bin'),
    tar: path.join(FIXTURES, 'bundle.tar'),
    gzipSource: path.join(FIXTURES, 'source.txt'),
    gzip: path.join(FIXTURES, 'source.txt.gz'),
    docx: path.join(FIXTURES, 'phase5.docx'),
    epub: path.join(FIXTURES, 'phase5.epub'),
    odp: path.join(FIXTURES, 'phase5.odp'),
  };

  await writeFile(files.duplicateA, 'same-content');
  await writeFile(files.duplicateB, 'same-content');
  await writeFile(files.duplicateOther, 'diff-content');
  await writeFile(files.csvA, 'id,name\r\n1,Ada');
  await writeFile(files.csvB, 'id,name\r\n2,Lin');
  await writeFile(files.png, Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]));

  const tar = fileUtils.createTar([
    { path: 'hello.txt', bytes: enc.encode('hello') },
    { path: 'data.csv', bytes: enc.encode('a,b\n1,2') },
  ]);
  await writeFile(files.tar, tar);

  const gzipText = Buffer.from('Tiny Tools Phase 5 gzip fixture');
  await writeFile(files.gzipSource, gzipText);
  await writeFile(files.gzip, gzipSync(gzipText));

  await writeFile(files.docx, await office.createDocx('# Report\n\nHello', {
    title: 'Phase 5 DOCX',
    creator: 'Tiny Tools',
  }));
  await writeFile(files.epub, await office.createEpub('# Tiny Book\n\nHello Phase 5', {
    title: 'Original Book',
    creator: 'Tiny Tools',
    language: 'en',
  }));
  await writeFile(files.odp, await odp.createOdp('# First\n- Alpha\n# Second\n- Beta', 'Phase 5 Deck'));
  return files;
}

async function createStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
      if (url.pathname === '/favicon.ico') {
        response.writeHead(204).end();
        return;
      }
      if (!url.pathname.startsWith('/tools')) {
        response.writeHead(404).end('Not found');
        return;
      }
      const rel = url.pathname === '/tools' || url.pathname === '/tools/'
        ? 'index.html'
        : url.pathname.slice('/tools/'.length);
      const candidate = path.resolve(DIST, rel);
      const safe = path.relative(DIST, candidate);
      if (safe.startsWith('..') || path.isAbsolute(safe)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
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
    awaitPromise: true,
    returnByValue: true,
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

async function setFiles(cdp, selector, files) {
  await cdp.send('DOM.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  if (!nodeId) throw new Error(`File input not found: ${selector}`);
  await cdp.send('DOM.setFileInputFiles', { nodeId, files });
}

function fixtureExpression(id) {
  return `(async () => {
    const id = ${JSON.stringify(id)};
    const root = document.querySelector('[data-tool-id="' + CSS.escape(id) + '"] .tt-tool-content');
    if (!root) return { ok: false, message: 'tool content missing' };
    window.__ttDownloads = window.__ttDownloads || [];

    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const body = () => (root.innerText || '').replace(/\\s+/g, ' ').trim();
    const button = (text) => [...root.querySelectorAll('button')].find((node) => (node.textContent || '').trim() === text);
    const until = async (check, label, timeout = 5000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        const value = check();
        if (value) return value;
        await pause(25);
      }
      throw new Error('Timed out waiting for ' + label);
    };
    const click = (text) => {
      const target = button(text);
      if (!target) throw new Error('Button not found: ' + text);
      target.click();
      return target;
    };
    const downloads = () => window.__ttDownloads || [];
    const setInput = (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter ? setter.call(input, value) : input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    try {
      if (id === 'duplicate-finder') {
        await until(() => body().includes('Found 1 Duplicate Sets'), 'duplicate results', 6000);
        if (!body().includes('1 redundant copies')) throw new Error('duplicate count mismatch');
        return { ok: true, message: 'three real files produced one exact duplicate set' };
      }

      if (id === 'csv-merger') {
        await until(() => body().includes('2 file(s) selected'), 'CSV selection');
        click('Merge & download');
        await until(() => downloads().some((row) => row.download === 'merged.csv'), 'merged CSV download');
        return { ok: true, message: 'two CSV files merged and download emitted' };
      }

      if (id === 'file-type-inspector') {
        await until(() => body().includes('PNG image') && body().includes('image/png'), 'PNG inspection');
        return { ok: true, message: 'PNG signature detected from local file bytes' };
      }

      if (id === 'tar-pack') {
        await until(() => body().includes('2 file(s) selected'), 'TAR source selection');
        click('Create TAR');
        await until(() => downloads().some((row) => row.download === 'archive.tar'), 'TAR download');
        return { ok: true, message: 'two real files packed to TAR download' };
      }

      if (id === 'tar-extract') {
        await until(() => body().includes('hello.txt') && body().includes('data.csv'), 'TAR entries');
        return { ok: true, message: 'TAR inventory parsed and rendered' };
      }

      if (id === 'gzip-compress') {
        click('Compress & download');
        await until(() => downloads().some((row) => row.download === 'source.txt.gz'), 'GZIP download');
        return { ok: true, message: 'source file compressed to GZIP download' };
      }

      if (id === 'gzip-decompress') {
        click('Decompress & download');
        await until(() => downloads().some((row) => row.download === 'source.txt'), 'gunzip download');
        return { ok: true, message: 'GZIP file decompressed to original-name download' };
      }

      if (id === 'docx-metadata-inspector') {
        click('Process file');
        await until(() => body().includes('Phase 5 DOCX') && body().includes('Tiny Tools'), 'DOCX metadata');
        return { ok: true, message: 'DOCX title/creator metadata rendered' };
      }

      if (id === 'epub-metadata-editor') {
        click('Read metadata');
        await until(() => {
          const inputs = [...root.querySelectorAll('input')];
          return inputs.some((input) => input.value === 'Original Book') && inputs.some((input) => input.value === 'Tiny Tools');
        }, 'EPUB metadata fields');
        const titleInput = [...root.querySelectorAll('label')].find((label) => (label.textContent || '').trim().startsWith('Title'))?.querySelector('input');
        if (!titleInput) throw new Error('EPUB title input missing');
        setInput(titleInput, 'Edited Browser Book');
        click('Save edited EPUB');
        await until(() => downloads().some((row) => row.download === 'Edited Browser Book.epub'), 'edited EPUB download');
        return { ok: true, message: 'EPUB metadata loaded, edited, and saved' };
      }

      if (id === 'presentation-viewer') {
        await until(() => body().includes('First') && body().includes('Second') && body().includes('Slides'), 'presentation view', 6000);
        return { ok: true, message: 'ODP slides opened and rendered' };
      }

      if (id === 'ebook-reader') {
        await until(() => body().includes('Original Book') && body().includes('Hello Phase 5'), 'ebook view', 6000);
        return { ok: true, message: 'EPUB metadata and chapter text rendered' };
      }

      return { ok: false, message: 'no Phase 5 fixture for ' + id };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  })()`;
}

const FILES_BY_ID = new Map();

async function setRouteFiles(cdp, id) {
  const f = FILES_BY_ID.get(id);
  if (!f) throw new Error(`No generated file fixture mapping for ${id}`);
  if (id === 'duplicate-finder') {
    return setFiles(cdp, 'input[data-testid="duplicate-file-input"]', [f.duplicateA, f.duplicateB, f.duplicateOther]);
  }
  if (id === 'csv-merger') return setFiles(cdp, 'input[type="file"]', [f.csvA, f.csvB]);
  if (id === 'file-type-inspector') return setFiles(cdp, 'input[type="file"]', [f.png]);
  if (id === 'tar-pack') return setFiles(cdp, 'input[type="file"]', [f.gzipSource, f.csvA]);
  if (id === 'tar-extract') return setFiles(cdp, 'input[type="file"]', [f.tar]);
  if (id === 'gzip-compress') return setFiles(cdp, 'input[type="file"]', [f.gzipSource]);
  if (id === 'gzip-decompress') return setFiles(cdp, 'input[type="file"]', [f.gzip]);
  if (id === 'docx-metadata-inspector') return setFiles(cdp, 'input[type="file"]', [f.docx]);
  if (id === 'epub-metadata-editor') return setFiles(cdp, 'input[type="file"]', [f.epub]);
  if (id === 'presentation-viewer') return setFiles(cdp, 'input[type="file"]', [f.odp]);
  if (id === 'ebook-reader') return setFiles(cdp, 'input[type="file"]', [f.epub]);
}

async function openPage() {
  const target = await newTarget();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Log.enable')]);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    screenWidth: 1280,
    screenHeight: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      window.__ttDownloads = [];
      const original = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        window.__ttDownloads.push({ download: this.download || '', href: this.href || '' });
        if (!this.download) return original.call(this);
      };
    })();`,
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
    const message = (args ?? []).map((arg) => arg.value ?? arg.description ?? '').filter(Boolean).join(' ');
    errors.push(`console.${type}: ${message || 'unknown console error'}`);
  });
  cdp.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level !== 'error') return;
    if ((entry.url ?? '').endsWith('/favicon.ico')) return;
    errors.push(`browser log: ${entry.text ?? 'unknown error'}`);
  });
  return errors;
}

async function auditTool(tool) {
  const { target, cdp } = await openPage();
  const errors = collectErrors(cdp);
  try {
    await cdp.send('Page.navigate', { url: `${BASE}#/tool/${tool.id}` });
    await waitFor(
      () => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.querySelector('[data-tool-id="${tool.id}"] .tt-tool-content'))`),
      `${tool.id} mount`
    );
    await setRouteFiles(cdp, tool.id);
    const fixture = await evaluate(cdp, fixtureExpression(tool.id));
    await sleep(60);

    const findings = [];
    if (!fixture?.ok) findings.push(fixture?.message || 'fixture did not report success');
    findings.push(...new Set(errors));

    let screenshot = null;
    if (findings.length) {
      const dir = path.join(OUT, 'failed');
      await mkdir(dir, { recursive: true });
      const capture = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      screenshot = path.join(dir, `${tool.id}.png`);
      await writeFile(screenshot, Buffer.from(capture.data, 'base64'));
    }
    return {
      id: tool.id,
      name: tool.name,
      status: findings.length ? 'FAIL' : 'PASS',
      fixture: fixture?.message ?? '',
      findings,
      screenshot,
    };
  } catch (error) {
    return {
      id: tool.id,
      name: tool.name,
      status: 'FAIL',
      fixture: '',
      findings: [error instanceof Error ? error.message : String(error)],
      screenshot: null,
    };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

function markdown(report) {
  const rows = report.results.map((row) =>
    `| \`${row.id}\` | **${row.status}** | ${(row.fixture || row.findings.join('; ') || '—').replaceAll('|', '\\|')} |`
  ).join('\n');
  return `# Phase 5 — Files Certification

- Files family routes: **${FAMILY_TOTAL}**
- Newly certified target routes: **${report.summary.total}**
- PASS: **${report.summary.PASS}**
- FAIL: **${report.summary.FAIL}**

| Tool | Status | Evidence |
|---|---|---|
${rows}
`;
}

async function stopChrome(chrome) {
  if (chrome.exitCode !== null) return;
  chrome.kill('SIGTERM');
  await Promise.race([once(chrome, 'exit'), sleep(1800)]);
  if (chrome.exitCode === null) chrome.kill('SIGKILL');
}

async function main() {
  await stat(path.join(DIST, 'index.html')).catch(() => {
    throw new Error('dist/index.html is missing; run npm run build first.');
  });
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const { tools, fileUtils, office, odp } = await registryAndUtilities();
  const fixtures = await makeFixtures(fileUtils, office, odp);
  for (const id of TARGET_IDS) FILES_BY_ID.set(id, fixtures);

  for (const tool of tools) {
    const source = fixtureExpression(tool.id);
    try {
      new Function(`return ${source};`);
    } catch (error) {
      throw new Error(`Generated Phase 5 fixture is invalid for ${tool.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const server = await createStaticServer();
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-phase5-files-'));
  const chrome = spawn(findChrome(), [
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
  let stderr = '';
  chrome.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    await waitFor(async () => (await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(() => null))?.ok, 'Chrome DevTools', 15_000);
    const results = [];
    console.log(`Phase 5 files certification: ${tools.length} blocked workflows`);
    for (let index = 0; index < tools.length; index += 1) {
      const result = await auditTool(tools[index]);
      results.push(result);
      console.log(`${result.status === 'PASS' ? '✓' : '✗'} ${index + 1}/${tools.length} ${tools[index].id}${result.findings.length ? ` — ${result.findings[0]}` : ''}`);
    }

    const summary = {
      total: results.length,
      PASS: results.filter((row) => row.status === 'PASS').length,
      FAIL: results.filter((row) => row.status === 'FAIL').length,
    };
    const report = {
      generatedAt: new Date().toISOString(),
      baselineCommit: process.env.GITHUB_SHA ?? null,
      familyTotal: FAMILY_TOTAL,
      summary,
      results,
    };
    await writeFile(path.join(OUT, 'files-certification.json'), JSON.stringify(report, null, 2));
    await writeFile(path.join(OUT, 'files-certification.md'), markdown(report));
    console.log(`Phase 5 files summary ${JSON.stringify(summary)}`);
    if (summary.total !== TARGET_IDS.length || summary.FAIL) process.exitCode = 1;
  } catch (error) {
    if (stderr.trim()) console.error(`\nChrome stderr (tail):\n${stderr.slice(-4000)}`);
    throw error;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await stopChrome(chrome);
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
