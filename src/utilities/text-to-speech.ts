/** Browser-native text-to-speech helpers: voice selection, stable chunking and timing. */
export interface SpeechChunk { id: number; text: string; charStart: number; charEnd: number }
export interface SpeechVoiceOption { name: string; lang: string; voiceURI: string; default: boolean; localService: boolean }
export interface SpeechOptions { voiceURI: string; rate: number; pitch: number; volume: number }

export function getAvailableVoices(): SpeechVoiceOption[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const seen = new Set<string>();
  return window.speechSynthesis.getVoices()
    .map((voice) => ({ name: voice.name, lang: voice.lang, voiceURI: voice.voiceURI, default: voice.default, localService: voice.localService }))
    .filter((voice) => { const key = `${voice.voiceURI}\u0000${voice.lang}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .sort((a, b) => a.default !== b.default ? (a.default ? -1 : 1) : a.localService !== b.localService ? (a.localService ? -1 : 1) : a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
}

export function chooseBestVoice(voices: SpeechVoiceOption[], preferredUri = '', preferredLanguage = ''): SpeechVoiceOption | null {
  if (!voices.length) return null;
  if (preferredUri) {
    const exact = voices.find((voice) => voice.voiceURI === preferredUri);
    if (exact) return exact;
  }
  const normalized = preferredLanguage.toLowerCase().replace('_', '-');
  const primary = normalized.split('-')[0];
  const languageMatches = normalized ? voices.filter((voice) => voice.lang.toLowerCase() === normalized) : [];
  const primaryMatches = primary ? voices.filter((voice) => voice.lang.toLowerCase().split('-')[0] === primary) : [];
  return languageMatches.find((voice) => voice.localService) || languageMatches[0] || primaryMatches.find((voice) => voice.localService) || primaryMatches[0] || voices.find((voice) => voice.default) || voices[0];
}

/** Coarse script detection used only to prefer an installed voice, never to label the text definitively. */
export function inferSpeechLanguageHint(text: string, fallback = typeof navigator !== 'undefined' ? navigator.language : 'en-US'): string {
  if (/[\uac00-\ud7af]/u.test(text)) return 'ko-KR';
  if (/[\u3040-\u30ff]/u.test(text)) return 'ja-JP';
  if (/[\u4e00-\u9fff]/u.test(text)) return 'zh-CN';
  if (/[\u0400-\u04ff]/u.test(text)) return 'ru-RU';
  if (/[\u0600-\u06ff]/u.test(text)) return 'ar';
  return fallback || 'en-US';
}

function splitLongSpeechUnit(unit: string, maxChunkLength: number): string[] {
  if (unit.length <= maxChunkLength) return [unit];
  const words = unit.split(/\s+/).filter(Boolean), pieces: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > maxChunkLength) {
      if (current) { pieces.push(current); current = ''; }
      for (let i = 0; i < word.length; i += maxChunkLength) pieces.push(word.slice(i, i + maxChunkLength));
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChunkLength) { if (current) pieces.push(current); current = word; } else current = candidate;
  }
  if (current) pieces.push(current);
  return pieces;
}

/**
 * Splits text into bounded utterances while preserving exact source offsets.
 * Paragraphs and trailing unpunctuated text are retained; oversized tokens are safely split.
 */
export function chunkTextForSpeech(text: string, maxChunkLength = 160): SpeechChunk[] {
  if (!text.trim()) return [];
  const safeMax = Math.max(20, Math.floor(maxChunkLength));
  const chunks: SpeechChunk[] = [];
  const unitRegex = /[^.!?\n]+(?:[.!?]+|(?=\n|$))/gu;
  let match: RegExpExecArray | null;
  while ((match = unitRegex.exec(text)) !== null) {
    const raw = match[0];
    const leading = raw.match(/^\s*/u)?.[0].length || 0;
    const clean = raw.trim();
    if (!clean) continue;
    let searchOffset = match.index + leading;
    for (const piece of splitLongSpeechUnit(clean, safeMax)) {
      const found = text.indexOf(piece, searchOffset);
      const start = found >= 0 ? found : searchOffset;
      chunks.push({ id: chunks.length, text: piece, charStart: start, charEnd: start + piece.length });
      searchOffset = start + piece.length;
    }
  }
  if (!chunks.length) {
    const start = text.search(/\S/u);
    const clean = text.trim();
    return [{ id: 0, text: clean, charStart: Math.max(0, start), charEnd: Math.max(0, start) + clean.length }];
  }
  return chunks;
}

export function getSpeechChunkAtCharacter(chunks: SpeechChunk[], characterIndex: number): number {
  if (!chunks.length) return -1;
  const index = Math.max(0, characterIndex);
  const found = chunks.findIndex((chunk) => index >= chunk.charStart && index < chunk.charEnd);
  return found >= 0 ? found : index >= chunks[chunks.length - 1].charEnd ? chunks.length - 1 : 0;
}

export function estimateSpeechDuration(text: string, rate = 1): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  const safeRate = Math.max(0.2, Math.min(3, Number.isFinite(rate) ? rate : 1));
  return Math.round(words / ((140 / 60) * safeRate));
}
export const estimateSpeakingDuration = estimateSpeechDuration;

export function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const rounded = Math.floor(totalSeconds), hours = Math.floor(rounded / 3600), minutes = Math.floor((rounded % 3600) / 60), seconds = rounded % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
