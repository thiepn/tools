import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  RotateCcw,
  Download,
  Trash2,
  ShieldCheck,
  Circle,
  AlertCircle,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  getSupportedVideoMimeType,
  formatRecordingDuration,
  formatByteSize,
  generateRecordingFilename,
  stopAllMediaTracks,
  RecordingMeta,
} from '../../utilities/screen-recorder';

export const ScreenRecorderTool: React.FC = () => {
  const [includeMic, setIncludeMic] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [recordingMeta, setRecordingMeta] = useState<RecordingMeta | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // Critical Cleanup on Unmount or Route Change
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopAllMediaTracks(displayStreamRef.current, micStreamRef.current);
      if (recordingMeta?.url) URL.revokeObjectURL(recordingMeta.url);
    };
  }, [recordingMeta]);

  // Start Recording
  const handleStartRecording = async () => {
    setErrorMessage(null);
    chunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setErrorMessage('Screen recording is not supported in this browser environment.');
      return;
    }

    try {
      // 1. Request Display Stream
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: true, // system/tab audio if available
      });
      displayStreamRef.current = displayStream;

      // Handle user clicking "Stop sharing" in browser native bar
      displayStream.getVideoTracks()[0].onended = () => {
        handleStopRecording();
      };

      // 2. Request Optional Microphone Audio Stream
      let combinedTracks: MediaStreamTrack[] = [...displayStream.getTracks()];

      if (includeMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = micStream;
          combinedTracks.push(...micStream.getAudioTracks());
        } catch (micErr) {
          console.warn('Microphone permission denied or unavailable, continuing with screen video only:', micErr);
        }
      }

      const combinedStream = new MediaStream(combinedTracks);
      const mimeType = getSupportedVideoMimeType();

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(chunksRef.current, { type: mimeType });
        const videoUrl = URL.createObjectURL(fullBlob);

        setRecordingMeta({
          blob: fullBlob,
          url: videoUrl,
          durationSeconds: elapsedSeconds,
          mimeType,
          sizeBytes: fullBlob.size,
          recordedAt: new Date(),
        });

        setIsRecording(false);
        setIsPaused(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        // Teardown live streams
        stopAllMediaTracks(displayStreamRef.current, micStreamRef.current);
      };

      recorder.start(1000); // 1s slice chunks
      setIsRecording(true);
      setIsPaused(false);
      setElapsedSeconds(0);

      // Start elapsed timer
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Screen capture permission was cancelled or denied.');
      } else {
        setErrorMessage(err.message || 'Failed to capture screen.');
      }
      stopAllMediaTracks(displayStreamRef.current, micStreamRef.current);
      setIsRecording(false);
    }
  };

  const handlePauseResume = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    stopAllMediaTracks(displayStreamRef.current, micStreamRef.current);
  };

  const handleDiscard = () => {
    if (recordingMeta?.url) URL.revokeObjectURL(recordingMeta.url);
    setRecordingMeta(null);
    setElapsedSeconds(0);
    chunksRef.current = [];
  };

  const handleDownload = () => {
    if (!recordingMeta) return;
    const link = document.createElement('a');
    link.href = recordingMeta.url;
    link.download = generateRecordingFilename(recordingMeta.mimeType);
    link.click();
  };

  return (
    <ToolShell
      toolId="screen-recorder"
      title="Screen Recorder"
      description="Record your screen, browser tab, or app window with audio locally in your browser."
      category="media"
      relatedToolIds={['audio-recorder', 'image-annotator', 'timer-stopwatch']}
    >
      <div className="space-y-6">
        {/* Start / Recording Action Bar */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
          {!isRecording && !recordingMeta ? (
            /* Setup Controls */
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleStartRecording}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white shadow-2xs inline-flex items-center gap-2"
              >
                <Circle className="w-3.5 h-3.5 fill-current" />
                <span>Start Recording</span>
              </button>

              <button
                type="button"
                onClick={() => setIncludeMic(!includeMic)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border inline-flex items-center gap-1.5 transition-colors ${
                  includeMic
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                    : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700'
                }`}
              >
                {includeMic ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                <span>Microphone Audio: {includeMic ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          ) : isRecording ? (
            /* Live Recording Controls */
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-mono font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                <span>{isPaused ? 'PAUSED' : 'REC'}</span>
                <span>{formatRecordingDuration(elapsedSeconds)}</span>
              </div>

              <button
                type="button"
                onClick={handlePauseResume}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 inline-flex items-center gap-1.5"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                type="button"
                onClick={handleStopRecording}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop & Preview</span>
              </button>
            </div>
          ) : (
            /* Post-recording Actions */
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Video</span>
              </button>

              <button
                type="button"
                onClick={handleDiscard}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Record Again</span>
              </button>

              <button
                type="button"
                onClick={handleDiscard}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                title="Discard recording"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>100% In-Browser. No video is ever uploaded.</span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Stage / Video Preview */}
        {!recordingMeta ? (
          <div className="p-12 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {isRecording ? 'Recording in progress...' : 'Ready to Record Screen or Window'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                {isRecording
                  ? 'Your screen capture is actively encoding locally. Switch tabs or apps freely.'
                  : 'Click "Start Recording" above to select a screen, browser tab, or app window.'}
              </p>
            </div>
          </div>
        ) : (
          /* Video Review Player */
          <div className="space-y-4">
            <div className="p-3 bg-neutral-900 rounded-xl flex items-center justify-center overflow-hidden shadow-inner border border-neutral-800">
              <video
                src={recordingMeta.url}
                controls
                autoPlay
                className="max-h-[500px] w-full object-contain rounded shadow"
              />
            </div>

            <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Duration: {formatRecordingDuration(recordingMeta.durationSeconds)}
                </span>
                <span className="text-neutral-400">•</span>
                <span className="text-neutral-500">Size: {formatByteSize(recordingMeta.sizeBytes)}</span>
                <span className="text-neutral-400">•</span>
                <span className="text-neutral-500 font-mono text-[11px]">{recordingMeta.mimeType}</span>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline inline-flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save to Downloads</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default ScreenRecorderTool;
