/**
 * Client-Side OCR / Image to Text Utility
 * Powered by lazy-loaded Tesseract.js running in the browser.
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
let activeWorkerLanguage: OcrLanguage | null = null;
let activeWorkerPromise: Promise<any> | null = null;
let activeProgressCallback: ((p: OcrProgressStatus) => void) | undefined;
let workerGeneration = 0;

export const SUPPORTED_OCR_LANGUAGES: { id: OcrLanguage; label: string }[] = [
  { id: 'eng', label: 'English (eng)' },
  { id: 'deu', label: 'German (Deutsch)' },
  { id: 'fra', label: 'French (Français)' },
  { id: 'spa', label: 'Spanish (Español)' },
];

function emitProgress(status: string, progress: number) {
  activeProgressCallback?.({
    status,
    progress: Math.max(0, Math.min(100, Math.round(progress))),
  });
}

async function terminateWorker(worker: any): Promise<void> {
  if (!worker) return;
  try {
    await worker.terminate();
  } catch {
    // Worker teardown is best-effort; state is cleared regardless.
  }
}

async function resetWarmWorker(): Promise<void> {
  const worker = activeWorker;
  activeWorker = null;
  activeWorkerLanguage = null;
  await terminateWorker(worker);
}

/**
 * Returns a warm Tesseract worker for the requested language.
 * Repeated scans in one language reuse the expensive initialized worker instead
 * of downloading/booting it for every image. Switching language replaces it.
 */
async function getOrCreateWorker(language: OcrLanguage): Promise<any> {
  if (activeWorker && activeWorkerLanguage === language) return activeWorker;

  if (activeWorkerPromise && activeWorkerLanguage === language) {
    return activeWorkerPromise;
  }

  if (activeWorker || activeWorkerPromise) {
    workerGeneration += 1;
    const pending = activeWorkerPromise;
    await resetWarmWorker();
    if (pending) {
      try {
        const pendingWorker = await pending;
        await terminateWorker(pendingWorker);
      } catch {
        // Ignore initialization cancellation/errors while changing language.
      }
    }
    activeWorkerPromise = null;
  }

  const generation = workerGeneration;
  activeWorkerLanguage = language;
  emitProgress('Loading OCR engine...', 10);

  const { createWorker } = await import('tesseract.js');
  emitProgress(`Initializing ${language} language model...`, 30);

  const promise = createWorker(language, 1, {
    logger: (message: any) => {
      if (message?.status === 'recognizing text') {
        const pct = Math.min(99, Math.round((message.progress || 0) * 100));
        emitProgress(`Recognizing text (${pct}%)...`, pct);
      } else if (message?.status) {
        emitProgress(`${message.status}...`, 40);
      }
    },
  });
  activeWorkerPromise = promise;

  try {
    const worker = await promise;
    if (generation !== workerGeneration || activeWorkerLanguage !== language) {
      await terminateWorker(worker);
      throw new Error('OCR initialization was cancelled.');
    }
    activeWorker = worker;
    return worker;
  } catch (error) {
    if (activeWorkerLanguage === language) activeWorkerLanguage = null;
    throw error;
  } finally {
    if (activeWorkerPromise === promise) activeWorkerPromise = null;
  }
}

/** Executes OCR on an image source locally. */
export async function performLocalOcr(
  imageSource: string | HTMLCanvasElement | Blob,
  language: OcrLanguage = 'eng',
  onProgress?: (p: OcrProgressStatus) => void
): Promise<OcrResult> {
  activeProgressCallback = onProgress;

  try {
    const workerWasWarm = Boolean(activeWorker && activeWorkerLanguage === language);
    const worker = await getOrCreateWorker(language);
    emitProgress(workerWasWarm ? 'Using warm OCR model...' : 'Recognizing text...', workerWasWarm ? 45 : 60);

    const result = await worker.recognize(imageSource);
    emitProgress('Formatting text...', 100);

    const rawText = result.data.text || '';
    const cleanedText = rawText.replace(/\r\n/g, '\n').trim();
    const words = cleanedText.split(/\s+/).filter(Boolean);
    const lines = cleanedText.split('\n').map((line: string) => line.trim()).filter(Boolean);

    return {
      text: cleanedText,
      confidence: Math.max(0, Math.min(100, Math.round(result.data.confidence || 0))),
      wordCount: words.length,
      charCount: cleanedText.length,
      lines,
    };
  } catch (error) {
    // A failed inference can leave a worker in a bad state. Drop it so the next
    // explicit attempt gets a clean initialization instead of repeating failure.
    await resetWarmWorker();
    throw error;
  } finally {
    activeProgressCallback = undefined;
  }
}

/**
 * Terminates the warm OCR worker immediately (for unmount/cancellation).
 */
export async function cancelOcrWorker(): Promise<void> {
  workerGeneration += 1;
  activeProgressCallback = undefined;

  const pending = activeWorkerPromise;
  activeWorkerPromise = null;
  await resetWarmWorker();

  if (pending) {
    try {
      const worker = await pending;
      await terminateWorker(worker);
    } catch {
      // Initialization may reject because cancellation changed generation.
    }
  }
}
