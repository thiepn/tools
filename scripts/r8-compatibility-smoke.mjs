import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const HOST = '127.0.0.1';
const PORT = 4176;
const DEBUG_PORT = 9225;
const BASE_PATH = '/tools/';
const BASE_URL = `http://${HOST}:${PORT}${BASE_PATH}`;

const DESKTOP = { width: 1440, height: 1000, mobile: false };
const MOBILE = { width: 390, height: 844, mobile: true };

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

async function waitFor(check, label, timeoutMs = 6_000) {
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

async function openPage(viewport, preloadSource = '') {
  const target = await newTarget();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Log.enable')]);
  if (preloadSource) {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: preloadSource });
  }
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
    if (entry?.level === 'error') errors.push(`browser log: ${entry.text ?? 'unknown error'}${entry.url ? ` (${entry.url})` : ''}`);
  });
  return errors;
}

async function withPage(viewport, preloadSource, run) {
  const { target, cdp } = await openPage(viewport, preloadSource);
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
  await waitFor(() => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.getElementById('main-content'))`), `route ${hash}`);
}

async function navigateTool(cdp, toolId) {
  await navigate(cdp, `#/tool/${toolId}`);
  await waitFor(() => evaluate(cdp, `Boolean(document.querySelector('[data-tool-id="${toolId}"]'))`), `${toolId} ToolShell`);
}

async function clickText(cdp, text, selector = 'button') {
  return evaluate(cdp, `(() => {
    const wanted = ${JSON.stringify(text)};
    const element = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((node) => node.textContent?.replace(/\\s+/g, ' ').trim().includes(wanted));
    if (!element) throw new Error('Missing clickable text: ' + wanted);
    element.click();
    return true;
  })()`);
}

async function setValue(cdp, selector, value) {
  return evaluate(cdp, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) throw new Error('Missing input: ${selector}');
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

const NO_BARCODE_DETECTOR = `(() => {
  try { delete window.BarcodeDetector; } catch {}
  if ('BarcodeDetector' in window) {
    try { Object.defineProperty(window, 'BarcodeDetector', { configurable: true, value: undefined }); } catch {}
  }
})();`;

const NO_SPEECH_SYNTHESIS = `(() => {
  try { delete window.speechSynthesis; } catch {}
  if ('speechSynthesis' in window) {
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }); } catch {}
  }
})();`;

const NO_WEB_AUDIO = `(() => {
  try { Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined }); } catch {}
  try { Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined }); } catch {}
})();`;

const NO_CLIPBOARD_WITH_TEXT_FALLBACK = `(() => {
  try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); } catch {}
  document.execCommand = (command) => command === 'copy';
})();`;

const NO_DISPLAY_MEDIA = `(() => {
  if (navigator.mediaDevices) {
    try { Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { configurable: true, value: undefined }); } catch {}
  }
})();`;

const NO_USER_MEDIA = `(() => {
  if (navigator.mediaDevices) {
    try { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: undefined }); } catch {}
  }
})();`;

const NO_FULLSCREEN = `(() => {
  try { Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined }); } catch {}
  try { Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: undefined }); } catch {}
})();`;

async function flowBarcodeWithoutDetector() {
  return withPage(MOBILE, NO_BARCODE_DETECTOR, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'barcode-studio');
    await clickText(cdp, 'Scan Barcode');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Barcode scanning is not supported in this browser')`), 'Barcode compatibility guidance', 2_500);
    const startState = await evaluate(cdp, `(() => {
      const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Start Camera Scan'));
      return button ? { present: true, disabled: button.disabled } : { present: false, disabled: true };
    })()`);
    if (startState.present && !startState.disabled) findings.push('Barcode camera action remained enabled without BarcodeDetector support');
    return findings;
  });
}

async function flowTextToSpeechUnsupported() {
  return withPage(DESKTOP, NO_SPEECH_SYNTHESIS, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'text-to-speech');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Text-to-speech is not supported in this browser')`), 'TTS compatibility guidance', 2_500);
    await setValue(cdp, '[data-tool-id="text-to-speech"] textarea', 'Compatibility test');
    const disabled = await evaluate(cdp, `(() => {
      const button = [...document.querySelectorAll('[data-tool-id="text-to-speech"] button')].find((node) => node.textContent?.includes('Speak Text'));
      return button?.disabled ?? false;
    })()`);
    if (!disabled) findings.push('Text-to-Speech Speak action remained enabled without SpeechSynthesis support');
    return findings;
  });
}

async function flowMetronomeUnsupported() {
  return withPage(DESKTOP, NO_WEB_AUDIO, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'metronome');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Web Audio is not supported in this browser')`), 'Metronome compatibility guidance', 2_500);
    const disabled = await evaluate(cdp, `(() => {
      const button = [...document.querySelectorAll('[data-tool-id="metronome"] button')].find((node) => node.textContent?.includes('Start Metronome'));
      return button?.disabled ?? false;
    })()`);
    if (!disabled) findings.push('Metronome start action remained enabled without Web Audio support');
    return findings;
  });
}

