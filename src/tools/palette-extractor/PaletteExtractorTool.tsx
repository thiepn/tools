import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Copy,
  Check,
  Palette,
  Sliders,
  Sparkles,
  Layers,
  FileCode,
  ArrowUpDown,
  ShieldCheck,
} from 'lucide-react';
import {
  ExtractedColor,
  PaletteSortOption,
  extractColorsFromCanvas,
  sortExtractedPalette,
  generateHarmonies,
  formatAsCssVariables,
  getContrastRatio,
} from '../../utilities/palette-extractor';

export const PaletteExtractorTool: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [paletteSize, setPaletteSize] = useState<number>(5);
  const [sortBy, setSortBy] = useState<PaletteSortOption>('dominance');
  const [extractedColors, setExtractedColors] = useState<ExtractedColor[]>([]);
  const [selectedColorHex, setSelectedColorHex] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load and quantize image
  const processImage = useCallback((img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const colors = extractColorsFromCanvas(canvas, paletteSize);
    setExtractedColors(colors);
    if (colors.length > 0) {
      setSelectedColorHex(colors[0].hex);
    }
  }, [paletteSize]);

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);

    const img = new Image();
    img.onload = () => processImage(img);
    img.src = url;
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (item) {
      const file = item.getAsFile();
      if (file) handleFileChange(file);
    }
  };

  // Re-sort colors when sort option changes
  const displayColors = sortExtractedPalette(extractedColors, sortBy);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const harmonies = selectedColorHex ? generateHarmonies(selectedColorHex) : [];

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      {/* Upload Zone */}
      {!imageSrc ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFileChange(f);
          }}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center hover:border-indigo-500 transition-colors bg-slate-50 dark:bg-slate-900/40 cursor-pointer"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e: any) => {
              const f = e.target.files?.[0];
              if (f) handleFileChange(f);
            };
            input.click();
          }}
        >
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <Palette className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Choose or Drop Image to Extract Palette
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Extracts dominant color palettes and harmonies locally using color quantization algorithms.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Controls Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="cursor-pointer px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm">
                <Upload className="w-3.5 h-3.5" />
                Change Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileChange(f);
                  }}
                  className="hidden"
                />
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Palette Size:</span>
                {[3, 5, 8, 10].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => {
                      setPaletteSize(sz);
                      if (imageSrc) {
                        const img = new Image();
                        img.onload = () => processImage(img);
                        img.src = imageSrc;
                      }
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded ${
                      paletteSize === sz
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sort:
              </span>
              {(['dominance', 'brightness', 'hue'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-2.5 py-1 text-xs capitalize font-medium rounded ${
                    sortBy === s
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Palette Swatches Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Image Preview */}
            <div className="md:col-span-4 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex items-center justify-center max-h-[300px]">
              <img src={imageSrc} alt="Uploaded source" className="w-full h-full object-cover" />
            </div>

            {/* Extracted Swatches */}
            <div className="md:col-span-8 flex flex-col justify-between space-y-4">
              <div className="h-16 rounded-xl overflow-hidden flex shadow-sm border border-slate-200 dark:border-slate-800">
                {displayColors.map((c) => (
                  <div
                    key={c.hex}
                    onClick={() => setSelectedColorHex(c.hex)}
                    style={{ backgroundColor: c.hex, width: `${c.dominancePercent || 100 / displayColors.length}%` }}
                    className="h-full cursor-pointer hover:opacity-90 transition-opacity relative group"
                    title={`${c.hex} (${c.dominancePercent}% dominance)`}
                  />
                ))}
              </div>

              {/* Color Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {displayColors.map((c, i) => (
                  <div
                    key={c.hex}
                    onClick={() => setSelectedColorHex(c.hex)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedColorHex === c.hex
                        ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div
                      className="w-full h-12 rounded-lg mb-2 border border-black/10"
                      style={{ backgroundColor: c.hex }}
                    />
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {c.hex}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(c.hex, `hex-${i}`);
                          }}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {copiedKey === `hex-${i}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        RGB({c.r},{c.g},{c.b})
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {c.dominancePercent}% dominant
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Color Harmonies & WCAG Contrast */}
          {selectedColorHex && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Harmonies */}
              <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Color Harmonies for {selectedColorHex}</span>
                </div>

                <div className="space-y-3">
                  {harmonies.map((h) => (
                    <div key={h.type} className="space-y-1.5">
                      <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">{h.name}</div>
                      <div className="flex gap-2">
                        {h.colors.map((clr, idx) => (
                          <div
                            key={idx}
                            onClick={() => copyToClipboard(clr, `harm-${h.type}-${idx}`)}
                            className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-1 cursor-pointer hover:scale-105 transition-transform"
                          >
                            <div className="w-full h-7 rounded border border-black/10" style={{ backgroundColor: clr }} />
                            <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300">
                              {copiedKey === `harm-${h.type}-${idx}` ? 'Copied!' : clr}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export Formats */}
              <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Export Palette</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                    <span>CSS Variables</span>
                    <button
                      onClick={() => copyToClipboard(formatAsCssVariables(displayColors), 'css-vars')}
                      className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      {copiedKey === 'css-vars' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      Copy CSS
                    </button>
                  </div>
                  <pre className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
                    {formatAsCssVariables(displayColors)}
                  </pre>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                    <span>HEX List / JSON</span>
                    <button
                      onClick={() =>
                        copyToClipboard(JSON.stringify(displayColors.map((c) => c.hex), null, 2), 'json-vars')
                      }
                      className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      {copiedKey === 'json-vars' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      Copy JSON
                    </button>
                  </div>
                  <pre className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
                    {JSON.stringify(displayColors.map((c) => c.hex), null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PaletteExtractorTool;
