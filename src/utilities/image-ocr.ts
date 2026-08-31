/** Client-side OCR powered by a reusable lazy-loaded Tesseract.js worker. */
export type OcrLanguage = 'eng' | 'deu' | 'fra' | 'spa' | 'ita' | 'por' | 'nld' | 'kor' | 'jpn';
export interface OcrResult { text: string; confidence: number; wordCount: number; charCount: number; lines: string[] }
export interface OcrProgressStatus { status: string; progress: number }

let activeWorker: any = null;
let activeWorkerLanguage: OcrLanguage | null = null;
let activeWorkerPromise: Promise<any> | null = null;
let activeProgressCallback: ((p: OcrProgressStatus) => void) | undefined;
let workerGeneration = 0;

export const SUPPORTED_OCR_LANGUAGES: { id: OcrLanguage; label: string }[] = [
  { id: 'eng', label: 'English (eng)' }, { id: 'deu', label: 'German (Deutsch)' },
  { id: 'fra', label: 'French (Français)' }, { id: 'spa', label: 'Spanish (Español)' },
  { id: 'ita', label: 'Italian (Italiano)' }, { id: 'por', label: 'Portuguese (Português)' },
  { id: 'nld', label: 'Dutch (Nederlands)' }, { id: 'kor', label: 'Korean (한국어)' },
  { id: 'jpn', label: 'Japanese (日本語)' },
];

function emitProgress(status: string, progress: number) {
  activeProgressCallback?.({ status, progress: Math.max(0, Math.min(100, Math.round(progress))) });
}
async function terminateWorker(worker: any): Promise<void> { if (worker) try { await worker.terminate(); } catch {} }
async function resetWarmWorker(): Promise<void> { const worker = activeWorker; activeWorker = null; activeWorkerLanguage = null; await terminateWorker(worker); }

async function getOrCreateWorker(language: OcrLanguage): Promise<any> {
  if (activeWorker && activeWorkerLanguage === language) return activeWorker;
  if (activeWorkerPromise && activeWorkerLanguage === language) return activeWorkerPromise;
  if (activeWorker || activeWorkerPromise) {
    workerGeneration += 1;
    const pending = activeWorkerPromise;
    await resetWarmWorker();
    if (pending) try { await terminateWorker(await pending); } catch {}
    activeWorkerPromise = null;
  }
  const generation = workerGeneration;
  activeWorkerLanguage = language;
  emitProgress('Loading OCR engine...', 10);
  const { createWorker } = await import('tesseract.js');
  emitProgress(`Initializing ${language} language model...`, 25);
  const promise = createWorker(language, 1, {
    logger: (message: any) => {
      if (message?.status === 'recognizing text') emitProgress(`Recognizing text (${Math.round((message.progress || 0) * 100)}%)...`, 45 + Math.round((message.progress || 0) * 50));
      else if (message?.status) emitProgress(`${message.status}...`, 35);
    },
  });
  activeWorkerPromise = promise;
  try {
    const worker = await promise;
    if (generation !== workerGeneration || activeWorkerLanguage !== language) { await terminateWorker(worker); throw new Error('OCR initialization was cancelled.'); }
    activeWorker = worker;
    return worker;
  } catch (error) {
    if (activeWorkerLanguage === language) activeWorkerLanguage = null;
    throw error;
  } finally { if (activeWorkerPromise === promise) activeWorkerPromise = null; }
}

/** Histogram-based document normalization. Mutates a copy and preserves alpha. */
export function preprocessOcrRgba(source: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  if (source.length !== width * height * 4 || width <= 0 || height <= 0) return new Uint8ClampedArray(source);
  const output = new Uint8ClampedArray(source);
  const histogram = new Uint32Array(256);
  const gray = new Uint8Array(width * height);
  for (let p = 0, i = 0; i < source.length; i += 4, p++) {
    const value = Math.round(0.299 * source[i] + 0.587 * source[i + 1] + 0.114 * source[i + 2]);
    gray[p] = value; histogram[value]++;
  }
  const total = gray.length;
  const percentile = (ratio: number) => {
    const target = total * ratio; let count = 0;
    for (let value = 0; value < 256; value++) { count += histogram[value]; if (count >= target) return value; }
    return ratio < 0.5 ? 0 : 255;
  };
  const low = percentile(0.01), high = Math.max(low + 16, percentile(0.99));
  const span = high - low;
  for (let p = 0, i = 0; i < output.length; i += 4, p++) {
    let value = ((gray[p] - low) * 255) / span;
    value = Math.max(0, Math.min(255, value));
    // Slight gamma lift keeps faint printed strokes while whitening paper.
    value = 255 * Math.pow(value / 255, 0.92);
    output[i] = output[i + 1] = output[i + 2] = Math.round(value);
  }
  return output;
}

async function imageSourceToCanvas(imageSource: string | HTMLCanvasElement | Blob): Promise<HTMLCanvasElement> {
  if (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement) {
    const clone = document.createElement('canvas'); clone.width = imageSource.width; clone.height = imageSource.height;
    clone.getContext('2d')?.drawImage(imageSource, 0, 0); return clone;
  }
  const url = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not decode the OCR image.')); image.src = url; });
    const naturalW = image.naturalWidth || image.width, naturalH = image.naturalHeight || image.height;
    const longEdge = Math.max(naturalW, naturalH);
    const scale = longEdge < 1400 ? Math.min(2, 1400 / Math.max(1, longEdge)) : longEdge > 3200 ? 3200 / longEdge : 1;
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(naturalW * scale)); canvas.height = Math.max(1, Math.round(naturalH * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas preprocessing is unavailable.');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height); data.data.set(preprocessOcrRgba(data.data, canvas.width, canvas.height)); ctx.putImageData(data, 0, 0);
    return canvas;
  } finally { if (typeof imageSource !== 'string') URL.revokeObjectURL(url); }
}

export async function performLocalOcr(
  imageSource: string | HTMLCanvasElement | Blob,
  language: OcrLanguage = 'eng',
  onProgress?: (p: OcrProgressStatus) => void
): Promise<OcrResult> {
  activeProgressCallback = onProgress;
  try {
    emitProgress('Preprocessing image...', 5);
    const prepared = await imageSourceToCanvas(imageSource);
    const workerWasWarm = Boolean(activeWorker && activeWorkerLanguage === language);
    const worker = await getOrCreateWorker(language);
    emitProgress(workerWasWarm ? 'Using warm OCR model...' : 'Recognizing text...', workerWasWarm ? 42 : 45);
    const result = await worker.recognize(prepared);
    emitProgress('Formatting text...', 100);
    const cleanedText = String(result.data.text || '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const words = cleanedText.split(/\s+/).filter(Boolean);
    const lines = cleanedText.split('\n').map((line: string) => line.trim()).filter(Boolean);
    return { text: cleanedText, confidence: Math.max(0, Math.min(100, Math.round(result.data.confidence || 0))), wordCount: words.length, charCount: cleanedText.length, lines };
  } catch (error) {
    await resetWarmWorker();
    throw error;
  } finally { activeProgressCallback = undefined; }
}

export async function cancelOcrWorker(): Promise<void> {
  workerGeneration += 1; activeProgressCallback = undefined;
  const pending = activeWorkerPromise; activeWorkerPromise = null; await resetWarmWorker();
  if (pending) try { await terminateWorker(await pending); } catch {}
}
