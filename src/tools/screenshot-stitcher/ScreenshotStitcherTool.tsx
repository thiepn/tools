import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Upload,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Copy,
  Check,
  Sparkles,
  Sliders,
  Maximize2,
  SplitSquareVertical,
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  StitchItem,
  StitchDirection,
  estimateVerticalOverlap,
  calculateStitchDimensions,
  renderStitchedCanvas,
} from '../../utilities/screenshot-stitcher';
import { setPendingTransfer } from '../../storage/transfer';

export const ScreenshotStitcherTool: React.FC = () => {
  const [items, setItems] = useState<StitchItem[]>([]);
  const [direction, setDirection] = useState<StitchDirection>('vertical');
  const [edgeTrim, setEdgeTrim] = useState<number>(0);
  const [showSeams, setShowSeams] = useState<boolean>(false);
  const [bgColor, setBgColor] = useState<string>('#FFFFFF');

  // Preview & Export state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clipboard paste listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const pasteItems = e.clipboardData?.items;
      if (!pasteItems) return;
      for (let i = 0; i < pasteItems.length; i++) {
        if (pasteItems[i].type.startsWith('image/')) {
          const file = pasteItems[i].getAsFile();
          if (file) handleAddFiles([file]);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [items]);

  // Load new images
  const handleAddFiles = (files: File[] | FileList) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      setErrorMessage('Please upload valid image files (PNG, JPEG, WebP).');
      return;
    }
    setErrorMessage(null);

    const loadedPromises = fileArray.map((file) => {
      return new Promise<StitchItem>((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          resolve({
            id: `stitch-${Date.now()}-${Math.random()}`,
            file,
            img,
            width: img.naturalWidth,
            height: img.naturalHeight,
            overlapPx: 0,
          });
        };
        img.src = url;
      });
    });

    Promise.all(loadedPromises).then((newItems) => {
      setItems((prev) => {
        const combined = [...prev, ...newItems];
        // Auto estimate overlap for newly added junctions
        for (let i = 1; i < combined.length; i++) {
          if (combined[i].overlapPx === 0) {
            combined[i].overlapPx = estimateVerticalOverlap(combined[i - 1].img, combined[i].img);
          }
        }
        return combined;
      });
    });
  };

  // Reorder items
  const moveItem = (idx: number, delta: number) => {
    setItems((prev) => {
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = temp;
      return copy;
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateOverlap = (idx: number, val: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], overlapPx: Math.max(0, val) };
      return copy;
    });
  };

  const autoDetectAllOverlaps = () => {
    setItems((prev) => {
      const copy = [...prev];
      for (let i = 1; i < copy.length; i++) {
        copy[i] = {
          ...copy[i],
          overlapPx: estimateVerticalOverlap(copy[i - 1].img, copy[i].img),
        };
      }
      return copy;
    });
  };

  // Update canvas rendering preview whenever items or settings change
  useEffect(() => {
    if (items.length === 0) {
      setPreviewUrl(null);
      return;
    }

    const canvas = renderStitchedCanvas(items, direction, edgeTrim, bgColor);
    setPreviewUrl(canvas.toDataURL('image/png'));
  }, [items, direction, edgeTrim, bgColor]);

  const handleCopyImage = async () => {
    if (!previewUrl) return;
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage('Direct image copying is restricted in this browser context.');
    }
  };

  const handleSendToAnnotator = () => {
    if (!previewUrl) return;
    setPendingTransfer('image-annotator', previewUrl);
    window.location.hash = '#/tool/image-annotator';
  };

  const dimensions = calculateStitchDimensions(items, direction, edgeTrim);

  return (
    <ToolShell
      toolId="screenshot-stitcher"
      title="Screenshot Stitcher"
      description="Combine multiple continuous screenshots into one seamless long image with automatic overlap detection and seam adjustment."
      category="image"
      relatedToolIds={['image-annotator', 'image-optimizer', 'image-collage']}
    >
      <div className="space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Upload Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) handleAddFiles(e.dataTransfer.files);
          }}
          className="p-6 border-2 border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 text-center hover:border-blue-500 transition-colors bg-white dark:bg-neutral-900"
        >
          <Layers className="w-6 h-6 mx-auto mb-2 text-blue-600" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            Drop Screenshots or Paste from Clipboard (Ctrl+V)
          </h3>
          <p className="text-xs text-neutral-500 mb-3">
            Add 2 or more sequential screenshots to stitch into a single continuous image.
          </p>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs">
            <Upload className="w-4 h-4" />
            <span>Add Screenshots</span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
              className="hidden"
            />
          </label>
        </div>

        {items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Ordered Screenshot Items & Overlap Controls */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {items.length} Screenshots in Sequence
                  </span>
                  <button
                    type="button"
                    onClick={autoDetectAllOverlaps}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-Match All</span>
                  </button>
                </div>

                {/* List of sequential screenshot strips */}
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {items.map((it, idx) => (
                    <div key={it.id} className="space-y-2">
                      {/* Junction Overlap Control */}
                      {idx > 0 && (
                        <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-medium text-blue-900 dark:text-blue-300">
                            <span className="flex items-center gap-1">
                              <SplitSquareVertical className="w-3.5 h-3.5" />
                              <span>Overlap #{idx} & #{idx + 1}</span>
                            </span>
                            <span className="font-mono">{it.overlapPx} px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={Math.min(it.height - 10, 400)}
                            value={it.overlapPx}
                            onChange={(e) => updateOverlap(idx, parseInt(e.target.value))}
                            className="w-full h-1.5 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                      )}

                      {/* Screenshot Card */}
                      <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center gap-3">
                        <div className="w-12 h-14 bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden shrink-0 border border-neutral-300 dark:border-neutral-700">
                          <img src={it.img.src} alt="thumb" className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block truncate">
                            #{idx + 1} - {it.file.name}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-mono">
                            {it.width} × {it.height} px
                          </span>
                        </div>

                        {/* Reorder Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveItem(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(idx, 1)}
                            disabled={idx === items.length - 1}
                            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(it.id)}
                            className="p-1 rounded text-neutral-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Layout & Trimming Settings */}
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Stitch Settings
                </h4>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-neutral-600 dark:text-neutral-400 block mb-1">
                      Stitch Direction
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setDirection('vertical')}
                        className={`py-1 rounded border font-medium ${
                          direction === 'vertical'
                            ? 'bg-blue-600 text-white border-transparent'
                            : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700'
                        }`}
                      >
                        Vertical
                      </button>
                      <button
                        type="button"
                        onClick={() => setDirection('horizontal')}
                        className={`py-1 rounded border font-medium ${
                          direction === 'horizontal'
                            ? 'bg-blue-600 text-white border-transparent'
                            : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700'
                        }`}
                      >
                        Horizontal
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-neutral-600 dark:text-neutral-400">Trim Margins</span>
                      <span className="font-mono">{edgeTrim}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={edgeTrim}
                      onChange={(e) => setEdgeTrim(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Live Stitched Image Preview */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    Stitched Output Preview ({dimensions.width} × {dimensions.height} px)
                  </span>
                </div>

                {previewUrl && (
                  <div className="max-h-[500px] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-900 p-2 flex justify-center">
                    <img
                      src={previewUrl}
                      alt="Stitched output"
                      className="max-w-full h-auto object-contain rounded shadow-md"
                    />
                  </div>
                )}

                {/* Actions */}
                {previewUrl && (
                  <div className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleCopyImage}
                        className="py-2 text-xs font-medium rounded-lg border bg-white dark:bg-neutral-800 hover:bg-neutral-100 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center justify-center gap-1.5"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied Image!' : 'Copy Image'}</span>
                      </button>

                      <a
                        href={previewUrl}
                        download="stitched-screenshot.png"
                        className="py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-center shadow-2xs inline-flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Image</span>
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendToAnnotator}
                      className="w-full py-2 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 inline-flex items-center justify-center gap-1.5"
                    >
                      <span>Annotate Stitched Screenshot →</span>
                    </button>
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

export default ScreenshotStitcherTool;
