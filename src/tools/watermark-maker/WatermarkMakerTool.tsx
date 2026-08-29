import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Download,
  Copy,
  Check,
  RefreshCw,
  Image as ImageIcon,
  Type,
  Grid,
  Sliders,
  FolderArchive,
  Trash2,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  WatermarkConfig,
  WatermarkPosition,
  DEFAULT_WATERMARK_CONFIG,
  applyWatermarkToImage,
} from '../../utilities/watermark';

interface BatchImageItem {
  id: string;
  name: string;
  file: File;
  previewUrl: string;
  imageObj: HTMLImageElement;
}

export const WatermarkMakerTool: React.FC = () => {
  const [images, setImages] = useState<BatchImageItem[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [config, setConfig] = useState<WatermarkConfig>(DEFAULT_WATERMARK_CONFIG);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load logo image object when logoFile changes
  useEffect(() => {
    if (!logoFile) {
      setLogoImg(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    const img = new Image();
    img.onload = () => setLogoImg(img);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  // Load uploaded base images
  const handleFilesSelected = (files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) return;

    const newItems: BatchImageItem[] = [];
    let loaded = 0;

    valid.forEach((f) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        newItems.push({
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: f.name,
          file: f,
          previewUrl: url,
          imageObj: img,
        });
        loaded++;
        if (loaded === valid.length) {
          setImages((prev) => [...prev, ...newItems]);
        }
      };
      img.src = url;
    });
  };

  // Update canvas preview
  const updatePreview = useCallback(async () => {
    if (images.length === 0 || !images[selectedImageIndex] || !previewCanvasRef.current) return;
    const current = images[selectedImageIndex];
    try {
      const renderedCanvas = await applyWatermarkToImage(current.imageObj, config, logoImg);
      const destCanvas = previewCanvasRef.current;
      destCanvas.width = renderedCanvas.width;
      destCanvas.height = renderedCanvas.height;
      const ctx = destCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, destCanvas.width, destCanvas.height);
        ctx.drawImage(renderedCanvas, 0, 0);
      }
    } catch {
      // preview error
    }
  }, [images, selectedImageIndex, config, logoImg]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  // Export current single preview image
  const handleDownloadSingle = async () => {
    if (images.length === 0 || !images[selectedImageIndex]) return;
    const current = images[selectedImageIndex];
    const canvas = await applyWatermarkToImage(current.imageObj, config, logoImg);
    const mime = exportFormat === 'png' ? 'image/png' : exportFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
    const ext = exportFormat;
    const baseName = current.name.substring(0, current.name.lastIndexOf('.')) || current.name;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}-watermarked.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }, mime, 0.92);
  };

  // Copy single watermarked image to clipboard
  const handleCopySingle = async () => {
    if (images.length === 0 || !images[selectedImageIndex]) return;
    const current = images[selectedImageIndex];
    const canvas = await applyWatermarkToImage(current.imageObj, config, logoImg);

    canvas.toBlob(async (blob) => {
      if (blob && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }, 'image/png');
  };

  // Export entire batch as ZIP archive
  const handleDownloadBatchZip = async () => {
    if (images.length === 0) return;
    setIsProcessingBatch(true);

    try {
      const zip = new JSZip();
      const mime = exportFormat === 'png' ? 'image/png' : exportFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
      const ext = exportFormat;

      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        const canvas = await applyWatermarkToImage(item.imageObj, config, logoImg);
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, 0.92));
        if (blob) {
          const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
          zip.file(`${baseName}-watermarked.${ext}`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watermarked-images-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // zip error
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
    if (selectedImageIndex >= index && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone if empty */}
      {images.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
          }}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors bg-slate-50 dark:bg-slate-900/40 cursor-pointer"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = 'image/png,image/jpeg,image/webp';
            input.onchange = (e: any) => handleFilesSelected(e.target.files);
            input.click();
          }}
        >
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Choose or Drop Images to Watermark
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Supports single or bulk batches of JPEG, PNG, and WebP files. All watermarking executes locally in your browser.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Settings Column */}
          <div className="lg:col-span-5 space-y-5">
            {/* Watermark Type Selector */}
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              <button
                onClick={() => setConfig((prev) => ({ ...prev, type: 'text' }))}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                  config.type === 'text'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                Text Watermark
              </button>
              <button
                onClick={() => setConfig((prev) => ({ ...prev, type: 'logo' }))}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                  config.type === 'logo'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Logo / Image
              </button>
            </div>

            {/* Mode Specific Inputs */}
            {config.type === 'text' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Watermark Text
                  </label>
                  <input
                    type="text"
                    value={config.text}
                    onChange={(e) => setConfig((prev) => ({ ...prev, text: e.target.value }))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.color}
                        onChange={(e) => setConfig((prev) => ({ ...prev, color: e.target.value }))}
                        className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 cursor-pointer p-0"
                      />
                      <span className="text-xs font-mono">{config.color}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Font Weight</label>
                    <select
                      value={config.fontWeight}
                      onChange={(e) => setConfig((prev) => ({ ...prev, fontWeight: e.target.value as any }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="normal">Regular</option>
                      <option value="bold">Bold</option>
                      <option value="900">Black / Extra Bold</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Logo / Stamp Image
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setLogoFile(f);
                  }}
                  className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300 cursor-pointer"
                />
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Logo Scale ({Math.round(config.logoScaleRatio * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.05"
                    value={config.logoScaleRatio}
                    onChange={(e) => setConfig((prev) => ({ ...prev, logoScaleRatio: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Position Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                Placement & Alignment
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                {[
                  { id: 'top-left', label: 'Top Left' },
                  { id: 'top-center', label: 'Top Center' },
                  { id: 'top-right', label: 'Top Right' },
                  { id: 'center-left', label: 'Mid Left' },
                  { id: 'center', label: 'Center' },
                  { id: 'center-right', label: 'Mid Right' },
                  { id: 'bottom-left', label: 'Btm Left' },
                  { id: 'bottom-center', label: 'Btm Center' },
                  { id: 'bottom-right', label: 'Btm Right' },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    onClick={() => setConfig((prev) => ({ ...prev, position: pos.id as WatermarkPosition }))}
                    className={`py-1.5 text-xs font-medium rounded transition-colors ${
                      config.position === pos.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, position: 'tiled' }))}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                    config.position === 'tiled'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  Repeat / Tiled Pattern
                </button>
              </div>
            </div>

            {/* Sliders: Opacity, Size, Rotation */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Opacity</span>
                  <span>{Math.round(config.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={config.opacity}
                  onChange={(e) => setConfig((prev) => ({ ...prev, opacity: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Rotation</span>
                  <span>{config.rotationDeg}°</span>
                </div>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  step="5"
                  value={config.rotationDeg}
                  onChange={(e) => setConfig((prev) => ({ ...prev, rotationDeg: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Export Format */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Export Format:</span>
              <div className="flex gap-2">
                {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`px-2.5 py-1 text-xs uppercase font-medium rounded ${
                      exportFormat === fmt
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview & Batch Output Column */}
          <div className="lg:col-span-7 space-y-4">
            {/* Batch Thumbnail Selector */}
            {images.length > 1 && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Batch Queue ({images.length} images loaded)</span>
                  <button
                    onClick={() => {
                      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
                      setImages([]);
                    }}
                    className="text-red-600 hover:text-red-700 flex items-center gap-1 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                        selectedImageIndex === idx
                          ? 'border-indigo-600 shadow-md ring-2 ring-indigo-300 dark:ring-indigo-800'
                          : 'border-slate-300 dark:border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Canvas Preview */}
            <div className="p-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center min-h-[340px] max-h-[460px] overflow-hidden">
              <canvas ref={previewCanvasRef} className="max-w-full max-h-[420px] object-contain rounded-lg shadow-sm" />
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap gap-2 justify-between items-center pt-2">
              <div className="flex gap-2">
                <label className="cursor-pointer px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Add More Images
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files) handleFilesSelected(e.target.files);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCopySingle}
                  className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Image'}
                </button>

                <button
                  onClick={handleDownloadSingle}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Image
                </button>

                {images.length > 1 && (
                  <button
                    onClick={handleDownloadBatchZip}
                    disabled={isProcessingBatch}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <FolderArchive className="w-3.5 h-3.5" />
                    {isProcessingBatch ? 'Zipping...' : `Download All (${images.length} as ZIP)`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatermarkMakerTool;
