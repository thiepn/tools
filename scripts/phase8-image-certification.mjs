import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const OUT = process.env.PHASE8_IMAGE_OUT
  ? path.resolve(ROOT, process.env.PHASE8_IMAGE_OUT)
  : path.resolve(ROOT, 'artifacts', 'phase8-image-certification');
const FIXTURES = path.join(OUT, 'fixtures');
const HOST = '127.0.0.1';
const PORT = 4198;
const DEBUG_PORT = 9248;
const BASE = `http://${HOST}:${PORT}/tools/`;
const FAMILY_TOTAL = 32;
const TARGET_IDS = ['image-optimizer', 'background-remover'];

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
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
    await sleep(40);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function getImageTools() {
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
    const image = toolsModule.TOOLS_REGISTRY.filter((tool) => tool.category === 'image');
    if (image.length !== FAMILY_TOTAL) throw new Error(`Expected ${FAMILY_TOTAL} image routes, found ${image.length}.`);
    const missing = TARGET_IDS.filter((id) => !image.some((tool) => tool.id === id));
    if (missing.length) throw new Error(`Missing Phase 8 image targets: ${missing.join(', ')}`);
    return TARGET_IDS.map((id) => {
      const tool = image.find((row) => row.id === id);
      return { id: tool.id, name: tool.name, route: tool.route, category: tool.category };
    });
  } finally {
    await vite.close();
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function createFixturePng(width = 8, height = 8) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 4;
      const foreground = x >= 2 && x <= 5 && y >= 2 && y <= 5;
      raw[i] = foreground ? 220 : 255;
      raw[i + 1] = foreground ? 30 : 255;
      raw[i + 2] = foreground ? 30 : 255;
      raw[i + 3] = 255;
    }
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function makeFixtures() {
  await mkdir(FIXTURES, { recursive: true });
  const image = path.join(FIXTURES, 'phase8-source.png');
  await writeFile(image, createFixturePng());
  const info = await stat(image);
  if (info.size < 80) throw new Error('Generated Phase 8 PNG fixture is unexpectedly small.');
  return { image };
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

const PRELOAD = `(() => {
  window.__ttImageDownloads = [];
  window.__ttImageBlobMeta = new Map();
  window.__ttPhase8ForceBackgroundFallback = false;

  const create = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (blob) {
    const url = create(blob);
    try {
      window.__ttImageBlobMeta.set(url, {
        size: Number(blob?.size || 0),
        type: String(blob?.type || ''),
      });
    } catch {}
    return url;
  };

  const nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) {
      window.__ttImageDownloads.push({
        download: this.download,
        href: this.href,
        blob: window.__ttImageBlobMeta.get(this.href) || null,
      });
      return;
    }
    return nativeClick.call(this);
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (window.__ttPhase8ForceBackgroundFallback) {
      return Promise.reject(new Error('Phase 8 deterministic offline background-removal fallback'));
    }
    return nativeFetch(input, init);
  };
})();`;

function fixtureExpression(id) {
  return `(async () => {
    const id = ${JSON.stringify(id)};
    const root = document.querySelector('[data-tool-id="' + CSS.escape(id) + '"] .tt-tool-content');
    if (!root) return { ok: false, message: 'tool content missing' };

    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const body = () => (root.innerText || '').replace(/\\s+/g, ' ').trim();
    const until = async (check, label, timeout = 10000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        const value = check();
        if (value) return value;
        await pause(30);
      }
      throw new Error('Timed out waiting for ' + label);
    };
    const buttonExact = (text) => [...root.querySelectorAll('button')].find((node) =>
      (node.textContent || '').replace(/\\s+/g, ' ').trim() === text
    );
    const buttonCi = (text) => [...root.querySelectorAll('button')].find((node) =>
      (node.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase() === text.toLowerCase()
    );
    const click = (text) => {
      const target = buttonExact(text) || buttonCi(text);
      if (!target) throw new Error('Button not found: ' + text);
      target.click();
      return target;
    };
    const downloads = () => window.__ttImageDownloads || [];

    try {
      if (id === 'image-optimizer') {
        await until(() => body().includes('phase8-source.png') && body().includes('8 × 8 px'), 'optimizer source metadata');
        await until(() => body().includes('Live Output Preview') && body().includes('Ready'), 'optimizer initial output');
        click('50%');
        await until(() => body().includes('4 × 4'), 'optimizer 50% output dimensions');
        click('png');
        await until(() => body().includes('PNG format produces lossless compression') && body().includes('Ready'), 'optimizer PNG output');

        const preview = root.querySelector('img[alt="Optimized preview"]');
        await until(() => preview && preview.naturalWidth === 4 && preview.naturalHeight === 4, 'optimizer 4x4 preview');

        const downloadButton = [...root.querySelectorAll('button')].find((node) =>
          (node.textContent || '').replace(/\\s+/g, ' ').trim().startsWith('Download PNG')
        );
        if (!downloadButton || downloadButton.disabled) throw new Error('optimizer PNG download is unavailable');
        downloadButton.click();

        const row = await until(
          () => downloads().find((item) => item.download === 'phase8-source-optimized.png'),
          'optimizer PNG download'
        );
        if (!row.blob || row.blob.type !== 'image/png' || row.blob.size <= 20) {
          throw new Error('optimizer download Blob metadata is invalid');
        }
        return { ok: true, message: '8x8 source resized to 4x4 PNG and exported' };
      }

      if (id === 'background-remover') {
        await until(() => Boolean(root.querySelector('img[alt="Original"]')), 'background source preview');
        window.__ttPhase8ForceBackgroundFallback = true;
        click('Remove background');
        await until(() => body().includes('Ready for edge refinement'), 'background removal result', 30000);

        const pixels = (() => {
          const canvas = root.querySelector('canvas');
          if (!canvas || canvas.width !== 8 || canvas.height !== 8) return null;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return null;
          const data = ctx.getImageData(0, 0, 8, 8).data;
          return {
            width: canvas.width,
            height: canvas.height,
            cornerAlpha: data[3],
            centerAlpha: data[(4 * 8 + 4) * 4 + 3],
          };
        })();
        if (!pixels) throw new Error('background result canvas is unavailable');
        if (!(pixels.cornerAlpha < 100 && pixels.centerAlpha > 180 && pixels.centerAlpha > pixels.cornerAlpha + 100)) {
          throw new Error('background segmentation alpha contrast is invalid: ' + JSON.stringify(pixels));
        }

        click('Download PNG');
        const row = await until(
          () => downloads().find((item) => /^background-removed-\\d+\\.png$/.test(item.download)),
          'background removed PNG download'
        );
        if (!row.blob || row.blob.type !== 'image/png' || row.blob.size <= 20) {
          throw new Error('background-remover download Blob metadata is invalid');
        }
        return { ok: true, message: 'connected white background removed, red subject preserved, PNG exported' };
      }

      return { ok: false, message: 'no Phase 8 fixture for ' + id };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  })()`;
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
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PRELOAD });
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

