import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const OUT = process.env.PHASE4_DEVICE_OUT
  ? path.resolve(ROOT, process.env.PHASE4_DEVICE_OUT)
  : path.resolve(ROOT, 'artifacts', 'phase4-device-certification');
const HOST = '127.0.0.1';
const PORT = 4194;
const DEBUG_PORT = 9244;
const BASE = `http://${HOST}:${PORT}/tools/`;
const EXPECTED = 25;

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

async function getDeviceTools() {
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
    const tools = toolsModule.TOOLS_REGISTRY.filter((tool) => tool.category === 'device');
    if (tools.length !== EXPECTED) throw new Error(`Expected ${EXPECTED} device tools, found ${tools.length}.`);
    return tools.map(({ id, name, route, category }) => ({ id, name, route, category }));
  } finally {
    await vite.close();
  }
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

function preloadFor(id) {
  if (id === 'gamepad-test') return `(() => {
    const pad = {
      id: 'Tiny Tools Mock Gamepad',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0.125, -0.05],
      buttons: [{ pressed: false, value: 0 }, { pressed: true, value: 1 }],
    };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  })();`;

  if (id === 'battery-status') return `(() => {
    const manager = new EventTarget();
    Object.assign(manager, {
      charging: false,
      chargingTime: Infinity,
      dischargingTime: 7200,
      level: 0.42,
    });
    Object.defineProperty(navigator, 'getBattery', { configurable: true, value: async () => manager });
  })();`;

  if (id === 'codec-support-tester') return `(() => {
    try {
      Object.defineProperty(HTMLMediaElement.prototype, 'canPlayType', {
        configurable: true,
        value(mime) { return String(mime).includes('audio/mpeg') ? 'probably' : 'maybe'; },
      });
    } catch {}
    class MockMediaRecorder {
      static isTypeSupported(mime) { return String(mime).includes('webm'); }
    }
    try { Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: MockMediaRecorder }); }
    catch { window.MediaRecorder = MockMediaRecorder; }
  })();`;

  return '';
}

