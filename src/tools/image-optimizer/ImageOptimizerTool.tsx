import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Download,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Lock,
  Unlock,
  RefreshCw,
  Image as ImageIcon,
  Check,
  AlertCircle,
  FileImage,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  ImageMetadata,
  CropRect,
  OutputFormat,
  calculateAspectRatio,
  formatFileSize,
  calculateTargetDimensions,
  applyScalePreset,
  processImageCanvas,
  generateOptimizedFilename,
} from '../../utilities/image-optimizer';
import { setPendingImageTransfer, consumePendingImageTransfer } from '../../storage/transfer';

interface ImageOptimizerToolProps {
  initialText?: string;
}

export const ImageOptimizerTool: React.FC<ImageOptimizerToolProps> = () => {
  // Source Image State
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  // Transformations
  const [targetWidth, setTargetWidth] = useState<number>(0);
  const [targetHeight, setTargetHeight] = useState<number>(0);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [preventUpscale, setPreventUpscale] = useState<boolean>(true);

  // Rotation & Flip
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);

  // Crop Mode
  const [cropActive, setCropActive] = useState<boolean>(false);
  const [cropRatio, setCropRatio] = useState<'free' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16'>('free');
  const [cropRect, setCropRect] = useState<CropRect | null>(null);

  // Output format & compression
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/webp');
  const [quality, setQuality] = useState<number>(0.85);

  // Processing & Output
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedResult, setProcessedResult] = useState<{
    blob: Blob;
    width: number;
    height: number;
    url: string;
    size: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // DOM Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeUrlRef = useRef<string | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
      }
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [sourceUrl]);

  // Load an image file or blob into state
  const loadImage = useCallback((fileOrBlob: Blob, filename = 'image.png') => {
    setError(null);
    if (!fileOrBlob || fileOrBlob.size === 0) {
      setError('Selected file is empty.');
      return;
    }

    if (!fileOrBlob.type.startsWith('image/') && !filename.match(/\.(jpg|jpeg|png|webp)$/i)) {
      setError('Please provide a valid JPEG, PNG, or WebP image.');
      return;
    }

    const objectUrl = URL.createObjectURL(fileOrBlob);
    const img = new Image();

    img.onload = () => {
      // Release previous source URL
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }

      setSourceUrl(objectUrl);
      setSourceImage(img);
      setMetadata({
        name: filename,
        type: fileOrBlob.type || 'image/png',
        size: fileOrBlob.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: calculateAspectRatio(img.naturalWidth, img.naturalHeight),
      });

      // Default target dimensions match original
      setTargetWidth(img.naturalWidth);
      setTargetHeight(img.naturalHeight);
      setRotationDeg(0);
      setFlipH(false);
      setFlipV(false);
      setCropActive(false);
      setCropRect(null);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('Failed to decode image. The file may be corrupt or in an unsupported format.');
    };

    img.src = objectUrl;
  }, [sourceUrl]);

  // Check for in-memory transferred image on mount
  useEffect(() => {
    const transferred = consumePendingImageTransfer('image-optimizer');
    if (transferred && transferred.blob) {
      loadImage(transferred.blob, transferred.filename || 'transferred-image.png');
    }
  }, [loadImage]);

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      loadImage(file, file.name);
    }
  };

  // Handle Global Paste (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            loadImage(file, 'pasted-image.png');
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [loadImage]);

  // Width/Height Change Handlers with Aspect Ratio
  const handleWidthChange = (val: number) => {
    const num = Math.max(1, Math.round(val));
    setTargetWidth(num);
    if (lockAspectRatio && metadata && metadata.width > 0 && metadata.height > 0) {
      const ratio = metadata.width / metadata.height;
      setTargetHeight(Math.max(1, Math.round(num / ratio)));
    }
  };

  const handleHeightChange = (val: number) => {
    const num = Math.max(1, Math.round(val));
    setTargetHeight(num);
    if (lockAspectRatio && metadata && metadata.width > 0 && metadata.height > 0) {
      const ratio = metadata.width / metadata.height;
      setTargetWidth(Math.max(1, Math.round(num * ratio)));
    }
  };

  const handleApplyPreset = (preset: '25%' | '50%' | '75%' | '1920max' | '1080max') => {
    if (!metadata) return;
    const dims = applyScalePreset(metadata.width, metadata.height, preset);
    setTargetWidth(dims.width);
    setTargetHeight(dims.height);
  };

  // Process and render image on change
  useEffect(() => {
    if (!sourceImage || !metadata) {
      setProcessedResult(null);
      return;
    }

    let isMounted = true;
    const timeoutId = setTimeout(async () => {
      setIsProcessing(true);
      try {
        const { width: finalW, height: finalH } = calculateTargetDimensions(
          metadata.width,
          metadata.height,
          targetWidth,
          targetHeight,
          lockAspectRatio,
          preventUpscale
        );

        const res = await processImageCanvas(sourceImage, {
          targetWidth: finalW,
          targetHeight: finalH,
          rotationDeg,
          flipH,
          flipV,
          crop: cropActive ? cropRect : null,
          format: outputFormat,
          quality,
        });

        if (isMounted) {
          if (activeUrlRef.current) {
            URL.revokeObjectURL(activeUrlRef.current);
          }
          activeUrlRef.current = res.url;
          setProcessedResult({
            blob: res.blob,
            width: res.width,
            height: res.height,
            url: res.url,
            size: res.blob.size,
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error processing image');
        }
      } finally {
        if (isMounted) {
          setIsProcessing(false);
        }
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [
    sourceImage,
    metadata,
    targetWidth,
    targetHeight,
    lockAspectRatio,
    preventUpscale,
    rotationDeg,
    flipH,
    flipV,
    cropActive,
    cropRect,
    outputFormat,
    quality,
  ]);

  // Reset to original image state
  const handleReset = () => {
    if (!metadata) return;
    setTargetWidth(metadata.width);
    setTargetHeight(metadata.height);
    setLockAspectRatio(true);
    setPreventUpscale(true);
    setRotationDeg(0);
    setFlipH(false);
    setFlipV(false);
    setCropActive(false);
    setCropRect(null);
    setOutputFormat('image/webp');
    setQuality(0.85);
  };

  // Download Trigger
  const handleDownload = () => {
    if (!processedResult || !metadata) return;
    const filename = generateOptimizedFilename(metadata.name, outputFormat);
    const link = document.createElement('a');
    link.href = processedResult.url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Tool Chaining: Send to Image Annotator
  const handleSendToAnnotator = () => {
    if (!processedResult || !metadata) return;
    setPendingImageTransfer('image-annotator', {
      blob: processedResult.blob,
      filename: generateOptimizedFilename(metadata.name, outputFormat),
      dataUrl: processedResult.url,
    });
    window.location.hash = '#/tool/image-annotator';
  };

  // Percentage difference calculation
  const sizeDiffPercent = metadata && processedResult
    ? (((processedResult.size - metadata.size) / metadata.size) * 100).toFixed(1)
    : '0';

  return (
    <ToolShell
      toolId="image-optimizer"
      title="Image Optimizer & Converter"
      description="Resize, compress, crop, rotate, and convert JPEG, PNG, and WebP images locally with zero cloud upload."
      category="image"
      relatedToolIds={['image-annotator', 'aspect-ratio-calculator', 'color-converter']}
    >
      <div className="space-y-6">
        {/* Hidden File Picker Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              loadImage(e.target.files[0], e.target.files[0].name);
            }
          }}
        />

        {/* 1. Upload / Drop Area if no image loaded */}
        {!sourceImage ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-8 sm:p-12 text-center bg-neutral-50 dark:bg-neutral-900/50 cursor-pointer transition-colors space-y-4"
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Click to upload or drag and drop an image
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Supports JPEG, PNG, and WebP. You can also paste directly with <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-800 rounded font-mono text-[11px]">Ctrl+V</kbd> or <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-800 rounded font-mono text-[11px]">⌘V</kbd>.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-md">
              <ShieldCheck className="w-4 h-4" />
              <span>Processed locally in your browser. Your image is not uploaded.</span>
            </div>
          </div>
        ) : (
          /* 2. Image Loaded - Controls & Live Split View */
          <div className="space-y-6">
            {/* Top Toolbar & Metadata Header */}
            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  <FileImage className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-xs sm:max-w-md">
                    {metadata?.name}
                  </div>
                  <div className="text-neutral-500 text-[11px] flex items-center gap-2">
                    <span>{metadata?.width} × {metadata?.height} px</span>
                    <span>•</span>
                    <span>{metadata ? formatFileSize(metadata.size) : ''}</span>
                    <span>•</span>
                    <span>Ratio: {metadata?.aspectRatio}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Replace Image
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2.5 py-1.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Main Workspace: Controls Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Adjustments & Settings */}
              <div className="lg:col-span-5 space-y-5">
                {/* Resize Controls */}
                <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                      Dimensions & Resize
                    </h4>
                    <button
                      type="button"
                      onClick={() => setLockAspectRatio(!lockAspectRatio)}
                      className={`p-1.5 rounded border text-xs flex items-center gap-1 transition-colors ${
                        lockAspectRatio
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-700'
                      }`}
                      title="Lock aspect ratio"
                    >
                      {lockAspectRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span className="text-[10px] font-medium">{lockAspectRatio ? 'Locked' : 'Unlocked'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                        Width (px)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={targetWidth || ''}
                        onChange={(e) => handleWidthChange(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                        Height (px)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={targetHeight || ''}
                        onChange={(e) => handleHeightChange(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Scale Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-neutral-400 mr-1">Presets:</span>
                    {(['25%', '50%', '75%', '1920max', '1080max'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        className="px-2 py-0.5 text-[11px] bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-700 dark:text-neutral-300"
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* Prevent Upscale Checkbox */}
                  <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preventUpscale}
                      onChange={(e) => setPreventUpscale(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Prevent accidental upscaling (limits to original size)</span>
                  </label>
                </div>

                {/* Rotation & Flip */}
                <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Orientation & Flip
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setRotationDeg((prev) => (prev - 90 + 360) % 360)}
                      className="p-2 flex flex-col items-center gap-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-xs text-neutral-700 dark:text-neutral-300"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span className="text-[10px]">Left 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotationDeg((prev) => (prev + 90) % 360)}
                      className="p-2 flex flex-col items-center gap-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-xs text-neutral-700 dark:text-neutral-300"
                    >
                      <RotateCw className="w-4 h-4" />
                      <span className="text-[10px]">Right 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlipH(!flipH)}
                      className={`p-2 flex flex-col items-center gap-1 border rounded text-xs ${
                        flipH
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 border-blue-300 dark:border-blue-700'
                          : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      <FlipHorizontal className="w-4 h-4" />
                      <span className="text-[10px]">Flip H</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlipV(!flipV)}
                      className={`p-2 flex flex-col items-center gap-1 border rounded text-xs ${
                        flipV
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 border-blue-300 dark:border-blue-700'
                          : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      <FlipVertical className="w-4 h-4" />
                      <span className="text-[10px]">Flip V</span>
                    </button>
                  </div>
                </div>

                {/* Conversion & Compression */}
                <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Output Format & Compression
                  </h4>

                  {/* Format selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {(['image/webp', 'image/jpeg', 'image/png'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setOutputFormat(fmt)}
                        className={`p-2 text-xs font-semibold rounded border text-center uppercase tracking-wider transition-colors ${
                          outputFormat === fmt
                            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                            : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        {fmt.replace('image/', '')}
                      </button>
                    ))}
                  </div>

                  {/* Quality slider (for lossy formats WebP and JPEG) */}
                  {outputFormat !== 'image/png' ? (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-medium text-neutral-700 dark:text-neutral-300">
                          Quality: {Math.round(quality * 100)}%
                        </label>
                        <span className="text-[11px] text-neutral-400">
                          {quality >= 0.85 ? 'High (Crisp)' : quality >= 0.65 ? 'Medium (Balanced)' : 'Low (Smallest)'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={quality}
                        onChange={(e) => setQuality(parseFloat(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-500 italic pt-1">
                      PNG format produces lossless compression. Transparency is fully preserved.
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Live Preview & Export Stats */}
              <div className="lg:col-span-7 space-y-4">
                {/* Result Card */}
                <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                      Live Output Preview
                    </span>
                    {isProcessing ? (
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono animate-pulse">
                        Rendering...
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> Ready
                      </span>
                    )}
                  </div>

                  {/* Canvas / Image Preview Container */}
                  <div className="w-full h-64 sm:h-80 bg-neutral-200 dark:bg-neutral-800/80 rounded-lg overflow-hidden flex items-center justify-center p-2 relative">
                    {processedResult ? (
                      <img
                        src={processedResult.url}
                        alt="Optimized preview"
                        className="max-w-full max-h-full object-contain rounded shadow-xs"
                      />
                    ) : (
                      <div className="text-neutral-400 text-xs">Generating preview...</div>
                    )}
                  </div>

                  {/* Metrics & Comparison Bar */}
                  {processedResult && metadata && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
                      <div>
                        <div className="text-[10px] text-neutral-400 uppercase">Original Size</div>
                        <div className="font-bold text-neutral-800 dark:text-neutral-200">
                          {formatFileSize(metadata.size)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-400 uppercase">Optimized Size</div>
                        <div className="font-bold text-blue-600 dark:text-blue-400">
                          {formatFileSize(processedResult.size)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-400 uppercase">Size Change</div>
                        <div
                          className={`font-bold ${
                            Number(sizeDiffPercent) <= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {Number(sizeDiffPercent) <= 0 ? sizeDiffPercent : `+${sizeDiffPercent}`}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-400 uppercase">Dimensions</div>
                        <div className="font-bold text-neutral-800 dark:text-neutral-200">
                          {processedResult.width} × {processedResult.height}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Primary Download & Chaining Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={!processedResult || isProcessing}
                      className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      <span>
                        Download {outputFormat.replace('image/', '').toUpperCase()} ({processedResult ? formatFileSize(processedResult.size) : ''})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSendToAnnotator}
                      disabled={!processedResult}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                      title="Send this optimized image to Image Annotator"
                    >
                      <span>Send to Annotator</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Privacy Badge footer */}
                <div className="text-center text-[11px] text-neutral-500">
                  Processed 100% locally on your device with Canvas & Web APIs.
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default ImageOptimizerTool;
