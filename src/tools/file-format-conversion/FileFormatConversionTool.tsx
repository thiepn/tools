import React, { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Download, FileArchive, FileSearch, Upload } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { getPublicFileConversionTask, PUBLIC_FILE_CONVERSION_TASKS } from '../../files/publicFileConversionTasks';
import {
  createTar,
  csvTextToJson,
  csvTextToXlsx,
  csvTextToXml,
  gunzipBytes,
  gzipBytes,
  inspectFile,
  jsonTextToCsv,
  jsonTextToXlsx,
  jsonTextToXml,
  mergeCsvTexts,
  parseTar,
  splitCsv,
  tarToZip,
  xlsxToCsv,
  xlsxToJson,
  xmlTextToCsv,
  xmlTextToJson,
  zipToTar,
  type FileInspection,
} from '../../utilities/file-format-conversion';

function readTaskId(hash: string): string | null {
  const clean = hash.replace(/^#\/?/, '').split('?')[0];
  if (clean.startsWith('tool/')) return clean.slice(5).split('/')[0] || null;
  return clean.split('/')[0] || null;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadBytes(bytes: Uint8Array, filename: string, type = 'application/octet-stream'): void {
  downloadBlob(new Blob([bytes], { type }), filename);
}

function downloadText(text: string, filename: string, type = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type }), filename);
}

const textTasks = new Set(['csv-to-json','json-to-csv','xml-to-json','json-to-xml','xml-to-csv','csv-to-xml']);
const xlsxInputTasks = new Set(['xlsx-to-csv','xlsx-to-json']);
const xlsxOutputTasks = new Set(['csv-to-xlsx','json-to-xlsx']);

function TextConverter({ taskId }: { taskId: string }) {
  const [input, setInput] = useState(taskId.startsWith('json') ? '[{"name":"Ada","score":98},{"name":"Lin","score":91}]' : taskId.startsWith('xml') ? '<records><record><name>Ada</name><score>98</score></record><record><name>Lin</name><score>91</score></record></records>' : 'name,score\r\nAda,98\r\nLin,91');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const convert = () => {
    try {
      const result = taskId === 'csv-to-json' ? csvTextToJson(input)
        : taskId === 'json-to-csv' ? jsonTextToCsv(input)
        : taskId === 'xml-to-json' ? xmlTextToJson(input)
        : taskId === 'json-to-xml' ? jsonTextToXml(input)
        : taskId === 'xml-to-csv' ? xmlTextToCsv(input)
        : csvTextToXml(input);
      setOutput(result); setError('');
    } catch (reason) { setOutput(''); setError(reason instanceof Error ? reason.message : 'Conversion failed.'); }
  };

  const extension = taskId.endsWith('json') ? 'json' : taskId.endsWith('csv') ? 'csv' : 'xml';
  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <label className="block"><span className="mb-2 block text-xs font-bold">Input</span><textarea className="min-h-72 w-full rounded-xl border border-neutral-300 bg-white p-3 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950" value={input} onChange={(e)=>setInput(e.target.value)} /></label>
      <label className="block"><span className="mb-2 block text-xs font-bold">Output</span><textarea className="min-h-72 w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950" readOnly value={output} /></label>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
    <div className="flex flex-wrap gap-2"><button type="button" onClick={convert} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">Convert</button>{output && <button type="button" onClick={()=>downloadText(output, `converted.${extension}`, extension==='json'?'application/json':extension==='csv'?'text/csv;charset=utf-8':'application/xml')} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold dark:border-neutral-700"><Download className="h-4 w-4"/>Download</button>}</div>
  </div>;
}