async function flowDuplicateClipboardFallback() {
  return withPage(DESKTOP, NO_CLIPBOARD_WITH_TEXT_FALLBACK, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'duplicate-finder');
    await evaluate(cdp, `(() => {
      const heading = [...document.querySelectorAll('h3')].find((node) => node.textContent?.includes('Choose or Drop Files to Find Duplicates'));
      const dropzone = heading?.parentElement;
      if (!dropzone) throw new Error('Duplicate Finder dropzone not found');
      const transfer = new DataTransfer();
      transfer.items.add(new File(['r8-same'], 'copy-a.txt', { type: 'text/plain', lastModified: 1000 }));
      transfer.items.add(new File(['r8-same'], 'copy-b.txt', { type: 'text/plain', lastModified: 2000 }));
      dropzone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      return true;
    })()`);
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Found 1 Duplicate Sets')`), 'duplicate result', 10_000);
    await clickText(cdp, 'Copy Summary');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Copied')`), 'Duplicate Finder clipboard fallback', 2_500);
    return findings;
  });
}

async function flowTextCleanerClipboardFallback() {
  return withPage(DESKTOP, NO_CLIPBOARD_WITH_TEXT_FALLBACK, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'text-cleaner');
    await setValue(cdp, '#cleaner-input-textarea', 'R8 clipboard fallback');
    await waitFor(() => evaluate(cdp, `document.getElementById('copy-clean-text-btn')?.disabled === false`), 'Text Cleaner copy readiness');
    await evaluate(cdp, `document.getElementById('copy-clean-text-btn')?.click(); true`);
    await waitFor(() => evaluate(cdp, `document.getElementById('copy-clean-text-btn')?.textContent?.includes('Copied')`), 'Text Cleaner clipboard fallback', 2_500);
    return findings;
  });
}

async function flowScreenRecorderWithoutDisplayMedia() {
  return withPage(DESKTOP, NO_DISPLAY_MEDIA, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'screen-recorder');
    await clickText(cdp, 'Start Recording');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Screen recording is not supported in this browser environment')`), 'screen-recording unsupported guidance');
    return findings;
  });
}

async function flowQrWithoutUserMedia() {
  return withPage(MOBILE, NO_USER_MEDIA, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'qr-studio');
    await clickText(cdp, 'Scan QR Code');
    await clickText(cdp, 'Start Camera Scan');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Camera access is not supported by your browser')`), 'QR unsupported-camera guidance');
    return findings;
  });
}

async function flowDocumentScannerWithoutUserMedia() {
  return withPage(MOBILE, NO_USER_MEDIA, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'document-scanner');
    await clickText(cdp, 'Use Camera');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Camera access was blocked or not available')`), 'Document Scanner unsupported-camera guidance');
    if (!(await evaluate(cdp, `document.body.innerText.includes('Browse Photo')`))) findings.push('Document Scanner upload fallback disappeared when camera API was unavailable');
    return findings;
  });
}

async function flowTeleprompterFullscreenFallback() {
  return withPage(DESKTOP, NO_FULLSCREEN, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'teleprompter');
    await evaluate(cdp, `(() => {
      const button = document.querySelector('[data-tool-id="teleprompter"] button[title="Toggle Fullscreen"]');
      if (!button) throw new Error('Teleprompter fullscreen control not found');
      button.click();
      return true;
    })()`);
    await waitFor(() => evaluate(cdp, `document.querySelector('[data-teleprompter-stage]')?.getAttribute('data-fullscreen-mode') === 'fallback'`), 'Teleprompter in-page fullscreen fallback', 2_500);
    return findings;
  });
}

const FLOWS = [
  ['Barcode without BarcodeDetector', flowBarcodeWithoutDetector],
  ['Text-to-Speech without SpeechSynthesis', flowTextToSpeechUnsupported],
  ['Metronome without Web Audio', flowMetronomeUnsupported],
  ['Duplicate Finder clipboard fallback', flowDuplicateClipboardFallback],
  ['Text Cleaner clipboard fallback', flowTextCleanerClipboardFallback],
  ['Screen Recorder without getDisplayMedia', flowScreenRecorderWithoutDisplayMedia],
  ['QR Studio without getUserMedia', flowQrWithoutUserMedia],
  ['Document Scanner without getUserMedia', flowDocumentScannerWithoutUserMedia],
  ['Teleprompter fullscreen fallback', flowTeleprompterFullscreenFallback],
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
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-r8-chrome-'));
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
    await waitFor(async () => (await fetch(`http://${HOST}:${DEBUG_PORT}/json/version`).catch(() => null))?.ok, 'Chrome DevTools endpoint', 15_000);
    console.log(`R8 browser compatibility acceptance: ${FLOWS.length} degraded-capability journeys`);
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
      console.error(`\nR8 compatibility acceptance FAILED with ${failures.length} finding(s):`);
      failures.forEach((finding) => console.error(`- ${finding}`));
      process.exitCode = 1;
      return;
    }

    console.log('\nR8 compatibility acceptance PASSED');
    console.log(`- ${FLOWS.length}/${FLOWS.length} degraded-capability journeys passed`);
    console.log('- unsupported barcode detection, speech synthesis, and Web Audio paths are explicit and non-interactive');
    console.log('- text clipboard fallback remains functional without navigator.clipboard');
    console.log('- screen/camera API absence surfaces recoverable guidance instead of crashing');
    console.log('- Teleprompter provides an in-page fullscreen fallback when the Fullscreen API is absent');
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
