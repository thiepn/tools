import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video,
  Upload,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Volume2,
  VolumeX,
  Scissors,
  Crop,
  Sliders,
  Download,
  RefreshCw,
  Clock,
  Gauge,
  Music,
  CheckCircle2,
  AlertCircle,
  Film,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  VideoMetadata,
  VideoResizeMode,
  VideoCropPreset,
  VideoPlaybackSpeed,
  calculateVideoOutputDimensions,
  calculateEffectiveDuration,
  formatVideoTime,
  formatVideoFileSize,
  getSupportedVideoExportMime,
} from '../../utilities/video-toolkit';

export const VideoToolkitTool: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  // Playback & Timeline State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Transformations & Trim settings
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [cropPreset, setCropPreset] = useState<VideoCropPreset>('free');
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  const [resizeMode, setResizeMode] = useState<VideoResizeMode>('original');
  const [customWidth, setCustomWidth] = useState<number>(1280);
  const [customHeight, setCustomHeight] = useState<number>(720);
  const [preserveAspect, setPreserveAspect] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<VideoPlaybackSpeed>(1);
  const [muteAudio, setMuteAudio] = useState(false);
  const [volume, setVolume] = useState(1);

  // Export State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportedSize, setExportedSize] = useState<number | null>(null);
  const [exportedAudioUrl, setExportedAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cancelProcessingRef = useRef(false);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      if (exportedUrl) URL.revokeObjectURL(exportedUrl);
      if (exportedAudioUrl) URL.revokeObjectURL(exportedAudioUrl);
    };
  }, [videoSrc, exportedUrl, exportedAudioUrl]);

  // Load video file
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('video/')) {
      setErrorMessage('Please select a valid video file (MP4, WebM, MOV, etc.)');
      return;
    }

    setErrorMessage(null);
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    if (exportedAudioUrl) URL.revokeObjectURL(exportedAudioUrl);

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoSrc(url);
    setExportedUrl(null);
    setExportedAudioUrl(null);
    setExportedSize(null);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setCropPreset('free');
    setCropRect({ x: 0, y: 0, width: 1, height: 1 });
    setPlaybackSpeed(1);
    setMuteAudio(false);
    setVolume(1);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current || !videoFile) return;
    const v = videoRef.current;
    const meta: VideoMetadata = {
      filename: videoFile.name,
      fileSize: videoFile.size,
      duration: v.duration || 0,
      width: v.videoWidth || 1280,
      height: v.videoHeight || 720,
      aspectRatio: v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9,
      mimeType: videoFile.type || 'video/mp4',
    };
    setMetadata(meta);
    setTrimStart(0);
    setTrimEnd(v.duration || 0);
    setCustomWidth(v.videoWidth || 1280);
    setCustomHeight(v.videoHeight || 720);
  };

  // Sync timeline during playback
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);
    if (t >= trimEnd) {
      videoRef.current.currentTime = trimStart;
      if (!videoRef.current.loop) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (videoRef.current.currentTime < trimStart || videoRef.current.currentTime >= trimEnd) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(metadata?.duration || 100, time));
    videoRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };

  // Rotate handlers
  const handleRotateLeft = () => {
    setRotation((prev) => ((prev - 90 + 360) % 360) as 0 | 90 | 180 | 270);
  };

  const handleRotateRight = () => {
    setRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  };

  // Crop Preset handler
  const handleCropPresetChange = (preset: VideoCropPreset) => {
    setCropPreset(preset);
    if (preset === 'free') {
      setCropRect({ x: 0, y: 0, width: 1, height: 1 });
      return;
    }
    const [rw, rh] = preset.split(':').map(Number);
    const targetAspect = rw / rh;
    const currentAspect = (metadata?.width || 1280) / (metadata?.height || 720);

    if (currentAspect > targetAspect) {
      // Current is wider than target crop
      const wFrac = targetAspect / currentAspect;
      setCropRect({ x: (1 - wFrac) / 2, y: 0, width: wFrac, height: 1 });
    } else {
      // Current is taller than target crop
      const hFrac = currentAspect / targetAspect;
      setCropRect({ x: 0, y: (1 - hFrac) / 2, width: 1, height: hFrac });
    }
  };

  // Calculate output dimensions preview
  const outDims = metadata
    ? calculateVideoOutputDimensions(metadata.width, metadata.height, {
        rotation,
        resizeMode,
        customWidth,
        customHeight,
        preserveAspectRatio: preserveAspect,
        cropRect,
      })
    : { width: 1280, height: 720 };

  const effectiveDuration = calculateEffectiveDuration(trimStart, trimEnd, playbackSpeed);

  // Render & Process Video locally using Canvas + MediaRecorder
  const handleProcessVideo = async () => {
    if (!videoRef.current || !metadata) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setErrorMessage(null);
    cancelProcessingRef.current = false;

    try {
      const v = videoRef.current;
      v.pause();
      setIsPlaying(false);

      const canvas = document.createElement('canvas');
      canvas.width = outDims.width;
      canvas.height = outDims.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas context initialization failed');

      // Setup audio processing via Web Audio API if audio is not muted
      let audioDest: MediaStreamAudioDestinationNode | null = null;
      let audioCtx: AudioContext | null = null;
      let audioTrack: MediaStreamTrack | null = null;

      if (!muteAudio) {
        try {
          audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const source = audioCtx.createMediaElementSource(v);
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = volume;
          audioDest = audioCtx.createMediaStreamDestination();
          source.connect(gainNode);
          gainNode.connect(audioDest);
          gainNode.connect(audioCtx.destination);
          audioTrack = audioDest.stream.getAudioTracks()[0] || null;
        } catch {
          // Cross-origin or already connected audio fallback
        }
      }

      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioTrack ? [audioTrack] : []),
      ]);

      const mimeType = getSupportedVideoExportMime();
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 4_000_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.start(100);

      // Seek to trimStart
      v.playbackRate = playbackSpeed;
      v.currentTime = trimStart;

      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          v.removeEventListener('seeked', onSeeked);
          resolve();
        };
        v.addEventListener('seeked', onSeeked);
      });

      await v.play();

      const renderInterval = setInterval(() => {
        if (cancelProcessingRef.current) {
          clearInterval(renderInterval);
          recorder.stop();
          v.pause();
          setIsProcessing(false);
          return;
        }

        const currentT = v.currentTime;
        const processedSecs = Math.max(0, currentT - trimStart);
        const totalSecs = Math.max(0.1, trimEnd - trimStart);
        const pct = Math.min(99, Math.round((processedSecs / totalSecs) * 100));
        setProcessingProgress(pct);

        if (currentT >= trimEnd || v.ended) {
          clearInterval(renderInterval);
          v.pause();
          recorder.stop();
          return;
        }

        // Draw frame onto canvas with transformations
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

        const cropX = cropRect.x * metadata.width;
        const cropY = cropRect.y * metadata.height;
        const cropW = cropRect.width * metadata.width;
        const cropH = cropRect.height * metadata.height;

        const isRotated90 = rotation === 90 || rotation === 270;
        const drawW = isRotated90 ? canvas.height : canvas.width;
        const drawH = isRotated90 ? canvas.width : canvas.height;

        ctx.drawImage(v, cropX, cropY, cropW, cropH, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }, 1000 / 30);

      recorder.onstop = () => {
        clearInterval(renderInterval);
        const finalBlob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(finalBlob);
        setExportedUrl(url);
        setExportedSize(finalBlob.size);
        setProcessingProgress(100);
        setIsProcessing(false);

        if (audioCtx) {
          audioCtx.close().catch(() => {});
        }
      };
    } catch (err: unknown) {
      setIsProcessing(false);
      setErrorMessage(err instanceof Error ? err.message : 'Error processing video locally.');
    }
  };

  const handleExtractAudio = async () => {
    if (!videoRef.current || !videoFile) return;
    setIsProcessing(true);
    setProcessingProgress(10);
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuf = await videoFile.arrayBuffer();
      setProcessingProgress(40);
      const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
      setProcessingProgress(70);

      // Render WAV blob locally
      const numOfChan = audioBuf.numberOfChannels;
      const length = Math.floor((trimEnd - trimStart) * audioBuf.sampleRate * numOfChan * 2) + 44;
      const out = new DataView(new ArrayBuffer(length));
      let offset = 0;

      const writeString = (s: string) => {
        for (let i = 0; i < s.length; i++) {
          out.setUint8(offset++, s.charCodeAt(i));
        }
      };

      writeString('RIFF');
      out.setUint32(offset, length - 8, true);
      offset += 4;
      writeString('WAVE');
      writeString('fmt ');
      out.setUint32(offset, 16, true);
      offset += 4;
      out.setUint16(offset, 1, true); // PCM
      offset += 2;
      out.setUint16(offset, numOfChan, true);
      offset += 2;
      out.setUint32(offset, audioBuf.sampleRate, true);
      offset += 4;
      out.setUint32(offset, audioBuf.sampleRate * numOfChan * 2, true);
      offset += 4;
      out.setUint16(offset, numOfChan * 2, true);
      offset += 2;
      out.setUint16(offset, 16, true);
      offset += 2;
      writeString('data');
      out.setUint32(offset, length - offset - 4, true);
      offset += 4;

      const startSample = Math.floor(trimStart * audioBuf.sampleRate);
      const endSample = Math.min(audioBuf.length, Math.floor(trimEnd * audioBuf.sampleRate));

      const channels: Float32Array[] = [];
      for (let i = 0; i < numOfChan; i++) {
        channels.push(audioBuf.getChannelData(i));
      }

      for (let s = startSample; s < endSample; s++) {
        for (let c = 0; c < numOfChan; c++) {
          const sample = Math.max(-1, Math.min(1, channels[c][s] || 0));
          out.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
          offset += 2;
        }
      }

      const wavBlob = new Blob([out.buffer], { type: 'audio/wav' });
      const wavUrl = URL.createObjectURL(wavBlob);
      setExportedAudioUrl(wavUrl);
      setProcessingProgress(100);
      setIsProcessing(false);
      audioCtx.close().catch(() => {});
    } catch {
      setIsProcessing(false);
      setErrorMessage('Audio extraction failed or audio track not found.');
    }
  };

  const handleReset = () => {
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    if (exportedAudioUrl) URL.revokeObjectURL(exportedAudioUrl);
    setVideoFile(null);
    setVideoSrc(null);
    setMetadata(null);
    setExportedUrl(null);
    setExportedAudioUrl(null);
    setExportedSize(null);
    setErrorMessage(null);
  };

  return (
    <ToolShell
      toolId="video-toolkit"
      title="Video Toolkit"
      description="Trim, crop, resize, rotate, adjust speed, and mute videos entirely in your browser with zero remote servers."
      category="media"
      relatedToolIds={['gif-maker', 'audio-recorder', 'screen-recorder']}
    >
      <div className="space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {!videoSrc ? (
          /* File Upload Drop Zone */
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
            }}
            className="p-8 sm:p-12 border-2 border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 text-center hover:border-blue-500 transition-colors bg-white dark:bg-neutral-900"
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
              Select or Drop a Video File
            </h3>
            <p className="text-xs text-neutral-500 mb-4 max-w-sm mx-auto">
              Supports MP4, WebM, MOV, and browser-supported codecs. 100% processed locally on your device.
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs">
              <Film className="w-4 h-4" />
              <span>Browse Video</span>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Video Preview & Timeline Player */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-neutral-800">
                <video
                  ref={videoRef}
                  src={videoSrc}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="max-h-full max-w-full object-contain"
                  style={{
                    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                    transition: 'transform 0.15s ease',
                  }}
                />

                {/* Visible Crop Overlay Outline if not 100% */}
                {cropPreset !== 'free' && (
                  <div
                    className="absolute border-2 border-dashed border-blue-400 pointer-events-none"
                    style={{
                      left: `${cropRect.x * 100}%`,
                      top: `${cropRect.y * 100}%`,
                      width: `${cropRect.width * 100}%`,
                      height: `${cropRect.height * 100}%`,
                    }}
                  />
                )}
              </div>

              {/* Player Timeline & Controls */}
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                      {formatVideoTime(currentTime, true)} / {formatVideoTime(metadata?.duration || 0, true)}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-500 flex items-center gap-3">
                    <span>Speed: {playbackSpeed}x</span>
                    <span>•</span>
                    <span>Result: ~{effectiveDuration}s</span>
                  </div>
                </div>

                {/* Scrubber */}
                <input
                  type="range"
                  min={0}
                  max={metadata?.duration || 100}
                  step={0.05}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />

                {/* Trim Sliders */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    <span className="flex items-center gap-1">
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Trim Video Range</span>
                    </span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      {formatVideoTime(trimStart)} → {formatVideoTime(trimEnd)} ({calculateEffectiveDuration(trimStart, trimEnd, 1)}s)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">Start Time (sec)</label>
                      <input
                        type="number"
                        min={0}
                        max={trimEnd - 0.1}
                        step={0.1}
                        value={trimStart}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(trimEnd - 0.1, parseFloat(e.target.value) || 0));
                          setTrimStart(val);
                          handleSeek(val);
                        }}
                        className="w-full px-2.5 py-1 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">End Time (sec)</label>
                      <input
                        type="number"
                        min={trimStart + 0.1}
                        max={metadata?.duration || 100}
                        step={0.1}
                        value={trimEnd}
                        onChange={(e) => {
                          const val = Math.max(trimStart + 0.1, Math.min(metadata?.duration || 100, parseFloat(e.target.value) || 0));
                          setTrimEnd(val);
                          handleSeek(val);
                        }}
                        className="w-full px-2.5 py-1 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Source Video Metadata badge */}
              {metadata && (
                <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs flex flex-wrap items-center justify-between gap-2 text-neutral-600 dark:text-neutral-400">
                  <span>File: <strong>{metadata.filename}</strong></span>
                  <span>Size: <strong>{formatVideoFileSize(metadata.fileSize)}</strong></span>
                  <span>Dimensions: <strong>{metadata.width} × {metadata.height}</strong></span>
                  <span>Format: <strong>{metadata.mimeType}</strong></span>
                </div>
              )}
            </div>

            {/* Right: Controls & Adjustments */}
            <div className="lg:col-span-5 space-y-4">
              {/* Transformations Panel */}
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Transform & Layout
                </h4>

                {/* Rotate & Flip */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRotateLeft}
                    className="flex-1 px-2.5 py-1.5 text-xs font-medium border rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border-neutral-300 dark:border-neutral-700 flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>-90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRotateRight}
                    className="flex-1 px-2.5 py-1.5 text-xs font-medium border rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border-neutral-300 dark:border-neutral-700 flex items-center justify-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>+90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipH(!flipH)}
                    className={`px-2.5 py-1.5 text-xs font-medium border rounded-md ${
                      flipH ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-600' : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipV(!flipV)}
                    className={`px-2.5 py-1.5 text-xs font-medium border rounded-md ${
                      flipV ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-600' : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    <FlipVertical className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Crop Presets */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <Crop className="w-3.5 h-3.5" />
                    <span>Aspect Ratio Crop</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    {(['free', '1:1', '4:3', '3:2', '16:9', '9:16'] as VideoCropPreset[]).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleCropPresetChange(preset)}
                        className={`py-1 rounded border capitalize font-medium ${
                          cropPreset === preset
                            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-transparent'
                            : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        {preset === 'free' ? 'Original' : preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resize Resolution */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Output Resolution</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    {(['original', '720p', '1080p', '75%', '50%', 'custom'] as VideoResizeMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setResizeMode(mode)}
                        className={`py-1 rounded border capitalize font-medium ${
                          resizeMode === mode
                            ? 'bg-blue-600 text-white border-transparent'
                            : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  {resizeMode === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 pt-1.5">
                      <input
                        type="number"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(parseInt(e.target.value) || 640)}
                        placeholder="Width"
                        className="px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                      />
                      <input
                        type="number"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(parseInt(e.target.value) || 480)}
                        placeholder="Height"
                        className="px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                      />
                    </div>
                  )}

                  <div className="text-[11px] text-neutral-500 pt-0.5">
                    Target Output: <strong>{outDims.width} × {outDims.height} px</strong>
                  </div>
                </div>

                {/* Playback Speed */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5" />
                    <span>Export Speed</span>
                  </label>
                  <div className="grid grid-cols-6 gap-1 text-xs font-mono">
                    {([0.5, 0.75, 1, 1.25, 1.5, 2] as VideoPlaybackSpeed[]).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => {
                          setPlaybackSpeed(spd);
                          if (videoRef.current) videoRef.current.playbackRate = spd;
                        }}
                        className={`py-1 rounded border font-medium ${
                          playbackSpeed === spd
                            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                            : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audio Controls */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                      {muteAudio ? <VolumeX className="w-3.5 h-3.5 text-neutral-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span>Audio Settings</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setMuteAudio(!muteAudio)}
                      className={`text-xs font-semibold ${muteAudio ? 'text-red-500' : 'text-blue-600'}`}
                    >
                      {muteAudio ? 'Muted' : 'Keep Audio'}
                    </button>
                  </div>

                  {!muteAudio && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-neutral-500">Volume</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <span className="text-[11px] font-mono w-8 text-right text-neutral-600 dark:text-neutral-400">
                        {Math.round(volume * 100)}%
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleExtractAudio}
                    disabled={isProcessing}
                    className="w-full py-1.5 text-xs font-medium border rounded bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-center gap-1.5"
                  >
                    <Music className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Extract Audio Track (.WAV)</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {isProcessing ? (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2 text-center">
                    <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
                      <span>Processing Video in Browser...</span>
                      <span className="font-bold">{processingProgress}%</span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-900 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-150"
                        style={{ width: `${processingProgress}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        cancelProcessingRef.current = true;
                      }}
                      className="text-xs text-red-500 hover:underline pt-1"
                    >
                      Cancel Processing
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleProcessVideo}
                    className="w-full py-2.5 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md inline-flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Export Processed Video</span>
                  </button>
                )}

                {/* Exported Result Download */}
                {exportedUrl && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
                    <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Ready for Download</span>
                      </span>
                      {exportedSize && <span>{formatVideoFileSize(exportedSize)}</span>}
                    </div>

                    <a
                      href={exportedUrl}
                      download={`processed-${metadata?.filename || 'video.webm'}`}
                      className="w-full py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-center shadow-xs inline-flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Video</span>
                    </a>
                  </div>
                )}

                {exportedAudioUrl && (
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Extracted Audio (.WAV)
                    </span>
                    <a
                      href={exportedAudioUrl}
                      download="extracted-audio.wav"
                      className="w-full py-1.5 text-xs font-semibold rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-center inline-flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Audio</span>
                    </a>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                >
                  Process Another Video
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default VideoToolkitTool;
