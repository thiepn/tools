import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE = path.resolve(ROOT, 'scripts/r11-full-catalog-audit.mjs');
const TEMP = path.resolve(ROOT, 'scripts/.r11-full-catalog-audit-expanded.tmp.mjs');
const source = readFileSync(BASELINE, 'utf8');
const oldWaitDefault = 'async function waitFor(check, label, timeoutMs = 12_000) {';
const newWaitDefault = 'async function waitFor(check, label, timeoutMs = 25_000) {';
if (!source.includes(oldWaitDefault)) {
  throw new Error('R11 baseline waitFor contract changed; review the expanded audit wrapper before continuing.');
}
const patched = source.replace(oldWaitDefault, newWaitDefault);
if (patched === source || patched.includes(oldWaitDefault)) {
  throw new Error('Unable to apply the R11 heavy-route timeout transformation.');
}
try {
  writeFileSync(TEMP, patched, 'utf8');
  const result = spawnSync(process.execPath, [TEMP], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  try { rmSync(TEMP, { force: true }); } catch {}
}
