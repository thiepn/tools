import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const HOST = '127.0.0.1';
const PORT = 4175;
const DEBUG_PORT = 9224;
const BASE_PATH = '/tools/';
const BASE_URL = `http://${HOST}:${PORT}${BASE_PATH}`;

const DESKTOP = { name: 'desktop', width: 1440, height: 1000, mobile: false };
const MOBILE = { name: 'mobile-390', width: 390, height: 844, mobile: true };

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

function collectErrors(cdp, { includeConsole = true } = {}) {
  const errors = [];
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    errors.push(`uncaught: ${exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'unknown exception'}`);
  });
  if (includeConsole) {
    cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
      if (type !== 'error' && type !== 'assert') return;
      const text = (args ?? []).map((arg) => arg.value ?? arg.description ?? '').filter(Boolean).join(' ');
      errors.push(`console.${type}: ${text || 'unknown console error'}`);
    });
  }
  cdp.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level === 'error') errors.push(`browser log: ${entry.text ?? 'unknown error'}${entry.url ? ` (${entry.url})` : ''}`);
  });
  return errors;
}

async function withPage(viewport, preloadSource, run, options = {}) {
  const { target, cdp } = await openPage(viewport, preloadSource);
  const errors = collectErrors(cdp, options);
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

async function spaNavigateTool(cdp, toolId) {
  await evaluate(cdp, `window.location.hash = '#/tool/${toolId}'; true`);
  await waitFor(() => evaluate(cdp, `Boolean(document.querySelector('[data-tool-id="${toolId}"]'))`), `${toolId} SPA route`);
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

const CAPTURE_MEDIA_SCRIPT = `(() => {
  window.__r7UserStreams = [];
  window.__r7Recorders = [];
  const media = navigator.mediaDevices;
  if (media?.getUserMedia) {
    const nativeGetUserMedia = media.getUserMedia.bind(media);
    Object.defineProperty(media, 'getUserMedia', {
      configurable: true,
      value: async (...args) => {
        const stream = await nativeGetUserMedia(...args);
        window.__r7UserStreams.push(stream);
        return stream;
      },
    });
  }
  if (window.MediaRecorder) {
    const NativeMediaRecorder = window.MediaRecorder;
    window.MediaRecorder = new Proxy(NativeMediaRecorder, {
      construct(target, args) {
        const recorder = Reflect.construct(target, args, target);
        window.__r7Recorders.push(recorder);
        return recorder;
      },
      get(target, prop) {
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }
})();`;

const BARCODE_CAPTURE_SCRIPT = `${CAPTURE_MEDIA_SCRIPT}\n(() => {
  window.__r7BarcodeDetectCalls = 0;
  window.BarcodeDetector = class R7BarcodeDetector {
    constructor() {}
    detect() {
      window.__r7BarcodeDetectCalls += 1;
      return Promise.resolve([]);
    }
    static getSupportedFormats() {
      return Promise.resolve(['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code']);
    }
  };
})();`;

const SYNTHETIC_DISPLAY_SCRIPT = `(() => {
  window.__r7DisplayStreams = [];
  window.__r7Recorders = [];
  const media = navigator.mediaDevices;
  Object.defineProperty(media, 'getDisplayMedia', {
    configurable: true,
    value: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      let tick = 0;
      const draw = () => {
        tick += 1;
        ctx.fillStyle = tick % 2 ? '#111827' : '#1f2937';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px sans-serif';
        ctx.fillText('Tiny Tools R7 ' + tick, 24, 48);
      };
      draw();
      const timer = setInterval(draw, 80);
      const stream = canvas.captureStream(12);
      const track = stream.getVideoTracks()[0];
      if (track) {
        const nativeStop = track.stop.bind(track);
        track.stop = () => {
          clearInterval(timer);
          nativeStop();
        };
      }
      window.__r7DisplayStreams.push(stream);
      return stream;
    },
  });
  if (window.MediaRecorder) {
    const NativeMediaRecorder = window.MediaRecorder;
    window.MediaRecorder = new Proxy(NativeMediaRecorder, {
      construct(target, args) {
        const recorder = Reflect.construct(target, args, target);
        window.__r7Recorders.push(recorder);
        return recorder;
      },
      get(target, prop) {
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }
})();`;

const DENY_USER_MEDIA_SCRIPT = `(() => {
  const media = navigator.mediaDevices;
  Object.defineProperty(media, 'getUserMedia', {
    configurable: true,
    value: async () => { throw new DOMException('Permission denied by R7', 'NotAllowedError'); },
  });
})();`;

const DENY_DISPLAY_MEDIA_SCRIPT = `(() => {
  const media = navigator.mediaDevices;
  Object.defineProperty(media, 'getDisplayMedia', {
    configurable: true,
    value: async () => { throw new DOMException('Permission denied by R7', 'NotAllowedError'); },
  });
})();`;

async function userStreamsState(cdp) {
  return evaluate(cdp, `(() => ({
    count: window.__r7UserStreams?.length ?? 0,
    tracks: (window.__r7UserStreams ?? []).flatMap((stream) => stream.getTracks().map((track) => ({ kind: track.kind, readyState: track.readyState }))),
    recorderStates: (window.__r7Recorders ?? []).map((recorder) => recorder.state),
  }))()`);
}

async function flowQrCamera() {
  return withPage(MOBILE, CAPTURE_MEDIA_SCRIPT, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'qr-studio');
    await clickText(cdp, 'Scan QR Code');
    await clickText(cdp, 'Start Camera Scan');
    await waitFor(async () => {
      const state = await userStreamsState(cdp);
      return state.count >= 1 && state.tracks.some((track) => track.kind === 'video' && track.readyState === 'live');
    }, 'QR fake camera stream');
    const attached = await evaluate(cdp, `document.querySelector('[data-tool-id="qr-studio"] video')?.srcObject instanceof MediaStream`);
    if (!attached) findings.push('QR camera stream was not attached to the scanner video element');
    await clickText(cdp, 'Stop Camera');
    await waitFor(async () => (await userStreamsState(cdp)).tracks.every((track) => track.readyState === 'ended'), 'QR camera track cleanup');
    return findings;
  });
}

