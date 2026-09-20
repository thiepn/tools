/** Browser-native extraction of audio samples from a browser-decodable video. */
export interface VideoAudioExtractionOptions {
  startSeconds?: number;
  endSeconds?: number;
  onProgress?: (progress: number) => void;
}

function waitForMedia(video: HTMLVideoElement, eventName: 'loadedmetadata' | 'canplay', timeoutMs = 8000): Promise<void> {
  if (eventName === 'loadedmetadata' && video.readyState >= 1) return Promise.resolve();
  if (eventName === 'canplay' && video.readyState >= 3) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { cleanup(); reject(new Error(`Timed out waiting for video ${eventName}.`)); }, timeoutMs);
    const cleanup = () => { window.clearTimeout(timer); video.removeEventListener(eventName, ready); video.removeEventListener('error', failed); };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('The browser could not decode the video source.')); };
    video.addEventListener(eventName, ready, { once: true });
    video.addEventListener('error', failed, { once: true });
  });
}

function seekMedia(video: HTMLVideoElement, seconds: number): Promise<void> {
  const target = Math.max(0, Math.min(Number.isFinite(video.duration) ? video.duration : seconds, seconds));
  if (Math.abs(video.currentTime - target) < 0.015) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('Timed out while seeking the video audio source.')); }, 7000);
    const cleanup = () => { window.clearTimeout(timer); video.removeEventListener('seeked', done); video.removeEventListener('error', failed); };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('The source video could not seek to the requested audio range.')); };
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', failed, { once: true });
    video.currentTime = target;
  });
}

function pcmToWav(channels: Float32Array[], sampleRate: number): Blob {
  if (!channels.length || !channels[0]?.length) throw new Error('No audio samples were captured from the video.');
  const frameCount = Math.min(...channels.map((channel) => channel.length));
  const channelCount = channels.length;
  const dataSize = frameCount * channelCount * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame] || 0));
      view.setInt16(offset, Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function concatenate(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Extracts PCM audio by letting the browser decode a temporary video element and
 * capturing its Web Audio output in real time. This deliberately avoids
 * AudioContext.decodeAudioData(videoBytes), which is not a portable video-demux API.
 */
export async function extractVideoAudioToWav(
  source: Blob,
  options: VideoAudioExtractionOptions = {}
): Promise<Blob> {
  if (typeof document === 'undefined' || typeof AudioContext === 'undefined') {
    throw new Error('Web Audio extraction is unavailable in this browser.');
  }
  const url = URL.createObjectURL(source);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  video.src = url;
  video.volume = 1;
  video.muted = false;

  let context: AudioContext | null = null;
  let mediaSource: MediaElementAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let sink: GainNode | null = null;
  let timer: number | null = null;

  try {
    video.load();
    await waitForMedia(video, 'loadedmetadata');
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0) throw new Error('The video has no measurable duration.');

    const start = Math.max(0, Math.min(duration, options.startSeconds ?? 0));
    const requestedEnd = options.endSeconds ?? duration;
    const end = Math.max(start, Math.min(duration, requestedEnd));
    if (end - start < 0.01) throw new Error('Choose a non-empty audio extraction range.');

    context = new AudioContext();
    mediaSource = context.createMediaElementSource(video);
    // ScriptProcessor is intentionally used as a compatibility fallback here:
    // it is widely available in browsers that support the rest of Tiny Tools,
    // requires no dynamically generated AudioWorklet module, and runs only for
    // an explicit user-initiated local conversion.
    processor = context.createScriptProcessor(4096, 2, 2);
    sink = context.createGain();
    sink.gain.value = 0;
    const channelChunks: Float32Array[][] = [[], []];
    let capturedFrames = 0;
    let observedChannels = 0;

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer;
      const channels = Math.max(1, Math.min(2, input.numberOfChannels));
      observedChannels = Math.max(observedChannels, channels);
      for (let channel = 0; channel < channels; channel += 1) {
        channelChunks[channel].push(new Float32Array(input.getChannelData(channel)));
      }
      capturedFrames += input.length;
    };

    mediaSource.connect(processor);
    processor.connect(sink);
    sink.connect(context.destination);
    await seekMedia(video, start);
    await context.resume();

    const finished = new Promise<void>((resolve, reject) => {
      const fail = () => { cleanup(); reject(new Error('Video playback failed during audio extraction.')); };
      const cleanup = () => {
        if (timer !== null) window.clearInterval(timer);
        timer = null;
        video.removeEventListener('error', fail);
      };
      video.addEventListener('error', fail, { once: true });
      timer = window.setInterval(() => {
        const position = Math.min(end, Math.max(start, video.currentTime));
        options.onProgress?.(Math.max(0, Math.min(1, (position - start) / (end - start))));
        if (video.ended || video.currentTime >= end - 0.008) {
          video.pause();
          cleanup();
          resolve();
        }
      }, 25);
    });

    try {
      await video.play();
    } catch {
      throw new Error('The browser blocked video playback required for local audio extraction. Start extraction from a user action and keep the tab active.');
    }
    await finished;
    // Give the audio graph one task turn to deliver the final processor block.
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    processor.onaudioprocess = null;
    video.pause();

    if (!capturedFrames || !observedChannels) throw new Error('No audio samples were captured from this video.');
    const channels = channelChunks.slice(0, observedChannels).map(concatenate);
    const shortest = Math.min(...channels.map((channel) => channel.length));
    if (!shortest) throw new Error('No audio samples were captured from this video.');
    options.onProgress?.(1);
    return pcmToWav(channels.map((channel) => channel.subarray(0, shortest)), context.sampleRate);
  } finally {
    if (timer !== null) window.clearInterval(timer);
    video.pause();
    processor?.disconnect();
    mediaSource?.disconnect();
    sink?.disconnect();
    await context?.close().catch(() => {});
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
