import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const OUT = path.resolve(ROOT, process.env.PHASE10_RC_OUT || 'artifacts/phase10-rc');
const HEALTH = path.resolve(ROOT, process.env.PHASE10_HEALTH_REPORT || 'artifacts/tool-health/tool-health.json');
const REPRO = path.join(OUT, 'reproducibility.json');
const FUNCTIONAL = path.resolve(ROOT, process.env.PHASE10_FUNCTIONAL_REPORT || 'artifacts/functional-wiring/functional-wiring.json');

const EXPECTED_TOOLS = 351;
const EXPECTED_BASE = '/tools/';
const BUDGETS = {
  jsRaw: 350 * 1024,
  jsGzip: 110 * 1024,
  cssRaw: 150 * 1024,
  cssGzip: 30 * 1024,
};

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

async function readJson(file, label) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`${label} is missing: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return { raw, value: JSON.parse(raw) };
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function distFileFromUrl(url) {
  const parsed = new URL(url, 'https://example.invalid/tools/');
  assert(parsed.pathname.startsWith(EXPECTED_BASE), `Initial asset escaped ${EXPECTED_BASE}: ${url}`);
  return path.join(DIST, parsed.pathname.slice(EXPECTED_BASE.length));
}

async function bundleMetrics() {
  const html = await readFile(path.join(DIST, 'index.html'), 'utf8');
  const script = html.match(/<script[^>]+src=["']([^"']+\.js)["']/i)?.[1];
  const stylesheet =
    html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css)["']/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+\.css)["'][^>]+rel=["']stylesheet["']/i)?.[1];

  assert(script, 'Could not identify initial JavaScript asset.');
  assert(stylesheet, 'Could not identify initial stylesheet.');

  const [js, css] = await Promise.all([
    readFile(distFileFromUrl(script)),
    readFile(distFileFromUrl(stylesheet)),
  ]);

  const sizes = {
    jsRaw: js.length,
    jsGzip: gzipSync(js).length,
    cssRaw: css.length,
    cssGzip: gzipSync(css).length,
  };
  const exceeded = Object.keys(BUDGETS).filter((key) => sizes[key] > BUDGETS[key]);
  assert(exceeded.length === 0, `Initial bundle budget exceeded: ${exceeded.join(', ')}`);
  return { assets: { script, stylesheet }, sizes, budgets: BUDGETS };
}

const [{ raw: packageRaw, value: pkg }, { raw: lockRaw, value: lock }, { raw: healthRaw, value: health }, { raw: functionalRaw, value: functional }, { value: generation }, { value: repro }] =
  await Promise.all([
    readJson(path.join(ROOT, 'package.json'), 'package.json'),
    readJson(path.join(ROOT, 'package-lock.json'), 'package-lock.json'),
    readJson(HEALTH, 'tool-health.json'),
    readJson(FUNCTIONAL, 'functional-wiring.json'),
    readJson(path.join(DIST, 'build-generation.json'), 'build-generation.json'),
    readJson(REPRO, 'reproducibility.json'),
  ]);

assert(pkg.private === true, 'Release candidate package must remain private.');
assert(typeof pkg.version === 'string' && pkg.version.length > 0, 'package.json version is missing.');
assert(lock.version === pkg.version, `package-lock top-level version ${lock.version} does not match package.json ${pkg.version}.`);
assert(lock.packages?.['']?.version === pkg.version, `package-lock root package version ${lock.packages?.['']?.version} does not match package.json ${pkg.version}.`);
assert(lock.lockfileVersion === 3, `Expected npm lockfileVersion 3; received ${lock.lockfileVersion}.`);

assert(generation.schemaVersion === 1, 'Unsupported build-generation schema.');
assert(generation.base === EXPECTED_BASE, `build-generation base must be ${EXPECTED_BASE}.`);
assert(Array.isArray(generation.files) && generation.files.length > 0, 'build-generation contains no public files.');
assert(generation.files.includes('index.html'), 'build-generation is missing index.html.');
assert(generation.files.includes('manifest.webmanifest'), 'build-generation is missing manifest.webmanifest.');
assert(!generation.files.some((file) => /\.map$/i.test(file)), 'Release build must not publish source maps.');
assert(!generation.files.some((file) => /(^|\/)\.env(?:\.|$)/i.test(file)), 'Release build contains an environment file.');
assert(!generation.files.some((file) => /\.(?:ts|tsx)$/i.test(file)), 'Release build contains TypeScript source files.');

const sourceCommit = process.env.RC_SOURCE_SHA || generation.commit || process.env.GITHUB_SHA || null;
assert(sourceCommit, 'Release candidate source commit is missing.');
assert(generation.commit === sourceCommit, `build-generation commit ${generation.commit} does not match RC source ${sourceCommit}.`);

const buildTimestamp = process.env.RC_BUILD_TIMESTAMP || generation.generatedAt;
assert(buildTimestamp, 'Release candidate build timestamp is missing.');
assert(new Date(generation.generatedAt).toISOString() === new Date(buildTimestamp).toISOString(), 'build-generation timestamp is not the deterministic RC timestamp.');

assert(repro.identical === true, 'Two production builds were not byte-for-byte identical.');
assert(repro.left?.fingerprintSha256 && repro.left.fingerprintSha256 === repro.right?.fingerprintSha256, 'Reproducibility fingerprints do not match.');

assert(health.summary?.total === EXPECTED_TOOLS, `Expected ${EXPECTED_TOOLS} tools in health report.`);
assert(health.summary?.PASS === EXPECTED_TOOLS, `Expected ${EXPECTED_TOOLS} PASS; received ${health.summary?.PASS}.`);
assert(health.summary?.BROKEN === 0, `Expected 0 BROKEN; received ${health.summary?.BROKEN}.`);
assert(health.summary?.BLOCKED === 0, `Expected 0 BLOCKED; received ${health.summary?.BLOCKED}.`);
assert(health.summary?.FLAKY === 0, `Expected 0 FLAKY; received ${health.summary?.FLAKY}.`);
assert(health.runsPerTool >= 2, 'Health report must include at least two catalog passes.');

assert(functional.summary?.total === EXPECTED_TOOLS, `Expected ${EXPECTED_TOOLS} tools in functional wiring report.`);
assert(functional.summary?.PASS === EXPECTED_TOOLS, `Expected ${EXPECTED_TOOLS} functional wiring PASS; received ${functional.summary?.PASS}.`);
assert(functional.summary?.INCONCLUSIVE === 0, `Expected 0 INCONCLUSIVE functional wiring routes; received ${functional.summary?.INCONCLUSIVE}.`);
assert(functional.summary?.FAIL === 0, `Expected 0 FAIL functional wiring routes; received ${functional.summary?.FAIL}.`);

for (const field of [
  'r18Executed',
  'phase4DeviceExecuted',
  'phase5FilesExecuted',
  'phase6MediaExecuted',
  'phase7PdfExecuted',
  'phase8ImageExecuted',
  'phase9FinalExecuted',
]) {
  assert(health[field] === true, `Health report evidence field is missing: ${field}`);
}
for (const field of [
  'r18ExitCode',
  'phase4DeviceExitCode',
  'phase5FilesExitCode',
  'phase6MediaExitCode',
  'phase7PdfExitCode',
  'phase8ImageExitCode',
  'phase9FinalExitCode',
]) {
  assert(health[field] === 0, `Health evidence subprocess is not green: ${field}=${health[field]}`);
}

for (const [family, row] of Object.entries(health.familyHealth || {})) {
  assert(row.total === row.PASS, `Family ${family} is not fully passing: ${JSON.stringify(row)}`);
  assert((row.BROKEN || 0) === 0 && (row.BLOCKED || 0) === 0, `Family ${family} still has unresolved routes.`);
}

const manifest = JSON.parse(await readFile(path.join(DIST, 'manifest.webmanifest'), 'utf8'));
const manifestName = String(manifest.name || manifest.short_name || '');
assert(/Tiny Tools/i.test(manifestName), `PWA manifest does not identify Tiny Tools: ${manifestName}`);

const bundle = await bundleMetrics();

const checksumRows = [];
for (const file of [...generation.files].sort()) {
  const safe = String(file).replaceAll('\\', '/');
  assert(!safe.startsWith('/') && !safe.split('/').includes('..'), `Unsafe generated file path: ${safe}`);
  const bytes = await readFile(path.join(DIST, ...safe.split('/')));
  checksumRows.push({ file: safe, sha256: sha256(bytes), bytes: bytes.length });
}
const checksumText = checksumRows.map((row) => `${row.sha256}  ${row.file}\n`).join('');
const publicArtifactFingerprintSha256 = sha256(checksumText);
assert(publicArtifactFingerprintSha256 === repro.left.fingerprintSha256 || repro.left.fileCount > generation.files.length,
  'Public artifact fingerprint is inconsistent with reproducibility evidence.');

const shortSha = sourceCommit.slice(0, 12);
const rcId = `tiny-tools-v${pkg.version}-rc-${shortSha}`;

const report = {
  schemaVersion: 1,
  status: 'CERTIFIED',
  rcId,
  version: pkg.version,
  sourceCommit,
  generatedAt: generation.generatedAt,
  base: generation.base,
  entry: generation.entry,
  publicFileCount: checksumRows.length,
  publicArtifactFingerprintSha256,
  reproducibility: {
    identical: repro.identical,
    comparedFileCount: repro.left.fileCount,
    fingerprintSha256: repro.left.fingerprintSha256,
  },
  sourceIntegrity: {
    packageJsonSha256: sha256(packageRaw),
    packageLockSha256: sha256(lockRaw),
    toolHealthSha256: sha256(healthRaw),
    functionalWiringSha256: sha256(functionalRaw),
  },
  health: health.summary,
  functionalWiring: functional.summary,
  families: health.familyHealth,
  evidence: {
    runsPerTool: health.runsPerTool,
    r18: health.r18Executed,
    phase4Device: health.phase4DeviceExecuted,
    phase5Files: health.phase5FilesExecuted,
    phase6Media: health.phase6MediaExecuted,
    phase7Pdf: health.phase7PdfExecuted,
    phase8Image: health.phase8ImageExecuted,
    phase9Final: health.phase9FinalExecuted,
    functionalWiring351: true,
  },
  bundle,
};

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'checksums.sha256'), checksumText);
await writeFile(path.join(OUT, 'release-candidate.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(
  path.join(OUT, 'release-candidate.md'),
  `# Tiny Tools Phase 10 — Release Candidate

