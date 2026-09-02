import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOLS_REGISTRY } from '../registry/tools';
import {
  APP_MANAGED_TOOL_IDS,
  LEGACY_TOOL_SHELL_ID_ALIASES,
  normalizeToolShellId,
} from '../registry/tool-shell-mode';

const registryPath = path.resolve(process.cwd(), 'src/registry/tools.ts');
const registrySource = fs.readFileSync(registryPath, 'utf8');
const registryDir = path.dirname(registryPath);

function resolveComponentSource(relativeImport: string): string {
  const base = path.resolve(registryDir, relativeImport);
  const candidates = [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolved) throw new Error(`Unable to resolve registered tool component: ${relativeImport}`);
  return fs.readFileSync(resolved, 'utf8');
}

function collectRegisteredComponentImports(): string[] {
  return [...registrySource.matchAll(/component:\s*lazy\(\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)\)/g)].map(
    (match) => match[1]
  );
}

describe('R4 per-tool UI contract', () => {
  const componentImports = collectRegisteredComponentImports();
  const appManaged = new Set<string>(APP_MANAGED_TOOL_IDS);

  it('keeps one unique registered component import for each of the 50 tools', () => {
    expect(TOOLS_REGISTRY).toHaveLength(50);
    expect(componentImports).toHaveLength(50);
    expect(new Set(componentImports).size).toBe(50);

    for (const componentImport of componentImports) {
      expect(() => resolveComponentSource(componentImport)).not.toThrow();
    }
  });

  it('keeps the app-managed shell list explicit and limited to the 10 bare Phase 5 tools', () => {
    expect(APP_MANAGED_TOOL_IDS).toHaveLength(10);
    expect(new Set(APP_MANAGED_TOOL_IDS).size).toBe(10);

    for (const toolId of APP_MANAGED_TOOL_IDS) {
      expect(TOOLS_REGISTRY.some((tool) => tool.id === toolId)).toBe(true);
    }
  });

  it('ensures every registered route receives ToolShell exactly once by architecture', () => {
    const violations: string[] = [];

    TOOLS_REGISTRY.forEach((tool, index) => {
      const source = resolveComponentSource(componentImports[index]);
      const selfManaged =
        source.includes("components/tool-shell/ToolShell") && source.includes('<ToolShell');

      if (appManaged.has(tool.id)) {
        if (selfManaged) violations.push(`${tool.id}: both app-managed and self-managed`);
      } else if (!selfManaged) {
        violations.push(`${tool.id}: no ToolShell`);
      }
    });

    expect(violations).toEqual([]);
  });

  it('keeps self-managed ToolShell IDs aligned after canonical alias normalization', () => {
    const violations: string[] = [];

    TOOLS_REGISTRY.forEach((tool, index) => {
      if (appManaged.has(tool.id)) return;
      const source = resolveComponentSource(componentImports[index]);
      const toolIdMatch = source.match(/toolId=["']([^"']+)["']/);
      const canonicalId = toolIdMatch ? normalizeToolShellId(toolIdMatch[1]) : null;
      if (!canonicalId || canonicalId !== tool.id) {
        violations.push(`${tool.id}: ${toolIdMatch?.[1] ?? 'missing'}`);
      }
    });

    expect(violations).toEqual([]);
    expect(LEGACY_TOOL_SHELL_ID_ALIASES['qr-code-studio']).toBe('qr-studio');
    expect(LEGACY_TOOL_SHELL_ID_ALIASES['csv-to-json']).toBe('data-converter');
    expect(LEGACY_TOOL_SHELL_ID_ALIASES['docx-to-markdown']).toBe('document-converter');
    expect(LEGACY_TOOL_SHELL_ID_ALIASES['heic-image-converter']).toBe('image-converter');
    expect(LEGACY_TOOL_SHELL_ID_ALIASES['audio-to-wav-converter']).toBe('audio-converter');
    expect(LEGACY_TOOL_SHELL_ID_ALIASES['srt-to-vtt']).toBe('subtitle-converter');
  });

  it('wraps every app-managed bare tool through ToolShell in App', () => {
    const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(appSource).toContain('isAppManagedToolShell(activeToolDef.id)');
    expect(appSource).toContain('<ToolShell');
    expect(appSource).toContain('getAppManagedRelatedToolIds(activeToolDef.id)');
  });

  it('provides the shared content contract and canonical shell semantics', () => {
    const shellSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/tool-shell/ToolShell.tsx'),
      'utf8'
    );

    expect(shellSource).toContain('tt-tool-content');
    expect(shellSource).toContain('data-tool-id={canonicalToolId}');
    expect(shellSource).toContain('normalizeToolShellId(toolId)');
    expect(shellSource).toContain('aria-labelledby');
    expect(shellSource).toContain('aria-describedby');
  });

  it('keeps the shared tool-control primitives available', () => {
    const controlsSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/tool-ui/ToolControls.tsx'),
      'utf8'
    );

    expect(controlsSource).toContain('export const ToolStatus');
    expect(controlsSource).toContain('export const CopyButton');
    expect(controlsSource).toContain('export const ToolActionBar');
    expect(controlsSource).toContain('export const AccessibleDropZone');
    expect(controlsSource).toContain("role={isError ? 'alert' : 'status'}");
  });

  it('normalizes Unit Converter as the reference implementation', () => {
    const unitConverter = fs.readFileSync(
      path.resolve(process.cwd(), 'src/tools/unit-converter/UnitConverterTool.tsx'),
      'utf8'
    );

    expect(unitConverter).toContain('CopyButton');
    expect(unitConverter).toContain('aria-pressed={isSelected}');
    expect(unitConverter).toContain('htmlFor="unit-converter-input"');
    expect(unitConverter).toContain('aria-label="Swap source and target units"');
  });
});
