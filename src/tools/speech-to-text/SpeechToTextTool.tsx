import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Upload,
  Pause,
  Play,
  Square,
  Download,
  Copy,
  Check,
  FileText,
  Clock,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Volume2,
  AlertCircle,
  Cpu,
  Zap,
  CheckCircle2,
  Loader2,
  ArrowRight,
  HardDriveDownload,
  Info,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  TranscriptSegment,
  SpeechModelOption,
  AVAILABLE_SPEECH_MODELS,
  SUPPORTED_LANGUAGES,
  WorkerInboundMessage,
  WorkerOutboundMessage,
  ModelProgressPayload,
  formatSpeechTimestamp,
  formatTranscriptToText,
} from '../../utilities/speech-to-text';
import { decodeAudioFileTo16kMono, resampleAudioBufferTo16kMono } from '../../utilities/speech-audio';
import { copyToClipboard } from '../../utilities/clipboard';
import { setPendingTransfer } from '../../storage/transfer';

export const SpeechToTextTool: React.FC = () => {
  // Model Configuration State
  const [selectedModelId, setSelectedModelId] = useState<string>('whisper-tiny-en');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [modelState, setModelState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [modelProgress, setModelProgress] = useState<ModelProgressPayload | null>(null);
  const [activeDevice, setActiveDevice] = useState<'webgpu' | 'wasm' | 'cpu'>('wasm');

  // Input & Audio State
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [preparedAudio, setPreparedAudio] = useState<Float32Array | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  // Transcription State
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcribeProgress, setTranscribeProgress] = useState<number>(0);
  const [elapsedTimeSec, setElapsedTimeSec] = useState<number>(0);
  const [processingStats, setProcessingStats] = useState<{ time: number; device: string } | null>(null);
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [showTimestamps, setShowTimestamps] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for audio and worker
  const workerRef = useRef<Worker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const processingTimerRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const activeModel = AVAILABLE_SPEECH_MODELS.find((m) => m.id === selectedModelId) || AVAILABLE_SPEECH_MODELS[0];

  // Initialize Web Worker
  const initWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e: MessageEvent<WorkerOutboundMessage>) => {
      const msg = e.data;
      if (!msg) return;

      switch (msg.type) {
        case 'MODEL_PROGRESS':
          setModelState('loading');
          setModelProgress(msg.data);
          break;

        case 'MODEL_LOADED':
          setModelState('ready');
          setModelProgress(null);
          setActiveDevice(msg.device);
          break;

        case 'TRANSCRIBE_PROGRESS':
          setTranscribeProgress(msg.progress);
          break;

        case 'TRANSCRIBE_RESULT':
          setIsTranscribing(false);
          setTranscribeProgress(100);
          setTranscriptText(msg.text);
          setSegments(msg.segments);
          setProcessingStats({
            time: msg.processingTimeSec,
            device: msg.deviceUsed,
          });
          if (processingTimerRef.current) {
            clearInterval(processingTimerRef.current);
            processingTimerRef.current = null;
          }
          break;

        case 'ERROR':
          setIsTranscribing(false);
          if (msg.stage === 'loading') {
            setModelState('error');
          }
          setErrorMessage(msg.error || 'Speech recognition failed.');
          if (processingTimerRef.current) {
            clearInterval(processingTimerRef.current);
            processingTimerRef.current = null;
          }
          break;
      }
    };

    worker.onerror = (err) => {
      setModelState('error');
      setIsTranscribing(false);
      setErrorMessage(`Worker error: ${err.message || 'Unknown Web Worker error'}`);
    };

    workerRef.current = worker;
    return worker;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioSrc) URL.revokeObjectURL(audioSrc);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (processingTimerRef.current) clearInterval(processingTimerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [audioSrc]);

  // Explicitly Load or Pre-warm the local model
  const handleLoadModel = (modelId = selectedModelId) => {
    setErrorMessage(null);
    setModelState('loading');
    const worker = initWorker();
    worker.postMessage({
      type: 'LOAD_MODEL',
      modelId,
    } as WorkerInboundMessage);
  };

  // Change model
  const handleModelChange = (newModelId: string) => {
    setSelectedModelId(newModelId);
    setModelState('idle');
    setModelProgress(null);
  };

  // Audio File Upload
  const handleAudioUpload = async (file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|webm|flac|aac|wma)$/i)) {
      setErrorMessage('Please select a valid audio file (WAV, MP3, WebM, OGG, M4A, AAC, FLAC).');
      return;
    }
    setErrorMessage(null);
    if (audioSrc) URL.revokeObjectURL(audioSrc);

    const url = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioSrc(url);
    setTranscriptText('');
    setSegments([]);
    setProcessingStats(null);

    try {
      const decoded = await decodeAudioFileTo16kMono(file);
      setPreparedAudio(decoded.audioData);
      setAudioDuration(decoded.duration);
    } catch {
      setErrorMessage('Failed to decode this audio file. Please ensure it is an uncorrupted standard audio format.');
    }
  };

  // Start microphone recording
  const handleStartRecording = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioSrc(url);
        setAudioFile(new File([audioBlob], 'mic-recording.webm', { type: 'audio/webm' }));

        try {
          const decoded = await decodeAudioFileTo16kMono(audioBlob);
          setPreparedAudio(decoded.audioData);
          setAudioDuration(decoded.duration);
        } catch {
          setErrorMessage('Could not process recorded microphone audio buffer.');
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      setTranscriptText('');
      setSegments([]);
      setProcessingStats(null);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setErrorMessage('Microphone access was denied or is unavailable on this device.');
      setIsRecording(false);
    }
  };

  const handlePauseResumeRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  // Run local transcription
  const handleTranscribe = async () => {
    if (!preparedAudio) {
      setErrorMessage('Please upload an audio file or record from microphone first.');
      return;
    }

    setErrorMessage(null);
    setIsTranscribing(true);
    setTranscribeProgress(10);
    setElapsedTimeSec(0);

    const startTimer = performance.now();
    processingTimerRef.current = window.setInterval(() => {
      setElapsedTimeSec(Number(((performance.now() - startTimer) / 1000).toFixed(1)));
    }, 200);

    const worker = initWorker();

    worker.postMessage({
      type: 'TRANSCRIBE',
      audio: preparedAudio,
      modelId: selectedModelId,
      language: activeModel.multilingual ? selectedLanguage : 'en',
      returnTimestamps: true,
    } as WorkerInboundMessage);
  };

  const handleCopy = async () => {
    const formatted = formatTranscriptToText(segments, showTimestamps) || transcriptText;
    if (!formatted) return;

    const ok = await copyToClipboard(formatted);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const formatted = formatTranscriptToText(segments, showTimestamps) || transcriptText;
    if (!formatted) return;

    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcript-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (audioSrc) URL.revokeObjectURL(audioSrc);
    setAudioFile(null);
    setAudioSrc(null);
    setPreparedAudio(null);
    setAudioDuration(0);
    setTranscriptText('');
    setSegments([]);
    setProcessingStats(null);
    setErrorMessage(null);
  };

  const handleSendToTool = (targetToolId: string) => {
    const formatted = formatTranscriptToText(segments, false) || transcriptText;
    if (!formatted) return;
    setPendingTransfer(targetToolId, formatted);
    window.location.hash = `#/tool/${targetToolId}`;
  };

  return (
    <ToolShell
      toolId="speech-to-text"
      title="Speech to Text Transcriber"
      description="Transcribe live speech and audio files locally in your browser using client-side Whisper. Audio is never sent to any server."
      category="productivity"
      relatedToolIds={['audio-recorder', 'text-to-speech', 'notepad', 'text-cleaner', 'word-counter']}
      outputToTransfer={transcriptText}
    >
      <div className="space-y-6">
        {/* Privacy Assurance Banner */}
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>100% On-Device Transcription.</strong> Audio never leaves your computer or phone.
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] bg-emerald-100/70 dark:bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-200">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Mode: WebGPU / WASM Local AI</span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Local Model Selector & Download Manager */}
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Local Speech Model
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                Runs completely on your device via browser WebAssembly & WebGPU.
              </p>
            </div>

            {modelState === 'ready' && (
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>Model Loaded ({activeDevice.toUpperCase()})</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {AVAILABLE_SPEECH_MODELS.map((model) => {
              const isSelected = selectedModelId === model.id;
              return (
                <div
                  key={model.id}
                  onClick={() => !isRecording && !isTranscribing && handleModelChange(model.id)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                      : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  } ${isRecording || isTranscribing ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {model.name}
                    </span>
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {model.sizeLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-tight">
                    {model.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Model Loading Status & Action */}
          {modelState !== 'ready' && (
            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-1 max-w-md">
                <div className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-200">
                  <HardDriveDownload className="w-4 h-4 text-blue-600" />
                  <span>
                    {modelState === 'loading'
                      ? `Downloading ${activeModel.name}... (${modelProgress?.progress ? Math.round(modelProgress.progress) : 0}%)`
                      : `Download model asset (~${activeModel.approxDownloadMB} MB) once and cache locally in browser.`}
                  </span>
                </div>
                {modelState === 'loading' && (
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-200"
                      style={{ width: `${Math.max(5, modelProgress?.progress || 0)}%` }}
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleLoadModel(selectedModelId)}
                disabled={modelState === 'loading'}
                className="px-3.5 py-1.5 rounded-md font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {modelState === 'loading' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading Model...</span>
                  </>
                ) : (
                  <>
                    <HardDriveDownload className="w-3.5 h-3.5" />
                    <span>Load {activeModel.name}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Language selector (active for multilingual models) */}
          {activeModel.multilingual && (
            <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Spoken Language:
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={isRecording || isTranscribing}
                className="px-2.5 py-1 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-medium"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Audio Input Options (Microphone & File Upload) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Microphone Box */}
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Mic className="w-4 h-4 text-red-500" />
                <span>Microphone Record</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Record speech directly in-browser. Permissions requested only on click.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="font-mono text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {formatSpeechTimestamp(recordingSeconds)}
              </div>

              {!isRecording ? (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  disabled={isTranscribing}
                  className="px-4 py-2 rounded-full font-bold text-xs bg-red-600 hover:bg-red-700 text-white shadow-md inline-flex items-center gap-2 transition-all hover:scale-105"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Recording</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePauseResumeRecording}
                    className="p-2.5 rounded-full bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200"
                    title={isPaused ? 'Resume Recording' : 'Pause Recording'}
                  >
                    {isPaused ? <Play className="w-4 h-4 text-emerald-600" /> : <Pause className="w-4 h-4 text-amber-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="px-4 py-2 rounded-full font-bold text-xs bg-neutral-900 hover:bg-black text-white dark:bg-neutral-100 dark:text-neutral-900 shadow inline-flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop & Use Audio</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* File Upload Box */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) handleAudioUpload(e.dataTransfer.files[0]);
            }}
            className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs flex flex-col justify-between space-y-4"
          >
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-500" />
                <span>Upload Audio File</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Supports WAV, MP3, WebM, OGG, M4A, AAC, FLAC formats.
              </p>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center text-center space-y-2">
              <Upload className="w-6 h-6 text-neutral-400" />
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Drag and drop audio file here
              </span>
              <label className="px-3 py-1.5 text-xs font-medium border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 cursor-pointer hover:bg-neutral-100">
                <span>Browse File</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Audio Player & Trigger Transcribe Bar */}
        {audioSrc && (
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <audio src={audioSrc} controls className="h-9 w-full max-w-md" />
              {audioDuration > 0 && (
                <span className="text-xs font-mono text-neutral-500 shrink-0">
                  Length: {formatSpeechTimestamp(audioDuration)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                disabled={isTranscribing}
                className="px-3 py-1.5 text-xs font-medium border rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Transcribing locally ({elapsedTimeSec}s)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Transcribe Audio (Local Whisper)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Transcription Status / Progress Details */}
        {isTranscribing && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 space-y-2 text-xs">
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Running client-side ONNX speech inference...</span>
              </span>
              <span className="font-mono">{elapsedTimeSec}s elapsed</span>
            </div>
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              Inference is computed in a background Web Worker. Your browser UI remains responsive.
            </p>
          </div>
        )}

        {/* Processing Performance Badge */}
        {processingStats && (
          <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400 font-mono">
            <span>
              ⚡ Completed in <strong>{processingStats.time}s</strong> for {formatSpeechTimestamp(audioDuration)} audio
            </span>
            <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold uppercase">
              Engine: {processingStats.device}
            </span>
          </div>
        )}

        {/* Transcript Output Box */}
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Transcript Result</span>
            </h3>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTimestamps(!showTimestamps)}
                className={`px-2.5 py-1 text-xs font-medium border rounded-md transition-colors ${
                  showTimestamps
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <Clock className="w-3 h-3 inline mr-1" />
                <span>Timestamps</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                disabled={!transcriptText}
                className="px-3 py-1 text-xs font-medium border rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={!transcriptText}
                className="px-3 py-1 text-xs font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download TXT</span>
              </button>
            </div>
          </div>

          {/* Editable Transcript Area */}
          <textarea
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder="Transcript will appear here once audio is transcribed locally..."
            rows={8}
            className="w-full p-3 text-sm border rounded-lg bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans resize-y"
          />

          {/* Segment breakdown if timestamps enabled */}
          {showTimestamps && segments.length > 0 && (
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-1.5 max-h-56 overflow-y-auto">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                Timecoded Phrases
              </span>
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="text-xs p-2 rounded bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-start gap-2"
                >
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                    [{formatSpeechTimestamp(seg.start)} - {formatSpeechTimestamp(seg.end)}]
                  </span>
                  <span className="text-neutral-800 dark:text-neutral-200 flex-1">{seg.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chaining Navigation Ribbon */}
        {transcriptText && (
          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              Send Transcript To:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'notepad', label: 'Quick Notepad' },
                { id: 'text-cleaner', label: 'Text Cleaner' },
                { id: 'word-counter', label: 'Word Counter' },
                { id: 'text-to-speech', label: 'Text to Speech' },
              ].map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => handleSendToTool(tool.id)}
                  className="px-2.5 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-medium shadow-2xs inline-flex items-center gap-1"
                >
                  <span>{tool.label}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default SpeechToTextTool;
