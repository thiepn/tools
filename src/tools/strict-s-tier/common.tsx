import React from 'react';

export const section = 'rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950';
export const input = 'mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700';
export const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900';
export const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900';

export function Metric({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50"><div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-1 break-words text-sm font-bold">{value}</div>{note&&<div className="mt-1 text-[10px] leading-4 text-neutral-500">{note}</div>}</div>;
}
export function Num({ label, value, set, min, max, step='any' }: { label: string; value: number; set: (value: number) => void; min?: number; max?: number; step?: number | 'any' }) {
  return <label className="text-xs font-semibold">{label}<input aria-label={label} className={input} type="number" value={Number.isFinite(value)?value:''} min={min} max={max} step={step} onChange={(event)=>set(Number(event.target.value))}/></label>;
}
export function Text({ label, value, set, placeholder }: { label: string; value: string; set: (value: string) => void; placeholder?: string }) {
  return <label className="text-xs font-semibold">{label}<input aria-label={label} className={input} value={value} placeholder={placeholder} onChange={(event)=>set(event.target.value)}/></label>;
}
export function Area({ label, value, set, rows=7 }: { label: string; value: string; set: (value: string) => void; rows?: number }) {
  return <label className="block text-xs font-semibold">{label}<textarea aria-label={label} rows={rows} className={`${input} resize-y font-mono`} value={value} onChange={(event)=>set(event.target.value)}/></label>;
}
export function Select({ label, value, set, options }: { label: string; value: string; set: (value: string) => void; options: Array<[string,string]> }) {
  return <label className="text-xs font-semibold">{label}<select aria-label={label} className={input} value={value} onChange={(event)=>set(event.target.value)}>{options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>;
}
export function Check({ label, checked, set }: { label: string; checked: boolean; set: (value: boolean) => void }) {
  return <label className="flex min-h-10 items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={checked} onChange={(event)=>set(event.target.checked)}/>{label}</label>;
}
export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">{children}</div>;
}
export function ErrorBox({ error }: { error: string }) { return error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{error}</div> : null; }
export function Json({ value }: { value: unknown }) { return <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-xl border bg-neutral-50 p-3 text-xs dark:bg-neutral-950">{typeof value==='string'?value:JSON.stringify(value,null,2)}</pre>; }
export function downloadText(name:string, content:string, type='text/plain;charset=utf-8') { const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const anchor=document.createElement('a'); anchor.href=url; anchor.download=name; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),500); }
export function formatNumber(value:number,digits=2){return Number.isFinite(value)?value.toLocaleString(undefined,{maximumFractionDigits:digits}):'—'}
