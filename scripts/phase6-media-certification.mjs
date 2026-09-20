import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const OUT = process.env.PHASE6_MEDIA_OUT
  ? path.resolve(ROOT, process.env.PHASE6_MEDIA_OUT)
  : path.resolve(ROOT, 'artifacts', 'phase6-media-certification');
const FIXTURES = path.join(OUT, 'fixtures');
const HOST = '127.0.0.1';
const PORT = 4196;
const DEBUG_PORT = 9246;
const BASE = `http://${HOST}:${PORT}/tools/`;
const FAMILY_TOTAL = 44;
const TARGET_IDS = [
  'screen-recorder',
  'reverse-audio',
  'stereo-mono-converter',
  'ringtone-maker',
  'loop-video',
  'crop-resize-video',
  'mute-video',
  'video-volume-changer',
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

async function getMediaTools() {
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
    const media = toolsModule.TOOLS_REGISTRY.filter((tool) => tool.category === 'media');
    if (media.length !== FAMILY_TOTAL) throw new Error(`Expected ${FAMILY_TOTAL} media routes, found ${media.length}.`);
    const missing = TARGET_IDS.filter((id) => !media.some((tool) => tool.id === id));
    if (missing.length) throw new Error(`Missing Phase 6 target routes: ${missing.join(', ')}`);
    return TARGET_IDS.map((id) => {
      const tool = media.find((row) => row.id === id);
      return { id: tool.id, name: tool.name, route: tool.route, category: tool.category };
    });
  } finally {
    await vite.close();
  }
}

