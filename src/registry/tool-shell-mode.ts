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

export const LEGACY_TOOL_SHELL_ID_ALIASES: Readonly<Record<string, string>> = {
  'qr-code-studio': 'qr-studio',
  'create-pdf':'document-converter',
  'export-pdf':'document-converter',
  'csv-to-xlsx':'data-converter',
  'xlsx-to-csv':'data-converter',
  'csv-to-json':'data-converter',
  'json-to-csv':'data-converter',
  'json-to-xlsx':'data-converter',
  'xlsx-to-json':'data-converter',
  'xml-to-json':'data-converter',
  'json-to-xml':'data-converter',
  'xml-to-csv':'data-converter',
  'csv-to-xml':'data-converter',
  'yaml-json-converter':'data-converter',
  'toml-json-converter':'data-converter',
  'heic-image-converter':'image-converter',
  'avif-image-converter':'image-converter',
  'svg-to-image':'image-converter',
  'image-format-converter':'image-converter',
  'batch-image-converter':'image-converter',
  'audio-to-wav-converter':'audio-converter',
  'markdown-html-converter':'document-converter',
  'docx-to-markdown':'document-converter',
  'docx-to-html':'document-converter',
  'docx-to-text':'document-converter',
  'markdown-to-docx':'document-converter',
  'text-to-docx':'document-converter',
  'epub-to-markdown':'document-converter',
  'epub-to-html':'document-converter',
  'epub-to-text':'document-converter',
  'markdown-to-epub':'document-converter',
  'text-to-epub':'document-converter',
  'pptx-to-text':'document-converter',
  'pptx-to-markdown':'document-converter',
  'srt-to-vtt':'subtitle-converter',
  'vtt-to-srt':'subtitle-converter',
  'subtitle-to-text':'subtitle-converter',
  'transcript-to-subtitles':'subtitle-converter',
};

const RELATED_TOOLS: Record<(typeof APP_MANAGED_TOOL_IDS)[number], string[]> = {
  'barcode-studio': ['qr-studio', 'encoding-tools'],
  'watermark-maker': ['image-optimizer', 'image-annotator', 'meme-maker'],
  'signature-maker': ['image-annotator', 'document-scanner'],
  whiteboard: ['image-annotator', 'notepad'],
  teleprompter: ['notepad', 'text-to-speech'],
  'palette-extractor': ['color-converter', 'image-optimizer'],
  'calendar-event-maker': ['date-calculator', 'time-zone-converter'],
  metronome: ['audio-recorder', 'timer-stopwatch'],
  'duplicate-finder': ['batch-file-renamer', 'zip-manager'],
  'meme-maker': ['image-annotator', 'watermark-maker', 'image-optimizer'],
};

export function normalizeToolShellId(toolId: string): string {
  return LEGACY_TOOL_SHELL_ID_ALIASES[toolId] ?? toolId;
}

export function isAppManagedToolShell(toolId: string): boolean {
  return APP_MANAGED_TOOL_ID_SET.has(toolId);
}

export function getAppManagedRelatedToolIds(toolId: string): string[] {
  return isAppManagedToolShell(toolId)
    ? [...RELATED_TOOLS[toolId as (typeof APP_MANAGED_TOOL_IDS)[number]]]
    : [];
}
