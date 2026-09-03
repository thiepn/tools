import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.resolve(process.env.TINY_TOOLS_DIST_DIR || path.join(ROOT, 'dist'));
const PREVIOUS_SITE_OVERRIDE = process.env.TINY_TOOLS_PREVIOUS_SITE_DIR
  ? path.resolve(process.env.TINY_TOOLS_PREVIOUS_SITE_DIR)
  : null;
const GENERATION_NAME = 'build-generation.json';
const RETAINED_NAME = 'retained-generation.json';
const ARTIFACT_NAME = 'github-pages';
const MAX_API_ATTEMPTS = 4;

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function safeAssetPath(relative) {
  if (typeof relative !== 'string') return null;
  const normalized = relative.replaceAll('\\', '/');
  if (!normalized.startsWith('assets/')) return null;
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) return null;
  return normalized;
}

async function walkAssets(directory, relativeBase = 'assets') {
  const output = [];
  if (!await exists(directory)) return output;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(relativeBase, entry.name);
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walkAssets(target, relative));
    else if (entry.isFile()) output.push(relative);
  }
  return output;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
}

async function fetchWithRetry(url, options, label) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_API_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_API_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw new Error(`${label} failed after ${MAX_API_ATTEMPTS} attempts: ${lastError?.message ?? lastError}`);
}

async function acquirePreviousSite() {
  if (PREVIOUS_SITE_OVERRIDE) {
    return { site: PREVIOUS_SITE_OVERRIDE, cleanup: async () => {}, artifact: null };
  }

  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const repository = process.env.GH_REPOSITORY || process.env.GITHUB_REPOSITORY;
  if (!token || !repository) {
    throw new Error('Previous-generation retention requires GH_TOKEN/GITHUB_TOKEN and GH_REPOSITORY/GITHUB_REPOSITORY.');
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'tiny-tools-build-retention',
  };
  const listUrl = `https://api.github.com/repos/${repository}/actions/artifacts?name=${encodeURIComponent(ARTIFACT_NAME)}&per_page=20`;
  const listResponse = await fetchWithRetry(listUrl, { headers }, 'Listing previous Pages artifacts');
  const payload = await listResponse.json();
  const currentSha = process.env.GITHUB_SHA;
  const artifact = (payload.artifacts ?? []).find((candidate) =>
    candidate?.name === ARTIFACT_NAME &&
    !candidate?.expired &&
    (!currentSha || candidate?.workflow_run?.head_sha !== currentSha)
  );

  if (!artifact) return null;

  const temp = await mkdtemp(path.join(tmpdir(), 'tiny-tools-previous-pages-'));
  const zipPath = path.join(temp, 'artifact.zip');
  const extractDir = path.join(temp, 'zip');
  const site = path.join(temp, 'site');
  await mkdir(extractDir, { recursive: true });
  await mkdir(site, { recursive: true });

  try {
    const archiveResponse = await fetchWithRetry(
      artifact.archive_download_url,
      { headers, redirect: 'follow' },
      'Downloading previous Pages artifact'
    );
    await writeFile(zipPath, Buffer.from(await archiveResponse.arrayBuffer()));
    run('unzip', ['-q', zipPath, '-d', extractDir], ROOT);
    const tarPath = path.join(extractDir, 'artifact.tar');
    if (!await exists(tarPath)) throw new Error('Downloaded Pages artifact did not contain artifact.tar.');
    run('tar', ['-xf', tarPath, '-C', site], ROOT);
    return {
      site,
      artifact,
      cleanup: () => rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
    };
  } catch (error) {
    await rm(temp, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function readPreviousGeneration(site) {
  const generationPath = path.join(site, GENERATION_NAME);
  if (await exists(generationPath)) {
    const generation = JSON.parse(await readFile(generationPath, 'utf8'));
    if (generation?.schemaVersion !== 1 || !Array.isArray(generation.files)) {
      throw new Error(`Previous ${GENERATION_NAME} has an unsupported schema.`);
    }
    return {
      commit: generation.commit ?? null,
      generatedAt: generation.generatedAt ?? null,
      files: generation.files.map(safeAssetPath).filter(Boolean),
      legacyMigration: false,
    };
  }

  // Migration path for the deployment immediately before this feature exists.
  // That artifact cannot contain recursively retained generations yet, so copying
  // its assets directory is bounded and safe for this one transition.
  return {
    commit: null,
    generatedAt: null,
    files: await walkAssets(path.join(site, 'assets')),
    legacyMigration: true,
  };
}

async function digest(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function writeRetainedManifest(data) {
  await writeFile(path.join(DIST, RETAINED_NAME), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const acquired = await acquirePreviousSite();
if (!acquired) {
  await writeRetainedManifest({
    schemaVersion: 1,
    sourceCommit: null,
    sourceGeneratedAt: null,
    retainedAt: new Date().toISOString(),
    legacyMigration: false,
    files: [],
    copiedFiles: 0,
  });
  console.log('No previous Pages artifact exists; current generation will deploy without retained assets.');
  process.exit(0);
}

try {
  const previous = await readPreviousGeneration(acquired.site);
  const uniqueFiles = [...new Set(previous.files)].sort();
  const available = [];
  let copied = 0;

  for (const relative of uniqueFiles) {
    const source = path.join(acquired.site, ...relative.split('/'));
    if (!await exists(source)) {
      throw new Error(`Previous generation manifest references missing asset: ${relative}`);
    }

    const destination = path.join(DIST, ...relative.split('/'));
    await mkdir(path.dirname(destination), { recursive: true });
    if (await exists(destination)) {
      const [sourceDigest, destinationDigest] = await Promise.all([digest(source), digest(destination)]);
      if (sourceDigest !== destinationDigest) {
        throw new Error(`Asset filename collision across generations: ${relative}`);
      }
    } else {
      await copyFile(source, destination);
      copied += 1;
    }
    available.push(relative);
  }

  await writeRetainedManifest({
    schemaVersion: 1,
    sourceCommit: previous.commit ?? acquired.artifact?.workflow_run?.head_sha ?? null,
    sourceGeneratedAt: previous.generatedAt,
    retainedAt: new Date().toISOString(),
    legacyMigration: previous.legacyMigration,
    files: available,
    copiedFiles: copied,
  });

  console.log(`Retained ${available.length} previous-generation assets (${copied} copied, ${available.length - copied} already shared with the current build).`);
  if (previous.legacyMigration) console.log('Previous artifact predates build-generation metadata; one-time bounded migration copied its assets directory.');
} finally {
  await acquired.cleanup();
}
