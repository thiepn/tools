import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Download,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check,
  AlertCircle,
  Eye,
  Sliders,
  Printer,
  Image as ImageIcon,
  HelpCircle,
  Move,
  Grid,
  Sparkles,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  ID_PHOTO_PRESETS,
  PRINT_SHEET_PRESETS,
  IdPhotoPreset,
  PrintSheetPreset,
  mmToPixels,
  calculatePrintSheetLayout,
  drawPrintCutMarks,
} from '../../utilities/id-photo-maker';

export const IdPhotoMakerTool: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [activePreset, setActivePreset] = useState<IdPhotoPreset>(ID_PHOTO_PRESETS[0]);
  
  // Custom dimensions (if custom preset)
  const [customWidthMm, setCustomWidthMm] = useState<number>(35);
  const [customHeightMm, setCustomHeightMm] = useState<number>(45);
  const [dpi, setDpi] = useState<number>(300);

  // Transform controls
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);

  // Background and guide options
  const [bgColor, setBgColor] = useState<string>('#FFFFFF');
  const [bgMode, setBgMode] = useState<'original' | 'white' | 'light-gray' | 'light-blue'>('white');
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Print sheet options
  const [exportMode, setExportMode] = useState<'single' | 'sheet'>('single');
  const [selectedSheet, setSelectedSheet] = useState<PrintSheetPreset>(PRINT_SHEET_PRESETS[0]);
  const [sheetCopies, setSheetCopies] = useState<number>(6);
  const [sheetMarginMm, setSheetMarginMm] = useState<number>(5);
  const [sheetGapMm, setSheetGapMm] = useState<number>(3);
  const [includeCutMarks, setIncludeCutMarks] = useState<boolean>(true);

  // Export format & quality
  const [exportFormat, setExportFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [jpegQuality, setJpegQuality] = useState<number>(0.95);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load uploaded image
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageEl(img);
      setImageSrc(url);
      setZoom(1);
      setRotation(0);
      setPanX(0);
      setPanY(0);
    };
    img.src = url;
  };

  // Clipboard paste listener
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (e.clipboardData?.files) {
      for (let i = 0; i < e.clipboardData.files.length; i++) {
        const f = e.clipboardData.files[i];
        if (f.type.startsWith('image/')) {
          handleFileUpload(f);
          break;
        }
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const targetWidthMm = activePreset.id === 'custom' ? customWidthMm : activePreset.widthMm;
  const targetHeightMm = activePreset.id === 'custom' ? customHeightMm : activePreset.heightMm;
  const photoPixelW = mmToPixels(targetWidthMm, dpi);
  const photoPixelH = mmToPixels(targetHeightMm, dpi);

  // Render single ID photo onto a canvas
  const renderSinglePhotoCanvas = useCallback((): HTMLCanvasElement | null => {
    if (!imageEl) return null;
    const canvas = document.createElement('canvas');
    canvas.width = photoPixelW;
    canvas.height = photoPixelH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background color
    let fill = '#FFFFFF';
    if (bgMode === 'light-gray') fill = '#F3F4F6';
    if (bgMode === 'light-blue') fill = '#E0F2FE';
    if (bgMode === 'original') fill = '#FFFFFF';

    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, photoPixelW, photoPixelH);

    // Draw user image transformed
    ctx.save();
    ctx.translate(photoPixelW / 2 + panX, photoPixelH / 2 + panY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Scale so initial image covers the frame nicely
    const scale = Math.max(photoPixelW / imageEl.naturalWidth, photoPixelH / imageEl.naturalHeight);
    const drawW = imageEl.naturalWidth * scale;
    const drawH = imageEl.naturalHeight * scale;

    ctx.drawImage(imageEl, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    return canvas;
  }, [imageEl, photoPixelW, photoPixelH, bgMode, panX, panY, rotation, zoom]);

  // Main preview rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (exportMode === 'single') {
      canvas.width = photoPixelW;
      canvas.height = photoPixelH;
      const singleCanvas = renderSinglePhotoCanvas();
      if (singleCanvas) {
        ctx.drawImage(singleCanvas, 0, 0);
      } else {
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(0, 0, photoPixelW, photoPixelH);
      }

      // Draw biometric alignment guides if enabled
      if (showGuides && imageEl) {
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.75)';
        ctx.lineWidth = Math.max(1.5, photoPixelW * 0.004);

        // Center line
        if (showGrid) {
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(photoPixelW / 2, 0);
          ctx.lineTo(photoPixelW / 2, photoPixelH);
          ctx.stroke();
        }

        // Oval face guide (typical 70-80% height)
        const ovalH = photoPixelH * 0.72;
        const ovalW = photoPixelW * 0.58;
        const ovalCenterY = photoPixelH * 0.48;

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.ellipse(photoPixelW / 2, ovalCenterY, ovalW / 2, ovalH / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Eye level indicator (approx 55% from bottom or 45% from top)
        const eyeY = photoPixelH * 0.42;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(photoPixelW * 0.15, eyeY);
        ctx.lineTo(photoPixelW * 0.85, eyeY);
        ctx.stroke();

        // Chin level indicator
        const chinY = ovalCenterY + ovalH / 2;
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
        ctx.beginPath();
        ctx.moveTo(photoPixelW * 0.25, chinY);
        ctx.lineTo(photoPixelW * 0.75, chinY);
        ctx.stroke();

        ctx.restore();
      }
    } else {
      // Print sheet layout preview
      const layout = calculatePrintSheetLayout(
        selectedSheet.widthMm,
        selectedSheet.heightMm,
        targetWidthMm,
        targetHeightMm,
        {
          dpi,
          requestedCopies: sheetCopies,
          marginMm: sheetMarginMm,
          gapMm: sheetGapMm,
        }
      );

      canvas.width = layout.sheetWidthPx;
      canvas.height = layout.sheetHeightPx;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, layout.sheetWidthPx, layout.sheetHeightPx);

      const singleCanvas = renderSinglePhotoCanvas();

      if (singleCanvas) {
        for (const pos of layout.positions) {
          ctx.drawImage(singleCanvas, pos.x, pos.y, pos.width, pos.height);
        }
      }

      if (includeCutMarks) {
        drawPrintCutMarks(ctx, layout.positions);
      }
    }
  }, [
    exportMode,
    imageEl,
    photoPixelW,
    photoPixelH,
    renderSinglePhotoCanvas,
    showGuides,
    showGrid,
    selectedSheet,
    targetWidthMm,
    targetHeightMm,
    dpi,
    sheetCopies,
    sheetMarginMm,
    sheetGapMm,
    includeCutMarks,
  ]);

  // Drag pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    setPanX(e.clientX - dragStartRef.current.x);
    setPanY(e.clientY - dragStartRef.current.y);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch pan handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.touches[0].clientX - panX,
        y: e.touches[0].clientY - panY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    setPanX(e.touches[0].clientX - dragStartRef.current.x);
    setPanY(e.touches[0].clientY - dragStartRef.current.y);
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  // Download export
  const handleDownload = () => {
    if (exportMode === 'single') {
      const singleCanvas = renderSinglePhotoCanvas();
      if (!singleCanvas) return;
      const dataUrl = singleCanvas.toDataURL(exportFormat, jpegQuality);
      const link = document.createElement('a');
      link.download = `id-photo-${targetWidthMm}x${targetHeightMm}mm.${exportFormat === 'image/png' ? 'png' : 'jpg'}`;
      link.href = dataUrl;
      link.click();
    } else {
      const layout = calculatePrintSheetLayout(
        selectedSheet.widthMm,
        selectedSheet.heightMm,
        targetWidthMm,
        targetHeightMm,
        {
          dpi,
          requestedCopies: sheetCopies,
          marginMm: sheetMarginMm,
          gapMm: sheetGapMm,
        }
      );

      const sheetCanvas = document.createElement('canvas');
      sheetCanvas.width = layout.sheetWidthPx;
      sheetCanvas.height = layout.sheetHeightPx;
      const ctx = sheetCanvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, layout.sheetWidthPx, layout.sheetHeightPx);

      const singleCanvas = renderSinglePhotoCanvas();
      if (singleCanvas) {
        for (const pos of layout.positions) {
          ctx.drawImage(singleCanvas, pos.x, pos.y, pos.width, pos.height);
        }
      }

      if (includeCutMarks) {
        drawPrintCutMarks(ctx, layout.positions);
      }

      const dataUrl = sheetCanvas.toDataURL(exportFormat, jpegQuality);
      const link = document.createElement('a');
      link.download = `print-sheet-${selectedSheet.id}-${layout.actualCopies}copies.${exportFormat === 'image/png' ? 'png' : 'jpg'}`;
      link.href = dataUrl;
      link.click();
    }
  };

  const handleResetTransform = () => {
    setZoom(1);
    setRotation(0);
    setPanX(0);
    setPanY(0);
  };

  return (
    <ToolShell
      toolId="id-photo-maker"
      title="Passport & ID Photo Maker"
      description="Prepare portrait photos to common standard passport, visa, and ID dimensions with biometric positioning guides and tiled printable sheets."
      category="image"
      relatedToolIds={['background-remover', 'image-optimizer', 'image-annotator', 'image-collage']}
    >
      <div className="space-y-6">
        {/* Compliance Guidance Notice */}
        <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              Guidance & Specifications Notice:
            </span>{' '}
            Country dimensions and head guidelines are for reference only. Tiny Tools makes no claim
            of official governmental compliance or guaranteed acceptance. Always consult your local
            issuing embassy or agency for exact biometric criteria.
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Canvas Preview Area (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Mode Toggle: Single Photo vs Print Sheet */}
                <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setExportMode('single')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      exportMode === 'single'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    Single Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportMode('sheet')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      exportMode === 'sheet'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    Printable Sheet
                  </button>
                </div>

                {exportMode === 'single' && (
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer select-none text-neutral-600 dark:text-neutral-400">
                      <input
                        type="checkbox"
                        checked={showGuides}
                        onChange={(e) => setShowGuides(e.target.checked)}
                      />
                      <span>Face Guides</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer select-none text-neutral-600 dark:text-neutral-400">
                      <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                      />
                      <span>Center Axis</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Canvas viewport */}
              <div className="relative min-h-[340px] max-h-[480px] bg-neutral-100 dark:bg-neutral-950 rounded-lg overflow-hidden flex items-center justify-center p-4 border border-neutral-200 dark:border-neutral-800">
                {!imageSrc ? (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                        Upload or drop a portrait photo
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        JPEG, PNG, WebP or paste from clipboard (Ctrl+V)
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Select Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="max-w-full max-h-full flex items-center justify-center">
                    <canvas
                      ref={canvasRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      className="max-w-full max-h-[420px] object-contain shadow-md rounded border border-neutral-300 dark:border-neutral-700 cursor-grab active:cursor-grabbing"
                    />
                  </div>
                )}
              </div>

              {/* Pan & Zoom Hint */}
              {imageSrc && exportMode === 'single' && (
                <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
                  <span className="flex items-center gap-1">
                    <Move className="w-3 h-3" />
                    <span>Click and drag canvas to pan position</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResetTransform}
                    className="text-blue-600 hover:underline"
                  >
                    Reset Position
                  </button>
                </div>
              )}
            </div>

            {/* Transform Controls (Zoom / Rotate) */}
            {imageSrc && exportMode === 'single' && (
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span>Framing & Alignment</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Zoom */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                      <span>Scale / Zoom</span>
                      <span className="font-mono">{Math.round(zoom * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ZoomOut className="w-3.5 h-3.5 text-neutral-400" />
                      <input
                        type="range"
                        min="0.3"
                        max="3"
                        step="0.02"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="flex-1 accent-blue-600"
                      />
                      <ZoomIn className="w-3.5 h-3.5 text-neutral-400" />
                    </div>
                  </div>

                  {/* Rotate */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                      <span>Rotation</span>
                      <span className="font-mono">{rotation}°</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRotation((r) => (r - 90 < -180 ? r + 270 : r - 90))}
                        className="p-1 text-neutral-500 hover:text-neutral-800"
                        title="Rotate -90°"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="range"
                        min="-45"
                        max="45"
                        step="0.5"
                        value={rotation}
                        onChange={(e) => setRotation(parseFloat(e.target.value))}
                        className="flex-1 accent-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setRotation((r) => (r + 90 > 180 ? r - 270 : r + 90))}
                        className="p-1 text-neutral-500 hover:text-neutral-800"
                        title="Rotate +90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Background color mode */}
                <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Background Color
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'white', label: 'Solid White', color: '#FFFFFF' },
                      { id: 'light-gray', label: 'Light Gray', color: '#F3F4F6' },
                      { id: 'light-blue', label: 'Soft Blue', color: '#E0F2FE' },
                      { id: 'original', label: 'Original', color: 'transparent' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setBgMode(mode.id as any)}
                        className={`px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1.5 ${
                          bgMode === mode.id
                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-neutral-300"
                          style={{ backgroundColor: mode.color === 'transparent' ? '#FFFFFF' : mode.color }}
                        />
                        <span>{mode.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sizing, Presets & Export Sidebar (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Presets Selector */}
            <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                Passport & ID Presets
              </span>

              <div className="space-y-1.5">
                {ID_PHOTO_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setActivePreset(preset)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                      activePreset.id === preset.id
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-neutral-900 dark:text-neutral-100">{preset.name}</span>
                      <span className="text-blue-600 font-mono text-[11px]">
                        {preset.widthMm} × {preset.heightMm} mm
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">
                      {preset.countryGuidance}
                    </p>
                  </button>
                ))}
              </div>

              {/* Custom Dimension Inputs */}
              {activePreset.id === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                      Width (mm)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="200"
                      value={customWidthMm}
                      onChange={(e) => setCustomWidthMm(parseFloat(e.target.value) || 35)}
                      className="w-full p-2 text-xs border rounded-lg bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                      Height (mm)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="200"
                      value={customHeightMm}
                      onChange={(e) => setCustomHeightMm(parseFloat(e.target.value) || 45)}
                      className="w-full p-2 text-xs border rounded-lg bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Resolution / DPI */}
              <div className="pt-2 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-100 dark:border-neutral-800">
                <span>Target Resolution:</span>
                <select
                  value={dpi}
                  onChange={(e) => setDpi(parseInt(e.target.value, 10))}
                  className="px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-mono"
                >
                  <option value={300}>300 DPI (Standard Print)</option>
                  <option value={600}>600 DPI (High Quality)</option>
                </select>
              </div>
            </div>

            {/* Print Sheet Options (Visible in Sheet mode) */}
            {exportMode === 'sheet' && (
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span>Print Sheet Settings</span>
                </span>

                <div className="space-y-2 text-xs">
                  <div className="space-y-1">
                    <label className="text-neutral-600 dark:text-neutral-400 font-medium">
                      Paper Size
                    </label>
                    <select
                      value={selectedSheet.id}
                      onChange={(e) => {
                        const found = PRINT_SHEET_PRESETS.find((p) => p.id === e.target.value);
                        if (found) setSelectedSheet(found);
                      }}
                      className="w-full p-2 border rounded-lg bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-medium"
                    >
                      {PRINT_SHEET_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-neutral-600 dark:text-neutral-400">Copies to print</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={sheetCopies}
                        onChange={(e) => setSheetCopies(parseInt(e.target.value, 10) || 1)}
                        className="w-full p-1.5 border rounded-lg bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-neutral-600 dark:text-neutral-400">Cut Marks</label>
                      <div className="pt-2">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={includeCutMarks}
                            onChange={(e) => setIncludeCutMarks(e.target.checked)}
                          />
                          <span>Add Lines</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Export & Download Card */}
            <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                Export Options
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setExportFormat('image/jpeg')}
                  className={`p-2 rounded-lg border text-center font-medium ${
                    exportFormat === 'image/jpeg'
                      ? 'border-blue-600 bg-blue-50/40 text-blue-700 dark:text-blue-300'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  JPEG Format
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('image/png')}
                  className={`p-2 rounded-lg border text-center font-medium ${
                    exportFormat === 'image/png'
                      ? 'border-blue-600 bg-blue-50/40 text-blue-700 dark:text-blue-300'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  PNG Format
                </button>
              </div>

              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 space-y-1 pt-1 font-mono">
                <div className="flex justify-between">
                  <span>Photo Dimensions:</span>
                  <span>
                    {targetWidthMm} × {targetHeightMm} mm ({photoPixelW} × {photoPixelH} px)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Print Resolution:</span>
                  <span>{dpi} DPI</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                disabled={!imageSrc}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl shadow-2xs inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>
                  {exportMode === 'single' ? 'Download Passport Photo' : 'Download Printable Sheet'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default IdPhotoMakerTool;
