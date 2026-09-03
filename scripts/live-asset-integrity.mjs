const rawUrl = process.argv[2] || process.env.TINY_TOOLS_LIVE_URL;
if (!rawUrl) {
  throw new Error('Usage: node scripts/live-asset-integrity.mjs <https://host/tools/>');
}

const deploymentUrl = new URL(rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`);
if (!['http:', 'https:'].includes(deploymentUrl.protocol)) {
  throw new Error(`Expected an HTTP(S) deployment URL, received ${deploymentUrl.href}`);
}
const baseUrl = new URL(deploymentUrl.href);
baseUrl.protocol = 'https:';

const EXPECTED_BASE = '/tools/';
const MAX_ATTEMPTS = 6;
const CONCURRENCY = 24;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function validateRelativeFile(file, label) {
  if (typeof file !== 'string' || file.length === 0) throw new Error(`${label} contains a non-string/empty file path.`);
  const normalized = file.replaceAll('\\', '/');
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`${label} contains an unsafe path: ${file}`);
  }
  return normalized;
}

async function fetchWithRetry(url, options = {}, label = url.href) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache', ...(options.headers ?? {}) },
        ...options,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== 'https:') throw new Error(`redirected to non-HTTPS URL ${response.url}`);
      if (finalUrl.origin !== baseUrl.origin) throw new Error(`redirected off-origin to ${response.url}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(Math.min(5000, attempt * 700));
    }
  }
  throw new Error(`${label} failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message ?? lastError}`);
}

async function fetchJson(relative, label) {
  const url = new URL(relative, baseUrl);
  const response = await fetchWithRetry(url, {}, label);
  return response.json();
}

async function verifyFile(relative, label) {
  const safe = validateRelativeFile(relative, label);
  const url = new URL(safe, baseUrl);
  if (!url.pathname.startsWith(baseUrl.pathname)) {
    throw new Error(`${label} escaped the deployment path: ${safe}`);
  }

  let response;
  try {
    response = await fetchWithRetry(url, { method: 'HEAD' }, `${label}: ${safe}`);
  } catch (headError) {
    // Some static hosts/proxies are inconsistent about HEAD. A no-store GET is a
    // valid fallback and still proves that the published object can be served.
    response = await fetchWithRetry(url, { method: 'GET' }, `${label}: ${safe}`);
  }

  const type = response.headers.get('content-type') ?? '';
  if (safe.endsWith('.js') && /text\/html/i.test(type)) {
    throw new Error(`${label} returned HTML for JavaScript asset ${safe}.`);
  }
  if (safe.endsWith('.css') && /text\/html/i.test(type)) {
    throw new Error(`${label} returned HTML for stylesheet ${safe}.`);
  }
}

async function mapConcurrent(items, task) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, Math.max(1, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index], index);
    }
  });
  await Promise.all(workers);
}

const generation = await fetchJson('build-generation.json', 'Current build-generation metadata');
if (generation?.schemaVersion !== 1) throw new Error('Unsupported build-generation schema on the live site.');
if (generation.base !== EXPECTED_BASE) throw new Error(`Live build-generation base is ${generation.base}; expected ${EXPECTED_BASE}.`);
if (!Array.isArray(generation.files) || generation.files.length === 0) throw new Error('Live build-generation metadata contains no files.');
if (typeof generation.entry !== 'string' || !generation.entry.startsWith(EXPECTED_BASE)) {
  throw new Error(`Live build-generation entry is malformed: ${generation.entry}`);
}

const currentFiles = [...new Set(generation.files.map((file) => validateRelativeFile(file, 'build-generation.json')))].sort();
await mapConcurrent(currentFiles, (file) => verifyFile(file, 'Current generation'));

const retained = await fetchJson('retained-generation.json', 'Retained-generation metadata');
if (retained?.schemaVersion !== 1 || !Array.isArray(retained.files)) {
  throw new Error('Live retained-generation metadata has an unsupported schema.');
}
const retainedFiles = [...new Set(retained.files.map((file) => validateRelativeFile(file, 'retained-generation.json')))].sort();
await mapConcurrent(retainedFiles, (file) => verifyFile(file, 'Retained previous generation'));

console.log('Live production asset integrity PASSED');
console.log(`- ${currentFiles.length} current-generation files are reachable from ${baseUrl.href}`);
console.log(`- ${retainedFiles.length} previous-generation hashed assets are retained and reachable`);
console.log('- JavaScript/CSS asset paths do not resolve to HTML fallbacks');