function XlsxOutput({ taskId }: { taskId: string }) {
  const [input, setInput] = useState(taskId === 'json-to-xlsx' ? '[{"name":"Ada","score":98},{"name":"Lin","score":91}]' : 'name,score\r\nAda,98\r\nLin,91');
  const [error, setError] = useState('');
  const convert = async () => {
    try { const blob = taskId === 'csv-to-xlsx' ? await csvTextToXlsx(input) : await jsonTextToXlsx(input); downloadBlob(blob, 'converted.xlsx'); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Conversion failed.'); }
  };
  return <div className="space-y-4"><textarea className="min-h-72 w-full rounded-xl border border-neutral-300 bg-white p-3 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950" value={input} onChange={(e)=>setInput(e.target.value)} />{error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<button type="button" onClick={()=>void convert()} className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white dark:bg-neutral-100 dark:text-neutral-900"><Download className="h-4 w-4"/>Create XLSX</button></div>;
}

function XlsxInput({ taskId }: { taskId: string }) {
  const [file, setFile] = useState<File | null>(null); const [error,setError]=useState('');
  const convert = async () => { if (!file) return; try { const result = taskId==='xlsx-to-csv' ? await xlsxToCsv(file) : await xlsxToJson(file); downloadText(result, taskId==='xlsx-to-csv'?'converted.csv':'converted.json', taskId==='xlsx-to-csv'?'text/csv;charset=utf-8':'application/json'); setError(''); } catch(reason){setError(reason instanceof Error?reason.message:'Conversion failed.');} };
  return <div className="space-y-4"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e)=>setFile(e.target.files?.[0]??null)} className="block w-full text-sm"/>{file && <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">{file.name} · {(file.size/1024).toFixed(1)} KB</div>}{error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<button type="button" disabled={!file} onClick={()=>void convert()} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900">Convert & download</button></div>;
}

function CsvSplitter() {
  const [text,setText]=useState('name,score\r\nAda,98\r\nLin,91\r\nGrace,95'); const [rows,setRows]=useState(2); const [error,setError]=useState('');
  const run=async()=>{try{const chunks=splitCsv(text,rows);if(!chunks.length)throw new Error('No CSV rows were found.');const zip=new JSZip();chunks.forEach((chunk,i)=>zip.file(`part-${String(i+1).padStart(3,'0')}.csv`,chunk));downloadBlob(await zip.generateAsync({type:'blob',compression:'DEFLATE'}),'csv-parts.zip');setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Unable to split CSV.');}};
  return <div className="space-y-4"><textarea className="min-h-72 w-full rounded-xl border border-neutral-300 p-3 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950" value={text} onChange={(e)=>setText(e.target.value)}/><label className="block max-w-xs text-xs font-semibold">Data rows per file<input type="number" min={1} step={1} value={rows} onChange={(e)=>setRows(Math.max(1,Number(e.target.value)||1))} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"/></label>{error&&<div role="alert" className="text-sm text-red-600">{error}</div>}<button type="button" onClick={()=>void run()} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">Split into ZIP</button></div>;
}

function CsvMerger() {
  const [files,setFiles]=useState<File[]>([]);const[error,setError]=useState('');
  const run=async()=>{try{const merged=mergeCsvTexts(await Promise.all(files.map((file)=>file.text())));downloadText(merged,'merged.csv','text/csv;charset=utf-8');setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Unable to merge CSV files.');}};
  return <div className="space-y-4"><input type="file" accept=".csv,text/csv" multiple onChange={(e)=>setFiles([...e.target.files??[]])}/>{files.length>0&&<div className="text-sm text-neutral-600 dark:text-neutral-400">{files.length} file(s) selected. Headers must match exactly.</div>}{error&&<div role="alert" className="text-sm text-red-600">{error}</div>}<button type="button" disabled={files.length<1} onClick={()=>void run()} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900">Merge & download</button></div>;
}

function FileInspector() {
  const [inspection,setInspection]=useState<FileInspection|null>(null);const[error,setError]=useState('');
  const load=async(file:File)=>{try{setInspection(await inspectFile(file));setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Unable to inspect file.');}};
  return <div className="space-y-4"><input type="file" onChange={(e)=>{const file=e.target.files?.[0];if(file)void load(file);}}/>{error&&<div role="alert" className="text-sm text-red-600">{error}</div>}{inspection&&<div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><div className="text-xs text-neutral-500">Detected type</div><div className="mt-1 text-lg font-bold">{inspection.detectedType}</div><div className="mt-1 text-xs">Confidence: {inspection.confidence}</div></div><div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><div className="text-xs text-neutral-500">MIME</div><div className="mt-1 break-all font-mono text-sm">{inspection.mime}</div><div className="mt-2 text-xs">Extension: {inspection.extension||'none'} · {inspection.size.toLocaleString()} bytes</div></div><div className="sm:col-span-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><div className="text-xs text-neutral-500">First bytes</div><div className="mt-1 break-all font-mono text-xs">{inspection.signature}</div>{inspection.notes.map((note)=><p key={note} className="mt-2 text-xs text-neutral-500">{note}</p>)}</div></div>}</div>;
}

function TarPack() {
  const[files,setFiles]=useState<File[]>([]);const[error,setError]=useState('');
  const run=async()=>{try{const entries=await Promise.all(files.map(async(file)=>({path:file.name,bytes:new Uint8Array(await file.arrayBuffer()),mtime:new Date(file.lastModified)})));downloadBytes(createTar(entries),'archive.tar','application/x-tar');setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Unable to create TAR.');}};
  return <div className="space-y-4"><input type="file" multiple onChange={(e)=>setFiles([...e.target.files??[]])}/>{files.length>0&&<p className="text-sm text-neutral-500">{files.length} file(s) selected.</p>}{error&&<div role="alert" className="text-sm text-red-600">{error}</div>}<button type="button" disabled={!files.length} onClick={()=>void run()} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900">Create TAR</button></div>;
}

function TarExtract() {
  const[entries,setEntries]=useState<ReturnType<typeof parseTar>>([]);const[error,setError]=useState('');
  const load=async(file:File)=>{try{setEntries(parseTar(new Uint8Array(await file.arrayBuffer())));setError('');}catch(reason){setEntries([]);setError(reason instanceof Error?reason.message:'Unable to extract TAR.');}};
  return <div className="space-y-4"><input type="file" accept=".tar,application/x-tar" onChange={(e)=>{const file=e.target.files?.[0];if(file)void load(file);}}/>{error&&<div role="alert" className="text-sm text-red-600">{error}</div>}{entries.length>0&&<div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">{entries.map((entry)=><div key={entry.path} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><div className="truncate text-sm font-semibold">{entry.path}</div><div className="text-xs text-neutral-500">{entry.size.toLocaleString()} bytes</div></div><button type="button" onClick={()=>downloadBytes(entry.bytes,entry.path.split('/').at(-1)||'file')} className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700">Download</button></div>)}</div>}</div>;
}

function GzipTool({ decompress }: { decompress: boolean }) {
  const[file,setFile]=useState<File|null>(null);const[error,setError]=useState('');
  const run=async()=>{if(!file)return;try{const input=new Uint8Array(await file.arrayBuffer());const output=decompress?await gunzipBytes(input):await gzipBytes(input);const name=decompress?(file.name.replace(/\.gz$/i,'')||'decompressed.bin'):`${file.name}.gz`;downloadBytes(output,name,decompress?'application/octet-stream':'application/gzip');setError('');}catch(reason){setError(reason instanceof Error?reason.message:'GZIP operation failed.');}};
  return <div className="space-y-4"><input type="file" accept={decompress?'.gz,application/gzip':undefined} onChange={(e)=>setFile(e.target.files?.[0]??null)}/>{error&&<div role="alert" className="text-sm text-red-600">{error}</div>}<button type="button" disabled={!file} onClick={()=>void run()} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900">{decompress?'Decompress':'Compress'} & download</button></div>;
}

function ArchiveConverter() {
  const[file,setFile]=useState<File|null>(null);const[error,setError]=useState('');
  const run=async()=>{if(!file)return;try{const bytes=new Uint8Array(await file.arrayBuffer());if(file.name.toLowerCase().endsWith('.tar'))downloadBlob(await tarToZip(bytes),file.name.replace(/\.tar$/i,'.zip'));else downloadBytes(await zipToTar(bytes),file.name.replace(/\.zip$/i,'')+'.tar','application/x-tar');setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Archive conversion failed.');}};
  return <div className="space-y-4"><input type="file" accept=".zip,.tar,application/zip,application/x-tar" onChange={(e)=>setFile(e.target.files?.[0]??null)}/><p className="text-xs text-neutral-500">Choose a .zip to create TAR, or a .tar to create ZIP. ZIP input uses Tiny Tools’ existing safety preflight before extraction.</p>{error&&<div role="alert" className="text-sm text-red-600">{error}</div>}<button type="button" disabled={!file} onClick={()=>void run()} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900">Convert archive</button></div>;
}

function renderTask(taskId:string){
  if(textTasks.has(taskId))return <TextConverter taskId={taskId}/>;
  if(xlsxOutputTasks.has(taskId))return <XlsxOutput taskId={taskId}/>;
  if(xlsxInputTasks.has(taskId))return <XlsxInput taskId={taskId}/>;
  if(taskId==='csv-splitter')return <CsvSplitter/>;
  if(taskId==='csv-merger')return <CsvMerger/>;
  if(taskId==='file-type-inspector')return <FileInspector/>;
  if(taskId==='tar-pack')return <TarPack/>;
  if(taskId==='tar-extract')return <TarExtract/>;
  if(taskId==='gzip-compress')return <GzipTool decompress={false}/>;
  if(taskId==='gzip-decompress')return <GzipTool decompress/>;
  if(taskId==='archive-converter')return <ArchiveConverter/>;
  return null;
}

export const FileFormatConversionTool: React.FC = () => {
  const task=useMemo(()=>{const id=typeof window!=='undefined'?readTaskId(window.location.hash):null;return getPublicFileConversionTask(id)??PUBLIC_FILE_CONVERSION_TASKS[0];},[]);
  return <ToolShell toolId={task.id} title={task.name} description={task.description} category="files" relatedToolIds={['table-studio','zip-manager','text-diff']}><div className="space-y-5"><section className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 dark:border-orange-900/70 dark:bg-orange-950/20"><div className="flex items-start gap-3"><div className="rounded-lg border border-orange-200 bg-white p-2 dark:border-orange-900 dark:bg-neutral-950">{task.group==='inspect'?<FileSearch className="h-5 w-5 text-orange-600"/>:<FileArchive className="h-5 w-5 text-orange-600"/>}</div><div><h2 className="text-sm font-bold">Local file processing</h2><p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">Files and pasted data stay in this browser session. Conversion does not require an account or application server.</p></div></div></section>{renderTask(task.id)}<section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400"><strong className="text-neutral-800 dark:text-neutral-200">Format scope:</strong> XLSX conversion focuses on cell values from the first worksheet and does not promise Excel formatting, formulas, macros, charts, merged-cell layout, or workbook-feature preservation. TAR uses portable regular-file entries; GZIP availability depends on browser CompressionStream support.</section></div></ToolShell>;
};

export default FileFormatConversionTool;
