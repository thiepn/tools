import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PenTool,
  Type,
  Upload,
  Download,
  Copy,
  Check,
  RotateCcw,
  RotateCw,
  Trash2,
  Crop,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import {
  SignatureStroke,
  Point,
  getCanvasContentBounds,
  cropCanvasToContent,
  cleanSignatureImage,
} from '../../utilities/signature';

export const SignatureMakerTool: React.FC = () => {
  const [mode, setMode] = useState<'draw' | 'type' | 'upload'>('draw');

  // Draw Mode State
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [redoStack, setRedoStack] = useState<SignatureStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [inkColor, setInkColor] = useState('#0f172a');

  // Type Mode State
  const [typedName, setTypedName] = useState('Jane Doe');
  const [typedFont, setTypedFont] = useState('cursive');
  const [typedSize, setTypedSize] = useState(64);
  const [typedSlant, setTypedSlant] = useState(0);

  // Upload & Clean State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedImg, setUploadedImg] = useState<HTMLImageElement | null>(null);
  const [cleanThreshold, setCleanThreshold] = useState(200);
  const [cleanContrast, setCleanContrast] = useState(1.3);

  // Shared Output Options
  const [autoCrop, setAutoCrop] = useState(true);
  const [paddingPx, setPaddingPx] = useState(20);
  const [copied, setCopied] = useState(false);

  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const typeCanvasRef = useRef<HTMLCanvasElement>(null);
  const cleanCanvasRef = useRef<HTMLCanvasElement>(null);

  // Redraw Draw Canvas
  const renderDrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw saved strokes
    const allStrokes = [...strokes];
    if (currentPoints.length > 0) {
      allStrokes.push({
        points: currentPoints,
        color: inkColor,
        width: strokeWidth,
      });
    }

    allStrokes.forEach((stroke) => {
      if (stroke.points.length < 1) return;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.points.length === 1) {
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }

      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    });
  }, [strokes, currentPoints, inkColor, strokeWidth]);

  useEffect(() => {
    if (mode === 'draw') {
      renderDrawCanvas();
    }
  }, [mode, renderDrawCanvas]);

  // Render Type Mode Canvas
  useEffect(() => {
    if (mode !== 'type') return;
    const canvas = typeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 300;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    if (typedSlant !== 0) {
      ctx.rotate((typedSlant * Math.PI) / 180);
    }

    ctx.font = `italic ${typedSize}px ${typedFont}`;
    ctx.fillStyle = inkColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName, 0, 0);
    ctx.restore();
  }, [mode, typedName, typedFont, typedSize, typedSlant, inkColor]);

  // Render Upload & Clean Canvas
  useEffect(() => {
    if (mode !== 'upload' || !uploadedImg) return;
    const canvas = cleanCanvasRef.current;
    if (!canvas) return;

    const cleaned = cleanSignatureImage(uploadedImg, cleanThreshold, cleanContrast, inkColor);
    canvas.width = cleaned.width;
    canvas.height = cleaned.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(cleaned, 0, 0);
    }
  }, [mode, uploadedImg, cleanThreshold, cleanContrast, inkColor]);

  // Pointer event handlers for Draw mode
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const p = getCanvasPoint(e);
    setCurrentPoints([p]);
    setRedoStack([]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const p = getCanvasPoint(e);
    setCurrentPoints((prev) => [...prev, p]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    if (currentPoints.length > 0) {
      setStrokes((prev) => [
        ...prev,
        { points: currentPoints, color: inkColor, width: strokeWidth },
      ]);
    }
    setCurrentPoints([]);
  };

  // Undo / Redo for Draw Mode
  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setStrokes((prev) => [...prev, next]);
  };

  const handleClearDraw = () => {
    setStrokes([]);
    setRedoStack([]);
    setCurrentPoints([]);
  };

  // Active Canvas based on Mode
  const getActiveCanvas = (): HTMLCanvasElement | null => {
    if (mode === 'draw') return drawCanvasRef.current;
    if (mode === 'type') return typeCanvasRef.current;
    return cleanCanvasRef.current;
  };

  // Generate final transparent signature canvas
  const getFinalCanvas = (): HTMLCanvasElement | null => {
    const raw = getActiveCanvas();
    if (!raw) return null;
    const ctx = raw.getContext('2d');
    if (!ctx) return raw;

    if (!autoCrop) return raw;

    const bounds = getCanvasContentBounds(ctx, raw.width, raw.height, paddingPx);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return raw;

    return cropCanvasToContent(raw, bounds);
  };

  const handleDownloadPng = () => {
    const canvas = getFinalCanvas();
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signature-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const handleCopyPng = () => {
    const canvas = getFinalCanvas();
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (blob && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }, 'image/png');
  };

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setMode('draw')}
          className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            mode === 'draw'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <PenTool className="w-4 h-4" />
          Draw Signature
        </button>
        <button
          onClick={() => setMode('type')}
          className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            mode === 'type'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Type className="w-4 h-4" />
          Type Signature
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            mode === 'upload'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload & Clean
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-4 space-y-4">
          {mode === 'draw' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Pen Thickness ({strokeWidth}px)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Ink Color
                </label>
                <div className="flex items-center gap-3">
                  {[
                    { id: '#0f172a', name: 'Black' },
                    { id: '#1e3a8a', name: 'Navy Blue' },
                    { id: '#047857', name: 'Emerald' },
                    { id: '#b91c1c', name: 'Red' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setInkColor(c.id)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        inkColor === c.id ? 'ring-2 ring-indigo-500 scale-110' : 'opacity-80'
                      }`}
                      style={{ backgroundColor: c.id }}
                      title={c.name}
                    />
                  ))}
                  <input
                    type="color"
                    value={inkColor}
                    onChange={(e) => setInkColor(e.target.value)}
                    className="w-7 h-7 rounded border cursor-pointer p-0"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleUndo}
                  disabled={strokes.length === 0}
                  className="flex-1 py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Undo
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="flex-1 py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-40"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Redo
                </button>
                <button
                  onClick={handleClearDraw}
                  className="py-1.5 px-3 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>
          )}

          {mode === 'type' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Full Name / Initials
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Font Style
                </label>
                <select
                  value={typedFont}
                  onChange={(e) => setTypedFont(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="cursive">Classic Cursive</option>
                  <option value="'Brush Script MT', cursive">Brush Script</option>
                  <option value="'Great Vibes', cursive, 'Snell Roundhand'">Calligraphy Script</option>
                  <option value="Georgia, serif">Formal Serif</option>
                  <option value="system-ui, sans-serif">Modern Hand</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Slant ({typedSlant}°)
                </label>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={typedSlant}
                  onChange={(e) => setTypedSlant(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {mode === 'upload' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Signature Photo on Paper
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadedFile(f);
                      const img = new Image();
                      const url = URL.createObjectURL(f);
                      img.onload = () => setUploadedImg(img);
                      img.src = url;
                    }
                  }}
                  className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300 cursor-pointer"
                />
              </div>

              {uploadedImg && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span>Paper Background Removal</span>
                      <span>{cleanThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min="120"
                      max="245"
                      value={cleanThreshold}
                      onChange={(e) => setCleanThreshold(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span>Ink Contrast</span>
                      <span>{cleanContrast.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="3.0"
                      step="0.1"
                      value={cleanContrast}
                      onChange={(e) => setCleanContrast(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cropping and Padding Options */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                Auto-crop tightly to signature bounds
              </label>
              <input
                type="checkbox"
                checked={autoCrop}
                onChange={(e) => setAutoCrop(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
            </div>

            {autoCrop && (
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Padding Border</span>
                  <span>{paddingPx}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={paddingPx}
                  onChange={(e) => setPaddingPx(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-2.5 text-[11px] text-amber-800 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Generates transparent PNG graphic assets only. Does not produce digital cryptographic certificates or legal document authorizations.
            </span>
          </div>
        </div>

        {/* Canvas Display Column */}
        <div className="lg:col-span-8 space-y-4">
          <div
            className="p-6 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center min-h-[300px] overflow-hidden"
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          >
            {mode === 'draw' && (
              <canvas
                ref={drawCanvasRef}
                width={800}
                height={300}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="w-full max-w-full h-auto bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 touch-none cursor-crosshair"
              />
            )}

            {mode === 'type' && (
              <canvas
                ref={typeCanvasRef}
                width={800}
                height={300}
                className="w-full max-w-full h-auto bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800"
              />
            )}

            {mode === 'upload' && (
              <canvas
                ref={cleanCanvasRef}
                className="max-w-full max-h-[340px] bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800"
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={handleCopyPng}
              className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard' : 'Copy Transparent PNG'}
            </button>

            <button
              onClick={handleDownloadPng}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download Transparent PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureMakerTool;
