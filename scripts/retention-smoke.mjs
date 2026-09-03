import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const SCRIPT = path.resolve(ROOT, 'scripts/retain-previous-generation.mjs');
const temp = await mkdtemp(path.join(tmpdir(), 'tiny-tools-retention-smoke-'));
const current = path.join(temp, 'current');
const previous = path.join(temp, 'previous');
const rollback = path.join(temp, 'rollback');

try {
  await mkdir(path.join(current, 'assets'), { recursive: true });
  await mkdir(path.join(previous, 'assets'), { recursive: true });

  await writeFile(path.join(current, 'assets/current-hash.js'), 'current');
  await writeFile(path.join(current, 'assets/shared-hash.js'), 'shared');
  await writeFile(path.join(previous, 'assets/previous-hash.js'), 'previous');
  await writeFile(path.join(previous, 'assets/shared-hash.js'), 'shared');
  await writeFile(path.join(previous, 'assets/ancient-retained-hash.js'), 'must not propagate');
  await writeFile(path.join(previous, 'index.html'), '<!doctype html><title>previous</title>');
  await writeFile(
    path.join(previous, 'build-generation.json'),
    JSON.stringify({
      schemaVersion: 1,
      base: '/tools/',
      commit: 'previous-commit',
      generatedAt: '2026-09-03T00:00:00.000Z',
      entry: '/tools/assets/previous-hash.js',
      files: ['index.html', 'assets/previous-hash.js', 'assets/shared-hash.js'],
    })
  );

  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      TINY_TOOLS_DIST_DIR: current,
      TINY_TOOLS_PREVIOUS_SITE_DIR: previous,
      TINY_TOOLS_ROLLBACK_DIR: rollback,
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Retention script failed.');

  const previousBody = await readFile(path.join(current, 'assets/previous-hash.js'), 'utf8');
  const sharedBody = await readFile(path.join(current, 'assets/shared-hash.js'), 'utf8');
  if (previousBody !== 'previous') throw new Error('Previous generation asset was not copied.');
  if (sharedBody !== 'shared') throw new Error('Shared current-generation asset was unexpectedly changed.');

  let ancientExists = true;
  try {
    await readFile(path.join(current, 'assets/ancient-retained-hash.js'));
  } catch (error) {
    if (error?.code === 'ENOENT') ancientExists = false;
    else throw error;
  }
  if (ancientExists) throw new Error('Retention became recursive; an older retained generation leaked forward.');

  const rollbackIndex = await readFile(path.join(rollback, 'index.html'), 'utf8');
  const rollbackAncient = await readFile(path.join(rollback, 'assets/ancient-retained-hash.js'), 'utf8');
  if (!rollbackIndex.includes('previous')) throw new Error('Rollback site did not preserve the previous index.');
  if (rollbackAncient !== 'must not propagate') throw new Error('Rollback site was not a full copy of the last-known-good deployment.');

  const retained = JSON.parse(await readFile(path.join(current, 'retained-generation.json'), 'utf8'));
  if (retained.sourceCommit !== 'previous-commit') throw new Error('Retained-generation metadata lost the previous commit.');
  if (retained.copiedFiles !== 1) throw new Error(`Expected one newly copied asset, got ${retained.copiedFiles}.`);
  if (JSON.stringify(retained.files) !== JSON.stringify(['assets/previous-hash.js', 'assets/shared-hash.js'])) {
    throw new Error(`Unexpected retained file set: ${JSON.stringify(retained.files)}`);
  }

  console.log('Previous-generation retention smoke PASSED');
  console.log('- previous current-generation assets are preserved');
  console.log('- shared hashed assets are not overwritten');
  console.log('- retained generations do not grow recursively');
  console.log('- a full last-known-good rollback site is prepared separately');
} finally {
  await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
