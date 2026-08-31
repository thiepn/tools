export interface FrameRateResult {
  hz: number;
  frameTimeMs: number;
  jitterMs: number;
  sampleCount: number;
}

export interface EventRateResult {
  hz: number;
  intervalMs: number;
  jitterMs: number;
  sampleCount: number;
}

export interface PitchResult {
  frequency: number;
  clarity: number;
}

export interface NoteResult {
  note: string;
  octave: number;
  midi: number;
  cents: number;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function populationStdDev(values: number[], center: number): number {
  if (!values.length) return 0;
  const variance = values.reduce((sum, value) => sum + (value - center) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function summarizeFrameTimes(timestamps: number[]): FrameRateResult {
  if (timestamps.length < 3) return { hz: 0, frameTimeMs: 0, jitterMs: 0, sampleCount: 0 };
  const intervals = timestamps.slice(1).map((value, index) => value - timestamps[index]).filter((value) => value > 0 && value < 100);
  if (!intervals.length) return { hz: 0, frameTimeMs: 0, jitterMs: 0, sampleCount: 0 };
  const frameTimeMs = median(intervals);
  return {
    hz: frameTimeMs > 0 ? 1000 / frameTimeMs : 0,
    frameTimeMs,
    jitterMs: populationStdDev(intervals, frameTimeMs),
    sampleCount: intervals.length,
  };
}

export function summarizeEventRate(timestamps: number[]): EventRateResult {
  if (timestamps.length < 3) return { hz: 0, intervalMs: 0, jitterMs: 0, sampleCount: 0 };
  const intervals = timestamps.slice(1).map((value, index) => value - timestamps[index]).filter((value) => value > 0 && value < 250);
  if (!intervals.length) return { hz: 0, intervalMs: 0, jitterMs: 0, sampleCount: 0 };
  const intervalMs = median(intervals);
  return {
    hz: intervalMs > 0 ? 1000 / intervalMs : 0,
    intervalMs,
    jitterMs: populationStdDev(intervals, intervalMs),
    sampleCount: intervals.length,
  };
}

export function rmsFromTimeDomain(samples: Uint8Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / samples.length);
}

export function decibelsFromRms(rms: number): number {
  if (!(rms > 0)) return -Infinity;
  return 20 * Math.log10(rms);
}

export function detectPitch(samples: Float32Array, sampleRate: number, minFrequency = 55, maxFrequency = 1200): PitchResult | null {
  if (samples.length < 32 || sampleRate <= 0) return null;
  let rms = 0;
  for (const value of samples) rms += value * value;
  rms = Math.sqrt(rms / samples.length);
  if (rms < 0.01) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxLag = Math.min(samples.length - 2, Math.ceil(sampleRate / minFrequency));
  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let energyA = 0;
    let energyB = 0;
    const limit = samples.length - lag;
    for (let i = 0; i < limit; i += 1) {
      const a = samples[i];
      const b = samples[i + lag];
      correlation += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    const normalized = correlation / Math.sqrt(Math.max(energyA * energyB, Number.EPSILON));
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorrelation < 0.45) return null;

  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const corrAt = (lag: number) => {
      let correlation = 0;
      let energyA = 0;
      let energyB = 0;
      const limit = samples.length - lag;
      for (let i = 0; i < limit; i += 1) {
        const a = samples[i];
        const b = samples[i + lag];
        correlation += a * b;
        energyA += a * a;
        energyB += b * b;
      }
      return correlation / Math.sqrt(Math.max(energyA * energyB, Number.EPSILON));
    };
    const left = corrAt(bestLag - 1);
    const center = bestCorrelation;
    const right = corrAt(bestLag + 1);
    const denominator = left - 2 * center + right;
    if (Math.abs(denominator) > 1e-6) refinedLag += 0.5 * (left - right) / denominator;
  }

  return {
    frequency: sampleRate / refinedLag,
    clarity: Math.min(1, Math.max(0, bestCorrelation)),
  };
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function frequencyToNote(frequency: number, referenceA4 = 440): NoteResult | null {
  if (!(frequency > 0) || !(referenceA4 > 0)) return null;
  const midiFloat = 69 + 12 * Math.log2(frequency / referenceA4);
  const midi = Math.round(midiFloat);
  const noteIndex = ((midi % 12) + 12) % 12;
  return {
    note: NOTE_NAMES[noteIndex],
    octave: Math.floor(midi / 12) - 1,
    midi,
    cents: (midiFloat - midi) * 100,
  };
}

export function axisDriftMagnitude(axes: readonly number[]): number {
  return axes.reduce((max, value) => Math.max(max, Math.abs(Number.isFinite(value) ? value : 0)), 0);
}

export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Unknown';
  if (seconds === Infinity) return 'Not applicable';
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
