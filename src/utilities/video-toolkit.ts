/**
 * Video Toolkit Utility
 * Local video trimming, transformation, cropping, speed adjustments, and dimension calculations
 */

export interface VideoMetadata {
  filename: string;
  fileSize: number;
  duration: number; // in seconds
  width: number;
  height: number;
  aspectRatio: number;
  mimeType: string;
}

export type VideoResizeMode = 'original' | '720p' | '1080p' | '50%' | '75%' | 'custom';
export type VideoCropPreset = 'free' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16';
export type VideoPlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

export interface VideoProcessingOptions {
  trimStart: number;
  trimEnd: number;
  cropPreset: VideoCropPreset;
  cropRect?: { x: number; y: number; width: number; height: number }; // normalized 0..1
  rotation: 0 | 90 | 180 | 270;
  flipHorizontal: boolean;
  flipVertical: boolean;
  resizeMode: VideoResizeMode;
  customWidth?: number;
  customHeight?: number;
  preserveAspectRatio: boolean;
  playbackSpeed: VideoPlaybackSpeed;
  muteAudio: boolean;
  volume: number; // 0..1
}

/**
 * Calculates output dimensions considering rotation, scale mode, and aspect ratio
 */
export function calculateVideoOutputDimensions(
  origWidth: number,
  origHeight: number,
  options: {
    rotation: 0 | 90 | 180 | 270;
    resizeMode: VideoResizeMode;
    customWidth?: number;
    customHeight?: number;
    preserveAspectRatio?: boolean;
    cropRect?: { x: number; y: number; width: number; height: number };
  }
): { width: number; height: number } {
  let effectiveW = origWidth;
  let effectiveH = origHeight;

  // If cropRect is provided
  if (options.cropRect && options.cropRect.width > 0 && options.cropRect.height > 0) {
    effectiveW = Math.round(origWidth * options.cropRect.width);
    effectiveH = Math.round(origHeight * options.cropRect.height);
  }

  // If rotated 90 or 270 degrees, swap dimensions
  if (options.rotation === 90 || options.rotation === 270) {
    const temp = effectiveW;
    effectiveW = effectiveH;
    effectiveH = temp;
  }

  if (effectiveW <= 0 || effectiveH <= 0) {
    return { width: 1280, height: 720 };
  }

  const aspect = effectiveW / effectiveH;

  switch (options.resizeMode) {
    case '720p': {
      if (aspect >= 1) {
        const h = Math.min(720, effectiveH);
        return { width: Math.round((h * aspect) / 2) * 2, height: h };
      } else {
        const w = Math.min(720, effectiveW);
        return { width: w, height: Math.round((w / aspect) / 2) * 2 };
      }
    }
    case '1080p': {
      if (aspect >= 1) {
        const h = Math.min(1080, effectiveH);
        return { width: Math.round((h * aspect) / 2) * 2, height: h };
      } else {
        const w = Math.min(1080, effectiveW);
        return { width: w, height: Math.round((w / aspect) / 2) * 2 };
      }
    }
    case '50%': {
      return {
        width: Math.round((effectiveW * 0.5) / 2) * 2,
        height: Math.round((effectiveH * 0.5) / 2) * 2,
      };
    }
    case '75%': {
      return {
        width: Math.round((effectiveW * 0.75) / 2) * 2,
        height: Math.round((effectiveH * 0.75) / 2) * 2,
      };
    }
    case 'custom': {
      const cW = options.customWidth && options.customWidth > 0 ? options.customWidth : effectiveW;
      const cH = options.customHeight && options.customHeight > 0 ? options.customHeight : effectiveH;
      if (options.preserveAspectRatio !== false) {
        return { width: Math.round(cW / 2) * 2, height: Math.round((cW / aspect) / 2) * 2 };
      }
      return { width: Math.round(cW / 2) * 2, height: Math.round(cH / 2) * 2 };
    }
    case 'original':
    default:
      return {
        width: Math.round(effectiveW / 2) * 2,
        height: Math.round(effectiveH / 2) * 2,
      };
  }
}

/**
 * Calculates effective output duration considering trim boundaries and playback speed
 */
export function calculateEffectiveDuration(
  trimStart: number,
  trimEnd: number,
  speed: VideoPlaybackSpeed = 1
): number {
  const safeStart = Math.max(0, trimStart);
  const safeEnd = Math.max(safeStart, trimEnd);
  const rawDuration = safeEnd - safeStart;
  return Number((rawDuration / speed).toFixed(2));
}

/**
 * Formats seconds to mm:ss or mm:ss.SS
 */
export function formatVideoTime(seconds: number, includeMs = false): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (includeMs) {
    const ms = Math.floor((seconds % 1) * 100);
    return `${pad(mins)}:${pad(secs)}.${pad(ms)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Formats byte size to human-readable string
 */
export function formatVideoFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Checks supported browser video recording mime type
 */
export function getSupportedVideoExportMime(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];

  if (typeof MediaRecorder === 'undefined') return 'video/webm';

  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return 'video/webm';
}
