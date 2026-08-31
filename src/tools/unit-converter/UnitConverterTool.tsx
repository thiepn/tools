import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Copy } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import { UNIT_CATEGORIES, convertToAllUnits, convertUnits, validateUnitValue, type UnitCategory } from '../../utilities/unit-converter';

export const UnitConverterTool: React.FC = () => {
  const [selectedCategory,setSelectedCategory]=useState<UnitCategory>('length'); const [inputValue,setInputValue]=useState('100'); const [fromUnitId,setFromUnitId]=useState('m'); const [toUnitId,setToUnitId]=useState('ft');
  const category=useMemo(()=>UNIT_CATEGORIES.find((c)=>c.id===selectedCategory)||UNIT_CATEGORIES[0],[selectedCategory]);
  const numeric=Number(inputValue),validation=validateUnitValue(selectedCategory,fromUnitId,numeric),conversion=Number.isNaN(numeric)?null:convertUnits(selectedCategory,fromUnitId,toUnitId,numeric);
  const all=useMemo(()=>Number.isFinite(numeric)&&validation.valid?convertToAllUnits(selectedCategory,fromUnitId,numeric):[],[selectedCategory,fromUnitId,numeric,validation.valid]);
  const changeCategory=(id:UnitCategory)=>{setSelectedCategory(id);const next=UNIT_CATEGORIES.find((c)=>c.id===id);if(next?.units.length){setFromUnitId(next.units[0].id);setToUnitId(next.units[Math.min(1,next.units.length-1)].id);}};
  const swap=()=>{setFromUnitId(toUnitId);setToUnitId(fromUnitId);};
  return <ToolShell toolId="unit-converter" title="Unit Converter" description="Convert across 15 physical and data categories with SI/IEC distinctions, engineering units, precise constants and physical-limit validation." category="math" relatedToolIds={['aspect-ratio-calculator','percentage-calculator','date-calculator']} outputToTransfer={conversion?.formatted||''}>
    <div className="space-y-5">
      <div role="group" aria-label="Unit category" className="flex flex-wrap gap-1.5">{UNIT_CATEGORIES.map((cat)=><button key={cat.id} type="button" aria-pressed={selectedCategory===cat.id} onClick={()=>changeCategory(cat.id)} className={`px-2.5 py-1.5 text-xs border rounded-lg ${selectedCategory===cat.id?'bg-blue-600 text-white border-blue-600':''}`}>{cat.name}</button>)}</div>
      <div className="p-4 border rounded-xl bg-neutral-50 dark:bg-neutral-950">
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          <div className="space-y-2"><label htmlFor="unit-converter-input" className="text-xs font-semibold">From</label><input id="unit-converter-input" type="number" value={inputValue} onChange={(e)=>setInputValue(e.target.value)} className="block w-full p-2.5 border rounded bg-white dark:bg-neutral-900 font-mono"/><select id="unit-converter-from-unit" value={fromUnitId} onChange={(e)=>setFromUnitId(e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-neutral-900 text-xs">{category.units.map((u)=><option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}</select></div>
          <button type="button" onClick={swap} aria-label="Swap source and target units" title="Swap source and target units" className="p-2.5 border rounded-full"><ArrowRightLeft className="w-4 h-4"/></button>
          <div className="space-y-2"><div className="flex justify-between"><label htmlFor="unit-converter-output" className="text-xs font-semibold">To</label><button type="button" onClick={()=>conversion&&void copyToClipboard(conversion.formatted)} className="text-xs inline-flex gap-1"><Copy className="w-3 h-3"/>Copy</button></div><input id="unit-converter-output" type="text" value={conversion?.formatted||''} readOnly aria-live="polite" className="block w-full p-2.5 border rounded bg-neutral-100 dark:bg-neutral-900 font-mono font-bold"/><select id="unit-converter-to-unit" value={toUnitId} onChange={(e)=>setToUnitId(e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-neutral-900 text-xs">{category.units.map((u)=><option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}</select></div>
        </div>
        {!validation.valid&&<div role="alert" className="text-xs text-red-600 mt-3">{validation.error}</div>}
        {conversion&&validation.valid&&<div className="text-xs text-neutral-500 border-t mt-4 pt-3">Conversion: <strong className="font-mono text-neutral-800 dark:text-neutral-200">{conversion.formula}</strong></div>}
      </div>
      {all.length>2&&validation.valid&&<div className="p-4 border rounded-xl"><div className="text-xs font-semibold mb-2">Equivalent values in {category.name}</div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{all.filter((r)=>r.unitId!==fromUnitId).map((r)=><div key={r.unitId} className="p-2 bg-neutral-50 dark:bg-neutral-950 rounded"><div className="font-mono text-xs font-semibold">{r.formatted} {r.symbol}</div><div className="text-[10px] text-neutral-500">{category.units.find((u)=>u.id===r.unitId)?.name}</div></div>)}</div></div>}
    </div>
  </ToolShell>;
};
export default UnitConverterTool;
