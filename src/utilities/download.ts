export interface DownloadFileOptions {
  revokeDelayMs?: number;
}

const DEFAULT_REVOKE_DELAY_MS = 1500;

export function downloadBlobFile(
  filename: string,
  blob: Blob,
  options: DownloadFileOptions = {}
): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;

  let objectUrl: string | null = null;
  let anchor: HTMLAnchorElement | null = null;
  try {
    objectUrl = URL.createObjectURL(blob);
    anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    return true;
  } catch {
    return false;
  } finally {
    anchor?.remove();
    if (objectUrl) {
      const delay = Math.max(250, options.revokeDelayMs ?? DEFAULT_REVOKE_DELAY_MS);
      globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl!), delay);
    }
  }
}

export function downloadTextFile(
  filename: string,
  content: string,
  type = 'text/plain;charset=utf-8',
  options?: DownloadFileOptions
): boolean {
  return downloadBlobFile(filename, new Blob([content], { type }), options);
}
