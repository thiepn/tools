import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, 'dist');
const SRC = path.resolve(ROOT, 'src');
const MANIFEST_PATH = path.join(DIST, '.vite', 'manifest.json');
const GENERATION_PATH = path.join(DIST, 'build-generation.json');
const EXPECTED_BASE = '/tools/';
const EXPECTED_TOOL_COUNT = 351;
const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mjs'];

const failures = [];
const checkedFiles = new Set();

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function fail(message) {
  failures.push(message);
}

async function assertExactCase(file) {
  const absolute = path.resolve(file);
  const parsed = path.parse(absolute);
  const parts = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;

  for (const part of parts) {
    let entries;
    try {
      entries = await readdir(current);
    } catch {
      return;
    }
    if (!entries.includes(part)) {
      fail(`Case-sensitive path mismatch: ${path.relative(ROOT, absolute)}`);
      return;
    }
    current = path.join(current, part);
  }
}

async function resolveSourceImport(importer, specifier) {
  const base = path.resolve(path.dirname(importer), specifier);
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      await assertExactCase(candidate);
      return candidate;
    }
  }
  return null;
}

async function walkSource(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walkSource(target));
    else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) output.push(target);
  }
  return output;
}

async function walkDistPublic(directory = DIST, relativeBase = '') {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(relativeBase, entry.name);
    if (relative === '.vite' || relative.startsWith('.vite/')) continue;
    if (relative === 'build-generation.json' || relative === 'retained-generation.json') continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walkDistPublic(target, relative));
    else if (entry.isFile()) output.push(relative);
  }
  return output;
}

function distPathFromPublicUrl(assetUrl) {
  const normalized = assetUrl.split(/[?#]/, 1)[0];
  if (normalized.startsWith(EXPECTED_BASE)) {
    return path.join(DIST, normalized.slice(EXPECTED_BASE.length));
  }
  if (normalized.startsWith('./')) return path.join(DIST, normalized.slice(2));
  if (!normalized.startsWith('/') && !/^[a-z][a-z\d+.-]*:/i.test(normalized)) {
    return path.join(DIST, normalized);
  }
  return null;
}

async function verifyIndex() {
  const html = await readFile(path.join(DIST, 'index.html'), 'utf8');
  const entry = html.match(/<script[^>]+src=["']([^"']+\.js)["']/i)?.[1];
  const stylesheet =
    html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css)["']/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+\.css)["'][^>]+rel=["']stylesheet["']/i)?.[1];

  for (const [label, asset] of [['entry script', entry], ['stylesheet', stylesheet]]) {
    if (!asset) {
      fail(`dist/index.html is missing its ${label}.`);
      continue;
    }
    if (!asset.startsWith(EXPECTED_BASE)) {
      fail(`${label} must be emitted under ${EXPECTED_BASE}; received ${asset}`);
    }
    const file = distPathFromPublicUrl(asset);
    if (!file || !await exists(file)) fail(`${label} does not exist in dist: ${asset}`);
  }
}

async function verifyBuildGeneration() {
  if (!await exists(GENERATION_PATH)) {
    fail('build-generation.json is missing; npm run build must record the exact deployable generation.');
    return 0;
  }

  let generation;
  try {
    generation = JSON.parse(await readFile(GENERATION_PATH, 'utf8'));
  } catch (error) {
    fail(`build-generation.json is not valid JSON: ${error.message}`);
    return 0;
  }

  if (generation.schemaVersion !== 1) fail(`Unsupported build-generation schema: ${generation.schemaVersion}`);
  if (generation.base !== EXPECTED_BASE) fail(`build-generation base must be ${EXPECTED_BASE}; received ${generation.base}`);
  if (typeof generation.entry !== 'string' || !generation.entry.startsWith(EXPECTED_BASE)) {
    fail(`build-generation entry is malformed: ${generation.entry}`);
  }
  if (!Array.isArray(generation.files) || generation.files.length === 0) {
    fail('build-generation files must be a non-empty array.');
    return 0;
  }

  const declared = new Set();
  for (const file of generation.files) {
    if (typeof file !== 'string' || !file) {
      fail('build-generation contains a non-string/empty file path.');
      continue;
    }
    const normalized = file.replaceAll('\\', '/');
    if (normalized.startsWith('/') || normalized.split('/').includes('..') || normalized.startsWith('.vite/')) {
      fail(`build-generation contains unsafe/non-public file path: ${file}`);
      continue;
    }
    if (declared.has(normalized)) fail(`build-generation contains duplicate file: ${normalized}`);
    declared.add(normalized);
    if (!await exists(path.join(DIST, ...normalized.split('/')))) {
      fail(`build-generation references missing file: ${normalized}`);
    }
  }

  const actual = new Set((await walkDistPublic()).sort());
  for (const file of actual) if (!declared.has(file)) fail(`Public build file is missing from build-generation.json: ${file}`);
  for (const file of declared) if (!actual.has(file)) fail(`build-generation.json declares a non-current public file: ${file}`);

  const entryRelative = generation.entry.slice(EXPECTED_BASE.length);
  if (!declared.has(entryRelative)) fail(`build-generation entry is not included in its file set: ${entryRelative}`);
  if (!declared.has('index.html')) fail('build-generation does not include index.html.');

  return declared.size;
}

async function verifyManifest() {
  if (!await exists(MANIFEST_PATH)) {
    fail('Vite manifest is missing from dist/.vite/manifest.json.');
    return new Map();
  }

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const bySource = new Map();

  for (const [key, entry] of Object.entries(manifest)) {
    if (entry.src) bySource.set(entry.src.replaceAll('\\', '/'), entry);

    for (const asset of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])].filter(Boolean)) {
      const file = path.join(DIST, asset);
      checkedFiles.add(asset);
      if (!await exists(file)) fail(`Manifest entry ${key} references missing output: ${asset}`);
    }

    for (const dependencyKey of [...(entry.imports ?? []), ...(entry.dynamicImports ?? [])]) {
      if (!manifest[dependencyKey]) {
        fail(`Manifest entry ${key} references missing manifest dependency: ${dependencyKey}`);
      }
    }
  }

  return bySource;
}

