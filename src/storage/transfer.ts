// Pure in-memory session transfer store for privacy-first tool chaining.
// Private user data is never placed into URLs or persistent localStorage.
// Only the newest pending text/image transfer is retained so abandoned
// transfers cannot accumulate private payloads for the lifetime of the app.

interface PendingTextTransfer {
  targetToolId: string;
  text: string;
}

interface ImageTransferPayload {
  blob: Blob;
  filename?: string;
  dataUrl?: string;
}

interface PendingImageTransfer {
  targetToolId: string;
  payload: ImageTransferPayload;
}

let pendingTextTransfer: PendingTextTransfer | null = null;
let pendingImageTransfer: PendingImageTransfer | null = null;

export function setPendingTransfer(targetToolId: string, text: string): void {
  pendingTextTransfer = { targetToolId, text };
}

export function getPendingTransfer(toolId: string): string | null {
  return pendingTextTransfer?.targetToolId === toolId ? pendingTextTransfer.text : null;
}

export function clearPendingTransfer(toolId: string): void {
  if (pendingTextTransfer?.targetToolId === toolId) {
    pendingTextTransfer = null;
  }
}

export function consumePendingTransfer(toolId: string): string | null {
  if (pendingTextTransfer?.targetToolId !== toolId) {
    return null;
  }

  const text = pendingTextTransfer.text;
  pendingTextTransfer = null;
  return text;
}

export function setPendingImageTransfer(targetToolId: string, imagePayload: ImageTransferPayload): void {
  pendingImageTransfer = { targetToolId, payload: imagePayload };
}

export function consumePendingImageTransfer(toolId: string): ImageTransferPayload | null {
  if (pendingImageTransfer?.targetToolId !== toolId) {
    return null;
  }

  const payload = pendingImageTransfer.payload;
  pendingImageTransfer = null;
  return payload;
}

export function clearAllTransfers(): void {
  pendingTextTransfer = null;
  pendingImageTransfer = null;
}
