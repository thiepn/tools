import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Download, Film, Images, Trash2, Upload } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { encodeGif, type GifFrameInput } from '../../utilities/gif-maker';
import { fitMemeTextLayout } from '../../utilities/meme-maker';
import { formatVideoFileSize, formatVideoTime } from '../../utilities/video-toolkit';

interface ImageFrame { id: string; image: HTMLImageElement; url: string; filename: string; delayMs: number }
const MAX_PIXEL_FRAMES = 32_000_000;

function waitForSeek(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.01) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('Timed out while seeking the video.')); }, 5000);
    const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', done); video.removeEventListener('error', failed); };
    const done = () => { cleanup(); resolve(); }; const failed = () => { cleanup(); reject(new Error('Could not decode a requested video frame.')); };
    video.addEventListener('seeked', done, { once: true }); video.addEventListener('error', failed, { once: true }); video.currentTime = time;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource & { width?: number; height?: number; videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number }, width: number, height: number) {
  const sourceWidth = image.videoWidth || image.naturalWidth || image.width || width;
  const sourceHeight = image.videoHeight || image.naturalHeight || image.height || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight), drawWidth = sourceWidth * scale, drawHeight = sourceHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, position: 'top' | 'bottom' | 'center', color: string, width: number, height: number) {
  if (!text.trim()) return;
  const maxWidth = width * 0.9, maxHeight = Math.min(height * 0.35, 180);
  let currentSize = Math.max(16, Math.round(width * 0.07));
  const setFont = (size: number) => { currentSize = size; ctx.font = `bold ${size}px Impact, Arial Black, sans-serif`; };
  setFont(currentSize);
  const layout = fitMemeTextLayout(text.toLocaleUpperCase(), currentSize, maxWidth, maxHeight, setFont, (value) => ctx.measureText(value).width);
  const centerY = position === 'top' ? 20 + layout.totalHeight / 2 : position === 'center' ? height / 2 : height - 20 - layout.totalHeight / 2;
  ctx.save(); setFont(layout.fontSize); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, layout.fontSize * 0.13);
  const startY = centerY - layout.totalHeight / 2 + layout.lineHeight / 2;
  layout.lines.forEach((line, index) => { const y = startY + index * layout.lineHeight; ctx.strokeText(line, width / 2, y, maxWidth); ctx.fillText(line, width / 2, y, maxWidth); }); ctx.restore();
}

