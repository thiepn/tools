import { describe, expect, it } from 'vitest';
import { registerPdfPublicTools } from '../registry/pdf-extension';
import { TOOLS_REGISTRY } from '../registry/tools';
import {
  PUBLIC_PDF_TASKS,
  buildPdfWorkspaceUrl,
  getPublicPdfTask,
} from '../pdf/publicPdfTasks';

registerPdfPublicTools();

const PHASE7_TARGETS = [
  'merge-pdf',
  'split-pdf',
  'ocr-pdf',
  'compress-pdf',
  'pdf-metadata',
].sort();

describe('Phase 7 PDF family completeness', () => {
  it('keeps all 18 Tiny Tools PDF routes represented exactly once', () => {
    const registryIds = TOOLS_REGISTRY
      .filter((tool) => tool.category === 'pdf')
      .map((tool) => tool.id)
      .sort();

    expect(PUBLIC_PDF_TASKS).toHaveLength(18);
    expect(registryIds).toHaveLength(18);
    expect(new Set(registryIds).size).toBe(18);
    expect(registryIds).toEqual(PUBLIC_PDF_TASKS.map((task) => task.id).sort());
  });

  it('tracks the five Phase 7 formerly fixture-blocked workflows explicitly', () => {
    expect(PHASE7_TARGETS).toEqual([
      'compress-pdf',
      'merge-pdf',
      'ocr-pdf',
      'pdf-metadata',
      'split-pdf',
    ]);
  });

  it('maps every Phase 7 Tiny Tools route to the exact production PDF Everything task hash', () => {
    expect(getPublicPdfTask('merge-pdf')).toMatchObject({
      pdfTaskId: 'merge-pdfs',
      pdfHash: '#/merge',
    });
    expect(getPublicPdfTask('split-pdf')).toMatchObject({
      pdfTaskId: 'split-pdf',
      pdfHash: '#/tools/split-pdf',
    });
    expect(getPublicPdfTask('ocr-pdf')).toMatchObject({
      pdfTaskId: 'ocr-pdf',
      pdfHash: '#/tools/ocr-pdf',
    });
    expect(getPublicPdfTask('compress-pdf')).toMatchObject({
      pdfTaskId: 'compress-pdf',
      pdfHash: '#/tools/compress-pdf',
    });
    expect(getPublicPdfTask('pdf-metadata')).toMatchObject({
      pdfTaskId: 'metadata',
      pdfHash: '#/tools/metadata',
    });
  });

  it('resolves the five targets to the live sibling PDF application in GitHub Pages deployment', () => {
    const location = {
      hostname: 'thiepn.github.io',
      origin: 'https://thiepn.github.io',
    };

    for (const id of PHASE7_TARGETS) {
      const task = getPublicPdfTask(id);
      expect(task).toBeDefined();
      expect(buildPdfWorkspaceUrl(task!, location)).toBe(
        `https://thiepn.github.io/pdf/${task!.pdfHash}`
      );
    }
  });
});
