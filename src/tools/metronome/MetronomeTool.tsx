import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Plus,
  Minus,
  Volume2,
  Music,
  Sliders,
} from 'lucide-react';
import {
  MetronomeEngine,
  TimeSignature,
  Subdivision,
  TIME_SIGNATURES,
  calculateTapTempo,
} from '../../utilities/metronome';

function getTempoName(bpm: number): string {
  if (bpm < 40) return 'Grave (Extremely Slow)';
  if (bpm < 60) return 'Largo (Broadly)';
  if (bpm < 66) return 'Larghetto';
  if (bpm < 76) return 'Adagio (Slow & Stately)';
  if (bpm < 108) return 'Andante (Walking Pace)';
  if (bpm < 120) return 'Moderato';
  if (bpm < 168) return 'Allegro (Fast & Bright)';
  if (bpm < 200) return 'Presto (Very Fast)';
  return 'Prestissimo (Extremely Fast)';
}

export const MetronomeTool: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>('4/4');
  const [subdivision, setSubdivision] = useState<Subdivision>('quarter');
  const [accentFirstBeat, setAccentFirstBeat] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [currentBeat, setCurrentBeat] = useState<number>(-1);
  const [isAccentBeat, setIsAccentBeat] = useState(false);

  // Tap Tempo State
  const tapTimesRef = useRef<number[]>([]);
  const [lastTapInfo, setLastTapInfo] = useState<string | null>(null);

  const engineRef = useRef<MetronomeEngine | null>(null);

  // Initialize engine
  useEffect(() => {
    const engine = new MetronomeEngine();
    engine.setOnBeatCallback((beat, isAccent) => {
      setCurrentBeat(beat);
      setIsAccentBeat(isAccent);
    });
    engineRef.current = engine;

    return () => {
      engine.destroy();
    };
  }, []);

  // Update engine params
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setParams({
        bpm,
        timeSignature,
        subdivision,
        accentFirstBeat,
        volume,
      });
    }
  }, [bpm, timeSignature, subdivision, accentFirstBeat, volume]);

  const togglePlay = () => {
    if (!engineRef.current) return;
    if (isPlaying) {
      engineRef.current.stop();
      setIsPlaying(false);
      setCurrentBeat(-1);
    } else {
      engineRef.current.start();
      setIsPlaying(true);
    }
  };

  // Tap Tempo Calculation
  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current;

    // Reset if last tap was over 2.5 seconds ago
    if (taps.length > 0 && now - taps[taps.length - 1] > 2500) {
      taps.length = 0;
    }

    taps.push(now);
    const result = calculateTapTempo(taps);
    if (result.bpm !== null) {
      setBpm(result.bpm);
      setLastTapInfo(`${result.bpm} BPM (${result.tapCount} taps)`);
    } else {
      setLastTapInfo('Tap again...');
    }
  };

  // Keyboard Shortcuts (Space, T, Arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        handleTapTempo();
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowRight') {
        e.preventDefault();
        setBpm((b) => Math.min(300, b + 1));
      } else if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') {
        e.preventDefault();
        setBpm((b) => Math.max(30, b - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const totalBeats = TIME_SIGNATURES[timeSignature]?.beatsPerMeasure || 4;
  const tempoMarking = getTempoName(bpm);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Display & Tempo Dial Column */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Beat Visualizer */}
          <div className="p-8 bg-slate-900 text-white rounded-2xl shadow-md flex flex-col items-center justify-center space-y-6">
            <div className="text-center">
              <div className="text-6xl font-black font-mono tracking-tight text-white mb-1">
                {bpm} <span className="text-xl font-normal text-slate-400">BPM</span>
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                {tempoMarking}
              </div>
            </div>

            {/* Beat Dots */}
            <div className="flex items-center gap-3">
              {Array.from({ length: totalBeats }).map((_, i) => {
                const isActive = isPlaying && currentBeat === i;
                const isAccent = i === 0 && accentFirstBeat;
                return (
                  <div
                    key={i}
                    className={`transition-all duration-75 rounded-full ${
                      isActive
                        ? isAccent
                          ? 'w-7 h-7 bg-amber-400 shadow-lg shadow-amber-500/50 scale-125'
                          : 'w-6 h-6 bg-indigo-500 shadow-md shadow-indigo-500/50 scale-115'
                        : isAccent
                        ? 'w-5 h-5 bg-amber-400/30'
                        : 'w-4 h-4 bg-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            {/* Primary Action Button */}
            <button
              onClick={togglePlay}
              className={`px-8 py-3 rounded-full text-base font-bold flex items-center gap-2 shadow-lg transition-all ${
                isPlaying
                  ? 'bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white ring-4 ring-indigo-600/30'
              }`}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              {isPlaying ? 'Stop' : 'Start Metronome'}
            </button>
          </div>

          {/* Tempo Adjustment Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Tempo Adjustment
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBpm((b) => Math.max(30, b - 5))}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  -5
                </button>
                <button
                  onClick={() => setBpm((b) => Math.max(30, b - 1))}
                  className="p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setBpm((b) => Math.min(300, b + 1))}
                  className="p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setBpm((b) => Math.min(300, b + 5))}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  +5
                </button>
              </div>
            </div>

            <input
              type="range"
              min="30"
              max="300"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-full"
            />

            {/* Tap Tempo Button */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleTapTempo}
                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Music className="w-3.5 h-3.5" />
                Tap Tempo (or press &apos;T&apos;)
              </button>
              {lastTapInfo && (
                <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                  {lastTapInfo}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rhythm & Sound Configuration Column */}
        <div className="lg:col-span-5 space-y-4">
          {/* Time Signature */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Time Signature
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['2/4', '3/4', '4/4', '5/4', '6/8', '7/8'] as TimeSignature[]).map((ts) => (
                <button
                  key={ts}
                  onClick={() => setTimeSignature(ts)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    timeSignature === ts
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {TIME_SIGNATURES[ts]?.name || ts}
                </button>
              ))}
            </div>
          </div>

          {/* Subdivisions */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Subdivision
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'quarter', label: 'Quarter Notes (1:1)' },
                { id: 'eighth', label: 'Eighth Notes (1:2)' },
                { id: 'triplet', label: 'Triplets (1:3)' },
                { id: 'sixteenth', label: 'Sixteenths (1:4)' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSubdivision(sub.id as Subdivision)}
                  className={`py-2 px-2 text-xs font-medium rounded-lg border transition-colors ${
                    subdivision === sub.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Controls */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                Volume ({Math.round(volume * 100)}%)
              </label>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full"
            />

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={accentFirstBeat}
                onChange={(e) => setAccentFirstBeat(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              Accent first beat of measure (High Pitch)
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetronomeTool;
