import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { registerAllPublicTools } from '../registry/register-all';
import { TOOLS_REGISTRY } from '../registry/tools';

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const deployWorkflow = readFileSync(path.join(ROOT, '.github/workflows/deploy-pages.yml'), 'utf8');
const functionalWiringScript = readFileSync(path.join(ROOT, 'scripts/functional-wiring-certification.mjs'), 'utf8');

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
    expect(pkg.scripts?.['browser:functional-wiring']).toBe('node scripts/functional-wiring-certification.mjs');
    expect(pkg.scripts?.['browser:real-media']).toBe('node scripts/real-media-processing-certification.mjs');
    expect(pkg.scripts?.['browser:real-converters']).toBe('node scripts/real-converter-certification.mjs');
    expect(pkg.scripts?.['browser:functional-wiring']).toBe('node scripts/functional-wiring-certification.mjs');
  });
  it('keeps full 351-tool live-production certification in the Pages pipeline', () => {
    expect(deployWorkflow).toContain('Live 351-tool functional wiring');
    expect(deployWorkflow).toContain('FUNCTIONAL_WIRING_BASE_URL');
    expect(deployWorkflow).toContain('FUNCTIONAL_WIRING_EXPECTED_COMMIT');
    expect(deployWorkflow).toContain('npm run browser:functional-wiring');
    expect(functionalWiringScript).toContain('FUNCTIONAL_WIRING_BASE_URL');
    expect(functionalWiringScript).toContain('FUNCTIONAL_WIRING_EXPECTED_COMMIT');
    expect(functionalWiringScript).toContain('build-generation.json');
  });

});
