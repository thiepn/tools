import { lazy } from 'react';
import type { ToolDefinition } from '../types';
import { PUBLIC_IMAGE_TASKS } from '../image/publicImageTasks';
import { TOOLS_REGISTRY } from './tools';

const ImageMicroTools = lazy(() => import('../tools/image-micro-tools/ImageMicroTools'));

/** Adds task-specific public image workflows while preserving the frozen 50-tool source registry. */
export function registerImageMicroTools(): void {
  const knownIds = new Set(TOOLS_REGISTRY.map((tool) => tool.id));
  for (const task of PUBLIC_IMAGE_TASKS) {
    if (knownIds.has(task.id)) continue;
    const definition: ToolDefinition = {
      id: task.id,
      name: task.name,
      shortName: task.shortName,
      description: task.description,
      category: 'image',
      keywords: [...task.keywords, 'image', 'photo'],
      iconName: 'Image',
      route: `/${task.id}`,
      featured: Boolean(task.featured),
      acceptsTextTransfer: false,
      producesTextTransfer: false,
      component: ImageMicroTools,
    };
    TOOLS_REGISTRY.push(definition);
    knownIds.add(task.id);
  }
}
