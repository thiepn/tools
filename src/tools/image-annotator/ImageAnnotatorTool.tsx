import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Download,
  Copy,
  Check,
  Undo,
  Redo,
  Trash2,
  ArrowUpRight,
  Minus,
  Square,
  Circle,
  Highlighter,
  EyeOff,
  Type,
  ListOrdered,
  RefreshCw,
  Image as ImageIcon,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import {
  AnnotationTool,
  AnnotationItem,
  renderAnnotations,
} from '../../utilities/image-annotator';
import { setPendingImageTransfer, consumePendingImageTransfer } from '../../storage/transfer';

interface ImageAnnotatorToolProps {
  initialText?: string;
}

export const ImageAnnotatorTool: React.FC<ImageAnnotatorToolProps> = () => {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceFilename, setSourceFilename] = useState<string>('screenshot.png');
  const [activeTool, setActiveTool] = useState<AnnotationTool>('arrow');
  const [strokeColor, setStrokeColor] = useState<string>('#EF4444'); // Red default
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [textInput, setTextInput] = useState<string>('Note');
  const [stepCounter, setStepCounter] = useState<number>(1);

  // History Stack
  const [history, setHistory] = useState<AnnotationItem[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const currentAnnotations = history[historyIndex] || [];

  // Interaction State
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [activeHighlighterPoints, setActiveHighlighterPoints] = useState<{ x: number; y: number }[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  // DOM Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to load sample test canvas
  const handleLoadSample = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw simulated UI dashboard screenshot
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, 800, 500);

      // Header bar
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, 800, 60);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Project Dashboard - Analytics & Settings', 24, 38);

      // Cards
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(30, 90, 220, 140, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(280, 90, 220, 140, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(530, 90, 240, 140, 8);
      ctx.fill();

      // Card Content
      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px sans-serif';
      ctx.fillText('Monthly Active Users', 50, 125);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('128,420', 50, 165);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px sans-serif';
      ctx.fillText('API Secret Key (Confidential)', 300, 125);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '14px monospace';
      ctx.fillText('sk_live_9948274a10f', 300, 160);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px sans-serif';
      ctx.fillText('Conversion Rate', 550, 125);
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('+24.8%', 550, 165);

      // Bottom section
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(30, 260, 740, 200, 8);
      ctx.fill();
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '14px sans-serif';
      ctx.fillText('Audit Log - Recent User Actions', 50, 295);

      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setSourceFilename('sample-dashboard.png');
        setHistory([[]]);
        setHistoryIndex(0);
        setStepCounter(1);
      };
      img.src = canvas.toDataURL('image/png');
    }
  };

  // Load image
  const loadImage = useCallback((blob: Blob, name = 'screenshot.png') => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      setSourceFilename(name);
      setHistory([[]]);
      setHistoryIndex(0);
      setStepCounter(1);
    };
    img.src = url;
  }, []);

  // Check transferred image on mount
  useEffect(() => {
    const transferred = consumePendingImageTransfer('image-annotator');
    if (transferred && transferred.blob) {
      loadImage(transferred.blob, transferred.filename || 'annotated-image.png');
    }
  }, [loadImage]);

  // Global Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            loadImage(file, 'pasted-screenshot.png');
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [loadImage]);

  // Render canvas whenever annotations or image change
  useEffect(() => {
    if (!canvasRef.current || !sourceImage) return;
    const canvas = canvasRef.current;
    canvas.width = sourceImage.naturalWidth;
    canvas.height = sourceImage.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      renderAnnotations(ctx, currentAnnotations, sourceImage);
    }
  }, [sourceImage, currentAnnotations]);

  // Push new state to history
  const pushAnnotation = (item: AnnotationItem) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...currentAnnotations, item]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleClearAll = () => {
    if (currentAnnotations.length === 0) return;
    pushAnnotation({
      id: 'clear',
      type: 'rect',
      color: 'transparent',
      strokeWidth: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Convert client mouse/touch to canvas coordinate space
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !sourceImage) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = sourceImage.naturalWidth / rect.width;
    const scaleY = sourceImage.naturalHeight / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Mouse & Touch Handlers
  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!sourceImage) return;
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setDragStart(coords);

    if (activeTool === 'highlighter') {
      setActiveHighlighterPoints([coords]);
    } else if (activeTool === 'text') {
      pushAnnotation({
        id: `text-${Date.now()}`,
        type: 'text',
        color: strokeColor,
        strokeWidth,
        x: coords.x,
        y: coords.y,
        text: textInput || 'Note',
        fontSize: Math.max(16, strokeWidth * 5),
      });
      setIsDrawing(false);
    } else if (activeTool === 'stepBadge') {
      pushAnnotation({
        id: `badge-${Date.now()}`,
        type: 'stepBadge',
        color: strokeColor,
        strokeWidth,
        x: coords.x,
        y: coords.y,
        number: stepCounter,
      });
      setStepCounter((prev) => prev + 1);
      setIsDrawing(false);
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !dragStart || !sourceImage) return;
    const coords = getCanvasCoords(e);

    if (activeTool === 'highlighter') {
      setActiveHighlighterPoints((prev) => [...prev, coords]);
      // Live draw highlighter preview
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          renderAnnotations(ctx, currentAnnotations, sourceImage);
          ctx.save();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth * 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(dragStart.x, dragStart.y);
          activeHighlighterPoints.forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.stroke();
          ctx.restore();
        }
      }
    } else {
      // Live preview shapes on canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          renderAnnotations(ctx, currentAnnotations, sourceImage);
          ctx.save();
          ctx.strokeStyle = strokeColor;
          ctx.fillStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = 'round';

          if (activeTool === 'arrow') {
            ctx.beginPath();
            ctx.moveTo(dragStart.x, dragStart.y);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
          } else if (activeTool === 'line') {
            ctx.beginPath();
            ctx.moveTo(dragStart.x, dragStart.y);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
          } else if (activeTool === 'rect' || activeTool === 'redact') {
            const w = coords.x - dragStart.x;
            const h = coords.y - dragStart.y;
            ctx.strokeRect(dragStart.x, dragStart.y, w, h);
          } else if (activeTool === 'circle') {
            const rx = (coords.x - dragStart.x) / 2;
            const ry = (coords.y - dragStart.y) / 2;
            ctx.beginPath();
            ctx.ellipse(
              dragStart.x + rx,
              dragStart.y + ry,
              Math.abs(rx),
              Math.abs(ry),
              0,
              0,
              2 * Math.PI
            );
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }
  };

  const handlePointerUp = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !dragStart) return;
    const coords = getCanvasCoords(e);
    setIsDrawing(false);

    if (activeTool === 'arrow') {
      pushAnnotation({
        id: `arrow-${Date.now()}`,
        type: 'arrow',
        color: strokeColor,
        strokeWidth,
        startX: dragStart.x,
        startY: dragStart.y,
        endX: coords.x,
        endY: coords.y,
      });
    } else if (activeTool === 'line') {
      pushAnnotation({
        id: `line-${Date.now()}`,
        type: 'line',
        color: strokeColor,
        strokeWidth,
        startX: dragStart.x,
        startY: dragStart.y,
        endX: coords.x,
        endY: coords.y,
      });
    } else if (activeTool === 'rect') {
      const minX = Math.min(dragStart.x, coords.x);
      const minY = Math.min(dragStart.y, coords.y);
      const w = Math.abs(coords.x - dragStart.x);
      const h = Math.abs(coords.y - dragStart.y);
      if (w > 3 && h > 3) {
        pushAnnotation({
          id: `rect-${Date.now()}`,
          type: 'rect',
          color: strokeColor,
          strokeWidth,
          x: minX,
          y: minY,
          width: w,
          height: h,
        });
      }
    } else if (activeTool === 'circle') {
      const rx = (coords.x - dragStart.x) / 2;
      const ry = (coords.y - dragStart.y) / 2;
      if (Math.abs(rx) > 3 && Math.abs(ry) > 3) {
        pushAnnotation({
          id: `circle-${Date.now()}`,
          type: 'circle',
          color: strokeColor,
          strokeWidth,
          centerX: dragStart.x + rx,
          centerY: dragStart.y + ry,
          radiusX: rx,
          radiusY: ry,
        });
      }
    } else if (activeTool === 'highlighter') {
      if (activeHighlighterPoints.length > 1) {
        pushAnnotation({
          id: `hl-${Date.now()}`,
          type: 'highlighter',
          color: strokeColor,
          strokeWidth: strokeWidth * 4,
          points: activeHighlighterPoints,
        });
      }
      setActiveHighlighterPoints([]);
    } else if (activeTool === 'redact') {
      const minX = Math.min(dragStart.x, coords.x);
      const minY = Math.min(dragStart.y, coords.y);
      const w = Math.abs(coords.x - dragStart.x);
      const h = Math.abs(coords.y - dragStart.y);
      if (w > 3 && h > 3) {
        pushAnnotation({
          id: `redact-${Date.now()}`,
          type: 'redact',
          color: '#000000',
          strokeWidth: 1,
          x: minX,
          y: minY,
          width: w,
          height: h,
        });
      }
    }
    setDragStart(null);
  };

  // Download Export
  const handleDownload = (format: 'image/png' | 'image/webp') => {
    if (!canvasRef.current) return;
    const ext = format === 'image/webp' ? 'webp' : 'png';
    const link = document.createElement('a');
    link.href = canvasRef.current.toDataURL(format, 0.92);
    link.download = `annotated-${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy to Clipboard
  const handleCopyCanvas = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(async (blob) => {
      if (blob && navigator.clipboard && navigator.clipboard.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // fallback
        }
      }
    }, 'image/png');
  };

  // Send to Image Optimizer
  const handleSendToOptimizer = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        setPendingImageTransfer('image-optimizer', {
          blob,
          filename: `annotated-${sourceFilename}`,
          dataUrl: canvasRef.current?.toDataURL('image/png'),
        });
        window.location.hash = '#/tool/image-optimizer';
      }
    }, 'image/png');
  };

  return (
    <ToolShell
      toolId="image-annotator"
      title="Screenshot & Image Annotator"
      description="Draw arrows, boxes, badges, highlights, and redact sensitive information locally on images and screenshots."
      category="image"
      relatedToolIds={['image-optimizer', 'color-converter']}
    >
      <div className="space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              loadImage(e.target.files[0], e.target.files[0].name);
            }
          }}
        />

        {/* 1. Upload Placeholder if no image */}
        {!sourceImage ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                loadImage(e.dataTransfer.files[0], e.dataTransfer.files[0].name);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 rounded-xl p-8 sm:p-12 text-center bg-neutral-50 dark:bg-neutral-900/50 cursor-pointer space-y-4"
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Click or drag & drop a screenshot to annotate
              </h3>
              <p className="text-xs text-neutral-500">
                You can also paste directly with <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-800 rounded font-mono text-[11px]">Ctrl+V</kbd> or <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-800 rounded font-mono text-[11px]">⌘V</kbd>.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-md">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Client-Side. Redactions and annotations never leave your device.</span>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <span className="text-xs text-neutral-500">Need a sample image to test?</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadSample();
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Load Sample Dashboard</span>
              </button>
            </div>
          </div>
        ) : (
          /* 2. Image Loaded - Full Canvas Studio */
          <div className="space-y-4">
            {/* Top Interactive Toolbar */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg flex flex-wrap items-center justify-between gap-3">
              {/* Tool Selection Group */}
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
                  { id: 'line', label: 'Line', icon: Minus },
                  { id: 'rect', label: 'Box', icon: Square },
                  { id: 'circle', label: 'Circle', icon: Circle },
                  { id: 'highlighter', label: 'Highlight', icon: Highlighter },
                  { id: 'redact', label: 'Redact (Blur)', icon: EyeOff },
                  { id: 'text', label: 'Callout Text', icon: Type },
                  { id: 'stepBadge', label: 'Step #', icon: ListOrdered },
                ].map((t) => {
                  const IconC = t.icon;
                  const isSel = activeTool === t.id;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTool(t.id as AnnotationTool)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                        isSel
                          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-2xs'
                          : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100'
                      }`}
                    >
                      <IconC className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Color & Size Controls */}
              <div className="flex items-center gap-3">
                {/* Color swatches */}
                <div className="flex items-center gap-1">
                  {['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#FFFFFF', '#000000'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setStrokeColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        strokeColor === c ? 'scale-110 border-neutral-900 dark:border-white shadow-xs' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>

                {/* Stroke width selector */}
                <select
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  className="px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded font-medium"
                >
                  <option value={2}>Thin (2px)</option>
                  <option value={4}>Medium (4px)</option>
                  <option value={8}>Thick (8px)</option>
                </select>

                {/* Undo / Redo / Clear */}
                <div className="flex items-center gap-1 border-l border-neutral-200 dark:border-neutral-800 pl-2">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded disabled:opacity-30"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded disabled:opacity-30"
                    title="Redo"
                  >
                    <Redo className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={currentAnnotations.length === 0}
                    className="p-1.5 text-neutral-400 hover:text-rose-600 rounded disabled:opacity-30"
                    title="Clear All Annotations"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Text input if text tool active */}
            {activeTool === 'text' && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs">
                <span className="font-semibold text-blue-700 dark:text-blue-300">Callout Text:</span>
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type note and click canvas to place..."
                  className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-neutral-900 border border-blue-300 dark:border-blue-700 rounded"
                />
              </div>
            )}

            {/* Main Interactive Canvas Area */}
            <div className="w-full bg-neutral-200 dark:bg-neutral-900 rounded-xl overflow-auto p-4 flex items-center justify-center min-h-[350px] max-h-[600px] border border-neutral-300 dark:border-neutral-800">
              <canvas
                ref={canvasRef}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                className="max-w-full object-contain cursor-crosshair rounded shadow-md bg-white select-none touch-none"
              />
            </div>

            {/* Bottom Export & Chaining Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300"
                >
                  Replace Screenshot
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCanvas}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Image!' : 'Copy to Clipboard'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload('image/png')}
                  className="px-3.5 py-1.5 text-xs font-bold rounded bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PNG</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendToOptimizer}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 inline-flex items-center gap-1.5"
                  title="Send to Image Optimizer to resize, compress, or convert"
                >
                  <span>Send to Optimizer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default ImageAnnotatorTool;
