import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOLS_REGISTRY } from '../registry/tools';

const toolsRoot = path.resolve(process.cwd(), 'src/tools');

function collectToolComponents(): Array<{ directory: string; path: string; source: string }> {
  const entries = fs.readdirSync(toolsRoot, { withFileTypes: true });
  const components: Array<{ directory: string; path: string; source: string }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directoryPath = path.join(toolsRoot, entry.name);
    const filenames = fs.readdirSync(directoryPath);
    const componentName = filenames.find((filename) => filename.endsWith('Tool.tsx'));
    if (!componentName) continue;

    const componentPath = path.join(directoryPath, componentName);
    components.push({
      directory: entry.name,
      path: componentPath,
      source: fs.readFileSync(componentPath, 'utf8'),
    });
  }

  return components.sort((a, b) => a.directory.localeCompare(b.directory));
}

describe('R4 per-tool UI contract', () => {
  const components = collectToolComponents();

  it('keeps exactly one primary component for each of the 50 registered tools', () => {
    expect(components).toHaveLength(50);
    expect(TOOLS_REGISTRY).toHaveLength(50);
    expect(new Set(components.map((component) => component.directory))).toEqual(
      new Set(TOOLS_REGISTRY.map((tool) => tool.id))
    );
  });

  it('routes every tool through the shared ToolShell', () => {
    const violations = components
      .filter(
        (component) =>
          !component.source.includes("components/tool-shell/ToolShell") ||
          !component.source.includes('<ToolShell')
      )
      .map((component) => component.directory);

    expect(violations).toEqual([]);
  });

  it('keeps each ToolShell toolId aligned with its registry directory ID', () => {
    const violations = components
      .filter((component) => {
        const toolIdMatch = component.source.match(/toolId=["']([^"']+)["']/);
        return !toolIdMatch || toolIdMatch[1] !== component.directory;
      })
      .map((component) => component.directory);

    expect(violations).toEqual([]);
  });

  it('provides the shared content contract and accessible shell semantics', () => {
    const shellSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/tool-shell/ToolShell.tsx'),
      'utf8'
    );

    expect(shellSource).toContain('tt-tool-content');
    expect(shellSource).toContain('data-tool-id');
    expect(shellSource).toContain('aria-labelledby');
    expect(shellSource).toContain('aria-describedby');
  });

  it('keeps the tool control contract available without tool-specific dependencies', () => {
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

  it('normalizes the Unit Converter as a reference implementation', () => {
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
