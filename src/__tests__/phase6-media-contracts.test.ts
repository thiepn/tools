import { describe, expect, it } from 'vitest';
import { registerAllPublicTools } from '../registry/register-all';
import { TOOLS_REGISTRY } from '../registry/tools';
import { PUBLIC_MEDIA_TASKS } from '../media/publicMediaTasks';
import {
  dbToGain,
  downmixChannels,
  estimateLoopedDuration,
} from '../utilities/media-micro-tools';
import { trimAudioBuffer } from '../utilities/audio-recorder';
import {
  processReverseChannels,
} from '../utilities/s-tier-audio';
import {
  calculateElapsedRecordingSeconds,
  estimateRecordingSizeBytes,
  generateRecordingFilename,
  planScreenRecording,
} from '../utilities/screen-recorder';
import {
  calculateVideoOutputDimensions,
  planVideoExport,
  type VideoProcessingOptions,
} from '../utilities/video-toolkit';

registerAllPublicTools();

const MEDIA_ROUTE_IDS = [
  'screen-recorder',
  'audio-recorder',
  'video-toolkit',
  'gif-maker',
  'metronome',
  'meme-maker',
  'audio-joiner',
  'audio-converter',
  'audio-volume-changer',
  'audio-speed-changer',
  'audio-normalizer',
  'silence-trimmer',
  'audio-equalizer',
  'reverse-audio',
  'audio-noise-cleanup',
  'stereo-mono-converter',
  'ringtone-maker',
  'audio-pitch-speed-shifter',
  'merge-videos',
  'video-compressor',
  'video-converter',
  'video-to-audio',
  'add-audio-to-video',
  'add-text-to-video',
  'loop-video',
  'video-to-frames',
  'video-thumbnail-extractor',
  'webcam-video-recorder',
  'add-logo-to-video',
  'subtitle-burner',
  'video-to-gif',
  'video-speed-changer',
  'crop-resize-video',
  'mute-video',
  'video-volume-changer',
  'subtitle-editor',
  'subtitle-converter',
  'subtitle-time-shifter',
  'subtitle-resynchronizer',
  'subtitle-frame-rate-converter',
  'subtitle-cleaner-validator',
  'subtitle-merger',
  'subtitle-splitter',
  'subtitle-reading-speed-analyzer',
].sort();

const PHASE6_TARGET_IDS = [
  'screen-recorder',
  'reverse-audio',
  'stereo-mono-converter',
  'ringtone-maker',
  'loop-video',
  'crop-resize-video',
  'mute-video',
  'video-volume-changer',
].sort();

function fakeAudioBuffer(
  channelData: number[][],
  sampleRate: number
): AudioBuffer {
  const channels = channelData.map((values) => Float32Array.from(values));
  const length = channels[0]?.length ?? 0;
  return {
    numberOfChannels: channels.length,
    length,
    sampleRate,
    duration: sampleRate > 0 ? length / sampleRate : 0,
    getChannelData(index: number) {
      return channels[index];
    },
    copyToChannel(source: Float32Array, channelNumber: number, startInChannel = 0) {
      channels[channelNumber].set(source, startInChannel);
    },
  } as unknown as AudioBuffer;
}

function fakeAudioContext(): AudioContext {
  return {
    createBuffer(channels: number, length: number, sampleRate: number) {
      return fakeAudioBuffer(
        Array.from({ length: channels }, () => Array(length).fill(0)),
        sampleRate
      );
    },
  } as unknown as AudioContext;
}

function videoOptions(overrides: Partial<VideoProcessingOptions> = {}): VideoProcessingOptions {
  return {
    trimStart: 0,
    trimEnd: 10,
    cropPreset: 'free',
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    resizeMode: 'original',
    preserveAspectRatio: true,
    playbackSpeed: 1,
    muteAudio: false,
    volume: 1,
    ...overrides,
  };
}

describe('Phase 6 media-family completeness', () => {
  it('covers exactly the complete 44-route media family', () => {
    const registryIds = TOOLS_REGISTRY
      .filter((tool) => tool.category === 'media')
      .map((tool) => tool.id)
      .sort();

    expect(registryIds).toHaveLength(44);
    expect(registryIds).toEqual(MEDIA_ROUTE_IDS);
    expect(PUBLIC_MEDIA_TASKS).toHaveLength(29);
  });

  it('tracks the eight previously fixture-blocked media workflows explicitly', () => {
    expect(PHASE6_TARGET_IDS).toEqual([
      'crop-resize-video',
      'loop-video',
      'mute-video',
      'reverse-audio',
      'ringtone-maker',
      'screen-recorder',
      'stereo-mono-converter',
      'video-volume-changer',
    ]);
  });
});

