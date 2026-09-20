import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = process.env.PHASE7_PDF_OUT
  ? path.resolve(ROOT, process.env.PHASE7_PDF_OUT)
  : path.resolve(ROOT, 'artifacts', 'phase7-pdf-certification');

const PDF_BASE = process.env.PHASE7_PDF_BASE || 'https://thiepn.github.io/pdf/';
const PDF_REPO = 'thiepn/pdf';
const API = `https://api.github.com/repos/${PDF_REPO}`;
const RAW = 'https://raw.githubusercontent.com/thiepn/pdf';
const FAMILY_TOTAL = 18;

const TARGETS = [
  { id: 'merge-pdf', pdfTaskId: 'merge-pdfs', pdfHash: '#/merge', expectedTarget: 'kind: "route", route: { name: "merge" }' },
  { id: 'split-pdf', pdfTaskId: 'split-pdf', pdfHash: '#/tools/split-pdf', expectedTarget: 'kind: "workspace", mode: "toolbox"' },
  { id: 'ocr-pdf', pdfTaskId: 'ocr-pdf', pdfHash: '#/tools/ocr-pdf', expectedTarget: 'kind: "workspace", mode: "ocr"' },
  { id: 'compress-pdf', pdfTaskId: 'compress-pdf', pdfHash: '#/tools/compress-pdf', expectedTarget: 'kind: "workspace", mode: "compress"' },
  { id: 'pdf-metadata', pdfTaskId: 'metadata', pdfHash: '#/tools/metadata', expectedTarget: 'kind: "workspace", mode: "toolbox"' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchResponse(url, label, attempts = 4) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'Accept': String(url).includes('api.github.com') ? 'application/vnd.github+json' : '*/*',
          'User-Agent': 'tiny-tools-phase7-pdf-certification',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      last = error;
      if (attempt < attempts) await sleep(500 * attempt);
    }
  }
  throw new Error(`${label}: ${last instanceof Error ? last.message : String(last)}`);
}

async function fetchJson(url, label) {
  const response = await fetchResponse(url, label);
  return response.json();
}

async function fetchText(url, label) {
  const response = await fetchResponse(url, label);
  return response.text();
}

function successfulRun(runs, name) {
  return runs.find((run) =>
    run.name === name &&
    run.status === 'completed' &&
    run.conclusion === 'success'
  );
}

function taskLine(source, taskId) {
  return source.split('\n').find((line) => line.includes(`id: "${taskId}"`)) || '';
}

