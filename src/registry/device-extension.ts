import { lazy } from 'react';
import type { ToolDefinition } from '../types';
import { PUBLIC_DEVICE_TASKS } from '../device/publicDeviceTasks';
import { CATEGORIES, TOOLS_REGISTRY } from './tools';

const DeviceDiagnosticsTool = lazy(() => import('../tools/device-diagnostics/DeviceDiagnosticsTool'));

/** Adds the native browser device-diagnostics family without mutating the frozen 50-tool source registry. */
export function registerDeviceDiagnosticTools(): void {
  if (!CATEGORIES.some((category) => category.id === 'device')) {
    const mediaIndex = CATEGORIES.findIndex((category) => category.id === 'media');
    const insertAt = mediaIndex >= 0 ? mediaIndex + 1 : CATEGORIES.length;
    CATEGORIES.splice(insertAt, 0, {
      id: 'device',
      label: 'Device Diagnostics',
      description: 'Test microphones, cameras, displays, input devices, controllers, audio output, and browser-exposed hardware status',
    });
  }

  const knownIds = new Set(TOOLS_REGISTRY.map((tool) => tool.id));
  for (const task of PUBLIC_DEVICE_TASKS) {
    if (knownIds.has(task.id)) continue;
    const definition: ToolDefinition = {
      id: task.id,
      name: task.name,
      shortName: task.shortName,
      description: task.description,
      category: 'device',
      keywords: task.keywords,
      iconName: 'Monitor',
      route: `/${task.id}`,
      featured: task.featured,
      acceptsTextTransfer: false,
      producesTextTransfer: false,
      component: DeviceDiagnosticsTool,
    };
    TOOLS_REGISTRY.push(definition);
    knownIds.add(task.id);
  }
}
