import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Download,
  Copy,
  Check,
  Trash2,
  MoveLeft,
  MoveRight,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  Image as ImageIcon,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  CollageConfig,
  CollageItem,
  CollageLayoutType,
  AspectRatioPreset,
  renderCollageToCanvas,
  calculateCanvasSize,
  calculateGridDimensions,
} from '../../utilities/image-collage';
import { copyImageToClipboard } from '../../utilities/clipboard';
import { setPendingImageTransfer } from '../../storage/transfer';

export const ImageCollageTool: React.FC = () => {
  const [items, setItems] = useState<CollageItem[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  const [config, setConfig] = useState<CollageConfig>({
    layout: 'auto',
    customRows: 2,
    customCols: 2,
    aspectPreset: 'auto',
    targetWidth: 1200,
    targetHeight: 800,
    gap: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    format: 'image/png',
    quality: 0.92,
  });

  const [copied, setCopied] = useState(false);
  const [transferToast, setTransferToast] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.dataUrl) URL.revokeObjectURL(item.dataUrl);
      });
    };
  }, [items]);

  // Load sample photos for instant testing
  const handleLoadSamplePhotos = () => {
    const samples = [
      { color: '#3B82F6', title: 'Mountain Lake Sunrise' },
      { color: '#10B981', title: 'Forest Trail Morning' },
      { color: '#F59E0B', title: 'Desert Sunset Vista' },
      { color: '#8B5CF6', title: 'Ocean Horizon Dusk' },
    ];

    const newItems: CollageItem[] = samples.map((s, idx) => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 400;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = s.color;
        ctx.fillRect(0, 0, 600, 400);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.title, 300, 190);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(`Sample Photo #${idx + 1} (600x400)`, 300, 225);
      }

      const img = new Image();
      img.src = c.toDataURL('image/png');

      return {
        id: `sample-${idx}-${Date.now()}`,
        blob: new Blob([]),
        dataUrl: img.src,
        imgElement: img,
        filename: `sample-${idx + 1}.png`,
        naturalWidth: 600,
        naturalHeight: 400,
        fitMode: 'cover',
        offsetX: 0.5,
        offsetY: 0.5,
        zoom: 1.0,
      };
    });

    setItems(newItems);
  };

  // Add images from files
  const handleAddFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );

    if (fileArray.length === 0) return;

    fileArray.forEach((file) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const newItem: CollageItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          blob: file,
          dataUrl: url,
          imgElement: img,
          filename: file.name,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          fitMode: 'cover',
          offsetX: 0.5,
          offsetY: 0.5,
          zoom: 1.0,
        };
        setItems((prev) => [...prev.slice(0, 19), newItem]);
      };
      img.src = url;
    });
  }, []);

  // Handle clipboard paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files: File[] = [];
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        handleAddFiles(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleAddFiles]);

  // Re-render collage onto canvas whenever items or config changes
  useEffect(() => {
    if (canvasRef.current && items.length > 0) {
      renderCollageToCanvas(canvasRef.current, items, config);
    }
  }, [items, config]);

  // Move item left/right in order
  const handleMoveItem = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
    setActiveItemIndex(targetIndex);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => {
      const removed = prev[index];
      if (removed.dataUrl) URL.revokeObjectURL(removed.dataUrl);
      return prev.filter((_, i) => i !== index);
    });
    if (activeItemIndex === index) setActiveItemIndex(null);
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    const ext = config.format === 'image/jpeg' ? 'jpg' : config.format === 'image/webp' ? 'webp' : 'png';
    link.download = `collage-${new Date().toISOString().slice(0, 10)}.${ext}`;
    link.href = canvasRef.current.toDataURL(config.format, config.quality);
    link.click();
  };

  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(async (blob) => {
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
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        setPendingImageTransfer(targetToolId, {
          blob,
          filename: `collage-${Date.now()}.png`,
        });
        setTransferToast(`Collage transferred to ${targetToolId}!`);
        setTimeout(() => {
          window.location.hash = `#/tool/${targetToolId}`;
        }, 300);
      }
    }, 'image/png');
  };

  const gridInfo = calculateGridDimensions(config.layout, items.length, config.customRows, config.customCols);
  const canvasSize = calculateCanvasSize(config.aspectPreset, config.targetWidth, config.targetHeight, gridInfo);

  return (
    <ToolShell
      toolId="image-collage"
      title="Image Collage Maker"
      description="Combine multiple photos and screenshots into high-resolution custom collages locally in your browser."
      category="image"
      relatedToolIds={['image-optimizer', 'image-annotator', 'background-remover']}
    >
      <div className="space-y-6">
        {/* Top Action Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-2xs inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Add Images ({items.length}/20)</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleAddFiles(e.target.files);
                e.target.value = '';
              }}
            />

            {items.length === 0 && (
              <button
                type="button"
                onClick={handleLoadSamplePhotos}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Load Sample Grid</span>
              </button>
            )}

            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setItems([])}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                title="Clear all images"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopyImage}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied PNG!' : 'Copy Image'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Collage</span>
                </button>
              </>
            )}
          </div>
        </div>

        {transferToast && (
          <div className="p-2.5 text-xs bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-md">
            {transferToast}
          </div>
        )}

        {items.length === 0 ? (
          /* Empty Dropzone */
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) handleAddFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="p-12 border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 text-center cursor-pointer transition-colors space-y-3"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Drag & Drop Photos or Screenshots Here
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Supports multiple JPEG, PNG, and WebP images (or paste from clipboard with Ctrl+V)
              </p>
            </div>
            <div className="pt-2 flex justify-center items-center gap-2 text-xs text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>100% Client-Side. Images never leave your browser.</span>
            </div>
          </div>
        ) : (
          /* Editor Layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Controls & Image Reordering */}
            <div className="space-y-5">
              {/* Layout Presets */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Layout Structure
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[
                    { id: 'auto', label: 'Auto Grid' },
                    { id: '2-horizontal', label: '2 Side-by-Side' },
                    { id: '2-vertical', label: '2 Stacked' },
                    { id: 'before-after', label: 'Before / After' },
                    { id: '2x2', label: '2 × 2 Grid' },
                    { id: '3x3', label: '3 × 3 Grid' },
                    { id: 'h-strip', label: 'Horiz Strip' },
                    { id: 'v-strip', label: 'Vert Strip' },
                    { id: 'custom', label: 'Custom Rows/Cols' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setConfig({ ...config, layout: l.id as CollageLayoutType })}
                      className={`px-2 py-1.5 rounded border font-medium text-[11px] transition-colors ${
                        config.layout === l.id
                          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                          : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>

                {config.layout === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <div>
                      <label className="text-[11px] text-neutral-500">Rows</label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={config.customRows}
                        onChange={(e) => setConfig({ ...config, customRows: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full mt-1 px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500">Cols</label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={config.customCols}
                        onChange={(e) => setConfig({ ...config, customCols: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full mt-1 px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Canvas & Style Settings */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Canvas & Spacing
                </label>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-neutral-500">Aspect Ratio</label>
                    <select
                      value={config.aspectPreset}
                      onChange={(e) => setConfig({ ...config, aspectPreset: e.target.value as AspectRatioPreset })}
                      className="w-full mt-1 px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                    >
                      <option value="auto">Auto ({gridInfo.cols}:{gridInfo.rows})</option>
                      <option value="1:1">1:1 Square</option>
                      <option value="4:3">4:3 Standard</option>
                      <option value="3:2">3:2 Classic Photo</option>
                      <option value="16:9">16:9 Landscape</option>
                      <option value="9:16">9:16 Story / Reel</option>
                      <option value="custom">Custom Dimensions</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-neutral-500">Background</label>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="color"
                        value={config.backgroundColor}
                        onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                        className="w-7 h-6 p-0 border-0 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.backgroundColor}
                        onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                        className="w-full px-2 py-0.5 text-xs font-mono border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 text-xs">
                  <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                    <span>Cell Gap: {config.gap}px</span>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={config.gap}
                      onChange={(e) => setConfig({ ...config, gap: parseInt(e.target.value) })}
                      className="w-28"
                    />
                  </div>

                  <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                    <span>Outer Padding: {config.padding}px</span>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      value={config.padding}
                      onChange={(e) => setConfig({ ...config, padding: parseInt(e.target.value) })}
                      className="w-28"
                    />
                  </div>

                  <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                    <span>Rounded Corners: {config.borderRadius}px</span>
                    <input
                      type="range"
                      min="0"
                      max="32"
                      value={config.borderRadius}
                      onChange={(e) => setConfig({ ...config, borderRadius: parseInt(e.target.value) })}
                      className="w-28"
                    />
                  </div>
                </div>
              </div>

              {/* Photos List & Reorder */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Images ({items.length})
                  </label>
                  <span className="text-[10px] text-neutral-400">Click to adjust fit/crop</span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => setActiveItemIndex(activeItemIndex === idx ? null : idx)}
                      className={`p-2 rounded flex items-center justify-between gap-2 text-xs border cursor-pointer transition-colors ${
                        activeItemIndex === idx
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700'
                          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono text-[10px] text-neutral-400 w-4">#{idx + 1}</span>
                        <img src={item.dataUrl} alt={item.filename} className="w-8 h-8 rounded object-cover border" />
                        <span className="truncate max-w-[110px] text-neutral-800 dark:text-neutral-200 font-medium">
                          {item.filename}
                        </span>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveItem(idx, 'left')}
                          className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                          title="Move earlier"
                        >
                          <MoveLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === items.length - 1}
                          onClick={() => handleMoveItem(idx, 'right')}
                          className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                          title="Move later"
                        >
                          <MoveRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Selected Item Fit/Crop Controls */}
                {activeItemIndex !== null && items[activeItemIndex] && (
                  <div className="mt-3 p-2.5 rounded bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-900 dark:text-blue-200">
                        Editing Image #{activeItemIndex + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const curr = items[activeItemIndex];
                          const newMode = curr.fitMode === 'cover' ? 'contain' : 'cover';
                          setItems((prev) =>
                            prev.map((it, i) => (i === activeItemIndex ? { ...it, fitMode: newMode } : it))
                          );
                        }}
                        className="px-2 py-0.5 text-[11px] rounded bg-white dark:bg-neutral-800 border"
                      >
                        Mode: {items[activeItemIndex].fitMode === 'cover' ? 'Fill & Crop' : 'Fit Whole'}
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span>Crop Position X</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={items[activeItemIndex].offsetX}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setItems((prev) =>
                              prev.map((it, i) => (i === activeItemIndex ? { ...it, offsetX: val } : it))
                            );
                          }}
                          className="w-24"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span>Crop Position Y</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={items[activeItemIndex].offsetY}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setItems((prev) =>
                              prev.map((it, i) => (i === activeItemIndex ? { ...it, offsetY: val } : it))
                            );
                          }}
                          className="w-24"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Live Canvas Preview */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Collage Output ({canvasSize.width} × {canvasSize.height} px)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTransferTo('image-annotator')}
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Send to Annotator</span>
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleTransferTo('image-optimizer')}
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Send to Optimizer</span>
                  </button>
                </div>
              </div>

              <div className="w-full flex items-center justify-center p-4 bg-neutral-900 rounded-xl overflow-hidden shadow-inner border border-neutral-800">
                <canvas
                  ref={canvasRef}
                  className="max-w-full h-auto max-h-[600px] object-contain rounded-lg shadow-md"
                />
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-neutral-600 dark:text-neutral-400">Export Format:</span>
                  {(['image/png', 'image/jpeg', 'image/webp'] as const).map((fmt) => (
                    <label key={fmt} className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="export-format"
                        checked={config.format === fmt}
                        onChange={() => setConfig({ ...config, format: fmt })}
                      />
                      <span>{fmt.replace('image/', '').toUpperCase()}</span>
                    </label>
                  ))}
                </div>

                {config.format !== 'image/png' && (
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500">Quality:</span>
                    <input
                      type="range"
                      min="0.4"
                      max="1.0"
                      step="0.05"
                      value={config.quality}
                      onChange={(e) => setConfig({ ...config, quality: parseFloat(e.target.value) })}
                      className="w-20"
                    />
                    <span className="font-mono">{Math.round(config.quality * 100)}%</span>
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

export default ImageCollageTool;
