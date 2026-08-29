/**
 * Metronome & Tap Tempo Utilities
 * Uses Web Audio API high-precision lookahead scheduling
 */

export type TimeSignature = '2/4' | '3/4' | '4/4' | '5/4' | '6/8' | '7/8';

export type Subdivision = 'quarter' | 'eighth' | 'triplet' | 'sixteenth';

export interface TimeSignatureDetails {
  beatsPerMeasure: number;
  beatUnit: number;
  name: string;
}

export const TIME_SIGNATURES: Record<TimeSignature, TimeSignatureDetails> = {
  '2/4': { beatsPerMeasure: 2, beatUnit: 4, name: '2/4 (Duple)' },
  '3/4': { beatsPerMeasure: 3, beatUnit: 4, name: '3/4 (Waltz / Triple)' },
  '4/4': { beatsPerMeasure: 4, beatUnit: 4, name: '4/4 (Common Time)' },
  '5/4': { beatsPerMeasure: 5, beatUnit: 4, name: '5/4 (Odd Meter)' },
  '6/8': { beatsPerMeasure: 6, beatUnit: 8, name: '6/8 (Compound Duple)' },
  '7/8': { beatsPerMeasure: 7, beatUnit: 8, name: '7/8 (Complex)' },
};

export const SUBDIVISION_FACTORS: Record<Subdivision, number> = {
  quarter: 1,
  eighth: 2,
  triplet: 3,
  sixteenth: 4,
};

/**
 * Calculates BPM from a series of tap timestamps (in milliseconds)
 * Filters out extreme outlier intervals and returns median/average BPM
 */
export function calculateTapTempo(tapTimesMs: number[]): {
  bpm: number | null;
  tapCount: number;
} {
  if (tapTimesMs.length < 2) {
    return { bpm: null, tapCount: tapTimesMs.length };
  }

  // Calculate intervals between consecutive taps
  const intervals: number[] = [];
  for (let i = 1; i < tapTimesMs.length; i++) {
    const diff = tapTimesMs[i] - tapTimesMs[i - 1];
    // Discard taps that are faster than 300 BPM (200ms) or slower than 30 BPM (2000ms)
    if (diff >= 180 && diff <= 2500) {
      intervals.push(diff);
    }
  }

  if (intervals.length === 0) {
    return { bpm: null, tapCount: tapTimesMs.length };
  }

  // Take only the last 6 intervals for responsive tempo adjustments
  const recentIntervals = intervals.slice(-6);

  // Sort and remove lowest & highest if we have enough samples
  let filtered = [...recentIntervals];
  if (filtered.length >= 4) {
    filtered.sort((a, b) => a - b);
    filtered = filtered.slice(1, -1); // remove min and max outlier
  }

  const avgInterval = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  const rawBpm = 60000 / avgInterval;
  const roundedBpm = Math.round(Math.max(30, Math.min(300, rawBpm)));

  return {
    bpm: roundedBpm,
    tapCount: tapTimesMs.length,
  };
}

/**
 * High-precision Web Audio Metronome Engine
 */
export class MetronomeEngine {
  private audioCtx: AudioContext | null = null;
  private isRunning = false;
  private bpm = 120;
  private timeSignature: TimeSignature = '4/4';
  private subdivision: Subdivision = 'quarter';
  private accentFirstBeat = true;
  private volume = 0.8;

  private currentSubdivisionIndex = 0;
  private nextNoteTime = 0.0;
  private timerWorkerId: number | null = null;
  private onBeatCallback?: (beatInMeasure: number, isAccent: boolean) => void;

  constructor() {}

  private initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setParams(params: {
    bpm?: number;
    timeSignature?: TimeSignature;
    subdivision?: Subdivision;
    accentFirstBeat?: boolean;
    volume?: number;
  }) {
    if (params.bpm !== undefined) this.bpm = Math.max(30, Math.min(300, params.bpm));
    if (params.timeSignature !== undefined) this.timeSignature = params.timeSignature;
    if (params.subdivision !== undefined) this.subdivision = params.subdivision;
    if (params.accentFirstBeat !== undefined) this.accentFirstBeat = params.accentFirstBeat;
    if (params.volume !== undefined) this.volume = Math.max(0, Math.min(1, params.volume));
  }

  public setOnBeatCallback(cb: (beatInMeasure: number, isAccent: boolean) => void) {
    this.onBeatCallback = cb;
  }

  public start() {
    if (this.isRunning) return;
    this.initAudio();
    if (!this.audioCtx) return;

    this.isRunning = true;
    this.currentSubdivisionIndex = 0;
    this.nextNoteTime = this.audioCtx.currentTime + 0.05;

    // Run lookahead loop
    const lookaheadMs = 25;
    const scheduleAheadTime = 0.1; // 100ms

    const scheduler = () => {
      if (!this.isRunning || !this.audioCtx) return;
      while (this.nextNoteTime < this.audioCtx.currentTime + scheduleAheadTime) {
        this.scheduleNote(this.nextNoteTime);
        this.advanceNote();
      }
      this.timerWorkerId = window.setTimeout(scheduler, lookaheadMs);
    };

    scheduler();
  }

  public stop() {
    this.isRunning = false;
    if (this.timerWorkerId !== null) {
      clearTimeout(this.timerWorkerId);
      this.timerWorkerId = null;
    }
  }

  public destroy() {
    this.stop();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  private advanceNote() {
    const subdivFactor = SUBDIVISION_FACTORS[this.subdivision];
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPerSubdivision = secondsPerBeat / subdivFactor;

    this.nextNoteTime += secondsPerSubdivision;
    this.currentSubdivisionIndex++;
  }

  private scheduleNote(time: number) {
    if (!this.audioCtx) return;

    const details = TIME_SIGNATURES[this.timeSignature];
    const subdivFactor = SUBDIVISION_FACTORS[this.subdivision];
    const totalSubdivisionsPerMeasure = details.beatsPerMeasure * subdivFactor;

    const measureIndex = this.currentSubdivisionIndex % totalSubdivisionsPerMeasure;
    const isMainBeat = measureIndex % subdivFactor === 0;
    const beatInMeasure = Math.floor(measureIndex / subdivFactor);
    const isFirstBeat = measureIndex === 0;
    const isAccent = this.accentFirstBeat && isFirstBeat;

    // Trigger UI beat indicator at precise audio time
    if (this.onBeatCallback && isMainBeat) {
      const delayMs = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.isRunning && this.onBeatCallback) {
          this.onBeatCallback(beatInMeasure, isAccent);
        }
      }, delayMs);
    }

    // Audio click synthesis
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    if (isAccent) {
      osc.frequency.setValueAtTime(1400, time); // High pitched sharp woodblock/beep
      gain.gain.setValueAtTime(this.volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    } else if (isMainBeat) {
      osc.frequency.setValueAtTime(880, time); // Standard beat
      gain.gain.setValueAtTime(this.volume * 0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    } else {
      // Subdivision tick
      osc.frequency.setValueAtTime(550, time);
      gain.gain.setValueAtTime(this.volume * 0.35, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
    }

    osc.start(time);
    osc.stop(time + 0.06);
  }
}
