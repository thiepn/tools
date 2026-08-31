import React, { useEffect, useRef, useState } from 'react';
import { Download, FileText, Languages, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  AccessibleDropZone,
  CopyButton,
  ToolActionBar,
  ToolStatus,
} from '../../components/tool-ui/ToolControls';
import {
  cancelOcrWorker,
  performLocalOcr,
  SUPPORTED_OCR_LANGUAGES,
  type OcrLanguage,
  type OcrResult,
} from '../../utilities/image-ocr';

export const ImageToTextTool: React.FC = () => {
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<OcrLanguage>('eng');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [outputText, setOutputText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUrlRef = useRef<string | null>(null);

  // Keep the language worker warm while this tool is open. Changing the image
  // only revokes the previous image URL; it no longer tears down Tesseract.
  useEffect(() => {
    return () => {
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
      void cancelOcrWorker();
    };
  }, []);

  const handleSetImage = (file: Blob) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
    const url = URL.createObjectURL(file);
    currentUrlRef.current = url;
    setImageBlob(file);
    setImageDataUrl(url);
    setOcrResult(null);
    setOutputText('');
    setErrorMessage(null);
    setProgressPct(0);
    setProgressStatus('');
  };

  const handleClear = () => {
    if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
    currentUrlRef.current = null;
    setImageBlob(null);
    setImageDataUrl(null);
    setOcrResult(null);
    setOutputText('');
    setErrorMessage(null);
    setProgressPct(0);
    setProgressStatus('');
  };

  const handleLoadSampleDocument = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Sample Invoice & Document OCR', 40, 60);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#334155';
    [
      'Invoice Number: INV-2026-0882',
      'Date: August 28, 2026',
      'Client: Acme International Labs',
      'Description: Full-Stack Web Development & Optimization',
      'Subtotal: $4,500.00 | VAT (20%): $900.00',
      'Total Amount Due: $5,400.00',
    ].forEach((line, index) => ctx.fillText(line, 40, 110 + index * 30));
    ctx.font = 'italic 14px sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Thank you for your business. Payment due within 14 days.', 40, 330);
    canvas.toBlob((blob) => blob && handleSetImage(blob), 'image/png');
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      for (const item of event.clipboardData?.items ?? []) {
        if (!item.type.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (file) handleSetImage(file);
        break;
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleRunOcr = async () => {
    if (!imageBlob || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus('Preparing OCR…');
    setProgressPct(5);

    try {
      const result = await performLocalOcr(imageBlob, selectedLang, (status) => {
        setProgressStatus(status.status);
        setProgressPct(status.progress);
      });
      setOcrResult(result);
      setOutputText(result.text);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'OCR failed for this image.');
      setProgressStatus('Recognition failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `extracted-ocr-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const wordCount = outputText.trim() ? outputText.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <ToolShell
      toolId="image-to-text"
      title="Image to Text / OCR"
      description="Extract editable text from images locally with a reusable in-browser OCR worker. Language data may download when first used."
      category="productivity"
      relatedToolIds={['text-cleaner', 'word-counter', 'text-to-speech']}
      outputToTransfer={outputText}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {imageDataUrl ? 'Change image' : 'Select image'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleSetImage(file); event.target.value = ''; }} />
            {!imageDataUrl && (
              <button type="button" onClick={handleLoadSampleDocument} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Load sample
              </button>
            )}
            {imageDataUrl && (
              <button type="button" onClick={handleClear} disabled={isProcessing} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Clear
              </button>
            )}
          </div>

          <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            <span className="mb-1 flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" aria-hidden="true" /> OCR language</span>
            <select value={selectedLang} onChange={(event) => setSelectedLang(event.target.value as OcrLanguage)} disabled={isProcessing} className="rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900">
              {SUPPORTED_OCR_LANGUAGES.map((language) => <option key={language.id} value={language.id}>{language.label}</option>)}
            </select>
          </label>
        </div>

        {!imageDataUrl && (
          <AccessibleDropZone
            ariaLabel="Select or drop an image for OCR"
            onActivate={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) handleSetImage(file); }}
            className="rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-10 text-center hover:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950"
          >
            <FileText className="mx-auto h-8 w-8 text-blue-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Drop a screenshot, scan, or photo</p>
            <p className="mt-1 text-xs text-neutral-500">JPEG, PNG, WebP, or paste an image with Ctrl/Cmd+V.</p>
            <p className="mt-3 text-[11px] text-neutral-400">Image content stays in this browser. OCR runtime/language assets may download on first use.</p>
          </AccessibleDropZone>
        )}

        {errorMessage && <ToolStatus tone="error">{errorMessage}</ToolStatus>}

        {imageDataUrl && (
          <>
            {isProcessing && (
              <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/40" role="status" aria-live="polite">
                <div className="flex justify-between gap-3 text-xs font-medium text-blue-900 dark:text-blue-200"><span>{progressStatus}</span><span className="font-mono">{progressPct}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900"><div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${progressPct}%` }} /></div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Source image</div>
                <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 p-3">
                  <img src={imageDataUrl} alt="OCR source" className="max-h-[440px] max-w-full rounded object-contain" />
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Recognized text</span>
                  {ocrResult && <ToolStatus tone="success">{ocrResult.confidence}% confidence</ToolStatus>}
                </div>
                <textarea value={outputText} onChange={(event) => setOutputText(event.target.value)} rows={16} spellCheck={false} placeholder="Recognized text will appear here." aria-label="Recognized OCR text" className="min-h-72 w-full flex-1 resize-y rounded-lg border border-neutral-300 bg-white p-3 font-mono text-sm text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100" />
                <div className="text-[11px] text-neutral-500">{wordCount.toLocaleString()} words · {outputText.length.toLocaleString()} characters</div>
              </div>
            </div>

            <ToolActionBar align="between">
              <button type="button" onClick={handleRunOcr} disabled={isProcessing || !imageBlob} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                {ocrResult ? 'Run OCR again' : 'Extract text'}
              </button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <CopyButton value={outputText} label="Copy text" />
                <button type="button" onClick={handleDownload} disabled={!outputText} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download .txt
                </button>
              </div>
            </ToolActionBar>
          </>
        )}
      </div>
    </ToolShell>
  );
};

export default ImageToTextTool;
