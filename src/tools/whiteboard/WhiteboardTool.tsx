import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Pencil,
  Highlighter,
  Eraser,
  Minus,
  MoveRight,
  Square,
  Circle,
  Type,
  Hash,
  MousePointer,
  RotateCcw,
  RotateCw,
  Trash2,
  Download,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
} from 'lucide-react';
import {
  WhiteboardTool as ToolType,
  BackgroundPattern,
  BoardElement,
  BoardPoint,
  drawBoardBackground,
  isPointInsideElement,
} from '../../utilities/whiteboard';

export const WhiteboardTool: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [history, setHistory] = useState<BoardElement[][]>([]);
  const [redoStack, setRedoStack] = useState<BoardElement[][]>([]);

  const [color, setColor] = useState('#0f172a');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [bgPattern, setBgPattern] = useState<BackgroundPattern>('grid');

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<BoardElement | null>(null);
  const [markerCount, setMarkerCount] = useState(1);
  const [copied, setCopied] = useState(false);

  // Zoom & Pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Push history snapshot
  const pushHistory = (newElements: BoardElement[]) => {
    setHistory((prev) => [...prev.slice(-30), elements]);
    setRedoStack([]);
    setElements(newElements);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [...r, elements]);
    setHistory((h) => h.slice(0, -1));
    setElements(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((h) => [...h, elements]);
    setRedoStack((r) => r.slice(0, -1));
    setElements(next);
  };

  // Render Canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Background
    drawBoardBackground(ctx, canvas.width, canvas.height, bgPattern);

    // 2. Draw Elements
    const all = [...elements];
    if (currentElement) all.push(currentElement);

    all.forEach((el) => {
      ctx.save();
      ctx.globalAlpha = el.opacity ?? 1;
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'path' && el.points && el.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + (el.width || 0), el.y + (el.height || 0));
        ctx.stroke();
      } else if (el.type === 'arrow') {
        const toX = el.x + (el.width || 0);
        const toY = el.y + (el.height || 0);
        const headLen = 14;
        const angle = Math.atan2(toY - el.y, toX - el.x);

        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (el.type === 'rectangle') {
        ctx.beginPath();
        ctx.strokeRect(el.x, el.y, el.width || 0, el.height || 0);
      } else if (el.type === 'ellipse') {
        const rx = Math.abs(el.width || 0) / 2;
        const ry = Math.abs(el.height || 0) / 2;
        const cx = el.x + (el.width || 0) / 2;
        const cy = el.y + (el.height || 0) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === 'text' && el.text) {
        ctx.font = `${el.fontSize || 18}px sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(el.text, el.x, el.y);
      } else if (el.type === 'marker') {
        const radius = 14;
        ctx.beginPath();
        ctx.arc(el.x, el.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = el.color;
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(el.markerNumber || 1), el.x, el.y);
      }

      ctx.restore();
    });
  }, [elements, currentElement, bgPattern]);

  useEffect(() => {
    render();
  }, [render]);

  // Pointer coordinate calculation
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): BoardPoint => {
    const canvas = canvasRef.current;
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
    const p = getCanvasCoords(e);
    setIsDrawing(true);

    if (activeTool === 'eraser') {
      const remaining = elements.filter((el) => !isPointInsideElement(p.x, p.y, el, 12));
      if (remaining.length !== elements.length) {
        pushHistory(remaining);
      }
      return;
    }

    if (activeTool === 'text') {
      const userText = window.prompt('Enter label text:');
      if (userText && userText.trim()) {
        const newEl: BoardElement = {
          id: `text-${Date.now()}`,
          type: 'text',
          x: p.x,
          y: p.y,
          color,
          strokeWidth: 1,
          opacity: 1,
          text: userText.trim(),
          fontSize: 20,
        };
        pushHistory([...elements, newEl]);
      }
      setIsDrawing(false);
      return;
    }

    if (activeTool === 'marker') {
      const newEl: BoardElement = {
        id: `marker-${Date.now()}`,
        type: 'marker',
        x: p.x,
        y: p.y,
        color,
        strokeWidth: 1,
        opacity: 1,
        markerNumber: markerCount,
      };
      setMarkerCount((c) => c + 1);
      pushHistory([...elements, newEl]);
      setIsDrawing(false);
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setCurrentElement({
        id: `el-${Date.now()}`,
        type: 'path',
        points: [p],
        x: p.x,
        y: p.y,
        color: activeTool === 'highlighter' ? '#fde047' : color,
        strokeWidth: activeTool === 'highlighter' ? 18 : strokeWidth,
        opacity: activeTool === 'highlighter' ? 0.45 : 1,
      });
    } else if (['line', 'arrow', 'rectangle', 'ellipse'].includes(activeTool)) {
      setCurrentElement({
        id: `el-${Date.now()}`,
        type: activeTool as any,
        x: p.x,
        y: p.y,
        width: 0,
        height: 0,
        color,
        strokeWidth,
        opacity: 1,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const p = getCanvasCoords(e);

    if (activeTool === 'eraser') {
      const remaining = elements.filter((el) => !isPointInsideElement(p.x, p.y, el, 12));
      if (remaining.length !== elements.length) {
        setElements(remaining);
      }
      return;
    }

    if (!currentElement) return;

    if (currentElement.type === 'path') {
      setCurrentElement((prev) =>
        prev
          ? {
              ...prev,
              points: [...(prev.points || []), p],
            }
          : null
      );
    } else {
      setCurrentElement((prev) =>
        prev
          ? {
              ...prev,
              width: p.x - prev.x,
              height: p.y - prev.y,
            }
          : null
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);

    if (currentElement) {
      pushHistory([...elements, currentElement]);
      setCurrentElement(null);
    }
  };

  const handleClear = () => {
    if (elements.length === 0) return;
    pushHistory([]);
    setMarkerCount(1);
  };

  // Export handlers
  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whiteboard-sketch-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const handleCopyImage = () => {
    const canvas = canvasRef.current;
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
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl flex flex-wrap items-center justify-between gap-2 border border-slate-200 dark:border-slate-700">
        {/* Drawing Tools */}
        <div className="flex items-center gap-1">
          {[
            { id: 'pen', icon: Pencil, label: 'Pen' },
            { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
            { id: 'eraser', icon: Eraser, label: 'Eraser' },
            { id: 'line', icon: Minus, label: 'Line' },
            { id: 'arrow', icon: MoveRight, label: 'Arrow' },
            { id: 'rectangle', icon: Square, label: 'Rectangle' },
            { id: 'ellipse', icon: Circle, label: 'Circle' },
            { id: 'text', icon: Type, label: 'Text' },
            { id: 'marker', icon: Hash, label: 'Step Marker' },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTool(t.id as ToolType)}
                title={t.label}
                className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        {/* Color and Width */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {['#0f172a', '#2563eb', '#dc2626', '#16a34a', '#d97706'].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full border transition-transform ${
                  color === c ? 'scale-125 ring-2 ring-indigo-500' : 'opacity-80'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{strokeWidth}px</span>
            <input
              type="range"
              min="1"
              max="12"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-16"
            />
          </div>

          {/* Background Selector */}
          <select
            value={bgPattern}
            onChange={(e) => setBgPattern(e.target.value as BackgroundPattern)}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="grid">Grid</option>
            <option value="dots">Dots</option>
            <option value="white">Plain White</option>
            <option value="dark">Dark Canvas</option>
          </select>
        </div>

        {/* History & Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Undo"
            className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo"
            className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            title="Clear Canvas"
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden shadow-sm bg-white dark:bg-slate-900"
      >
        <canvas
          ref={canvasRef}
          width={1200}
          height={650}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-auto touch-none cursor-crosshair"
        />
      </div>

      {/* Export Bar */}
      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
        <span>Draw, explain diagrams, and sketch ideas locally in-browser.</span>
        <div className="flex gap-2">
          <button
            onClick={handleCopyImage}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Image'}
          </button>
          <button
            onClick={handleDownloadPng}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download PNG
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhiteboardTool;
