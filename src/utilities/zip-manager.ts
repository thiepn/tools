/** ZIP / Archive Manager Utility */
import JSZip from 'jszip';
export interface ArchiveEntry{path:string;name:string;isFolder:boolean;uncompressedSize:number;compressedSize?:number;date?:Date;comment?:string;}
export interface PendingZipFile{id:string;file:File;relativePath:string;size:number;}
export interface ArchiveSafetyOptions{maxEntries?:number;maxTotalUncompressedBytes?:number;maxSingleEntryBytes?:number;maxCompressionRatio?:number;}
export const DEFAULT_ARCHIVE_SAFETY:Required<ArchiveSafetyOptions>={maxEntries:5000,maxTotalUncompressedBytes:2*1024*1024*1024,maxSingleEntryBytes:1024*1024*1024,maxCompressionRatio:250};

export function sanitizeZipPath(rawPath:string):string{const normalized=rawPath.replace(/\\/g,'/').replace(/^\/+/, '');const safe:string[]=[];for(const segment of normalized.split('/').filter(Boolean)){if(segment==='.')continue;if(segment==='..'){safe.pop();continue;}safe.push(segment.replace(/[\u0000-\u001f\u007f]/g,''));}return safe.join('/');}

export async function parseZipArchive(zipBlob:Blob|ArrayBuffer,options:ArchiveSafetyOptions={}):Promise<{entries:ArchiveEntry[];totalUncompressedSize:number;zipInstance:JSZip}>{
 const limits={...DEFAULT_ARCHIVE_SAFETY,...options};const zip=new JSZip();const loaded=await zip.loadAsync(zipBlob);const rawEntries=Object.entries(loaded.files);if(rawEntries.length>limits.maxEntries)throw new Error(`Archive contains ${rawEntries.length.toLocaleString()} entries; safety limit is ${limits.maxEntries.toLocaleString()}.`);
 const entries:ArchiveEntry[]=[];let total=0;const safePaths=new Set<string>();
 for(const [relativePath,fileObj] of rawEntries){const safePath=sanitizeZipPath(relativePath);const isFolder=fileObj.dir||relativePath.endsWith('/');if(!safePath&&!isFolder)throw new Error('Archive contains an invalid empty file path.');const collisionKey=safePath.toLocaleLowerCase();if(safePath&&safePaths.has(collisionKey))throw new Error(`Archive contains multiple entries that resolve to the same safe path: ${safePath}`);if(safePath)safePaths.add(collisionKey);
  const internal=(fileObj as unknown as{_data?:{uncompressedSize?:number;compressedSize?:number}})._data;const size=Math.max(0,internal?.uncompressedSize||0);const compressed=Math.max(0,internal?.compressedSize||0);if(size>limits.maxSingleEntryBytes)throw new Error(`Archive entry is too large to open safely: ${safePath}`);total+=size;if(total>limits.maxTotalUncompressedBytes)throw new Error('Archive expands beyond the configured safety limit.');if(!isFolder&&compressed>0&&size/compressed>limits.maxCompressionRatio)throw new Error(`Archive entry has a suspicious compression ratio: ${safePath}`);
  const parts=safePath.split('/');entries.push({path:safePath,name:parts.at(-1)||safePath,isFolder,uncompressedSize:size,compressedSize:compressed||undefined,date:fileObj.date,comment:fileObj.comment});
 }
 return{entries,totalUncompressedSize:total,zipInstance:loaded};
}

export async function createZipArchive(files:PendingZipFile[],compressionLevel:'STORE'|'DEFLATE'='DEFLATE',onProgress?:(percent:number)=>void):Promise<Blob>{const zip=new JSZip();const used=new Set<string>();for(const item of files){const safePath=sanitizeZipPath(item.relativePath||item.file.name);if(!safePath)throw new Error(`Invalid archive path for ${item.file.name}.`);const key=safePath.toLocaleLowerCase();if(used.has(key))throw new Error(`Two files resolve to the same archive path: ${safePath}`);used.add(key);zip.file(safePath,item.file);}return zip.generateAsync({type:'blob',compression:compressionLevel,compressionOptions:{level:compressionLevel==='DEFLATE'?6:1}},metadata=>onProgress?.(Math.round(metadata.percent)));}
export function formatArchiveSize(bytes:number):string{if(!Number.isFinite(bytes)||bytes<=0)return'0 B';const units=['B','KB','MB','GB','TB'];const index=Math.min(units.length-1,Math.floor(Math.log(bytes)/Math.log(1024)));return`${parseFloat((bytes/1024**index).toFixed(2))} ${units[index]}`;}