async function flowBarcodeCamera() {
  return withPage(MOBILE, BARCODE_CAPTURE_SCRIPT, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'barcode-studio');
    await clickText(cdp, 'Scan Barcode');
    await clickText(cdp, 'Start Camera Scan');
    await waitFor(async () => {
      const state = await userStreamsState(cdp);
      return state.count >= 1 && state.tracks.some((track) => track.kind === 'video' && track.readyState === 'live');
    }, 'Barcode fake camera stream');
    const attached = await evaluate(cdp, `document.querySelector('[data-tool-id="barcode-studio"] video')?.srcObject instanceof MediaStream`);
    if (!attached) findings.push('Barcode camera stream was not attached to the scanner video element');
    await waitFor(() => evaluate(cdp, `(window.__r7BarcodeDetectCalls ?? 0) > 0`), 'BarcodeDetector scan loop', 3_000);
    await clickText(cdp, 'Generate Barcode');
    await waitFor(async () => (await userStreamsState(cdp)).tracks.every((track) => track.readyState === 'ended'), 'Barcode camera cleanup on tab switch');
    return findings;
  });
}

async function flowDocumentCamera() {
  return withPage(MOBILE, CAPTURE_MEDIA_SCRIPT, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'document-scanner');
    await clickText(cdp, 'Use Camera');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Snap Document')`), 'Document Scanner camera UI');
    await waitFor(async () => {
      const state = await userStreamsState(cdp);
      return state.tracks.some((track) => track.kind === 'video' && track.readyState === 'live');
    }, 'Document Scanner fake camera stream');
    const attached = await evaluate(cdp, `document.querySelector('[data-tool-id="document-scanner"] video')?.srcObject instanceof MediaStream`);
    if (!attached) findings.push('Document Scanner camera stream was not attached after the camera view mounted');
    await clickText(cdp, 'Cancel');
    await waitFor(async () => (await userStreamsState(cdp)).tracks.every((track) => track.readyState === 'ended'), 'Document Scanner camera cleanup');
    return findings;
  });
}

