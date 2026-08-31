import { lazy } from 'react';
import type { ToolDefinition } from '../types';
import { PUBLIC_FILE_CONVERSION_TASKS } from '../files/publicFileConversionTasks';
import { TOOLS_REGISTRY } from './tools';

const FileFormatConversionTool = lazy(() => import('../tools/file-format-conversion/FileFormatConversionTool'));

/** Adds public file/format conversion routes while preserving the frozen 50-tool source registry. */
export function registerFileConversionTools(): void {
  const knownIds = new Set(TOOLS_REGISTRY.map((tool) => tool.id));
  for (const task of PUBLIC_FILE_CONVERSION_TASKS) {
    if (knownIds.has(task.id)) continue;
    const definition: ToolDefinition = {
      id: task.id,
      name: task.name,
      shortName: task.shortName,
      description: task.description,
      category: 'files',
      keywords: [...task.keywords, task.group, 'file converter', 'format converter'],
      iconName: 'FileText',
      route: `/${task.id}`,
      featured: task.featured,
      acceptsTextTransfer: false,
      producesTextTransfer: false,
      component: FileFormatConversionTool,
    };
    TOOLS_REGISTRY.push(definition);
    knownIds.add(task.id);
  }
}
