import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Copy,
  Check,
  Download,
  FileText,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Languages,
  CheckCheck,
  Share2,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  performLocalOcr,
  cancelOcrWorker,
  SUPPORTED_OCR_LANGUAGES,
  OcrLanguage,
  OcrResult,
} from '../../utilities/image-ocr';
import { copyToClipboard } from '../../utilities/clipboard';
import { setPendingTransfer } from '../../storage/transfer';

export const ImageToTextTool: React.FC = () => {
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<OcrLanguage>('eng');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);

  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [outputText, setOutputText] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Terminate any active worker on unmount
  useEffect(() => {
    return () => {
      cancelOcrWorker();
      if (imageDataUrl) URL.revokeObjectURL(imageDataUrl);
    };
  }, [imageDataUrl]);

  const handleSetImage = (file: Blob) => {
    const url = URL.createObjectURL(file);
    setImageBlob(file);
    setImageDataUrl(url);
    setOcrResult(null);
    setOutputText('');
  };

  // Load sample text image
  const handleLoadSampleDocument = () => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 400;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 800, 400);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('Sample Invoice & Document OCR', 40, 60);

      ctx.font = '16px monospace';
      ctx.fillStyle = '#334155';
      ctx.fillText('Invoice Number: INV-2026-0882', 40, 110);
      ctx.fillText('Date: August 28, 2026', 40, 140);
      ctx.fillText('Client: Acme International Labs', 40, 170);
      ctx.fillText('Description: Full-Stack Web Development & Optimization', 40, 200);
      ctx.fillText('Subtotal: $4,500.00 | VAT (20%): $900.00', 40, 240);
      ctx.fillText('Total Amount Due: $5,400.00', 40, 270);

      ctx.font = 'italic 14px sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText('Thank you for your business. Payment due within 14 days.', 40, 330);
    }

    c.toBlob((blob) => {
      if (blob) handleSetImage(blob);
    }, 'image/png');
  };

  // Clipboard paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) handleSetImage(f);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleRunOcr = async () => {
    if (!imageBlob) return;
    setIsProcessing(true);
    setProgressStatus('Initializing OCR engine...');
    setProgressPct(5);

    try {
      const result = await performLocalOcr(imageBlob, selectedLang, (status) => {
        setProgressStatus(status.status);
        setProgressPct(status.progress);
      });

      setOcrResult(result);
      setOutputText(result.text);
    } catch (err) {
      console.error('OCR Error:', err);
      setProgressStatus('Recognition failed or unreadable image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!outputText) return;
    const ok = await copyToClipboard(outputText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadTxt = () => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `extracted-ocr-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendToTool = (targetToolId: string) => {
    if (!outputText) return;
    setPendingTransfer(targetToolId, outputText);
    window.location.hash = `#/tool/${targetToolId}`;
  };

  return (
    <ToolShell
      toolId="image-to-text"
      title="Image to Text / OCR"
      description="Extract selectable text from images, photos, and screenshots locally using in-browser optical character recognition."
      category="productivity"
      relatedToolIds={['text-cleaner', 'word-counter', 'text-to-speech']}
      outputToTransfer={outputText}
    >
      <div className="space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-2xs inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{imageDataUrl ? 'Change Image' : 'Select Image'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleSetImage(e.target.files[0]);
                }
                e.target.value = '';
              }}
            />

            {!imageDataUrl && (
              <button
                type="button"
                onClick={handleLoadSampleDocument}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Load Sample Document</span>
              </button>
            )}

            {imageDataUrl && (
              <button
                type="button"
                onClick={() => {
                  setImageBlob(null);
                  setImageDataUrl(null);
                  setOcrResult(null);
                  setOutputText('');
                }}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <Languages className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value as OcrLanguage)}
                className="px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
              >
                {SUPPORTED_OCR_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {imageDataUrl && !ocrResult && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleRunOcr}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Recognizing...' : 'Extract Text'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Empty Dropzone */}
        {!imageDataUrl && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleSetImage(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className="p-12 border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 text-center cursor-pointer transition-colors space-y-3"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Drop Screenshot or Image for Local OCR
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Supports JPEG, PNG, and WebP (or paste directly from clipboard with Ctrl+V)
              </p>
            </div>
            <div className="pt-2 flex justify-center items-center gap-2 text-xs text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>100% In-Browser OCR. Images are never uploaded anywhere.</span>
            </div>
          </div>
        )}

        {/* Loaded Image & Processing Display */}
        {imageDataUrl && (
          <div className="space-y-4">
            {/* Progress Bar */}
            {isProcessing && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between text-blue-900 dark:text-blue-200 font-medium">
                  <span>{progressStatus}</span>
                  <span className="font-mono">{progressPct}%</span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-900/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Image Preview */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Input Image
                </span>
                <div className="p-3 bg-neutral-900 rounded-xl flex items-center justify-center min-h-[300px] max-h-[480px] overflow-hidden border border-neutral-800">
                  <img
                    src={imageDataUrl}
                    alt="Source"
                    className="max-h-[440px] max-w-full object-contain rounded shadow"
                  />
                </div>
              </div>

              {/* Right: OCR Text Output Area */}
              <div className="space-y-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Recognized Text Output
                  </span>
                  {ocrResult && (
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      Confidence: {ocrResult.confidence}%
                    </span>
                  )}
                </div>

                <div className="flex-1 min-h-[280px]">
                  <textarea
                    ref={textAreaRef}
                    value={outputText}
                    onChange={(e) => setOutputText(e.target.value)}
                    placeholder={
                      isProcessing
                        ? 'Extracting text locally in browser...'
                        : 'Extracted text will appear here. Click "Extract Text" above to begin OCR.'
                    }
                    className="w-full h-full min-h-[260px] p-3 text-xs sm:text-sm font-mono border rounded-lg bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                </div>

                {/* Text Stats */}
                <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
                  <span>
                    Words: {outputText.trim() ? outputText.trim().split(/\s+/).filter(Boolean).length : 0} | Characters:{' '}
                    {outputText.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => textAreaRef.current?.select()}
                    className="text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Select all
                  </button>
                </div>

                {/* Bottom Action Ribbon */}
                {outputText && (
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadTxt}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .TXT</span>
                      </button>
                    </div>

                    {/* Tool Chaining */}
                    <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-1.5 text-xs">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                        Transfer Text Directly To:
                      </span>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {[
                          { id: 'text-cleaner', label: 'Text Cleaner' },
                          { id: 'word-counter', label: 'Word Counter' },
                          { id: 'case-converter', label: 'Case Converter' },
                          { id: 'text-to-speech', label: 'Text-to-Speech' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSendToTool(t.id)}
                            className="px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[11px] font-medium"
                          >
                            → {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default ImageToTextTool;
