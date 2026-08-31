import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE_SCRIPT = path.resolve(ROOT, 'scripts/r5-browser-smoke.mjs');
const PDF_CATALOG = path.resolve(ROOT, 'src/pdf/publicPdfTasks.ts');
const TEMP_SCRIPT = path.resolve(ROOT, 'scripts/.r5-browser-smoke-expanded.tmp.mjs');

const baselineSource = readFileSync(BASELINE_SCRIPT, 'utf8');
const pdfCatalogSource = readFileSync(PDF_CATALOG, 'utf8');

// The original R5 script intentionally owns the frozen 50-tool route baseline.
// Public-completeness phases append shared-engine routes outside that source file.
// Count only top-level `id:` declarations from the P1 PDF catalog and adjust the
// dashboard cardinality assertion; route traversal itself remains the exact
// historical 50-tool R5 sweep.
const pdfTaskIds = [...pdfCatalogSource.matchAll(/^\s{4}id:\s*'([^']+)'/gm)].map((match) => match[1]);
if (pdfTaskIds.length !== 20 || new Set(pdfTaskIds).size !== 20) {
  throw new Error(`Expected 20 unique P1 PDF task IDs; found ${pdfTaskIds.length}.`);
}

const expectedDashboardTools = 50 + pdfTaskIds.length;
const oldAssertion = "if (state.uniqueTools !== 50) findings.push(`dashboard exposes ${state.uniqueTools}/50 tool links`);";
const newAssertion = `if (state.uniqueTools !== ${expectedDashboardTools}) findings.push(\`dashboard exposes \${state.uniqueTools}/${expectedDashboardTools} tool links\`);`;

if (!baselineSource.includes(oldAssertion)) {
  throw new Error('R5 dashboard assertion changed; review the expansion wrapper before continuing.');
}

const patchedSource = baselineSource.replace(oldAssertion, newAssertion);
if (patchedSource === baselineSource || patchedSource.includes(oldAssertion)) {
  throw new Error('Unable to apply the expansion-aware R5 dashboard assertion.');
}

try {
  writeFileSync(TEMP_SCRIPT, patchedSource, 'utf8');
  const result = spawnSync(process.execPath, [TEMP_SCRIPT], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  try { rmSync(TEMP_SCRIPT, { force: true }); } catch {}
}
