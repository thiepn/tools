/** Screen Recorder Utility */
export interface RecordingMeta{blob:Blob;url:string;durationSeconds:number;mimeType:string;sizeBytes:number;recordedAt:Date;}
export const VIDEO_MIME_CANDIDATES=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4;codecs=avc1,mp4a.40.2','video/mp4'] as const;

export function getSupportedVideoMimeType():string{if(typeof MediaRecorder==='undefined')return'video/webm';for(const type of VIDEO_MIME_CANDIDATES){try{if(MediaRecorder.isTypeSupported(type))return type;}catch{/* older implementations */}}return'video/webm';}
/** Returns no mimeType override when the browser does not advertise any candidate, allowing MediaRecorder to choose safely. */
export function getMediaRecorderOptions(videoBitsPerSecond?:number):MediaRecorderOptions{const options:MediaRecorderOptions={};if(typeof MediaRecorder!=='undefined'){for(const type of VIDEO_MIME_CANDIDATES){try{if(MediaRecorder.isTypeSupported(type)){options.mimeType=type;break;}}catch{}}}if(Number.isFinite(videoBitsPerSecond)&&videoBitsPerSecond!>0)options.videoBitsPerSecond=Math.round(videoBitsPerSecond!);return options;}

export function formatRecordingDuration(seconds:number):string{const value=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0)),hours=Math.floor(value/3600),minutes=Math.floor((value%3600)/60),secs=value%60,pad=(n:number)=>String(n).padStart(2,'0');return hours>0?`${pad(hours)}:${pad(minutes)}:${pad(secs)}`:`${pad(minutes)}:${pad(secs)}`;}
export function formatByteSize(bytes:number):string{if(!Number.isFinite(bytes)||bytes<=0)return'0 B';const units=['B','KB','MB','GB','TB'];const index=Math.min(units.length-1,Math.floor(Math.log(bytes)/Math.log(1024)));const decimals=index<=1?1:2;return`${Number((bytes/1024**index).toFixed(decimals))} ${units[index]}`;}
export function generateRecordingFilename(mimeType='video/webm',date=new Date()):string{const pad=(n:number)=>String(n).padStart(2,'0');const ext=mimeType.toLowerCase().includes('mp4')?'mp4':'webm';return`screen-recording-${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.${ext}`;}
/** Accurate active duration from monotonic timestamps, excluding accumulated pause time. */
export function calculateElapsedRecordingSeconds(startMs:number,pausedDurationMs:number,nowMs:number):number{if(![startMs,pausedDurationMs,nowMs].every(Number.isFinite))return 0;return Math.max(0,(nowMs-startMs-Math.max(0,pausedDurationMs))/1000);}
export function stopAllMediaTracks(...streams:(MediaStream|null|undefined)[]):void{for(const stream of streams){for(const track of stream?.getTracks?.()||[]){try{track.stop();}catch{}}}}
