import React, { useState, useRef, useEffect } from 'react';
import {
  Film,
  Upload,
  Images,
  Video,
  Play,
  Pause,
  Download,
  Scissors,
  Sliders,
  Type,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  GifFrameInput,
  GifCaption,
  encodeGif,
} from '../../utilities/gif-maker';
import { formatVideoTime } from '../../utilities/video-toolkit';

interface ImageFrame {
  id: string;
  img: HTMLImageElement;
  delayMs: number;
}

export const GifMakerTool: React.FC = () => {
  const [sourceMode, setSourceMode] = useState<'video' | 'images'>('video');

  // Video Mode State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(3);

  // Images Mode State
  const [imageFrames, setImageFrames] = useState<ImageFrame[]>([]);
  const [globalFrameDelay, setGlobalFrameDelay] = useState<number>(200); // ms

  // Common Settings
  const [fps, setFps] = useState<number>(10);
  const [targetWidth, setTargetWidth] = useState<number>(400);
  const [captionText, setCaptionText] = useState<string>('');
  const [captionPos, setCaptionPos] = useState<'top' | 'bottom' | 'center'>('bottom');
  const [captionColor, setCaptionColor] = useState<string>('#FFFFFF');

  // Generation & Result State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [generatedGifUrl, setGeneratedGifUrl] = useState<string | null>(null);
  const [generatedGifSize, setGeneratedGifSize] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      if (generatedGifUrl) URL.revokeObjectURL(generatedGifUrl);
    };
  }, [videoSrc, generatedGifUrl]);

  // Load video
  const handleSelectVideo = (file: File) => {
    if (!file.type.startsWith('video/')) {
      setErrorMessage('Please select a valid video file.');
      return;
    }
    setErrorMessage(null);
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoSrc(url);
    setGeneratedGifUrl(null);
  };

  const handleVideoMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 5;
    setVideoDuration(dur);
    setTrimStart(0);
    setTrimEnd(Math.min(dur, 4)); // Default max 4s for GIF performance
  };

  // Load images
  const handleSelectImages = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    const loadedPromises = files.map((file) => {
      return new Promise<ImageFrame>((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          resolve({
            id: `frame-${Date.now()}-${Math.random()}`,
            img,
            delayMs: globalFrameDelay,
          });
        };
        img.src = url;
      });
    });

    Promise.all(loadedPromises).then((frames) => {
      setImageFrames((prev) => [...prev, ...frames]);
      setGeneratedGifUrl(null);
    });
  };

  // Draw text caption onto canvas frame
  const applyCaption = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!captionText.trim()) return;

    ctx.save();
    const fontSize = Math.max(14, Math.round(width * 0.06));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = captionColor;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.15));

    let y = height - 20;
    if (captionPos === 'top') y = fontSize + 15;
    if (captionPos === 'center') y = height / 2 + fontSize / 3;

    ctx.strokeText(captionText, width / 2, y);
    ctx.fillText(captionText, width / 2, y);
    ctx.restore();
  };

  // Generate GIF from Video
  const handleGenerateFromVideo = async () => {
    if (!videoRef.current || !videoFile) return;
    setIsGenerating(true);
    setProgress(0);
    setErrorMessage(null);

    try {
      const v = videoRef.current;
      v.pause();

      const origW = v.videoWidth || 640;
      const origH = v.videoHeight || 360;
      const aspect = origW / origH;
      const width = targetWidth;
      const height = Math.round(width / aspect);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas initialization failed.');

      const duration = trimEnd - trimStart;
      const totalFrames = Math.max(2, Math.floor(duration * fps));
      const frameInterval = duration / totalFrames;
      const frames: GifFrameInput[] = [];

      for (let i = 0; i < totalFrames; i++) {
        const time = trimStart + i * frameInterval;
        v.currentTime = time;

        await new Promise<void>((resolve) => {
          const onSeek = () => {
            v.removeEventListener('seeked', onSeek);
            resolve();
          };
          v.addEventListener('seeked', onSeek);
        });

        ctx.drawImage(v, 0, 0, width, height);
        applyCaption(ctx, width, height);

        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = width;
        frameCanvas.height = height;
        const fctx = frameCanvas.getContext('2d');
        if (fctx) fctx.drawImage(canvas, 0, 0);

        frames.push({
          canvas: frameCanvas,
          delayMs: Math.round(1000 / fps),
        });

        setProgress(Math.round(((i + 1) / totalFrames) * 50));
      }

      const gifBlob = encodeGif(frames, width, height, 0, (pct) => {
        setProgress(50 + Math.round(pct * 0.5));
      });

      const url = URL.createObjectURL(gifBlob);
      setGeneratedGifUrl(url);
      setGeneratedGifSize(gifBlob.size);
      setIsGenerating(false);
    } catch (err: unknown) {
      setIsGenerating(false);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate GIF.');
    }
  };

  // Generate GIF from Images
  const handleGenerateFromImages = () => {
    if (imageFrames.length === 0) return;
    setIsGenerating(true);
    setProgress(0);
    setErrorMessage(null);

    setTimeout(() => {
      try {
        const firstImg = imageFrames[0].img;
        const aspect = firstImg.naturalWidth / firstImg.naturalHeight;
        const width = targetWidth;
        const height = Math.round(width / aspect);

        const frames: GifFrameInput[] = [];

        for (let i = 0; i < imageFrames.length; i++) {
          const f = imageFrames[i];
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(f.img, 0, 0, width, height);
            applyCaption(ctx, width, height);
            frames.push({ canvas, delayMs: f.delayMs });
          }
        }

        const gifBlob = encodeGif(frames, width, height, 0, (pct) => {
          setProgress(pct);
        });

        const url = URL.createObjectURL(gifBlob);
        setGeneratedGifUrl(url);
        setGeneratedGifSize(gifBlob.size);
        setIsGenerating(false);
      } catch {
        setIsGenerating(false);
        setErrorMessage('Failed to generate GIF from image sequence.');
      }
    }, 50);
  };

  const handleReset = () => {
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    if (generatedGifUrl) URL.revokeObjectURL(generatedGifUrl);
    setVideoFile(null);
    setVideoSrc(null);
    setImageFrames([]);
    setGeneratedGifUrl(null);
    setGeneratedGifSize(null);
    setErrorMessage(null);
  };

  return (
    <ToolShell
      toolId="gif-maker"
      title="Animated GIF Maker"
      description="Convert video clips or multiple image sequences into smooth animated GIFs with custom FPS, size, and caption overlays."
      category="media"
      relatedToolIds={['video-toolkit', 'image-optimizer', 'image-collage']}
    >
      <div className="space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Source Mode Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-4">
          <button
            type="button"
            onClick={() => setSourceMode('video')}
            className={`pb-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              sourceMode === 'video'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Video to GIF</span>
          </button>

          <button
            type="button"
            onClick={() => setSourceMode('images')}
            className={`pb-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              sourceMode === 'images'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Images className="w-4 h-4" />
            <span>Images to GIF</span>
          </button>
        </div>

        {/* MODE 1: VIDEO TO GIF */}
        {sourceMode === 'video' && (
          <div className="space-y-4">
            {!videoSrc ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files[0]) handleSelectVideo(e.dataTransfer.files[0]);
                }}
                className="p-8 border-2 border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 text-center hover:border-blue-500 transition-colors bg-white dark:bg-neutral-900"
              >
                <Film className="w-8 h-8 mx-auto mb-2 text-rose-500" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                  Select Video to Convert into GIF
                </h3>
                <p className="text-xs text-neutral-500 mb-3">
                  Upload MP4, WebM, or MOV to create an animated GIF.
                </p>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs">
                  <Upload className="w-4 h-4" />
                  <span>Choose Video</span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => e.target.files?.[0] && handleSelectVideo(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Video Preview & Trim */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-neutral-800">
                    <video
                      ref={videoRef}
                      src={videoSrc}
                      controls
                      onLoadedMetadata={handleVideoMetadata}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {/* Trim Sliders */}
                  <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      <span className="flex items-center gap-1">
                        <Scissors className="w-3.5 h-3.5" />
                        <span>GIF Clip Range</span>
                      </span>
                      <span className="font-mono text-blue-600">
                        {formatVideoTime(trimStart)} → {formatVideoTime(trimEnd)} ({(trimEnd - trimStart).toFixed(1)}s)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-neutral-500 block mb-1">Start (sec)</label>
                        <input
                          type="number"
                          min={0}
                          max={trimEnd - 0.2}
                          step={0.1}
                          value={trimStart}
                          onChange={(e) => setTrimStart(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-2 py-1 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                        />
                      </div>
                      <div>
                        <label className="text-neutral-500 block mb-1">End (sec)</label>
                        <input
                          type="number"
                          min={trimStart + 0.2}
                          max={videoDuration}
                          step={0.1}
                          value={trimEnd}
                          onChange={(e) =>
                            setTrimEnd(Math.min(videoDuration, parseFloat(e.target.value) || 1))
                          }
                          className="w-full px-2 py-1 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* GIF Settings & Export */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      GIF Settings
                    </h4>

                    {/* Frame Rate FPS */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Frame Rate (FPS)
                      </label>
                      <div className="grid grid-cols-4 gap-1.5 text-xs">
                        {[6, 10, 15, 20].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => setFps(rate)}
                            className={`py-1.5 rounded border font-medium ${
                              fps === rate
                                ? 'bg-blue-600 text-white border-transparent'
                                : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                            }`}
                          >
                            {rate} FPS
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Width Preset */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        GIF Width
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 text-xs">
                        {[320, 400, 480].map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setTargetWidth(w)}
                            className={`py-1.5 rounded border font-medium ${
                              targetWidth === w
                                ? 'bg-blue-600 text-white border-transparent'
                                : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                            }`}
                          >
                            {w}px
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Caption Overlay */}
                    <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Type className="w-3.5 h-3.5" />
                        <span>Add Caption Overlay (Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={captionText}
                        onChange={(e) => setCaptionText(e.target.value)}
                        placeholder="Meme text or subtitle..."
                        className="w-full px-2.5 py-1.5 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                      />
                      <div className="grid grid-cols-3 gap-1 pt-1 text-xs">
                        {(['top', 'center', 'bottom'] as const).map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setCaptionPos(pos)}
                            className={`py-1 rounded border capitalize ${
                              captionPos === pos
                                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                                : 'bg-white dark:bg-neutral-800 text-neutral-600 border-neutral-200 dark:border-neutral-700'
                            }`}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Render Button */}
                  {isGenerating ? (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2 text-center">
                      <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
                        <span>Encoding GIF Frames...</span>
                        <span className="font-bold">{progress}%</span>
                      </div>
                      <div className="w-full bg-blue-200 dark:bg-blue-900 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full transition-all duration-150"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGenerateFromVideo}
                      className="w-full py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md inline-flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Encode & Generate GIF</span>
                    </button>
                  )}

                  {/* Exported Result */}
                  {generatedGifUrl && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
                      <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>GIF Created!</span>
                        </span>
                        {generatedGifSize && (
                          <span>{(generatedGifSize / 1024).toFixed(1)} KB</span>
                        )}
                      </div>

                      <div className="flex justify-center bg-black/10 dark:bg-black/40 p-2 rounded-lg">
                        <img src={generatedGifUrl} alt="Generated GIF" className="max-h-48 object-contain rounded" />
                      </div>

                      <a
                        href={generatedGifUrl}
                        download="animation.gif"
                        className="w-full py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-center shadow-2xs inline-flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download .GIF</span>
                      </a>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleReset}
                    className="w-full py-1 text-xs text-neutral-500 hover:underline"
                  >
                    Reset & Start Over
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE 2: IMAGES TO GIF */}
        {sourceMode === 'images' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length > 0) handleSelectImages(e.dataTransfer.files);
              }}
              className="p-6 border-2 border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 text-center hover:border-blue-500 transition-colors bg-white dark:bg-neutral-900"
            >
              <Images className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                Upload Sequence of Image Frames
              </h3>
              <p className="text-xs text-neutral-500 mb-3">
                Combine photos, drawings, or screenshots into an animated GIF loop.
              </p>
              <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs">
                <Plus className="w-4 h-4" />
                <span>Add Image Frames</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleSelectImages(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            {imageFrames.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Frames List */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {imageFrames.length} Frames in Animation Loop
                    </span>
                    <button
                      type="button"
                      onClick={() => setImageFrames([])}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Clear Frames
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto p-1">
                    {imageFrames.map((f, idx) => (
                      <div
                        key={f.id}
                        className="p-2 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 text-center space-y-1.5"
                      >
                        <div className="aspect-square bg-neutral-100 dark:bg-neutral-800 rounded overflow-hidden flex items-center justify-center">
                          <img src={f.img.src} alt="frame" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-neutral-500">
                          <span>Frame #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => setImageFrames((prev) => prev.filter((it) => it.id !== f.id))}
                            className="text-neutral-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Settings & Generate */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
                    <div className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">Frame Delay</span>
                        <span className="font-mono">{globalFrameDelay} ms</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={1000}
                        step={25}
                        value={globalFrameDelay}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setGlobalFrameDelay(val);
                          setImageFrames((prev) => prev.map((f) => ({ ...f, delayMs: val })));
                        }}
                        className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateFromImages}
                      disabled={isGenerating}
                      className="w-full py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md inline-flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isGenerating ? 'Generating...' : 'Build Animated GIF'}</span>
                    </button>
                  </div>

                  {/* Exported Result */}
                  {generatedGifUrl && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
                      <div className="flex justify-center bg-black/10 dark:bg-black/40 p-2 rounded-lg">
                        <img src={generatedGifUrl} alt="Generated GIF" className="max-h-48 object-contain rounded" />
                      </div>
                      <a
                        href={generatedGifUrl}
                        download="animation.gif"
                        className="w-full py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-center shadow-2xs inline-flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download GIF</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default GifMakerTool;
