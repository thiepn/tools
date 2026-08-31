import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Copy, Pause, Play, RotateCcw, ShieldCheck, Square } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  chooseBestVoice,
  chunkTextForSpeech,
  estimateSpeechDuration,
  formatDurationSeconds,
  getAvailableVoices,
  inferSpeechLanguageHint,
  type SpeechChunk,
  type SpeechVoiceOption,
} from '../../utilities/text-to-speech';
import { copyToClipboard } from '../../utilities/clipboard';
import { clearPendingTransfer, getPendingTransfer, setPendingTransfer } from '../../storage/transfer';

export const TextToSpeechTool: React.FC = () => {
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<SpeechVoiceOption[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeChunkIndex, setActiveChunkIndex] = useState(-1);
  const [activeBoundary, setActiveBoundary] = useState(0);
  const [copied, setCopied] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const chunksRef = useRef<SpeechChunk[]>([]);
  const sessionRef = useRef(0);
  const speechSupported = typeof window !== 'undefined' && typeof window.speechSynthesis?.speak === 'function' && typeof window.SpeechSynthesisUtterance === 'function';

  useEffect(() => {
    const pending = getPendingTransfer('text-to-speech');
    if (pending) { setText(pending); clearPendingTransfer('text-to-speech'); }
  }, []);

  useEffect(() => {
    if (!speechSupported) { synthRef.current = null; setVoices([]); return; }
    const synth = window.speechSynthesis;
    synthRef.current = synth;
    const load = () => {
      const list = getAvailableVoices();
      setVoices(list);
      setSelectedVoiceURI((current) => current || chooseBestVoice(list, '', navigator.language)?.voiceURI || '');
    };
    load();
    synth.addEventListener?.('voiceschanged', load);
    synth.onvoiceschanged = load;
    return () => {
      sessionRef.current += 1;
      synth.cancel();
      synth.removeEventListener?.('voiceschanged', load);
      synth.onvoiceschanged = null;
    };
  }, [speechSupported]);

  const selectedVoice = useMemo(() => chooseBestVoice(voices, selectedVoiceURI, inferSpeechLanguageHint(text)), [voices, selectedVoiceURI, text]);
  const chunks = useMemo(() => chunkTextForSpeech(text), [text]);
  const estimatedDuration = estimateSpeechDuration(text, rate);

  const stopSpeech = useCallback(() => {
    sessionRef.current += 1;
    synthRef.current?.cancel();
    setIsPlaying(false); setIsPaused(false); setActiveChunkIndex(-1); setActiveBoundary(0);
  }, []);

  const speakChunk = useCallback((index: number, session: number) => {
    const synth = synthRef.current;
    const queue = chunksRef.current;
    if (!synth || session !== sessionRef.current || index >= queue.length) {
      if (session === sessionRef.current) { setIsPlaying(false); setIsPaused(false); setActiveChunkIndex(-1); }
      return;
    }
    const chunk = queue[index];
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    const actualVoice = selectedVoice ? synth.getVoices().find((voice) => voice.voiceURI === selectedVoice.voiceURI) : undefined;
    if (actualVoice) utterance.voice = actualVoice;
    utterance.lang = actualVoice?.lang || selectedVoice?.lang || inferSpeechLanguageHint(chunk.text);
    utterance.rate = rate; utterance.pitch = pitch; utterance.volume = volume;
    utterance.onstart = () => { if (session === sessionRef.current) { setActiveChunkIndex(index); setActiveBoundary(chunk.charStart); } };
    utterance.onboundary = (event) => { if (session === sessionRef.current && Number.isFinite(event.charIndex)) setActiveBoundary(chunk.charStart + event.charIndex); };
    utterance.onend = () => { if (session === sessionRef.current) speakChunk(index + 1, session); };
    utterance.onerror = (event) => {
      if (session !== sessionRef.current || event.error === 'canceled' || event.error === 'interrupted') return;
      setSpeechError(`Speech playback stopped (${event.error || 'voice error'}). Try another installed voice.`);
      setIsPlaying(false); setIsPaused(false);
    };
    synth.speak(utterance);
  }, [pitch, rate, selectedVoice, volume]);

  const startSpeech = useCallback((startIndex = 0) => {
    if (!speechSupported || !synthRef.current || !text.trim()) return;
    const queue = chunkTextForSpeech(text);
    if (!queue.length) return;
    sessionRef.current += 1;
    const session = sessionRef.current;
    synthRef.current.cancel();
    chunksRef.current = queue;
    setSpeechError(null); setIsPlaying(true); setIsPaused(false);
    speakChunk(Math.max(0, Math.min(startIndex, queue.length - 1)), session);
  }, [speakChunk, speechSupported, text]);

  const handlePrimaryPlay = () => {
    if (isPaused && synthRef.current) { synthRef.current.resume(); setIsPaused(false); setIsPlaying(true); return; }
    startSpeech(activeChunkIndex >= 0 && !isPlaying ? activeChunkIndex : 0);
  };
  const handlePause = () => { if (synthRef.current && isPlaying) { synthRef.current.pause(); setIsPaused(true); setIsPlaying(false); } };
  const handleTextChange = (value: string) => { if (isPlaying || isPaused) stopSpeech(); setText(value); };
  const handleCopy = async () => { if (text && await copyToClipboard(text)) { setCopied(true); setTimeout(() => setCopied(false), 1600); } };
  const handleSendToTool = (target: string) => { if (text) { setPendingTransfer(target, text); window.location.hash = `#/tool/${target}`; } };

  const activeChunk = activeChunkIndex >= 0 ? chunksRef.current[activeChunkIndex] : null;

  return (
    <ToolShell toolId="text-to-speech" title="Text to Speech / Voice Synthesizer" description="Read long text aloud with stable chunked playback, installed-voice selection, pause/resume, progress, and boundary highlighting." category="productivity" relatedToolIds={['audio-recorder', 'image-to-text', 'word-counter']} outputToTransfer={text}>
      <div className="space-y-5">
        {!speechSupported && <div role="alert" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><AlertCircle className="h-4 w-4" />Text-to-speech is not supported in this browser. You can still edit, copy, and send the text to other tools.</div>}
        {speechError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{speechError}</div>}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-wrap gap-2 text-[11px]">
            <button onClick={() => handleTextChange('Welcome to Tiny Tools. Long passages are split into reliable speech chunks and played locally through your browser or operating system voice service.')} className="rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900">Sample intro</button>
            <button onClick={() => handleTextChange('Simplicity is prerequisite for reliability. Clear tools should do one job accurately, predictably, and without unnecessary friction.')} className="rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900">Sample quote</button>
            {text && <button onClick={() => { stopSpeech(); setText(''); }} className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"><RotateCcw className="h-3.5 w-3.5" /></button>}
          </div>
          <button onClick={handleCopy} disabled={!text} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900">{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy text'}</button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs"><span className="font-semibold">Input text</span><span className="text-neutral-500">{chunks.length} chunks · ~{formatDurationSeconds(estimatedDuration)}</span></div>
          <textarea value={text} onChange={(event) => handleTextChange(event.target.value)} rows={9} placeholder="Type or paste text to read aloud…" className="w-full resize-y rounded-lg border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
        </div>

        <div className="grid gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(!isPlaying || isPaused) ? <button type="button" disabled={!speechSupported || !text.trim()} onClick={handlePrimaryPlay} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"><Play className="h-4 w-4" />{isPaused ? 'Resume Speech' : 'Speak Text'}</button> : <button type="button" onClick={handlePause} className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white"><Pause className="h-4 w-4" />Pause</button>}
              {(isPlaying || isPaused) && <><button onClick={() => startSpeech(0)} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"><RotateCcw className="h-3.5 w-3.5" />Restart</button><button onClick={stopSpeech} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"><Square className="h-3.5 w-3.5" />Stop</button></>}
            </div>
            {activeChunk && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-800 dark:bg-blue-950/30"><div className="mb-1 font-semibold text-blue-800 dark:text-blue-200">Chunk {activeChunkIndex + 1} of {chunksRef.current.length}</div><div className="leading-relaxed text-neutral-700 dark:text-neutral-300">{activeChunk.text}</div><div className="mt-1 font-mono text-[10px] text-neutral-400">source position {activeBoundary.toLocaleString()}</div></div>}
            <div className="flex items-start gap-2 text-[11px] text-neutral-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>Uses your browser/OS speech service. Voice availability, network use, and on-device status vary by platform; local voices are labeled when the browser reports them.</span></div>
          </div>

          <div className="space-y-3 text-xs">
            <label className="block"><span className="mb-1 block font-semibold">Voice ({voices.length} detected)</span><select value={selectedVoiceURI} onChange={(event) => { stopSpeech(); setSelectedVoiceURI(event.target.value); }} disabled={!speechSupported || !voices.length} className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-900">{voices.map((voice) => <option key={`${voice.voiceURI}-${voice.lang}`} value={voice.voiceURI}>{voice.name} ({voice.lang}){voice.localService ? ' — local' : ''}</option>)}</select></label>
            <div className="grid grid-cols-3 gap-3">
              <label>Speed {rate.toFixed(1)}×<input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={(event) => { stopSpeech(); setRate(Number(event.target.value)); }} className="w-full" /></label>
              <label>Pitch {pitch.toFixed(1)}×<input type="range" min="0.5" max="1.5" step="0.1" value={pitch} onChange={(event) => { stopSpeech(); setPitch(Number(event.target.value)); }} className="w-full" /></label>
              <label>Volume {Math.round(volume * 100)}%<input type="range" min="0.1" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-full" /></label>
            </div>
          </div>
        </div>

        {text && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[11px] dark:border-neutral-800 dark:bg-neutral-950"><span className="font-semibold">Send text to:</span>{[{ id: 'word-counter', label: 'Word Counter' }, { id: 'text-cleaner', label: 'Text Cleaner' }, { id: 'notepad', label: 'Quick Notepad' }].map((tool) => <button key={tool.id} onClick={() => handleSendToTool(tool.id)} className="rounded border border-neutral-300 bg-white px-2 py-1 text-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-blue-400">→ {tool.label}</button>)}</div>}
      </div>
    </ToolShell>
  );
};

export default TextToSpeechTool;
