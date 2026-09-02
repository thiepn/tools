import { describe, expect, it } from 'vitest';
import { PUBLIC_DEVICE_TASKS, getPublicDeviceTask, readTinyToolsDeviceTaskId } from '../device/publicDeviceTasks';
import { registerPdfPublicTools } from '../registry/pdf-extension';
import { registerDeviceDiagnosticTools } from '../registry/device-extension';
import { CATEGORIES, TOOLS_REGISTRY } from '../registry/tools';
import {
  axisDriftMagnitude,
  decibelsFromRms,
  detectPitch,
  formatDurationSeconds,
  frequencyToNote,
  rmsFromTimeDomain,
  summarizeEventRate,
  summarizeFrameTimes,
} from '../utilities/device-diagnostics';

registerPdfPublicTools();
registerDeviceDiagnosticTools();

describe('P2 public device diagnostics catalog', () => {
  it('defines exactly 16 unique diagnostic routes', () => {
    expect(PUBLIC_DEVICE_TASKS).toHaveLength(16);
    expect(new Set(PUBLIC_DEVICE_TASKS.map((task) => task.id)).size).toBe(16);
  });

  it('registers P2 idempotently after the consolidated P1 PDF family', () => {
    registerDeviceDiagnosticTools();
    registerDeviceDiagnosticTools();
    expect(TOOLS_REGISTRY).toHaveLength(84);
    expect(TOOLS_REGISTRY.filter((tool) => tool.category === 'device')).toHaveLength(16);
    expect(CATEGORIES.filter((category) => category.id === 'device')).toHaveLength(1);
  });

  it('resolves direct and canonical tool hashes', () => {
    expect(readTinyToolsDeviceTaskId('#/tool/gamepad-test')).toBe('gamepad-test');
    expect(readTinyToolsDeviceTaskId('#/microphone-test')).toBe('microphone-test');
    expect(readTinyToolsDeviceTaskId('#/tool/tone-generator?source=search')).toBe('tone-generator');
    expect(getPublicDeviceTask('dead-pixel-test')?.name).toContain('Dead Pixel');
  });

  it('keeps capability claims truthful', () => {
    const polling = getPublicDeviceTask('polling-rate-test');
    const battery = getPublicDeviceTask('battery-status');
    expect(polling?.description.toLowerCase()).toContain('not a raw usb');
    expect(battery?.name).toBe('Battery Status');
    expect(battery?.description.toLowerCase()).not.toContain('health');
  });
});

describe('P2 timing diagnostics', () => {
  it('estimates a 60 Hz animation cadence from frame timestamps', () => {
    const timestamps = Array.from({ length: 121 }, (_, index) => index * (1000 / 60));
    const result = summarizeFrameTimes(timestamps);
    expect(result.hz).toBeCloseTo(60, 1);
    expect(result.frameTimeMs).toBeCloseTo(16.6667, 2);
    expect(result.sampleCount).toBe(120);
  });

  it('uses a robust median for browser event-rate estimates', () => {
    const timestamps = [0, 1, 2, 3, 4, 50, 51, 52, 53, 54];
    const result = summarizeEventRate(timestamps);
    expect(result.hz).toBeCloseTo(1000, 1);
    expect(result.intervalMs).toBeCloseTo(1, 5);
  });

  it('returns an empty result for insufficient samples', () => {
    expect(summarizeFrameTimes([0, 16]).hz).toBe(0);
    expect(summarizeEventRate([0, 1]).hz).toBe(0);
  });
});

describe('P2 audio diagnostics', () => {
  it('calculates microphone RMS and dBFS consistently', () => {
    expect(rmsFromTimeDomain(new Uint8Array([128, 128, 128, 128]))).toBe(0);
    expect(decibelsFromRms(1)).toBeCloseTo(0, 8);
    expect(decibelsFromRms(0)).toBe(-Infinity);
  });

  it('detects a clean A4 sine wave near 440 Hz', () => {
    const sampleRate = 48_000;
    const samples = new Float32Array(4096);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.sin(2 * Math.PI * 440 * index / sampleRate) * 0.6;
    const pitch = detectPitch(samples, sampleRate);
    expect(pitch).not.toBeNull();
    expect(pitch?.frequency).toBeCloseTo(440, 0);
    expect(pitch?.clarity ?? 0).toBeGreaterThan(0.9);
  });

  it('maps standard frequencies to musical notes and cents', () => {
    expect(frequencyToNote(440)).toMatchObject({ note: 'A', octave: 4, midi: 69 });
    expect(frequencyToNote(440)?.cents).toBeCloseTo(0, 8);
    expect(frequencyToNote(261.625565)?.note).toBe('C');
    expect(frequencyToNote(261.625565)?.octave).toBe(4);
  });

  it('rejects silence as a pitch', () => {
    expect(detectPitch(new Float32Array(4096), 48_000)).toBeNull();
  });
});

describe('P2 controller and battery helpers', () => {
  it('reports maximum absolute resting axis drift', () => {
    expect(axisDriftMagnitude([0.01, -0.07, 0.025, 0])).toBeCloseTo(0.07, 8);
    expect(axisDriftMagnitude([])).toBe(0);
  });

  it('formats finite and unknown battery time estimates without inventing values', () => {
    expect(formatDurationSeconds(5400)).toBe('1h 30m');
    expect(formatDurationSeconds(600)).toBe('10m');
    expect(formatDurationSeconds(Infinity)).toBe('Unknown');
    expect(formatDurationSeconds(Number.NaN)).toBe('Unknown');
  });
});
