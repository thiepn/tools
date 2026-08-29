import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Flag,
  Copy,
  Check,
  Timer as TimerIcon,
  Clock,
  Sparkles,
  Flame,
  Volume2,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import { playChimeSound } from '../../utilities/timer-audio';

interface LapRecord {
  lapNumber: number;
  lapTimeMs: number;
  totalTimeMs: number;
}

export const TimerStopwatchTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'timer' | 'stopwatch' | 'pomodoro'>('timer');

  // 1. COUNTDOWN TIMER STATE
  const [timerHours, setTimerHours] = useState<number>(0);
  const [timerMins, setTimerMins] = useState<number>(5);
  const [timerSecs, setTimerSecs] = useState<number>(0);

  const [totalTimerDurationMs, setTotalTimerDurationMs] = useState<number>(300000);
  const [timerRemainingMs, setTimerRemainingMs] = useState<number>(300000);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerEndTimestampRef = useRef<number | null>(null);

  // 2. STOPWATCH STATE
  const [isStopwatchRunning, setIsStopwatchRunning] = useState<boolean>(false);
  const [stopwatchElapsedMs, setStopwatchElapsedMs] = useState<number>(0);
  const [laps, setLaps] = useState<LapRecord[]>([]);
  const stopwatchStartRef = useRef<number | null>(null);
  const stopwatchAccumulatedRef = useRef<number>(0);

  // 3. POMODORO STATE
  const [pomoMode, setPomoMode] = useState<'work' | 'shortBreak' | 'longBreak'>('work');
  const [pomoWorkMins, setPomoWorkMins] = useState<number>(25);
  const [pomoShortMins, setPomoShortMins] = useState<number>(5);
  const [pomoLongMins, setPomoLongMins] = useState<number>(15);
  const [pomoCycleCount, setPomoCycleCount] = useState<number>(1);
  const [pomoRemainingMs, setPomoRemainingMs] = useState<number>(25 * 60 * 1000);
  const [isPomoRunning, setIsPomoRunning] = useState<boolean>(false);
  const pomoEndTimestampRef = useRef<number | null>(null);

  const [copiedLaps, setCopiedLaps] = useState<boolean>(false);

  // Format Helper: MM:SS or HH:MM:SS
  const formatTime = (totalMs: number, showMs = false): string => {
    const sTotal = Math.max(0, Math.floor(totalMs / 1000));
    const hours = Math.floor(sTotal / 3600);
    const mins = Math.floor((sTotal % 3600) / 60);
    const secs = sTotal % 60;
    const ms = Math.floor((totalMs % 1000) / 10);

    const pad = (n: number) => String(n).padStart(2, '0');
    let base = `${pad(mins)}:${pad(secs)}`;
    if (hours > 0) {
      base = `${pad(hours)}:${base}`;
    }
    if (showMs) {
      base = `${base}.${pad(ms)}`;
    }
    return base;
  };

  // 1. COUNTDOWN TIMER TICK
  useEffect(() => {
    let frameId: number;

    if (isTimerRunning && timerEndTimestampRef.current !== null) {
      const tick = () => {
        const remaining = Math.max(0, timerEndTimestampRef.current! - Date.now());
        setTimerRemainingMs(remaining);

        if (remaining <= 0) {
          setIsTimerRunning(false);
          timerEndTimestampRef.current = null;
          playChimeSound();
          return;
        }
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frameId);
  }, [isTimerRunning]);

  const handleStartTimer = () => {
    const durMs = (timerHours * 3600 + timerMins * 60 + timerSecs) * 1000;
    if (durMs <= 0) return;
    setTotalTimerDurationMs(durMs);
    setTimerRemainingMs(durMs);
    timerEndTimestampRef.current = Date.now() + durMs;
    setIsTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
    timerEndTimestampRef.current = null;
  };

  const handleResumeTimer = () => {
    if (timerRemainingMs <= 0) return;
    timerEndTimestampRef.current = Date.now() + timerRemainingMs;
    setIsTimerRunning(true);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    timerEndTimestampRef.current = null;
    const durMs = (timerHours * 3600 + timerMins * 60 + timerSecs) * 1000;
    setTimerRemainingMs(durMs);
  };

  const handleAddTimerPreset = (minutes: number) => {
    setTimerMins((prev) => Math.min(59, prev + minutes));
  };

  // 2. STOPWATCH TICK
  useEffect(() => {
    let frameId: number;

    if (isStopwatchRunning) {
      const tick = () => {
        const now = Date.now();
        const elapsed = stopwatchAccumulatedRef.current + (now - stopwatchStartRef.current!);
        setStopwatchElapsedMs(elapsed);
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frameId);
  }, [isStopwatchRunning]);

  const handleStartStopwatch = () => {
    stopwatchStartRef.current = Date.now();
    setIsStopwatchRunning(true);
  };

  const handlePauseStopwatch = () => {
    if (stopwatchStartRef.current) {
      stopwatchAccumulatedRef.current += Date.now() - stopwatchStartRef.current;
    }
    setIsStopwatchRunning(false);
  };

  const handleResetStopwatch = () => {
    setIsStopwatchRunning(false);
    stopwatchStartRef.current = null;
    stopwatchAccumulatedRef.current = 0;
    setStopwatchElapsedMs(0);
    setLaps([]);
  };

  const handleRecordLap = () => {
    const prevTotal = laps.length > 0 ? laps[0].totalTimeMs : 0;
    const lapTimeMs = stopwatchElapsedMs - prevTotal;

    const newLap: LapRecord = {
      lapNumber: laps.length + 1,
      lapTimeMs,
      totalTimeMs: stopwatchElapsedMs,
    };
    setLaps([newLap, ...laps]);
  };

  // Copy Lap Times
  const handleCopyLaps = () => {
    const formatted = laps
      .map(
        (l) =>
          `Lap ${l.lapNumber}: +${formatTime(l.lapTimeMs, true)} (Total: ${formatTime(l.totalTimeMs, true)})`
      )
      .join('\n');
    copyToClipboard(formatted);
    setCopiedLaps(true);
    setTimeout(() => setCopiedLaps(false), 2000);
  };

  // 3. POMODORO TICK
  useEffect(() => {
    let frameId: number;

    if (isPomoRunning && pomoEndTimestampRef.current !== null) {
      const tick = () => {
        const remaining = Math.max(0, pomoEndTimestampRef.current! - Date.now());
        setPomoRemainingMs(remaining);

        if (remaining <= 0) {
          setIsPomoRunning(false);
          pomoEndTimestampRef.current = null;
          playChimeSound();

          // Auto switch mode
          if (pomoMode === 'work') {
            if (pomoCycleCount % 4 === 0) {
              setPomoMode('longBreak');
              setPomoRemainingMs(pomoLongMins * 60 * 1000);
            } else {
              setPomoMode('shortBreak');
              setPomoRemainingMs(pomoShortMins * 60 * 1000);
            }
            setPomoCycleCount((prev) => prev + 1);
          } else {
            setPomoMode('work');
            setPomoRemainingMs(pomoWorkMins * 60 * 1000);
          }
          return;
        }
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frameId);
  }, [isPomoRunning, pomoMode, pomoCycleCount, pomoWorkMins, pomoShortMins, pomoLongMins]);

  const handleStartPomo = () => {
    pomoEndTimestampRef.current = Date.now() + pomoRemainingMs;
    setIsPomoRunning(true);
  };

  const handlePausePomo = () => {
    setIsPomoRunning(false);
    pomoEndTimestampRef.current = null;
  };

  const handleResetPomo = () => {
    setIsPomoRunning(false);
    pomoEndTimestampRef.current = null;
    const dur =
      pomoMode === 'work'
        ? pomoWorkMins
        : pomoMode === 'shortBreak'
        ? pomoShortMins
        : pomoLongMins;
    setPomoRemainingMs(dur * 60 * 1000);
  };

  // Best / Worst Laps
  const { minLapMs, maxLapMs } = useMemo(() => {
    if (laps.length <= 1) return { minLapMs: null, maxLapMs: null };
    const times = laps.map((l) => l.lapTimeMs);
    return { minLapMs: Math.min(...times), maxLapMs: Math.max(...times) };
  }, [laps]);

  return (
    <ToolShell
      toolId="timer-stopwatch"
      title="Timer, Stopwatch & Pomodoro"
      description="Precision countdown timer with audible synth chimes, millisecond split-lap stopwatch, and Pomodoro focus intervals."
      category="time"
      relatedToolIds={['time-zone-converter', 'date-calculator']}
      outputToTransfer={
        activeTab === 'stopwatch' && laps.length > 0
          ? laps
              .map(
                (l) =>
                  `Lap ${l.lapNumber}: ${formatTime(l.lapTimeMs, true)} (${formatTime(l.totalTimeMs, true)})`
              )
              .join('\n')
          : formatTime(timerRemainingMs)
      }
    >
      <div className="space-y-6">
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'timer'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            <TimerIcon className="w-4 h-4" />
            <span>Countdown Timer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stopwatch')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'stopwatch'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Precision Stopwatch</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pomodoro')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'pomodoro'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            <Flame className="w-4 h-4 text-rose-500" />
            <span>Pomodoro Focus</span>
          </button>
        </div>

        {/* 1. COUNTDOWN TIMER */}
        {activeTab === 'timer' && (
          <div className="space-y-6">
            <div className="p-8 bg-neutral-900 text-white rounded-2xl border border-neutral-800 flex flex-col items-center justify-center space-y-6 shadow-sm">
              <div className="font-mono text-5xl sm:text-7xl font-bold tracking-tight text-neutral-100 select-none">
                {formatTime(timerRemainingMs)}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {!isTimerRunning ? (
                  <button
                    type="button"
                    onClick={timerRemainingMs < totalTimerDurationMs && timerRemainingMs > 0 ? handleResumeTimer : handleStartTimer}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs inline-flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{timerRemainingMs < totalTimerDurationMs && timerRemainingMs > 0 ? 'Resume' : 'Start Timer'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseTimer}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-xs inline-flex items-center gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetTimer}
                  className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Timer Settings & Quick Presets */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Set Timer Duration
              </h4>

              <div className="grid grid-cols-3 gap-3 max-w-sm">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1 text-center">
                    Hours
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={timerHours}
                    onChange={(e) => setTimerHours(Math.max(0, Number(e.target.value)))}
                    className="w-full text-center py-1.5 text-xs font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1 text-center">
                    Minutes
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={timerMins}
                    onChange={(e) => setTimerMins(Math.max(0, Math.min(59, Number(e.target.value))))}
                    className="w-full text-center py-1.5 text-xs font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1 text-center">
                    Seconds
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={timerSecs}
                    onChange={(e) => setTimerSecs(Math.max(0, Math.min(59, Number(e.target.value))))}
                    className="w-full text-center py-1.5 text-xs font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-neutral-400">Quick Add:</span>
                {[1, 5, 10, 15, 25, 30].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setTimerMins(m);
                      setTimerHours(0);
                      setTimerSecs(0);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 rounded text-neutral-700 dark:text-neutral-300"
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. PRECISION STOPWATCH */}
        {activeTab === 'stopwatch' && (
          <div className="space-y-6">
            <div className="p-8 bg-neutral-900 text-white rounded-2xl border border-neutral-800 flex flex-col items-center justify-center space-y-6 shadow-sm">
              <div className="font-mono text-5xl sm:text-7xl font-bold tracking-tight text-neutral-100 select-none">
                {formatTime(stopwatchElapsedMs, true)}
              </div>

              {/* Stopwatch Action Controls */}
              <div className="flex items-center gap-3">
                {!isStopwatchRunning ? (
                  <button
                    type="button"
                    onClick={handleStartStopwatch}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs inline-flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Start</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseStopwatch}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-xs inline-flex items-center gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRecordLap}
                  disabled={!isStopwatchRunning}
                  className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Flag className="w-4 h-4" />
                  <span>Lap</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetStopwatch}
                  className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Lap Times Table */}
            {laps.length > 0 && (
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Recorded Laps ({laps.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopyLaps}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
                  >
                    {copiedLaps ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLaps ? 'Copied Laps' : 'Copy All'}</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {laps.map((lap) => {
                    const isFastest = minLapMs !== null && lap.lapTimeMs === minLapMs;
                    const isSlowest = maxLapMs !== null && lap.lapTimeMs === maxLapMs;

                    return (
                      <div
                        key={lap.lapNumber}
                        className={`flex items-center justify-between p-2.5 rounded text-xs font-mono border ${
                          isFastest
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold'
                            : isSlowest
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-400">#{lap.lapNumber}</span>
                          {isFastest && <span className="text-[10px] uppercase font-bold bg-emerald-200 dark:bg-emerald-900 px-1 rounded">Fastest</span>}
                          {isSlowest && <span className="text-[10px] uppercase font-bold bg-rose-200 dark:bg-rose-900 px-1 rounded">Slowest</span>}
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="font-bold">+{formatTime(lap.lapTimeMs, true)}</span>
                          <span className="text-neutral-400">{formatTime(lap.totalTimeMs, true)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. POMODORO FOCUS */}
        {activeTab === 'pomodoro' && (
          <div className="space-y-6">
            <div className="p-8 bg-neutral-900 text-white rounded-2xl border border-neutral-800 flex flex-col items-center justify-center space-y-5 shadow-sm">
              <div className="flex items-center gap-2 px-3 py-1 bg-neutral-800 rounded-full text-xs font-bold uppercase tracking-wider text-rose-400">
                <Flame className="w-3.5 h-3.5 fill-rose-400" />
                <span>
                  {pomoMode === 'work' ? 'Focus Work' : pomoMode === 'shortBreak' ? 'Short Break' : 'Long Break'} • Cycle {pomoCycleCount}
                </span>
              </div>

              <div className="font-mono text-5xl sm:text-7xl font-bold tracking-tight text-neutral-100 select-none">
                {formatTime(pomoRemainingMs)}
              </div>

              <div className="flex items-center gap-3">
                {!isPomoRunning ? (
                  <button
                    type="button"
                    onClick={handleStartPomo}
                    className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-xs inline-flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Start Interval</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePausePomo}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-xs inline-flex items-center gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetPomo}
                  className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Pomodoro Duration Settings */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Interval Durations (Minutes)
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">Focus Work</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={pomoWorkMins}
                    onChange={(e) => setPomoWorkMins(Math.max(1, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">Short Break</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={pomoShortMins}
                    onChange={(e) => setPomoShortMins(Math.max(1, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">Long Break</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={pomoLongMins}
                    onChange={(e) => setPomoLongMins(Math.max(1, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default TimerStopwatchTool;
