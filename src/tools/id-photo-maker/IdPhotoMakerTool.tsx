import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Download, HelpCircle, Move, Printer, RotateCcw, RotateCw, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  ID_PHOTO_PRESETS,
  PRINT_SHEET_PRESETS,
  assessSourceResolution,
  calculateCoverPlacement,
  calculatePrintSheetLayout,
  drawPrintCutMarks,
  mmToPixels,
  type IdPhotoPreset,
  type PrintSheetPreset,
} from '../../utilities/id-photo-maker';

export const IdPhotoMakerTool: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [preset, setPreset] = useState<IdPhotoPreset>(ID_PHOTO_PRESETS[0]);
  const [customWidthMm, setCustomWidthMm] = useState(35);
  const [customHeightMm, setCustomHeightMm] = useState(45);
  const [dpi, setDpi] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGuides, setShowGuides] = useState(true);
  const [exportMode, setExportMode] = useState<'single' | 'sheet'>('single');
  const [sheet, setSheet] = useState<PrintSheetPreset>(PRINT_SHEET_PRESETS[0]);
  const [copies, setCopies] = useState(6);
  const [marginMm, setMarginMm] = useState(5);
  const [gapMm, setGapMm] = useState(3);
  const [cutMarks, setCutMarks] = useState(true);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [error, setError] = useState('');
  const previewRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  const widthMm = preset.id === 'custom' ? customWidthMm : preset.widthMm;
  const heightMm = preset.id === 'custom' ? customHeightMm : preset.heightMm;
  const outputWidth = mmToPixels(widthMm, dpi);
  const outputHeight = mmToPixels(heightMm, dpi);

  const loadImage = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Select a browser-decodable image file.'); return; }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file), next = new Image();
    next.onload = () => { setImage(next); setImageUrl(url); setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); setError(''); };
    next.onerror = () => { URL.revokeObjectURL(url); setError('The image could not be decoded.'); };
    next.src = url;
  };

  const placement = useMemo(() => image ? calculateCoverPlacement(image.naturalWidth, image.naturalHeight, outputWidth, outputHeight, zoom, pan.x, pan.y, rotation) : null, [image, outputHeight, outputWidth, pan.x, pan.y, rotation, zoom]);
  useEffect(() => { if (placement && (placement.panX !== pan.x || placement.panY !== pan.y)) setPan({ x: placement.panX, y: placement.panY }); }, [placement, pan.x, pan.y]);

  const sourceAssessment = useMemo(() => image ? assessSourceResolution(image.naturalWidth, image.naturalHeight, outputWidth, outputHeight) : null, [image, outputHeight, outputWidth]);

  const renderSingle = useCallback((): HTMLCanvasElement | null => {
    if (!image || !placement || outputWidth <= 0 || outputHeight <= 0) return null;
    const canvas = document.createElement('canvas'); canvas.width = outputWidth; canvas.height = outputHeight;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(canvas.width / 2 + placement.panX, canvas.height / 2 + placement.panY); ctx.rotate(rotation * Math.PI / 180); ctx.scale(placement.scale, placement.scale); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2); ctx.restore();
    return canvas;
  }, [image, outputHeight, outputWidth, placement, rotation]);

  const drawGuides = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const minHead = Math.max(0.35, preset.headMinPercent / 100), maxHead = Math.min(0.9, preset.headMaxPercent / 100);
    ctx.save(); ctx.lineWidth = Math.max(2, width * 0.004); ctx.strokeStyle = 'rgba(37,99,235,.8)'; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
    const centerY = height * 0.48;
    for (const [ratio, alpha] of [[minHead, .55], [maxHead, .9]] as const) { const ovalH = height * ratio, ovalW = Math.min(width * .72, ovalH * .72); ctx.globalAlpha = alpha; ctx.beginPath(); ctx.ellipse(width / 2, centerY, ovalW / 2, ovalH / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(220,38,38,.8)'; ctx.beginPath(); ctx.moveTo(width * .15, height * .42); ctx.lineTo(width * .85, height * .42); ctx.stroke(); ctx.restore();
  }, [preset.headMaxPercent, preset.headMinPercent]);

  useEffect(() => {
    const preview = previewRef.current; if (!preview) return;
    const ctx = preview.getContext('2d'); if (!ctx) return;
    if (exportMode === 'single') {
      preview.width = Math.max(1, outputWidth); preview.height = Math.max(1, outputHeight); ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, preview.width, preview.height);
      const single = renderSingle(); if (single) ctx.drawImage(single, 0, 0); if (single && showGuides) drawGuides(ctx, preview.width, preview.height);
    } else {
      const layout = calculatePrintSheetLayout(sheet.widthMm, sheet.heightMm, widthMm, heightMm, { dpi, requestedCopies: copies, marginMm, gapMm });
      preview.width = Math.max(1, layout.sheetWidthPx); preview.height = Math.max(1, layout.sheetHeightPx); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, preview.width, preview.height);
      const single = renderSingle(); if (single) layout.positions.forEach((position) => ctx.drawImage(single, position.x, position.y, position.width, position.height)); if (cutMarks) drawPrintCutMarks(ctx, layout.positions);
    }
  }, [copies, cutMarks, dpi, drawGuides, exportMode, gapMm, heightMm, marginMm, outputHeight, outputWidth, renderSingle, sheet, showGuides, widthMm]);

  const download = () => {
    let canvas: HTMLCanvasElement | null = null, name = '';
    if (exportMode === 'single') { canvas = renderSingle(); name = `id-photo-${widthMm}x${heightMm}mm`; }
    else {
      const layout = calculatePrintSheetLayout(sheet.widthMm, sheet.heightMm, widthMm, heightMm, { dpi, requestedCopies: copies, marginMm, gapMm });
      canvas = document.createElement('canvas'); canvas.width = layout.sheetWidthPx; canvas.height = layout.sheetHeightPx; const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); const single = renderSingle(); if (single) layout.positions.forEach((position) => ctx.drawImage(single!, position.x, position.y, position.width, position.height)); if (cutMarks) drawPrintCutMarks(ctx, layout.positions); name = `id-photo-sheet-${sheet.id}-${layout.actualCopies}copies`;
    }
    if (!canvas) return; canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `${name}.${format === 'image/png' ? 'png' : 'jpg'}`; link.click(); URL.revokeObjectURL(url); }, format, 0.96);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!image || exportMode !== 'single') return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, panX: pan.x, panY: pan.y }; };
  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => { const drag = dragRef.current, canvas = previewRef.current; if (!drag || !canvas) return; const rect = canvas.getBoundingClientRect(); const dx = (event.clientX - drag.pointerX) * canvas.width / rect.width, dy = (event.clientY - drag.pointerY) * canvas.height / rect.height; const safe = calculateCoverPlacement(image!.naturalWidth, image!.naturalHeight, outputWidth, outputHeight, zoom, drag.panX + dx, drag.panY + dy, rotation); setPan({ x: safe.panX, y: safe.panY }); };
  const onPointerUp = () => { dragRef.current = null; };

  return <ToolShell toolId="id-photo-maker" title="Passport & ID Photo Maker" description="Frame portraits to exact physical dimensions with edge-safe panning, resolution checks, biometric positioning guides, and printable photo sheets." category="image" relatedToolIds={['background-remover', 'image-optimizer', 'image-annotator']}>
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"><HelpCircle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Preparation aid, not biometric certification.</strong> Dimensions and guide ranges are references. Tiny Tools does not detect eyes, head boundaries, expression, shadows, or country-specific acceptance rules; verify the current issuing authority.</span></div>
      {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"><AlertCircle className="h-4 w-4" />{error}</div>}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex rounded-lg bg-neutral-100 p-1 text-xs dark:bg-neutral-800"><button onClick={() => setExportMode('single')} className={`rounded-md px-3 py-1.5 ${exportMode === 'single' ? 'bg-white shadow dark:bg-neutral-900' : ''}`}>Single photo</button><button onClick={() => setExportMode('sheet')} className={`rounded-md px-3 py-1.5 ${exportMode === 'sheet' ? 'bg-white shadow dark:bg-neutral-900' : ''}`}>Print sheet</button></div><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><Upload className="h-4 w-4" />{image ? 'Change photo' : 'Select photo'}<input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) loadImage(file); event.target.value = ''; }} /></label></div>
          <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-950">{image ? <canvas ref={previewRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className={`max-h-[500px] max-w-full object-contain shadow-md ${exportMode === 'single' ? 'touch-none cursor-grab active:cursor-grabbing' : ''}`} /> : <div className="text-center text-xs text-neutral-500"><Upload className="mx-auto mb-2 h-8 w-8" />Upload a straight-on, well-lit portrait.</div>}</div>
          {image && exportMode === 'single' && <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900 sm:grid-cols-2"><label><div className="flex justify-between"><span>Zoom</span><span>{Math.round(zoom * 100)}%</span></div><div className="flex items-center gap-2"><ZoomOut className="h-3.5 w-3.5" /><input type="range" min="1" max="3" step="0.02" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="flex-1" /><ZoomIn className="h-3.5 w-3.5" /></div></label><div className="flex items-center justify-between gap-2"><button onClick={() => { setRotation((((rotation - 90) + 360) % 360) as 0 | 90 | 180 | 270); setPan({ x: 0, y: 0 }); }} className="rounded border px-3 py-2"><RotateCcw className="h-4 w-4" /></button><button onClick={() => { setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); }} className="inline-flex items-center gap-1 rounded border px-3 py-2"><Move className="h-4 w-4" />Reset</button><button onClick={() => { setRotation(((rotation + 90) % 360) as 0 | 90 | 180 | 270); setPan({ x: 0, y: 0 }); }} className="rounded border px-3 py-2"><RotateCw className="h-4 w-4" /></button></div><label className="flex items-center gap-2"><input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} />Show manual face/eye guides</label><span className="text-neutral-500">Drag the preview to reposition. Panning is clamped so blank edges cannot enter the export.</span></div>}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900"><h3 className="font-bold">Photo specification</h3><label>Preset<select value={preset.id} onChange={(event) => { const next = ID_PHOTO_PRESETS.find((item) => item.id === event.target.value); if (next) { setPreset(next); setZoom(1); setPan({ x: 0, y: 0 }); } }} className="mt-1 w-full rounded border bg-white px-2 py-2 dark:bg-neutral-950">{ID_PHOTO_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{preset.id === 'custom' && <div className="grid grid-cols-2 gap-2"><label>Width mm<input type="number" min="10" max="150" value={customWidthMm} onChange={(event) => setCustomWidthMm(Math.max(10, Number(event.target.value) || 35))} className="mt-1 w-full rounded border px-2 py-2 dark:bg-neutral-950" /></label><label>Height mm<input type="number" min="10" max="150" value={customHeightMm} onChange={(event) => setCustomHeightMm(Math.max(10, Number(event.target.value) || 45))} className="mt-1 w-full rounded border px-2 py-2 dark:bg-neutral-950" /></label></div>}<label>DPI<select value={dpi} onChange={(event) => setDpi(Number(event.target.value))} className="mt-1 w-full rounded border bg-white px-2 py-2 dark:bg-neutral-950"><option value={300}>300 DPI</option><option value={600}>600 DPI</option></select></label><div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-950"><div className="font-mono">{outputWidth} × {outputHeight} px · {widthMm} × {heightMm} mm</div><div className="mt-1 text-neutral-500">Guide range: head roughly {preset.headMinPercent}–{preset.headMaxPercent}% of photo height. {preset.countryGuidance}</div></div>{sourceAssessment && <div className={`rounded-lg border p-3 ${sourceAssessment.adequate ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'}`}><strong>{sourceAssessment.adequate ? 'Resolution check: good' : 'Resolution check: upscaling'}</strong><div className="mt-1 text-neutral-500">{sourceAssessment.sourceMegapixels} MP source → {sourceAssessment.outputMegapixels} MP output. {sourceAssessment.message}</div></div>}</div>

          {exportMode === 'sheet' && <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900"><h3 className="flex items-center gap-1 font-bold"><Printer className="h-4 w-4" />Print sheet</h3><label>Sheet<select value={sheet.id} onChange={(event) => { const next = PRINT_SHEET_PRESETS.find((item) => item.id === event.target.value); if (next) setSheet(next); }} className="mt-1 w-full rounded border bg-white px-2 py-2 dark:bg-neutral-950">{PRINT_SHEET_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="grid grid-cols-3 gap-2"><label>Copies<input type="number" min="1" max="50" value={copies} onChange={(event) => setCopies(Math.max(1, Math.floor(Number(event.target.value) || 1)))} className="mt-1 w-full rounded border px-2 py-2 dark:bg-neutral-950" /></label><label>Margin mm<input type="number" min="0" max="30" value={marginMm} onChange={(event) => setMarginMm(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded border px-2 py-2 dark:bg-neutral-950" /></label><label>Gap mm<input type="number" min="0" max="20" value={gapMm} onChange={(event) => setGapMm(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded border px-2 py-2 dark:bg-neutral-950" /></label></div><label className="flex items-center gap-2"><input type="checkbox" checked={cutMarks} onChange={(event) => setCutMarks(event.target.checked)} />Include cut marks</label></div>}

          <div className="flex flex-wrap items-end justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900"><label>Format<select value={format} onChange={(event) => setFormat(event.target.value as 'image/jpeg' | 'image/png')} className="mt-1 block rounded border bg-white px-2 py-2 dark:bg-neutral-950"><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option></select></label><button onClick={download} disabled={!image} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-40"><Download className="h-4 w-4" />Download {exportMode === 'single' ? 'photo' : 'sheet'}</button></div>
        </div>
      </div>
    </div>
  </ToolShell>;
};

export default IdPhotoMakerTool;