function markdown(report) {
  const rows = report.results.map((row) =>
    `| \`${row.id}\` | \`${row.pdfHash}\` | **${row.status}** | ${(row.fixture || row.findings.join('; ') || '—').replaceAll('|', '\\|')} |`
  ).join('\n');

  return `# Phase 7 — Delegated PDF Engine Certification

- PDF family routes: **${FAMILY_TOTAL}**
- Delegated targets: **${report.summary.total}**
- PASS: **${report.summary.PASS}**
- FAIL: **${report.summary.FAIL}**
- Live PDF release: **${report.dependency.version} · ${report.dependency.channel}**
- Qualified PDF commit: \`${report.dependency.qualifiedSha}\`
- PDF Studio CI run: **${report.dependency.ciRunId}**
- Pages qualification/deploy run: **${report.dependency.deployRunId}**

| Tiny Tools route | PDF task hash | Status | Evidence |
|---|---|---|---|
${rows}
`;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const globalFindings = [];
  let dependency = {
    version: '',
    channel: '',
    qualifiedSha: '',
    ciRunId: null,
    deployRunId: null,
  };
  let taskCatalog = '';

  try {
    const [root, metadata, integrity, manifest] = await Promise.all([
      fetchResponse(PDF_BASE, 'live PDF application'),
      fetchJson(new URL('release-metadata.json', PDF_BASE), 'live PDF release metadata'),
      fetchJson(new URL('release-integrity.json', PDF_BASE), 'live PDF release integrity'),
      fetchJson(new URL('manifest.webmanifest', PDF_BASE), 'live PDF manifest'),
    ]);

    if (!root.ok) throw new Error('Live PDF application did not return HTTP 2xx.');
    if (!metadata?.version || typeof metadata.version !== 'string') throw new Error('Live PDF release metadata has no version.');
    if (!['stable', 'release-candidate'].includes(metadata.channel)) {
      throw new Error(`Unsupported live PDF release channel: ${String(metadata.channel)}`);
    }
    if (!integrity || !Number.isFinite(Number(integrity.fileCount)) || Number(integrity.fileCount) < 1) {
      throw new Error('Live PDF release-integrity.json is invalid.');
    }
    const manifestName = String(manifest?.name || manifest?.short_name || '');
    if (!/PDF Studio/i.test(manifestName)) throw new Error('Live PDF manifest does not identify PDF Studio.');

    const version = metadata.version;
    const channel = metadata.channel;
    const ref = channel === 'stable' ? `v${version}` : 'main';

    const commits = await fetchJson(`${API}/commits?sha=${encodeURIComponent(ref)}&per_page=1`, `PDF commit for ${ref}`);
    const qualifiedSha = commits?.[0]?.sha;
    if (!qualifiedSha) throw new Error(`Could not resolve qualified PDF commit for ${ref}.`);

    const [runsPayload, packageJson, ciWorkflow, deployWorkflow, catalog] = await Promise.all([
      fetchJson(`${API}/actions/runs?head_sha=${qualifiedSha}&per_page=50`, 'PDF qualification workflow runs'),
      fetchJson(`${RAW}/${qualifiedSha}/package.json`, 'qualified PDF package.json'),
      fetchText(`${RAW}/${qualifiedSha}/.github/workflows/ci.yml`, 'qualified PDF CI workflow'),
      fetchText(`${RAW}/${qualifiedSha}/.github/workflows/deploy.yml`, 'qualified PDF deploy workflow'),
      fetchText(`${RAW}/${qualifiedSha}/src/ia/taskCatalog.ts`, 'qualified PDF task catalog'),
    ]);

    if (packageJson.version !== version) {
      throw new Error(`Live PDF version ${version} does not match qualified source version ${String(packageJson.version)}.`);
    }

    const runs = runsPayload?.workflow_runs || [];
    const ciRun = successfulRun(runs, 'PDF Studio CI');
    const deployRun = successfulRun(runs, 'Deploy PDF Studio to GitHub Pages');
    if (!ciRun) throw new Error(`Qualified PDF commit ${qualifiedSha} has no successful PDF Studio CI run.`);
    if (!deployRun) throw new Error(`Qualified PDF commit ${qualifiedSha} has no successful Pages qualification/deploy run.`);

    const requiredCiMarkers = [
      'npm run test:e2e',
      'npm run release:web',
      'High-severity dependency security gate',
      'Generate browser corpora',
    ];
    for (const marker of requiredCiMarkers) {
      if (!ciWorkflow.includes(marker)) throw new Error(`Qualified PDF CI workflow is missing: ${marker}`);
    }

    const requiredDeployMarkers = [
      'npm run build:verified',
      'npm run test:e2e',
      'npm run audit:security',
      'release-integrity.json',
    ];
    for (const marker of requiredDeployMarkers) {
      if (!deployWorkflow.includes(marker)) throw new Error(`Qualified PDF deploy workflow is missing: ${marker}`);
    }

    if (!packageJson.scripts?.['test:e2e'] || !packageJson.scripts?.['release:web']) {
      throw new Error('Qualified PDF source is missing its browser/release qualification scripts.');
    }

    dependency = {
      version,
      channel,
      qualifiedSha,
      ciRunId: ciRun.id,
      deployRunId: deployRun.id,
    };
    taskCatalog = catalog;
  } catch (error) {
    globalFindings.push(error instanceof Error ? error.message : String(error));
  }

  const results = TARGETS.map((target) => {
    const findings = [...globalFindings];
    const line = taskLine(taskCatalog, target.pdfTaskId);

    if (!line) findings.push(`Qualified PDF task catalog is missing ${target.pdfTaskId}.`);
    else if (!line.includes(target.expectedTarget)) {
      findings.push(`Qualified PDF task ${target.pdfTaskId} no longer maps to ${target.expectedTarget}.`);
    }

    const status = findings.length ? 'FAIL' : 'PASS';
    const fixture = status === 'PASS'
      ? `Delegated to PDF Studio ${dependency.version} (${dependency.channel}); qualified commit ${dependency.qualifiedSha.slice(0, 12)}; CI run ${dependency.ciRunId} and Pages qualification run ${dependency.deployRunId} succeeded; source mapping verified for ${target.pdfTaskId}.`
      : '';

    return {
      id: target.id,
      pdfTaskId: target.pdfTaskId,
      pdfHash: target.pdfHash,
      status,
      fixture,
      findings,
    };
  });

  const summary = {
    total: results.length,
    PASS: results.filter((row) => row.status === 'PASS').length,
    FAIL: results.filter((row) => row.status === 'FAIL').length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    baselineCommit: process.env.GITHUB_SHA ?? null,
    pdfBase: PDF_BASE,
    familyTotal: FAMILY_TOTAL,
    dependency,
    summary,
    results,
  };

  await writeFile(path.join(OUT, 'pdf-certification.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(OUT, 'pdf-certification.md'), markdown(report));
  console.log(`Phase 7 delegated PDF summary ${JSON.stringify(summary)}`);
  console.log(`PDF dependency: ${dependency.version} ${dependency.channel} ${dependency.qualifiedSha}`);

  if (summary.total !== TARGETS.length || summary.FAIL) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
