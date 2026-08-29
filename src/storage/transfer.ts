// Pure in-memory session transfer store for privacy-first tool chaining
// Private user data is never placed into URLs or persistent localStorage

let pendingTransfers: Record<string, string> = {};
let pendingImageTransfers: Record<string, { blob: Blob; filename?: string; dataUrl?: string }> = {};

export function setPendingTransfer(targetToolId: string, text: string): void {
  pendingTransfers[targetToolId] = text;
}

export function getPendingTransfer(toolId: string): string | null {
  return pendingTransfers[toolId] || null;
}

export function clearPendingTransfer(toolId: string): void {
  delete pendingTransfers[toolId];
}

export function consumePendingTransfer(toolId: string): string | null {
  if (pendingTransfers[toolId]) {
    const text = pendingTransfers[toolId];
    delete pendingTransfers[toolId];
    return text;
  }
  return null;
}

export function setPendingImageTransfer(
  targetToolId: string,
  imagePayload: { blob: Blob; filename?: string; dataUrl?: string }
): void {
  pendingImageTransfers[targetToolId] = imagePayload;
}

export function consumePendingImageTransfer(
  toolId: string
): { blob: Blob; filename?: string; dataUrl?: string } | null {
  if (pendingImageTransfers[toolId]) {
    const payload = pendingImageTransfers[toolId];
    delete pendingImageTransfers[toolId];
    return payload;
  }
  return null;
}

export function clearAllTransfers(): void {
  pendingTransfers = {};
  pendingImageTransfers = {};
}

