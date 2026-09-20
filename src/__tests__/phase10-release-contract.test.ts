import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { registerAllPublicTools } from '../registry/register-all';
import { TOOLS_REGISTRY } from '../registry/tools';

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));

registerAllPublicTools();

describe('Phase 10 release source contract', () => {
  it('keeps package and lockfile release identity synchronized', () => {
    expect(pkg.private).toBe(true);
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages?.['']?.version).toBe(pkg.version);
  });

  it('keeps the frozen public route inventory at exactly 351', () => {
    expect(TOOLS_REGISTRY).toHaveLength(351);
    expect(new Set(TOOLS_REGISTRY.map((tool) => tool.id)).size).toBe(351);
    expect(new Set(TOOLS_REGISTRY.map((tool) => tool.route)).size).toBe(351);
  });

  it('keeps the release-candidate proof commands available', () => {
    expect(pkg.scripts?.['rc:compare-builds']).toBe('node scripts/phase10-compare-builds.mjs');
    expect(pkg.scripts?.['rc:certify']).toBe('node scripts/phase10-release-candidate.mjs');
  });
});
