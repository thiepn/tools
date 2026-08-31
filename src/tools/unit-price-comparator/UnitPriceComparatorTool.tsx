import React, { useMemo, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import {
  SUPPORTED_UNITS,
  evaluateProducts,
  rankProductsForNeed,
  type NormalizationBasis,
  type ProductItem,
} from '../../utilities/unit-price';

const INITIAL: ProductItem[] = [
  { id:'a', name:'Standard Box', price:4.5, packCount:1, unitSize:500, unitId:'g' },
  { id:'b', name:'Family Pack', price:9.8, packCount:2, unitSize:650, unitId:'g' },
  { id:'c', name:'Bulk Bag', price:13.5, packCount:1, unitSize:2, unitId:'kg' },
];
const baseLabel = (category: string | null) => category === 'weight' ? 'g' : category === 'volume' ? 'mL' : category === 'length' ? 'm' : category === 'area' ? 'm²' : 'items';

export const UnitPriceComparatorTool: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>(INITIAL); const [basis, setBasis] = useState<NormalizationBasis>('standard'); const [currency, setCurrency] = useState('€');
  const [needed, setNeeded] = useState(0); const [waste, setWaste] = useState(0); const [includeTax, setIncludeTax] = useState(true);
  const evaluation = useMemo(() => evaluateProducts(products,basis,{neededQuantityInBase:needed>0?needed:undefined,wastePercent:waste,includeTax}),[products,basis,needed,waste,includeTax]);
  const rankedNeed = useMemo(() => needed>0 ? rankProductsForNeed(products,needed,basis,waste,includeTax) : [],[products,needed,basis,waste,includeTax]);
  const update = (id:string, patch:Partial<ProductItem>) => setProducts((current)=>current.map((p)=>p.id===id?{...p,...patch}:p));
  const add = () => setProducts((current)=>[...current,{id:`item-${Date.now()}`,name:`Option ${current.length+1}`,price:1,packCount:1,unitSize:1,unitId:current[0]?.unitId||'item'}].slice(0,10));
  const summary = evaluation.hasMismatchedCategories ? 'Cannot rank items from different measurement categories.' : evaluation.items.map((item)=>`${item.name}: ${currency}${item.pricePerStandardUnit.toFixed(4)}/${item.standardUnitLabel}${item.isBestValue?' — best value':''}${item.purchaseCostForNeed!==undefined?`; need ${item.packagesForNeed} package(s), ${currency}${item.purchaseCostForNeed.toFixed(2)}`:''}`).join('\n');

  return <ToolShell toolId="unit-price-comparator" title="Unit Price Comparator" description="Compare normalized and effective prices across units, discounts, fees, deposits and tax, then rank whole-package purchase cost for the quantity you actually need." category="math" relatedToolIds={['discount-vat-calculator','unit-converter','percentage-calculator']} outputToTransfer={summary}>
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 items-end p-3 border rounded-xl bg-neutral-50 dark:bg-neutral-950">
        <label className="text-xs">Currency<input value={currency} onChange={(e)=>setCurrency(e.target.value.slice(0,4))} className="block mt-1 w-16 p-2 border rounded bg-white dark:bg-neutral-900"/></label>
        <label className="text-xs">Normalize<select value={basis} onChange={(e)=>setBasis(e.target.value as NormalizationBasis)} className="block mt-1 p-2 border rounded bg-white dark:bg-neutral-900"><option value="standard">standard unit</option><option value="hundred">per 100 g/mL</option><option value="base">base unit</option></select></label>
        <label className="text-xs">Need ({baseLabel(evaluation.primaryCategory)})<input type="number" min={0} value={needed||''} onChange={(e)=>setNeeded(Math.max(0,Number(e.target.value)))} placeholder="optional" className="block mt-1 w-28 p-2 border rounded bg-white dark:bg-neutral-900"/></label>
        <label className="text-xs">Waste buffer %<input type="number" min={0} value={waste} onChange={(e)=>setWaste(Math.max(0,Number(e.target.value)))} className="block mt-1 w-24 p-2 border rounded bg-white dark:bg-neutral-900"/></label>
        <label className="text-xs pb-2 inline-flex gap-1"><input type="checkbox" checked={includeTax} onChange={(e)=>setIncludeTax(e.target.checked)}/>include entered tax</label>
        <button onClick={add} className="px-3 py-2 border rounded text-xs inline-flex gap-1"><Plus className="w-3.5 h-3.5"/>Add option</button>
        <button onClick={()=>void copyToClipboard(summary)} className="px-3 py-2 border rounded text-xs inline-flex gap-1"><Copy className="w-3.5 h-3.5"/>Copy comparison</button>
      </div>

      {evaluation.hasMismatchedCategories && <div role="alert" className="p-3 border border-amber-300 rounded text-xs text-amber-700">Weight, volume, count, length and area are different dimensions and cannot be ranked against each other. Align the units first.</div>}
      {evaluation.hasIncompleteData && <div className="p-3 border rounded text-xs text-neutral-500">One or more rows have incomplete/unknown quantity or effective-price data and are excluded from best-value ranking.</div>}

      <div className="space-y-3">{products.map((p,index)=>{
        const result=evaluation.items.find((item)=>item.id===p.id); const needRank=rankedNeed.findIndex((item)=>item.id===p.id);
        return <div key={p.id} className={`p-4 border rounded-xl space-y-3 ${result?.isBestValue&&!evaluation.hasMismatchedCategories?'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20':''}`}>
          <div className="flex items-center gap-2"><input value={p.name} onChange={(e)=>update(p.id,{name:e.target.value})} className="font-semibold bg-transparent border-b flex-1 min-w-0"/><span className="text-[11px] text-neutral-500">#{index+1}{result?.isBestValue?' · best unit price':''}{needRank===0&&needed>0?' · best purchase cost':''}</span>{products.length>2&&<button onClick={()=>setProducts(v=>v.filter(x=>x.id!==p.id))}><Trash2 className="w-4 h-4 text-red-500"/></button>}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <Field label="Shelf price" value={p.price} set={(v)=>update(p.id,{price:v})}/><Field label="Packs" value={p.packCount} set={(v)=>update(p.id,{packCount:v})}/><Field label="Size / pack" value={p.unitSize} set={(v)=>update(p.id,{unitSize:v})}/>
            <label className="text-[10px]">Unit<select value={p.unitId} onChange={(e)=>update(p.id,{unitId:e.target.value})} className="block mt-1 w-full p-1.5 border rounded bg-white dark:bg-neutral-900 text-xs">{SUPPORTED_UNITS.map((u)=><option key={u.id} value={u.id}>{u.label}</option>)}</select></label>
            <Field label="Discount" value={p.discountAmount||0} set={(v)=>update(p.id,{discountAmount:v})}/><Field label="Fees" value={p.feeAmount||0} set={(v)=>update(p.id,{feeAmount:v})}/><Field label="Deposit" value={p.depositAmount||0} set={(v)=>update(p.id,{depositAmount:v})}/><Field label="Tax %" value={p.taxPercent||0} set={(v)=>update(p.id,{taxPercent:v})}/>
          </div>
          {result&&<div className="grid sm:grid-cols-4 gap-2 text-xs"><Metric label="Effective item price" value={`${currency}${(result.effectivePrice||0).toFixed(2)}`}/><Metric label={`Price / ${result.standardUnitLabel}`} value={`${currency}${result.pricePerStandardUnit.toFixed(4)}`}/><Metric label="Difference vs best" value={`${currency}${result.priceDifferenceVsBest.toFixed(4)}`}/><Metric label={needed>0?'Purchase for need':'Savings vs worst'} value={needed>0&&result.purchaseCostForNeed!==undefined?`${result.packagesForNeed} pkg · ${currency}${result.purchaseCostForNeed.toFixed(2)} · leftover ${result.leftoverInBase?.toFixed(1)} ${baseLabel(result.unitCategory)}`:`${result.savingsPercentageVsWorst.toFixed(2)}%`}/></div>}
        </div>;
      })}</div>
    </div>
  </ToolShell>;
};
const Field=({label,value,set}:{label:string;value:number;set:(value:number)=>void})=><label className="text-[10px]">{label}<input type="number" min={0} step="any" value={value} onChange={(e)=>set(Math.max(0,Number(e.target.value)))} className="block mt-1 w-full p-1.5 border rounded bg-white dark:bg-neutral-900 text-xs"/></label>;
const Metric=({label,value}:{label:string;value:string})=><div className="p-2 bg-neutral-50 dark:bg-neutral-950 rounded"><div className="text-[10px] text-neutral-500">{label}</div><div className="font-mono font-semibold mt-0.5">{value}</div></div>;
export default UnitPriceComparatorTool;
