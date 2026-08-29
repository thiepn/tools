export interface WordCounterStats {
  words: number;
  charactersWithSpaces: number;
  charactersWithoutSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  uniqueWords: number;
  averageWordLength: number;
  readingTimeSeconds: number;
  speakingTimeSeconds: number;
  longestWord: string;
  topWords: Array<{ word: string; count: number; percentage: number }>;
}

export interface WordCounterSettings {
  readingWpm: number;
  speakingWpm: number;
}

export const defaultCounterSettings: WordCounterSettings = {
  readingWpm: 200,
  speakingWpm: 130,
};

export function countWordsAndStats(
  text: string,
  settings: WordCounterSettings = defaultCounterSettings
): WordCounterStats {
  if (!text || !text.trim()) {
    return {
      words: 0,
      charactersWithSpaces: text ? text.length : 0,
      charactersWithoutSpaces: text ? text.replace(/\s/g, '').length : 0,
      sentences: 0,
      paragraphs: 0,
      lines: text ? text.split(/\r\n|\r|\n/).length : 0,
      uniqueWords: 0,
      averageWordLength: 0,
      readingTimeSeconds: 0,
      speakingTimeSeconds: 0,
      longestWord: '',
      topWords: [],
    };
  }

  const charactersWithSpaces = text.length;
  const charactersWithoutSpaces = text.replace(/\s/g, '').length;

  const lines = text.split(/\r\n|\r|\n/);
  const linesCount = lines.length;

  // Paragraphs are blocks of non-empty text separated by blank lines
  const paragraphs = text
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0).length;

  // Sentences: match ending punctuation followed by space, quote, or end of string
  const sentenceMatches = text
    .trim()
    .split(/[.!?]+(?:\s+|$|\n+)/)
    .filter((s) => s.trim().length > 0);
  const sentences = Math.max(1, sentenceMatches.length);

  // Extract words (handling Unicode words and apostrophes within words like "don't")
  const wordTokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[-']+|[-']+$/g, ''))
    .filter((w) => w.length > 0);

  const wordCount = wordTokens.length;

  // Word frequencies
  const freqMap = new Map<string, number>();
  let totalWordLetters = 0;
  let longestWord = '';

  for (const w of wordTokens) {
    totalWordLetters += w.length;
    if (w.length > longestWord.length) {
      longestWord = w;
    }
    freqMap.set(w, (freqMap.get(w) || 0) + 1);
  }

  const uniqueWords = freqMap.size;
  const averageWordLength = wordCount > 0 ? Number((totalWordLetters / wordCount).toFixed(1)) : 0;

  // Top 10 words
  const sortedFreq = Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([word, count]) => ({
      word,
      count,
      percentage: wordCount > 0 ? Number(((count / wordCount) * 100).toFixed(1)) : 0,
    }));

  // Reading / Speaking times in seconds
  const readingWpm = Math.max(10, settings.readingWpm || 200);
  const speakingWpm = Math.max(10, settings.speakingWpm || 130);

  const readingTimeSeconds = Math.ceil((wordCount / readingWpm) * 60);
  const speakingTimeSeconds = Math.ceil((wordCount / speakingWpm) * 60);

  return {
    words: wordCount,
    charactersWithSpaces,
    charactersWithoutSpaces,
    sentences,
    paragraphs: Math.max(1, paragraphs),
    lines: linesCount,
    uniqueWords,
    averageWordLength,
    readingTimeSeconds,
    speakingTimeSeconds,
    longestWord,
    topWords: sortedFreq,
  };
}

export function formatTimeEstimate(seconds: number): string {
  if (seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (remSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remSeconds}s`;
}

export const calculateWordStats = countWordsAndStats;

