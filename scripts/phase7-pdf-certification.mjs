import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = process.env.PHASE7_PDF_OUT
  ? path.resolve(ROOT, process.env.PHASE7_PDF_OUT)
  : path.resolve(ROOT, 'artifacts', 'phase7-pdf-certification');
const FIXTURES = path.join(OUT, 'fixtures');
const HOST = '127.0.0.1';
const DEBUG_PORT = 9247;
const PDF_BASE = process.env.PHASE7_PDF_BASE || 'https://thiepn.github.io/pdf/';
const FAMILY_TOTAL = 18;
const TARGETS = [
  { id: 'merge-pdf', hash: '#/merge' },
  { id: 'split-pdf', hash: '#/tools/split-pdf' },
  { id: 'ocr-pdf', hash: '#/tools/ocr-pdf' },
  { id: 'compress-pdf', hash: '#/tools/compress-pdf' },
  { id: 'pdf-metadata', hash: '#/tools/metadata' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, label, timeoutMs = 20_000) {
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

function padPdfOffset(value) {
  return String(value).padStart(10, '0');
}

function pdfStreamObject(number, dictionary, stream) {
  const length = new TextEncoder().encode(stream).length;
  return `${number} 0 obj\n<< ${dictionary}${dictionary ? ' ' : ''}/Length ${length} >>\nstream\n${stream}endstream\nendobj\n`;
}

function escapePdfText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createTextPdf(pageTexts) {
  const pageIds = pageTexts.map((_, index) => 4 + index * 2);
  const contentIds = pageTexts.map((_, index) => 5 + index * 2);
  const objects = [];

  objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageTexts.length} >>\nendobj\n`;
  objects[3] = '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

  for (let index = 0; index < pageTexts.length; index += 1) {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    const stream = [
      'BT',
      '/F1 24 Tf',
      '72 700 Td',
      `(${escapePdfText(pageTexts[index])}) Tj`,
      '0 -40 Td',
      '/F1 12 Tf',
      `(${escapePdfText(`Tiny Tools Phase 9 page ${index + 1} - searchable text.`)}) Tj`,
      'ET',
      '',
    ].join('\n');

    objects[pageId] = `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`;
    objects[contentId] = pdfStreamObject(contentId, '', stream);
  }

  const encoder = new TextEncoder();
  let body = '%PDF-1.7\n%TinyToolsPhase9\n';
  const offsets = [0];
  const maxId = 3 + pageTexts.length * 2;
  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = encoder.encode(body).length;
    body += objects[id];
  }

  const xrefOffset = encoder.encode(body).length;
  body += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) body += `${padPdfOffset(offsets[id])} 00000 n \n`;
  body += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return encoder.encode(body);
}

async function makeFixtures() {
  await mkdir(FIXTURES, { recursive: true });
  const one = path.join(FIXTURES, 'phase7-one.pdf');
  const two = path.join(FIXTURES, 'phase7-two.pdf');
  const three = path.join(FIXTURES, 'phase7-three.pdf');
  const ocr = path.join(FIXTURES, 'phase7-ocr.pdf');

  await writeFile(one, createTextPdf(['MERGE SOURCE ONE']));
  await writeFile(two, createTextPdf(['MERGE SOURCE TWO']));
  await writeFile(three, createTextPdf(['SPLIT PAGE ONE', 'SPLIT PAGE TWO', 'SPLIT PAGE THREE']));
  await writeFile(ocr, createTextPdf(['PHASE SEVEN OCR SEARCHABLE TEXT']));

  for (const file of [one, two, three, ocr]) {
    const info = await stat(file);
    if (info.size < 500) throw new Error(`Generated PDF fixture is unexpectedly small: ${file}`);
  }
  return { one, two, three, ocr };
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

async function evaluateUserGesture(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Browser user-gesture evaluation failed');
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
  window.__ttPdfDownloads = [];
  window.__ttPdfBlobMeta = new Map();

  const create = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (blob) {
    const url = create(blob);
    try {
      window.__ttPdfBlobMeta.set(url, {
        size: Number(blob?.size || 0),
        type: String(blob?.type || ''),
      });
    } catch {}
    return url;
  };

  const nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) {
      window.__ttPdfDownloads.push({
        download: this.download,
        href: this.href,
        blob: window.__ttPdfBlobMeta.get(this.href) || null,
      });
    }
    return nativeClick.call(this);
  };
})();`;

async function openPage(url, key) {
  const target = await newTarget();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable')]);
  const downloadDir = path.join(OUT, 'downloads', key);
  await mkdir(downloadDir, { recursive: true });
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
  const downloadEvents = [];
  cdp.on('Page.downloadWillBegin', (event) => downloadEvents.push(event));
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    screenWidth: 1440,
    screenHeight: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PRELOAD });
  await cdp.send('Page.navigate', { url });
  await waitFor(
    () => evaluate(cdp, `document.readyState === 'complete' && document.body && document.body.innerText.length > 20`),
    `page load for ${url}`,
    30_000
  );
  return { target, cdp, downloadDir, downloadEvents };
}