## Certification

- Status: **CERTIFIED**
- RC: \`${rcId}\`
- Version: **${pkg.version}**
- Source commit: \`${sourceCommit}\`
- Deterministic build timestamp: **${generation.generatedAt}**
- Public files: **${checksumRows.length}**
- Public artifact SHA-256 fingerprint: \`${publicArtifactFingerprintSha256}\`
- Reproducible build: **yes**
- Compared build files: **${repro.left.fileCount}**

## Functional health

- Total tools: **${health.summary.total}**
- PASS: **${health.summary.PASS}**
- BROKEN: **${health.summary.BROKEN}**
- BLOCKED: **${health.summary.BLOCKED}**
- FLAKY: **${health.summary.FLAKY}**
- Runtime catalog passes/tool: **${health.runsPerTool}**
- Production functional wiring: **${functional.summary.PASS}/${functional.summary.total} PASS**

## Initial bundle

- JS raw: **${(bundle.sizes.jsRaw / 1024).toFixed(2)} KiB**
- JS gzip: **${(bundle.sizes.jsGzip / 1024).toFixed(2)} KiB**
- CSS raw: **${(bundle.sizes.cssRaw / 1024).toFixed(2)} KiB**
- CSS gzip: **${(bundle.sizes.cssGzip / 1024).toFixed(2)} KiB**

## Source integrity

- package.json: \`${report.sourceIntegrity.packageJsonSha256}\`
- package-lock.json: \`${report.sourceIntegrity.packageLockSha256}\`
- tool-health.json: \`${report.sourceIntegrity.toolHealthSha256}\`
- functional-wiring.json: \`${report.sourceIntegrity.functionalWiringSha256}\`

This artifact is eligible for release-candidate packaging. Promotion to production still requires the final release decision and main-branch deployment workflow.
`
);

console.log('Phase 10 release-candidate certification PASSED');
console.log(`- ${rcId}`);
console.log(`- ${health.summary.PASS}/${health.summary.total} tools PASS`);
console.log(`- public artifact fingerprint ${publicArtifactFingerprintSha256}`);
