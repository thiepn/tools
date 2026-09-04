import { createElement, lazy, type ComponentType } from 'react';
import { STIER_A_TARGET_SET } from '../s-tier-a/manifest';
import { TOOLS_REGISTRY } from './tools';

const MARKER = 'professional qa console';

export function applySTierAUplift(): void {
  for (const tool of TOOLS_REGISTRY) {
    if (!STIER_A_TARGET_SET.has(tool.id)) continue;
    if (tool.keywords.includes(MARKER)) continue;

    const baseComponent = tool.component;
    const toolId = tool.id;

    tool.description = `${tool.description.replace(/\s+$/, '')} Includes expert scenarios plus a professional QA console for reproducibility fingerprints, control-level validation, repeatability checks, and exportable reports.`;
    tool.keywords = [...new Set([
      ...tool.keywords,
      'expert workspace',
      'scenario comparison',
      'batch runner',
      'sensitivity analysis',
      'local file inspection',
      'live trace',
      MARKER,
      'reproducibility fingerprint',
      'quality report',
      'control map',
      'repeatability check',
      'markdown report',
    ])];

    tool.component = lazy(async () => {
      const { STierARouteWrapper } = await import('../tools/s-tier-a/STierARouteWrapper');
      const Wrapped: ComponentType<{ initialText?: string }> = (props) => createElement(STierARouteWrapper, {
        toolId,
        Base: baseComponent,
        initialText: props.initialText,
      });
      return { default: Wrapped };
    });
  }
}
