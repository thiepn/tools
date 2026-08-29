import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Pipette,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  parseColor,
  formatColorRepresentations,
  getContrastRatio,
  type RGBA,
} from '../../utilities/color-converter';
import { copyToClipboard } from '../../utilities/clipboard';

interface ColorConverterToolProps {
  initialText?: string;
}

export const ColorConverterTool: React.FC<ColorConverterToolProps> = ({ initialText = '' }) => {
  const [activeTab, setActiveTab] = useState<'convert' | 'contrast'>('convert');

  // Convert Mode State
  const [colorInput, setColorInput] = useState(initialText || '#2563eb');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Contrast Mode State
  const [fgColorInput, setFgColorInput] = useState('#1e293b');
  const [bgColorInput, setBgColorInput] = useState('#f8fafc');

  // Parsed single color
  const parsedSingle = useMemo(() => {
    return parseColor(colorInput);
  }, [colorInput]);

  const colorFormats = useMemo(() => {
    if (!parsedSingle) return null;
    return formatColorRepresentations(parsedSingle);
  }, [parsedSingle]);

  // Parsed contrast colors
  const parsedFg = useMemo(() => parseColor(fgColorInput), [fgColorInput]);
  const parsedBg = useMemo(() => parseColor(bgColorInput), [bgColorInput]);

  const contrastData = useMemo(() => {
    if (!parsedFg || !parsedBg) return null;
    return getContrastRatio(parsedFg, parsedBg);
  }, [parsedFg, parsedBg]);

  const handleCopy = async (key: string, text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const PRESET_PALETTES = [
    { name: 'Indigo', hex: '#4f46e5' },
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Rose', hex: '#f43f5e' },
    { name: 'Cyan', hex: '#06b6d4' },
    { name: 'Slate Dark', hex: '#0f172a' },
  ];

  return (
    <ToolShell
      toolId="color-converter"
      title="Color Converter & Contrast Checker"
      description="Convert between HEX, RGB, HSL and test WCAG 2.1 color contrast compliance."
      category="design"
      relatedToolIds={['aspect-ratio-calculator', 'encoding-tools', 'json-formatter']}
      outputToTransfer={colorFormats ? colorFormats.hex : ''}
    >
      <div className="space-y-6">
        {/* Mode Navigation Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('convert')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'convert'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Pipette className="w-4 h-4" />
            <span>Color Converter</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contrast')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'contrast'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>WCAG Contrast Checker</span>
          </button>
        </div>

        {/* TAB 1: Color Converter */}
        {activeTab === 'convert' && (
          <div className="space-y-6">
            {/* Input & Swatch Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="color-input" className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Input Color (HEX, RGB, RGBA, HSL, HSLA)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="color-input"
                    type="text"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    placeholder="#2563eb or rgb(37, 99, 235) or hsl(221, 83%, 53%)"
                    className="flex-1 px-3 py-2 font-mono text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    spellCheck={false}
                  />
                  {/* Native color picker sync */}
                  <input
                    type="color"
                    value={colorFormats?.hex || '#2563eb'}
                    onChange={(e) => setColorInput(e.target.value)}
                    className="w-9 h-9 p-0.5 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer bg-white dark:bg-neutral-900"
                    title="Choose color"
                  />
                </div>
              </div>

              {/* Swatch */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <div
                  className="w-12 h-12 rounded-md shadow-xs border border-neutral-300/60 dark:border-neutral-700/60 shrink-0"
                  style={{ backgroundColor: colorFormats ? colorFormats.rgba : 'transparent' }}
                />
                <div className="text-xs space-y-0.5 overflow-hidden">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {colorFormats ? colorFormats.hex : 'Invalid color'}
                  </div>
                  <div className="text-neutral-500 truncate text-[11px]">
                    {colorFormats ? `Alpha: ${colorFormats.rawRgba.a * 100}%` : 'Provide valid color'}
                  </div>
                </div>
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-neutral-500 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3" /> Presets:
              </span>
              {PRESET_PALETTES.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setColorInput(p.hex)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700"
                >
                  <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: p.hex }} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>

            {/* Representations Grid */}
            {colorFormats && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 pb-1 border-b border-neutral-200 dark:border-neutral-800">
                  Color Representations
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'HEX', value: colorFormats.hex, key: 'hex' },
                    { label: 'HEX with Alpha', value: colorFormats.hex8, key: 'hex8' },
                    { label: 'RGB', value: colorFormats.rgb, key: 'rgb' },
                    { label: 'RGBA', value: colorFormats.rgba, key: 'rgba' },
                    { label: 'HSL', value: colorFormats.hsl, key: 'hsl' },
                    { label: 'HSLA', value: colorFormats.hsla, key: 'hsla' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      onClick={() => handleCopy(item.key, item.value)}
                      className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between cursor-pointer hover:border-neutral-400 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="text-[11px] font-medium text-neutral-500">{item.label}</div>
                        <div className="font-mono text-xs sm:text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {item.value}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(item.key, item.value);
                        }}
                        className={`p-1.5 rounded border transition-colors ${
                          copiedKey === item.key
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
                        }`}
                        aria-label={`Copy ${item.label}`}
                      >
                        {copiedKey === item.key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WCAG Contrast Checker */}
        {activeTab === 'contrast' && (
          <div className="space-y-6">
            {/* Color Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Foreground / Text Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={fgColorInput}
                    onChange={(e) => setFgColorInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 font-mono text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                  />
                  <input
                    type="color"
                    value={parsedFg ? formatColorRepresentations(parsedFg).hex : '#000000'}
                    onChange={(e) => setFgColorInput(e.target.value)}
                    className="w-8 h-8 p-0.5 rounded border border-neutral-300 cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Background Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bgColorInput}
                    onChange={(e) => setBgColorInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 font-mono text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                  />
                  <input
                    type="color"
                    value={parsedBg ? formatColorRepresentations(parsedBg).hex : '#ffffff'}
                    onChange={(e) => setBgColorInput(e.target.value)}
                    className="w-8 h-8 p-0.5 rounded border border-neutral-300 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Contrast Ratio & WCAG Results */}
            {contrastData && parsedFg && parsedBg && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
                      Contrast Ratio
                    </div>
                    <div className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 mt-0.5 font-mono">
                      {contrastData.ratio}:1
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className={`p-2.5 rounded border flex items-center gap-2 ${
                      contrastData.wcagAANormal
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-300 border-red-300 dark:border-red-800'
                    }`}>
                      {contrastData.wcagAANormal ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                      <div>
                        <div className="font-bold">AA Normal</div>
                        <div className="text-[10px] opacity-80">Req: 4.5:1</div>
                      </div>
                    </div>

                    <div className={`p-2.5 rounded border flex items-center gap-2 ${
                      contrastData.wcagAALarge
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-300 border-red-300 dark:border-red-800'
                    }`}>
                      {contrastData.wcagAALarge ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                      <div>
                        <div className="font-bold">AA Large</div>
                        <div className="text-[10px] opacity-80">Req: 3.0:1</div>
                      </div>
                    </div>

                    <div className={`p-2.5 rounded border flex items-center gap-2 ${
                      contrastData.wcagAAANormal
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-300 border-red-300 dark:border-red-800'
                    }`}>
                      {contrastData.wcagAAANormal ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                      <div>
                        <div className="font-bold">AAA Normal</div>
                        <div className="text-[10px] opacity-80">Req: 7.0:1</div>
                      </div>
                    </div>

                    <div className={`p-2.5 rounded border flex items-center gap-2 ${
                      contrastData.wcagAAALarge
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-300 border-red-300 dark:border-red-800'
                    }`}>
                      {contrastData.wcagAAALarge ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                      <div>
                        <div className="font-bold">AAA Large</div>
                        <div className="text-[10px] opacity-80">Req: 4.5:1</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Preview Box */}
                <div
                  className="p-6 rounded-lg border border-neutral-300 shadow-inner space-y-3 transition-colors"
                  style={{
                    backgroundColor: formatColorRepresentations(parsedBg).rgba,
                    color: formatColorRepresentations(parsedFg).rgba,
                  }}
                >
                  <h3 className="text-lg font-bold">The quick brown fox jumps over the lazy dog.</h3>
                  <p className="text-sm leading-relaxed">
                    This sample paragraph demonstrates how standard body typography renders with the selected foreground and background color combination under real viewing conditions.
                  </p>
                  <div className="text-xs font-mono opacity-80">
                    Sample small metadata: relative luminance fg: {contrastData.luminance1} / bg: {contrastData.luminance2}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default ColorConverterTool;
