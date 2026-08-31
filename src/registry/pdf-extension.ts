import { lazy } from 'react';
import type { ToolDefinition } from '../types';
import { PUBLIC_PDF_TASKS } from '../pdf/publicPdfTasks';
import { CATEGORIES, TOOLS_REGISTRY } from './tools';

const PdfSuiteGatewayTool = lazy(() => import('../tools/pdf-suite/PdfSuiteGatewayTool'));

/**
 * Adds the public PDF task family to the established Tiny Tools registry.
 * Kept as an idempotent registration step so the original 50-tool registry
 * remains stable while public-completeness phases add shared-engine families.
 */
export function registerPdfPublicTools(): void {
  if (!CATEGORIES.some((category) => category.id === 'pdf')) {
    const productivityIndex = CATEGORIES.findIndex((category) => category.id === 'productivity');
    const insertAt = productivityIndex >= 0 ? productivityIndex + 1 : 0;
    CATEGORIES.splice(insertAt, 0, {
      id: 'pdf',
      label: 'PDF Tools',
      description: 'Create, merge, edit, organize, protect, OCR, compress, and export PDF documents',
    });
  }

  const knownIds = new Set(TOOLS_REGISTRY.map((tool) => tool.id));
  for (const task of PUBLIC_PDF_TASKS) {
    if (knownIds.has(task.id)) continue;
    const definition: ToolDefinition = {
      id: task.id,
      name: task.name,
      shortName: task.shortName,
      description: task.description,
      category: 'pdf',
      keywords: task.keywords,
      iconName: 'FileText',
      route: `/${task.id}`,
      featured: task.featured,
      acceptsTextTransfer: false,
      producesTextTransfer: false,
      component: PdfSuiteGatewayTool,
    };
    TOOLS_REGISTRY.push(definition);
    knownIds.add(task.id);
  }
}
