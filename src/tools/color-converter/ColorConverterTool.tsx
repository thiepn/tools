import React, { useMemo, useState } from 'react';
import { Check, Copy, Pipette } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import {
  deltaEOklab,
  findAccessibleTextColor,
  formatColorRepresentations,
  getContrastRatio,
  parseColor,
} from '../../utilities/color-converter';

interface ColorConverterToolProps { initialText?: string }
export const ColorConverterTool: React.FC<ColorConverterToolProps> = ({ initialText = '' }) => {
  const [tab,setTab]=useState<'convert'|'contrast'>('convert'); const [input,setInput]=useState(initialText||'#2563eb'); const [foreground,setForeground]=useState('#1e293b'); const [background,setBackground]=useState('#f8fafc'); const [copied,setCopied]=useState('');
  const parsed=useMemo(()=>parseColor(input),[input]),formats=useMemo(()=>parsed?formatColorRepresentations(parsed):null,[parsed]);
  const fg=useMemo(()=>parseColor(foreground),[foreground]),bg=useMemo(()=>parseColor(background),[background]),contrast=useMemo(()=>fg&&bg?getContrastRatio(fg,bg):null,[fg,bg]);
  const accessible=useMemo(()=>bg?findAccessibleTextColor(bg,7):null,[bg]);
  const copy=async(key:string,value:string)=>{if(await copyToClipboard(value)){setCopied(key);window.setTimeout(()=>setCopied(''),1200);}};
  return <ToolShell toolId="color-converter" title="Color Converter & Contrast Checker" description="Bidirectionally convert HEX, RGB, HSL, OKLab and OKLCH, including alpha, and test composited WCAG contrast with perceptual color distance." category="design" relatedToolIds={['aspect-ratio-calculator','palette-extractor','image-optimizer']} outputToTransfer={formats?.hex||''}>
    <div className="space-y-5">
      <div className="flex gap-2 border-b pb-2"><button onClick={()=>setTab('convert')} className={`px-3 py-2 text-xs rounded ${tab==='convert'?'bg-neutral-900 text-white dark:bg-white dark:text-black':''}`}>Converter</button><button onClick={()=>setTab('contrast')} className={`px-3 py-2 text-xs rounded ${tab==='contrast'?'bg-neutral-900 text-white dark:bg-white dark:text-black':''}`}>WCAG contrast</button></div>
      {tab==='convert'&&<><div className="grid md:grid-cols-[1fr_180px] gap-4"><div><label className="text-xs font-semibold">Any supported CSS color<input value={input} onChange={(e)=>setInput(e.target.value)} placeholder="#2563eb · rgb(37 99 235 / .5) · oklch(60% .2 260)" className="mt-1 block w-full p-3 border rounded-xl bg-white dark:bg-neutral-900 font-mono"/></label>{!parsed&&<div className="text-xs text-red-600 mt-1">Invalid/unsupported color syntax.</div>}</div><div className="rounded-xl border min-h-24" style={{background:parsed?formats?.rgba:'transparent'}} /></div>{formats&&<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{([['HEX',formats.hex],['HEX + alpha',formats.hex8],['RGB',formats.rgb],['RGBA',formats.rgba],['HSL',formats.hsl],['HSLA',formats.hsla],['OKLab',formats.oklab],['OKLCH',formats.oklch]] as const).map(([label,value])=><button key={label} onClick={()=>void copy(label,value)} className="p-3 border rounded-xl text-left"><div className="flex justify-between text-[10px] text-neutral-500"><span>{label}</span>{copied===label?<Check className="w-3 h-3 text-emerald-600"/>:<Copy className="w-3 h-3"/>}</div><div className="mt-1 font-mono text-xs break-all">{value}</div></button>)}</div>}{parsed&&<div className="p-3 border rounded-xl text-xs text-neutral-500">Perceptual self-distance ΔE<sub>OK</sub>: {deltaEOklab(parsed,parsed).toFixed(4)}. OKLab/OKLCH values are converted through linear sRGB and clipped to the browser sRGB gamut.</div>}</>}
      {tab==='contrast'&&<div className="space-y-4"><div className="grid md:grid-cols-2 gap-3"><label className="text-xs">Foreground<input value={foreground} onChange={(e)=>setForeground(e.target.value)} className="block mt-1 w-full p-2.5 border rounded bg-white dark:bg-neutral-900 font-mono"/></label><label className="text-xs">Background<input value={background} onChange={(e)=>setBackground(e.target.value)} className="block mt-1 w-full p-2.5 border rounded bg-white dark:bg-neutral-900 font-mono"/></label></div>{fg&&bg&&contrast&&<><div className="p-8 rounded-xl border text-center text-lg font-semibold" style={{color:formatsFor(fg),background:formatsFor(bg)}}>Readable text preview — alpha is composited before contrast measurement.</div><div className="grid sm:grid-cols-3 gap-2"><Metric label="Contrast ratio" value={`${contrast.ratio}:1`}/><Metric label="WCAG AA normal" value={contrast.wcagAANormal?'PASS':'FAIL'}/><Metric label="WCAG AAA normal" value={contrast.wcagAAANormal?'PASS':'FAIL'}/></div>{accessible&&<div className="p-3 border rounded-xl text-xs inline-flex items-center gap-2"><Pipette className="w-4 h-4"/>Best black/white AAA text candidate: <strong>{accessible.color.r===0?'black':'white'}</strong> · {accessible.ratio}:1 · {accessible.passes?'passes AAA':'does not reach AAA'}</div>}</>}</div>}
    </div>
  </ToolShell>;
};
const formatsFor=(color:{r:number;g:number;b:number;a:number})=>`rgba(${color.r},${color.g},${color.b},${color.a})`;
const Metric=({label,value}:{label:string;value:string})=><div className="p-3 border rounded-xl"><div className="text-[10px] text-neutral-500">{label}</div><div className="font-mono font-bold mt-1">{value}</div></div>;
export default ColorConverterTool;
