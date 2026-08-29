import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Upload,
  Download,
  RotateCcw,
  Volume2,
  Scissors,
  ShieldCheck,
  Circle,
  Sparkles,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  decodeAudioBlob,
  extractWaveformPeaks,
  trimAudioBuffer,
  audioBufferToWavBlob,
  TrimRange,
  AudioEditOptions,
} from '../../utilities/audio-recorder';
import { formatRecordingDuration } from '../../utilities/screen-recorder';

export const AudioRecorderTool: React.FC = () => {
  const [mode, setMode] = useState<'record' | 'upload'>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [recordElapsed, setRecordElapsed] = useState(0);

  const [rawAudioBuffer, setRawAudioBuffer] = useState<AudioBuffer | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);

  const [trimRange, setTrimRange] = useState<TrimRange>({ startSeconds: 0, endSeconds: 0 });
  const [editOptions, setEditOptions] = useState<AudioEditOptions>({
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    gain: 1.0,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  const [exportedWavBlob, setExportedWavBlob] = useState<Blob | null>(null);
  const [exportedWavUrl, setExportedWavUrl] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);

  const activeSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackAnimRef = useRef<number | null>(null);
  const playStartTimeRef = useRef<number>(0);
  const playStartOffsetRef = useRef<number>(0);

  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lazy initialize AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current);
      if (activeSourceNodeRef.current) {
        try {
          activeSourceNodeRef.current.stop();
        } catch {}
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
      }
      if (exportedWavUrl) URL.revokeObjectURL(exportedWavUrl);
    };
  }, [exportedWavUrl]);

  // Load sample synth audio
  const handleLoadSampleAudio = () => {
    const ctx = getAudioContext();
    const sampleRate = ctx.sampleRate;
    const duration = 6; // 6 seconds
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate melodic chime chord arpeggio
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const freq1 = 261.63 + Math.sin(t * 2) * 50; // C4
      const freq2 = 329.63; // E4
      const freq3 = 392.0; // G4
      const envelope = Math.exp(-((t % 1.5) * 2));
      data[i] = (Math.sin(2 * Math.PI * freq1 * t) + 0.5 * Math.sin(2 * Math.PI * freq2 * t) + 0.3 * Math.sin(2 * Math.PI * freq3 * t)) * envelope * 0.3;
    }

    setRawAudioBuffer(buffer);
    setWaveformPeaks(extractWaveformPeaks(buffer, 240));
    setTrimRange({ startSeconds: 0, endSeconds: buffer.duration });
    setPlaybackTime(0);
    setExportedWavBlob(null);
  };

  // Start Mic Recording
  const handleStartRecord = async () => {
    recordedChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const fullBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const ctx = getAudioContext();
        try {
          const decoded = await decodeAudioBlob(fullBlob, ctx);
          setRawAudioBuffer(decoded);
          setWaveformPeaks(extractWaveformPeaks(decoded, 240));
          setTrimRange({ startSeconds: 0, endSeconds: decoded.duration });
          setPlaybackTime(0);
          setExportedWavBlob(null);
        } catch (decErr) {
          console.error('Failed to decode recorded audio:', decErr);
        }

        // Stop mic tracks
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
        }
      };

      recorder.start(500);
      setIsRecording(true);
      setRecordElapsed(0);

      recordIntervalRef.current = window.setInterval(() => {
        setRecordElapsed((p) => p + 1);
      }, 1000);
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  };

  const handleStopRecord = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    const ctx = getAudioContext();
    try {
      const decoded = await decodeAudioBlob(file, ctx);
      setRawAudioBuffer(decoded);
      setWaveformPeaks(extractWaveformPeaks(decoded, 240));
      setTrimRange({ startSeconds: 0, endSeconds: decoded.duration });
      setPlaybackTime(0);
      setExportedWavBlob(null);
    } catch (err) {
      console.error('Failed to decode audio file:', err);
    }
  };

  // Play / Pause preview of trimmed region
  const handleTogglePlay = () => {
    if (!rawAudioBuffer) return;
    const ctx = getAudioContext();

    if (isPlaying) {
      if (activeSourceNodeRef.current) {
        try {
          activeSourceNodeRef.current.stop();
        } catch {}
      }
      setIsPlaying(false);
      if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current);
    } else {
      // Build trimmed temporary buffer
      const trimmed = trimAudioBuffer(rawAudioBuffer, ctx, trimRange, editOptions);
      const source = ctx.createBufferSource();
      source.buffer = trimmed;
      source.connect(ctx.destination);

      source.onended = () => {
        setIsPlaying(false);
        setPlaybackTime(trimRange.endSeconds);
        if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current);
      };

      source.start();
      activeSourceNodeRef.current = source;
      setIsPlaying(true);
      playStartTimeRef.current = ctx.currentTime;
      playStartOffsetRef.current = trimRange.startSeconds;

      const updateProgress = () => {
        const elapsed = ctx.currentTime - playStartTimeRef.current;
        const currentPos = playStartOffsetRef.current + elapsed;
        if (currentPos <= trimRange.endSeconds) {
          setPlaybackTime(currentPos);
          playbackAnimRef.current = requestAnimationFrame(updateProgress);
        } else {
          setPlaybackTime(trimRange.endSeconds);
          setIsPlaying(false);
        }
      };
      playbackAnimRef.current = requestAnimationFrame(updateProgress);
    }
  };

  // Render Waveform Canvas
  useEffect(() => {
    if (!waveformCanvasRef.current || !rawAudioBuffer || waveformPeaks.length === 0) return;
    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 700);
    const height = (canvas.height = 140);

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const totalDuration = rawAudioBuffer.duration;
    const startX = (trimRange.startSeconds / totalDuration) * width;
    const endX = (trimRange.endSeconds / totalDuration) * width;

    // Dim regions outside trim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, startX, height);
    ctx.fillRect(endX, 0, width - endX, height);

    // Active trim region highlight
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.fillRect(startX, 0, Math.max(1, endX - startX), height);

    // Draw waveform bars
    const barWidth = width / waveformPeaks.length;
    waveformPeaks.forEach((peak, i) => {
      const x = i * barWidth;
      const barH = Math.max(2, peak * (height - 20));
      const y = (height - barH) / 2;

      if (x >= startX && x <= endX) {
        ctx.fillStyle = '#3B82F6';
      } else {
        ctx.fillStyle = '#475569';
      }
      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barH);
    });

    // Draw Start Handle (Green Line)
    ctx.fillStyle = '#10B981';
    ctx.fillRect(startX - 2, 0, 4, height);

    // Draw End Handle (Red Line)
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(endX - 2, 0, 4, height);

    // Draw Playhead (White Line)
    if (playbackTime >= 0) {
      const playheadX = (playbackTime / totalDuration) * width;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(playheadX - 1, 0, 2, height);
    }
  }, [rawAudioBuffer, waveformPeaks, trimRange, playbackTime]);

  // Export Trimmed WAV
  const handleExportWav = () => {
    if (!rawAudioBuffer) return;
    const ctx = getAudioContext();
    const trimmed = trimAudioBuffer(rawAudioBuffer, ctx, trimRange, editOptions);
    const wavBlob = audioBufferToWavBlob(trimmed);
    const wavUrl = URL.createObjectURL(wavBlob);

    setExportedWavBlob(wavBlob);
    setExportedWavUrl(wavUrl);

    const link = document.createElement('a');
    link.href = wavUrl;
    link.download = `trimmed-audio-${new Date().toISOString().slice(0, 10)}.wav`;
    link.click();
  };

  const totalDuration = rawAudioBuffer?.duration || 0;
  const selectedDuration = Math.max(0, trimRange.endSeconds - trimRange.startSeconds);

  return (
    <ToolShell
      toolId="audio-recorder"
      title="Audio Recorder & Trimmer"
      description="Record or upload audio, trim waveforms visually, adjust gain and fade effects, and export standard WAV files locally."
      category="media"
      relatedToolIds={['screen-recorder', 'text-to-speech', 'timer-stopwatch']}
    >
      <div className="space-y-6">
        {/* Mode Selector & Action Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-medium p-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => setMode('record')}
                className={`px-3 py-1 rounded ${
                  mode === 'record' ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold' : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Record Microphone
              </button>
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`px-3 py-1 rounded ${
                  mode === 'upload' ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold' : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Upload Audio File
              </button>
            </div>

            {!rawAudioBuffer && (
              <button
                type="button"
                onClick={handleLoadSampleAudio}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Load Sample Chime</span>
              </button>
            )}

            {rawAudioBuffer && (
              <button
                type="button"
                onClick={() => {
                  setRawAudioBuffer(null);
                  setExportedWavBlob(null);
                  setIsPlaying(false);
                }}
                className="px-2.5 py-1 text-xs font-medium rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {rawAudioBuffer && (
              <button
                type="button"
                onClick={handleExportWav}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Trimmed WAV</span>
              </button>
            )}
          </div>
        </div>

        {/* Input Views: Record / Upload */}
        {!rawAudioBuffer && mode === 'record' && (
          <div className="p-10 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
              <Mic className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {isRecording ? 'Microphone is Recording...' : 'Ready to Record Audio'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                {isRecording ? 'Capturing browser audio locally' : 'Click "Start Recording" to capture audio'}
              </p>
            </div>

            {isRecording ? (
              <div className="space-y-3">
                <div className="text-lg font-mono font-bold text-red-600 dark:text-red-400">
                  {formatRecordingDuration(recordElapsed)}
                </div>
                <button
                  type="button"
                  onClick={handleStopRecord}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-2xs inline-flex items-center gap-2"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop & Edit Waveform</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartRecord}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white shadow-2xs inline-flex items-center gap-2"
              >
                <Circle className="w-3.5 h-3.5 fill-current" />
                <span>Start Recording</span>
              </button>
            )}
          </div>
        )}

        {!rawAudioBuffer && mode === 'upload' && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className="p-12 border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 text-center cursor-pointer transition-colors space-y-3"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Drop Audio File to Trim & Edit
              </p>
              <p className="text-xs text-neutral-500 mt-1">Supports MP3, WAV, WebM, OGG, and M4A</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
                e.target.value = '';
              }}
            />
          </div>
        )}

        {/* Audio Editor & Waveform Canvas */}
        {rawAudioBuffer && (
          <div className="space-y-6">
            {/* Waveform View */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Visual Timeline (Original: {totalDuration.toFixed(2)}s | Selected: {selectedDuration.toFixed(2)}s)
                </span>
                <span className="font-mono text-[11px]">
                  {trimRange.startSeconds.toFixed(2)}s → {trimRange.endSeconds.toFixed(2)}s
                </span>
              </div>

              <div className="w-full bg-neutral-950 rounded-xl p-2 border border-neutral-800 shadow-inner">
                <canvas ref={waveformCanvasRef} className="w-full h-[140px] rounded" />
              </div>
            </div>

            {/* Playback Controls & Trim Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
              {/* Left: Trim Knobs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Trim Region
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlaying ? 'Pause' : 'Play Selection'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                      <span>Start Trim: {trimRange.startSeconds.toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, trimRange.endSeconds - 0.1)}
                      step="0.05"
                      value={trimRange.startSeconds}
                      onChange={(e) =>
                        setTrimRange({ ...trimRange, startSeconds: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                      <span>End Trim: {trimRange.endSeconds.toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min={trimRange.startSeconds + 0.1}
                      max={totalDuration}
                      step="0.05"
                      value={trimRange.endSeconds}
                      onChange={(e) =>
                        setTrimRange({ ...trimRange, endSeconds: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Right: Fade & Gain Controls */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Audio Enhancements
                </span>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                      <span>Fade In: {editOptions.fadeInSeconds.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3.0"
                      step="0.1"
                      value={editOptions.fadeInSeconds}
                      onChange={(e) =>
                        setEditOptions({ ...editOptions, fadeInSeconds: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                      <span>Fade Out: {editOptions.fadeOutSeconds.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3.0"
                      step="0.1"
                      value={editOptions.fadeOutSeconds}
                      onChange={(e) =>
                        setEditOptions({ ...editOptions, fadeOutSeconds: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                      <span>Volume Gain: {Math.round(editOptions.gain * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.0"
                      step="0.1"
                      value={editOptions.gain}
                      onChange={(e) =>
                        setEditOptions({ ...editOptions, gain: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default AudioRecorderTool;
