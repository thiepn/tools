import React, { useMemo, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import {
  calculateBreakEven,
  calculateDiscount,
  calculateFromCostAndMargin,
  calculateFromCostAndMarkup,
  calculateFromCostAndRevenue,
  calculatePricingScenario,
  calculateVatAdd,
  calculateVatExtract,
  type PricingAdjustment,
} from '../../utilities/discount-vat';

type Tab = 'discount' | 'vat' | 'margin' | 'scenario';
const money = (symbol: string, value: number) => `${symbol}${value.toFixed(2)}`;

export const DiscountVatTool: React.FC = () => {
  const [tab, setTab] = useState<Tab>('discount'); const [currency, setCurrency] = useState('€');
  const [price, setPrice] = useState(100); const [discount, setDiscount] = useState(20); const [secondDiscount, setSecondDiscount] = useState(0); const [coupon, setCoupon] = useState(0);
  const [vatMode, setVatMode] = useState<'add'|'extract'>('add'); const [vatAmount, setVatAmount] = useState(100); const [vatRate, setVatRate] = useState(19);
  const [marginMode, setMarginMode] = useState<'revenue'|'margin'|'markup'>('revenue'); const [cost, setCost] = useState(60); const [revenue, setRevenue] = useState(100); const [target, setTarget] = useState(40);
  const [base, setBase] = useState(100); const [adjustments, setAdjustments] = useState<PricingAdjustment[]>([{ type:'percent-discount', value:10, label:'Sale' },{ type:'tax', value:19, label:'VAT' }]);
  const [fixedCosts, setFixedCosts] = useState(1000); const [unitPrice, setUnitPrice] = useState(25); const [variableCost, setVariableCost] = useState(15);

  const discountResult = useMemo(() => calculateDiscount(price, discount, secondDiscount, coupon), [price, discount, secondDiscount, coupon]);
  const vatResult = useMemo(() => vatMode === 'add' ? calculateVatAdd(vatAmount, vatRate) : calculateVatExtract(vatAmount, vatRate), [vatMode, vatAmount, vatRate]);
  const marginResult = useMemo(() => marginMode === 'revenue' ? calculateFromCostAndRevenue(cost, revenue) : marginMode === 'margin' ? calculateFromCostAndMargin(cost, target) : calculateFromCostAndMarkup(cost, target), [marginMode, cost, revenue, target]);
  const scenario = useMemo(() => calculatePricingScenario(base, adjustments), [base, adjustments]);
  const breakEven = useMemo(() => calculateBreakEven(fixedCosts, unitPrice, variableCost), [fixedCosts, unitPrice, variableCost]);
  const output = tab === 'discount' ? `Final ${money(currency, discountResult.finalPrice)}; saved ${money(currency, discountResult.totalSaved)} (${discountResult.effectiveDiscountPercent.toFixed(2)}%)` : tab === 'vat' ? `Net ${money(currency, vatResult.netAmount)}; tax ${money(currency, vatResult.taxAmount)}; gross ${money(currency, vatResult.grossAmount)}` : tab === 'margin' ? `Profit ${money(currency, marginResult.profit)}; margin ${marginResult.marginPercent.toFixed(2)}%; markup ${marginResult.markupPercent.toFixed(2)}%` : `Final ${money(currency, scenario.finalPrice)} after ${scenario.steps.length} ordered adjustments`;
  const setAdjustment = (index: number, patch: Partial<PricingAdjustment>) => setAdjustments((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));

  return <ToolShell toolId="discount-vat-calculator" title="Discount, VAT & Margin Calculator" description="Audit retail pricing with stacked discounts, VAT extraction/addition, margin/markup targets, ordered pricing adjustments and break-even planning." category="math" relatedToolIds={['unit-price-comparator','percentage-calculator']} outputToTransfer={output}>
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">{(['discount','vat','margin','scenario'] as Tab[]).map((id) => <button type="button" key={id} onClick={() => setTab(id)} className={`px-3 py-2 text-xs rounded-lg border font-semibold ${tab===id?'bg-neutral-900 text-white dark:bg-white dark:text-black':''}`}>{id === 'scenario' ? 'Pricing chain' : id.toUpperCase()}</button>)}<label className="ml-auto text-xs">Currency <input value={currency} onChange={(e) => setCurrency(e.target.value.slice(0,4))} className="ml-1 w-14 p-1.5 border rounded bg-white dark:bg-neutral-900 text-center" /></label><button type="button" onClick={() => void copyToClipboard(output)} className="px-3 py-2 border rounded text-xs inline-flex gap-1"><Copy className="w-3.5 h-3.5"/>Copy</button></div>

      {tab === 'discount' && <div className="grid md:grid-cols-2 gap-4"><div className="p-4 border rounded-xl grid grid-cols-2 gap-3"><NumberField label="Original price" value={price} set={setPrice}/><NumberField label="Primary discount %" value={discount} set={setDiscount}/><NumberField label="Extra discount %" value={secondDiscount} set={setSecondDiscount}/><NumberField label="Fixed coupon" value={coupon} set={setCoupon}/></div><ResultCard title="Stacked discount"><Row label="Final price" value={money(currency,discountResult.finalPrice)}/><Row label="Total saved" value={money(currency,discountResult.totalSaved)}/><Row label="Effective discount" value={`${discountResult.effectiveDiscountPercent.toFixed(2)}%`}/></ResultCard></div>}

      {tab === 'vat' && <div className="grid md:grid-cols-2 gap-4"><div className="p-4 border rounded-xl space-y-3"><div className="flex gap-2"><button onClick={()=>setVatMode('add')} className={`px-3 py-1.5 text-xs border rounded ${vatMode==='add'?'bg-blue-600 text-white':''}`}>Add tax</button><button onClick={()=>setVatMode('extract')} className={`px-3 py-1.5 text-xs border rounded ${vatMode==='extract'?'bg-blue-600 text-white':''}`}>Extract included tax</button></div><NumberField label={vatMode==='add'?'Net amount':'Gross amount'} value={vatAmount} set={setVatAmount}/><NumberField label="VAT / tax rate %" value={vatRate} set={setVatRate}/></div><ResultCard title="Tax decomposition"><Row label="Net" value={money(currency,vatResult.netAmount)}/><Row label={`Tax (${vatResult.taxRate}%)`} value={money(currency,vatResult.taxAmount)}/><Row label="Gross" value={money(currency,vatResult.grossAmount)}/></ResultCard></div>}

      {tab === 'margin' && <div className="grid md:grid-cols-2 gap-4"><div className="p-4 border rounded-xl space-y-3"><label className="text-xs block">Solve from<select value={marginMode} onChange={(e)=>setMarginMode(e.target.value as typeof marginMode)} className="block mt-1 w-full p-2 border rounded bg-white dark:bg-neutral-900"><option value="revenue">cost + selling price</option><option value="margin">cost + target margin</option><option value="markup">cost + target markup</option></select></label><NumberField label="Cost" value={cost} set={setCost}/>{marginMode==='revenue'?<NumberField label="Selling price" value={revenue} set={setRevenue}/>:<NumberField label={marginMode==='margin'?'Target margin %':'Target markup %'} value={target} set={setTarget}/>}</div><ResultCard title="Profit structure"><Row label="Revenue" value={money(currency,marginResult.revenue)}/><Row label="Profit" value={money(currency,marginResult.profit)}/><Row label="Margin" value={`${marginResult.marginPercent.toFixed(2)}%`}/><Row label="Markup" value={`${marginResult.markupPercent.toFixed(2)}%`}/></ResultCard></div>}

      {tab === 'scenario' && <div className="space-y-4"><div className="grid lg:grid-cols-[1fr_300px] gap-4"><div className="p-4 border rounded-xl space-y-3"><NumberField label="Starting price" value={base} set={setBase}/><div className="text-xs font-semibold">Ordered adjustments</div>{adjustments.map((a,i)=><div key={i} className="grid grid-cols-[1fr_1fr_90px_auto] gap-2"><input value={a.label||''} onChange={(e)=>setAdjustment(i,{label:e.target.value})} className="p-2 text-xs border rounded bg-white dark:bg-neutral-900"/><select value={a.type} onChange={(e)=>setAdjustment(i,{type:e.target.value as PricingAdjustment['type']})} className="p-2 text-xs border rounded bg-white dark:bg-neutral-900"><option value="fixed-discount">fixed discount</option><option value="percent-discount">% discount</option><option value="fixed-fee">fixed fee</option><option value="percent-fee">% fee</option><option value="tax">tax %</option></select><input type="number" value={a.value} onChange={(e)=>setAdjustment(i,{value:Number(e.target.value)})} className="p-2 text-xs border rounded bg-white dark:bg-neutral-900"/><button onClick={()=>setAdjustments(v=>v.filter((_,x)=>x!==i))}><Trash2 className="w-4 h-4 text-red-500"/></button></div>)}<button onClick={()=>setAdjustments(v=>[...v,{type:'percent-discount',value:0,label:'Adjustment'}])} className="text-xs border rounded px-3 py-2 inline-flex gap-1"><Plus className="w-3 h-3"/>Add adjustment</button></div><ResultCard title="Ordered result"><Row label="Starting price" value={money(currency,scenario.basePrice)}/>{scenario.steps.map((s,i)=><Row key={i} label={`${i+1}. ${s.label}`} value={`${s.change>=0?'+':''}${money(currency,s.change)} → ${money(currency,s.after)}`}/>) }<Row label="Final" value={money(currency,scenario.finalPrice)}/></ResultCard></div><div className="p-4 border rounded-xl"><div className="font-semibold text-xs mb-3">Break-even planning</div><div className="grid sm:grid-cols-3 gap-3"><NumberField label="Fixed costs" value={fixedCosts} set={setFixedCosts}/><NumberField label="Price / unit" value={unitPrice} set={setUnitPrice}/><NumberField label="Variable cost / unit" value={variableCost} set={setVariableCost}/></div><div className="mt-3 text-sm">{breakEven.error ? <span className="text-red-600">{breakEven.error}</span> : <>Contribution margin <strong>{money(currency,breakEven.contributionMargin)}</strong> · break-even <strong>{breakEven.units} units</strong></>}</div></div></div>}
    </div>
  </ToolShell>;
};

const NumberField = ({label,value,set}:{label:string;value:number;set:(v:number)=>void}) => <label className="text-xs block">{label}<input type="number" value={value} onChange={(e)=>set(Number(e.target.value))} className="mt-1 block w-full p-2 border rounded bg-white dark:bg-neutral-900" /></label>;
const Row = ({label,value}:{label:string;value:string}) => <div className="flex justify-between gap-3 text-xs py-1"><span className="text-neutral-500">{label}</span><strong className="font-mono text-right">{value}</strong></div>;
const ResultCard = ({title,children}:{title:string;children:React.ReactNode}) => <div className="p-4 border rounded-xl bg-neutral-50 dark:bg-neutral-950"><div className="font-semibold text-xs mb-2">{title}</div>{children}</div>;
export default DiscountVatTool;