async function flowAudioRecorderMic() {
  return withPage(DESKTOP, CAPTURE_MEDIA_SCRIPT, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'audio-recorder');
    await clickText(cdp, 'Start Recording');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Microphone is Recording')`), 'Audio Recorder recording state');
    await waitFor(async () => {
      const state = await userStreamsState(cdp);
      return state.tracks.some((track) => track.kind === 'audio' && track.readyState === 'live') && state.recorderStates.includes('recording');
    }, 'Audio Recorder live microphone');
    await sleep(650);
    await spaNavigateTool(cdp, 'text-cleaner');
    await waitFor(async () => {
      const state = await userStreamsState(cdp);
      return state.tracks.every((track) => track.readyState === 'ended') && state.recorderStates.every((state) => state === 'inactive');
    }, 'Audio Recorder lifecycle cleanup', 5_000);
    return findings;
  });
}

async function flowSpeechRecorderMic() {
  return withPage(DESKTOP, CAPTURE_MEDIA_SCRIPT, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'speech-to-text');
    await clickText(cdp, 'Start Recording');
    await waitFor(async () => {
      const state = await userStreamsState(cdp);
      return state.tracks.some((track) => track.kind === 'audio' && track.readyState === 'live') && state.recorderStates.includes('recording');
    }, 'Speech-to-Text live microphone');
    await sleep(400);
    await spaNavigateTool(cdp, 'text-cleaner');
    await waitFor(async () => {
      const state = await userStreamsState(cdp);
      return state.tracks.every((track) => track.readyState === 'ended') && state.recorderStates.every((state) => state === 'inactive');
    }, 'Speech-to-Text lifecycle cleanup', 5_000);
    return findings;
  });
}

