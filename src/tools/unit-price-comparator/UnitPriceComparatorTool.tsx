import React, { useState, useMemo } from 'react';
import {
  Scale,
  Plus,
  Trash2,
  Copy,
  Check,
  Award,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  DollarSign,
  TrendingDown,
  Layers,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import {
  ProductItem,
  SUPPORTED_UNITS,
  NormalizationBasis,
  parseFlexibleNumber,
  evaluateProducts,
} from '../../utilities/unit-price';

interface UnitPriceComparatorToolProps {
  initialText?: string;
}

export const UnitPriceComparatorTool: React.FC<UnitPriceComparatorToolProps> = () => {
  const [currency, setCurrency] = useState<string>('$');
  const [basis, setBasis] = useState<NormalizationBasis>('standard');

  const [products, setProducts] = useState<ProductItem[]>([
    {
      id: 'item-1',
      name: 'Standard Box',
      price: 4.5,
      packCount: 1,
      unitSize: 500,
      unitId: 'g',
    },
    {
      id: 'item-2',
      name: 'Family Value Pack (2-Pack)',
      price: 9.8,
      packCount: 2,
      unitSize: 650,
      unitId: 'g',
    },
    {
      id: 'item-3',
      name: 'Bulk Bag',
      price: 13.5,
      packCount: 1,
      unitSize: 2,
      unitId: 'kg',
    },
  ]);

  const [copied, setCopied] = useState<boolean>(false);

  // Evaluate comparison
  const evaluation = useMemo(() => {
    return evaluateProducts(products, basis);
  }, [products, basis]);

  // Add new item (2 to 6 product limit)
  const handleAddItem = () => {
    if (products.length >= 6) return;
    const nextIdx = products.length + 1;
    const defaultUnit = products[0]?.unitId || 'g';
    const newItem: ProductItem = {
      id: `item-${Date.now()}`,
      name: `Option ${String.fromCharCode(64 + nextIdx)}`,
      price: 5.0,
      packCount: 1,
      unitSize: 100,
      unitId: defaultUnit,
    };
    setProducts([...products, newItem]);
  };

  // Remove item (must have at least 2 items)
  const handleRemoveItem = (id: string) => {
    if (products.length <= 2) return;
    setProducts(products.filter((p) => p.id !== id));
  };

  // Update item field
  const handleUpdateItem = (id: string, updates: Partial<ProductItem>) => {
    setProducts(
      products.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  // Reset to default
  const handleReset = () => {
    setProducts([
      {
        id: 'item-1',
        name: 'Standard Pack',
        price: 4.5,
        packCount: 1,
        unitSize: 500,
        unitId: 'g',
      },
      {
        id: 'item-2',
        name: 'Family Pack',
        price: 9.8,
        packCount: 2,
        unitSize: 650,
        unitId: 'g',
      },
    ]);
  };

  // Copy Summary
  const handleCopySummary = () => {
    const lines = evaluation.items.map((item) => {
      const bestTag = item.isBestValue ? (item.isTie ? ' [TIED BEST VALUE]' : ' [BEST VALUE 🏆]') : '';
      return `${item.name}: ${currency}${item.totalPrice.toFixed(2)} total -> ${currency}${item.pricePerStandardUnit.toFixed(3)} / ${item.standardUnitLabel}${bestTag}`;
    });
    copyToClipboard(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Find winner item
  const bestItem = evaluation.items.find((i) => i.isBestValue);

  return (
    <ToolShell
      toolId="unit-price-comparator"
      title="Unit Price Comparator"
      description="Compare groceries, packaging sizes, and bulk items across mixed units to find the true lowest cost."
      category="everyday"
      relatedToolIds={['discount-vat-calculator', 'percentage-calculator', 'aspect-ratio-calculator']}
      outputToTransfer={evaluation.items
        .map(
          (i) =>
            `${i.name}: ${currency}${i.pricePerStandardUnit.toFixed(3)} / ${i.standardUnitLabel}`
        )
        .join('\n')}
    >
      <div className="space-y-6">
        {/* Top Action, Currency & Normalization Basis Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Currency:
              </span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded font-mono font-bold"
              >
                <option value="$">$ (USD / CAD / AUD)</option>
                <option value="€">€ (EUR)</option>
                <option value="£">£ (GBP)</option>
                <option value="¥">¥ (JPY / CNY)</option>
                <option value="₩">₩ (KRW)</option>
                <option value="₹">₹ (INR)</option>
                <option value="CHF">CHF (Swiss Franc)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Display Basis:
              </span>
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value as NormalizationBasis)}
                className="px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded font-medium"
              >
                <option value="standard">Standard (per kg, L, m, item)</option>
                <option value="hundred">Per 100g / 100ml / item</option>
                <option value="base">Per Base Unit (g, ml, m, item)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddItem}
              disabled={products.length >= 6}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Option ({products.length}/6)</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Warning if comparing incompatible unit types */}
        {evaluation.hasMismatchedCategories && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              Note: You are comparing different unit dimensions (e.g. weight with volume or count). Ensure all products use compatible unit categories for an accurate cost comparison.
            </span>
          </div>
        )}

        {/* Best Value Winner Banner */}
        {bestItem && !evaluation.hasMismatchedCategories && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-emerald-600 text-white">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">
                  {bestItem.isTie ? 'Tied Best Value' : 'Best Value Winner'}
                </div>
                <div className="text-base font-bold text-emerald-900 dark:text-emerald-100">
                  {bestItem.name}
                </div>
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-mono">
                  {currency}{bestItem.pricePerStandardUnit.toFixed(3)} / {bestItem.standardUnitLabel}
                  {bestItem.savingsPercentageVsWorst > 0 && (
                    <span className="ml-2 font-bold bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                      Saves {bestItem.savingsPercentageVsWorst}% vs most expensive
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-1.5 bg-white dark:bg-neutral-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Summary' : 'Copy Comparison'}</span>
            </button>
          </div>
        )}

        {/* Input Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((item, index) => {
            const evalItem = evaluation.items.find((e) => e.id === item.id);
            const isBest = evalItem?.isBestValue && !evaluation.hasMismatchedCategories;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all space-y-3 relative ${
                  isBest
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-700 shadow-xs'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                }`}
              >
                {/* Header & Delete Button */}
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                    className="font-bold text-xs bg-transparent border-b border-dashed border-neutral-300 dark:border-neutral-700 focus:border-blue-500 pb-0.5 w-full text-neutral-900 dark:text-neutral-100"
                    placeholder="Product name / option"
                  />
                  {products.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 text-neutral-400 hover:text-rose-600 rounded transition-colors"
                      title="Remove option"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Price Input */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                    Total Price ({currency})
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-neutral-400 font-bold">
                      {currency}
                    </span>
                    <input
                      type="text"
                      value={item.price || ''}
                      onChange={(e) =>
                        handleUpdateItem(item.id, { price: parseFlexibleNumber(e.target.value) })
                      }
                      placeholder="0.00"
                      className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-bold bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Quantity & Pack Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Pack Count (Qty)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={item.packCount}
                      onChange={(e) =>
                        handleUpdateItem(item.id, {
                          packCount: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      className="w-full px-2 py-1.5 text-xs font-mono bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Size per Item
                    </label>
                    <input
                      type="text"
                      value={item.unitSize || ''}
                      onChange={(e) =>
                        handleUpdateItem(item.id, {
                          unitSize: parseFlexibleNumber(e.target.value),
                        })
                      }
                      placeholder="e.g. 500"
                      className="w-full px-2 py-1.5 text-xs font-mono bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded"
                    />
                  </div>
                </div>

                {/* Unit Selector */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                    Measurement Unit
                  </label>
                  <select
                    value={item.unitId}
                    onChange={(e) => handleUpdateItem(item.id, { unitId: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded font-medium"
                  >
                    <optgroup label="Weight">
                      {SUPPORTED_UNITS.filter((u) => u.category === 'weight').map((u) => (
                        <option key={u.id} value={u.id}>{u.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Volume">
                      {SUPPORTED_UNITS.filter((u) => u.category === 'volume').map((u) => (
                        <option key={u.id} value={u.id}>{u.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Count & Pieces">
                      {SUPPORTED_UNITS.filter((u) => u.category === 'count').map((u) => (
                        <option key={u.id} value={u.id}>{u.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Length & Area">
                      {SUPPORTED_UNITS.filter((u) => u.category === 'length' || u.category === 'area').map((u) => (
                        <option key={u.id} value={u.id}>{u.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Calculated Normalized Result Box */}
                {evalItem && (
                  <div
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      isBest
                        ? 'bg-emerald-100/50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800'
                        : 'bg-neutral-100 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold text-neutral-500 flex items-center justify-between">
                      <span>Normalized Unit Price</span>
                      {isBest && (
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                          {evalItem.isTie ? 'TIED BEST' : 'BEST VALUE'}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-base font-bold text-neutral-900 dark:text-neutral-100">
                      {currency}{evalItem.pricePerStandardUnit.toFixed(3)}{' '}
                      <span className="text-xs text-neutral-500 font-normal">/ {evalItem.standardUnitLabel}</span>
                    </div>
                    {!isBest && evalItem.priceDifferenceVsBest > 0 && (
                      <div className="text-[11px] text-neutral-500 font-mono">
                        +{currency}{evalItem.priceDifferenceVsBest.toFixed(3)} / {evalItem.standardUnitLabel} vs best
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ToolShell>
  );
};

export default UnitPriceComparatorTool;
