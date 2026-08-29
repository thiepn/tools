import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize,
  Minimize,
  Sliders,
  FlipHorizontal,
  Eye,
  Type,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  TeleprompterConfig,
  DEFAULT_TELEPROMPTER_CONFIG,
  calculateSpeakingStats,
  calculateScrollStep,
} from '../../utilities/teleprompter';

const SAMPLE_SCRIPT = `Welcome to today's product demonstration.

Today, we are thrilled to introduce Tiny Tools: a suite of fast, lightweight, and privacy-first utilities engineered to run entirely inside your web browser.

Unlike traditional cloud services, every calculation, file conversion, and audio stream is processed locally on your device. No analytics, no remote servers, and zero data leakage.

Let's explore the key features that make this platform both powerful and easy to use.`;

export const TeleprompterTool: React.FC = () => {
  const [script, setScript] = useState(SAMPLE_SCRIPT);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [config, setConfig] = useState<TeleprompterConfig>(DEFAULT_TELEPROMPTER_CONFIG);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prompterContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const stats = calculateSpeakingStats(script);

  // Smooth Auto-Scrolling Loop
  const scrollLoop = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const step = calculateScrollStep(config.speed);

    container.scrollTop += step;

    // Check if reached bottom
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
      setIsPlaying(false);
      return;
    }

    animFrameRef.current = requestAnimationFrame(scrollLoop);
  }, [config.speed]);

  useEffect(() => {
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(scrollLoop);
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, scrollLoop]);

  // Keyboard Shortcuts (Space, Up/Down, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += 50;
        }
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop -= 50;
        }
      } else if (e.code === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleRestart = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const toggleFullscreen = () => {
    if (!prompterContainerRef.current) return;
    if (!document.fullscreenElement) {
      prompterContainerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings & Script Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Script Editor Column */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Prompter Script
            </label>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>{stats.wordCount} words</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                ~{stats.formattedDuration}
              </span>
            </div>
          </div>

          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={10}
            placeholder="Paste your speech, script, or presentation notes here..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 font-sans leading-relaxed focus:ring-2 focus:ring-indigo-500"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setScript(SAMPLE_SCRIPT)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Sample Script
            </button>
            <button
              onClick={() => setScript('')}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Configuration Column */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5" />
              <span>Prompter Display Options</span>
            </div>

            {/* Speed & Font Size */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Scroll Speed</span>
                  <span>{config.speed}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  value={config.speed}
                  onChange={(e) => setConfig((c) => ({ ...c, speed: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Text Size</span>
                  <span>{config.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="24"
                  max="72"
                  value={config.fontSize}
                  onChange={(e) => setConfig((c) => ({ ...c, fontSize: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400">Size Presets:</span>
              <div className="flex gap-1.5">
                {[
                  { label: 'S', size: 28 },
                  { label: 'M', size: 40 },
                  { label: 'L', size: 52 },
                  { label: 'XL', size: 64 },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setConfig((c) => ({ ...c, fontSize: p.size }))}
                    className={`px-2.5 py-1 text-xs font-medium rounded ${
                      config.fontSize === p.size
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mirror Mode & Focus Guide */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isMirrored}
                  onChange={(e) => setConfig((c) => ({ ...c, isMirrored: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <FlipHorizontal className="w-3.5 h-3.5" />
                Mirror Mode (Glass Rig)
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showFocusGuide}
                  onChange={(e) => setConfig((c) => ({ ...c, showFocusGuide: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <Eye className="w-3.5 h-3.5" />
                Reading Focus Line
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Prompter Active Stage */}
      <div
        ref={prompterContainerRef}
        className="relative rounded-2xl overflow-hidden shadow-lg border border-slate-800 bg-black flex flex-col h-[480px]"
      >
        {/* Floating Controls Overlay */}
        <div className="absolute top-4 inset-x-4 z-20 flex justify-between items-center bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700/60 shadow-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'Pause' : 'Start'}
            </button>

            <button
              onClick={handleRestart}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Restart from top"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400 hidden sm:inline">
              Speed: {config.speed} • Space to Pause
            </span>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Focus Guide Center Line */}
        {config.showFocusGuide && (
          <div className="absolute top-1/2 inset-x-0 -translate-y-1/2 h-16 border-y border-amber-400/30 bg-amber-400/5 pointer-events-none z-10" />
        )}

        {/* Scrolling Script Canvas */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-8 py-44 select-none scroll-smooth"
          style={{
            transform: config.isMirrored ? 'scaleX(-1)' : 'none',
          }}
        >
          <div
            className="mx-auto text-white leading-relaxed font-semibold transition-all"
            style={{
              maxWidth: `${config.marginWidthPercent}%`,
              fontSize: `${config.fontSize}px`,
              lineHeight: config.lineHeight,
              textAlign: config.textAlign,
            }}
          >
            {script.split('\n\n').map((para, i) => (
              <p key={i} className="mb-8">
                {para}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeleprompterTool;