async function makeFixtures() {
  await mkdir(FIXTURES, { recursive: true });
  const files = {
    audio: path.join(FIXTURES, 'sample.wav'),
    video: path.join(FIXTURES, 'clip.webm'),
  };

  // Browser decoding is intentionally mocked at the API boundary. The files are
  // real upload objects so React/FileList paths are still exercised.
  await writeFile(files.audio, Buffer.from('RIFFphase6WAVEfmt data'));
  await writeFile(files.video, Buffer.from('phase6-webm-fixture'));
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

const PRELOAD = `(() => {
  window.__ttDownloads = [];
  window.__ttVideoPlayCount = 0;
  window.__ttCaptureDimensions = null;
  window.__ttLastRecorderAudioTracks = null;
  window.__ttGainValues = [];
  window.__ttLastCreatedChannels = null;
  window.__ttLastCreatedLength = null;

  const nativeAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    window.__ttDownloads.push({ download: this.download || '', href: this.href || '' });
    if (!this.download) return nativeAnchorClick.call(this);
  };

  class MockTrack {
    constructor(kind) {
      this.kind = kind;
      this.stopped = false;
      this.onended = null;
    }
    stop() { this.stopped = true; }
  }

  class MockMediaStream {
    constructor(tracks = []) { this._tracks = [...tracks]; }
    getTracks() { return [...this._tracks]; }
    getVideoTracks() { return this._tracks.filter((track) => track.kind === 'video'); }
    getAudioTracks() { return this._tracks.filter((track) => track.kind === 'audio'); }
  }
  Object.defineProperty(window, 'MediaStream', { configurable: true, writable: true, value: MockMediaStream });

  class MockAudioBuffer {
    constructor(channels = 2, length = 4800, sampleRate = 48000) {
      this.numberOfChannels = channels;
      this.length = length;
      this.sampleRate = sampleRate;
      this.duration = length / sampleRate;
      this._data = Array.from({ length: channels }, (_, channel) => {
        const out = new Float32Array(length);
        for (let i = 0; i < length; i += 1) {
          out[i] = Math.sin(2 * Math.PI * (220 + channel * 110) * i / sampleRate) * 0.4;
        }
        return out;
      });
    }
    getChannelData(index) { return this._data[index]; }
    copyToChannel(source, channelNumber, startInChannel = 0) {
      this._data[channelNumber].set(source, startInChannel);
    }
  }

  class MockGain {
    constructor() {
      let current = 1;
      this.gain = {
        get value() { return current; },
        set value(value) {
          current = Number(value);
          window.__ttGainValues.push(current);
        },
        setTargetAtTime(value) {
          current = Number(value);
          window.__ttGainValues.push(current);
        },
      };
    }
    connect(node) { return node; }
  }

  class MockAudioContext {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 48000;
      this.destination = {};
    }
    async decodeAudioData() { return new MockAudioBuffer(); }
    createBuffer(channels, length, sampleRate) {
      window.__ttLastCreatedChannels = channels;
      window.__ttLastCreatedLength = length;
      return new MockAudioBuffer(channels, length, sampleRate);
    }
    createMediaStreamDestination() {
      return { stream: new MockMediaStream([new MockTrack('audio')]) };
    }
    createMediaElementSource() {
      return { connect(node) { return node; } };
    }
    createGain() { return new MockGain(); }
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect(node) { return node; },
        start() {},
        stop() {},
      };
    }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: MockAudioContext });

  class MockMediaRecorder {
    static isTypeSupported(type) {
      return /^video\\/(?:webm|mp4)/i.test(String(type));
    }
    constructor(stream, options = {}) {
      this.stream = stream;
      this.mimeType = options.mimeType || 'video/webm';
      this.state = 'inactive';
      this.ondataavailable = null;
      this.onstop = null;
      this.onerror = null;
      window.__ttLastRecorderAudioTracks = stream?.getAudioTracks?.().length ?? 0;
    }
    start() { this.state = 'recording'; }
    pause() { if (this.state === 'recording') this.state = 'paused'; }
    resume() { if (this.state === 'paused') this.state = 'recording'; }
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      queueMicrotask(() => {
        const data = new Blob(['phase6-video'], { type: this.mimeType });
        this.ondataavailable?.({ data });
        this.onstop?.();
      });
    }
  }
  Object.defineProperty(window, 'MediaRecorder', { configurable: true, writable: true, value: MockMediaRecorder });

  const mediaState = new WeakMap();
  Object.defineProperty(HTMLVideoElement.prototype, 'src', {
    configurable: true,
    get() { return mediaState.get(this)?.src || ''; },
    set(value) {
      const state = mediaState.get(this) || { currentTime: 0, ended: false };
      state.src = String(value);
      state.currentTime = 0;
      state.ended = false;
      mediaState.set(this, state);
      queueMicrotask(() => this.onloadedmetadata?.(new Event('loadedmetadata')));
    },
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'duration', {
    configurable: true,
    get() { return 0.08; },
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    configurable: true,
    get() { return 640; },
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    configurable: true,
    get() { return 360; },
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
    configurable: true,
    get() { return mediaState.get(this)?.currentTime || 0; },
    set(value) {
      const state = mediaState.get(this) || { src: '', currentTime: 0, ended: false };
      state.currentTime = Number(value) || 0;
      state.ended = false;
      mediaState.set(this, state);
      queueMicrotask(() => this.dispatchEvent(new Event('seeked')));
    },
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'ended', {
    configurable: true,
    get() { return Boolean(mediaState.get(this)?.ended); },
  });
  HTMLVideoElement.prototype.play = async function () {
    const state = mediaState.get(this) || { src: '', currentTime: 0, ended: false };
    state.currentTime = 0.08;
    state.ended = true;
    mediaState.set(this, state);
    window.__ttVideoPlayCount += 1;
  };
  HTMLVideoElement.prototype.pause = function () {};
  HTMLVideoElement.prototype.load = function () {};

  const context2d = {
    fillStyle: '#000',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    fillRect() {},
    drawImage() {},
    fillText() {},
    measureText(text) { return { width: String(text).length * 8 }; },
  };
  HTMLCanvasElement.prototype.getContext = function (type) {
    if (type === '2d') return context2d;
    return null;
  };
  HTMLCanvasElement.prototype.captureStream = function () {
    window.__ttCaptureDimensions = { width: this.width, height: this.height };
    return new MockMediaStream([new MockTrack('video')]);
  };

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getDisplayMedia: async () => new MockMediaStream([new MockTrack('video'), new MockTrack('audio')]),
      getUserMedia: async () => new MockMediaStream([new MockTrack('audio')]),
    },
  });
})();`;

function fixtureExpression(id) {
  return `(async () => {
    const id = ${JSON.stringify(id)};
    const root = document.querySelector('[data-tool-id="' + CSS.escape(id) + '"] .tt-tool-content');
    if (!root) return { ok: false, message: 'tool content missing' };

    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const body = () => (root.innerText || '').replace(/\\s+/g, ' ').trim();
    const button = (text) => [...root.querySelectorAll('button')].find((node) => (node.textContent || '').trim() === text);
    const downloads = () => window.__ttDownloads || [];
    const until = async (check, label, timeout = 6000) => {
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
    const setNativeValue = (element, value) => {
      const proto = element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter ? setter.call(element, String(value)) : element.value = String(value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const controlByLabel = (prefix, selector) => {
      const label = [...root.querySelectorAll('label')].find((node) =>
        (node.textContent || '').trim().toLowerCase().startsWith(prefix.toLowerCase())
      );
      return label?.querySelector(selector) || null;
    };

    try {
      if (id === 'screen-recorder') {
        click('Start Recording');
        await until(() => Boolean(button('Stop & Preview')), 'recording state');
        click('Stop & Preview');
        await until(() => Boolean(button('Download Video')), 'recording preview');
        click('Download Video');
        await until(() => downloads().some((row) => /^screen-recording-.*\\.webm$/i.test(row.download)), 'recording download');
        return { ok: true, message: 'mock display stream recorded, stopped, previewed, and downloaded' };
      }

      if (id === 'reverse-audio') {
        await until(() => body().includes('0:00.10') && body().includes('48,000 Hz'), 'reverse audio decode');
        click('Reverse selection');
        await until(() => { const text=body().toLowerCase(); return text.includes('samples reversed') && /4[,\s]?800/.test(text); }, 'reverse summary');
        click('Download WAV');
        await until(() => downloads().some((row) => row.download === 'sample-reversed.wav'), 'reverse WAV download');
        return { ok: true, message: 'full audio selection reversed and exported' };
      }

      if (id === 'stereo-mono-converter') {
        await until(() => body().includes('2 channels') && body().includes('0.10s'), 'stereo decode');
        click('Process & download WAV');
        await until(() => downloads().some((row) => row.download === 'sample-stereo-mono-converter.wav'), 'mono WAV download');
        if (window.__ttLastCreatedChannels !== 1) throw new Error('expected mono output buffer');
        return { ok: true, message: 'stereo source downmixed to one-channel WAV' };
      }

      if (id === 'ringtone-maker') {
        await until(() => body().includes('0.10s'), 'ringtone decode');
        const start = controlByLabel('Start seconds', 'input');
        if (!start) throw new Error('ringtone start input missing');
        setNativeValue(start, 0.02);
        click('Process & download WAV');
        await until(() => downloads().some((row) => row.download === 'sample-ringtone-maker.wav'), 'ringtone WAV download');
        if (window.__ttLastCreatedLength !== 3840) throw new Error('unexpected ringtone output length: ' + window.__ttLastCreatedLength);
        return { ok: true, message: '0.02s–0.10s ringtone selection exported with bounded trim' };
      }

      if (['loop-video','crop-resize-video','mute-video','video-volume-changer'].includes(id)) {
        await until(() => body().includes('640×360') && body().includes('0.08s'), 'video metadata');

        if (id === 'loop-video') {
          const repeats = controlByLabel('Repeats', 'input');
          if (!repeats) throw new Error('loop repeat input missing');
          setNativeValue(repeats, 3);
        }

        if (id === 'crop-resize-video') {
          const size = controlByLabel('Output size', 'select');
          const aspect = controlByLabel('Aspect', 'select');
          if (!size || !aspect) throw new Error('crop/resize controls missing');
          setNativeValue(size, '480');
          setNativeValue(aspect, '1:1');
        }

        if (id === 'video-volume-changer') {
          const volume = controlByLabel('Source volume', 'input');
          if (!volume) throw new Error('video volume control missing');
          setNativeValue(volume, 0.5);
          await until(() => body().includes('Source volume 50%'), 'video volume state');
        }

        click('Process & download');
        const expected = 'clip-' + id + '.webm';
        await until(() => downloads().some((row) => row.download === expected), id + ' download', 8000);

        if (id === 'loop-video' && window.__ttVideoPlayCount < 3) {
          throw new Error('loop render did not repeat playback three times');
        }
        if (id === 'crop-resize-video') {
          const dimensions = window.__ttCaptureDimensions;
          if (!dimensions || dimensions.width !== 480 || dimensions.height !== 480) {
            throw new Error('unexpected capture dimensions: ' + JSON.stringify(dimensions));
          }
        }
        if (id === 'mute-video' && window.__ttLastRecorderAudioTracks !== 0) {
          throw new Error('mute-video output still contains an audio track');
        }
        if (id === 'video-volume-changer' && !window.__ttGainValues.some((value) => Math.abs(value - 0.5) < 1e-9)) {
          throw new Error('video source gain was not set to 0.5');
        }
        return { ok: true, message: id + ' real-time transform emitted deterministic browser export' };
      }

      return { ok: false, message: 'no Phase 6 fixture for ' + id };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  })()`;
}

const FILES_BY_ID = new Map();

async function setRouteFile(cdp, id) {
  const fixtures = FILES_BY_ID.get(id);
  if (!fixtures || id === 'screen-recorder') return;
  const audioIds = new Set(['reverse-audio', 'stereo-mono-converter', 'ringtone-maker']);
  const selector = audioIds.has(id)
    ? 'input[type="file"][accept*="audio"]'
    : 'input[type="file"][accept="video/*"]';
  await setFiles(cdp, selector, [audioIds.has(id) ? fixtures.audio : fixtures.video]);
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

async function auditTool(tool) {
  const { target, cdp } = await openPage();
  const errors = collectErrors(cdp);
  try {
    await cdp.send('Page.navigate', { url: `${BASE}#/tool/${tool.id}` });
    await waitFor(
      () => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.querySelector('[data-tool-id="${tool.id}"] .tt-tool-content'))`),
      `${tool.id} mount`
    );
    await setRouteFile(cdp, tool.id);
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
  return `# Phase 6 — Media Certification

- Media family routes: **${FAMILY_TOTAL}**
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

  const tools = await getMediaTools();
  const fixtures = await makeFixtures();
  for (const id of TARGET_IDS) FILES_BY_ID.set(id, fixtures);

  for (const tool of tools) {
    const source = fixtureExpression(tool.id);
    try {
      new Function(`return ${source};`);
    } catch (error) {
      throw new Error(`Generated Phase 6 fixture is invalid for ${tool.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const server = await createStaticServer();
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-phase6-media-'));
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
    console.log(`Phase 6 media certification: ${tools.length} blocked workflows`);
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
    await writeFile(path.join(OUT, 'media-certification.json'), JSON.stringify(report, null, 2));
    await writeFile(path.join(OUT, 'media-certification.md'), markdown(report));
    console.log(`Phase 6 media summary ${JSON.stringify(summary)}`);
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