function collectErrors(cdp) {
  const errors = [];
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    errors.push(`uncaught: ${exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'unknown exception'}`);
  });
  cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
    if (type !== 'error' && type !== 'assert') return;
    const message = (args ?? []).map((arg) => arg.value ?? arg.description ?? '').filter(Boolean).join(' ');
    if (/favicon|service worker.*registration/i.test(message)) return;
    errors.push(`console.${type}: ${message || 'unknown console error'}`);
  });
  return errors;
}

async function bodyText(cdp) {
  return evaluate(cdp, `(document.body.innerText || '').replace(/\\s+/g, ' ').trim()`);
}

async function clickText(cdp, text) {
  return evaluateUserGesture(cdp, `(() => {
    const wanted = ${JSON.stringify(text)};
    const nodes = [...document.querySelectorAll('button,a')];
    const target = nodes.find((node) => (node.textContent || '').replace(/\\s+/g,' ').trim() === wanted);
    if (!target) throw new Error('Control not found: ' + wanted);
    target.click();
    return true;
  })()`);
}

async function setLabeledValue(cdp, labelPrefix, value, selector = 'input') {
  return evaluate(cdp, `(() => {
    const prefix = ${JSON.stringify(labelPrefix)}.toLowerCase();
    const label = [...document.querySelectorAll('label')].find((node) =>
      (node.textContent || '').replace(/\\s+/g,' ').trim().toLowerCase().startsWith(prefix)
    );
    const control = label?.querySelector(${JSON.stringify(selector)});
    if (!control) throw new Error('Labeled control not found: ' + ${JSON.stringify(labelPrefix)});
    const proto = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter ? setter.call(control, ${JSON.stringify(String(value))}) : control.value = ${JSON.stringify(String(value))};
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return control.value;
  })()`);
}

async function waitForDownload(cdp, predicateSource, label, timeout = 30_000) {
  return waitFor(
    () => evaluate(cdp, `(() => {
      const rows = window.__ttPdfDownloads || [];
      return rows.find((row) => (${predicateSource})(row)) || null;
    })()`),
    label,
    timeout
  );
}
async function waitForRealDownload(downloadDir, downloadEvents, filenamePattern, label, timeout = 60_000) {
  const event = await waitFor(
    () => downloadEvents.find((row) => filenamePattern.test(row.suggestedFilename || '')) || null,
    label + ' event',
    timeout
  );
  const file = path.join(downloadDir, event.suggestedFilename);
  await waitFor(async () => {
    try {
      const info = await stat(file);
      return info.size > 500 ? info : null;
    } catch {
      return null;
    }
  }, label + ' file', timeout);
  const bytes = await readFile(file);
  return { event, file, bytes };
}

