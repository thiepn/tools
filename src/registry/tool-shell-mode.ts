export const APP_MANAGED_TOOL_IDS = [
  'barcode-studio',
  'watermark-maker',
  'signature-maker',
  'whiteboard',
  'teleprompter',
  'palette-extractor',
  'calendar-event-maker',
  'metronome',
  'duplicate-finder',
  'meme-maker',
] as const;

const APP_MANAGED_TOOL_ID_SET = new Set<string>(APP_MANAGED_TOOL_IDS);

const RELATED_TOOLS: Record<(typeof APP_MANAGED_TOOL_IDS)[number], string[]> = {
  'barcode-studio': ['qr-studio', 'encoding-tools'],
  'watermark-maker': ['image-optimizer', 'image-annotator', 'meme-maker'],
  'signature-maker': ['image-annotator', 'document-scanner'],
  whiteboard: ['image-annotator', 'quick-notepad'],
  teleprompter: ['quick-notepad', 'text-to-speech'],
  'palette-extractor': ['color-converter', 'image-optimizer'],
  'calendar-event-maker': ['date-calculator', 'time-zone-converter'],
  metronome: ['audio-recorder', 'timer-stopwatch'],
  'duplicate-finder': ['batch-file-renamer', 'zip-manager'],
  'meme-maker': ['image-annotator', 'watermark-maker', 'image-optimizer'],
};

export function isAppManagedToolShell(toolId: string): boolean {
  return APP_MANAGED_TOOL_ID_SET.has(toolId);
}

export function getAppManagedRelatedToolIds(toolId: string): string[] {
  return isAppManagedToolShell(toolId)
    ? [...RELATED_TOOLS[toolId as (typeof APP_MANAGED_TOOL_IDS)[number]]]
    : [];
}
