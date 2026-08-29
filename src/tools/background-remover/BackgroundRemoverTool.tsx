import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Scissors,
  ShieldCheck,
  Paintbrush,
  Eraser,
  Sliders,
  Eye,
  Columns,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  removeBackgroundLocal,
  compositeSegmentedImage,
  BackgroundStyle,
  BgRemoverOptions,
} from '../../utilities/background-remover';
import { copyImageToClipboard } from '../../utilities/clipboard';
import { setPendingImageTransfer } from '../../storage/transfer';

export const BackgroundRemoverTool: React.FC = () => {
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalDataUrl, setOriginalDataUrl] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);

  const [segmentedBlob, setSegmentedBlob] = useState<Blob | null>(null);
  const [segmentedDataUrl, setSegmentedDataUrl] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const [viewMode, setViewMode] = useState<'slider' | 'side-by-side'>('slider');
  const [sliderPos, setSliderPos] = useState(50); // 0 to 100%

  const [options, setOptions] = useState<BgRemoverOptions>({
    backgroundStyle: 'transparent',
    customColor: '#3B82F6',
    customImage: null,
    smoothing: 2,
    feather: 3,
    quality: 0.95,
    format: 'image/png',
  });

  const [brushMode, setBrushMode] = useState<'none' | 'restore' | 'erase'>('none');
  const [brushSize, setBrushSize] = useState(24);
  const [isDrawing, setIsDrawing] = useState(false);

  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const editCanvasRef = useRef<HTMLCanvasElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (originalDataUrl) URL.revokeObjectURL(originalDataUrl);
      if (segmentedDataUrl) URL.revokeObjectURL(segmentedDataUrl);
    };
  }, [originalDataUrl, segmentedDataUrl]);

  // Load sample image (product on solid/gradient backdrop)
  const handleLoadSample = () => {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 600;
    const ctx = c.getContext('2d');
    if (ctx) {
      // Draw background
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(0, 0, 600, 600);

      // Draw foreground subject (e.g. vibrant camera / product badge)
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(300, 300, 160, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1E40AF';
      ctx.beginPath();
      ctx.arc(300, 300, 110, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(300, 300, 60, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#1E3A8A';
      ctx.textAlign = 'center';
      ctx.fillText('PRODUCT SAMPLE', 300, 520);
    }

    c.toBlob((blob) => {
      if (blob) {
        handleSetFile(blob, 'sample-product.png');
      }
    }, 'image/png');
  };

  const handleSetFile = (file: Blob, filename = 'image.png') => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setOriginalBlob(file);
      setOriginalDataUrl(url);
      setSegmentedBlob(null);
      setSegmentedDataUrl(null);
    };
    img.src = url;
  };

  // Clipboard paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) handleSetFile(f, 'pasted-image.png');
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Process Background Removal
  const handleRemoveBg = async () => {
    if (!originalBlob) return;
    setIsProcessing(true);
    setProgressStage('Initializing local segmentation...');
    setProgressPercent(10);

    try {
      const resultBlob = await removeBackgroundLocal(originalBlob, (stage, pct) => {
        setProgressStage(stage);
        setProgressPercent(pct);
      });

      const resUrl = URL.createObjectURL(resultBlob);
      setSegmentedBlob(resultBlob);
      setSegmentedDataUrl(resUrl);
    } catch (err) {
      console.error('Background removal error:', err);
      setProgressStage('Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-composite canvas when options or segmented image change
  useEffect(() => {
    if (!segmentedDataUrl || !compositeCanvasRef.current) return;

    const img = new Image();
    img.onload = () => {
      if (compositeCanvasRef.current) {
        compositeSegmentedImage(img, options, compositeCanvasRef.current);

        // Also sync edit canvas for brush refine if active
        if (editCanvasRef.current && brushMode !== 'none') {
          editCanvasRef.current.width = img.naturalWidth;
          editCanvasRef.current.height = img.naturalHeight;
          const ectx = editCanvasRef.current.getContext('2d');
          if (ectx) ectx.drawImage(img, 0, 0);
        }
      }
    };
    img.src = segmentedDataUrl;
  }, [segmentedDataUrl, options, brushMode]);

  // Brush drawing on edit canvas for touch/mouse refine
  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (brushMode === 'none' || !editCanvasRef.current) return;
    setIsDrawing(true);
    handleDraw(e);
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || brushMode === 'none' || !editCanvasRef.current || !originalDataUrl) return;
    const canvas = editCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.save();
    if (brushMode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      ctx.fill();
    } else if (brushMode === 'restore') {
      // Sample from original image
      const origImg = new Image();
      origImg.src = originalDataUrl;
      if (origImg.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, brushSize, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(origImg, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
  };

  const handleStopDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    // Commit edit canvas back to segmented image
    if (editCanvasRef.current) {
      editCanvasRef.current.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setSegmentedBlob(blob);
          setSegmentedDataUrl(url);
        }
      }, 'image/png');
    }
  };

  const handleDownload = () => {
    if (!compositeCanvasRef.current) return;
    const link = document.createElement('a');
    const ext = options.format === 'image/jpeg' ? 'jpg' : options.format === 'image/webp' ? 'webp' : 'png';
    link.download = `removed-bg-${new Date().toISOString().slice(0, 10)}.${ext}`;
    link.href = compositeCanvasRef.current.toDataURL(options.format, options.quality);
    link.click();
  };

  const handleCopy = async () => {
    if (!compositeCanvasRef.current) return;
    compositeCanvasRef.current.toBlob(async (blob) => {
      if (blob) {
        const ok = await copyImageToClipboard(blob);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    }, 'image/png');
  };

  const handleTransferTo = (targetToolId: string) => {
    if (!compositeCanvasRef.current) return;
    compositeCanvasRef.current.toBlob((blob) => {
      if (blob) {
        setPendingImageTransfer(targetToolId, {
          blob,
          filename: `transparent-fg-${Date.now()}.png`,
        });
        window.location.hash = `#/tool/${targetToolId}`;
      }
    }, 'image/png');
  };

  return (
    <ToolShell
      toolId="background-remover"
      title="Image Background Remover"
      description="Remove image backgrounds locally in your browser using local machine learning and instant canvas refinement."
      category="image"
      relatedToolIds={['image-collage', 'image-optimizer', 'image-annotator']}
    >
      <div className="space-y-6">
        {/* Top Actions Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-2xs inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{originalBlob ? 'Replace Image' : 'Select Image'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleSetFile(e.target.files[0], e.target.files[0].name);
                }
                e.target.value = '';
              }}
            />

            {!originalBlob && (
              <button
                type="button"
                onClick={handleLoadSample}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Load Sample Product</span>
              </button>
            )}

            {originalBlob && (
              <button
                type="button"
                onClick={() => {
                  setOriginalBlob(null);
                  setOriginalDataUrl(null);
                  setSegmentedBlob(null);
                  setSegmentedDataUrl(null);
                }}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {segmentedBlob && (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied PNG!' : 'Copy Result'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Transparent PNG</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Empty Dropzone */}
        {!originalBlob && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleSetFile(e.dataTransfer.files[0], e.dataTransfer.files[0].name);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className="p-12 border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 text-center cursor-pointer transition-colors space-y-3"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Drop Image to Remove Background
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Supports JPEG, PNG, and WebP (or paste directly with Ctrl+V)
              </p>
            </div>
            <div className="pt-2 flex justify-center items-center gap-2 text-xs text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>100% Client-Side Neural Segmentation. Never uploaded to remote servers.</span>
            </div>
          </div>
        )}

        {/* Image Loaded State */}
        {originalBlob && originalDataUrl && (
          <div className="space-y-6">
            {/* Action Bar / Status */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  {originalDimensions?.width} × {originalDimensions?.height} px
                </span>
                <span className="text-xs text-neutral-400">•</span>
                <span className="text-xs text-neutral-500">
                  {(originalBlob.size / 1024).toFixed(1)} KB
                </span>
              </div>

              {!segmentedBlob && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleRemoveBg}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-2xs inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Scissors className="w-4 h-4" />
                  <span>{isProcessing ? 'Segmenting...' : 'Remove Background'}</span>
                </button>
              )}

              {segmentedBlob && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500 font-medium">View:</span>
                  <button
                    type="button"
                    onClick={() => setViewMode('slider')}
                    className={`px-2 py-1 rounded border text-[11px] font-medium ${
                      viewMode === 'slider'
                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    Before/After Slider
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('side-by-side')}
                    className={`px-2 py-1 rounded border text-[11px] font-medium ${
                      viewMode === 'side-by-side'
                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    Side-by-Side
                  </button>
                </div>
              )}
            </div>

            {/* Progress Bar (during segmentation) */}
            {isProcessing && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between text-blue-900 dark:text-blue-200 font-medium">
                  <span>{progressStage}</span>
                  <span className="font-mono">{progressPercent}%</span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-900/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Main Stage Canvas / Comparison */}
            {!segmentedBlob ? (
              /* Original Preview prior to execution */
              <div className="flex justify-center p-4 bg-neutral-900 rounded-xl overflow-hidden shadow-inner">
                <img
                  src={originalDataUrl}
                  alt="Original"
                  className="max-w-full max-h-[500px] object-contain rounded-lg shadow"
                />
              </div>
            ) : (
              /* Segmented Result with Options */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Background & Brush Settings */}
                <div className="space-y-4">
                  {/* Background Replacement */}
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Background Fill
                    </label>

                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {[
                        { id: 'transparent', label: 'Transparent' },
                        { id: 'white', label: 'Solid White' },
                        { id: 'black', label: 'Solid Black' },
                        { id: 'custom-color', label: 'Custom Color' },
                      ].map((bg) => (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() => setOptions({ ...options, backgroundStyle: bg.id as BackgroundStyle })}
                          className={`px-2.5 py-1.5 rounded border text-xs font-medium ${
                            options.backgroundStyle === bg.id
                              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                              : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          {bg.label}
                        </button>
                      ))}
                    </div>

                    {options.backgroundStyle === 'custom-color' && (
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="color"
                          value={options.customColor}
                          onChange={(e) => setOptions({ ...options, customColor: e.target.value })}
                          className="w-8 h-7 p-0 border-0 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={options.customColor}
                          onChange={(e) => setOptions({ ...options, customColor: e.target.value })}
                          className="w-full px-2 py-1 text-xs font-mono border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                        />
                      </div>
                    )}
                  </div>

                  {/* Manual Refine Brush */}
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Edge Touch-up Brush
                    </label>

                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setBrushMode('none')}
                        className={`p-1.5 rounded border font-medium text-[11px] ${
                          brushMode === 'none'
                            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        Off (View)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrushMode('restore')}
                        className={`p-1.5 rounded border font-medium text-[11px] inline-flex items-center justify-center gap-1 ${
                          brushMode === 'restore'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        <Paintbrush className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrushMode('erase')}
                        className={`p-1.5 rounded border font-medium text-[11px] inline-flex items-center justify-center gap-1 ${
                          brushMode === 'erase'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        <Eraser className="w-3 h-3" />
                        <span>Erase</span>
                      </button>
                    </div>

                    {brushMode !== 'none' && (
                      <div className="space-y-1 pt-1 text-xs">
                        <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                          <span>Brush Size: {brushSize}px</span>
                          <input
                            type="range"
                            min="6"
                            max="60"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            className="w-28"
                          />
                        </div>
                        <p className="text-[10px] text-neutral-400">
                          {brushMode === 'restore' ? 'Paint over areas to recover foreground.' : 'Paint over lingering background artifacts to erase.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Transfer Options */}
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
                    <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                      Chaining & Transfer
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTransferTo('image-collage')}
                        className="text-left text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        → Send Cutout to Image Collage
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTransferTo('image-annotator')}
                        className="text-left text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        → Send Cutout to Image Annotator
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Display View */}
                <div className="lg:col-span-2 space-y-3">
                  <div
                    className="relative w-full flex items-center justify-center p-4 rounded-xl overflow-hidden shadow-inner border border-neutral-800"
                    style={{
                      backgroundImage:
                        options.backgroundStyle === 'transparent'
                          ? 'repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%) 50% / 20px 20px'
                          : undefined,
                      backgroundColor: options.backgroundStyle !== 'transparent' ? '#0f172a' : undefined,
                    }}
                  >
                    {/* Render Canvas (Composite Result) */}
                    {brushMode === 'none' && viewMode === 'side-by-side' ? (
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <div className="text-center space-y-1">
                          <span className="text-[10px] font-mono text-white bg-black/60 px-2 py-0.5 rounded">ORIGINAL</span>
                          <img src={originalDataUrl} alt="Orig" className="max-h-[400px] mx-auto object-contain rounded" />
                        </div>
                        <div className="text-center space-y-1">
                          <span className="text-[10px] font-mono text-white bg-black/60 px-2 py-0.5 rounded">RESULT</span>
                          <canvas ref={compositeCanvasRef} className="max-h-[400px] mx-auto object-contain rounded" />
                        </div>
                      </div>
                    ) : brushMode === 'none' && viewMode === 'slider' ? (
                      <div className="relative max-h-[500px] overflow-hidden rounded-lg select-none">
                        {/* Under layer: Segmented Result */}
                        <canvas ref={compositeCanvasRef} className="max-h-[500px] object-contain rounded" />

                        {/* Over layer: Original with Clip Path */}
                        <div
                          className="absolute inset-0 overflow-hidden pointer-events-none"
                          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                        >
                          <img src={originalDataUrl} alt="Original" className="max-h-[500px] w-full h-full object-contain" />
                        </div>

                        {/* Slider Divider Bar */}
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-white shadow cursor-ew-resize flex items-center justify-center"
                          style={{ left: `${sliderPos}%` }}
                        >
                          <div className="w-6 h-6 rounded-full bg-white text-neutral-800 shadow-md flex items-center justify-center text-[10px] font-bold">
                            ↔
                          </div>
                        </div>

                        {/* Invisible Range Slider */}
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={sliderPos}
                          onChange={(e) => setSliderPos(parseInt(e.target.value))}
                          className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
                        />
                      </div>
                    ) : (
                      /* Interactive Brush Mode */
                      <div className="relative cursor-crosshair">
                        <canvas
                          ref={editCanvasRef}
                          onMouseDown={handleStartDraw}
                          onMouseMove={handleDraw}
                          onMouseUp={handleStopDraw}
                          onMouseLeave={handleStopDraw}
                          onTouchStart={handleStartDraw}
                          onTouchMove={handleDraw}
                          onTouchEnd={handleStopDraw}
                          className="max-h-[500px] object-contain rounded shadow"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>Export format: PNG (with 32-bit alpha channel)</span>
                    <span className="text-[11px]">All processing executed locally</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default BackgroundRemoverTool;