function waitForCdpEvent(cdp, method, timeout = 10_000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    cdp.on(method, (params) => {
      if (settled) return;
      settled = true;
      resolve(params);
    });
    setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timed out waiting for CDP event ${method}`));
    }, timeout);
  });
}

async function importForTask(cdp, file) {
  await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true });
  const chooser = waitForCdpEvent(cdp, 'Page.fileChooserOpened', 10_000);
  await clickText(cdp, 'Choose PDF');
  const event = await chooser;
  if (!event?.backendNodeId) throw new Error('PDF file chooser did not expose a backend node.');
  await cdp.send('DOM.setFileInputFiles', { backendNodeId: event.backendNodeId, files: [file] });
  await cdp.send('Page.setInterceptFileChooserDialog', { enabled: false });
}

async function certifyMerge(fixtures) {
  const { target, cdp, downloadDir, downloadEvents } = await openPage(`${PDF_BASE}#/merge`, 'merge-pdf');
  const errors = collectErrors(cdp);
  try {
    await waitFor(() => evaluate(cdp, `Boolean(document.querySelector('input[type="file"][accept*="pdf"]'))`), 'merge file input');
    await setFiles(cdp, 'input[type="file"][accept*="pdf"]', [fixtures.one, fixtures.two]);
    await waitFor(async () => {
      const text = (await bodyText(cdp)).toLowerCase();
      return text.includes('phase7-one.pdf') && text.includes('phase7-two.pdf') && text.includes('2 total pages');
    }, 'two inspected merge sources', 40_000);
    await clickText(cdp, 'Save as project');
    await waitFor(
      () => evaluate(cdp, `location.hash.includes('/workspace/') && location.hash.endsWith('/viewer')`),
      'merged project viewer',
      60_000
    );
    await waitFor(async () => {
      const text = (await bodyText(cdp)).toLowerCase();
      return text.includes('merged') && (text.includes('2 pages') || text.includes('page 1 of 2') || text.includes('page 2 of 2'));
    }, 'merged two-page viewer evidence', 60_000);
    return { ok: true, evidence: 'merged two one-page PDFs into a validated two-page local project', errors };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function certifySplit(fixtures) {
  const { target, cdp, downloadDir, downloadEvents } = await openPage(`${PDF_BASE}#/tools/split-pdf`, 'split-pdf');
  const errors = collectErrors(cdp);
  try {
    await waitFor(() => evaluate(cdp, `Boolean(document.querySelector('input[type="file"][accept*="pdf"]'))`), 'split import input');
    await importForTask(cdp, fixtures.three);
    await waitFor(async () => {
      const text = (await bodyText(cdp)).toLowerCase();
      return text.includes('split pdf') && text.includes('split into pdf parts');
    }, 'split workspace', 45_000);
    await setLabeledValue(cdp, 'Pages per PDF', 1);
    await clickText(cdp, 'Split and download ZIP');
    const download = await waitForRealDownload(downloadDir, downloadEvents, /-split\.zip$/i, 'split ZIP download', 90_000);
    if (download.bytes[0] !== 0x50 || download.bytes[1] !== 0x4b) throw new Error('split output is not a ZIP archive');
    return { ok: true, evidence: `split three-page PDF into ZIP; ${download.bytes.length} byte archive`, errors };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function certifyCompression(fixtures) {
  const { target, cdp, downloadDir, downloadEvents } = await openPage(`${PDF_BASE}#/tools/compress-pdf`, 'compress-pdf');
  const errors = collectErrors(cdp);
  try {
    await waitFor(() => evaluate(cdp, `Boolean(document.querySelector('input[type="file"][accept*="pdf"]'))`), 'compress import input');
    await importForTask(cdp, fixtures.three);
    await waitFor(async () => (await bodyText(cdp)).includes('Choose how much to shrink the PDF'), 'compression workspace', 45_000);
    await clickText(cdp, 'Compress PDF');
    await waitFor(async () => (await bodyText(cdp)).includes('Compressed PDF checked and ready'), 'compressed output validation', 90_000);
    await clickText(cdp, 'Download');
    const download = await waitForRealDownload(downloadDir, downloadEvents, /-compressed\.pdf$/i, 'compressed PDF download', 60_000);
    if (!new TextDecoder().decode(download.bytes.slice(0, 5)).startsWith('%PDF-')) throw new Error('compressed output is not a PDF');
    return { ok: true, evidence: `lossless compression produced validated ${download.bytes.length} byte PDF`, errors };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function certifyMetadata(fixtures) {
  const { target, cdp } = await openPage(`${PDF_BASE}#/tools/metadata`, 'pdf-metadata');
  const errors = collectErrors(cdp);
  try {
    await waitFor(() => evaluate(cdp, `Boolean(document.querySelector('input[type="file"][accept*="pdf"]'))`), 'metadata import input');
    await importForTask(cdp, fixtures.three);
    await waitFor(async () => (await bodyText(cdp)).includes('Document metadata'), 'metadata workspace', 45_000);
    await setLabeledValue(cdp, 'Title', 'Phase 7 Metadata');
    await setLabeledValue(cdp, 'Author', 'Tiny Tools');
    await clickText(cdp, 'Create updated PDF');
    await waitFor(
      () => evaluate(cdp, `location.hash.includes('/viewer') && document.body.innerText.includes('phase7-three-metadata-updated.pdf')`),
      'metadata-derived project viewer',
      90_000
    );
    await clickText(cdp, 'Info');
    await waitFor(async () => (await bodyText(cdp)).includes('Phase 7 Metadata'), 'updated metadata in viewer info', 30_000);
    return { ok: true, evidence: 'metadata title/author saved into a derived PDF project and reopened', errors };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function certifyOcr(fixtures) {
  const { target, cdp, downloadDir, downloadEvents } = await openPage(`${PDF_BASE}#/tools/ocr-pdf`, 'ocr-pdf');
  const errors = collectErrors(cdp);
  try {
    await waitFor(() => evaluate(cdp, `Boolean(document.querySelector('input[type="file"][accept*="pdf"]'))`), 'OCR import input');
    await importForTask(cdp, fixtures.ocr);
    await waitFor(async () => (await bodyText(cdp)).includes('Make scans searchable'), 'OCR workspace', 45_000);
    await setLabeledValue(cdp, 'Pages', 1);
    await setLabeledValue(cdp, 'Recognition quality', 1.5, 'select');

    await evaluate(cdp, `(() => {
      const card = [...document.querySelectorAll('.ocr-language-card')].find((node) => (node.textContent || '').includes('English'));
      if (!card) throw new Error('English OCR language card missing');
      const install = [...card.querySelectorAll('button')].find((button) => (button.textContent || '').trim() === 'Install');
      if (!install) return 'already-installed';
      install.click();
      return 'install-started';
    })()`);

    await waitFor(
      () => evaluate(cdp, `(() => {
        const card = [...document.querySelectorAll('.ocr-language-card')].find((node) => (node.textContent || '').includes('English'));
        return Boolean(card && [...card.querySelectorAll('button')].some((button) => (button.textContent || '').trim() === 'Remove'));
      })()`),
      'English OCR language installation',
      180_000
    );

    await evaluate(cdp, `(() => {
      const card = [...document.querySelectorAll('.ocr-language-card')].find((node) => (node.textContent || '').includes('English'));
      const checkbox = card?.querySelector('input[type="checkbox"]');
      if (!checkbox) throw new Error('English OCR checkbox missing');
      if (!checkbox.checked) checkbox.click();
      return checkbox.checked;
    })()`);

    await waitFor(() => evaluate(cdp, `(() => {
      const button = [...document.querySelectorAll('button')].find((node) => (node.textContent || '').trim() === 'Start OCR');
      return Boolean(button && !button.disabled);
    })()`), 'enabled OCR start button');

    await clickText(cdp, 'Start OCR');
    await waitFor(async () => (await bodyText(cdp)).includes('Searchable PDF checked and ready'), 'validated searchable OCR PDF', 240_000);
    await clickText(cdp, 'Download');
    const download = await waitForRealDownload(downloadDir, downloadEvents, /-searchable\.pdf$/i, 'OCR searchable PDF download', 60_000);
    if (!new TextDecoder().decode(download.bytes.slice(0, 5)).startsWith('%PDF-')) throw new Error('OCR output is not a PDF');
    return { ok: true, evidence: `one-page English OCR produced validated ${download.bytes.length} byte searchable PDF`, errors };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function auditTarget(target, fixtures) {
  try {
    const result = target.id === 'merge-pdf' ? await certifyMerge(fixtures)
      : target.id === 'split-pdf' ? await certifySplit(fixtures)
      : target.id === 'compress-pdf' ? await certifyCompression(fixtures)
      : target.id === 'pdf-metadata' ? await certifyMetadata(fixtures)
      : await certifyOcr(fixtures);
    const findings = [...new Set(result.errors ?? [])];
    return {
      id: target.id,
      hash: target.hash,
      status: result.ok && !findings.length ? 'PASS' : 'FAIL',
      fixture: result.evidence,
      findings,
    };
  } catch (error) {
    return {
      id: target.id,
      hash: target.hash,
      status: 'FAIL',
      fixture: '',
      findings: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function markdown(report) {
  const rows = report.results.map((row) =>
    `| \`${row.id}\` | \`${row.hash}\` | **${row.status}** | ${(row.fixture || row.findings.join('; ') || '—').replaceAll('|', '\\|')} |`
  ).join('\n');
  return `# Phase 7 — PDF Production Certification

- PDF family routes: **${FAMILY_TOTAL}**
- Phase 7 target routes: **${report.summary.total}**
- PASS: **${report.summary.PASS}**
- FAIL: **${report.summary.FAIL}**
- Production PDF base: \`${report.pdfBase}\`

| Tiny Tools route | PDF task hash | Status | Evidence |
|---|---|---|---|
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
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const fixtures = await makeFixtures();

  const availability = await fetch(PDF_BASE, { redirect: 'follow' }).catch(() => null);
  if (!availability?.ok) throw new Error(`Production PDF app is unavailable: ${PDF_BASE}`);

  const profile = await mkdtemp(path.join(tmpdir(), 'tiny-tools-phase7-pdf-'));
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
    console.log(`Phase 7 PDF production certification: ${TARGETS.length} workflows`);
    for (let index = 0; index < TARGETS.length; index += 1) {
      const result = await auditTarget(TARGETS[index], fixtures);
      results.push(result);
      console.log(`${result.status === 'PASS' ? '✓' : '✗'} ${index + 1}/${TARGETS.length} ${TARGETS[index].id}${result.findings.length ? ` — ${result.findings[0]}` : ''}`);
    }

    const summary = {
      total: results.length,
      PASS: results.filter((row) => row.status === 'PASS').length,
      FAIL: results.filter((row) => row.status === 'FAIL').length,
    };
    const report = {
      generatedAt: new Date().toISOString(),
      baselineCommit: process.env.GITHUB_SHA ?? null,
      pdfBase: PDF_BASE,
      familyTotal: FAMILY_TOTAL,
      summary,
      results,
    };
    await writeFile(path.join(OUT, 'pdf-certification.json'), JSON.stringify(report, null, 2));
    await writeFile(path.join(OUT, 'pdf-certification.md'), markdown(report));
    console.log(`Phase 7 PDF summary ${JSON.stringify(summary)}`);
    if (summary.total !== TARGETS.length || summary.FAIL) process.exitCode = 1;
  } catch (error) {
    if (stderr.trim()) console.error(`\nChrome stderr (tail):\n${stderr.slice(-4000)}`);
    throw error;
  } finally {
    await stopChrome(chrome);
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
