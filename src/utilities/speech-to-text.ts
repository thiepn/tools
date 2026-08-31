/**
 * Speech-to-Text Transcriber Utility & Types
 * Defines models, languages, worker protocol, timestamps and export formats.
 */

export interface TranscriptSegment {
  id: string;
  start: number; // seconds
  end: number; // seconds
  text: string;
  confidence?: number; // 0..1 when the inference backend actually provides it
}

export interface TranscriptionResult {
  fullText: string;
  segments: TranscriptSegment[];
  duration: number;
  language: string;
  processingTimeSec?: number;
  deviceUsed?: 'webgpu' | 'wasm' | 'cpu';
}

export interface SpeechModelOption {
  id: string;
  name: string;
  repo: string;
  description: string;
  sizeLabel: string;
  approxDownloadMB: number;
  multilingual: boolean;
  quantized: boolean;
  isDefault?: boolean;
}

export const AVAILABLE_SPEECH_MODELS: SpeechModelOption[] = [
  {
    id: 'whisper-tiny-en',
    name: 'Whisper Tiny (English Fast)',
    repo: 'onnx-community/whisper-tiny.en',
    description: 'Fastest transcription for English speech with lowest memory footprint.',
    sizeLabel: '~39 MB',
    approxDownloadMB: 39,
    multilingual: false,
    quantized: true,
    isDefault: true,
  },
  {
    id: 'whisper-tiny-multi',
    name: 'Whisper Tiny (Multilingual)',
    repo: 'onnx-community/whisper-tiny',
    description: 'Supports 99+ spoken languages with lightweight download.',
    sizeLabel: '~39 MB',
    approxDownloadMB: 39,
    multilingual: true,
    quantized: true,
  },
  {
    id: 'whisper-base-en',
    name: 'Whisper Base (High Accuracy English)',
    repo: 'onnx-community/whisper-base.en',
    description: 'Higher accuracy transcription for accents and background noise.',
    sizeLabel: '~73 MB',
    approxDownloadMB: 73,
    multilingual: false,
    quantized: true,
  },
];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'id', name: 'Indonesian' },
];

export type WorkerInboundMessage =
  | { type: 'LOAD_MODEL'; modelId: string; device?: 'webgpu' | 'wasm' | 'cpu' }
  | { type: 'TRANSCRIBE'; audio: Float32Array; modelId: string; language?: string; returnTimestamps?: boolean }
  | { type: 'UNLOAD_MODEL' };

export interface ModelProgressPayload {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready';
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  modelId?: string;
}

export type WorkerOutboundMessage =
  | { type: 'MODEL_PROGRESS'; data: ModelProgressPayload }
  | { type: 'MODEL_LOADED'; modelId: string; device: 'webgpu' | 'wasm' | 'cpu' }
  | { type: 'TRANSCRIBE_PROGRESS'; progress: number; elapsedTimeSec: number }
  | {
      type: 'TRANSCRIBE_RESULT';
      text: string;
      segments: TranscriptSegment[];
      duration: number;
      language: string;
      deviceUsed: 'webgpu' | 'wasm' | 'cpu';
      processingTimeSec: number;
    }
  | { type: 'ERROR'; error: string; stage: 'loading' | 'inference' | 'init' };

export function formatSpeechTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

function formatSubtitleTimestamp(seconds: number, separator: ',' | '.'): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalMs = Math.round(safe * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  const pad2 = (value: number) => value.toString().padStart(2, '0');
  const pad3 = (value: number) => value.toString().padStart(3, '0');
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}${separator}${pad3(ms)}`;
}

export function formatTranscriptToText(
  segments: TranscriptSegment[],
  includeTimestamps = true
): string {
  if (segments.length === 0) return '';
  if (!includeTimestamps) {
    return segments.map((segment) => segment.text.trim()).filter(Boolean).join(' ');
  }

  return segments
    .filter((segment) => segment.text.trim())
    .map((segment) => `[${formatSpeechTimestamp(segment.start)} - ${formatSpeechTimestamp(segment.end)}] ${segment.text.trim()}`)
    .join('\n');
}

/** Standard SubRip subtitle export. */
export function formatTranscriptToSrt(segments: TranscriptSegment[]): string {
  return segments
    .filter((segment) => segment.text.trim())
    .map((segment, index) => {
      const start = formatSubtitleTimestamp(segment.start, ',');
      const end = formatSubtitleTimestamp(Math.max(segment.start, segment.end), ',');
      return `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}`;
    })
    .join('\n\n');
}

/** Standard WebVTT subtitle export. */
export function formatTranscriptToVtt(segments: TranscriptSegment[]): string {
  const cues = segments
    .filter((segment) => segment.text.trim())
    .map((segment) => {
      const start = formatSubtitleTimestamp(segment.start, '.');
      const end = formatSubtitleTimestamp(Math.max(segment.start, segment.end), '.');
      return `${start} --> ${end}\n${segment.text.trim()}`;
    });
  return ['WEBVTT', '', ...cues].join('\n\n');
}

export function parseWhisperChunks(
  chunks: Array<{ text: string; timestamp: [number | null, number | null] }>,
  fallbackDuration = 0
): TranscriptSegment[] {
  if (!chunks || chunks.length === 0) return [];

  const parsed: TranscriptSegment[] = [];
  let lastEnd = 0;

  chunks.forEach((chunk) => {
    const text = (chunk.text || '').trim();
    if (!text) return;

    let start = chunk.timestamp?.[0] ?? lastEnd;
    start = Math.max(lastEnd, Math.max(0, start));

    let end = chunk.timestamp?.[1] ?? start + 2;
    if (fallbackDuration > 0) end = Math.min(end, fallbackDuration);
    if (end < start) end = fallbackDuration > start ? fallbackDuration : start;
    lastEnd = end;

    parsed.push({
      id: `seg-${parsed.length + 1}`,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      text,
    });
  });

  return parsed;
}

export function createTranscriptSegments(
  text: string,
  totalDuration: number
): TranscriptSegment[] {
  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [];

  const duration = Math.max(0, Number.isFinite(totalDuration) ? totalDuration : 0);
  const totalChars = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
  let accumulatedTime = 0;

  return sentences.map((sentence, idx) => {
    const fraction = totalChars > 0 ? sentence.length / totalChars : 1 / sentences.length;
    const segmentDuration = duration > 0 ? fraction * duration : 0;
    const start = accumulatedTime;
    const end = idx === sentences.length - 1 ? duration : Math.min(duration, start + segmentDuration);
    accumulatedTime = end;

    return {
      id: `seg-${idx + 1}`,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      text: sentence,
    };
  });
}
