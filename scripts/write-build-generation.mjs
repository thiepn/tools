import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.resolve(process.env.TINY_TOOLS_DIST_DIR || path.join(ROOT, 'dist'));
const OUTPUT_NAME = 'build-generation.json';
const EXPECTED_BASE = '/tools/';

async function walk(directory, relativeBase = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(relativeBase, entry.name);
    if (relative === '.vite' || relative.startsWith('.vite/')) continue;
    if (relative === OUTPUT_NAME || relative === 'retained-generation.json') continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

const html = await readFile(path.join(DIST, 'index.html'), 'utf8');
const entry = html.match(/<script[^>]+src=["']([^"']+\.js)["']/i)?.[1];
if (!entry || !entry.startsWith(EXPECTED_BASE)) {
  throw new Error(`Expected a production entry under ${EXPECTED_BASE}; received ${entry ?? 'none'}.`);
}

const files = (await walk(DIST)).sort();
if (!files.includes('index.html')) throw new Error('dist/index.html was not discovered in the build generation.');
if (files.length === 0) throw new Error('Production build generation is empty.');

const generation = {
  schemaVersion: 1,
  base: EXPECTED_BASE,
  commit: process.env.GITHUB_SHA || null,
  generatedAt: new Date().toISOString(),
  entry,
  files,
};

await writeFile(path.join(DIST, OUTPUT_NAME), `${JSON.stringify(generation, null, 2)}\n`, 'utf8');
console.log(`Wrote ${OUTPUT_NAME} with ${files.length} current-generation files.`);
