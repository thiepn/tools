import React, { useState, useMemo } from 'react';
import {
  Percent,
  Receipt,
  TrendingUp,
  Tag,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import {
  calculateDiscount,
  calculateVatAdd,
  calculateVatExtract,
  calculateFromCostAndRevenue,
  calculateFromCostAndMargin,
  calculateFromCostAndMarkup,
} from '../../utilities/discount-vat';

interface DiscountVatToolProps {
  initialText?: string;
}

export const DiscountVatTool: React.FC<DiscountVatToolProps> = () => {
  const [activeTab, setActiveTab] = useState<'discount' | 'vat' | 'margin'>('discount');
  const [currency, setCurrency] = useState<string>('$');
  const [copied, setCopied] = useState<boolean>(false);

  // 1. DISCOUNT STATE
  const [origPrice, setOrigPrice] = useState<number>(100);
  const [discPercent, setDiscPercent] = useState<number>(20);
  const [extraDiscPercent, setExtraDiscPercent] = useState<number>(0);
  const [fixedCoupon, setFixedCoupon] = useState<number>(0);

  const discountResult = useMemo(() => {
    return calculateDiscount(origPrice, discPercent, extraDiscPercent, fixedCoupon);
  }, [origPrice, discPercent, extraDiscPercent, fixedCoupon]);

  // 2. VAT STATE
  const [vatMode, setVatMode] = useState<'add' | 'extract'>('add');
  const [vatBaseAmount, setVatBaseAmount] = useState<number>(100);
  const [taxRate, setTaxRate] = useState<number>(20);

  const vatResult = useMemo(() => {
    return vatMode === 'add'
      ? calculateVatAdd(vatBaseAmount, taxRate)
      : calculateVatExtract(vatBaseAmount, taxRate);
  }, [vatMode, vatBaseAmount, taxRate]);

  // 3. MARGIN & MARKUP STATE
  const [marginInputType, setMarginInputType] = useState<'revenue' | 'margin' | 'markup'>('revenue');
  const [costPrice, setCostPrice] = useState<number>(60);
  const [sellingPrice, setSellingPrice] = useState<number>(100);
  const [targetMargin, setTargetMargin] = useState<number>(40);
  const [targetMarkup, setTargetMarkup] = useState<number>(66.67);

  const marginResult = useMemo(() => {
    if (marginInputType === 'revenue') {
      return calculateFromCostAndRevenue(costPrice, sellingPrice);
    } else if (marginInputType === 'margin') {
      return calculateFromCostAndMargin(costPrice, targetMargin);
    } else {
      return calculateFromCostAndMarkup(costPrice, targetMarkup);
    }
  }, [marginInputType, costPrice, sellingPrice, targetMargin, targetMarkup]);

  // Copy helper
  const handleCopy = (text: string) => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolShell
      toolId="discount-vat-calculator"
      title="Discount, VAT & Margin Calculator"
      description="Calculate retail discounts with stacked coupons, sales tax / VAT additions and extractions, and commercial profit margins."
      category="math"
      relatedToolIds={['unit-price-comparator', 'percentage-calculator']}
      outputToTransfer={
        activeTab === 'discount'
          ? `Original: ${currency}${discountResult.originalPrice.toFixed(2)} | Final: ${currency}${discountResult.finalPrice.toFixed(2)} | Saved: ${currency}${discountResult.totalSaved.toFixed(2)} (${discountResult.effectiveDiscountPercent.toFixed(1)}%)`
          : activeTab === 'vat'
          ? `Net: ${currency}${vatResult.netAmount.toFixed(2)} | Tax (${vatResult.taxRate}%): ${currency}${vatResult.taxAmount.toFixed(2)} | Gross: ${currency}${vatResult.grossAmount.toFixed(2)}`
          : `Cost: ${currency}${marginResult.cost.toFixed(2)} | Revenue: ${currency}${marginResult.revenue.toFixed(2)} | Profit: ${currency}${marginResult.profit.toFixed(2)} | Margin: ${marginResult.marginPercent.toFixed(1)}% | Markup: ${marginResult.markupPercent.toFixed(1)}%`
      }
    >
      <div className="space-y-6">
        {/* Top Tab Bar & Currency */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('discount')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
                activeTab === 'discount'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Discount & Coupons</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vat')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
                activeTab === 'vat'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>VAT / Sales Tax</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('margin')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
                activeTab === 'margin'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Margin & Markup</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-neutral-500 font-medium">Currency:</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded font-mono font-bold"
            >
              <option value="$">$ (USD)</option>
              <option value="€">€ (EUR)</option>
              <option value="£">£ (GBP)</option>
              <option value="¥">¥ (JPY / CNY)</option>
              <option value="₩">₩ (KRW)</option>
              <option value="₹">₹ (INR)</option>
            </select>
          </div>
        </div>

        {/* 1. DISCOUNT CALCULATOR */}
        {activeTab === 'discount' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Discount Inputs
                </h4>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                    Original Retail Price ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={origPrice || ''}
                    onChange={(e) => setOrigPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label className="font-medium text-neutral-700 dark:text-neutral-300">
                      Primary Discount (%)
                    </label>
                    <span className="font-mono font-bold text-blue-600">{discPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={discPercent}
                    onChange={(e) => setDiscPercent(Number(e.target.value))}
                    className="w-full accent-blue-600 mb-2"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[10, 15, 20, 25, 30, 40, 50, 70].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscPercent(pct)}
                        className={`px-2 py-0.5 text-[11px] rounded border ${
                          discPercent === pct
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Stacking Discounts */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Extra Stacked Discount (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={extraDiscPercent || ''}
                      onChange={(e) => setExtraDiscPercent(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Fixed Coupon Off ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={fixedCoupon || ''}
                      onChange={(e) => setFixedCoupon(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Discount Breakdown Result Card */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-5 bg-neutral-900 text-white rounded-xl border border-neutral-800 space-y-4 shadow-xs">
                <div className="flex justify-between items-center text-xs text-neutral-400">
                  <span className="uppercase font-bold tracking-wider">Final Sale Price</span>
                  <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">
                    {discountResult.effectiveDiscountPercent.toFixed(1)}% OFF
                  </span>
                </div>

                <div className="text-3xl font-bold font-mono text-emerald-400">
                  {currency}{discountResult.finalPrice.toFixed(2)}
                </div>

                <div className="pt-3 border-t border-neutral-800 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-300">
                    <span>Original Price:</span>
                    <span className="font-mono line-through text-neutral-500">
                      {currency}{discountResult.originalPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Total Money Saved:</span>
                    <span className="font-mono">
                      -{currency}{discountResult.totalSaved.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. VAT / SALES TAX CALCULATOR */}
        {activeTab === 'vat' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Tax Calculation Mode
                  </h4>
                  <div className="flex items-center gap-1 bg-neutral-200 dark:bg-neutral-800 p-0.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => setVatMode('add')}
                      className={`px-2.5 py-1 text-xs font-bold rounded ${
                        vatMode === 'add' ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-2xs' : 'text-neutral-500'
                      }`}
                    >
                      Add VAT
                    </button>
                    <button
                      type="button"
                      onClick={() => setVatMode('extract')}
                      className={`px-2.5 py-1 text-xs font-bold rounded ${
                        vatMode === 'extract' ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-2xs' : 'text-neutral-500'
                      }`}
                    >
                      Extract VAT
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                    {vatMode === 'add' ? 'Net Amount (Excl. Tax)' : 'Gross Amount (Incl. Tax)'} ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={vatBaseAmount || ''}
                    onChange={(e) => setVatBaseAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                    VAT / Sales Tax Rate (%)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={taxRate || ''}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[5, 7, 10, 19, 20, 21, 23].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setTaxRate(r)}
                          className={`px-2 py-1 text-[11px] rounded border ${
                            taxRate === r
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {r}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* VAT Result Breakdown */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-5 bg-neutral-900 text-white rounded-xl border border-neutral-800 space-y-4 shadow-xs">
                <div className="text-xs text-neutral-400 uppercase font-bold tracking-wider">
                  VAT / Sales Tax Breakdown
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2.5 bg-neutral-800/80 rounded border border-neutral-700 text-xs">
                    <span className="text-neutral-400">Net Amount (Before Tax):</span>
                    <span className="font-mono text-sm font-bold text-white">
                      {currency}{vatResult.netAmount.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 bg-neutral-800/80 rounded border border-neutral-700 text-xs">
                    <span className="text-neutral-400">Tax Amount ({vatResult.taxRate}%):</span>
                    <span className="font-mono text-sm font-bold text-blue-400">
                      +{currency}{vatResult.taxAmount.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-emerald-950/40 rounded border border-emerald-800 text-xs">
                    <span className="font-bold text-emerald-300">Gross Total (With Tax):</span>
                    <span className="font-mono text-lg font-bold text-emerald-400">
                      {currency}{vatResult.grossAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. MARGIN & MARKUP CALCULATOR */}
        {activeTab === 'margin' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Cost & Target Strategy
                </h4>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                    Cost of Goods Sold / COGS ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={costPrice || ''}
                    onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={marginInputType === 'revenue'}
                        onChange={() => setMarginInputType('revenue')}
                      />
                      <span>From Selling Price</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={marginInputType === 'margin'}
                        onChange={() => setMarginInputType('margin')}
                      />
                      <span>Target Margin %</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={marginInputType === 'markup'}
                        onChange={() => setMarginInputType('markup')}
                      />
                      <span>Target Markup %</span>
                    </label>
                  </div>

                  {marginInputType === 'revenue' && (
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                        Selling Revenue Price ({currency})
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={sellingPrice || ''}
                        onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                      />
                    </div>
                  )}

                  {marginInputType === 'margin' && (
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                        Target Profit Margin (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={99.9}
                        step="0.1"
                        value={targetMargin || ''}
                        onChange={(e) => setTargetMargin(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                      />
                    </div>
                  )}

                  {marginInputType === 'markup' && (
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                        Target Markup (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={targetMarkup || ''}
                        onChange={(e) => setTargetMarkup(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Margin Result Cards */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-5 bg-neutral-900 text-white rounded-xl border border-neutral-800 space-y-4 shadow-xs">
                <div className="text-xs text-neutral-400 uppercase font-bold tracking-wider">
                  Profit & Commercial Performance
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-neutral-800 rounded border border-neutral-700">
                    <span className="text-[10px] text-neutral-400 block uppercase">Selling Price</span>
                    <span className="font-mono text-base font-bold text-white">
                      {currency}{marginResult.revenue.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 bg-neutral-800 rounded border border-neutral-700">
                    <span className="text-[10px] text-neutral-400 block uppercase">Gross Profit</span>
                    <span className="font-mono text-base font-bold text-emerald-400">
                      {currency}{marginResult.profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-950/40 rounded border border-emerald-800">
                    <span className="text-[10px] text-emerald-300 block uppercase font-bold">Profit Margin</span>
                    <span className="font-mono text-lg font-bold text-emerald-400">
                      {marginResult.marginPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-3 bg-blue-950/40 rounded border border-blue-800">
                    <span className="text-[10px] text-blue-300 block uppercase font-bold">Cost Markup</span>
                    <span className="font-mono text-lg font-bold text-blue-400">
                      {marginResult.markupPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default DiscountVatTool;
