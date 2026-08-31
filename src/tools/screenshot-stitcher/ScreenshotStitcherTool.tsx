import React, { useState, useEffect } from 'react';
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
  SplitSquareVertical,
  AlertCircle,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  StitchItem,
  StitchDirection,
  estimateStitchOverlap,
  calculateStitchDimensions,
  renderStitchedCanvas,
} from '../../utilities/screenshot-stitcher';
import { setPendingTransfer } from '../../storage/transfer';

let stitchIdCounter = 0;
function createStitchId() {
  stitchIdCounter += 1;
  return `stitch-${Date.now()}-${stitchIdCounter}`;
}

export const ScreenshotStitcherTool: React.FC = () => {
  const [items, setItems] = useState<StitchItem[]>([]);
  const [direction, setDirection] = useState<StitchDirection>('vertical');
  const [edgeTrim, setEdgeTrim] = useState<number>(0);
  const [bgColor] = useState<string>('#FFFFFF');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddFiles = (files: File[] | FileList) => {
    const fileArray = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (fileArray.length === 0) {
      setErrorMessage('Please upload valid image files (PNG, JPEG, WebP).');
      return;
    }
    setErrorMessage(null);

    const loadedPromises = fileArray.map((file) =>
      new Promise<StitchItem>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          resolve({
            id: createStitchId(),
            file,
            img,
            width: img.naturalWidth,
            height: img.naturalHeight,
            overlapPx: 0,
          });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error(`Unable to load ${file.name}.`));
        };
        img.src = url;
      })
    );

    Promise.all(loadedPromises)
      .then((newItems) => {
        setItems((previous) => {
          const combined = [...previous, ...newItems];
          return combined.map((item, index) => {
            if (index === 0 || item.overlapPx > 0) return item;
            return {
              ...item,
              overlapPx: estimateStitchOverlap(combined[index - 1].img, item.img, direction),
            };
          });
        });
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load one of these images.');
      });
  };

  // Clipboard paste listener. Direction is intentionally included so newly
  // pasted screenshots use the active orientation's overlap matcher.
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const pasteItems = event.clipboardData?.items;
      if (!pasteItems) return;
      const files: File[] = [];
      for (const item of pasteItems) {
        if (!item.type.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (file) files.push(file);
      }
      if (files.length) handleAddFiles(files);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [direction]);

  // Revoke uploaded object URLs on final unmount. Image objects keep their
  // decoded pixels for canvas rendering while the tool is mounted.
  useEffect(() => {
    return () => {
      for (const item of items) {
        if (item.img.src.startsWith('blob:')) URL.revokeObjectURL(item.img.src);
      }
    };
  }, [items]);

  const moveItem = (idx: number, delta: number) => {
    setItems((previous) => {
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= previous.length) return previous;
      const copy = [...previous];
      [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
      // Reordering changes both adjacent junctions; recompute every junction to
      // avoid carrying an overlap that belonged to the previous sequence.
      return copy.map((item, index) =>
        index === 0
          ? { ...item, overlapPx: 0 }
          : { ...item, overlapPx: estimateStitchOverlap(copy[index - 1].img, item.img, direction) }
      );
    });
  };

  const removeItem = (id: string) => {
    setItems((previous) => {
      const removed = previous.find((item) => item.id === id);
      if (removed?.img.src.startsWith('blob:')) URL.revokeObjectURL(removed.img.src);
      const remaining = previous.filter((item) => item.id !== id);
      return remaining.map((item, index) =>
        index === 0
          ? { ...item, overlapPx: 0 }
          : { ...item, overlapPx: estimateStitchOverlap(remaining[index - 1].img, item.img, direction) }
      );
    });
  };

  const updateOverlap = (idx: number, val: number) => {
    setItems((previous) => {
      const copy = [...previous];
      const maxOverlap = direction === 'vertical' ? copy[idx].height - 1 : copy[idx].width - 1;
      copy[idx] = { ...copy[idx], overlapPx: Math.min(Math.max(0, val), Math.max(0, maxOverlap)) };
      return copy;
    });
  };

  const autoDetectAllOverlaps = (nextDirection = direction) => {
    setItems((previous) =>
      previous.map((item, index) =>
        index === 0
          ? { ...item, overlapPx: 0 }
          : {
              ...item,
              overlapPx: estimateStitchOverlap(previous[index - 1].img, item.img, nextDirection),
            }
      )
    );
  };

  const handleDirectionChange = (nextDirection: StitchDirection) => {
    if (nextDirection === direction) return;
    setDirection(nextDirection);
    autoDetectAllOverlaps(nextDirection);
  };

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
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Image clipboard writing is unavailable.');
      }
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage('Direct image copying is restricted in this browser. Download remains available.');
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
      description="Combine sequential screenshots vertically or horizontally with direction-aware overlap detection and aspect-preserving output."
      category="image"
      relatedToolIds={['image-annotator', 'image-optimizer', 'image-collage']}
    >
      <div className="space-y-6">
        {errorMessage && (
          <div role="alert" className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.files.length > 0) handleAddFiles(event.dataTransfer.files);
          }}
          className="p-6 border-2 border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 text-center hover:border-blue-500 transition-colors bg-white dark:bg-neutral-900"
        >
          <Layers className="w-6 h-6 mx-auto mb-2 text-blue-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            Drop Screenshots or Paste from Clipboard (Ctrl+V)
          </h3>
          <p className="text-xs text-neutral-500 mb-3">
            Add 2 or more sequential screenshots. Auto-match follows the selected stitch direction.
          </p>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs">
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>Add Screenshots</span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => {
                if (event.target.files) handleAddFiles(event.target.files);
                event.target.value = '';
              }}
              className="hidden"
            />
          </label>
        </div>

        {items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {items.length} Screenshots in Sequence
                  </span>
                  <button
                    type="button"
                    onClick={() => autoDetectAllOverlaps()}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    <span>Auto-Match All</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div key={item.id} className="space-y-2">
                      {idx > 0 && (
                        <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-medium text-blue-900 dark:text-blue-300">
                            <span className="flex items-center gap-1">
                              <SplitSquareVertical className={`w-3.5 h-3.5 ${direction === 'horizontal' ? 'rotate-90' : ''}`} aria-hidden="true" />
                              <span>Overlap #{idx} &amp; #{idx + 1}</span>
                            </span>
                            <span className="font-mono">{item.overlapPx} px</span>
                          </div>
                          <input
                            aria-label={`Overlap between screenshot ${idx} and ${idx + 1}`}
                            type="range"
                            min={0}
                            max={Math.max(0, Math.min((direction === 'vertical' ? item.height : item.width) - 10, 400))}
                            value={item.overlapPx}
                            onChange={(event) => updateOverlap(idx, Number(event.target.value))}
                            className="w-full h-1.5 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                      )}

                      <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center gap-3">
                        <div className="w-12 h-14 bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden shrink-0 border border-neutral-300 dark:border-neutral-700">
                          <img src={item.img.src} alt={`Screenshot ${idx + 1} thumbnail`} className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block truncate">
                            #{idx + 1} - {item.file.name}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-mono">
                            {item.width} × {item.height} px
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" aria-label={`Move screenshot ${idx + 1} up`} onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30">
                            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button type="button" aria-label={`Move screenshot ${idx + 1} down`} onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30">
                            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button type="button" aria-label={`Remove screenshot ${idx + 1}`} onClick={() => removeItem(item.id)} className="p-1 rounded text-neutral-400 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Stitch Settings</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-neutral-600 dark:text-neutral-400 block mb-1">Stitch Direction</span>
                    <div className="grid grid-cols-2 gap-1">
                      <button type="button" aria-pressed={direction === 'vertical'} onClick={() => handleDirectionChange('vertical')} className={`py-1 rounded border font-medium ${direction === 'vertical' ? 'bg-blue-600 text-white border-transparent' : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700'}`}>Vertical</button>
                      <button type="button" aria-pressed={direction === 'horizontal'} onClick={() => handleDirectionChange('horizontal')} className={`py-1 rounded border font-medium ${direction === 'horizontal' ? 'bg-blue-600 text-white border-transparent' : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700'}`}>Horizontal</button>
                    </div>
                  </div>

                  <label>
                    <div className="flex justify-between mb-1">
                      <span className="text-neutral-600 dark:text-neutral-400">Trim cross-axis margins</span>
                      <span className="font-mono">{edgeTrim}px</span>
                    </div>
                    <input type="range" min={0} max={50} value={edgeTrim} onChange={(event) => setEdgeTrim(Number(event.target.value))} className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </label>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    Stitched Output Preview ({dimensions.width} × {dimensions.height} px)
                  </span>
                </div>

                {previewUrl && (
                  <div className="max-h-[500px] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-900 p-2 flex justify-center">
                    <img src={previewUrl} alt="Stitched output" className="max-w-full h-auto object-contain rounded shadow-md" />
                  </div>
                )}

                {previewUrl && (
                  <div className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={handleCopyImage} className="py-2 text-xs font-medium rounded-lg border bg-white dark:bg-neutral-800 hover:bg-neutral-100 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center justify-center gap-1.5">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span>{copied ? 'Copied Image!' : 'Copy Image'}</span>
                      </button>

                      <a href={previewUrl} download="stitched-screenshot.png" className="py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-center shadow-2xs inline-flex items-center justify-center gap-1.5">
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Download Image</span>
                      </a>
                    </div>

                    <button type="button" onClick={handleSendToAnnotator} className="w-full py-2 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 inline-flex items-center justify-center gap-1.5">
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
