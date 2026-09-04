import { describe, expect, it } from 'vitest';
import { registerAllPublicTools } from '../registry/register-all';
import { TOOLS_REGISTRY } from '../registry/tools';
import { STIER_A_TARGET_COUNT, STIER_A_TARGET_IDS } from '../s-tier-a/manifest';
import { STIER_B_TARGET_SET } from '../s-tier-b/manifest';
import {
  analyzeProfessionalRepeatability,
  buildProfessionalJsonReport,
  buildProfessionalMarkdownReport,
  isProfessionalSensitiveField,
  professionalFingerprint,
  sanitizeProfessionalValue,
  summarizeProfessionalSnapshot,
  type ProfessionalSnapshot,
} from '../utilities/s-tier-a-professional';

registerAllPublicTools();

function sample(capturedAt = '2026-09-05T00:00:00.000Z'): ProfessionalSnapshot {
  return {
    version: 1,
    toolId: 'mortgage-calculator',
    capturedAt,
    controls: [
      { key: 'amount', label: 'Loan amount', kind: 'number', value: '300000', sensitive: false, disabled: false, valid: true },
      { key: 'term', label: 'Term', kind: 'number', value: '30', sensitive: false, disabled: false, valid: true },
      { key: 'token', label: 'API token', kind: 'text', value: '[omitted]', sensitive: true, disabled: false, valid: true },
    ],
    output: 'Monthly payment 1,500\nTotal interest 240,000',
  };
}

describe('R13 S-tier uplift for the explicit former A-tier catalog', () => {
  it('binds exactly 126 unique A-tier routes from the explicit ranking list', () => {
    expect(STIER_A_TARGET_COUNT).toBe(126);
    expect(new Set(STIER_A_TARGET_IDS).size).toBe(126);
  });

  it('does not overlap the explicit former B-tier catalog', () => {
    expect(STIER_A_TARGET_IDS.filter((id) => STIER_B_TARGET_SET.has(id))).toEqual([]);
  });

  it('keeps all A-tier targets registered and decorates their real professional capabilities', () => {
    for (const id of STIER_A_TARGET_IDS) {
      const tool = TOOLS_REGISTRY.find((candidate) => candidate.id === id);
      expect(tool, id).toBeTruthy();
      expect(tool?.keywords, id).toContain('expert workspace');
      expect(tool?.keywords, id).toContain('professional qa console');
      expect(tool?.keywords, id).toContain('reproducibility fingerprint');
      expect(tool?.keywords, id).toContain('repeatability check');
      expect(tool?.description, id).toMatch(/professional QA console/i);
    }
  });

  it('keeps the public catalog fixed at 351 routes', () => {
    expect(TOOLS_REGISTRY).toHaveLength(351);
  });

  it('produces a deterministic fingerprint that ignores capture time', () => {
    expect(professionalFingerprint(sample('2026-09-05T00:00:00.000Z')))
      .toBe(professionalFingerprint(sample('2026-09-05T03:12:00.000Z')));
    const changed = sample();
    changed.controls[0] = { ...changed.controls[0], value: '350000' };
    expect(professionalFingerprint(changed)).not.toBe(professionalFingerprint(sample()));
  });

  it('redacts secret-like fields before professional reporting', () => {
    expect(isProfessionalSensitiveField('Private key', 'text')).toBe(true);
    expect(isProfessionalSensitiveField('Password', 'password')).toBe(true);
    expect(sanitizeProfessionalValue('API token', 'text', 'super-secret')).toBe('[omitted]');
    expect(sanitizeProfessionalValue('Width', 'number', 1920)).toBe('1920');
  });

  it('summarizes validity and visible output depth', () => {
    const current = sample();
    current.controls[1] = { ...current.controls[1], valid: false };
    const summary = summarizeProfessionalSnapshot(current);
    expect(summary.controls).toBe(3);
    expect(summary.sensitiveControls).toBe(1);
    expect(summary.invalidControls).toBe(1);
    expect(summary.outputLines).toBe(2);
  });

  it('distinguishes stable and dynamic visible output', () => {
    expect(analyzeProfessionalRepeatability(['same', 'same', 'same'])).toEqual({ stable: true, uniqueSamples: 1, changedSamples: 0 });
    const dynamic = analyzeProfessionalRepeatability(['Value 1', 'Value 2', 'Value 2']);
    expect(dynamic.stable).toBe(false);
    expect(dynamic.uniqueSamples).toBe(2);
    expect(dynamic.changedSamples).toBe(2);
    expect(dynamic.firstDifference).toMatch(/Line 1/);
  });

  it('exports reproducible Markdown and JSON reports without sensitive content', () => {
    const current = sample();
    const markdown = buildProfessionalMarkdownReport(current);
    const json = buildProfessionalJsonReport(current);
    expect(markdown).toContain('Reproducibility fingerprint');
    expect(markdown).toContain('[omitted]');
    expect(json).toContain('tiny-tools-professional-report/v1');
    expect(json).not.toContain('super-secret');
  });
});
