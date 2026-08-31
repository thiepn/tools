import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Film, FlipHorizontal, FlipVertical, Gauge, Music, Pause, Play, RotateCcw, RotateCw, Scissors, Sliders, Upload, Volume2, VolumeX, X } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  calculateEffectiveDuration,
  calculateRecommendedVideoBitrate,
  calculateVideoOutputDimensions,
  chooseVideoRenderFps,
  formatVideoFileSize,
  formatVideoTime,
  getSupportedVideoExportMime,
  normalizeVideoTrimRange,
  type VideoCropPreset,
  type VideoMetadata,
  type VideoPlaybackSpeed,
  type VideoQualityPreset,
  type VideoResizeMode,
} from '../../utilities/video-toolkit';

type ExtendedVideoElement = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
  requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const QUALITY_LABELS: Record<VideoQualityPreset, string> = {
  compact: 'Compact · 24 fps',
  balanced: 'Balanced · 30 fps',
  high: 'High · up to 60 fps',
};

function waitForSeek(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.max(0, time);
  if (Math.abs(video.currentTime - target) < 0.015) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('Timed out while seeking the source video.')); }, 6000);
    const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', onSeeked); video.removeEventListener('error', onError); };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('The source video could not seek to the requested trim point.')); };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = target;
  });
}

function trimAudioBufferToWav(buffer: AudioBuffer, startSeconds: number, endSeconds: number): Blob {
  const start = Math.max(0, Math.min(buffer.length, Math.floor(startSeconds * buffer.sampleRate)));
  const end = Math.max(start, Math.min(buffer.length, Math.ceil(endSeconds * buffer.sampleRate)));
  const samples = end - start;
  const channels = Math.max(1, buffer.numberOfChannels);
  const bytesPerSample = 2;
  const dataSize = samples * channels * bytesPerSample;
  const array = new ArrayBuffer(44 + dataSize);
  const view = new DataView(array);
  const write = (offset: number, value: string) => { for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true); view.setUint16(32, channels * bytesPerSample, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, dataSize, true);
  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let sampleIndex = start; sampleIndex < end; sampleIndex++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][sampleIndex] || 0));
      view.setInt16(offset, Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), true);
      offset += 2;
    }
  }
  return new Blob([array], { type: 'audio/wav' });
}

