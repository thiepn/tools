/**
 * Client-Side OCR / Image to Text Utility
 * Powered by lazy-loaded Tesseract.js running 100% in-browser
 */

export type OcrLanguage = 'eng' | 'deu' | 'fra' | 'spa';

export interface OcrResult {
  text: string;
  confidence: number;
  wordCount: number;
  charCount: number;
  lines: string[];
}

export interface OcrProgressStatus {
  status: string;
  progress: number; // 0 to 100
}

let activeWorker: any = null;

export const SUPPORTED_OCR_LANGUAGES: { id: OcrLanguage; label: string }[] = [
  { id: 'eng', label: 'English (eng)' },
  { id: 'deu', label: 'German (Deutsch)' },
  { id: 'fra', label: 'French (Français)' },
  { id: 'spa', label: 'Spanish (Español)' },
];

/**
 * Executes OCR on an image source locally
 */
export async function performLocalOcr(
  imageSource: string | HTMLCanvasElement | Blob,
  language: OcrLanguage = 'eng',
  onProgress?: (p: OcrProgressStatus) => void
): Promise<OcrResult> {
  onProgress?.({ status: 'Loading OCR engine...', progress: 10 });

  const { createWorker } = await import('tesseract.js');

  onProgress?.({ status: `Initializing ${language} language model...`, progress: 30 });

  // Terminate any previous worker if still lingering
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch {
      // Ignore
    }
    activeWorker = null;
  }

  const worker = await createWorker(language, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.min(99, Math.round((m.progress || 0) * 100));
        onProgress?.({ status: `Recognizing text (${pct}%)...`, progress: pct });
      } else if (m.status) {
        onProgress?.({ status: `${m.status}...`, progress: 40 });
      }
    },
  });

  activeWorker = worker;

  onProgress?.({ status: 'Recognizing text...', progress: 60 });

  const result = await worker.recognize(imageSource);

  onProgress?.({ status: 'Formatting text...', progress: 100 });

  const rawText = result.data.text || '';
  const cleanedText = rawText.replace(/\r\n/g, '\n').trim();
  const words = cleanedText.split(/\s+/).filter(Boolean);
  const lines = cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);

  // Terminate worker to free memory
  try {
    await worker.terminate();
  } catch {
    // Ignore
  }
  activeWorker = null;

  return {
    text: cleanedText,
    confidence: Math.round(result.data.confidence || 0),
    wordCount: words.length,
    charCount: cleanedText.length,
    lines,
  };
}

/**
 * Terminates active OCR worker immediately (e.g. on unmount or cancellation)
 */
export async function cancelOcrWorker(): Promise<void> {
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch {
      // Ignore
    }
    activeWorker = null;
  }
}