async function verifySourceDynamicImports(manifestBySource) {
  const sourceFiles = await walkSource(SRC);
  const dynamicImports = [];
  const registryLazyImports = [];
  const dynamicImportPattern = /import\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;

  for (const file of sourceFiles) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(dynamicImportPattern)) {
      const specifier = match[2];
      if (!specifier.startsWith('.')) continue;
      const resolved = await resolveSourceImport(file, specifier);
      const importer = path.relative(ROOT, file).replaceAll(path.sep, '/');
      if (!resolved) {
        fail(`Unresolved relative dynamic import in ${importer}: ${specifier}`);
        continue;
      }

      const sourcePath = path.relative(ROOT, resolved).replaceAll(path.sep, '/');
      dynamicImports.push({ importer, specifier, sourcePath });
      if (importer.startsWith('src/registry/')) registryLazyImports.push({ importer, sourcePath });

      const manifestEntry = manifestBySource.get(sourcePath);
      if (importer.startsWith('src/registry/')) {
        if (!manifestEntry) {
          fail(`Registry lazy import ${importer} -> ${sourcePath} has no Vite manifest chunk.`);
        } else if (!await exists(path.join(DIST, manifestEntry.file))) {
          fail(`Registry lazy import ${sourcePath} emitted missing chunk ${manifestEntry.file}.`);
        }
      }
    }
  }

  if (registryLazyImports.length === 0) fail('No registry lazy imports were discovered.');
  return { dynamicImports, registryLazyImports };
}

async function verifyRegisteredTools() {
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

    const tools = toolsModule.TOOLS_REGISTRY;
    if (!Array.isArray(tools)) {
      fail('TOOLS_REGISTRY did not resolve to an array.');
      return 0;
    }
    if (tools.length !== EXPECTED_TOOL_COUNT) {
      fail(`Expected ${EXPECTED_TOOL_COUNT} registered public tools; found ${tools.length}.`);
    }

    const ids = new Set();
    const routes = new Set();
    for (const tool of tools) {
      if (!tool?.id || typeof tool.id !== 'string') fail('Registered tool is missing a string id.');
      if (ids.has(tool.id)) fail(`Duplicate registered tool id: ${tool.id}`);
      ids.add(tool.id);

      if (tool.route !== `/${tool.id}`) fail(`Tool ${tool.id} has malformed route ${tool.route}.`);
      if (routes.has(tool.route)) fail(`Duplicate registered tool route: ${tool.route}`);
      routes.add(tool.route);

      if (!tool.component) fail(`Tool ${tool.id} has no component/lazy component.`);
    }

    return tools.length;
  } finally {
    await vite.close();
  }
}

await verifyIndex();
const generationFiles = await verifyBuildGeneration();
const manifestBySource = await verifyManifest();
const { dynamicImports, registryLazyImports } = await verifySourceDynamicImports(manifestBySource);
const registeredTools = await verifyRegisteredTools();

if (failures.length) {
  console.error('Production build verification FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Production build verification PASSED');
console.log(`- ${registeredTools} registered public tool routes audited`);
console.log(`- ${registryLazyImports.length} registry lazy-import sites resolved to emitted manifest chunks`);
console.log(`- ${dynamicImports.length} relative source dynamic imports resolved case-sensitively`);
console.log(`- ${checkedFiles.size} manifest-emitted JS/CSS/asset outputs exist`);
console.log(`- ${generationFiles} public files are recorded exactly in build-generation.json`);
console.log(`- index entry assets are pinned under ${EXPECTED_BASE}`);
