import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, TOOLS_REGISTRY } from '../registry/tools';
import { registerPdfPublicTools } from '../registry/pdf-extension';
import { normalizeToolShellId } from '../registry/tool-shell-mode';
import {
  PUBLIC_PDF_TASKS,
  buildPdfWorkspaceUrl,
  getPublicPdfTask,
  readTinyToolsPdfTaskId,
  shouldEmbedPdfWorkspace,
} from '../pdf/publicPdfTasks';

const source = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

registerPdfPublicTools();

describe('P1 public PDF suite', () => {
  it('registers 18 dedicated PDF manipulation routes idempotently after conversion consolidation', () => {
    expect(PUBLIC_PDF_TASKS).toHaveLength(18);
    expect(TOOLS_REGISTRY.filter((tool) => tool.category === 'pdf')).toHaveLength(18);
    expect(CATEGORIES.filter((category) => category.id === 'pdf')).toHaveLength(1);

    registerPdfPublicTools();
    expect(TOOLS_REGISTRY.filter((tool) => tool.category === 'pdf')).toHaveLength(18);
    expect(CATEGORIES.filter((category) => category.id === 'pdf')).toHaveLength(1);
  });

  it('keeps Tiny Tools IDs and routes unique across the dedicated PDF task family', () => {
    const ids = PUBLIC_PDF_TASKS.map((task) => task.id);
    const hashes = PUBLIC_PDF_TASKS.map((task) => `${task.pdfTaskId}:${task.pdfHash}`);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[-a-z0-9]+$/.test(id))).toBe(true);
    expect(hashes.every(Boolean)).toBe(true);
    expect(ids).not.toContain('create-pdf');
    expect(ids).not.toContain('export-pdf');
  });

  it('covers high-value PDF manipulation intents while conversion URLs resolve to the document converter', () => {
    expect(getPublicPdfTask('merge-pdf')?.pdfHash).toBe('#/merge');
    expect(getPublicPdfTask('compress-pdf')?.pdfTaskId).toBe('compress-pdf');
    expect(getPublicPdfTask('redact-pdf')?.pdfTaskId).toBe('mark-redaction');
    expect(getPublicPdfTask('scan-to-pdf')?.keywords).toContain('jpg to pdf');
    expect(normalizeToolShellId('create-pdf')).toBe('document-converter');
    expect(normalizeToolShellId('export-pdf')).toBe('document-converter');
    expect(getPublicPdfTask('organize-pdf-pages')?.keywords).toEqual(expect.arrayContaining(['rotate pdf', 'delete pdf pages', 'extract pdf pages']));
    expect(getPublicPdfTask('watermark-pdf')?.keywords).toContain('page numbers pdf');
  });

  it('resolves direct and /tool/ Tiny Tools hashes lexically for PDF task IDs', () => {
    expect(readTinyToolsPdfTaskId('#/merge-pdf')).toBe('merge-pdf');
    expect(readTinyToolsPdfTaskId('#/tool/compress-pdf')).toBe('compress-pdf');
  });

  it('uses the production PDF app on local dev and a same-origin sibling path in deployment', () => {
    const merge = getPublicPdfTask('merge-pdf')!;
    expect(buildPdfWorkspaceUrl(merge, { hostname: 'localhost', origin: 'http://localhost:3000' })).toBe('https://thiepn.github.io/pdf/#/merge');
    expect(buildPdfWorkspaceUrl(merge, { hostname: 'thiepn.github.io', origin: 'https://thiepn.github.io' })).toBe('https://thiepn.github.io/pdf/#/merge');
    expect(buildPdfWorkspaceUrl(merge, { hostname: 'thiepn.dev', origin: 'https://thiepn.dev' })).toBe('https://thiepn.dev/pdf/#/merge');
    expect(shouldEmbedPdfWorkspace('localhost')).toBe(false);
    expect(shouldEmbedPdfWorkspace('thiepn.github.io')).toBe(true);
  });

  it('uses one shared gateway with local-processing disclosure, embedded production workspace, and full-screen fallback', () => {
    const gateway = source('src/tools/pdf-suite/PdfSuiteGatewayTool.tsx');
    expect(gateway).toContain('Dedicated local PDF workspace');
    expect(gateway).toContain('processed locally');
    expect(gateway).toContain('<iframe');
    expect(gateway).toContain('Open full workspace');
    expect(gateway).toContain('shouldEmbedPdfWorkspace');
  });
});
