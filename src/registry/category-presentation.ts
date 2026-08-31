import type { ToolCategory } from '../types';

export interface CategoryPresentation {
  label: string;
  shortLabel: string;
  description: string;
  searchTerms: string[];
  badge: {
    bg: string;
    text: string;
    border: string;
  };
}

// General-purpose categories come first so the catalog reads like an everyday
// utility suite rather than a developer toolbox. PDF and device diagnostics are
// first-class public families because both map directly to common utility-site intents.
export const CATEGORY_ORDER: ToolCategory[] = [
  'productivity',
  'pdf',
  'image',
  'text',
  'files',
  'media',
  'device',
  'time',
  'everyday',
  'math',
  'design',
  'developer',
];

export const CATEGORY_PRESENTATION: Record<ToolCategory, CategoryPresentation> = {
  productivity: {
    label: 'Productivity & Office',
    shortLabel: 'Productivity',
    description: 'Notes, checklists, scanning, speech, planning, and practical work helpers.',
    searchTerms: ['productivity', 'office', 'work', 'notes', 'planning', 'documents'],
    badge: {
      bg: 'bg-cyan-50 dark:bg-cyan-950/40',
      text: 'text-cyan-700 dark:text-cyan-300',
      border: 'border-cyan-200 dark:border-cyan-800',
    },
  },
  pdf: {
    label: 'PDF Tools',
    shortLabel: 'PDF',
    description: 'Merge, split, compress, edit, scan, OCR, sign, protect, organize, and export PDFs locally.',
    searchTerms: ['pdf', 'document', 'documents', 'acrobat', 'merge pdf', 'split pdf', 'compress pdf', 'scan pdf'],
    badge: {
      bg: 'bg-red-50 dark:bg-red-950/40',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200 dark:border-red-800',
    },
  },
  image: {
    label: 'Images & Photos',
    shortLabel: 'Images',
    description: 'Resize, clean up, combine, annotate, scan, and export images locally.',
    searchTerms: ['image', 'images', 'photo', 'photos', 'picture', 'pictures', 'graphics'],
    badge: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800',
    },
  },
  text: {
    label: 'Text & Writing',
    shortLabel: 'Text',
    description: 'Clean, count, compare, transform, and organize text.',
    searchTerms: ['text', 'writing', 'words', 'copy', 'content'],
    badge: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
  },
  files: {
    label: 'Files & Archives',
    shortLabel: 'Files',
    description: 'Rename, package, inspect, compare, and organize local files.',
    searchTerms: ['files', 'file', 'archive', 'archives', 'zip', 'folders'],
    badge: {
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-200 dark:border-orange-800',
    },
  },
  media: {
    label: 'Media & Audio',
    shortLabel: 'Media',
    description: 'Record, trim, edit, convert, and create audio or video media.',
    searchTerms: ['media', 'audio', 'video', 'recording', 'music', 'voice'],
    badge: {
      bg: 'bg-pink-50 dark:bg-pink-950/40',
      text: 'text-pink-700 dark:text-pink-300',
      border: 'border-pink-200 dark:border-pink-800',
    },
  },
  device: {
    label: 'Device Diagnostics',
    shortLabel: 'Diagnostics',
    description: 'Test cameras, microphones, speakers, displays, keyboards, mice, touchscreens, controllers, and browser-exposed hardware status.',
    searchTerms: ['device', 'hardware', 'diagnostic', 'diagnostics', 'test hardware', 'microphone test', 'webcam test', 'keyboard test', 'mouse test', 'monitor test', 'controller test'],
    badge: {
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      text: 'text-sky-700 dark:text-sky-300',
      border: 'border-sky-200 dark:border-sky-800',
    },
  },
  time: {
    label: 'Time & Dates',
    shortLabel: 'Time',
    description: 'Dates, time zones, timers, calendars, and scheduling helpers.',
    searchTerms: ['time', 'date', 'dates', 'calendar', 'schedule', 'clock'],
    badge: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
    },
  },
  everyday: {
    label: 'Everyday Helpers',
    shortLabel: 'Everyday',
    description: 'Quick utilities for common daily tasks such as QR codes and comparisons.',
    searchTerms: ['everyday', 'daily', 'practical', 'quick', 'helper', 'helpers'],
    badge: {
      bg: 'bg-teal-50 dark:bg-teal-950/40',
      text: 'text-teal-700 dark:text-teal-300',
      border: 'border-teal-200 dark:border-teal-800',
    },
  },
  math: {
    label: 'Math & Conversion',
    shortLabel: 'Math',
    description: 'Percentages, measurements, unit conversion, pricing, and arithmetic.',
    searchTerms: ['math', 'calculator', 'calculation', 'convert', 'conversion', 'numbers'],
    badge: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
    },
  },
  design: {
    label: 'Design & Visuals',
    shortLabel: 'Design',
    description: 'Colors, contrast, dimensions, palettes, and visual layout helpers.',
    searchTerms: ['design', 'visual', 'visuals', 'color', 'layout', 'graphics'],
    badge: {
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
    },
  },
  developer: {
    label: 'Developer Utilities',
    shortLabel: 'Developer',
    description: 'JSON, regex, encoding, secure generators, and technical text workflows.',
    searchTerms: ['developer', 'development', 'coding', 'code', 'programming', 'technical'],
    badge: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-200 dark:border-indigo-800',
    },
  },
};

export function getCategoryPresentation(category: ToolCategory): CategoryPresentation {
  return CATEGORY_PRESENTATION[category];
}
