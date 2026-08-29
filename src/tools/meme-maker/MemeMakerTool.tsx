import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  MemeTextBox,
  MemePreset,
  MemeLayoutConfig,
  MEME_FONTS,
  getPresetTextBoxes,
  renderMemeCanvas,
} from '../../utilities/meme-maker';

export const MemeMakerTool: React.FC = () => {
  const [preset, setPreset] = useState<MemePreset>('top-bottom');
  const [textBoxes, setTextBoxes] = useState<MemeTextBox[]>(() => getPresetTextBoxes('top-bottom'));
  const [config, setConfig] = useState<MemeLayoutConfig>({
    preset: 'top-bottom',
    aspectRatio: 'original',
    backgroundColor: '#ffffff',
    headerPaddingTop: 0,
  });
  const [activeImage, setActiveImage] = useState<HTMLImageElement | null>(null);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [copied, setCopied] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize with a simple default placeholder canvas or pattern
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 800, 600);
      grad.addColorStop(0, '#334155');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 600);
    }
    const img = new Image();
    img.src = canvas.toDataURL();
    img.onload = () => setActiveImage(img);
  }, []);

  const handlePresetChange = (newPreset: MemePreset) => {
    setPreset(newPreset);
    setTextBoxes(getPresetTextBoxes(newPreset));
    setConfig((prev) => ({ ...prev, preset: newPreset }));
  };

  const updatePreview = useCallback(() => {
    if (!previewCanvasRef.current) return;
    try {
      const rendered = renderMemeCanvas(activeImage, textBoxes, config);
      const canvas = previewCanvasRef.current;
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(rendered, 0, 0);
      }
    } catch {
      // preview error
    }
  }, [activeImage, textBoxes, config]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  const handleCustomUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setActiveImage(img);
    };
    img.src = url;
  };

  const handleDownload = () => {
    const canvas = renderMemeCanvas(activeImage, textBoxes, config);
    const mime = exportFormat === 'png' ? 'image/png' : exportFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meme-${Date.now()}.${exportFormat}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      mime,
      0.92
    );
  };

  const handleCopy = () => {
    const canvas = renderMemeCanvas(activeImage, textBoxes, config);
    canvas.toBlob(async (blob) => {
      if (blob && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }, 'image/png');
  };

  const updateTextBox = (index: number, updates: Partial<MemeTextBox>) => {
    setTextBoxes((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...updates };
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-4">
          {/* Upload and presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
              Meme Image
            </label>
            <label className="cursor-pointer w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700">
              <Upload className="w-4 h-4 text-indigo-500" />
              Upload Meme Background Image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCustomUpload(f);
                }}
                className="hidden"
              />
            </label>
          </div>

          {/* Preset Styles */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Preset Layout
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'top-bottom', label: 'Top & Bottom' },
                { id: 'top-caption', label: 'Top Only' },
                { id: 'bottom-caption', label: 'Bottom Only' },
                { id: 'blank-white-header', label: 'White Banner' },
                { id: 'center-quote', label: 'Center Quote' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p.id as MemePreset)}
                  className={`py-2 px-2 text-xs font-medium rounded-lg border transition-colors ${
                    preset === p.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Box Editors */}
          <div className="space-y-3">
            {textBoxes.map((box, idx) => (
              <div
                key={box.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5"
              >
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Text Layer #{idx + 1}</span>
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer text-slate-500">
                    <input
                      type="checkbox"
                      checked={box.isUppercase}
                      onChange={(e) => updateTextBox(idx, { isUppercase: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                    />
                    UPPERCASE
                  </label>
                </div>

                <textarea
                  value={box.text}
                  onChange={(e) => updateTextBox(idx, { text: e.target.value })}
                  rows={2}
                  placeholder="Enter caption..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 font-bold"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Font</label>
                    <select
                      value={box.fontFamily}
                      onChange={(e) => updateTextBox(idx, { fontFamily: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-slate-100"
                    >
                      {MEME_FONTS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Size</span>
                      <span>{box.fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="16"
                      max="90"
                      value={box.fontSize}
                      onChange={(e) => updateTextBox(idx, { fontSize: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Fill:</span>
                      <input
                        type="color"
                        value={box.color}
                        onChange={(e) => updateTextBox(idx, { color: e.target.value })}
                        className="w-5 h-5 rounded border cursor-pointer p-0"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Outline:</span>
                      <input
                        type="color"
                        value={box.strokeColor === 'transparent' ? '#000000' : box.strokeColor}
                        onChange={(e) => updateTextBox(idx, { strokeColor: e.target.value })}
                        className="w-5 h-5 rounded border cursor-pointer p-0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => updateTextBox(idx, { alignment: align })}
                        className={`px-2 py-0.5 text-[10px] uppercase rounded border ${
                          box.alignment === align
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center min-h-[380px] max-h-[500px] overflow-hidden">
            <canvas ref={previewCanvasRef} className="max-w-full max-h-[460px] object-contain rounded-lg shadow-md" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Format:</span>
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

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Meme'}
              </button>

              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download Meme
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemeMakerTool;
