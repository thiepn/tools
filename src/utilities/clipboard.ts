export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  if (!blob) return false;
  try {
    if (navigator?.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err) {
    console.warn('Failed to copy image to clipboard:', err);
  }
  return false;
}

export async function readFromClipboard(): Promise<string> {
  try {
    if (navigator?.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {
    // Permission denied or unavailable
  }
  return '';
}

