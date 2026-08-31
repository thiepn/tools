import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Circle, Copy, Download, Eraser, FileDown, FileUp, Hash, Highlighter, Minus, MousePointer, MoveRight, Pencil, RotateCcw, RotateCw, Square, Trash2, Type } from 'lucide-react';
import {
  type BackgroundPattern,
  type BoardElement,
  type BoardPoint,
  type BoardState,
  type WhiteboardTool as ToolType,
  drawBoardBackground,
  findTopmostElementAt,
  getElementBoundingBox,
  isPointInsideElement,
  parseBoardState,
  serializeBoardState,
  simplifyBoardPath,
  translateBoardElement,
} from '../../utilities/whiteboard';

const STORAGE_KEY = 'tiny-tools:whiteboard:v1';
const createId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export const WhiteboardTool: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [history, setHistory] = useState<BoardElement[][]>([]);
  const [redoStack, setRedoStack] = useState<BoardElement[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [color, setColor] = useState('#0f172a');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [bgPattern, setBgPattern] = useState<BackgroundPattern>('grid');
  const [currentElement, setCurrentElement] = useState<BoardElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [markerCount, setMarkerCount] = useState(1);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<BoardPoint | null>(null);
  const dragOriginalRef = useRef<BoardElement | null>(null);
  const eraserSnapshotRef = useRef<BoardElement[] | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const board = parseBoardState(saved);
      if (board) { setElements(board.elements); setBgPattern(board.background); setMarkerCount(Math.max(1, ...board.elements.filter((el) => el.type === 'marker').map((el) => (el.markerNumber || 0) + 1))); }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const board: BoardState = { version: 1, id: 'default', title: 'Whiteboard', elements, background: bgPattern, updatedAt: Date.now() };
        localStorage.setItem(STORAGE_KEY, serializeBoardState(board));
      } catch {}
    }, 180);
    return () => clearTimeout(timer);
  }, [bgPattern, elements]);

  const commit = useCallback((next: BoardElement[], previous = elements) => {
    setHistory((items) => [...items.slice(-49), previous]);
    setRedoStack([]);
    setElements(next);
  }, [elements]);

  const undo = useCallback(() => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setRedoStack((items) => [...items, elements]);
    setHistory((items) => items.slice(0, -1));
    setElements(previous); setSelectedId(null);
  }, [elements, history]);
  const redo = useCallback(() => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((items) => [...items, elements]);
    setRedoStack((items) => items.slice(0, -1));
    setElements(next); setSelectedId(null);
  }, [elements, redoStack]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault(); commit(elements.filter((element) => element.id !== selectedId)); setSelectedId(null);
      }
      if (event.key === 'Escape') { setSelectedId(null); setCurrentElement(null); setIsDrawing(false); }
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, [commit, elements, redo, selectedId, undo]);

  const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: BoardElement) => {
    ctx.save(); ctx.globalAlpha = element.opacity ?? 1; ctx.strokeStyle = element.color; ctx.fillStyle = element.color; ctx.lineWidth = element.strokeWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (element.type === 'path' && element.points?.length) {
      ctx.beginPath(); ctx.moveTo(element.points[0].x, element.points[0].y);
      for (let i = 1; i < element.points.length; i++) { const previous = element.points[i - 1], point = element.points[i]; const midX = (previous.x + point.x) / 2, midY = (previous.y + point.y) / 2; ctx.quadraticCurveTo(previous.x, previous.y, midX, midY); }
      ctx.stroke();
    } else if (element.type === 'line' || element.type === 'arrow') {
      const x2 = element.x + (element.width || 0), y2 = element.y + (element.height || 0); ctx.beginPath(); ctx.moveTo(element.x, element.y); ctx.lineTo(x2, y2); ctx.stroke();
      if (element.type === 'arrow') { const angle = Math.atan2(y2 - element.y, x2 - element.x), head = Math.max(12, element.strokeWidth * 3.5); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6)); ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6)); ctx.closePath(); ctx.fill(); }
    } else if (element.type === 'rectangle') ctx.strokeRect(element.x, element.y, element.width || 0, element.height || 0);
    else if (element.type === 'ellipse') { const width = element.width || 0, height = element.height || 0; ctx.beginPath(); ctx.ellipse(element.x + width / 2, element.y + height / 2, Math.max(1, Math.abs(width) / 2), Math.max(1, Math.abs(height) / 2), 0, 0, Math.PI * 2); ctx.stroke(); }
    else if (element.type === 'text' && element.text) { ctx.font = `${element.fontSize || 20}px sans-serif`; ctx.textBaseline = 'top'; for (const [index, line] of element.text.split('\n').entries()) ctx.fillText(line, element.x, element.y + index * (element.fontSize || 20) * 1.2); }
    else if (element.type === 'marker') { ctx.beginPath(); ctx.arc(element.x, element.y, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(element.markerNumber || 1), element.x, element.y); }
    ctx.restore();
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    drawBoardBackground(ctx, canvas.width, canvas.height, bgPattern);
    [...elements, ...(currentElement ? [currentElement] : [])].forEach((element) => drawElement(ctx, element));
    const selected = elements.find((element) => element.id === selectedId);
    if (selected) { const box = getElementBoundingBox(selected); ctx.save(); ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(box.minX - 6, box.minY - 6, Math.max(12, box.width + 12), Math.max(12, box.height + 12)); ctx.restore(); }
  }, [bgPattern, currentElement, drawElement, elements, selectedId]);
  useEffect(() => render(), [render]);

  const coords = (event: React.PointerEvent<HTMLCanvasElement>): BoardPoint => {
    const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 }; const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); const point = coords(event);
    if (activeTool === 'select') {
      const selected = findTopmostElementAt(elements, point.x, point.y, 10); setSelectedId(selected?.id || null); dragStartRef.current = point; dragOriginalRef.current = selected; setIsDrawing(Boolean(selected)); return;
    }
    setSelectedId(null);
    if (activeTool === 'eraser') { eraserSnapshotRef.current = elements; setIsDrawing(true); const next = elements.filter((element) => !isPointInsideElement(point.x, point.y, element, 14)); setElements(next); return; }
    if (activeTool === 'text') { const value = window.prompt('Enter text (line breaks supported):'); if (value?.trim()) commit([...elements, { id: createId('text'), type: 'text', x: point.x, y: point.y, color, strokeWidth: 1, opacity: 1, text: value.trim(), fontSize: 20 }]); return; }
    if (activeTool === 'marker') { commit([...elements, { id: createId('marker'), type: 'marker', x: point.x, y: point.y, color, strokeWidth: 1, opacity: 1, markerNumber: markerCount }]); setMarkerCount((count) => count + 1); return; }
    setIsDrawing(true);
    if (activeTool === 'pen' || activeTool === 'highlighter') setCurrentElement({ id: createId('path'), type: 'path', points: [point], x: point.x, y: point.y, color: activeTool === 'highlighter' ? '#fde047' : color, strokeWidth: activeTool === 'highlighter' ? 18 : strokeWidth, opacity: activeTool === 'highlighter' ? 0.42 : 1 });
    else setCurrentElement({ id: createId('shape'), type: activeTool as BoardElement['type'], x: point.x, y: point.y, width: 0, height: 0, color, strokeWidth, opacity: 1 });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return; event.preventDefault(); const point = coords(event);
    if (activeTool === 'select' && dragStartRef.current && dragOriginalRef.current) { const dx = point.x - dragStartRef.current.x, dy = point.y - dragStartRef.current.y, original = dragOriginalRef.current; setElements((current) => current.map((element) => element.id === original.id ? translateBoardElement(original, dx, dy) : element)); return; }
    if (activeTool === 'eraser') { setElements((current) => current.filter((element) => !isPointInsideElement(point.x, point.y, element, 14))); return; }
    setCurrentElement((current) => !current ? null : current.type === 'path' ? { ...current, points: [...(current.points || []), point] } : { ...current, width: point.x - current.x, height: point.y - current.y });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return; event.preventDefault(); setIsDrawing(false);
    if (activeTool === 'select' && dragOriginalRef.current) { const original = dragOriginalRef.current; const changed = elements.find((element) => element.id === original.id); if (changed && (changed.x !== original.x || changed.y !== original.y)) setHistory((items) => [...items.slice(-49), elements.map((element) => element.id === original.id ? original : element)]); setRedoStack([]); dragStartRef.current = null; dragOriginalRef.current = null; return; }
    if (activeTool === 'eraser') { const previous = eraserSnapshotRef.current; if (previous && previous.length !== elements.length) { setHistory((items) => [...items.slice(-49), previous]); setRedoStack([]); } eraserSnapshotRef.current = null; return; }
    if (currentElement) { const finalElement = currentElement.type === 'path' && currentElement.points ? { ...currentElement, points: simplifyBoardPath(currentElement.points, 0.9) } : currentElement; commit([...elements, finalElement]); setCurrentElement(null); }
  };

  const exportPng = () => { const canvas = canvasRef.current; if (!canvas) return; canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`; link.click(); URL.revokeObjectURL(url); }, 'image/png'); };
  const copyImage = () => { const canvas = canvasRef.current; if (!canvas) return; canvas.toBlob(async (blob) => { try { if (!blob || !navigator.clipboard?.write) throw new Error(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setStatus('Image clipboard is unavailable in this browser context.'); } }, 'image/png'); };
  const exportBoard = () => { const raw = serializeBoardState({ version: 1, id: 'default', title: 'Whiteboard', elements, background: bgPattern, updatedAt: Date.now() }); const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'whiteboard.tinyboard.json'; link.click(); URL.revokeObjectURL(url); };
  const importBoard = async (file: File) => { const board = parseBoardState(await file.text()); if (!board) { setStatus('That file is not a valid Tiny Tools whiteboard.'); return; } commit(board.elements); setBgPattern(board.background); setSelectedId(null); setStatus(`Imported ${board.elements.length} elements.`); };

  const tools = [
    { id: 'select', icon: MousePointer, label: 'Select / move' }, { id: 'pen', icon: Pencil, label: 'Pen' }, { id: 'highlighter', icon: Highlighter, label: 'Highlighter' }, { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'line', icon: Minus, label: 'Line' }, { id: 'arrow', icon: MoveRight, label: 'Arrow' }, { id: 'rectangle', icon: Square, label: 'Rectangle' }, { id: 'ellipse', icon: Circle, label: 'Ellipse' }, { id: 'text', icon: Type, label: 'Text' }, { id: 'marker', icon: Hash, label: 'Step marker' },
  ] as const;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-100 p-2.5 dark:border-slate-700 dark:bg-slate-800/80">
      <div className="flex flex-wrap gap-1">{tools.map((tool) => { const Icon = tool.icon; return <button key={tool.id} type="button" title={tool.label} onClick={() => setActiveTool(tool.id)} className={`rounded-lg p-2 ${activeTool === tool.id ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}><Icon className="h-4 w-4" /></button>; })}</div>
      <div className="flex items-center gap-2"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-7 w-7" /><input type="range" min="1" max="14" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} className="w-20" /><span className="text-[11px] text-slate-500">{strokeWidth}px</span><select value={bgPattern} onChange={(event) => setBgPattern(event.target.value as BackgroundPattern)} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="grid">Grid</option><option value="dots">Dots</option><option value="white">White</option><option value="dark">Dark</option></select></div>
      <div className="flex gap-1"><button title="Undo (Ctrl/Cmd+Z)" onClick={undo} disabled={!history.length} className="rounded-lg p-2 disabled:opacity-30"><RotateCcw className="h-4 w-4" /></button><button title="Redo" onClick={redo} disabled={!redoStack.length} className="rounded-lg p-2 disabled:opacity-30"><RotateCw className="h-4 w-4" /></button><button title="Clear" onClick={() => { if (elements.length) { commit([]); setSelectedId(null); setMarkerCount(1); } }} className="rounded-lg p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div>
    </div>

    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"><canvas ref={canvasRef} width={1200} height={650} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className={`h-auto w-full touch-none ${activeTool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`} /></div>
    {status && <div className="text-xs text-slate-500" role="status">{status}</div>}
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Autosaves locally. Select objects to move them; Delete removes the selected object; Ctrl/Cmd+Z undoes.</span><div className="flex flex-wrap gap-2"><input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBoard(file); event.target.value = ''; }} /><button onClick={() => importRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800"><FileUp className="h-3.5 w-3.5" />Import board</button><button onClick={exportBoard} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800"><FileDown className="h-3.5 w-3.5" />Save board</button><button onClick={copyImage} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy PNG'}</button><button onClick={exportPng} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white"><Download className="h-3.5 w-3.5" />Download PNG</button></div></div>
  </div>;
};

export default WhiteboardTool;