async function flowScreenRecorder() {
  return withPage(DESKTOP, SYNTHETIC_DISPLAY_SCRIPT, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, 'screen-recorder');
    await clickText(cdp, 'Start Recording');
    await waitFor(() => evaluate(cdp, `(window.__r7Recorders ?? []).some((recorder) => recorder.state === 'recording')`), 'Screen Recorder recording state');
    await sleep(1_150);
    await clickText(cdp, 'Pause');
    await waitFor(() => evaluate(cdp, `(window.__r7Recorders ?? []).some((recorder) => recorder.state === 'paused') && document.body.innerText.includes('PAUSED')`), 'Screen Recorder pause');
    await clickText(cdp, 'Resume');
    await waitFor(() => evaluate(cdp, `(window.__r7Recorders ?? []).some((recorder) => recorder.state === 'recording')`), 'Screen Recorder resume');
    await sleep(1_150);
    await clickText(cdp, 'Stop & Preview');
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes('Download Video') && document.body.innerText.includes('Duration:')`), 'Screen Recorder preview');
    const state = await evaluate(cdp, `(() => ({
      trackStates: (window.__r7DisplayStreams ?? []).flatMap((stream) => stream.getTracks().map((track) => track.readyState)),
      recorderStates: (window.__r7Recorders ?? []).map((recorder) => recorder.state),
      duration: [...document.querySelectorAll('span')].find((node) => node.textContent?.trim().startsWith('Duration:'))?.textContent?.trim() ?? '',
      size: [...document.querySelectorAll('span')].find((node) => node.textContent?.trim().startsWith('Size:'))?.textContent?.trim() ?? '',
    }))()`);
    if (!state.trackStates.length || state.trackStates.some((status) => status !== 'ended')) findings.push('Screen Recorder display tracks remained live after Stop & Preview');
    if (state.recorderStates.some((status) => status !== 'inactive')) findings.push('Screen Recorder MediaRecorder remained active after Stop & Preview');
    if (state.duration === 'Duration: 00:00') findings.push('Screen Recorder preview duration remained 00:00 after a multi-second recording');
    if (state.size === 'Size: 0 B') findings.push('Screen Recorder produced an empty recording Blob');
    return findings;
  });
}

async function expectDenied({ name, viewport, toolId, preloadSource, clicks, expectedText }) {
  return withPage(viewport, preloadSource, async (cdp) => {
    const findings = [];
    await navigateTool(cdp, toolId);
    for (const click of clicks) await clickText(cdp, click);
    await waitFor(() => evaluate(cdp, `document.body.innerText.includes(${JSON.stringify(expectedText)})`), `${name} denial feedback`, 4_000);
    return findings;
  }, { includeConsole: false });
}

const FLOWS = [
  ['QR camera start/stop', flowQrCamera],
  ['Barcode camera scan loop/cleanup', flowBarcodeCamera],
  ['Document Scanner camera attach/cleanup', flowDocumentCamera],
  ['Audio Recorder microphone lifecycle', flowAudioRecorderMic],
  ['Speech-to-Text microphone lifecycle', flowSpeechRecorderMic],
  ['Screen Recorder capture/pause/resume/preview', flowScreenRecorder],
  ['QR camera denial', () => expectDenied({ name: 'QR camera', viewport: MOBILE, toolId: 'qr-studio', preloadSource: DENY_USER_MEDIA_SCRIPT, clicks: ['Scan QR Code', 'Start Camera Scan'], expectedText: 'Camera permission was denied or no camera device is available' })],
  ['Barcode camera denial', () => expectDenied({ name: 'Barcode camera', viewport: MOBILE, toolId: 'barcode-studio', preloadSource: DENY_USER_MEDIA_SCRIPT, clicks: ['Scan Barcode', 'Start Camera Scan'], expectedText: 'Permission denied by R7' })],
  ['Document Scanner camera denial', () => expectDenied({ name: 'Document Scanner camera', viewport: MOBILE, toolId: 'document-scanner', preloadSource: DENY_USER_MEDIA_SCRIPT, clicks: ['Use Camera'], expectedText: 'Camera access was blocked or not available' })],
  ['Audio Recorder microphone denial', () => expectDenied({ name: 'Audio Recorder microphone', viewport: DESKTOP, toolId: 'audio-recorder', preloadSource: DENY_USER_MEDIA_SCRIPT, clicks: ['Start Recording'], expectedText: 'Microphone access was denied or is unavailable' })],
  ['Speech-to-Text microphone denial', () => expectDenied({ name: 'Speech-to-Text microphone', viewport: DESKTOP, toolId: 'speech-to-text', preloadSource: DENY_USER_MEDIA_SCRIPT, clicks: ['Start Recording'], expectedText: 'Microphone access was denied or is unavailable on this device' })],
  ['Screen Recorder capture denial', () => expectDenied({ name: 'Screen Recorder capture', viewport: DESKTOP, toolId: 'screen-recorder', preloadSource: DENY_DISPLAY_MEDIA_SCRIPT, clicks: ['Start Recording'], expectedText: 'Screen capture permission was cancelled or denied' })],
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
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-r7-chrome-'));
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
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
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
    console.log(`R7 Chromium capability acceptance: ${FLOWS.length} media/permission journeys`);
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
      console.error(`\nR7 capability acceptance FAILED with ${failures.length} finding(s):`);
      failures.forEach((finding) => console.error(`- ${finding}`));
      process.exitCode = 1;
      return;
    }

    console.log('\nR7 capability acceptance PASSED');
    console.log(`- ${FLOWS.length}/${FLOWS.length} media/permission journeys passed`);
    console.log('- QR, Barcode, and Document Scanner camera streams attached and cleaned up');
    console.log('- Barcode camera scan loop executed against a deterministic detector');
    console.log('- Audio Recorder and Speech-to-Text microphone lifecycles cleaned up on SPA navigation');
    console.log('- Screen Recorder recording, pause/resume, stop, preview duration, Blob creation, and track cleanup verified');
    console.log('- camera, microphone, and screen-capture denial states surfaced user-visible recovery feedback');
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