export const VideoToolkitTool: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [cropPreset, setCropPreset] = useState<VideoCropPreset>('free');
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const [resizeMode, setResizeMode] = useState<VideoResizeMode>('original');
  const [customWidth, setCustomWidth] = useState(1280);
  const [customHeight, setCustomHeight] = useState(720);
  const [preserveAspect, setPreserveAspect] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<VideoPlaybackSpeed>(1);
  const [muteAudio, setMuteAudio] = useState(false);
  const [volume, setVolume] = useState(1);
  const [quality, setQuality] = useState<VideoQualityPreset>('balanced');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportedSize, setExportedSize] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSize, setAudioSize] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<ExtendedVideoElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const exportedUrlRef = useRef<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const cancelRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const activeStreamsRef = useRef<MediaStream[]>([]);
  const frameHandleRef = useRef<number | null>(null);
  const frameModeRef = useRef<'video' | 'animation' | null>(null);

  const revoke = (ref: React.MutableRefObject<string | null>) => { if (ref.current) URL.revokeObjectURL(ref.current); ref.current = null; };
  const stopActiveStreams = useCallback(() => {
    for (const stream of activeStreamsRef.current) for (const track of stream.getTracks()) { try { track.stop(); } catch {} }
    activeStreamsRef.current = [];
  }, []);

  useEffect(() => () => {
    cancelRef.current = true;
    if (recorderRef.current?.state !== 'inactive') try { recorderRef.current?.stop(); } catch {}
    stopActiveStreams();
    revoke(sourceUrlRef); revoke(exportedUrlRef); revoke(audioUrlRef);
  }, [stopActiveStreams]);

  const loadVideo = (file: File) => {
    if (!file.type.startsWith('video/')) { setError('Select a browser-decodable video file.'); return; }
    cancelRef.current = true;
    revoke(sourceUrlRef); revoke(exportedUrlRef); revoke(audioUrlRef);
    const url = URL.createObjectURL(file); sourceUrlRef.current = url;
    setVideoFile(file); setVideoSrc(url); setMetadata(null); setExportedUrl(null); setExportedSize(null); setAudioUrl(null); setAudioSize(null);
    setRotation(0); setFlipH(false); setFlipV(false); setCropPreset('free'); setCropRect({ x: 0, y: 0, width: 1, height: 1 }); setResizeMode('original'); setPlaybackSpeed(1); setMuteAudio(false); setVolume(1); setError(null); setMessage(null); setProgress(0);
  };

  const onLoadedMetadata = () => {
    const video = videoRef.current; if (!video || !videoFile) return;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    setMetadata({ filename: videoFile.name, fileSize: videoFile.size, duration, width: video.videoWidth || 1280, height: video.videoHeight || 720, aspectRatio: video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9, mimeType: videoFile.type || 'video/mp4' });
    setTrimStart(0); setTrimEnd(duration); setCustomWidth(video.videoWidth || 1280); setCustomHeight(video.videoHeight || 720);
  };

  const normalizedTrim = useMemo(() => normalizeVideoTrimRange(trimStart, trimEnd, metadata?.duration || 0), [metadata?.duration, trimEnd, trimStart]);
  const outputDimensions = useMemo(() => metadata ? calculateVideoOutputDimensions(metadata.width, metadata.height, { rotation, resizeMode, customWidth, customHeight, preserveAspectRatio: preserveAspect, cropRect }) : { width: 1280, height: 720 }, [cropRect, customHeight, customWidth, metadata, preserveAspect, resizeMode, rotation]);
  const renderFps = chooseVideoRenderFps(null, quality);
  const bitrate = calculateRecommendedVideoBitrate(outputDimensions.width, outputDimensions.height, renderFps, quality);
  const outputDuration = calculateEffectiveDuration(normalizedTrim.start, normalizedTrim.end, playbackSpeed);

  const changeCropPreset = (preset: VideoCropPreset) => {
    setCropPreset(preset);
    if (preset === 'free' || !metadata) { setCropRect({ x: 0, y: 0, width: 1, height: 1 }); return; }
    const [ratioWidth, ratioHeight] = preset.split(':').map(Number), targetAspect = ratioWidth / ratioHeight, currentAspect = metadata.width / metadata.height;
    if (currentAspect > targetAspect) { const width = targetAspect / currentAspect; setCropRect({ x: (1 - width) / 2, y: 0, width, height: 1 }); }
    else { const height = currentAspect / targetAspect; setCropRect({ x: 0, y: (1 - height) / 2, width: 1, height }); }
  };

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
    if (!metadata) return;
    ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180); ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    const sx = cropRect.x * metadata.width, sy = cropRect.y * metadata.height, sw = cropRect.width * metadata.width, sh = cropRect.height * metadata.height;
    const rotated = rotation === 90 || rotation === 270, drawWidth = rotated ? canvas.height : canvas.width, drawHeight = rotated ? canvas.width : canvas.height;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(video, sx, sy, sw, sh, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight); ctx.restore();
  }, [cropRect, flipH, flipV, metadata, rotation]);

  const cancelScheduledFrame = useCallback(() => {
    const video = videoRef.current;
    if (frameHandleRef.current === null) return;
    if (frameModeRef.current === 'video' && video?.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameHandleRef.current);
    else if (frameModeRef.current === 'animation') cancelAnimationFrame(frameHandleRef.current);
    frameHandleRef.current = null; frameModeRef.current = null;
  }, []);

  const cancelProcessing = useCallback((reason?: string) => {
    cancelRef.current = true; cancelScheduledFrame(); videoRef.current?.pause();
    const recorder = recorderRef.current; if (recorder && recorder.state !== 'inactive') try { recorder.stop(); } catch {}
    if (reason) setError(reason);
  }, [cancelScheduledFrame]);

  const processVideo = async () => {
    const video = videoRef.current;
    if (!video || !metadata || !videoFile || isProcessing) return;
    if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') { setError('This browser cannot encode transformed video with MediaRecorder/canvas capture.'); return; }
    if (normalizedTrim.duration <= 0) { setError('Choose a non-empty trim range.'); return; }

    cancelRef.current = false; setIsProcessing(true); setProgress(0); setError(null); setMessage(null);
    revoke(exportedUrlRef); setExportedUrl(null); setExportedSize(null);
    const originalPlaybackRate = video.playbackRate, originalVolume = video.volume;
    let visibilityHandler: (() => void) | null = null;
    let recorder: MediaRecorder | null = null;
    let completedNormally = false;

    try {
      video.pause(); video.playbackRate = playbackSpeed; video.volume = Math.max(0, Math.min(1, volume));
      await waitForSeek(video, normalizedTrim.start);
      const canvas = document.createElement('canvas'); canvas.width = outputDimensions.width; canvas.height = outputDimensions.height;
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }); if (!ctx) throw new Error('Canvas rendering is unavailable.');
      drawFrame(ctx, canvas, video);
      const canvasStream = canvas.captureStream(renderFps);
      activeStreamsRef.current = [canvasStream];

      const outputTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
      let sourceCapture: MediaStream | null = null;
      if (!muteAudio) {
        const capture = video.captureStream || video.mozCaptureStream;
        if (typeof capture === 'function') {
          try {
            sourceCapture = capture.call(video);
            activeStreamsRef.current.push(sourceCapture);
            const audioTrack = sourceCapture.getAudioTracks()[0];
            if (audioTrack) outputTracks.push(audioTrack.clone());
            else setMessage('This browser did not expose the source audio track; the transformed video will be silent.');
          } catch { setMessage('Source audio capture is unavailable in this browser; the transformed video will be silent.'); }
        } else setMessage('Source audio capture is unavailable in this browser; the transformed video will be silent.');
      }
      const outputStream = new MediaStream(outputTracks); activeStreamsRef.current.push(outputStream);
      const mimeType = getSupportedVideoExportMime();
      recorder = new MediaRecorder(outputStream, { mimeType, videoBitsPerSecond: bitrate }); recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      const stopped = new Promise<Blob>((resolve, reject) => {
        recorder!.onerror = () => reject(new Error('The browser video encoder reported an error.'));
        recorder!.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      visibilityHandler = () => { if (document.hidden && !cancelRef.current) cancelProcessing('Video export was cancelled because the tab became hidden. Keep this tab visible during real-time browser encoding.'); };
      document.addEventListener('visibilitychange', visibilityHandler);
      recorder.start(250);
      await video.play();

      await new Promise<void>((resolve, reject) => {
        const tick = () => {
          if (cancelRef.current) { resolve(); return; }
          try {
            drawFrame(ctx, canvas, video);
            const sourceElapsed = Math.max(0, video.currentTime - normalizedTrim.start);
            setProgress(Math.min(99, Math.round((sourceElapsed / Math.max(0.001, normalizedTrim.duration)) * 100)));
            if (video.currentTime >= normalizedTrim.end - 0.008 || video.ended) { completedNormally = true; video.pause(); if (recorder?.state !== 'inactive') recorder?.stop(); resolve(); return; }
            if (video.requestVideoFrameCallback) { frameModeRef.current = 'video'; frameHandleRef.current = video.requestVideoFrameCallback(() => tick()); }
            else { frameModeRef.current = 'animation'; frameHandleRef.current = requestAnimationFrame(() => tick()); }
          } catch (cause) { reject(cause); }
        };
        if (video.requestVideoFrameCallback) { frameModeRef.current = 'video'; frameHandleRef.current = video.requestVideoFrameCallback(() => tick()); }
        else { frameModeRef.current = 'animation'; frameHandleRef.current = requestAnimationFrame(() => tick()); }
      });

      cancelScheduledFrame();
      if (recorder.state !== 'inactive') recorder.stop();
      const blob = await stopped;
      if (!cancelRef.current && completedNormally && blob.size > 0) {
        const url = URL.createObjectURL(blob); exportedUrlRef.current = url; setExportedUrl(url); setExportedSize(blob.size); setProgress(100); setMessage((current) => current || `Export completed at ${renderFps} fps · ${(bitrate / 1_000_000).toFixed(1)} Mbps.`);
      } else if (!cancelRef.current && blob.size === 0) throw new Error('The browser produced an empty recording.');
    } catch (cause) {
      if (!cancelRef.current) setError(cause instanceof Error ? cause.message : 'Video processing failed.');
    } finally {
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      cancelScheduledFrame(); video.pause(); video.playbackRate = originalPlaybackRate; video.volume = originalVolume;
      if (recorder?.state !== 'inactive') try { recorder?.stop(); } catch {}
      recorderRef.current = null; stopActiveStreams(); setIsProcessing(false);
    }
  };

  const extractAudio = async () => {
    if (!videoFile || !metadata || isProcessing) return;
    setError(null); setMessage(null); setIsProcessing(true); setProgress(10); revoke(audioUrlRef); setAudioUrl(null); setAudioSize(null);
    let audioContext: AudioContext | null = null;
    try {
      audioContext = new AudioContext(); const bytes = await videoFile.arrayBuffer(); setProgress(35);
      const decoded = await audioContext.decodeAudioData(bytes.slice(0)); setProgress(70);
      const blob = trimAudioBufferToWav(decoded, normalizedTrim.start, normalizedTrim.end); if (!blob.size) throw new Error('No decodable audio samples were found in this trim range.');
      const url = URL.createObjectURL(blob); audioUrlRef.current = url; setAudioUrl(url); setAudioSize(blob.size); setProgress(100); setMessage('Extracted the selected source-audio range as lossless PCM WAV. Playback-speed changes are not applied to WAV extraction.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Audio extraction failed.'); }
    finally { await audioContext?.close().catch(() => {}); setIsProcessing(false); }
  };

  const downloadBlobUrl = (url: string, filename: string) => { const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); };
  const extension = exportedUrl && getSupportedVideoExportMime().includes('mp4') ? 'mp4' : 'webm';

  return <ToolShell toolId="video-toolkit" title="Video Toolkit & Editor" description="Trim, crop, rotate, resize, change playback speed, mute, export transformed video, or extract WAV audio locally in your browser." category="media" relatedToolIds={['gif-maker', 'audio-recorder', 'screen-recorder']}>
    <div className="space-y-5">
      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {message && <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>}

      {!videoSrc ? <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) loadVideo(file); }} className="rounded-xl border-2 border-dashed border-neutral-300 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-900"><Film className="mx-auto h-9 w-9 text-blue-600" /><h3 className="mt-3 text-sm font-semibold">Select a video</h3><p className="mt-1 text-xs text-neutral-500">Browser-decodable MP4, WebM, MOV and similar formats. Processing remains local.</p><label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"><Upload className="h-4 w-4" />Choose video<input type="file" accept="video/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) loadVideo(file); event.target.value = ''; }} /></label></div> : <>
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-neutral-800 bg-black"><video ref={videoRef} src={videoSrc} controls playsInline onLoadedMetadata={onLoadedMetadata} className="mx-auto max-h-[520px] w-full object-contain" /></div>
            {metadata && <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 sm:grid-cols-4"><span>{metadata.width}×{metadata.height}</span><span>{formatVideoTime(metadata.duration)}</span><span>{formatVideoFileSize(metadata.fileSize)}</span><span>{metadata.mimeType || 'video'}</span></div>}
            {isProcessing && <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30"><div className="flex justify-between text-xs"><span>Encoding in real time — keep this tab visible</span><span className="font-mono">{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900"><div className="h-full bg-blue-600" style={{ width: `${progress}%` }} /></div><button onClick={() => cancelProcessing('Video export cancelled.')} className="inline-flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-[11px]"><X className="h-3 w-3" />Cancel export</button></div>}
          </div>

          <div className="space-y-4 lg:col-span-5">
            <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900"><h3 className="flex items-center gap-1.5 font-bold"><Scissors className="h-4 w-4" />Trim</h3><div className="grid grid-cols-2 gap-2"><label>Start seconds<input type="number" min="0" max={metadata?.duration || 0} step="0.05" value={trimStart} onChange={(event) => setTrimStart(Number(event.target.value))} className="mt-1 w-full rounded border px-2 py-2 dark:bg-neutral-950" /></label><label>End seconds<input type="number" min="0" max={metadata?.duration || 0} step="0.05" value={trimEnd} onChange={(event) => setTrimEnd(Number(event.target.value))} className="mt-1 w-full rounded border px-2 py-2 dark:bg-neutral-950" /></label></div><div className="text-neutral-500">Source {normalizedTrim.duration.toFixed(2)}s → output ~{outputDuration.toFixed(2)}s at {playbackSpeed}×.</div></section>

            <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900"><h3 className="flex items-center gap-1.5 font-bold"><Sliders className="h-4 w-4" />Transform</h3><div className="flex flex-wrap gap-2"><button onClick={() => setRotation((((rotation - 90) + 360) % 360) as 0 | 90 | 180 | 270)} className="rounded border p-2"><RotateCcw className="h-4 w-4" /></button><button onClick={() => setRotation(((rotation + 90) % 360) as 0 | 90 | 180 | 270)} className="rounded border p-2"><RotateCw className="h-4 w-4" /></button><button onClick={() => setFlipH((value) => !value)} className={`rounded border p-2 ${flipH ? 'bg-blue-50 text-blue-700 dark:bg-blue-950' : ''}`}><FlipHorizontal className="h-4 w-4" /></button><button onClick={() => setFlipV((value) => !value)} className={`rounded border p-2 ${flipV ? 'bg-blue-50 text-blue-700 dark:bg-blue-950' : ''}`}><FlipVertical className="h-4 w-4" /></button></div><label>Crop<select value={cropPreset} onChange={(event) => changeCropPreset(event.target.value as VideoCropPreset)} className="mt-1 w-full rounded border bg-white px-2 py-2 dark:bg-neutral-950"><option value="free">Original frame</option><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="3:2">3:2</option><option value="16:9">16:9</option><option value="9:16">9:16</option></select></label><label>Resize<select value={resizeMode} onChange={(event) => setResizeMode(event.target.value as VideoResizeMode)} className="mt-1 w-full rounded border bg-white px-2 py-2 dark:bg-neutral-950"><option value="original">Original/crop resolution</option><option value="720p">Max 720p</option><option value="1080p">Max 1080p</option><option value="75%">75%</option><option value="50%">50%</option><option value="custom">Custom</option></select></label>{resizeMode === 'custom' && <div className="grid grid-cols-2 gap-2"><input type="number" min="2" value={customWidth} onChange={(event) => setCustomWidth(Math.max(2, Number(event.target.value) || 2))} className="rounded border px-2 py-2 dark:bg-neutral-950" /><input type="number" min="2" value={customHeight} disabled={preserveAspect} onChange={(event) => setCustomHeight(Math.max(2, Number(event.target.value) || 2))} className="rounded border px-2 py-2 disabled:opacity-50 dark:bg-neutral-950" /><label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={preserveAspect} onChange={(event) => setPreserveAspect(event.target.checked)} />Preserve aspect ratio</label></div>}<div className="font-mono text-neutral-500">Output: {outputDimensions.width}×{outputDimensions.height}</div></section>

            <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900"><h3 className="flex items-center gap-1.5 font-bold"><Gauge className="h-4 w-4" />Playback & quality</h3><label>Speed<select value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value) as VideoPlaybackSpeed)} className="mt-1 w-full rounded border bg-white px-2 py-2 dark:bg-neutral-950">{[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}</select></label><label>Export quality<select value={quality} onChange={(event) => setQuality(event.target.value as VideoQualityPreset)} className="mt-1 w-full rounded border bg-white px-2 py-2 dark:bg-neutral-950">{(Object.keys(QUALITY_LABELS) as VideoQualityPreset[]).map((key) => <option key={key} value={key}>{QUALITY_LABELS[key]}</option>)}</select></label><div className="text-neutral-500">Plan: {renderFps} fps · {(bitrate / 1_000_000).toFixed(1)} Mbps. Browser codecs still determine final quality/size.</div><label className="flex items-center gap-2"><input type="checkbox" checked={muteAudio} onChange={(event) => setMuteAudio(event.target.checked)} />{muteAudio ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}Mute transformed video</label>{!muteAudio && <label>Source volume {Math.round(volume * 100)}%<input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-full" /></label>}</section>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950"><div className="flex flex-wrap gap-2"><button onClick={() => void processVideo()} disabled={!metadata || isProcessing} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"><Film className="h-4 w-4" />Export transformed video</button><button onClick={() => void extractAudio()} disabled={!metadata || isProcessing} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900"><Music className="h-4 w-4" />Extract WAV</button></div><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"><Upload className="h-4 w-4" />Replace source<input type="file" accept="video/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) loadVideo(file); event.target.value = ''; }} /></label></div>

        {(exportedUrl || audioUrl) && <div className="grid gap-4 md:grid-cols-2">{exportedUrl && <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20"><div className="flex justify-between text-xs font-semibold"><span>Transformed video</span><span>{exportedSize ? formatVideoFileSize(exportedSize) : ''}</span></div><video src={exportedUrl} controls className="w-full rounded-lg bg-black" /><button onClick={() => downloadBlobUrl(exportedUrl, `tiny-tools-video-${Date.now()}.${extension}`)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Download className="h-4 w-4" />Download video</button></div>}{audioUrl && <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/20"><div className="flex justify-between text-xs font-semibold"><span>Extracted WAV</span><span>{audioSize ? formatVideoFileSize(audioSize) : ''}</span></div><audio src={audioUrl} controls className="w-full" /><button onClick={() => downloadBlobUrl(audioUrl, `tiny-tools-audio-${Date.now()}.wav`)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white"><Download className="h-4 w-4" />Download WAV</button></div>}</div>}
      </>}
      <p className="text-[11px] text-neutral-500">Transformed video export is browser-native real-time encoding, not FFmpeg. The tool now synchronizes drawing to decoded video frames when available and aborts if the tab is hidden rather than silently producing a degraded export.</p>
    </div>
  </ToolShell>;
};

export default VideoToolkitTool;
