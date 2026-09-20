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

function escapePdfText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createTextPdf(pageTexts, metadata = {}) {
  const encoder = new TextEncoder();
  const objects = [];
  const pageObjectIds = pageTexts.map((_, index) => 4 + index * 2);
  const contentObjectIds = pageTexts.map((_, index) => 5 + index * 2);

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Count ${pageTexts.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  for (let index = 0; index < pageTexts.length; index += 1) {
    const pageId = pageObjectIds[index];
    const contentId = contentObjectIds[index];
    const line1 = escapePdfText(pageTexts[index]);
    const line2 = escapePdfText(`Tiny Tools Phase 7 page ${index + 1}`);
    const stream = `BT
/F1 28 Tf
72 700 Td
(${line1}) Tj
0 -48 Td
/F1 18 Tf
(${line2}) Tj
ET
`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${encoder.encode(stream).length} >>
stream
${stream}endstream`;
  }

  const infoId = 4 + pageTexts.length * 2;
  const infoParts = [];
  if (metadata.title) infoParts.push(`/Title (${escapePdfText(metadata.title)})`);
  if (metadata.author) infoParts.push(`/Author (${escapePdfText(metadata.author)})`);
  if (metadata.subject) infoParts.push(`/Subject (${escapePdfText(metadata.subject)})`);
  objects[infoId] = `<< ${infoParts.join(' ')} /Producer (Tiny Tools Phase 7) >>`;

  let output = '%PDF-1.4\n%TinyToolsPhase7\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = encoder.encode(output).length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = encoder.encode(output).length;
  output += `xref
0 ${objects.length}
0000000000 65535 f 
`;
  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id]).padStart(10, '0')} 00000 n 
`;
  }
  output += `trailer
<< /Size ${objects.length} /Root 1 0 R /Info ${infoId} 0 R >>
startxref
${xrefOffset}
%%EOF
`;
  return encoder.encode(output);
}

async function makeFixtures() {
  await mkdir(FIXTURES, { recursive: true });
  const one = path.join(FIXTURES, 'phase7-one.pdf');
  const two = path.join(FIXTURES, 'phase7-two.pdf');
  const three = path.join(FIXTURES, 'phase7-three.pdf');
  const ocr = path.join(FIXTURES, 'phase7-ocr.pdf');

  await writeFile(one, createTextPdf(['MERGE SOURCE ONE']));
  await writeFile(two, createTextPdf(['MERGE SOURCE TWO']));
  await writeFile(three, createTextPdf(
    ['SPLIT PAGE ONE', 'SPLIT PAGE TWO', 'SPLIT PAGE THREE'],
    { title: 'Original Metadata Title', author: 'Phase 7 Source' }
  ));
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
      return;
    }
    return nativeClick.call(this);
  };
})();`;

async function openPage(url) {
  const target = await newTarget();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable')]);
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
    if (/favicon|service worker.*registration/i.test(message)) return;
    errors.push(`console.${type}: ${message || 'unknown console error'}`);
  });
  return errors;
}

async function bodyText(cdp) {
  return evaluate(cdp, `(document.body.innerText || '').replace(/\\s+/g, ' ').trim()`);
}

async function clickText(cdp, text) {
  return evaluate(cdp, `(() => {
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

async function importForTask(cdp, file) {
  await setFiles(cdp, 'input[type="file"][accept*="pdf"]', [file]);
}

async function certifyMerge(fixtures) {
  const { target, cdp } = await openPage(`${PDF_BASE}#/merge`);
  const errors = collectErrors(cdp);
  try {
    await waitFor(() => evaluate(cdp, `Boolean(document.querySelector('input[type="file"][accept*="pdf"]'))`), 'merge file input');
    await setFiles(cdp, 'input[type="file"][accept*="pdf"]', [fixtures.one, fixtures.two]);
    await waitFor(async () => {
      const text = (await bodyText(cdp)).toLowerCase();
      return text.includes('phase7-one.pdf') && text.includes('phase7-two.pdf') && text.includes('2 total pages');
    }, 'two inspected merge sources', 40_000);
    await clickText(cdp, 'Download merged PDF');
    const download = await waitForDownload(cdp, `(row) => row.download === 'merged.pdf' && row.blob && row.blob.size > 500 && row.blob.type === 'application/pdf'`, 'merged PDF download', 60_000);
    await waitFor(async () => (await bodyText(cdp)).includes('Validated 2-page merged PDF.'), 'merged PDF validation', 30_000);
    return { ok: true, evidence: `merged two one-page PDFs; ${download.blob.size} byte validated PDF`, errors };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function certifySplit(fixtures) {
  const { target, cdp } = await openPage(`${PDF_BASE}#/tools/split-pdf`);
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
    const download = await waitForDownload(cdp, `(row) => /-split\\.zip$/i.test(row.download) && row.blob && row.blob.size > 500 && row.blob.type === 'application/zip'`, 'split ZIP download', 90_000);
    return { ok: true, evidence: `split three-page PDF into ZIP; ${download.blob.size} byte archive`, errors };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function certifyCompression(fixtures) {
  const { target, cdp } = await openPage(`${PDF_BASE}#/tools/compress-pdf`);
  const errors = collectErrors(cdp);
  try {
    await waitFor(() => evaluate(cdp, `Boolean(document.querySelector('input[type="file"][accept*="pdf"]'))`), 'compress import input');
    await importForTask(cdp, fixtures.three);
    await waitFor(async () => (await bodyText(cdp)).includes('Choose how much to shrink the PDF'), 'compression workspace', 45_000);
    await clickText(cdp, 'Compress PDF');
    await waitFor(async () => (await bodyText(cdp)).includes('Compressed PDF checked and ready'), 'compressed output validation', 90_000);
    await clickText(cdp, 'Download');
    const download = await waitForDownload(cdp, `(row) => /-compressed\\.pdf$/i.test(row.download) && row.blob && row.blob.size > 500 && row.blob.type === 'application/pdf'`, 'compressed PDF download', 30_000);
    return { ok: true, evidence: `lossless compression produced validated ${download.blob.size} byte PDF`, errors };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function certifyMetadata(fixtures) {
  const { target, cdp } = await openPage(`${PDF_BASE}#/tools/metadata`);
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
  const { target, cdp } = await openPage(`${PDF_BASE}#/tools/ocr-pdf`);
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
    const download = await waitForDownload(cdp, `(row) => /-searchable\\.pdf$/i.test(row.download) && row.blob && row.blob.size > 500 && row.blob.type === 'application/pdf'`, 'OCR searchable PDF download', 30_000);
    return { ok: true, evidence: `one-page English OCR produced validated ${download.blob.size} byte searchable PDF`, errors };
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
