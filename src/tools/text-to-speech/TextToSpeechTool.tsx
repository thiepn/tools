import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  Languages,
  ShieldCheck,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  getAvailableVoices,
  chunkTextForSpeech,
  estimateSpeechDuration,
  formatDurationSeconds,
  SpeechVoiceOption,
} from '../../utilities/text-to-speech';
import { copyToClipboard } from '../../utilities/clipboard';
import { getPendingTransfer, clearPendingTransfer, setPendingTransfer } from '../../storage/transfer';

export const TextToSpeechTool: React.FC = () => {
  const [text, setText] = useState<string>('');
  const [voices, setVoices] = useState<SpeechVoiceOption[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');

  const [rate, setRate] = useState<number>(1.0); // 0.5x to 2.0x
  const [pitch, setPitch] = useState<number>(1.0); // 0.5 to 1.5
  const [volume, setVolume] = useState<number>(1.0); // 0.0 to 1.0

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);

  const [copied, setCopied] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef<number>(0);

  // Check for incoming data transfer
  useEffect(() => {
    const pending = getPendingTransfer('text-to-speech');
    if (pending) {
      setText(pending);
      clearPendingTransfer('text-to-speech');
    }
  }, []);

  // Initialize Speech Synthesis and Voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;

      const loadVoices = () => {
        const list = getAvailableVoices();
        setVoices(list);
        if (list.length > 0 && !selectedVoiceURI) {
          const defaultVoice = list.find((v) => v.default) || list[0];
          setSelectedVoiceURI(defaultVoice.voiceURI);
        }
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [selectedVoiceURI]);

  // Load sample texts
  const handleLoadSample = (sampleType: string) => {
    if (sampleType === 'welcome') {
      setText(
        'Welcome to Tiny Tools! All processing is executed locally right in your web browser. Enjoy fast, private, and serverless tools designed for everyday productivity.'
      );
    } else if (sampleType === 'quote') {
      setText(
        'Simplicity is the prerequisite for reliability. Software engineering is not about writing thousands of lines of code, but crafting elegant and reliable solutions.'
      );
    } else if (sampleType === 'countdown') {
      setText('Starting countdown sequence in three, two, one. All systems operational. Liftoff!');
    }
  };

  const handleSpeakChunk = useCallback((index: number) => {
    if (!synthRef.current || index >= chunksRef.current.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setActiveChunkIndex(0);
      return;
    }

    const chunk = chunksRef.current[index];
    const utterance = new SpeechSynthesisUtterance(chunk);

    if (selectedVoiceURI) {
      const nativeVoices = window.speechSynthesis.getVoices();
      const matched = nativeVoices.find((v) => v.voiceURI === selectedVoiceURI);
      if (matched) utterance.voice = matched;
    }

    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onend = () => {
      chunkIndexRef.current = index + 1;
      setActiveChunkIndex(index + 1);
      if (chunkIndexRef.current < chunksRef.current.length) {
        handleSpeakChunk(chunkIndexRef.current);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        setActiveChunkIndex(0);
      }
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      setIsPlaying(false);
      setIsPaused(false);
    };

    synthRef.current.speak(utterance);
  }, [rate, pitch, volume, selectedVoiceURI]);

  const handlePlay = () => {
    if (!text.trim() || !synthRef.current) return;

    if (isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    synthRef.current.cancel();
    const chunks = chunkTextForSpeech(text);
    chunksRef.current = chunks.map((c) => c.text);
    chunkIndexRef.current = 0;
    setTotalChunks(chunks.length);
    setActiveChunkIndex(0);
    setIsPlaying(true);
    setIsPaused(false);

    handleSpeakChunk(0);
  };

  const handlePause = () => {
    if (!synthRef.current) return;
    synthRef.current.pause();
    setIsPaused(true);
  };

  const handleStop = () => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setActiveChunkIndex(0);
  };

  const handleCopy = async () => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendToTool = (targetToolId: string) => {
    if (!text) return;
    setPendingTransfer(targetToolId, text);
    window.location.hash = `#/tool/${targetToolId}`;
  };

  const estimatedDuration = estimateSpeechDuration(text, rate);

  return (
    <ToolShell
      toolId="text-to-speech"
      title="Text to Speech / Voice Synthesizer"
      description="Listen to any text aloud with customizable browser voices, speech rate, pitch, and sentence highlighting."
      category="productivity"
      relatedToolIds={['audio-recorder', 'image-to-text', 'word-counter']}
      outputToTransfer={text}
    >
      <div className="space-y-6">
        {/* Top Actions Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Sample Text:
            </span>
            <button
              type="button"
              onClick={() => handleLoadSample('welcome')}
              className="px-2 py-1 text-[11px] rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100"
            >
              Welcome Intro
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('quote')}
              className="px-2 py-1 text-[11px] rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100"
            >
              Tech Quote
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('countdown')}
              className="px-2 py-1 text-[11px] rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100"
            >
              Countdown
            </button>

            {text && (
              <button
                type="button"
                onClick={() => {
                  handleStop();
                  setText('');
                }}
                className="px-2 py-1 text-[11px] rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!text}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
          </div>
        </div>

        {/* Text Input Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              Input Text to Read Aloud
            </span>
            <span>Est. Duration: {formatDurationSeconds(estimatedDuration)}</span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste any text here to synthesize with your browser's speech engine..."
            rows={7}
            className="w-full p-3 text-sm font-sans border rounded-lg bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Playback Controls & Voice Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          {/* Left: Playback Controls */}
          <div className="space-y-4">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Voice Playback
            </span>

            <div className="flex items-center gap-3">
              {!isPlaying || isPaused ? (
                <button
                  type="button"
                  disabled={!text.trim()}
                  onClick={handlePlay}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-2xs inline-flex items-center gap-2 disabled:opacity-40"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isPaused ? 'Resume Speech' : 'Speak Text'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-700 text-white shadow-2xs inline-flex items-center gap-2"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
              )}

              {(isPlaying || isPaused) && (
                <>
                  <button
                    type="button"
                    onClick={handlePlay}
                    className="px-3 py-2 text-xs font-medium rounded-md bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 inline-flex items-center gap-1 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100"
                    title="Restart from beginning"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restart</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStop}
                    className="px-3.5 py-2 text-xs font-medium rounded-md bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 inline-flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop</span>
                  </button>
                </>
              )}
            </div>

            {isPlaying && totalChunks > 1 && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-neutral-500">
                  <span>Reading sentence {activeChunkIndex + 1} of {totalChunks}</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-200"
                    style={{ width: `${Math.round(((activeChunkIndex + 1) / totalChunks) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-neutral-500 pt-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Native Web Speech API. Audio generated 100% locally.</span>
            </div>
          </div>

          {/* Right: Pitch / Rate / Volume / Voice Sliders */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Select Voice ({voices.length} detected)
              </label>
              <select
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Speed: {rate}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Pitch: {pitch}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Volume: {Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tool Chaining */}
        {text && (
          <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-1.5 text-xs">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              Send Current Text To:
            </span>
            <div className="flex flex-wrap gap-2 pt-0.5">
              {[
                { id: 'word-counter', label: 'Word Counter' },
                { id: 'text-cleaner', label: 'Text Cleaner' },
                { id: 'case-converter', label: 'Case Converter' },
                { id: 'notepad', label: 'Quick Notepad' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSendToTool(t.id)}
                  className="px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[11px] font-medium"
                >
                  → {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default TextToSpeechTool;
