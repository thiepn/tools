import type { ToolCategory } from '../types';

export type P20Mode =
  | 'decision-matrix'
  | 'budget-planner'
  | 'number-words'
  | 'screen-ppi'
  | 'download-time'
  | 'palette-generator'
  | 'habit-tracker'
  | 'eisenhower';

export interface PublicP20Task {
  id: string;
  name: string;
  shortName: string;
  description: string;
  keywords: string[];
  mode: P20Mode;
  category: ToolCategory;
  iconName: string;
  featured?: boolean;
}

type Raw = [
  id: string,
  name: string,
  shortName: string,
  description: string,
  keywords: string,
  mode: P20Mode,
  category: ToolCategory,
  iconName: string,
  featured?: boolean,
];

const RAW: Raw[] = [
  [
    'decision-matrix',
    'Weighted Decision Matrix',
    'Decision Matrix',
    'Compare options across weighted criteria, normalize the weights, rank the results, and inspect each criterion contribution locally.',
    'decision matrix|weighted decision matrix|compare options|choice calculator|criteria scoring|decision analysis|rank alternatives',
    'decision-matrix',
    'productivity',
    'Scale',
    true,
  ],
  [
    'monthly-budget-planner',
    'Monthly Budget Planner',
    'Budget Planner',
    'Plan monthly income and categorized expenses, then calculate remaining cash, savings rate, and category shares without an account.',
    'budget planner|monthly budget|income expenses|spending plan|personal budget|expense budget|money planner',
    'budget-planner',
    'everyday',
    'Tag',
    true,
  ],
  [
    'number-words-converter',
    'Number ↔ Words Converter',
    'Number ↔ Words',
    'Convert signed numbers to English words or parse standard English number words back into a numeric value entirely in the browser.',
    'number to words|words to number|spell number|write number in words|amount in words|english number converter',
    'number-words',
    'text',
    'Type',
    true,
  ],
  [
    'screen-ppi-calculator',
    'Screen PPI & Pixel Density Calculator',
    'Screen PPI',
    'Calculate display pixel density, pixel pitch, megapixels, and simplified aspect ratio from resolution and physical diagonal size.',
    'ppi calculator|pixel density|screen ppi|pixel pitch|monitor ppi|display density|resolution diagonal',
    'screen-ppi',
    'calculator',
    'Monitor',
    true,
  ],
  [
    'download-time-calculator',
    'Download & Transfer Time Calculator',
    'Transfer Time',
    'Estimate file transfer duration from a file size and connection throughput using decimal, binary, bit-rate, or byte-rate units.',
    'download time calculator|transfer time|file download time|upload time|mbps file size|network speed calculator',
    'download-time',
    'calculator',
    'Clock',
    true,
  ],
  [
    'color-palette-generator',
    'Color Palette & Harmony Generator',
    'Palette Generator',
    'Generate complementary, analogous, triadic, tetradic, split-complementary, and monochromatic palettes from a base color.',
    'color palette generator|color harmony|complementary colors|analogous colors|triadic palette|hex palette|design colors',
    'palette-generator',
    'design',
    'Palette',
    true,
  ],
  [
    'habit-consistency-tracker',
    'Habit Consistency Tracker',
    'Habit Tracker',
    'Track one habit across recent days, calculate current and best streaks plus completion rate, and keep the data only in this browser.',
    'habit tracker|streak tracker|habit calendar|consistency tracker|daily habit|completion streak',
    'habit-tracker',
    'productivity',
    'CalendarDays',
    true,
  ],
  [
    'eisenhower-matrix',
    'Eisenhower Priority Matrix',
    'Priority Matrix',
    'Sort tasks into urgent/important quadrants and export a concise do, schedule, delegate, and eliminate action plan locally.',
    'eisenhower matrix|priority matrix|urgent important|task prioritization|do schedule delegate eliminate|priority planner',
    'eisenhower',
    'productivity',
    'LayoutGrid',
    true,
  ],
];

export const PUBLIC_P20_TASKS: PublicP20Task[] = RAW.map(
  ([id, name, shortName, description, keys, mode, category, iconName, featured]) => ({
    id,
    name,
    shortName,
    description,
    keywords: keys.split('|'),
    mode,
    category,
    iconName,
    featured: Boolean(featured),
  })
);

export function getPublicP20Task(id: string | null | undefined) {
  return id ? PUBLIC_P20_TASKS.find((task) => task.id === id) : undefined;
}
