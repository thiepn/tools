/**
 * Audio Preprocessing Utilities for Browser-Local Speech Recognition
 * Resampling, channel mixing (stereo to mono), normalization, and chunking
 */

/**
 * Resamples an AudioBuffer to a target sample rate (typically 16000 Hz for Whisper)
 * and mixes down all channels to a single mono Float32Array.
 */
export function resampleAudioBufferTo16kMono(audioBuffer: AudioBuffer, targetSampleRate = 16000): Float32Array {
  const numChannels = audioBuffer.numberOfChannels;
  const origLength = audioBuffer.length;
  const origSampleRate = audioBuffer.sampleRate;

  // Mix down multi-channel audio to mono
  const mono = new Float32Array(origLength);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < origLength; i++) {
      mono[i] += channelData[i] / numChannels;
    }
  }

  // If already at target sample rate, return normalized copy
  if (origSampleRate === targetSampleRate) {
    return normalizeAudioFloat32(mono);
  }

  // Linear interpolation resampling
  const ratio = origSampleRate / targetSampleRate;
  const targetLength = Math.round(origLength / ratio);
  const resampled = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const origIndex = i * ratio;
    const indexLow = Math.floor(origIndex);
    const indexHigh = Math.min(indexLow + 1, origLength - 1);
    const fraction = origIndex - indexLow;

    resampled[i] = mono[indexLow] * (1 - fraction) + mono[indexHigh] * fraction;
  }

  return normalizeAudioFloat32(resampled);
}

/**
 * Normalizes and clamps Float32 audio samples between -1.0 and 1.0
 */
export function normalizeAudioFloat32(samples: Float32Array): Float32Array {
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAbs) {
      maxAbs = abs;
    }
  }

  const out = new Float32Array(samples.length);
  if (maxAbs === 0) return out;

  // Normalize only if clipping or very quiet, without aggressive amplification of noise
  const gain = maxAbs > 1.0 ? 1.0 / maxAbs : 1.0;
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-1.0, Math.min(1.0, samples[i] * gain));
  }

  return out;
}

/**
 * Decodes raw Audio file / Blob using offline AudioContext into 16kHz mono Float32Array
 */
export async function decodeAudioFileTo16kMono(
  fileOrBlob: Blob | File,
  targetSampleRate = 16000
): Promise<{ audioData: Float32Array; duration: number; sampleRate: number }> {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    const duration = decoded.duration;
    const audioData = resampleAudioBufferTo16kMono(decoded, targetSampleRate);
    return { audioData, duration, sampleRate: targetSampleRate };
  } finally {
    audioCtx.close().catch(() => {});
  }
}