async function auditTool(tool, fixtures) {
  const { target, cdp } = await openPage();
  const errors = collectErrors(cdp);
  try {
    await cdp.send('Page.navigate', { url: `${BASE}#/tool/${tool.id}` });
    await waitFor(
      () => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.querySelector('[data-tool-id="${tool.id}"] .tt-tool-content'))`),
      `${tool.id} mount`
    );
    const selector = tool.id === 'image-optimizer'
      ? 'input[type="file"][accept*="image/png"]'
      : 'input[type="file"][accept="image/*"]';
    await setFiles(cdp, selector, [fixtures.image]);
    const fixture = await evaluate(cdp, fixtureExpression(tool.id));
    await sleep(80);

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
  return `# Phase 8 — Image Certification

- Image family routes: **${FAMILY_TOTAL}**
- Phase 8 target routes: **${report.summary.total}**
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

  const tools = await getImageTools();
  const fixtures = await makeFixtures();

  for (const tool of tools) {
    const source = fixtureExpression(tool.id);
    try {
      new Function(`return ${source};`);
    } catch (error) {
      throw new Error(`Generated Phase 8 fixture is invalid for ${tool.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const server = await createStaticServer();
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-phase8-image-'));
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
    console.log(`Phase 8 image certification: ${tools.length} formerly blocked workflows`);
    for (let index = 0; index < tools.length; index += 1) {
      const result = await auditTool(tools[index], fixtures);
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
    await writeFile(path.join(OUT, 'image-certification.json'), JSON.stringify(report, null, 2));
    await writeFile(path.join(OUT, 'image-certification.md'), markdown(report));
    console.log(`Phase 8 image summary ${JSON.stringify(summary)}`);
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