function fixtureExpression(id) {
  return `(async () => {
    const id = ${JSON.stringify(id)};
    const root = document.querySelector('[data-tool-id="' + CSS.escape(id) + '"] .tt-tool-content');
    if (!root) return { ok: false, message: 'tool content missing' };

    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const body = () => (root.innerText || '').replace(/\\s+/g, ' ').trim();
    const button = (pattern) => [...root.querySelectorAll('button')].find((node) => pattern.test((node.textContent || '').trim()));
    const metric = (label) => {
      const labels = [...root.querySelectorAll('div')].filter((node) => node.children.length === 0 && (node.textContent || '').trim() === label);
      for (const labelNode of labels) {
        const parent = labelNode.parentElement;
        if (parent?.children?.[1]) return (parent.children[1].textContent || '').trim();
      }
      return '';
    };
    const until = async (check, label, timeout = 5000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        const value = check();
        if (value) return value;
        await pause(20);
      }
      throw new Error('Timed out waiting for ' + label);
    };
    const click = (pattern) => {
      const target = button(pattern);
      if (!target) throw new Error('Button not found: ' + pattern);
      target.click();
      return target;
    };
    const setNavigator = (name, value) => {
      try { Object.defineProperty(navigator, name, { configurable: true, value }); return; } catch {}
      try { Object.defineProperty(Object.getPrototypeOf(navigator), name, { configurable: true, value }); } catch {}
    };
    const installAudio = () => {
      window.__ttAudioStarts = 0;
      class MockParam {
        constructor(value = 0) { this.value = value; }
        setTargetAtTime(value) { this.value = value; }
        setValueAtTime(value) { this.value = value; }
        exponentialRampToValueAtTime(value) { this.value = value; }
      }
      class MockOscillator extends EventTarget {
        constructor() { super(); this.frequency = new MockParam(440); this.type = 'sine'; }
        connect(node) { return node; }
        start() { window.__ttAudioStarts += 1; }
        stop() { queueMicrotask(() => this.dispatchEvent(new Event('ended'))); }
      }
      class MockGain {
        constructor() { this.gain = new MockParam(1); }
        connect(node) { return node; }
      }
      class MockPanner {
        constructor() { this.pan = new MockParam(0); }
        connect(node) { return node; }
      }
      class MockAnalyser {
        constructor() { this.fftSize = 4096; }
        getByteTimeDomainData(array) {
          for (let i = 0; i < array.length; i += 1) array[i] = i % 2 ? 160 : 96;
        }
        getFloatTimeDomainData(array) {
          for (let i = 0; i < array.length; i += 1) array[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * 0.6;
        }
      }
      class MockAudioContext {
        constructor() { this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; }
        createOscillator() { return new MockOscillator(); }
        createGain() { return new MockGain(); }
        createStereoPanner() { return new MockPanner(); }
        createAnalyser() { return new MockAnalyser(); }
        createMediaStreamSource() { return { connect() {} }; }
        close() { return Promise.resolve(); }
      }
      Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: MockAudioContext });
      return MockAudioContext;
    };
    const installMedia = () => {
      const videoTrack = { stop() {}, getSettings() { return { width: 1280, height: 720, frameRate: 30, facingMode: 'user', deviceId: 'mock-camera' }; } };
      const audioTrack = { stop() {} };
      setNavigator('mediaDevices', {
        getUserMedia: async (constraints) => ({
          getTracks: () => constraints?.video ? [videoTrack] : [audioTrack],
          getVideoTracks: () => constraints?.video ? [videoTrack] : [],
        }),
      });
      try {
        Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: async function () {} });
        Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
          configurable: true,
          get() { return this.__ttSrcObject ?? null; },
          set(value) { this.__ttSrcObject = value; },
        });
      } catch {}
    };
    const installFetch = () => {
      const nativeSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = (fn, ms, ...args) => nativeSetTimeout(fn, Math.min(Number(ms) || 0, 5), ...args);
      window.fetch = async (input, init = {}) => {
        const url = new URL(String(input), location.href);
        if (url.pathname.endsWith('/meta')) {
          return new Response(JSON.stringify({ clientIp: '203.0.113.10', country: 'DE', colo: 'FRA' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if ((init.method || 'GET').toUpperCase() === 'POST') return new Response('ok', { status: 200 });
        const bytes = Math.max(1, Number(url.searchParams.get('bytes') || 1));
        return new Response(new Uint8Array(bytes), { status: 200 });
      };
    };

    try {
      if (id === 'microphone-test') {
        installAudio(); installMedia();
        click(/^Start microphone$/);
        await until(() => metric('Session peak') !== '0%' && metric('Session peak') !== '', 'microphone peak');
        click(/^Stop$/);
        return { ok: true, message: 'mock microphone level and stop workflow' };
      }

      if (id === 'webcam-test') {
        installMedia();
        click(/^Start camera$/);
        await until(() => body().includes('1280 × 720'), 'camera settings');
        click(/^Stop$/);
        return { ok: true, message: 'mock camera settings and stop workflow' };
      }

      if (id === 'speaker-test') {
        installAudio();
        click(/^Both$/);
        await pause(20);
        if (!(window.__ttAudioStarts >= 1)) throw new Error('oscillator did not start');
        return { ok: true, message: 'stereo test oscillator started' };
      }

      if (id === 'keyboard-test') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }));
        await until(() => body().includes('KeyA') && body().includes('keydown'), 'keyboard event row');
        return { ok: true, message: 'keydown/up event captured' };
      }

      if (id === 'mouse-test') {
        const surface = [...root.querySelectorAll('div')].find((node) => (node.textContent || '').includes('Move, click, scroll'));
        if (!surface) throw new Error('mouse test surface missing');
        surface.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 40, clientY: 50, buttons: 1, pointerId: 1 }));
        surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 120 }));
        surface.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        await until(() => metric('Double-clicks') === '1' && metric('Last wheel delta').includes('120'), 'mouse metrics');
        return { ok: true, message: 'pointer wheel and double-click captured' };
      }

      if (id === 'dead-pixel-test') {
        const surface = root.querySelector('.aspect-video');
        if (!surface) throw new Error('pixel surface missing');
        const before = surface.getAttribute('style') || '';
        const red = root.querySelector('button[aria-label="Use #ff0000"]');
        if (!red) throw new Error('red pixel selector missing');
        red.click();
        await until(() => (surface.getAttribute('style') || '') !== before, 'pixel color change');
        return { ok: true, message: 'solid-color surface changes' };
      }

      if (id === 'display-test') {
        const surface = root.querySelector('.aspect-video');
        if (!surface) throw new Error('display surface missing');
        const before = surface.getAttribute('style') || '';
        click(/^bars$/i);
        await until(() => (surface.getAttribute('style') || '') !== before, 'display pattern change');
        return { ok: true, message: 'display pattern switches' };
      }

      if (id === 'refresh-rate-test') {
        let frame = 0;
        let time = 0;
        window.requestAnimationFrame = (callback) => {
          const token = ++frame;
          queueMicrotask(() => { time += 1000 / 60; callback(time); });
          return token;
        };
        window.cancelAnimationFrame = () => {};
        click(/^Measure refresh rate$/);
        await until(() => metric('Estimated refresh').includes('Hz') && metric('Estimated refresh') !== '—', 'refresh result');
        const hz = Number.parseFloat(metric('Estimated refresh'));
        if (!(hz > 59 && hz < 61)) throw new Error('unexpected refresh estimate: ' + metric('Estimated refresh'));
        return { ok: true, message: 'deterministic 60 Hz RAF measurement' };
      }

      if (id === 'device-info') {
        if (!metric('Screen size').includes('×') || !body().includes('Logical CPU threads')) throw new Error('device metrics missing');
        return { ok: true, message: 'browser-exposed device metrics rendered' };
      }

      if (id === 'touchscreen-test') {
        try { Object.defineProperty(Element.prototype, 'setPointerCapture', { configurable: true, value() {} }); } catch {}
        const surface = root.querySelector('.h-96.touch-none');
        if (!surface) throw new Error('touch surface missing');
        surface.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: 40, clientY: 50, pressure: 0.5, buttons: 1 }));
        await until(() => metric('Active contacts') === '1', 'touch contact');
        surface.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: 40, clientY: 50, pressure: 0, buttons: 0 }));
        return { ok: true, message: 'synthetic touch contact tracked' };
      }

      if (id === 'gamepad-test') {
        await until(() => body().includes('Tiny Tools Mock Gamepad'), 'mock gamepad', 2500);
        if (metric('Axes') !== '2' || metric('Buttons') !== '2') throw new Error('gamepad dimensions not rendered');
        return { ok: true, message: 'mock gamepad axes/buttons rendered' };
      }

      if (id === 'polling-rate-test') {
        const surface = [...root.querySelectorAll('div')].find((node) => (node.textContent || '').includes('Move the pointer rapidly here'));
        if (!surface) throw new Error('polling surface missing');
        for (let i = 0; i < 24; i += 1) {
          const event = new PointerEvent('pointermove', { bubbles: true, clientX: 20 + i, clientY: 30, pointerId: 1 });
          try { Object.defineProperty(event, 'timeStamp', { configurable: true, value: i * 2 }); } catch {}
          surface.dispatchEvent(event);
        }
        await until(() => metric('Browser event rate').includes('Hz') && metric('Browser event rate') !== '—', 'polling result');
        return { ok: true, message: 'pointer-event cadence summarized' };
      }

      if (id === 'keyboard-ghosting-test') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', bubbles: true }));
        await until(() => metric('Maximum observed') === '2', 'rollover maximum');
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'b', code: 'KeyB', bubbles: true }));
        return { ok: true, message: 'two-key rollover captured' };
      }

      if (id === 'battery-status') {
        await until(() => metric('Level') === '42%', 'battery level');
        if (metric('Time remaining') !== '2h 0m') throw new Error('battery remaining time mismatch: ' + metric('Time remaining'));
        return { ok: true, message: 'mock battery state rendered' };
      }

      if (id === 'tone-generator') {
        Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: undefined });
        click(/^Start tone$/);
        await until(() => body().includes('Web Audio output is unavailable'), 'unsupported audio message');
        installAudio();
        click(/^Start tone$/);
        await until(() => window.__ttAudioStarts >= 1 && !button(/^Stop$/).disabled, 'tone start');
        click(/^Stop$/);
        return { ok: true, message: 'unsupported fallback and successful oscillator start' };
      }

      if (id === 'instrument-tuner') {
        installAudio(); installMedia();
        click(/^Start tuner$/);
        await until(() => body().includes('A4') && body().includes('Hz'), 'tuner A4', 3500);
        click(/^Stop$/);
        return { ok: true, message: 'mock 440 Hz signal resolves to A4' };
      }

      if (id === 'internet-speed-test') {
        installFetch();
        click(/^Run speed test$/);
        await until(() => body().includes('Measured payload throughput') && body().includes('Complete.'), 'speed results', 3500);
        return { ok: true, message: 'mock download/upload/latency workflow completed' };
      }

      if (id === 'connection-stability-test') {
        installFetch();
        const select = root.querySelector('select');
        if (select) {
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
          setter ? setter.call(select, '10') : select.value = '10';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        click(/^Start stability test$/);
        await until(() => body().includes('Quality score') && body().includes('/100'), 'stability results', 3500);
        return { ok: true, message: 'mock repeated HTTPS probes summarized' };
      }

      if (id === 'ipv4-ipv6-test') {
        installFetch();
        const ipButton = [...root.querySelectorAll('button')].find((node) => (node.textContent || '').trim() === 'Test IPv4 / IPv6');
        if (!ipButton) throw new Error('IPv4 / IPv6 test button missing');
        ipButton.click();
        await until(() => body().includes('Dual-stack (IPv4 + IPv6)'), 'dual-stack result');
        return { ok: true, message: 'mock IPv4 and IPv6 reachability classified' };
      }

      if (id === 'webrtc-leak-test') {
        class MockPeerConnection extends EventTarget {
          constructor() { super(); this.iceGatheringState = 'new'; this.onicecandidate = null; }
          createDataChannel() {}
          async createOffer() { return { type: 'offer', sdp: '' }; }
          async setLocalDescription() {
            this.onicecandidate?.({ candidate: { candidate: 'candidate:1 1 udp 2122260223 192.168.1.20 54321 typ host' } });
            this.iceGatheringState = 'complete';
            this.dispatchEvent(new Event('icegatheringstatechange'));
          }
          close() {}
        }
        Object.defineProperty(window, 'RTCPeerConnection', { configurable: true, value: MockPeerConnection });
        click(/^Run WebRTC leak test$/);
        await until(() => metric('Candidates') === '1' && metric('Literal IPs') === '1', 'ICE summary');
        return { ok: true, message: 'mock ICE candidate parsed and summarized' };
      }

      if (id === 'browser-capability-inspector') {
        if (!body().includes('Supported') || !body().includes('Coverage') || !body().includes('Groups')) throw new Error('capability summary missing');
        return { ok: true, message: 'local capability matrix rendered' };
      }

      if (id === 'webgl-inspector') {
        const gl = {
          MAX_VIEWPORT_DIMS: 1,
          VERSION: 2,
          SHADING_LANGUAGE_VERSION: 3,
          VENDOR: 4,
          RENDERER: 5,
          MAX_TEXTURE_SIZE: 6,
          MAX_CUBE_MAP_TEXTURE_SIZE: 7,
          MAX_RENDERBUFFER_SIZE: 8,
          MAX_COMBINED_TEXTURE_IMAGE_UNITS: 9,
          getExtension(name) { return name === 'WEBGL_debug_renderer_info' ? { UNMASKED_VENDOR_WEBGL: 10, UNMASKED_RENDERER_WEBGL: 11 } : null; },
          getParameter(param) {
            const values = new Map([
              [1, new Int32Array([8192, 8192])],
              [2, 'WebGL 2 Mock'],
              [3, 'GLSL Mock'],
              [4, 'Mock Vendor'],
              [5, 'Mock Renderer'],
              [6, 8192],
              [7, 8192],
              [8, 8192],
              [9, 16],
              [10, 'Mock Unmasked Vendor'],
              [11, 'Mock Unmasked Renderer'],
            ]);
            return values.get(param);
          },
          getSupportedExtensions() { return ['EXT_mock']; },
          getContextAttributes() { return { antialias: true }; },
        };
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, options) {
          if (type === 'webgl2' || type === 'webgl') return gl;
          return original.call(this, type, options);
        };
        click(/^Inspect WebGL$/);
        await until(() => body().includes('Mock Renderer') && body().includes('WebGL 2'), 'WebGL details');
        return { ok: true, message: 'mock WebGL limits and renderer rendered' };
      }

      if (id === 'webgpu-inspector') {
        setNavigator('gpu', {
          requestAdapter: async () => ({
            info: { vendor: 'MockVendor', architecture: 'MockArch', device: 'MockDevice', description: 'Mock GPU' },
            limits: {
              maxTextureDimension2D: 8192,
              maxBindGroups: 4,
              maxBufferSize: 268435456,
              maxStorageBufferBindingSize: 134217728,
              maxComputeWorkgroupStorageSize: 32768,
              maxComputeInvocationsPerWorkgroup: 256,
            },
            features: new Set(['mock-feature']),
          }),
        });
        click(/^Inspect WebGPU$/);
        await until(() => body().includes('MockVendor') && body().includes('mock-feature'), 'WebGPU details');
        return { ok: true, message: 'mock WebGPU adapter and limits rendered' };
      }

      if (id === 'codec-support-tester') {
        if (!body().includes('MP3') || !body().includes('probably') || !body().includes('Test matrix: 13')) throw new Error('codec matrix not rendered with deterministic probes');
        return { ok: true, message: '13-row codec matrix rendered from injected probes' };
      }

      if (id === 'storage-quota-inspector') {
        setNavigator('storage', {
          estimate: async () => ({ usage: 1024 * 1024, quota: 10 * 1024 * 1024, usageDetails: { indexedDB: 512 * 1024 } }),
          persisted: async () => false,
          persist: async () => true,
          getDirectory: async () => ({}),
        });
        if (typeof window.indexedDB === 'undefined') Object.defineProperty(window, 'indexedDB', { configurable: true, value: {} });
        if (typeof window.caches === 'undefined') Object.defineProperty(window, 'caches', { configurable: true, value: {} });
        click(/^Inspect storage$/);
        await until(() => body().includes('1.00 MiB') && metric('OPFS') === 'Supported', 'storage estimate');
        click(/^Request persistent storage$/);
        await until(() => metric('Persistent') === 'Granted', 'persistent storage result');
        return { ok: true, message: 'mock quota and persistence workflow rendered' };
      }

      return { ok: false, message: 'no Phase 4 fixture for ' + id };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  })()`;
}

