/**
 * Speech-to-Text Transcriber Utility & Types
 * Defines models, languages, message protocol, and timestamp formatting for local Whisper inference
 */

export interface TranscriptSegment {
  id: string;
  start: number; // in seconds
  end: number; // in seconds
  text: string;
  confidence?: number; // 0..1
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

/**
 * Worker Inbound / Outbound Message Protocol
 */
export type WorkerInboundMessage =
  | {
      type: 'LOAD_MODEL';
      modelId: string;
      device?: 'webgpu' | 'wasm' | 'cpu';
    }
  | {
      type: 'TRANSCRIBE';
      audio: Float32Array;
      modelId: string;
      language?: string;
      returnTimestamps?: boolean;
    }
  | {
      type: 'UNLOAD_MODEL';
    };

export interface ModelProgressPayload {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready';
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  modelId?: string;
}

export type WorkerOutboundMessage =
  | {
      type: 'MODEL_PROGRESS';
      data: ModelProgressPayload;
    }
  | {
      type: 'MODEL_LOADED';
      modelId: string;
      device: 'webgpu' | 'wasm' | 'cpu';
    }
  | {
      type: 'TRANSCRIBE_PROGRESS';
      progress: number; // 0..100
      elapsedTimeSec: number;
    }
  | {
      type: 'TRANSCRIBE_RESULT';
      text: string;
      segments: TranscriptSegment[];
      duration: number;
      language: string;
      deviceUsed: 'webgpu' | 'wasm' | 'cpu';
      processingTimeSec: number;
    }
  | {
      type: 'ERROR';
      error: string;
      stage: 'loading' | 'inference' | 'init';
    };

/**
 * Formats seconds into [MM:SS] or [HH:MM:SS]
 */
export function formatSpeechTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Formats transcript segments into exportable plain text with or without timestamps
 */
export function formatTranscriptToText(
  segments: TranscriptSegment[],
  includeTimestamps = true
): string {
  if (segments.length === 0) return '';
  if (!includeTimestamps) {
    return segments.map((s) => s.text.trim()).filter(Boolean).join(' ');
  }

  return segments
    .map((s) => `[${formatSpeechTimestamp(s.start)} - ${formatSpeechTimestamp(s.end)}] ${s.text.trim()}`)
    .join('\n');
}

/**
 * Converts Whisper output raw chunks into clean typed TranscriptSegment objects
 */
export function parseWhisperChunks(
  chunks: Array<{ text: string; timestamp: [number | null, number | null] }>,
  fallbackDuration = 0
): TranscriptSegment[] {
  if (!chunks || chunks.length === 0) return [];

  const parsed: TranscriptSegment[] = [];
  let lastEnd = 0;
  chunks.forEach((chunk, idx) => {
    const text = (chunk.text || '').trim();
    if (!text) return;

    let start = chunk.timestamp && chunk.timestamp[0] !== null ? chunk.timestamp[0] : lastEnd;
    let end = chunk.timestamp && chunk.timestamp[1] !== null ? chunk.timestamp[1] : start + 2.0;

    if (end < start) end = start + 1.0;
    lastEnd = end;

    parsed.push({
      id: `seg-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      text,
      confidence: 0.95,
    });
  });

  return parsed;
}

/**
 * Helper to split unstructured raw text when timestamp chunks are not available
 */
export function createTranscriptSegments(
  text: string,
  totalDuration: number
): TranscriptSegment[] {
  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [];

  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);
  let accumulatedTime = 0;

  return sentences.map((sentence, idx) => {
    const fraction = totalChars > 0 ? sentence.length / totalChars : 1 / sentences.length;
    const segmentDuration = Math.max(1, fraction * totalDuration);
    const start = accumulatedTime;
    const end = Math.min(totalDuration, start + segmentDuration);
    accumulatedTime = end;

    return {
      id: `seg-${idx}-${Date.now()}`,
      start: Number(start.toFixed(1)),
      end: Number(end.toFixed(1)),
      text: sentence,
      confidence: 0.94,
    };
  });
}
