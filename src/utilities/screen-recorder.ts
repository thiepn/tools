/**
 * Screen Recorder Utility
 * Browser-native screen and audio recording with clean MediaStream lifecycle
 */

export interface RecordingMeta {
  blob: Blob;
  url: string;
  durationSeconds: number;
  mimeType: string;
  sizeBytes: number;
  recordedAt: Date;
}

/**
 * Detects the most optimal supported MIME type in the current browser
 */
export function getSupportedVideoMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return 'video/webm';
  }

  const candidateTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
  ];

  for (const type of candidateTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'video/webm';
}

/**
 * Formats duration in seconds to mm:ss or hh:mm:ss
 */
export function formatRecordingDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');

  if (hrs > 0) {
    const hh = String(hrs).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Formats file size in bytes to human-readable string
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Generates standardized recording filename
 */
export function generateRecordingFilename(mimeType = 'video/webm'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');

  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  return `screen-recording-${year}-${month}-${day}-${hours}${mins}.${ext}`;
}

/**
 * Stops all tracks in given MediaStream(s)
 */
export function stopAllMediaTracks(...streams: (MediaStream | null | undefined)[]): void {
  for (const s of streams) {
    if (s && s.getTracks) {
      s.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
    }
  }
}
