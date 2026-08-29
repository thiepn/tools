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
 * Enumerates browser speech synthesis voices with clean labels
 */
export function getAvailableVoices(): SpeechVoiceOption[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }

  const rawVoices = window.speechSynthesis.getVoices();
  return rawVoices.map((v) => ({
    name: v.name,
    lang: v.lang,
    voiceURI: v.voiceURI,
    default: v.default,
    localService: v.localService,
  }));
}

/**
 * Splits large text blocks into safe sentence chunks for SpeechSynthesis
 */
export function chunkTextForSpeech(text: string, maxChunkLength = 160): SpeechChunk[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentenceRegex = /[^.!?\n]+[.!?\n]+/g;
  const rawMatches = trimmed.match(sentenceRegex) || [trimmed];
  const chunks: SpeechChunk[] = [];
  let currentPos = 0;

  for (const raw of rawMatches) {
    const s = raw.trim();
    if (!s) continue;

    if (s.length <= maxChunkLength) {
      const idx = text.indexOf(s, currentPos);
      chunks.push({
        id: chunks.length,
        text: s,
        charStart: idx >= 0 ? idx : currentPos,
        charEnd: (idx >= 0 ? idx : currentPos) + s.length,
      });
      currentPos = (idx >= 0 ? idx : currentPos) + s.length;
    } else {
      const words = s.split(' ');
      let currentSub = '';

      for (const word of words) {
        if ((currentSub + ' ' + word).trim().length > maxChunkLength) {
          if (currentSub) {
            const idx = text.indexOf(currentSub, currentPos);
            chunks.push({
              id: chunks.length,
              text: currentSub.trim(),
              charStart: idx >= 0 ? idx : currentPos,
              charEnd: (idx >= 0 ? idx : currentPos) + currentSub.length,
            });
            currentPos = (idx >= 0 ? idx : currentPos) + currentSub.length;
          }
          currentSub = word;
        } else {
          currentSub = currentSub ? `${currentSub} ${word}` : word;
        }
      }

      if (currentSub.trim()) {
        const idx = text.indexOf(currentSub, currentPos);
        chunks.push({
          id: chunks.length,
          text: currentSub.trim(),
          charStart: idx >= 0 ? idx : currentPos,
          charEnd: (idx >= 0 ? idx : currentPos) + currentSub.length,
        });
        currentPos = (idx >= 0 ? idx : currentPos) + currentSub.length;
      }
    }
  }

  if (chunks.length === 0 && trimmed.length > 0) {
    chunks.push({
      id: 0,
      text: trimmed,
      charStart: 0,
      charEnd: trimmed.length,
    });
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
 * Formats duration seconds into mm:ss or hh:mm:ss
 */
export function formatDurationSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
