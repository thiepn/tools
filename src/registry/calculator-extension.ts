import { lazy } from 'react';
import type { ToolDefinition } from '../types';
import { PUBLIC_CALCULATOR_TASKS } from '../calculators/publicCalculatorTasks';
import { CATEGORIES, TOOLS_REGISTRY } from './tools';

const CalculatorSuiteTool = lazy(() => import('../tools/calculator-suite/CalculatorSuiteTool'));

/** Adds the config-driven public calculator family without mutating the frozen 50-tool source registry. */
export function registerCalculatorTools(): void {
  if (!CATEGORIES.some((category) => category.id === 'calculator')) {
    const timeIndex = CATEGORIES.findIndex((category) => category.id === 'time');
    const insertAt = timeIndex >= 0 ? timeIndex + 1 : CATEGORIES.length;
    CATEGORIES.splice(insertAt, 0, {
      id: 'calculator',
      label: 'Everyday Calculators',
      description: 'School, money, household, travel, construction, and general fitness calculation helpers',
    });
  }

  const knownIds = new Set(TOOLS_REGISTRY.map((tool) => tool.id));
  for (const task of PUBLIC_CALCULATOR_TASKS) {
    if (knownIds.has(task.id)) continue;
    const definition: ToolDefinition = {
      id: task.id,
      name: task.name,
      shortName: task.shortName,
      description: task.id === 'salary-hourly-calculator'
        ? 'Convert annual salary to hourly wage or hourly wage to annual, monthly, weekly, and daily equivalents in either direction.'
        : task.description,
      category: 'calculator',
      keywords: task.id === 'salary-hourly-calculator'
        ? [...task.keywords, 'annual to hourly', 'hourly to annual', 'hourly wage to salary', task.group, 'calculator']
        : [...task.keywords, task.group, 'calculator'],
      iconName: 'Percent',
      route: `/${task.id}`,
      featured: task.featured,
      acceptsTextTransfer: false,
      producesTextTransfer: false,
      component: CalculatorSuiteTool,
    };
    TOOLS_REGISTRY.push(definition);
    knownIds.add(task.id);
  }
}
