import { createElement, lazy, type ComponentType } from 'react';
import { STIER_B_TARGET_SET } from '../s-tier-b/manifest';
import { TOOLS_REGISTRY } from './tools';

const MARKER = 'expert workspace';

export function applySTierBUplift(): void {
  for (const tool of TOOLS_REGISTRY) {
    if (!STIER_B_TARGET_SET.has(tool.id)) continue;
    if (tool.keywords.includes(MARKER)) continue;

    const baseComponent = tool.component;
    const toolId = tool.id;

    tool.description = `${tool.description.replace(/\s+$/, '')} Includes an expert workspace for reproducible scenarios, batch runs, sensitivity sweeps, local file inspection, validation, and live output tracing.`;
    tool.keywords = [...new Set([...tool.keywords, MARKER, 'scenario comparison', 'batch runner', 'sensitivity analysis', 'local file inspection', 'session export', 'live trace'])];

    tool.component = lazy(async () => {
      const { STierBRouteWrapper } = await import('../tools/s-tier-b/STierBRouteWrapper');
      const Wrapped: ComponentType<{ initialText?: string }> = (props) => createElement(STierBRouteWrapper, {
        toolId,
        Base: baseComponent,
        initialText: props.initialText,
      });
      return { default: Wrapped };
    });
  }
}
