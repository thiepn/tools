/**
 * Teleprompter Utilities & Calculations
 */

export interface TeleprompterConfig {
  speed: number; // 1 to 100
  fontSize: number; // in pixels (e.g. 24 to 72)
  lineHeight: number; // 1.2 to 2.2
  textColor: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  isMirrored: boolean;
  showFocusGuide: boolean;
  marginWidthPercent: number; // 50% to 100%
}

export const DEFAULT_TELEPROMPTER_CONFIG: TeleprompterConfig = {
  speed: 25,
  fontSize: 44,
  lineHeight: 1.6,
  textColor: '#ffffff',
  backgroundColor: '#09090b',
  textAlign: 'center',
  isMirrored: false,
  showFocusGuide: true,
  marginWidthPercent: 85,
};

/**
 * Calculates word count and speaking duration in seconds
 */
export function calculateSpeakingStats(text: string, wpm = 140): {
  wordCount: number;
  estimatedSeconds: number;
  formattedDuration: string;
} {
  const clean = text.trim();
  if (!clean) {
    return { wordCount: 0, estimatedSeconds: 0, formattedDuration: '0s' };
  }

  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const estimatedMinutes = wordCount / wpm;
  const estimatedSeconds = Math.round(estimatedMinutes * 60);

  const mins = Math.floor(estimatedSeconds / 60);
  const secs = estimatedSeconds % 60;
  const formattedDuration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return {
    wordCount,
    estimatedSeconds,
    formattedDuration,
  };
}

/**
 * Maps speed (1..100) to pixels per frame at ~60fps
 */
export function calculateScrollStep(speed: number): number {
  // Speed 1 -> 0.25 px/frame; Speed 50 -> 2.5 px/frame; Speed 100 -> 8.0 px/frame
  if (speed <= 0) return 0;
  const normalized = Math.max(1, Math.min(100, speed));
  return 0.2 + (normalized / 100) ** 1.5 * 7.8;
}