export const GifMakerTool: React.FC = () => {
  const [mode, setMode] = useState<'video' | 'images'>('video');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(4);
  const [images, setImages] = useState<ImageFrame[]>([]);
  const [fps, setFps] = useState(10);
  const [width, setWidth] = useState(480);
  const [defaultDelay, setDefaultDelay] = useState(180);
  const [loopCount, setLoopCount] = useState(0);
  const [caption, setCaption] = useState('');
  const [captionPosition, setCaptionPosition] = useState<'top' | 'bottom' | 'center'>('bottom');
  const [captionColor, setCaptionColor] = useState('#ffffff');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const imagesRef = useRef<ImageFrame[]>([]);

  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => () => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    imagesRef.current.forEach((frame) => URL.revokeObjectURL(frame.url));
  }, []);

  const setResult = (blob: Blob) => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    const url = URL.createObjectURL(blob); resultUrlRef.current = url; setResultUrl(url); setResultSize(blob.size);
  };
  const clearResult = () => { if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current); resultUrlRef.current = null; setResultUrl(null); setResultSize(null); };

  const selectVideo = (file: File) => {
    if (!file.type.startsWith('video/')) { setError('Select a browser-decodable video file.'); return; }
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    const url = URL.createObjectURL(file); videoUrlRef.current = url; setVideoFile(file); setVideoUrl(url); clearResult(); setError(null);
  };
  const loadImages = async (list: FileList | File[]) => {
    const files = Array.from(list).filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, 120 - images.length));
    const loaded = await Promise.all(files.map((file) => new Promise<ImageFrame>((resolve, reject) => {
      const url = URL.createObjectURL(file), image = new Image();
      image.onload = () => resolve({ id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, image, url, filename: file.name, delayMs: defaultDelay });
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not decode ${file.name}.`)); }; image.src = url;
    })));
    setImages((current) => [...current, ...loaded]); clearResult();
  };
  const removeImage = (id: string) => setImages((current) => { const target = current.find((frame) => frame.id === id); if (target) URL.revokeObjectURL(target.url); return current.filter((frame) => frame.id !== id); });
  const moveImage = (index: number, direction: -1 | 1) => setImages((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });

  const videoHeight = useMemo(() => {
    const video = videoRef.current; if (!video?.videoWidth || !video.videoHeight) return Math.round(width * 9 / 16); return Math.max(1, Math.round(width * video.videoHeight / video.videoWidth));
  }, [videoDuration, width]);
  const imageHeight = useMemo(() => images[0] ? Math.max(1, Math.round(width * images[0].image.naturalHeight / images[0].image.naturalWidth)) : Math.round(width * 3 / 4), [images, width]);

  const guardBudget = (frameCount: number, height: number) => {
    const pixelFrames = frameCount * width * height;
    if (pixelFrames > MAX_PIXEL_FRAMES) throw new Error(`This request would process ${(pixelFrames / 1_000_000).toFixed(1)} million pixel-frames. Reduce width, FPS, or clip length below roughly ${MAX_PIXEL_FRAMES / 1_000_000} million to avoid exhausting browser memory.`);
  };

  const generateFromVideo = async () => {
    const video = videoRef.current; if (!video || !videoFile || generating) return;
    const start = Math.max(0, Math.min(videoDuration, trimStart)), end = Math.max(start + 0.1, Math.min(videoDuration, trimEnd));
    const duration = end - start, frameCount = Math.max(2, Math.ceil(duration * fps)), height = videoHeight;
    try {
      guardBudget(frameCount, height); setGenerating(true); setProgress(0); setError(null); clearResult(); video.pause();
      const frames: GifFrameInput[] = [];
      for (let index = 0; index < frameCount; index++) {
        const time = start + Math.min(duration, index / Math.max(1, frameCount - 1) * duration); await waitForSeek(video, time);
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('Canvas rendering is unavailable.');
        drawCover(ctx, video, width, height); drawCaption(ctx, caption, captionPosition, captionColor, width, height); frames.push({ canvas, delayMs: Math.round(1000 / fps) }); setProgress(Math.round((index + 1) / frameCount * 45));
      }
      const blob = encodeGif(frames, width, height, loopCount, (percent) => setProgress(45 + Math.round(percent * 0.55))); setResult(blob); setProgress(100);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'GIF generation failed.'); }
    finally { setGenerating(false); }
  };

  const generateFromImages = () => {
    if (!images.length || generating) return; const height = imageHeight;
    try {
      guardBudget(images.length, height); setGenerating(true); setProgress(0); setError(null); clearResult();
      const frames = images.map((frame, index) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('Canvas rendering is unavailable.');
        drawCover(ctx, frame.image, width, height); drawCaption(ctx, caption, captionPosition, captionColor, width, height); setProgress(Math.round((index + 1) / images.length * 30)); return { canvas, delayMs: Math.max(20, frame.delayMs) };
      });
      const blob = encodeGif(frames, width, height, loopCount, (percent) => setProgress(30 + Math.round(percent * 0.7))); setResult(blob); setProgress(100);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'GIF generation failed.'); }
    finally { setGenerating(false); }
  };

  const download = () => { if (!resultUrl) return; const link = document.createElement('a'); link.href = resultUrl; link.download = `tiny-tools-${Date.now()}.gif`; link.click(); };

  return <ToolShell toolId="gif-maker" title="Animated GIF Maker" description="Convert video clips or image sequences to GIF with adaptive color quantization, safe workload limits, per-frame timing, captions, and local export." category="media" relatedToolIds={['video-toolkit', 'image-optimizer', 'image-collage']}>
    <div className="space-y-5">
      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      <div className="flex gap-4 border-b border-neutral-200 dark:border-neutral-800"><button onClick={() => setMode('video')} className={`flex items-center gap-1.5 border-b-2 pb-2.5 text-xs font-bold ${mode === 'video' ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500'}`}><Film className="h-4 w-4" />Video to GIF</button><button onClick={() => setMode('images')} className={`flex items-center gap-1.5 border-b-2 pb-2.5 text-xs font-bold ${mode === 'images' ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500'}`}><Images className="h-4 w-4" />Images to GIF</button></div>

      {mode === 'video' ? <div className="grid gap-5 lg:grid-cols-12"><div className="space-y-3 lg:col-span-7">{!videoUrl ? <label className="flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900"><Upload className="h-8 w-8 text-blue-600" /><span className="mt-2 text-sm font-semibold">Select a video clip</span><span className="mt-1 text-xs text-neutral-500">GIF works best with short clips and moderate dimensions.</span><input type="file" accept="video/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) selectVideo(file); event.target.value = ''; }} /></label> : <video ref={videoRef} src={videoUrl} controls onLoadedMetadata={() => { const video = videoRef.current; if (!video) return; const duration = Number.isFinite(video.duration) ? video.duration : 0; setVideoDuration(duration); setTrimStart(0); setTrimEnd(Math.min(duration, 4)); }} className="w-full rounded-xl bg-black" />}</div><div className="space-y-4 lg:col-span-5">{videoUrl && <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900"><div className="font-bold">Clip range</div><div className="grid grid-cols-2 gap-2"><label>Start<input type="number" min="0" max={videoDuration} step="0.1" value={trimStart} onChange={(event) => setTrimStart(Number(event.target.value))} className="mt-1 w-full rounded border px-2 py-2 dark:bg-neutral-950" /></label><label>End<input type="number" min="0" max={videoDuration} step="0.1" value={trimEnd} onChange={(event) => setTrimEnd(Number(event.target.value))} className="mt-1 w-full rounded border px-2 py-2 dark:bg-neutral-950" /></label></div><div className="text-neutral-500">{formatVideoTime(trimStart)} → {formatVideoTime(trimEnd)} · about {Math.max(2, Math.ceil(Math.max(0, trimEnd - trimStart) * fps))} frames</div></section>}</div></div> : <div className="space-y-4"><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-white p-6 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-900"><Upload className="h-4 w-4" />Add image frames<input type="file" multiple accept="image/*" className="hidden" onChange={(event) => { if (event.target.files) void loadImages(event.target.files).catch((cause) => setError(cause instanceof Error ? cause.message : 'Image import failed.')); event.target.value = ''; }} /></label>{images.length > 0 && <div className="max-h-80 space-y-2 overflow-auto">{images.map((frame, index) => <div key={frame.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-2 text-xs dark:border-neutral-800 dark:bg-neutral-900"><img src={frame.url} alt="" className="h-12 w-16 rounded object-cover" /><span className="min-w-0 flex-1 truncate">{frame.filename}</span><label className="flex items-center gap-1">Delay<input type="number" min="20" max="10000" step="10" value={frame.delayMs} onChange={(event) => setImages((current) => current.map((item) => item.id === frame.id ? { ...item, delayMs: Math.max(20, Number(event.target.value) || 20) } : item))} className="w-20 rounded border px-2 py-1 dark:bg-neutral-950" />ms</label><button disabled={index === 0} onClick={() => moveImage(index, -1)} className="p-1 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button disabled={index === images.length - 1} onClick={() => moveImage(index, 1)} className="p-1 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button><button onClick={() => removeImage(frame.id)} className="p-1 text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>}</div>}

      <div className="grid gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950 sm:grid-cols-2 lg:grid-cols-4"><label>Width {width}px<input type="range" min="160" max="960" step="20" value={width} onChange={(event) => setWidth(Number(event.target.value))} className="w-full" /></label>{mode === 'video' ? <label>FPS {fps}<input type="range" min="4" max="24" value={fps} onChange={(event) => setFps(Number(event.target.value))} className="w-full" /></label> : <label>New-frame delay<input type="number" min="20" max="10000" step="10" value={defaultDelay} onChange={(event) => setDefaultDelay(Math.max(20, Number(event.target.value) || 20))} className="mt-1 w-full rounded border px-2 py-2 dark:bg-neutral-900" /></label>}<label>Loop<select value={loopCount} onChange={(event) => setLoopCount(Number(event.target.value))} className="mt-1 w-full rounded border bg-white px-2 py-2 dark:bg-neutral-900"><option value={0}>Forever</option><option value={1}>Once</option><option value={2}>Twice</option><option value={3}>3 times</option></select></label><label>Caption position<select value={captionPosition} onChange={(event) => setCaptionPosition(event.target.value as 'top' | 'bottom' | 'center')} className="mt-1 w-full rounded border bg-white px-2 py-2 dark:bg-neutral-900"><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label><label className="sm:col-span-2 lg:col-span-3">Caption<textarea rows={2} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Optional caption; long text auto-fits." className="mt-1 w-full rounded border p-2 dark:bg-neutral-900" /></label><label>Caption color<input type="color" value={captionColor} onChange={(event) => setCaptionColor(event.target.value)} className="mt-1 h-9 w-full" /></label></div>

      {generating && <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-800 dark:bg-blue-950/30"><div className="flex justify-between"><span>Building adaptive-palette GIF locally…</span><span className="font-mono">{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-blue-200"><div className="h-full bg-blue-600" style={{ width: `${progress}%` }} /></div></div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-neutral-500">Adaptive color quantization samples the animation itself instead of forcing every GIF into a fixed web-safe palette.</p><button onClick={() => mode === 'video' ? void generateFromVideo() : generateFromImages()} disabled={generating || (mode === 'video' ? !videoUrl : !images.length)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Generate GIF</button></div>

      {resultUrl && <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20"><div className="flex justify-between text-xs font-semibold"><span>Generated GIF</span><span>{resultSize ? formatVideoFileSize(resultSize) : ''}</span></div><img src={resultUrl} alt="Generated animated GIF" className="mx-auto max-h-[520px] max-w-full rounded-lg" /><button onClick={download} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"><Download className="h-4 w-4" />Download GIF</button></div>}
    </div>
  </ToolShell>;
};

export default GifMakerTool;
