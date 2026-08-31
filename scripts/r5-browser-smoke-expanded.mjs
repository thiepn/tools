import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE_SCRIPT = path.resolve(ROOT, 'scripts/r5-browser-smoke.mjs');
const PDF_CATALOG = path.resolve(ROOT, 'src/pdf/publicPdfTasks.ts');
const TEMP_SCRIPT = path.resolve(ROOT, 'scripts/.r5-browser-smoke-expanded.tmp.mjs');

const baselineSource = readFileSync(BASELINE_SCRIPT, 'utf8');
const pdfCatalogSource = readFileSync(PDF_CATALOG, 'utf8');

// The historical R5 source still owns and validates the frozen 50-tool base
// registry. Public-completeness families are appended only after that exact
// baseline check succeeds, so expansion cannot silently mutate the original
// S-tier catalog while every runtime route still receives the browser sweep.
const pdfTaskIds = [...pdfCatalogSource.matchAll(/^\s{4}id:\s*'([^']+)'/gm)].map((match) => match[1]);
if (pdfTaskIds.length !== 20 || new Set(pdfTaskIds).size !== 20) {
  throw new Error(`Expected 20 unique P1 PDF task IDs; found ${pdfTaskIds.length}.`);
}

const expectedRuntimeTools = 50 + pdfTaskIds.length;
const oldAssertion = "if (state.uniqueTools !== 50) findings.push(`dashboard exposes ${state.uniqueTools}/50 tool links`);";
const newAssertion = `if (state.uniqueTools !== ${expectedRuntimeTools}) findings.push(\`dashboard exposes \${state.uniqueTools}/${expectedRuntimeTools} tool links\`);`;
const oldToolIds = 'const toolIds = await getToolIds();';
const newToolIds = `const toolIds = [...await getToolIds(), ...${JSON.stringify(pdfTaskIds)}];`;

for (const required of [oldAssertion, oldToolIds]) {
  if (!baselineSource.includes(required)) {
    throw new Error('R5 baseline structure changed; review the expansion wrapper before continuing.');
  }
}

let patchedSource = baselineSource
  .replace(oldAssertion, newAssertion)
  .replace(oldToolIds, newToolIds)
  .replace("console.log('- 50/50 routes rendered at 1440px');", `console.log('- ${expectedRuntimeTools}/${expectedRuntimeTools} routes rendered at 1440px');`)
  .replace("console.log('- 50/50 routes rendered at 320px');", `console.log('- ${expectedRuntimeTools}/${expectedRuntimeTools} routes rendered at 320px');`)
  .replace("console.log('- dashboard exposes all 50 tools at both viewports');", `console.log('- dashboard exposes all ${expectedRuntimeTools} tools at both viewports');`);

if (patchedSource === baselineSource || patchedSource.includes(oldAssertion) || patchedSource.includes(oldToolIds)) {
  throw new Error('Unable to apply the expansion-aware R5 transformations.');
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
