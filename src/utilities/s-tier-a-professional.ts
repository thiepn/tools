export interface ProfessionalControlState {
  key: string;
  label: string;
  kind: string;
  value: string;
  sensitive: boolean;
  disabled: boolean;
  valid: boolean;
}

export interface ProfessionalSnapshot {
  version: 1;
  toolId: string;
  capturedAt: string;
  controls: ProfessionalControlState[];
  output: string;
}

export interface ProfessionalQualitySummary {
  controls: number;
  writableControls: number;
  sensitiveControls: number;
  invalidControls: number;
  outputCharacters: number;
  outputLines: number;
  nonEmptyOutputLines: number;
}

export interface RepeatabilityResult {
  stable: boolean;
  uniqueSamples: number;
  changedSamples: number;
  firstDifference?: string;
}

const SENSITIVE = /(?:password|passphrase|secret|private\s*key|api\s*key|token|otp|seed\s*phrase|recovery\s*phrase|credential|authorization)/i;

export function isProfessionalSensitiveField(label: string, kind = ''): boolean {
  return kind.toLowerCase() === 'password' || SENSITIVE.test(label);
}

export function sanitizeProfessionalValue(label: string, kind: string, value: unknown): string {
  if (isProfessionalSensitiveField(label, kind)) return '[omitted]';
  return String(value ?? '').slice(0, 12000);
}

export function normalizeProfessionalOutput(value: string, maxLength = 20000): string {
  const normalized = value.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}\n…[truncated]`;
}

export function summarizeProfessionalSnapshot(snapshot: ProfessionalSnapshot): ProfessionalQualitySummary {
  const output = normalizeProfessionalOutput(snapshot.output);
  const lines = output ? output.split('\n') : [];
  return {
    controls: snapshot.controls.length,
    writableControls: snapshot.controls.filter((control) => !control.disabled && !control.sensitive).length,
    sensitiveControls: snapshot.controls.filter((control) => control.sensitive).length,
    invalidControls: snapshot.controls.filter((control) => !control.disabled && !control.valid).length,
    outputCharacters: Array.from(output).length,
    outputLines: lines.length,
    nonEmptyOutputLines: lines.filter((line) => line.trim()).length,
  };
}

function stablePayload(snapshot: ProfessionalSnapshot): string {
  const controls = [...snapshot.controls]
    .map((control) => ({
      key: control.key,
      label: control.label,
      kind: control.kind,
      value: control.sensitive ? '[omitted]' : control.value,
      sensitive: control.sensitive,
      disabled: control.disabled,
      valid: control.valid,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return JSON.stringify({ version: 1, toolId: snapshot.toolId, controls, output: normalizeProfessionalOutput(snapshot.output) });
}

export function professionalFingerprint(snapshot: ProfessionalSnapshot): string {
  const text = stablePayload(snapshot);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

function firstChangedLine(a: string, b: string): string | undefined {
  const left = normalizeProfessionalOutput(a).split('\n');
  const right = normalizeProfessionalOutput(b).split('\n');
  const count = Math.max(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    if ((left[index] ?? '') !== (right[index] ?? '')) {
      return `Line ${index + 1}: ${left[index] ?? '(missing)'} → ${right[index] ?? '(missing)'}`.slice(0, 500);
    }
  }
  return undefined;
}

export function analyzeProfessionalRepeatability(samples: string[]): RepeatabilityResult {
  const normalized = samples.map((sample) => normalizeProfessionalOutput(sample));
  if (normalized.length <= 1) return { stable: true, uniqueSamples: normalized.length, changedSamples: 0 };
  const first = normalized[0];
  const changed = normalized.filter((sample) => sample !== first);
  return {
    stable: changed.length === 0,
    uniqueSamples: new Set(normalized).size,
    changedSamples: changed.length,
    firstDifference: changed.length ? firstChangedLine(first, changed[0]) : undefined,
  };
}

function markdownEscape(value: string): string {
  return value.replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
}

export function buildProfessionalMarkdownReport(snapshot: ProfessionalSnapshot, repeatability?: RepeatabilityResult): string {
  const summary = summarizeProfessionalSnapshot(snapshot);
  const fingerprint = professionalFingerprint(snapshot);
  const rows = snapshot.controls.slice(0, 80).map((control) =>
    `| ${markdownEscape(control.label)} | ${markdownEscape(control.kind)} | ${markdownEscape(control.sensitive ? '[omitted]' : control.value)} | ${control.valid ? 'yes' : 'no'} |`
  );
  return [
    `# Tiny Tools professional report — ${snapshot.toolId}`,
    '',
    `Captured: ${snapshot.capturedAt}`,
    `Reproducibility fingerprint: \`${fingerprint}\``,
    '',
    '## Quality summary',
    '',
    `- Controls: ${summary.controls}`,
    `- Writable, non-sensitive controls: ${summary.writableControls}`,
    `- Sensitive controls omitted: ${summary.sensitiveControls}`,
    `- Invalid controls: ${summary.invalidControls}`,
    `- Captured output: ${summary.outputCharacters} characters across ${summary.outputLines} lines`,
    ...(repeatability ? [`- Repeatability: ${repeatability.stable ? 'stable' : `changed (${repeatability.uniqueSamples} unique samples)`}`] : []),
    '',
    '## Control state',
    '',
    '| Control | Type | Value | Valid |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '## Visible output',
    '',
    '```text',
    normalizeProfessionalOutput(snapshot.output, 12000),
    '```',
    '',
  ].join('\n');
}

export function buildProfessionalJsonReport(snapshot: ProfessionalSnapshot, repeatability?: RepeatabilityResult): string {
  return JSON.stringify({
    schema: 'tiny-tools-professional-report/v1',
    fingerprint: professionalFingerprint(snapshot),
    quality: summarizeProfessionalSnapshot(snapshot),
    repeatability: repeatability ?? null,
    snapshot: {
      ...snapshot,
      controls: snapshot.controls.map((control) => ({ ...control, value: control.sensitive ? '[omitted]' : control.value })),
      output: normalizeProfessionalOutput(snapshot.output),
    },
  }, null, 2);
}
