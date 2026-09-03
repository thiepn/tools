import { lazy } from 'react';
import { PUBLIC_P20_TASKS } from '../expansion/publicP20Tasks';
import { registerFamily } from './register-family';

const FinalGeneralUtilityTools = lazy(() => import('../tools/p20/FinalGeneralUtilityTools'));

export function registerP20Tools(): void {
  registerFamily(PUBLIC_P20_TASKS, null, null, FinalGeneralUtilityTools, (task) => ({
    category: task.category,
    iconName: task.iconName,
    keywords: [...task.keywords, 'p20', 'final general utility'],
    featured: Boolean(task.featured),
  }));
}
