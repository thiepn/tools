import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const [leftArg, rightArg] = process.argv.slice(2);
if (!leftArg || !rightArg) {
  throw new Error('Usage: node scripts/phase10-compare-builds.mjs <build-a> <build-b>');
}

const LEFT = path.resolve(ROOT, leftArg);
const RIGHT = path.resolve(ROOT, rightArg);
const OUT = path.resolve(ROOT, process.env.PHASE10_RC_OUT || 'artifacts/phase10-rc');

async function walk(directory, relativeBase = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(relativeBase, entry.name);
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

async function hashFile(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function snapshot(directory) {
  const files = await walk(directory);
  const rows = [];
  for (const file of files) {
    rows.push({
      file,
      sha256: await hashFile(path.join(directory, ...file.split('/'))),
    });
  }
  const canonical = rows.map((row) => `${row.sha256}  ${row.file}\n`).join('');
  return {
    files: rows,
    fingerprintSha256: createHash('sha256').update(canonical).digest('hex'),
  };
}

const [left, right] = await Promise.all([snapshot(LEFT), snapshot(RIGHT)]);
const leftMap = new Map(left.files.map((row) => [row.file, row.sha256]));
const rightMap = new Map(right.files.map((row) => [row.file, row.sha256]));

const missingFromRight = [...leftMap.keys()].filter((file) => !rightMap.has(file));
const missingFromLeft = [...rightMap.keys()].filter((file) => !leftMap.has(file));
const changed = [...leftMap.keys()]
  .filter((file) => rightMap.has(file) && leftMap.get(file) !== rightMap.get(file))
  .map((file) => ({ file, left: leftMap.get(file), right: rightMap.get(file) }));

const identical =
  missingFromRight.length === 0 &&
  missingFromLeft.length === 0 &&
  changed.length === 0 &&
  left.fingerprintSha256 === right.fingerprintSha256;

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  left: {
    path: path.relative(ROOT, LEFT) || '.',
    fileCount: left.files.length,
    fingerprintSha256: left.fingerprintSha256,
  },
  right: {
    path: path.relative(ROOT, RIGHT) || '.',
    fileCount: right.files.length,
    fingerprintSha256: right.fingerprintSha256,
  },
  identical,
  missingFromRight,
  missingFromLeft,
  changed,
};

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'reproducibility.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(
  path.join(OUT, 'reproducibility.md'),
  `# Phase 10 — Reproducible Build Evidence

- Build A files: **${left.files.length}**
- Build B files: **${right.files.length}**
- Build A SHA-256 fingerprint: \`${left.fingerprintSha256}\`
- Build B SHA-256 fingerprint: \`${right.fingerprintSha256}\`
- Byte-for-byte identical: **${identical ? 'yes' : 'no'}**

${identical ? 'No file-set or content differences were detected.' : `Differences:
- Missing from B: ${missingFromRight.length}
- Missing from A: ${missingFromLeft.length}
- Changed: ${changed.length}`}
`
);

if (!identical) {
  console.error('Phase 10 reproducibility check FAILED');
  for (const file of missingFromRight) console.error(`- Missing from build B: ${file}`);
  for (const file of missingFromLeft) console.error(`- Missing from build A: ${file}`);
  for (const row of changed.slice(0, 50)) console.error(`- Changed: ${row.file}`);
  process.exit(1);
}

console.log('Phase 10 reproducibility check PASSED');
console.log(`- ${left.files.length} files are byte-for-byte identical`);
console.log(`- SHA-256 fingerprint: ${left.fingerprintSha256}`);
