import { lazy } from 'react';
import { PUBLIC_P20_TASKS } from '../expansion/publicP20Tasks';
import { registerFamily } from './register-family';

const FinalGeneralUtilityTools = lazy(() => import('../tools/p20/FinalGeneralUtilityTools'));
const DecisionMatrixStudio = lazy(() => import('../tools/s-tier-decision/DecisionMatrixStudio'));

export function registerP20Tools(): void {
  registerFamily(PUBLIC_P20_TASKS, null, null, FinalGeneralUtilityTools, (task) => ({
    category: task.category,
    iconName: task.iconName,
    description: task.id === 'decision-matrix'
      ? 'Compare alternatives with weighted criteria, stable row identity, normalized weights, contribution breakdowns, winner margin, and leave-one-criterion-out sensitivity analysis.'
      : task.description,
    keywords: [...task.keywords, 'p20', 'final general utility', ...(task.id === 'decision-matrix' ? ['sensitivity analysis', 'winner margin', 'contribution breakdown'] : [])],
    featured: Boolean(task.featured),
    component: task.id === 'decision-matrix' ? DecisionMatrixStudio : FinalGeneralUtilityTools,
  }));
}
