import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Download, Image as ImageIcon, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { getPublicImageTask, PUBLIC_IMAGE_TASKS } from '../../image/publicImageTasks';
import { processImageCanvas, type OutputFormat, type CropRect } from '../../utilities/image-optimizer';
import { removeBackgroundLocal } from '../../utilities/background-remover';
import {
  SOCIAL_IMAGE_PRESETS,
  buildIcoFromPng,
  centerCropForAspect,
  clampRegion,
  contactSheetLayout,
  coverCrop,
  gridRegions,
  metadataPrivacySummary,
  outputExtension,
  parseJpegExif,
  safeImageBaseName,
} from '../../utilities/image-micro-tools';

function readTaskId(hash: string): string {
  const clean = hash.replace(/^#\/?/, '').split('?')[0];
  return clean.startsWith('tool/') ? clean.slice(5).split('/')[0] : clean.split('/')[0];
}
function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This browser could not decode the selected image format.')); };
    img.src = url;
  });
}
function canvasBlob(canvas: HTMLCanvasElement, type: string, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image export failed.')), type, quality));
}
function formatName(file: File | undefined, format: OutputFormat): string {
  return `${safeImageBaseName(file?.name || 'image')}-converted.${outputExtension(format)}`;
}
function aspectFromRatio(value: string): number | null {
  if (value === 'free') return null;
  const [w, h] = value.split(':').map(Number);
  return w > 0 && h > 0 ? w / h : 1;
}

type NumericSetter = React.Dispatch<React.SetStateAction<number>>;
type ObscureMode = 'blur' | 'pixelate';

