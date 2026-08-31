/**
 * Text-to-Speech Utility
 * Handles text chunking, voice enumeration, duration estimation, and speech synthesis helpers
 */

export interface SpeechChunk {
  id: number;
  text: string;
  charStart: number;
  charEnd: number;
}

export interface SpeechVoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
  default: boolean;
  localService: boolean;
}

export interface SpeechOptions {
  voiceURI: string;
  rate: number; // 0.5 to 2.0
  pitch: number; // 0.5 to 1.5
  volume: number; // 0 to 1.0
}

/**
 * Enumerates browser speech synthesis voices with clean labels.
 * Stable sorting keeps the default voice first, then local voices, language and name.
 */
export function getAvailableVoices(): SpeechVoiceOption[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }

  const rawVoices = window.speechSynthesis.getVoices();
  return rawVoices
    .map((v) => ({
      name: v.name,
      lang: v.lang,
      voiceURI: v.voiceURI,
      default: v.default,
      localService: v.localService,
    }))
    .sort((a, b) => {
      if (a.default !== b.default) return a.default ? -1 : 1;
      if (a.localService !== b.localService) return a.localService ? -1 : 1;
      const byLang = a.lang.localeCompare(b.lang);
      return byLang !== 0 ? byLang : a.name.localeCompare(b.name);
    });
}

function pushChunk(
  chunks: SpeechChunk[],
  source: string,
  text: string,
  searchFrom: number
): number {
  const clean = text.trim();
  if (!clean) return searchFrom;
  const index = source.indexOf(clean, Math.max(0, searchFrom));
  const start = index >= 0 ? index : searchFrom;
  chunks.push({
    id: chunks.length,
    text: clean,
    charStart: start,
    charEnd: start + clean.length,
  });
  return start + clean.length;
}

function splitLongSpeechUnit(unit: string, maxChunkLength: number): string[] {
  if (unit.length <= maxChunkLength) return [unit];

  const words = unit.split(/\s+/).filter(Boolean);
  const pieces: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChunkLength) {
      if (current) {
        pieces.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += maxChunkLength) {
        pieces.push(word.slice(i, i + maxChunkLength));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChunkLength) {
      if (current) pieces.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) pieces.push(current);
  return pieces;
}

/**
 * Splits large text blocks into safe sentence chunks for SpeechSynthesis.
 * Unlike the previous punctuation-only matcher, this preserves trailing text
 * without punctuation, newline-delimited paragraphs, and very long single words.
 */
export function chunkTextForSpeech(text: string, maxChunkLength = 160): SpeechChunk[] {
  if (!text.trim()) return [];
  const safeMax = Math.max(20, Math.floor(maxChunkLength));
  const chunks: SpeechChunk[] = [];

  // Split at sentence whitespace or explicit newlines while retaining every
  // non-whitespace character in the source. The final sentence is preserved
  // even when it has no terminal punctuation.
  const units = text
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  let cursor = 0;
  for (const unit of units) {
    for (const piece of splitLongSpeechUnit(unit, safeMax)) {
      cursor = pushChunk(chunks, text, piece, cursor);
    }
  }

  // Defensive fallback for unusual Unicode/whitespace input.
  if (chunks.length === 0) {
    pushChunk(chunks, text, text.trim(), 0);
  }

  return chunks;
}

/**
 * Estimates speaking duration in seconds based on word count and speech rate
 */
export function estimateSpeechDuration(text: string, rate = 1.0): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  const wordsPerSecond = (140 / 60) * Math.max(0.2, rate);
  return Math.round(words / wordsPerSecond);
}

export const estimateSpeakingDuration = estimateSpeechDuration;

/**
 * Formats duration seconds into m:ss or h:mm:ss.
 */
export function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}
