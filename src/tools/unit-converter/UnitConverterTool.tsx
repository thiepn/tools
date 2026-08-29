import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  ArrowRightLeft,
  Ruler,
  Scale,
  Thermometer,
  Grid,
  Droplets,
  Gauge,
  HardDrive,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  UNIT_CATEGORIES,
  convertUnits,
  type UnitCategory,
} from '../../utilities/unit-converter';
import { copyToClipboard } from '../../utilities/clipboard';

const CATEGORY_ICONS: Record<UnitCategory, React.ComponentType<{ className?: string }>> = {
  length: Ruler,
  mass: Scale,
  temperature: Thermometer,
  area: Grid,
  volume: Droplets,
  speed: Gauge,
  digital: HardDrive,
};

export const UnitConverterTool: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<UnitCategory>('length');
  const [inputValue, setInputValue] = useState<string>('100');
  const [fromUnitId, setFromUnitId] = useState<string>('m');
  const [toUnitId, setToUnitId] = useState<string>('ft');
  const [copied, setCopied] = useState(false);

  const currentCategoryDef = useMemo(() => {
    return UNIT_CATEGORIES.find((c) => c.id === selectedCategory) || UNIT_CATEGORIES[0];
  }, [selectedCategory]);

  const handleCategoryChange = (catId: UnitCategory) => {
    setSelectedCategory(catId);
    const cat = UNIT_CATEGORIES.find((c) => c.id === catId);
    if (cat && cat.units.length >= 2) {
      setFromUnitId(cat.units[0].id);
      setToUnitId(cat.units[1].id);
    }
  };

  const handleSwapUnits = () => {
    const temp = fromUnitId;
    setFromUnitId(toUnitId);
    setToUnitId(temp);
  };

  const conversion = useMemo(() => {
    const num = parseFloat(inputValue);
    if (isNaN(num)) return null;
    return convertUnits(selectedCategory, fromUnitId, toUnitId, num);
  }, [selectedCategory, fromUnitId, toUnitId, inputValue]);

  const handleCopy = async () => {
    if (!conversion) return;
    const success = await copyToClipboard(conversion.formatted);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ToolShell
      toolId="unit-converter"
      title="Unit Converter"
      description="Convert between metric, imperial, US customary, and digital units with zero precision drift."
      category="math"
      relatedToolIds={['aspect-ratio-calculator', 'percentage-calculator', 'date-calculator']}
      outputToTransfer={conversion ? conversion.formatted : ''}
    >
      <div className="space-y-6">
        {/* Category Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 text-xs">
          {UNIT_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id];
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryChange(cat.id)}
                className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-colors ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-semibold'
                    : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'}`} />
                <span className="truncate">{cat.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Converter Main Stage */}
        <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
            {/* Input & From Unit */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                From
              </label>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter value"
                className="w-full px-3 py-2 font-mono text-base bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <select
                value={fromUnitId}
                onChange={(e) => setFromUnitId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
              >
                {currentCategoryDef.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center pt-4 md:pt-0">
              <button
                type="button"
                onClick={handleSwapUnits}
                className="p-2.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-xs"
                title="Swap source and target units"
              >
                <ArrowRightLeft className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
              </button>
            </div>

            {/* Output & To Unit */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  To
                </label>
                {conversion && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={conversion ? conversion.formatted : ''}
                readOnly
                placeholder="Converted result"
                className="w-full px-3 py-2 font-mono text-base font-bold bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none text-neutral-900 dark:text-neutral-100"
              />
              <select
                value={toUnitId}
                onChange={(e) => setToUnitId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
              >
                {currentCategoryDef.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversion Formula Card */}
          {conversion && (
            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 flex flex-wrap items-center justify-between gap-2">
              <span>
                Conversion: <strong className="font-mono text-neutral-900 dark:text-neutral-100">{conversion.formula}</strong>
              </span>
              <span className="text-[11px] text-neutral-400">Exact mathematical calculation</span>
            </div>
          )}
        </div>
      </div>
    </ToolShell>
  );
};

export default UnitConverterTool;
