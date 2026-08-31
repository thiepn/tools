import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Plus, Trash2, Upload } from 'lucide-react';
import { MEME_FONTS, getPresetTextBoxes, renderMemeCanvas, type MemeLayoutConfig, type MemePreset, type MemeTextBox } from '../../utilities/meme-maker';

const createLayer = (): MemeTextBox => ({
  id: `text-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
  text: 'NEW CAPTION', xPercent: 50, yPercent: 50, fontSize: 42,
  fontFamily: 'Impact, sans-serif', color: '#ffffff', strokeColor: '#000000', strokeWidth: 5,
  isUppercase: true, alignment: 'center', rotationDeg: 0, autoFit: true, maxWidthPercent: 92,
});

export const MemeMakerTool: React.FC = () => {
  const [preset, setPreset] = useState<MemePreset>('top-bottom');
  const [textBoxes, setTextBoxes] = useState<MemeTextBox[]>(() => getPresetTextBoxes('top-bottom'));
  const [config, setConfig] = useState<MemeLayoutConfig>({ preset: 'top-bottom', aspectRatio: 'original', backgroundColor: '#ffffff', headerPaddingTop: 110 });
  const [activeImage, setActiveImage] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 600;
    const ctx = canvas.getContext('2d'); if (ctx) { const gradient = ctx.createLinearGradient(0, 0, 900, 600); gradient.addColorStop(0, '#334155'); gradient.addColorStop(1, '#0f172a'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 900, 600); }
    const image = new Image(); image.onload = () => setActiveImage(image); image.src = canvas.toDataURL('image/png');
  }, []);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const updatePreview = useCallback(() => {
    const preview = previewRef.current; if (!preview) return;
    const rendered = renderMemeCanvas(activeImage, textBoxes, config, 1000);
    preview.width = rendered.width; preview.height = rendered.height;
    const ctx = preview.getContext('2d'); if (ctx) ctx.drawImage(rendered, 0, 0);
  }, [activeImage, config, textBoxes]);
  useEffect(() => updatePreview(), [updatePreview]);

  const upload = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Select a JPEG, PNG, WebP, GIF, or other browser-decodable image.'); return; }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file), image = new Image();
    image.onload = () => { setActiveImage(image); setImageUrl(url); setError(''); };
    image.onerror = () => { URL.revokeObjectURL(url); setError('The browser could not decode that image.'); };
    image.src = url;
  };
  const changePreset = (value: MemePreset) => { setPreset(value); setTextBoxes(getPresetTextBoxes(value)); setConfig((current) => ({ ...current, preset: value })); };
  const updateLayer = (index: number, updates: Partial<MemeTextBox>) => setTextBoxes((layers) => layers.map((layer, layerIndex) => layerIndex === index ? { ...layer, ...updates } : layer));
  const removeLayer = (index: number) => setTextBoxes((layers) => layers.filter((_, layerIndex) => layerIndex !== index));
  const exportCanvas = () => renderMemeCanvas(activeImage, textBoxes, config, 1400);
  const download = () => {
    const canvas = exportCanvas(), mime = exportFormat === 'png' ? 'image/png' : exportFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
    canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `meme-${new Date().toISOString().replace(/[:.]/g, '-')}.${exportFormat === 'jpeg' ? 'jpg' : exportFormat}`; link.click(); URL.revokeObjectURL(url); }, mime, 0.94);
  };
  const copy = () => exportCanvas().toBlob(async (blob) => { try { if (!blob || !navigator.clipboard?.write) throw new Error(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setError('Image clipboard is unavailable in this browser context.'); } }, 'image/png');

  return <div className="space-y-5">
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-5">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-100 py-2.5 text-xs font-medium hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"><Upload className="h-4 w-4" />Upload background<input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ''; }} /></label>

        <div className="space-y-2"><div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Layout</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[
          ['top-bottom', 'Top & bottom'], ['top-caption', 'Top'], ['bottom-caption', 'Bottom'], ['blank-white-header', 'White header'], ['center-quote', 'Quote'],
        ].map(([id, label]) => <button key={id} onClick={() => changePreset(id as MemePreset)} className={`rounded-lg border px-2 py-2 text-xs ${preset === id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>{label}</button>)}</div>
          <div className="grid grid-cols-2 gap-2 text-xs"><label>Aspect<select value={config.aspectRatio} onChange={(event) => setConfig((current) => ({ ...current, aspectRatio: event.target.value as MemeLayoutConfig['aspectRatio'] }))} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"><option value="original">Original</option><option value="1:1">1:1</option><option value="4:5">4:5</option><option value="16:9">16:9</option></select></label>{preset === 'blank-white-header' && <label>Header height<input type="range" min="60" max="240" value={config.headerPaddingTop} onChange={(event) => setConfig((current) => ({ ...current, headerPaddingTop: Number(event.target.value) }))} className="mt-2 w-full" /></label>}</div>
        </div>

        <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Text layers</span><button onClick={() => setTextBoxes((layers) => [...layers, createLayer()])} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"><Plus className="h-3.5 w-3.5" />Add layer</button></div>
        <div className="space-y-3">{textBoxes.map((box, index) => <div key={box.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold">Layer {index + 1}</span><button onClick={() => removeLayer(index)} className="rounded p-1 text-red-600" title="Remove layer"><Trash2 className="h-3.5 w-3.5" /></button></div>
          <textarea rows={2} value={box.text} onChange={(event) => updateLayer(index, { text: event.target.value })} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950" />
          <div className="grid grid-cols-2 gap-2 text-[11px]"><label>Font<select value={box.fontFamily} onChange={(event) => updateLayer(index, { fontFamily: event.target.value })} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950">{MEME_FONTS.map((font) => <option key={font.id} value={font.id}>{font.name}</option>)}</select></label><label>Size {box.fontSize}px<input type="range" min="14" max="110" value={box.fontSize} onChange={(event) => updateLayer(index, { fontSize: Number(event.target.value) })} className="mt-2 w-full" /></label></div>
          <div className="grid grid-cols-2 gap-2 text-[11px]"><label>X {Math.round(box.xPercent)}%<input type="range" min="2" max="98" value={box.xPercent} onChange={(event) => updateLayer(index, { xPercent: Number(event.target.value) })} className="mt-2 w-full" /></label><label>Y {Math.round(box.yPercent)}%<input type="range" min="2" max="98" value={box.yPercent} onChange={(event) => updateLayer(index, { yPercent: Number(event.target.value) })} className="mt-2 w-full" /></label><label>Width {Math.round(box.maxWidthPercent ?? 92)}%<input type="range" min="25" max="98" value={box.maxWidthPercent ?? 92} onChange={(event) => updateLayer(index, { maxWidthPercent: Number(event.target.value) })} className="mt-2 w-full" /></label><label>Rotation {box.rotationDeg}°<input type="range" min="-30" max="30" value={box.rotationDeg} onChange={(event) => updateLayer(index, { rotationDeg: Number(event.target.value) })} className="mt-2 w-full" /></label></div>
          <div className="flex flex-wrap items-center gap-3 text-[11px]"><label className="flex items-center gap-1">Fill<input type="color" value={box.color} onChange={(event) => updateLayer(index, { color: event.target.value })} /></label><label className="flex items-center gap-1">Outline<input type="color" value={box.strokeColor === 'transparent' ? '#000000' : box.strokeColor} onChange={(event) => updateLayer(index, { strokeColor: event.target.value })} /></label><label className="flex items-center gap-1"><input type="checkbox" checked={box.isUppercase} onChange={(event) => updateLayer(index, { isUppercase: event.target.checked })} />Uppercase</label><label className="flex items-center gap-1"><input type="checkbox" checked={box.autoFit !== false} onChange={(event) => updateLayer(index, { autoFit: event.target.checked })} />Auto-fit</label></div>
        </div>)}</div>
      </div>

      <div className="space-y-4 lg:col-span-7"><div className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-950"><canvas ref={previewRef} className="max-h-[520px] max-w-full rounded-lg object-contain shadow-md" /></div><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-1">{(['png', 'jpeg', 'webp'] as const).map((format) => <button key={format} onClick={() => setExportFormat(format)} className={`rounded px-2.5 py-1 text-xs uppercase ${exportFormat === format ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{format}</button>)}</div><div className="flex gap-2"><button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy meme'}</button><button onClick={download} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"><Download className="h-3.5 w-3.5" />Download</button></div></div><p className="text-[11px] text-slate-500">Long captions auto-shrink and wrap inside the selected layer width so export does not silently clip text.</p></div>
    </div>
  </div>;
};

export default MemeMakerTool;
