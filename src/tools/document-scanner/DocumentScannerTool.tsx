import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, Copy, Download, Maximize2, RefreshCw, RotateCcw, RotateCw, ScanText, Upload } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  applyScanFilters,
  calculateWarpDimensions,
  detectDefaultCorners,
  orderQuadCorners,
  validateDocumentQuad,
  warpPerspectiveCanvas,
  type Point2D,
  type ScanFilterMode,
  type ScanOptions,
} from '../../utilities/document-scanner';
import { setPendingTransfer } from '../../storage/transfer';

export const DocumentScannerTool: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [corners, setCorners] = useState<[Point2D, Point2D, Point2D, Point2D] | null>(null);
  const [activeCorner, setActiveCorner] = useState<number | null>(null);
  const [filter, setFilter] = useState<ScanFilterMode>('enhanced');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(15);
  const [threshold, setThreshold] = useState(128);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const cropRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    for (const track of streamRef.current?.getTracks() || []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => {
    stopCamera();
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
  }, [stopCamera]);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => setError('Unable to start the camera preview in this browser.'));
  }, [cameraActive]);

  const loadImage = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please provide a valid image file (JPEG, PNG, WebP).'); return; }
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    const url = URL.createObjectURL(file); sourceUrlRef.current = url;
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height) { setError('The image has no usable dimensions.'); return; }
      setImageSrc(url); setDimensions({ width, height }); setCorners(detectDefaultCorners(width, height)); setResultUrl(null); setRotation(0); setFilter('enhanced'); setError(null); setStatus('Adjust the four corners, then generate the scan.');
    };
    image.onerror = () => setError('The browser could not decode that image.');
    image.src = url;
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      for (const item of event.clipboardData?.items || []) if (item.type.startsWith('image/')) { const file = item.getAsFile(); if (file) loadImage(file); break; }
    };
    window.addEventListener('paste', onPaste); return () => window.removeEventListener('paste', onPaste);
  }, []);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream; setCameraActive(true);
    } catch { setError('Camera access was blocked or not available.'); }
  };

  const capture = () => {
    const video = videoRef.current; if (!video) return;
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) loadImage(new File([blob], 'camera-document.jpg', { type: 'image/jpeg' })); }, 'image/jpeg', 0.96);
    stopCamera();
  };

  const pointerPosition = (event: React.PointerEvent): Point2D | null => {
    if (!cropRef.current || !dimensions) return null;
    const rect = cropRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(dimensions.width, (event.clientX - rect.left) * dimensions.width / rect.width)),
      y: Math.max(0, Math.min(dimensions.height, (event.clientY - rect.top) * dimensions.height / rect.height)),
    };
  };
  const onCornerDown = (index: number, event: React.PointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.stopPropagation(); setActiveCorner(index); event.currentTarget.setPointerCapture(event.pointerId); };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activeCorner === null || !corners) return;
    const point = pointerPosition(event); if (!point) return;
    const next = [...corners] as [Point2D, Point2D, Point2D, Point2D]; next[activeCorner] = point; setCorners(next); setResultUrl(null); setStatus('Corners changed — generate the scan to update the result.');
  };
  const onPointerUp = () => setActiveCorner(null);

  const generate = async () => {
    if (!imageRef.current || !corners || !dimensions || rendering) return;
    setRendering(true); setError(null); setStatus(null);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      const ordered = orderQuadCorners(corners);
      if (!validateDocumentQuad(ordered)) throw new Error('The four crop corners overlap or form an invalid document shape.');
      const size = calculateWarpDimensions(ordered);
      // Limit pathological camera images while retaining more than enough resolution for OCR/printing.
      const scale = Math.min(1, 3200 / Math.max(size.width, size.height));
      const width = Math.max(100, Math.round(size.width * scale)), height = Math.max(100, Math.round(size.height * scale));
      const warped = warpPerspectiveCanvas(imageRef.current, ordered, width, height);
      const options: ScanOptions = { filter, brightness, contrast, bwThreshold: threshold, sharpen: true, rotation };
      const result = applyScanFilters(warped, options);
      setResultUrl(result.toDataURL('image/png'));
      setStatus(`Generated ${result.width} × ${result.height} scan. ${filter === 'bw' && threshold === 128 ? 'B/W threshold selected automatically from the document histogram.' : ''}`.trim());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed to generate the document scan.'); }
    finally { setRendering(false); }
  };

  const download = () => { if (!resultUrl) return; const link = document.createElement('a'); link.href = resultUrl; link.download = `document-scan-${new Date().toISOString().slice(0, 10)}.png`; link.click(); };
  const copy = async () => {
    if (!resultUrl) return;
    try { const blob = await (await fetch(resultUrl)).blob(); if (!navigator.clipboard?.write) throw new Error(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setStatus('Copied scan image.'); }
    catch { setError('Direct image copying is not supported in this browser context.'); }
  };
  const sendToOcr = () => { if (!resultUrl) return; setPendingTransfer('image-to-text', resultUrl); window.location.hash = '#/tool/image-to-text'; };
  const reset = () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current); sourceUrlRef.current = null;
    setImageSrc(null); setDimensions(null); setCorners(null); setResultUrl(null); setError(null); setStatus(null); stopCamera();
  };

  return <ToolShell toolId="document-scanner" title="Document Scanner & Straightener" description="Correct document perspective with four precise corners, high-quality projective sampling, automatic B/W thresholding, and local camera/upload workflows." category="productivity" relatedToolIds={['image-to-text', 'image-annotator', 'image-optimizer']}>
    <div className="space-y-5">
      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {status && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">{status}</div>}

      {cameraActive && <div className="space-y-3 rounded-xl border border-neutral-800 bg-black p-4 text-center"><div className="mx-auto aspect-video max-w-2xl overflow-hidden rounded-lg bg-neutral-950"><video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" /></div><div className="flex justify-center gap-3"><button type="button" onClick={stopCamera} className="rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-white">Cancel</button><button type="button" onClick={capture} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white"><Camera className="h-4 w-4" />Snap Document</button></div></div>}

      {!imageSrc && !cameraActive ? <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) loadImage(file); }} className="rounded-xl border-2 border-dashed border-neutral-300 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-900"><ScanText className="mx-auto h-9 w-9 text-blue-600" /><h3 className="mt-3 text-sm font-semibold">Select a document photo</h3><p className="mt-1 text-xs text-neutral-500">Upload, drop, paste, or capture a receipt/document. Corner positioning is manual and deterministic rather than pretending browser-only edge detection is always reliable.</p><div className="mt-4 flex flex-wrap justify-center gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"><Upload className="h-4 w-4" />Browse Photo<input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) loadImage(file); event.target.value = ''; }} /></label>{typeof navigator !== 'undefined' && navigator.mediaDevices && <button type="button" onClick={() => void startCamera()} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800"><Camera className="h-4 w-4 text-emerald-600" />Use Camera</button>}</div></div> : imageSrc && dimensions && corners && <>
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="flex items-center gap-1.5 font-semibold"><Maximize2 className="h-4 w-4" />Drag four corners to the document boundary</span><button onClick={() => { setCorners(detectDefaultCorners(dimensions.width, dimensions.height)); setResultUrl(null); }} className="text-blue-600 hover:underline">Reset corners</button></div><div ref={cropRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-neutral-950" style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}><img ref={imageRef} src={imageSrc} alt="Source document" className="absolute inset-0 h-full w-full" /><svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} preserveAspectRatio="none"><polygon points={corners.map((point) => `${point.x},${point.y}`).join(' ')} fill="rgba(37,99,235,.16)" stroke="#3b82f6" strokeWidth={Math.max(2, dimensions.width / 500)} vectorEffect="non-scaling-stroke" /></svg>{corners.map((point, index) => <button key={index} type="button" aria-label={`Document corner ${index + 1}`} onPointerDown={(event) => onCornerDown(index, event)} className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-blue-600 shadow-lg" style={{ left: `${point.x / dimensions.width * 100}%`, top: `${point.y / dimensions.height * 100}%` }} />)}</div></div>
          <div className="space-y-4 lg:col-span-5"><section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900"><h3 className="font-bold">Scan enhancement</h3><label>Mode<select value={filter} onChange={(event) => { setFilter(event.target.value as ScanFilterMode); setResultUrl(null); }} className="mt-1 w-full rounded border bg-white px-2 py-2 dark:bg-neutral-950"><option value="enhanced">Enhanced color</option><option value="grayscale">Grayscale</option><option value="bw">Black & white</option><option value="original">Original colors</option></select></label><label>Brightness {brightness}<input type="range" min="-80" max="80" value={brightness} onChange={(event) => { setBrightness(Number(event.target.value)); setResultUrl(null); }} className="w-full" /></label><label>Contrast {contrast}<input type="range" min="-80" max="80" value={contrast} onChange={(event) => { setContrast(Number(event.target.value)); setResultUrl(null); }} className="w-full" /></label>{filter === 'bw' && <label>Threshold {threshold === 128 ? 'Auto (Otsu)' : threshold}<input type="range" min="80" max="200" value={threshold} onChange={(event) => { setThreshold(Number(event.target.value)); setResultUrl(null); }} className="w-full" /><button type="button" onClick={() => { setThreshold(128); setResultUrl(null); }} className="mt-1 text-blue-600 hover:underline">Use automatic threshold</button></label>}<div className="flex gap-2"><button onClick={() => { setRotation((((rotation - 90) + 360) % 360) as 0 | 90 | 180 | 270); setResultUrl(null); }} className="rounded border p-2"><RotateCcw className="h-4 w-4" /></button><button onClick={() => { setRotation(((rotation + 90) % 360) as 0 | 90 | 180 | 270); setResultUrl(null); }} className="rounded border p-2"><RotateCw className="h-4 w-4" /></button><span className="self-center text-neutral-500">Rotate output {rotation}°</span></div><button type="button" onClick={() => void generate()} disabled={rendering} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${rendering ? 'animate-spin' : ''}`} />{rendering ? 'Rendering high-quality scan…' : resultUrl ? 'Update Scan' : 'Generate Scan'}</button></section></div>
        </div>

        {resultUrl && <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20"><div className="text-xs font-bold">Scanned result</div><div className="flex max-h-[680px] justify-center overflow-auto rounded-lg bg-neutral-900 p-3"><img src={resultUrl} alt="Perspective-corrected document scan" className="max-w-full object-contain" /></div><div className="flex flex-wrap gap-2"><button onClick={download} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Download className="h-4 w-4" />Download PNG</button><button onClick={() => void copy()} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs dark:bg-neutral-900"><Copy className="h-4 w-4" />Copy image</button><button onClick={sendToOcr} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs dark:bg-neutral-900"><ScanText className="h-4 w-4" />Send to OCR</button></div></section>}
        <button onClick={reset} className="text-xs text-neutral-500 hover:text-red-600">Clear source and start over</button>
      </>}
    </div>
  </ToolShell>;
};

export default DocumentScannerTool;
