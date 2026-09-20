import { describe, expect, it } from 'vitest';
import { PUBLIC_DEVICE_TASKS } from '../device/publicDeviceTasks';
import { PUBLIC_P19_TASKS } from '../expansion/publicP19Tasks';
import { registerAllPublicTools } from '../registry/register-all';
import { TOOLS_REGISTRY } from '../registry/tools';
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
import {
  CODEC_PROBES,
  analyzeLatency,
  capabilitySummary,
  classifyIpReachability,
  evaluateCodecSupport,
  formatBytes,
  parseIceCandidate,
  summarizeIceCandidates,
  throughputMbps,
} from '../utilities/p19-network-browser';

registerAllPublicTools();

describe('Phase 4 device/browser route coverage', () => {
  it('covers the complete 25-route device family with P2 + P19 contracts', () => {
    const registryIds = TOOLS_REGISTRY.filter((tool) => tool.category === 'device').map((tool) => tool.id).sort();
    const declaredIds = [...PUBLIC_DEVICE_TASKS.map((task) => task.id), ...PUBLIC_P19_TASKS.map((task) => task.id)].sort();

    expect(PUBLIC_DEVICE_TASKS).toHaveLength(16);
    expect(PUBLIC_P19_TASKS).toHaveLength(9);
    expect(registryIds).toHaveLength(25);
    expect(declaredIds).toEqual(registryIds);
    expect(new Set(declaredIds).size).toBe(25);
  });

  it('keeps external network diagnostics explicit and local inspections network-free by contract', () => {
    expect(PUBLIC_P19_TASKS.filter((task) => task.networkUse === 'external').map((task) => task.id)).toEqual([
      'internet-speed-test',
      'connection-stability-test',
      'ipv4-ipv6-test',
      'webrtc-leak-test',
    ]);
    expect(PUBLIC_P19_TASKS.filter((task) => task.networkUse === 'local')).toHaveLength(5);
  });
});

describe('Phase 4 deterministic device signal contracts', () => {
  it('summarizes stable animation and pointer event streams', () => {
    const frameTimes = Array.from({ length: 121 }, (_, index) => index * (1000 / 60));
    expect(summarizeFrameTimes(frameTimes)).toMatchObject({ sampleCount: 120 });
    expect(summarizeFrameTimes(frameTimes).hz).toBeCloseTo(60, 1);

    const pointerTimes = Array.from({ length: 101 }, (_, index) => index * 2);
    expect(summarizeEventRate(pointerTimes)).toMatchObject({ sampleCount: 100 });
    expect(summarizeEventRate(pointerTimes).hz).toBeCloseTo(500, 5);
  });

  it('calculates audio level and deterministic A4 pitch/note evidence', () => {
    expect(rmsFromTimeDomain(new Uint8Array([128, 128, 128, 128]))).toBe(0);
    expect(decibelsFromRms(1)).toBeCloseTo(0, 10);

    const sampleRate = 48_000;
    const samples = new Float32Array(4096);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin(2 * Math.PI * 440 * index / sampleRate) * 0.6;
    }
    const pitch = detectPitch(samples, sampleRate);
    expect(pitch).not.toBeNull();
    expect(pitch!.frequency).toBeCloseTo(440, 0);
    expect(frequencyToNote(pitch!.frequency)).toMatchObject({ note: 'A', octave: 4, midi: 69 });
  });

  it('reports controller drift and battery time semantics without inventing values', () => {
    expect(axisDriftMagnitude([0.01, -0.125, 0.04])).toBeCloseTo(0.125, 10);
    expect(formatDurationSeconds(7200)).toBe('2h 0m');
    expect(formatDurationSeconds(Infinity)).toBe('Not applicable');
    expect(formatDurationSeconds(Number.NaN)).toBe('Unknown');
  });
});

describe('Phase 4 deterministic network/browser contracts', () => {
  it('calculates throughput and latency summaries', () => {
    expect(throughputMbps(1_000_000, 1000)).toBe(8);
    const latency = analyzeLatency([10, 12, null, 14, 50]);
    expect(latency).toMatchObject({ samples: 5, successes: 4, failures: 1, failurePercent: 20 });
    expect(latency.averageMs).toBe(21.5);
  });

  it('classifies IP reachability and valid ICE literals without accepting malformed dotted addresses', () => {
    expect(classifyIpReachability(true, true)).toBe('Dual-stack (IPv4 + IPv6)');
    const privateCandidate = parseIceCandidate('candidate:1 1 udp 2122260223 192.168.1.20 54321 typ host');
    const publicCandidate = parseIceCandidate('candidate:2 1 udp 1686052607 203.0.113.10 62000 typ srflx');
    const malformed = parseIceCandidate('candidate:3 1 udp 2122260223 999.999.999.999 50000 typ host');

    expect(privateCandidate).toMatchObject({ family: 'ipv4', scope: 'private' });
    expect(publicCandidate).toMatchObject({ family: 'ipv4', scope: 'public' });
    expect(malformed).toMatchObject({ family: 'unknown', scope: 'unknown' });
    expect(summarizeIceCandidates([privateCandidate, publicCandidate])).toMatchObject({
      literalCount: 2,
      privateCount: 1,
      publicCount: 1,
    });
  });

  it('keeps the codec matrix stable and supports injected deterministic browser probes', () => {
    expect(CODEC_PROBES).toHaveLength(13);
    const rows = evaluateCodecSupport(
      (kind, mime) => mime.includes('audio/mpeg') ? 'probably' : kind === 'video' ? 'maybe' : '',
      (mime) => mime.includes('webm')
    );
    expect(rows.find((row) => row.label === 'MP3')).toMatchObject({ decode: 'probably', record: false });
    expect(rows.some((row) => row.record)).toBe(true);
  });

  it('summarizes browser feature coverage and byte quantities deterministically', () => {
    expect(capabilitySummary([
      { group: 'A', name: 'one', supported: true },
      { group: 'A', name: 'two', supported: false },
      { group: 'B', name: 'three', supported: true },
    ])).toEqual({ supported: 2, total: 3, percent: 67, groups: 2 });

    expect(formatBytes(1024)).toBe('1.00 KiB');
    expect(formatBytes(1024 ** 2)).toBe('1.00 MiB');
    expect(formatBytes(Infinity)).toBe('Unavailable');
  });
});