describe('Phase 6 audio transformation contracts', () => {
  it('reverses only the selected audio region', () => {
    const processed = processReverseChannels(
      [Float32Array.from([1, 2, 3, 4, 5])],
      1,
      {
        startSeconds: 1,
        endSeconds: 4,
        fadeMs: 0,
        normalizePeak: false,
      }
    );

    expect([...processed.channels[0]]).toEqual([1, 4, 3, 2, 5]);
    expect(processed.summary).toMatchObject({
      startSample: 1,
      endSample: 4,
      reversedSamples: 3,
      gainApplied: 1,
    });
  });

  it('downmixes stereo deterministically for the stereo/mono converter', () => {
    const mono = downmixChannels([
      Float32Array.from([1, 0.5, -1]),
      Float32Array.from([-1, 0.5, 1]),
    ]);
    expect([...mono]).toEqual([0, 0.5, 0]);
  });

  it('trims the requested ringtone selection with bounded fades', () => {
    const source = fakeAudioBuffer([
      Array.from({ length: 100 }, (_, index) => index / 100),
    ], 10);

    const out = trimAudioBuffer(
      source,
      fakeAudioContext(),
      { startSeconds: 2, endSeconds: 5 },
      { fadeInSeconds: 0.2, fadeOutSeconds: 0.2, gain: 1 }
    );

    expect(out.length).toBe(30);
    expect(out.duration).toBe(3);
    expect(out.getChannelData(0)[0]).toBeCloseTo(0, 10);
    expect(out.getChannelData(0)[29]).toBeCloseTo(0, 10);
  });

  it('keeps dB gain conversion bounded for downstream audio gain tools', () => {
    expect(dbToGain(0)).toBeCloseTo(1, 10);
    expect(dbToGain(6)).toBeCloseTo(1.995262, 5);
  });
});

describe('Phase 6 video transformation contracts', () => {
  it('calculates looped duration from repeat count and playback speed', () => {
    expect(estimateLoopedDuration(5, 3, 2)).toBe(7.5);
    expect(estimateLoopedDuration(5, 50, 1)).toBe(100);
  });

  it('produces deterministic square crop/resize output dimensions', () => {
    const result = calculateVideoOutputDimensions(1920, 1080, {
      rotation: 0,
      resizeMode: 'custom',
      customWidth: 480,
      customHeight: 480,
      preserveAspectRatio: false,
      cropRect: { x: 0.25, y: 0, width: 0.5, height: 1 },
    });
    expect(result).toEqual({ width: 480, height: 480 });
  });

  it('removes audio bitrate from mute-video export planning', () => {
    const audible = planVideoExport(
      { width: 640, height: 360, duration: 10 },
      videoOptions({ muteAudio: false }),
      'balanced',
      30
    );
    const muted = planVideoExport(
      { width: 640, height: 360, duration: 10 },
      videoOptions({ muteAudio: true }),
      'balanced',
      30
    );

    expect(audible.durationSeconds).toBe(10);
    expect(muted.durationSeconds).toBe(10);
    expect(audible.estimatedBytes - muted.estimatedBytes).toBe(160_000);
  });

  it('retains source volume in the processing contract without changing geometry', () => {
    const quiet = planVideoExport(
      { width: 640, height: 360, duration: 4 },
      videoOptions({ volume: 0.5 }),
      'balanced',
      30
    );
    const loud = planVideoExport(
      { width: 640, height: 360, duration: 4 },
      videoOptions({ volume: 1.5 }),
      'balanced',
      30
    );

    expect(quiet.width).toBe(loud.width);
    expect(quiet.height).toBe(loud.height);
    expect(quiet.durationSeconds).toBe(loud.durationSeconds);
  });
});

describe('Phase 6 screen recorder contracts', () => {
  it('plans bounded local recording bitrate and size', () => {
    const plan = planScreenRecording(1920, 1080, 30, 'balanced', true);
    expect(plan.width).toBe(1920);
    expect(plan.height).toBe(1080);
    expect(plan.fps).toBe(30);
    expect(plan.videoBitsPerSecond).toBeGreaterThan(0);
    expect(plan.audioBitsPerSecond).toBe(128000);
    expect(plan.estimatedBytesPerMinute).toBe(
      Math.round((plan.videoBitsPerSecond + plan.audioBitsPerSecond) / 8 * 60)
    );
  });

  it('calculates active elapsed time without paused duration', () => {
    expect(calculateElapsedRecordingSeconds(1000, 2000, 8000)).toBe(5);
    expect(calculateElapsedRecordingSeconds(8000, 0, 1000)).toBe(0);
  });

  it('generates deterministic recording filenames by MIME type', () => {
    const date = new Date(2026, 0, 2, 3, 4, 5);
    expect(generateRecordingFilename('video/webm', date)).toBe('screen-recording-2026-01-02-030405.webm');
    expect(generateRecordingFilename('video/mp4', date)).toBe('screen-recording-2026-01-02-030405.mp4');
  });

  it('estimates encoded recording size from combined bitrates', () => {
    expect(estimateRecordingSizeBytes(60, 4_000_000, 128_000)).toBe(30_960_000);
  });
});