async function openPage(preloadScript) {
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
  if (preloadScript) await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: preloadScript });
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
  const { target, cdp } = await openPage(preloadFor(tool.id));
  const errors = collectErrors(cdp);
  try {
    await cdp.send('Page.navigate', { url: `${BASE}#/tool/${tool.id}` });
    await waitFor(
      () => evaluate(cdp, `document.readyState === 'complete' && Boolean(document.querySelector('[data-tool-id="${tool.id}"] .tt-tool-content'))`),
      `${tool.id} mount`
    );
    await evaluate(cdp, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))`);
    const fixture = await evaluate(cdp, fixtureExpression(tool.id));
    await sleep(40);
    const uniqueErrors = [...new Set(errors)];
    const findings = [];
    if (!fixture?.ok) findings.push(fixture?.message || 'fixture did not report success');
    findings.push(...uniqueErrors);

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
  return `# Phase 4 — Device & Browser Diagnostics Certification

- Total device routes: **${report.summary.total}**
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

  const tools = await getDeviceTools();
  const server = await createStaticServer();
  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-phase4-device-'));
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
    console.log(`Phase 4 device certification: ${tools.length} routes`);
    for (let index = 0; index < tools.length; index += 1) {
      const tool = tools[index];
      const result = await auditTool(tool);
      results.push(result);
      console.log(`${result.status === 'PASS' ? '✓' : '✗'} ${index + 1}/${tools.length} ${tool.id}${result.findings.length ? ` — ${result.findings[0]}` : ''}`);
    }

    const summary = { total: results.length, PASS: results.filter((row) => row.status === 'PASS').length, FAIL: results.filter((row) => row.status === 'FAIL').length };
    const report = {
      generatedAt: new Date().toISOString(),
      baselineCommit: process.env.GITHUB_SHA ?? null,
      summary,
      results,
    };
    await writeFile(path.join(OUT, 'device-certification.json'), JSON.stringify(report, null, 2));
    await writeFile(path.join(OUT, 'device-certification.md'), markdown(report));
    console.log(`Phase 4 device summary ${JSON.stringify(summary)}`);
    if (summary.total !== EXPECTED || summary.FAIL) process.exitCode = 1;
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
