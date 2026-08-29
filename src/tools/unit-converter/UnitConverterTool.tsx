import React, { useMemo, useState } from 'react';
import {
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
import { CopyButton } from '../../components/tool-ui/ToolControls';
import {
  UNIT_CATEGORIES,
  convertUnits,
  type UnitCategory,
} from '../../utilities/unit-converter';

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
    setFromUnitId(toUnitId);
    setToUnitId(fromUnitId);
  };

  const conversion = useMemo(() => {
    const num = parseFloat(inputValue);
    if (Number.isNaN(num)) return null;
    return convertUnits(selectedCategory, fromUnitId, toUnitId, num);
  }, [selectedCategory, fromUnitId, toUnitId, inputValue]);

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
        <div
          className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 text-xs"
          role="group"
          aria-label="Unit category"
        >
          {UNIT_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id];
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryChange(cat.id)}
                aria-pressed={isSelected}
                className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-colors ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-semibold'
                    : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{cat.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
            <div className="md:col-span-2 space-y-2">
              <label
                htmlFor="unit-converter-input"
                className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block"
              >
                From
              </label>
              <input
                id="unit-converter-input"
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter value"
                className="w-full px-3 py-2 font-mono text-base bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <label htmlFor="unit-converter-from-unit" className="sr-only">
                Source unit
              </label>
              <select
                id="unit-converter-from-unit"
                value={fromUnitId}
                onChange={(e) => setFromUnitId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
              >
                {currentCategoryDef.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center py-1 md:pt-4">
              <button
                type="button"
                onClick={handleSwapUnits}
                className="p-2.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-xs"
                title="Swap source and target units"
                aria-label="Swap source and target units"
              >
                <ArrowRightLeft className="w-4 h-4 text-neutral-600 dark:text-neutral-300" aria-hidden="true" />
              </button>
            </div>

            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="unit-converter-output"
                  className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block"
                >
                  To
                </label>
                <CopyButton
                  value={conversion?.formatted || ''}
                  label="Copy result"
                  copiedLabel="Copied"
                  disabled={!conversion}
                  className="border-0 bg-transparent px-1.5 py-1 text-blue-600 hover:bg-blue-50 dark:bg-transparent dark:text-blue-400 dark:hover:bg-blue-950/40"
                />
              </div>
              <input
                id="unit-converter-output"
                type="text"
                value={conversion ? conversion.formatted : ''}
                readOnly
                aria-live="polite"
                placeholder="Converted result"
                className="w-full px-3 py-2 font-mono text-base font-bold bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none text-neutral-900 dark:text-neutral-100"
              />
              <label htmlFor="unit-converter-to-unit" className="sr-only">
                Target unit
              </label>
              <select
                id="unit-converter-to-unit"
                value={toUnitId}
                onChange={(e) => setToUnitId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
              >
                {currentCategoryDef.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {conversion && (
            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 flex flex-wrap items-center justify-between gap-2">
              <span>
                Conversion:{' '}
                <strong className="font-mono text-neutral-900 dark:text-neutral-100">
                  {conversion.formula}
                </strong>
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