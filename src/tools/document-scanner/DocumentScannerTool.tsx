import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ScanText,
  Upload,
  Camera,
  RotateCcw,
  RotateCw,
  Download,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Sparkles,
  ArrowRight,
  Maximize2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  Point2D,
  ScanFilterMode,
  ScanOptions,
  orderQuadCorners,
  calculateWarpDimensions,
  detectDefaultCorners,
  warpPerspectiveCanvas,
  applyScanFilters,
} from '../../utilities/document-scanner';
import { setPendingTransfer } from '../../storage/transfer';

export const DocumentScannerTool: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);

  // 4 draggable quad corners: [TL, TR, BR, BL]
  const [corners, setCorners] = useState<[Point2D, Point2D, Point2D, Point2D] | null>(null);
  const [activeCornerIdx, setActiveCornerIdx] = useState<number | null>(null);

  // Scanner filter and adjustments
  const [filterMode, setFilterMode] = useState<ScanFilterMode>('enhanced');
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(15);
  const [bwThreshold, setBwThreshold] = useState<number>(128);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);

  // Result state
  const [resultCanvasUrl, setResultCanvasUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up object URLs and camera on unmount
  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [imageSrc]);

  // The camera video is rendered only after cameraActive becomes true. Attach
  // the acquired stream after that render commits instead of trying to use a
  // ref that does not exist yet inside handleStartCamera.
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play().catch(() => {
      setErrorMessage('Unable to start the camera preview in this browser.');
    });

    return () => {
      if (video.srcObject) {
        video.srcObject = null;
      }
    };
  }, [cameraActive]);

  // Load image
  const handleLoadImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please provide a valid image file (JPEG, PNG, WebP).');
      return;
    }
    setErrorMessage(null);
    if (imageSrc) URL.revokeObjectURL(imageSrc);

    const url = URL.createObjectURL(file);
    setImageFile(file);
    setImageSrc(url);
    setResultCanvasUrl(null);
    setRotation(0);
    setFilterMode('enhanced');

    const tempImg = new Image();
    tempImg.onload = () => {
      const w = tempImg.naturalWidth;
      const h = tempImg.naturalHeight;
      setImgDimensions({ width: w, height: h });
      setCorners(detectDefaultCorners(w, h));
    };
    tempImg.src = url;
  };

  // Paste from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const item = e.clipboardData?.items[0];
      if (item && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleLoadImageFile(file);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Camera capture
  const handleStartCamera = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setErrorMessage('Camera access was blocked or not available.');
    }
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'camera-document.jpg', { type: 'image/jpeg' });
          handleLoadImageFile(file);
        }
      }, 'image/jpeg', 0.95);
    }
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Pointer events for dragging corner handles
  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveCornerIdx(idx);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activeCornerIdx === null || !corners || !containerRef.current || !imgDimensions) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = imgDimensions.width / rect.width;
    const scaleY = imgDimensions.height / rect.height;

    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;

    const clampedX = Math.max(0, Math.min(imgDimensions.width, rawX));
    const clampedY = Math.max(0, Math.min(imgDimensions.height, rawY));

    const updatedCorners = [...corners] as [Point2D, Point2D, Point2D, Point2D];
    updatedCorners[activeCornerIdx] = { x: clampedX, y: clampedY };
    setCorners(updatedCorners);
  };

  const handlePointerUp = () => {
    setActiveCornerIdx(null);
  };

  // Generate perspective warped and enhanced scan
  const generateScan = useCallback(() => {
    if (!imgRef.current || !corners || !imgDimensions) return;

    try {
      const ordered = orderQuadCorners(corners);
      const warpDims = calculateWarpDimensions(ordered);
      const warpedCanvas = warpPerspectiveCanvas(imgRef.current, ordered, warpDims.width, warpDims.height);

      const scanOptions: ScanOptions = {
        filter: filterMode,
        brightness,
        contrast,
        bwThreshold,
        sharpen: true,
        rotation,
      };

      const finalCanvas = applyScanFilters(warpedCanvas, scanOptions);
      setResultCanvasUrl(finalCanvas.toDataURL('image/png'));
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate scan.');
    }
  }, [corners, imgDimensions, filterMode, brightness, contrast, bwThreshold, rotation]);

  // Auto update scan whenever filters change
  useEffect(() => {
    if (corners && imgRef.current) {
      generateScan();
    }
  }, [generateScan, corners, filterMode, brightness, contrast, bwThreshold, rotation]);

  const handleResetCorners = () => {
    if (!imgDimensions) return;
    setCorners(detectDefaultCorners(imgDimensions.width, imgDimensions.height));
  };

  const handleCopyImage = async () => {
    if (!resultCanvasUrl) return;
    try {
      const res = await fetch(resultCanvasUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage('Direct image copying is not supported in this browser context.');
    }
  };

  const handleSendToOCR = () => {
    if (!resultCanvasUrl) return;
    setPendingTransfer('image-to-text', resultCanvasUrl);
    window.location.hash = '#/tool/image-to-text';
  };

  const handleReset = () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageFile(null);
    setImageSrc(null);
    setImgDimensions(null);
    setCorners(null);
    setResultCanvasUrl(null);
    setErrorMessage(null);
  };

  return (
    <ToolShell
      toolId="document-scanner"
      title="Document Scanner & Straightener"
      description="Straighten document angles with interactive perspective correction and enhance text readability with high-contrast scan filters."
      category="productivity"
      relatedToolIds={['image-to-text', 'image-annotator', 'image-optimizer']}
    >
      <div className="space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Camera Modal View */}
        {cameraActive && (
          <div className="p-4 bg-black rounded-xl border border-neutral-800 space-y-3 text-center">
            <div className="relative aspect-video max-w-lg mx-auto overflow-hidden rounded-lg bg-neutral-950">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach((t) => t.stop());
                    streamRef.current = null;
                  }
                  setCameraActive(false);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-800 text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md inline-flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Snap Document</span>
              </button>
            </div>
          </div>
        )}

        {!imageSrc && !cameraActive ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) handleLoadImageFile(e.dataTransfer.files[0]);
            }}
            className="p-8 sm:p-12 border-2 border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 text-center hover:border-blue-500 transition-colors bg-white dark:bg-neutral-900"
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ScanText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
              Select or Drop Document Photo
            </h3>
            <p className="text-xs text-neutral-500 mb-4 max-w-sm mx-auto">
              Upload an angled photo of a document, receipt, whiteboard, or contract to straighten and enhance.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs">
                <Upload className="w-4 h-4" />
                <span>Browse Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleLoadImageFile(e.target.files[0])}
                  className="hidden"
                />
              </label>

              {typeof navigator !== 'undefined' && navigator.mediaDevices && (
                <button
                  type="button"
                  onClick={handleStartCamera}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200"
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Use Camera</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          imageSrc && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: 4-Corner Document Straightener Canvas */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Drag 4 Corner Handles to Boundary</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResetCorners}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Reset Corners
                  </button>
                </div>

                <div
                  ref={containerRef}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="relative w-full aspect-4/3 bg-neutral-900 rounded-xl overflow-hidden select-none touch-none flex items-center justify-center border border-neutral-800"
                >
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Source Document"
                    className="w-full h-full object-contain pointer-events-none"
                  />

                  {/* Visual Polygon between corners */}
                  {corners && imgDimensions && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <polygon
                        points={corners
                          .map((p) => {
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (!rect) return '0,0';
                            const x = (p.x / imgDimensions.width) * rect.width;
                            const y = (p.y / imgDimensions.height) * rect.height;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                        fill="rgba(59, 130, 246, 0.15)"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                    </svg>
                  )}

                  {/* 4 Draggable Corner Handles */}
                  {corners &&
                    imgDimensions &&
                    corners.map((p, idx) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (!rect) return null;
                      const x = (p.x / imgDimensions.width) * rect.width;
                      const y = (p.y / imgDimensions.height) * rect.height;
                      const labels = ['TL', 'TR', 'BR', 'BL'];

                      return (
                        <div
                          key={idx}
                          onPointerDown={(e) => handlePointerDown(idx, e)}
                          style={{
                            left: `${x}px`,
                            top: `${y}px`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          className={`absolute w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing z-20 ${
                            activeCornerIdx === idx ? 'bg-blue-600 scale-125' : 'bg-blue-500'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-white leading-none">
                            {labels[idx]}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Right Column: Scan Result & Adjustments */}
              <div className="lg:col-span-6 space-y-4">
                <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
                  {/* Scan Filters */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Scan Filter Mode
                    </label>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      {(
                        [
                          { id: 'enhanced', label: 'Enhanced' },
                          { id: 'bw', label: 'B&W Text' },
                          { id: 'grayscale', label: 'Grayscale' },
                          { id: 'original', label: 'Original' },
                        ] as { id: ScanFilterMode; label: string }[]
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setFilterMode(m.id)}
                          className={`py-1.5 rounded-md font-medium capitalize border ${
                            filterMode === m.id
                              ? 'bg-blue-600 text-white border-transparent'
                              : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sliders: Brightness & Contrast */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-neutral-600 dark:text-neutral-400">Brightness</span>
                        <span className="font-mono">{brightness}</span>
                      </div>
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-neutral-600 dark:text-neutral-400">Contrast</span>
                        <span className="font-mono">{contrast}</span>
                      </div>
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={contrast}
                        onChange={(e) => setContrast(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>

                  {filterMode === 'bw' && (
                    <div className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-neutral-600 dark:text-neutral-400">B&W Threshold</span>
                        <span className="font-mono">{bwThreshold}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={255}
                        value={bwThreshold}
                        onChange={(e) => setBwThreshold(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  )}

                  {/* Rotate */}
                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Rotate Page:
                    </span>
                    <button
                      type="button"
                      onClick={() => setRotation((r) => ((r - 90 + 360) % 360) as 0 | 90 | 180 | 270)}
                      className="px-2.5 py-1 text-xs border rounded bg-white dark:bg-neutral-800 hover:bg-neutral-100 border-neutral-300 dark:border-neutral-700 inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>-90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)}
                      className="px-2.5 py-1 text-xs border rounded bg-white dark:bg-neutral-800 hover:bg-neutral-100 border-neutral-300 dark:border-neutral-700 inline-flex items-center gap-1"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>+90°</span>
                    </button>
                  </div>
                </div>

                {/* Straightened Output Preview */}
                {resultCanvasUrl && (
                  <div className="space-y-3">
                    <div className="p-3 bg-neutral-100 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 max-h-[300px] overflow-auto flex items-center justify-center">
                      <img
                        src={resultCanvasUrl}
                        alt="Scanned Output Preview"
                        className="max-h-[280px] w-auto object-contain rounded shadow-md border border-neutral-300 dark:border-neutral-700"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleCopyImage}
                        className="py-2 text-xs font-medium rounded-lg border bg-white dark:bg-neutral-800 hover:bg-neutral-100 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center justify-center gap-1.5"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied Scan!' : 'Copy Image'}</span>
                      </button>

                      <a
                        href={resultCanvasUrl}
                        download="scanned-document.png"
                        className="py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-center shadow-2xs inline-flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Scan</span>
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendToOCR}
                      className="w-full py-2 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 inline-flex items-center justify-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Extract Text with OCR →</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleReset}
                      className="w-full py-1 text-xs text-neutral-500 hover:underline"
                    >
                      Scan Another Document
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </ToolShell>
  );
};

export default DocumentScannerTool;