export const ImageMicroTools: React.FC = () => {
  const task = useMemo(() => getPublicImageTask(typeof window !== 'undefined' ? readTaskId(window.location.hash) : '') ?? PUBLIC_IMAGE_TASKS[0], []);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null);
  const [secondUrl, setSecondUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [format, setFormat] = useState<OutputFormat>(task.id === 'compress-image-to-size' ? 'image/jpeg' : 'image/png');
  const [quality, setQuality] = useState(0.9);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [rotation, setRotation] = useState(90);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [ratio, setRatio] = useState('1:1');
  const [targetKb, setTargetKb] = useState(300);
  const [strength, setStrength] = useState(12);
  const [obscureMode, setObscureMode] = useState<ObscureMode>('blur');
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [border, setBorder] = useState(24);
  const [color, setColor] = useState('#ffffff');
  const [slider, setSlider] = useState(50);
  const [preset, setPreset] = useState('instagram-square');
  const [scale, setScale] = useState(2);
  const [focusX, setFocusX] = useState(0.5);
  const [focusY, setFocusY] = useState(0.35);
  const [region, setRegion] = useState({ x: 25, y: 25, width: 50, height: 30 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [hue, setHue] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [metadata, setMetadata] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (secondUrl) URL.revokeObjectURL(secondUrl);
  }, [sourceUrl, secondUrl]);

  useEffect(() => {
    if (!file || task.id !== 'image-metadata-cleaner') { setMetadata([]); return; }
    if (!(file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name))) {
      setMetadata(['Common EXIF inspection is available for JPEG files. Re-exporting this image will still create a fresh file without carrying source metadata chunks.']);
      return;
    }
    void file.arrayBuffer().then((buffer) => {
      const meta = parseJpegExif(new Uint8Array(buffer));
      const details = metadataPrivacySummary(meta);
      if (meta.make) details.push(`Camera make: ${meta.make}`);
      if (meta.model) details.push(`Camera model: ${meta.model}`);
      if (meta.dateTime) details.push(`EXIF date/time: ${meta.dateTime}`);
      if (meta.software) details.push(`Software: ${meta.software}`);
      setMetadata(details);
    });
  }, [file, task.id]);

  const multi = ['batch-image-converter', 'contact-sheet-maker'].includes(task.id);
  const accept = task.id === 'svg-to-image'
    ? '.svg,image/svg+xml'
    : task.id === 'heic-image-converter'
      ? '.heic,.heif,image/heic,image/heif'
      : 'image/*,.heic,.heif,.svg';

  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setError('');
    const selected = [...list];
    setFiles(multi ? selected : [selected[0]]);
    setFile(selected[0]);
    try {
      const img = await loadImage(selected[0]);
      setImage(img);
      setWidth(img.naturalWidth);
      setHeight(img.naturalHeight);
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSourceUrl(URL.createObjectURL(selected[0]));
    } catch (reason) {
      setImage(null);
      setError(reason instanceof Error ? reason.message : 'Unable to decode image.');
    }
  };

  const pickSecond = async (list: FileList | null) => {
    if (!list?.[0]) return;
    setSecondFile(list[0]);
    try {
      await loadImage(list[0]);
      if (secondUrl) URL.revokeObjectURL(secondUrl);
      setSecondUrl(URL.createObjectURL(list[0]));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to decode second image.');
    }
  };

  const exportStandard = async (
    crop: CropRect | null = null,
    targetW = width,
    targetH = height,
    opts: { rotation?: number; flipH?: boolean; flipV?: boolean; format?: OutputFormat; quality?: number } = {},
  ) => {
    if (!image) throw new Error('Choose an image first.');
    return processImageCanvas(image, {
      targetWidth: Math.max(1, targetW),
      targetHeight: Math.max(1, targetH),
      rotationDeg: opts.rotation ?? 0,
      flipH: opts.flipH ?? false,
      flipV: opts.flipV ?? false,
      crop,
      format: opts.format ?? format,
      quality: opts.quality ?? quality,
    });
  };

  const renderFilteredCanvas = () => {
    if (!image) throw new Error('Choose an image first.');
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${grayscale}%) sepia(${sepia}%) hue-rotate(${hue}deg)`;
    ctx.drawImage(image, 0, 0);
    return canvas;
  };

  const drawObscuredRegion = (
    sourceCanvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    crop: CropRect,
    mode: ObscureMode,
  ) => {
    const tmp = document.createElement('canvas');
    if (mode === 'blur') {
      tmp.width = Math.max(1, Math.round(crop.width));
      tmp.height = Math.max(1, Math.round(crop.height));
      const tctx = tmp.getContext('2d');
      if (!tctx) throw new Error('Canvas is unavailable.');
      tctx.filter = `blur(${Math.max(1, strength)}px)`;
      tctx.drawImage(sourceCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, tmp.width, tmp.height);
    } else {
      const factor = Math.max(3, Math.round(strength));
      tmp.width = Math.max(1, Math.round(crop.width / factor));
      tmp.height = Math.max(1, Math.round(crop.height / factor));
      const tctx = tmp.getContext('2d');
      if (!tctx) throw new Error('Canvas is unavailable.');
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(sourceCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, tmp.width, tmp.height);
      ctx.imageSmoothingEnabled = false;
    }
    ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, crop.x, crop.y, crop.width, crop.height);
  };

  const process = async () => {
    setBusy(true);
    setError('');
    setStatus('Processing locally…');
    try {
      if (task.id === 'image-compare') {
        if (!file || !secondFile) throw new Error('Choose two images to compare.');
        setStatus('Comparison ready.');
        return;
      }
      if (task.id === 'batch-image-converter') {
        if (!files.length) throw new Error('Choose images first.');
        const zip = new JSZip();
        for (let i = 0; i < files.length; i++) {
          setStatus(`Converting ${i + 1}/${files.length}…`);
          const img = await loadImage(files[i]);
          const result = await processImageCanvas(img, { targetWidth: img.naturalWidth, targetHeight: img.naturalHeight, rotationDeg: 0, flipH: false, flipV: false, format, quality });
          zip.file(`${safeImageBaseName(files[i].name)}.${outputExtension(format)}`, await result.blob.arrayBuffer());
          URL.revokeObjectURL(result.url);
        }
        downloadBlob(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), 'converted-images.zip');
        setStatus('Batch ready.');
        return;
      }
      if (task.id === 'contact-sheet-maker') {
        if (!files.length) throw new Error('Choose images first.');
        const loaded = await Promise.all(files.map(loadImage));
        const thumbW = 240, thumbH = 180;
        const layout = contactSheetLayout(loaded.length, thumbW, thumbH, columns, 12, 16);
        const canvas = document.createElement('canvas');
        canvas.width = layout.width;
        canvas.height = layout.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable.');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        loaded.forEach((img, i) => {
          const col = i % layout.columns, row = Math.floor(i / layout.columns);
          const x = 16 + col * (thumbW + 12), y = 16 + row * (thumbH + 12);
          const crop = coverCrop(img.naturalWidth, img.naturalHeight, thumbW, thumbH);
          ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, x, y, thumbW, thumbH);
        });
        downloadBlob(await canvasBlob(canvas, 'image/png'), 'contact-sheet.png');
        setStatus('Contact sheet ready.');
        return;
      }
      if (!image || !file) throw new Error('Choose an image first.');

      if (task.id === 'crop-image') {
        const aspect = aspectFromRatio(ratio);
        const crop = aspect === null
          ? clampRegion({ x: image.naturalWidth * region.x / 100, y: image.naturalHeight * region.y / 100, width: image.naturalWidth * region.width / 100, height: image.naturalHeight * region.height / 100 }, image.naturalWidth, image.naturalHeight)
          : centerCropForAspect(image.naturalWidth, image.naturalHeight, aspect);
        const result = await exportStandard(crop, Math.round(crop.width), Math.round(crop.height));
        downloadBlob(result.blob, formatName(file, format));
        URL.revokeObjectURL(result.url);
      } else if (task.id === 'rotate-flip-image') {
        const rotated = Math.abs(rotation % 180) === 90;
        const result = await exportStandard(null, rotated ? image.naturalHeight : image.naturalWidth, rotated ? image.naturalWidth : image.naturalHeight, { rotation, flipH, flipV });
        downloadBlob(result.blob, formatName(file, format));
        URL.revokeObjectURL(result.url);
      } else if (['heic-image-converter', 'avif-image-converter', 'svg-to-image', 'image-format-converter', 'image-metadata-cleaner'].includes(task.id)) {
        const result = await exportStandard(null, width, height);
        downloadBlob(result.blob, formatName(file, format));
        URL.revokeObjectURL(result.url);
      } else if (task.id === 'compress-image-to-size') {
        if (format === 'image/png') throw new Error('Target-size compression needs JPEG or WebP because PNG quality is lossless.');
        let low = 0.1, high = 0.98, best: Blob | null = null, bestDiff = Infinity;
        for (let i = 0; i < 8; i++) {
          const q = (low + high) / 2;
          const result = await exportStandard(null, width, height, { quality: q });
          const diff = Math.abs(result.blob.size - targetKb * 1024);
          if (diff < bestDiff) { best = result.blob; bestDiff = diff; }
          if (result.blob.size > targetKb * 1024) high = q; else low = q;
          URL.revokeObjectURL(result.url);
        }
        if (!best) throw new Error('Unable to produce compressed image.');
        downloadBlob(best, `${safeImageBaseName(file.name)}-${targetKb}kb.${outputExtension(format)}`);
      } else if (task.id === 'profile-picture-maker') {
        const crop = centerCropForAspect(image.naturalWidth, image.naturalHeight, 1);
        const size = Math.min(1080, Math.round(crop.width));
        const base = await exportStandard(crop, size, size, { format: 'image/png' });
        const img = await loadImage(base.blob);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable.');
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 0, 0, size, size);
        ctx.restore();
        downloadBlob(await canvasBlob(canvas, 'image/png'), `${safeImageBaseName(file.name)}-profile.png`);
        URL.revokeObjectURL(base.url);
      } else if (task.id === 'blur-pixelate-image') {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable.');
        ctx.drawImage(image, 0, 0);
        drawObscuredRegion(canvas, ctx, { x: 0, y: 0, width: canvas.width, height: canvas.height }, obscureMode);
        downloadBlob(await canvasBlob(canvas, format, quality), formatName(file, format));
      } else if (task.id === 'privacy-blur-image') {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable.');
        ctx.drawImage(image, 0, 0);
        const crop = clampRegion({ x: canvas.width * region.x / 100, y: canvas.height * region.y / 100, width: canvas.width * region.width / 100, height: canvas.height * region.height / 100 }, canvas.width, canvas.height);
        drawObscuredRegion(canvas, ctx, crop, obscureMode);
        downloadBlob(await canvasBlob(canvas, format, quality), `${safeImageBaseName(file.name)}-redacted.${outputExtension(format)}`);
      } else if (task.id === 'social-media-image-resizer') {
        const selected = SOCIAL_IMAGE_PRESETS.find((item) => item.id === preset) ?? SOCIAL_IMAGE_PRESETS[0];
        const crop = coverCrop(image.naturalWidth, image.naturalHeight, selected.width, selected.height);
        const result = await exportStandard(crop, selected.width, selected.height);
        downloadBlob(result.blob, `${safeImageBaseName(file.name)}-${selected.id}.${outputExtension(format)}`);
        URL.revokeObjectURL(result.url);
      } else if (task.id === 'favicon-maker') {
        const crop = centerCropForAspect(image.naturalWidth, image.naturalHeight, 1);
        const zip = new JSZip();
        const sizes: Array<[number, string]> = [[16, 'favicon-16x16.png'], [32, 'favicon-32x32.png'], [48, 'favicon-48x48.png'], [180, 'apple-touch-icon.png'], [192, 'android-chrome-192x192.png'], [512, 'android-chrome-512x512.png']];
        for (const [size, name] of sizes) {
          const result = await exportStandard(crop, size, size, { format: 'image/png' });
          zip.file(name, await result.blob.arrayBuffer());
          URL.revokeObjectURL(result.url);
        }
        const icoPng = await exportStandard(crop, 256, 256, { format: 'image/png' });
        zip.file('favicon.ico', buildIcoFromPng(new Uint8Array(await icoPng.blob.arrayBuffer()), 256, 256));
        URL.revokeObjectURL(icoPng.url);
        downloadBlob(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), 'favicon-pack.zip');
      } else if (task.id === 'image-grid-splitter') {
        const zip = new JSZip();
        for (const [i, grid] of gridRegions(image.naturalWidth, image.naturalHeight, rows, columns).entries()) {
          const result = await exportStandard(grid, grid.width, grid.height);
          zip.file(`tile-${String(i + 1).padStart(2, '0')}.${outputExtension(format)}`, await result.blob.arrayBuffer());
          URL.revokeObjectURL(result.url);
        }
        downloadBlob(await zip.generateAsync({ type: 'blob' }), 'image-tiles.zip');
      } else if (task.id === 'image-border-frame') {
        const canvas = document.createElement('canvas');
        const pad = Math.max(0, Math.round(border));
        canvas.width = image.naturalWidth + pad * 2;
        canvas.height = image.naturalHeight + pad * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable.');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, pad, pad);
        downloadBlob(await canvasBlob(canvas, format, quality), `${safeImageBaseName(file.name)}-framed.${outputExtension(format)}`);
      } else if (task.id === 'photo-filters') {
        downloadBlob(await canvasBlob(renderFilteredCanvas(), format, quality), `${safeImageBaseName(file.name)}-filtered.${outputExtension(format)}`);
      } else if (task.id === 'transparent-image-maker' || task.id === 'background-changer') {
        setStatus('Running local background removal…');
        const foreground = await removeBackgroundLocal(file, (message) => setStatus(message));
        if (task.id === 'transparent-image-maker') {
          downloadBlob(foreground, `${safeImageBaseName(file.name)}-transparent.png`);
        } else {
          const fg = await loadImage(foreground);
          const canvas = document.createElement('canvas');
          canvas.width = fg.naturalWidth;
          canvas.height = fg.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas unavailable.');
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(fg, 0, 0);
          downloadBlob(await canvasBlob(canvas, format, quality), `${safeImageBaseName(file.name)}-background.${outputExtension(format)}`);
        }
      } else if (task.id === 'image-upscaler') {
        const factor = Math.max(1, Math.min(4, scale));
        const result = await exportStandard(null, Math.round(image.naturalWidth * factor), Math.round(image.naturalHeight * factor));
        downloadBlob(result.blob, `${safeImageBaseName(file.name)}-${factor}x.${outputExtension(format)}`);
        URL.revokeObjectURL(result.url);
      } else if (task.id === 'headshot-cropper') {
        const aspect = aspectFromRatio(ratio) ?? 1;
        const crop = coverCrop(image.naturalWidth, image.naturalHeight, aspect * 1000, 1000, focusX, focusY);
        const targetH = 1200, targetW = Math.round(targetH * aspect);
        const result = await exportStandard(crop, targetW, targetH);
        downloadBlob(result.blob, `${safeImageBaseName(file.name)}-headshot.${outputExtension(format)}`);
        URL.revokeObjectURL(result.url);
      }
      setStatus('Done.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image processing failed.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const ratioControls = ['crop-image', 'headshot-cropper'].includes(task.id);
  const formatControls = !['favicon-maker', 'transparent-image-maker', 'contact-sheet-maker', 'image-compare'].includes(task.id);
  const dimensionControls = ['heic-image-converter', 'avif-image-converter', 'svg-to-image', 'image-format-converter', 'image-metadata-cleaner', 'compress-image-to-size'].includes(task.id);
  const regionControls = task.id === 'privacy-blur-image' || (task.id === 'crop-image' && ratio === 'free');
  const filterControls: Array<[string, number, NumericSetter, number, number]> = [
    ['Brightness', brightness, setBrightness, 0, 200], ['Contrast', contrast, setContrast, 0, 200], ['Saturation', saturation, setSaturation, 0, 200],
    ['Grayscale', grayscale, setGrayscale, 0, 100], ['Sepia', sepia, setSepia, 0, 100], ['Hue', hue, setHue, -180, 180],
  ];

  return <ToolShell toolId={task.id} title={task.name} description={task.description} category="image" relatedToolIds={['image-optimizer', 'background-remover', 'image-annotator', 'image-collage']}>
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Image pixels are processed locally in your browser. HEIC/HEIF and AVIF depend on the browser's installed decoder support.</span></div>
      <input ref={inputRef} type="file" accept={accept} multiple={multi} className="hidden" onChange={(event) => void pick(event.target.files)} />
      <input ref={secondRef} type="file" accept="image/*" className="hidden" onChange={(event) => void pickSecond(event.target.files)} />
      <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700"><Upload className="mx-auto mb-2 h-6 w-6" /><span className="font-semibold">{multi ? 'Choose images' : 'Choose an image'}</span>{file && <span className="mt-1 block text-xs text-neutral-500">{multi ? `${files.length} image(s) selected` : file.name}</span>}</button>
      {task.id === 'image-compare' && <button type="button" onClick={() => secondRef.current?.click()} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">Choose second image{secondFile ? ` — ${secondFile.name}` : ''}</button>}
      {sourceUrl && task.id === 'image-compare' && secondUrl ? <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800"><img src={secondUrl} className="block max-h-[520px] w-full object-contain" alt="Second comparison" /><img src={sourceUrl} className="absolute inset-0 h-full w-full object-contain" style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }} alt="First comparison" /><div className="pointer-events-none absolute inset-y-0 w-px bg-white shadow" style={{ left: `${slider}%` }} /><input aria-label="Comparison reveal" type="range" min="0" max="100" value={slider} onChange={(event) => setSlider(Number(event.target.value))} className="absolute bottom-3 left-4 right-4 w-[calc(100%-2rem)]" /></div> : sourceUrl && <img src={sourceUrl} className="mx-auto max-h-[420px] max-w-full rounded-xl border border-neutral-200 object-contain dark:border-neutral-800" alt="Selected preview" />}

      <section className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-950">
        {formatControls && <label className="text-xs font-semibold">Output format<select value={format} onChange={(event) => setFormat(event.target.value as OutputFormat)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>}
        {formatControls && format !== 'image/png' && <label className="text-xs font-semibold">Quality {Math.round(quality * 100)}%<input type="range" min="0.2" max="1" step="0.01" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="mt-2 w-full" /></label>}
        {dimensionControls && <><label className="text-xs font-semibold">Width<input type="number" min="1" value={width} onChange={(event) => setWidth(Math.max(1, Number(event.target.value)))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" /></label><label className="text-xs font-semibold">Height<input type="number" min="1" value={height} onChange={(event) => setHeight(Math.max(1, Number(event.target.value)))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" /></label></>}
        {ratioControls && <label className="text-xs font-semibold">Crop ratio<select value={ratio} onChange={(event) => setRatio(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"><option value="1:1">1:1</option><option value="4:5">4:5</option><option value="3:4">3:4</option>{task.id === 'crop-image' && <><option value="16:9">16:9</option><option value="free">Free rectangle</option></>}</select></label>}
        {task.id === 'rotate-flip-image' && <><label className="text-xs font-semibold">Rotation<select value={rotation} onChange={(event) => setRotation(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option></select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={flipH} onChange={(event) => setFlipH(event.target.checked)} />Flip horizontal</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={flipV} onChange={(event) => setFlipV(event.target.checked)} />Flip vertical</label></>}
        {task.id === 'compress-image-to-size' && <label className="text-xs font-semibold">Target size (KB)<input type="number" min="10" value={targetKb} onChange={(event) => setTargetKb(Math.max(10, Number(event.target.value)))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" /></label>}
        {task.id === 'social-media-image-resizer' && <label className="text-xs font-semibold">Preset<select value={preset} onChange={(event) => setPreset(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700">{SOCIAL_IMAGE_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label} — {item.width}×{item.height}</option>)}</select></label>}
        {['blur-pixelate-image', 'privacy-blur-image'].includes(task.id) && <><label className="text-xs font-semibold">Mode<select value={obscureMode} onChange={(event) => setObscureMode(event.target.value as ObscureMode)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"><option value="blur">Blur</option><option value="pixelate">Pixelate</option></select></label><label className="text-xs font-semibold">Strength {strength}<input type="range" min="2" max="30" value={strength} onChange={(event) => setStrength(Number(event.target.value))} className="mt-2 w-full" /></label></>}
        {regionControls && Object.entries(region).map(([key, value]) => <label key={key} className="text-xs font-semibold">{key} %<input type="number" min="0" max="100" value={value} onChange={(event) => setRegion((current) => ({ ...current, [key]: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" /></label>)}
        {task.id === 'image-grid-splitter' && <><label className="text-xs font-semibold">Rows<input type="number" min="1" max="20" value={rows} onChange={(event) => setRows(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" /></label><label className="text-xs font-semibold">Columns<input type="number" min="1" max="20" value={columns} onChange={(event) => setColumns(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" /></label></>}
        {task.id === 'contact-sheet-maker' && <label className="text-xs font-semibold">Columns<input type="number" min="1" max="12" value={columns} onChange={(event) => setColumns(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" /></label>}
        {task.id === 'image-border-frame' && <label className="text-xs font-semibold">Border width (px)<input type="number" min="0" max="1000" value={border} onChange={(event) => setBorder(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" /></label>}
        {['image-border-frame', 'background-changer', 'contact-sheet-maker'].includes(task.id) && <label className="text-xs font-semibold">Color<input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-transparent p-1 dark:border-neutral-700" /></label>}
        {task.id === 'photo-filters' && filterControls.map(([label, value, setter, min, max]) => <label key={label} className="text-xs font-semibold">{label} {value}<input type="range" min={min} max={max} value={value} onChange={(event) => setter(Number(event.target.value))} className="mt-2 w-full" /></label>)}
        {task.id === 'image-upscaler' && <label className="text-xs font-semibold">Scale<select value={scale} onChange={(event) => setScale(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"><option value={1.5}>1.5×</option><option value={2}>2×</option><option value={3}>3×</option><option value={4}>4×</option></select></label>}
        {task.id === 'headshot-cropper' && <><label className="text-xs font-semibold">Horizontal focus<input type="range" min="0" max="1" step="0.01" value={focusX} onChange={(event) => setFocusX(Number(event.target.value))} className="mt-2 w-full" /></label><label className="text-xs font-semibold">Vertical focus<input type="range" min="0" max="1" step="0.01" value={focusY} onChange={(event) => setFocusY(Number(event.target.value))} className="mt-2 w-full" /></label></>}
      </section>

      {metadata.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200"><strong>Metadata inspection:</strong><ul className="mt-1 list-disc pl-5">{metadata.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-2">Exporting creates a freshly encoded image and strips source metadata chunks.</p></div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{error}</div>}
      <button type="button" disabled={busy} onClick={() => void process()} className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{task.id === 'image-compare' ? 'Prepare comparison' : 'Process & download'}</button>{status && <span className="ml-3 text-xs text-neutral-500">{status}</span>}
      {task.id === 'image-upscaler' && <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200"><ImageIcon className="mt-0.5 h-4 w-4 shrink-0" /><span>This is high-quality resampling. It can enlarge pixels smoothly but does not invent real detail the source image did not contain.</span></div>}
    </div>
  </ToolShell>;
};

export default ImageMicroTools;
