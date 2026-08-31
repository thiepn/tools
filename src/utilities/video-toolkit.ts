/** Local video transformation and render-planning helpers. */
export interface VideoMetadata { filename: string; fileSize: number; duration: number; width: number; height: number; aspectRatio: number; mimeType: string }
export type VideoResizeMode = 'original' | '720p' | '1080p' | '50%' | '75%' | 'custom';
export type VideoCropPreset = 'free' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16';
export type VideoPlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
export type VideoQualityPreset = 'compact' | 'balanced' | 'high';
export interface VideoProcessingOptions {
  trimStart: number; trimEnd: number; cropPreset: VideoCropPreset; cropRect?: { x: number; y: number; width: number; height: number };
  rotation: 0 | 90 | 180 | 270; flipHorizontal: boolean; flipVertical: boolean; resizeMode: VideoResizeMode;
  customWidth?: number; customHeight?: number; preserveAspectRatio: boolean; playbackSpeed: VideoPlaybackSpeed; muteAudio: boolean; volume: number;
}

export function calculateVideoOutputDimensions(origWidth: number, origHeight: number, options: { rotation: 0 | 90 | 180 | 270; resizeMode: VideoResizeMode; customWidth?: number; customHeight?: number; preserveAspectRatio?: boolean; cropRect?: { x: number; y: number; width: number; height: number } }): { width: number; height: number } {
  let width = Math.max(1, origWidth), height = Math.max(1, origHeight);
  if (options.cropRect && options.cropRect.width > 0 && options.cropRect.height > 0) { width = Math.max(1, Math.round(width * options.cropRect.width)); height = Math.max(1, Math.round(height * options.cropRect.height)); }
  if (options.rotation === 90 || options.rotation === 270) [width, height] = [height, width];
  const aspect = width / height;
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
  switch (options.resizeMode) {
    case '720p': if (aspect >= 1) { const h = Math.min(720, height); return { width: even(h * aspect), height: even(h) }; } else { const w = Math.min(720, width); return { width: even(w), height: even(w / aspect) }; }
    case '1080p': if (aspect >= 1) { const h = Math.min(1080, height); return { width: even(h * aspect), height: even(h) }; } else { const w = Math.min(1080, width); return { width: even(w), height: even(w / aspect) }; }
    case '50%': return { width: even(width * 0.5), height: even(height * 0.5) };
    case '75%': return { width: even(width * 0.75), height: even(height * 0.75) };
    case 'custom': {
      const customWidth = options.customWidth && options.customWidth > 0 ? options.customWidth : width;
      const customHeight = options.customHeight && options.customHeight > 0 ? options.customHeight : height;
      return options.preserveAspectRatio === false ? { width: even(customWidth), height: even(customHeight) } : { width: even(customWidth), height: even(customWidth / aspect) };
    }
    default: return { width: even(width), height: even(height) };
  }
}

export function normalizeVideoTrimRange(start: number, end: number, duration: number, minDuration = 0.05): { start: number; end: number; duration: number } {
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const safeStart = Math.max(0, Math.min(safeDuration, Number.isFinite(start) ? start : 0));
  const safeEnd = Math.max(safeStart, Math.min(safeDuration, Number.isFinite(end) ? end : safeDuration));
  const adjustedEnd = safeDuration > 0 ? Math.min(safeDuration, Math.max(safeEnd, safeStart + Math.min(minDuration, safeDuration - safeStart))) : 0;
  return { start: safeStart, end: adjustedEnd, duration: Math.max(0, adjustedEnd - safeStart) };
}

export function calculateEffectiveDuration(trimStart: number, trimEnd: number, speed: VideoPlaybackSpeed = 1): number {
  const rawDuration = Math.max(0, trimEnd - Math.max(0, trimStart)); return Number((rawDuration / Math.max(0.1, speed)).toFixed(2));
}

/** Pixel-rate based bitrate plan with bounded values suitable for MediaRecorder. */
export function calculateRecommendedVideoBitrate(width: number, height: number, fps: number, quality: VideoQualityPreset = 'balanced'): number {
  const safeWidth = Math.max(2, width), safeHeight = Math.max(2, height), safeFps = Math.max(1, Math.min(60, fps));
  const bitsPerPixelFrame = quality === 'compact' ? 0.055 : quality === 'high' ? 0.12 : 0.08;
  const estimated = safeWidth * safeHeight * safeFps * bitsPerPixelFrame;
  return Math.round(Math.max(750_000, Math.min(20_000_000, estimated)) / 50_000) * 50_000;
}

export function chooseVideoRenderFps(sourceHint: number | null | undefined, quality: VideoQualityPreset = 'balanced'): number {
  const source = Number.isFinite(sourceHint) && (sourceHint || 0) > 0 ? Number(sourceHint) : 30;
  const cap = quality === 'compact' ? 24 : quality === 'high' ? 60 : 30;
  return Math.max(12, Math.min(cap, Math.round(source)));
}

export function formatVideoTime(seconds: number, includeMs = false): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60), secs = Math.floor(seconds % 60), pad = (n: number) => n.toString().padStart(2, '0');
  if (includeMs) return `${pad(mins)}:${pad(secs)}.${pad(Math.floor((seconds % 1) * 100))}`;
  return `${pad(mins)}:${pad(secs)}`;
}
export function formatVideoFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))); return `${parseFloat((bytes / 1024 ** i).toFixed(2))} ${sizes[i]}`;
}
export function getSupportedVideoExportMime(): string {
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4'];
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/webm';
}
