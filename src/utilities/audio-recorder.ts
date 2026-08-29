/**
 * Audio Recorder & Trimmer Utility
 * Pure browser-native Web Audio API manipulation and local WAV encoder
 */

export interface TrimRange {
  startSeconds: number;
  endSeconds: number;
}

export interface AudioEditOptions {
  fadeInSeconds: number;
  fadeOutSeconds: number;
  gain: number; // 0.1 to 2.0 (1.0 = 100%)
}

/**
 * Decodes audio blob into an AudioBuffer using AudioContext
 */
export async function decodeAudioBlob(blob: Blob, audioCtx: AudioContext): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return await audioCtx.decodeAudioData(arrayBuffer);
}

/**
 * Extracts waveform peaks for rendering an interactive audio canvas
 */
export function extractWaveformPeaks(buffer: AudioBuffer, numBuckets = 200): number[] {
  const channelData = buffer.getChannelData(0);
  const totalSamples = channelData.length;
  const blockSize = Math.floor(totalSamples / numBuckets);
  const peaks: number[] = [];

  for (let i = 0; i < numBuckets; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalSamples);
    let max = 0;

    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;
    }
    peaks.push(max);
  }

  return peaks;
}

/**
 * Creates a trimmed and volume-adjusted AudioBuffer
 */
export function trimAudioBuffer(
  sourceBuffer: AudioBuffer,
  audioCtx: AudioContext,
  range: TrimRange,
  options: AudioEditOptions = { fadeInSeconds: 0, fadeOutSeconds: 0, gain: 1 }
): AudioBuffer {
  const sampleRate = sourceBuffer.sampleRate;
  const numChannels = sourceBuffer.numberOfChannels;

  const startSample = Math.max(0, Math.floor(range.startSeconds * sampleRate));
  const endSample = Math.min(sourceBuffer.length, Math.floor(range.endSeconds * sampleRate));
  const trimmedLength = Math.max(1, endSample - startSample);

  const destBuffer = audioCtx.createBuffer(numChannels, trimmedLength, sampleRate);

  const fadeInSamples = Math.floor(options.fadeInSeconds * sampleRate);
  const fadeOutSamples = Math.floor(options.fadeOutSeconds * sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const srcData = sourceBuffer.getChannelData(ch);
    const destData = destBuffer.getChannelData(ch);

    for (let i = 0; i < trimmedLength; i++) {
      let sample = srcData[startSample + i] * options.gain;

      // Apply Fade In
      if (options.fadeInSeconds > 0 && i < fadeInSamples) {
        sample *= i / fadeInSamples;
      }

      // Apply Fade Out
      if (options.fadeOutSeconds > 0 && i > trimmedLength - fadeOutSamples) {
        const remaining = trimmedLength - i;
        sample *= remaining / fadeOutSamples;
      }

      // Clamp between -1 and 1
      destData[i] = Math.max(-1, Math.min(1, sample));
    }
  }

  return destBuffer;
}

/**
 * Converts an AudioBuffer into a standard 16-bit PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const numSamples = buffer.length * numChannels;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels & write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = buffer.getChannelData(ch)[i];
      // Clamp
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer (-32768 to 32767)
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
