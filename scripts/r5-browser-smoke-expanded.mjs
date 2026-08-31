import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE_SCRIPT = path.resolve(ROOT, 'scripts/r5-browser-smoke.mjs');
const TEMP_SCRIPT = path.resolve(ROOT, 'scripts/.r5-browser-smoke-expanded.tmp.mjs');
const EXTENSION_CATALOGS = [
  { phase: 'P1 PDF', path: path.resolve(ROOT, 'src/pdf/publicPdfTasks.ts'), expected: 20 },
  { phase: 'P2 device diagnostics', path: path.resolve(ROOT, 'src/device/publicDeviceTasks.ts'), expected: 16 },
  { phase: 'P3 everyday calculators', path: path.resolve(ROOT, 'src/calculators/publicCalculatorTasks.ts'), expected: 46 },
  { phase: 'P4 file conversion', path: path.resolve(ROOT, 'src/files/publicFileConversionTasks.ts'), expected: 18 },
  { phase: 'P5 image micro-tools', path: path.resolve(ROOT, 'src/image/publicImageTasks.ts'), expected: 23 },
];

const baselineSource = readFileSync(BASELINE_SCRIPT, 'utf8');
const extensionIds = [];
for (const catalog of EXTENSION_CATALOGS) {
  const source = readFileSync(catalog.path, 'utf8');
  const ids = [...source.matchAll(/^\s{2,4}(?:\{ )?id:\s*'([^']+)'/gm)].map((match) => match[1]);
  if (ids.length !== catalog.expected || new Set(ids).size !== catalog.expected) throw new Error(`Expected ${catalog.expected} unique ${catalog.phase} task IDs; found ${ids.length}.`);
  extensionIds.push(...ids);
}
if (new Set(extensionIds).size !== extensionIds.length) throw new Error('Public-completeness extension catalogs contain duplicate IDs.');

const expectedRuntimeTools = 50 + extensionIds.length;
const oldAssertion = "if (state.uniqueTools !== 50) findings.push(`dashboard exposes ${state.uniqueTools}/50 tool links`);";
const newAssertion = `if (state.uniqueTools !== ${expectedRuntimeTools}) findings.push(\`dashboard exposes \${state.uniqueTools}/${expectedRuntimeTools} tool links\`);`;
const oldToolIds = 'const toolIds = await getToolIds();';
const newToolIds = `const toolIds = [...await getToolIds(), ...${JSON.stringify(extensionIds)}];`;
for (const required of [oldAssertion, oldToolIds]) if (!baselineSource.includes(required)) throw new Error('R5 baseline structure changed; review the expansion wrapper before continuing.');
const patchedSource = baselineSource.replace(oldAssertion,newAssertion).replace(oldToolIds,newToolIds)
  .replace("console.log('- 50/50 routes rendered at 1440px');", `console.log('- ${expectedRuntimeTools}/${expectedRuntimeTools} routes rendered at 1440px');`)
  .replace("console.log('- 50/50 routes rendered at 320px');", `console.log('- ${expectedRuntimeTools}/${expectedRuntimeTools} routes rendered at 320px');`)
  .replace("console.log('- dashboard exposes all 50 tools at both viewports');", `console.log('- dashboard exposes all ${expectedRuntimeTools} tools at both viewports');`);
if (patchedSource===baselineSource||patchedSource.includes(oldAssertion)||patchedSource.includes(oldToolIds)) throw new Error('Unable to apply the expansion-aware R5 transformations.');
try { writeFileSync(TEMP_SCRIPT,patchedSource,'utf8');const result=spawnSync(process.execPath,[TEMP_SCRIPT],{cwd:ROOT,stdio:'inherit',env:process.env});if(result.error)throw result.error;process.exitCode=result.status??1; } finally { try{rmSync(TEMP_SCRIPT,{force:true});}catch{} }
