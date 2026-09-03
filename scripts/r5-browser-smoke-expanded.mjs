import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE_SCRIPT = path.resolve(ROOT, 'scripts/r5-browser-smoke.mjs');
const TEMP_SCRIPT = path.resolve(ROOT, 'scripts/.r5-browser-smoke-expanded.tmp.mjs');
const EXTENSION_CATALOGS = [
  { phase: 'P1 PDF', path: path.resolve(ROOT, 'src/pdf/publicPdfTasks.ts'), expected: 18, shape: 'tuple' },
  { phase: 'P2 device diagnostics', path: path.resolve(ROOT, 'src/device/publicDeviceTasks.ts'), expected: 16, shape: 'tuple' },
  { phase: 'P3 everyday calculators', path: path.resolve(ROOT, 'src/calculators/publicCalculatorTasks.ts'), expected: 46, shape: 'tuple' },
  { phase: 'P4 file conversion', path: path.resolve(ROOT, 'src/files/publicFileConversionTasks.ts'), expected: 9, shape: 'tuple' },
  { phase: 'P5 image micro-tools', path: path.resolve(ROOT, 'src/image/publicImageTasks.ts'), expected: 19, shape: 'tuple' },
  { phase: 'P6 audio/video media', path: path.resolve(ROOT, 'src/media/publicMediaTasks.ts'), expected: 29, shape: 'tuple' },
  { phase: 'P7 text/study', path: path.resolve(ROOT, 'src/text-study/publicTextStudyTasks.ts'), expected: 22, shape: 'tuple' },
  { phase: 'P8 privacy/developer', path: path.resolve(ROOT, 'src/privacy-dev/publicPrivacyDevTasks.ts'), expected: 16, shape: 'tuple' },
  { phase: 'P9 everyday documents/planning', path: path.resolve(ROOT, 'src/everyday/publicEverydayTasks.ts'), expected: 13, shape: 'tuple' },
  { phase: 'P11 high-value gaps', path: path.resolve(ROOT, 'src/expansion/publicP11Tasks.ts'), expected: 26, shape: 'tuple' },
  { phase: 'P12 web/developer authoring', path: path.resolve(ROOT, 'src/expansion/publicP12Tasks.ts'), expected: 18, shape: 'tuple' },
  { phase: 'P13 Office/eBook interchange', path: path.resolve(ROOT, 'src/expansion/publicP13Tasks.ts'), expected: 3, shape: 'tuple' },
  { phase: 'P14 developer/security completion', path: path.resolve(ROOT, 'src/expansion/publicP14Tasks.ts'), expected: 13, shape: 'tuple' },
  { phase: 'P15 math/data visualization', path: path.resolve(ROOT, 'src/expansion/publicP15Tasks.ts'), expected: 13, shape: 'tuple' },
  { phase: 'P16 subtitle/media completion', path: path.resolve(ROOT, 'src/expansion/publicP16Tasks.ts'), expected: 9, shape: 'tuple' },
  { phase: 'P17 file viewers/inspection', path: path.resolve(ROOT, 'src/expansion/publicP17Tasks.ts'), expected: 8, shape: 'tuple' },
  { phase: 'P18 image enhancement/restoration', path: path.resolve(ROOT, 'src/expansion/publicP18Tasks.ts'), expected: 6, shape: 'tuple' },
  { phase: 'P19 network/browser diagnostics', path: path.resolve(ROOT, 'src/expansion/publicP19Tasks.ts'), expected: 9, shape: 'tuple' },
  { phase: 'P20 final general utilities', path: path.resolve(ROOT, 'src/expansion/publicP20Tasks.ts'), expected: 8, shape: 'multiline-tuple' },
];

function readCatalogIds(catalog) {
  const source = readFileSync(catalog.path, 'utf8');
  const pattern = catalog.shape === 'tuple'
    ? /^\s*\['([^']+)'/gm
    : catalog.shape === 'multiline-tuple'
      ? /^\s*\[\s*\n\s*'([^']+)'/gm
      : /^\s{2,4}(?:\{ )?id:\s*'([^']+)'/gm;
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

const baselineSource = readFileSync(BASELINE_SCRIPT, 'utf8');
const extensionIds = [];
for (const catalog of EXTENSION_CATALOGS) {
  const ids = readCatalogIds(catalog);
  if (ids.length !== catalog.expected || new Set(ids).size !== catalog.expected) {
    throw new Error(`Expected ${catalog.expected} unique ${catalog.phase} task IDs; found ${ids.length}.`);
  }
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
