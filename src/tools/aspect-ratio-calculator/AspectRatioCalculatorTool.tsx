import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  ArrowRightLeft,
  Ratio,
  Lock,
  Unlock,
  Sparkles,
  Maximize,
  Compass,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  calculateMissingDimension,
  simplifyRatio,
  RATIO_PRESETS,
  type RatioPreset,
} from '../../utilities/aspect-ratio-calculator';
import { copyToClipboard } from '../../utilities/clipboard';

export const AspectRatioCalculatorTool: React.FC = () => {
  // Original / Base Ratio
  const [w1, setW1] = useState('1920');
  const [h1, setH1] = useState('1080');

  // Scaled Target Dimensions
  const [w2, setW2] = useState('1280');
  const [h2, setH2] = useState('720');

  const [activePreset, setActivePreset] = useState<string>('16:9 Widescreen / HD');
  const [isLocked, setIsLocked] = useState(true);
  const [roundToInteger, setRoundToInteger] = useState(true);
  const [copied, setCopied] = useState(false);

  // Simplified ratio calculation for W1/H1
  const simplified = useMemo(() => {
    const nw1 = parseFloat(w1);
    const nh1 = parseFloat(h1);
    if (isNaN(nw1) || isNaN(nh1) || nw1 <= 0 || nh1 <= 0) return null;
    return simplifyRatio(nw1, nh1);
  }, [w1, h1]);

  const handleApplyPreset = (p: RatioPreset) => {
    setActivePreset(p.name);
    setW1(String(p.w));
    setH1(String(p.h));

    const curW2 = parseFloat(w2);
    if (!isNaN(curW2) && curW2 > 0) {
      const calc = calculateMissingDimension(p.w, p.h, curW2, 'width', roundToInteger);
      if (calc !== null) setH2(String(calc));
    }
  };

  const handleW2Change = (val: string) => {
    setW2(val);
    if (isLocked) {
      const numW2 = parseFloat(val);
      const numW1 = parseFloat(w1);
      const numH1 = parseFloat(h1);
      if (!isNaN(numW2) && !isNaN(numW1) && !isNaN(numH1) && numW1 > 0 && numH1 > 0 && numW2 > 0) {
        const res = calculateMissingDimension(numW1, numH1, numW2, 'width', roundToInteger);
        if (res !== null) setH2(String(res));
      }
    }
  };

  const handleH2Change = (val: string) => {
    setH2(val);
    if (isLocked) {
      const numH2 = parseFloat(val);
      const numW1 = parseFloat(w1);
      const numH1 = parseFloat(h1);
      if (!isNaN(numH2) && !isNaN(numW1) && !isNaN(numH1) && numW1 > 0 && numH1 > 0 && numH2 > 0) {
        const res = calculateMissingDimension(numW1, numH1, numH2, 'height', roundToInteger);
        if (res !== null) setW2(String(res));
      }
    }
  };

  const handleSwapDimensions = () => {
    const tempW1 = w1;
    const tempH1 = h1;
    setW1(tempH1);
    setH1(tempW1);

    const tempW2 = w2;
    const tempH2 = h2;
    setW2(tempH2);
    setH2(tempW2);
  };

  const handleCopyRatio = async () => {
    if (!simplified) return;
    const success = await copyToClipboard(simplified.ratioString);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Compute preview aspect ratio CSS string safely
  const previewRatioStyle = useMemo(() => {
    const nw1 = parseFloat(w1);
    const nh1 = parseFloat(h1);
    if (isNaN(nw1) || isNaN(nh1) || nw1 <= 0 || nh1 <= 0) return '16 / 9';
    return `${nw1} / ${nh1}`;
  }, [w1, h1]);

  return (
    <ToolShell
      toolId="aspect-ratio-calculator"
      title="Aspect Ratio Calculator"
      description="Calculate dimensions, simplify pixel ratios, scale visual viewports, and test responsive screen proportions."
      category="design"
      relatedToolIds={['color-converter', 'unit-converter', 'percentage-calculator']}
      outputToTransfer={simplified ? `${simplified.ratioString} (${w2}x${h2})` : ''}
    >
      <div className="space-y-6">
        {/* Presets Row */}
        <div className="flex flex-wrap items-center gap-1.5 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs">
          <span className="text-neutral-500 flex items-center gap-1 font-medium mr-1">
            <Sparkles className="w-3.5 h-3.5" /> Presets:
          </span>
          {RATIO_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className={`px-2.5 py-1 rounded border transition-colors ${
                activePreset === preset.name
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900 font-semibold'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Dimension Controls & Preview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Base Ratio Section */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Ratio className="w-4 h-4 text-blue-600" />
                  Base Aspect Ratio (Width : Height)
                </span>
                <button
                  type="button"
                  onClick={handleSwapDimensions}
                  className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 inline-flex items-center gap-1"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  Swap W/H
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <span className="text-[11px] text-neutral-500">Base Width</span>
                  <input
                    type="number"
                    value={w1}
                    onChange={(e) => setW1(e.target.value)}
                    className="w-full px-3 py-1.5 font-mono text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <span className="text-neutral-400 font-bold text-lg pt-4">:</span>

                <div className="flex-1 space-y-1">
                  <span className="text-[11px] text-neutral-500">Base Height</span>
                  <input
                    type="number"
                    value={h1}
                    onChange={(e) => setH1(e.target.value)}
                    className="w-full px-3 py-1.5 font-mono text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Simplified Ratio Box */}
              {simplified && (
                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-neutral-500">Simplified Ratio:</span>
                    <strong className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
                      {simplified.ratioString}
                    </strong>
                    <span className="text-neutral-400 text-[11px] font-mono">
                      (Decimal: {simplified.decimal.toFixed(3)}:1, GCD: {simplified.gcd})
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <Compass className="w-3 h-3" />
                      {simplified.orientation}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyRatio}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Target Dimensions Section */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Maximize className="w-4 h-4 text-blue-600" />
                  Target Scaled Dimensions
                </span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={roundToInteger}
                      onChange={(e) => setRoundToInteger(e.target.checked)}
                      className="rounded border-neutral-300 text-blue-600"
                    />
                    <span>Integer pixels (round px)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsLocked(!isLocked)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${
                      isLocked
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                        : 'bg-white dark:bg-neutral-900 text-neutral-600 border-neutral-300'
                    }`}
                  >
                    {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span>{isLocked ? 'Ratio Locked' : 'Ratio Unlocked'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <span className="text-[11px] text-neutral-500">Target Width (px)</span>
                  <input
                    type="number"
                    value={w2}
                    onChange={(e) => handleW2Change(e.target.value)}
                    className="w-full px-3 py-1.5 font-mono text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <span className="text-neutral-400 font-bold text-lg pt-4">×</span>

                <div className="flex-1 space-y-1">
                  <span className="text-[11px] text-neutral-500">Target Height (px)</span>
                  <input
                    type="number"
                    value={h2}
                    onChange={(e) => handleH2Change(e.target.value)}
                    className="w-full px-3 py-1.5 font-mono text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Visual Ratio Box Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 min-h-64">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
              Proportional Preview
            </div>

            <div className="w-full max-w-[280px] max-h-[220px] flex items-center justify-center">
              <div
                className="w-full max-h-[200px] rounded-lg border-2 border-blue-500 bg-blue-500/10 dark:bg-blue-500/20 flex flex-col items-center justify-center p-3 text-center transition-all duration-200 shadow-sm"
                style={{
                  aspectRatio: previewRatioStyle,
                }}
              >
                <span className="font-mono text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-200">
                  {simplified?.ratioString || `${w1}:${h1}`}
                </span>
                <span className="text-[11px] text-blue-700/80 dark:text-blue-300/80 font-mono mt-0.5">
                  {w2} × {h2} px
                </span>
                {simplified && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                    {simplified.orientation} • {simplified.decimal.toFixed(2)}:1
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default AspectRatioCalculatorTool;

