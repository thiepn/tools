/**
 * Web Worker for Truly Browser-Local Whisper Speech Recognition
 * Handles ONNX / Transformers.js execution off the main UI thread with WebGPU / WASM
 */

import { pipeline, env } from '@huggingface/transformers';
import {
  WorkerInboundMessage,
  WorkerOutboundMessage,
  AVAILABLE_SPEECH_MODELS,
  parseWhisperChunks,
  createTranscriptSegments,
} from '../../utilities/speech-to-text';

// Configure transformers environment for browser sandbox
env.allowLocalModels = false;

// Keep track of pipeline instance
let currentPipeline: any = null;
let currentModelId: string | null = null;
let activeDevice: 'webgpu' | 'wasm' | 'cpu' = 'wasm';

// Helper to determine best available device
async function getOptimalDevice(requestedDevice?: 'webgpu' | 'wasm' | 'cpu'): Promise<'webgpu' | 'wasm' | 'cpu'> {
  if (requestedDevice) return requestedDevice;
  // Test if WebGPU is available in the current worker context
  if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        return 'webgpu';
      }
    } catch {
      // Fallback to wasm
    }
  }
  return 'wasm';
}

async function loadModel(modelId: string, requestedDevice?: 'webgpu' | 'wasm' | 'cpu') {
  const modelConfig = AVAILABLE_SPEECH_MODELS.find((m) => m.id === modelId) || AVAILABLE_SPEECH_MODELS[0];
  
  if (currentPipeline && currentModelId === modelId) {
    self.postMessage({
      type: 'MODEL_LOADED',
      modelId,
      device: activeDevice,
    } as WorkerOutboundMessage);
    return;
  }

  const device = await getOptimalDevice(requestedDevice);

  self.postMessage({
    type: 'MODEL_PROGRESS',
    data: { status: 'initiate', modelId, progress: 0 },
  } as WorkerOutboundMessage);

  try {
    try {
      currentPipeline = await pipeline('automatic-speech-recognition', modelConfig.repo, {
        device,
        progress_callback: (progressData: any) => {
          self.postMessage({
            type: 'MODEL_PROGRESS',
            data: progressData,
          } as WorkerOutboundMessage);
        },
      });
      activeDevice = device;
    } catch (primaryErr) {
      // If WebGPU fails to initialize shaders or memory, fallback gracefully to WASM
      if (device === 'webgpu') {
        console.warn('WebGPU speech pipeline failed, falling back to WASM:', primaryErr);
        currentPipeline = await pipeline('automatic-speech-recognition', modelConfig.repo, {
          device: 'wasm',
          progress_callback: (progressData: any) => {
            self.postMessage({
              type: 'MODEL_PROGRESS',
              data: progressData,
            } as WorkerOutboundMessage);
          },
        });
        activeDevice = 'wasm';
      } else {
        throw primaryErr;
      }
    }

    currentModelId = modelId;
    self.postMessage({
      type: 'MODEL_LOADED',
      modelId,
      device: activeDevice,
    } as WorkerOutboundMessage);
  } catch (err: any) {
    self.postMessage({
      type: 'ERROR',
      error: err?.message || 'Failed to download or initialize local speech model.',
      stage: 'loading',
    } as WorkerOutboundMessage);
  }
}

async function runTranscription(
  audio: Float32Array,
  modelId: string,
  language?: string,
  returnTimestamps = true
) {
  const startTime = performance.now();

  try {
    if (!currentPipeline || currentModelId !== modelId) {
      await loadModel(modelId);
    }

    if (!currentPipeline) {
      throw new Error('Transcription pipeline is not loaded.');
    }

    self.postMessage({
      type: 'TRANSCRIBE_PROGRESS',
      progress: 25,
      elapsedTimeSec: 0,
    } as WorkerOutboundMessage);

    const modelConfig = AVAILABLE_SPEECH_MODELS.find((m) => m.id === modelId) || AVAILABLE_SPEECH_MODELS[0];
    
    // Whisper options
    const options: any = {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: returnTimestamps,
    };

    if (modelConfig.multilingual && language && language !== 'auto') {
      options.language = language;
    }

    // Run browser-local ONNX Whisper model
    const result: any = await currentPipeline(audio, options);

    const endTime = performance.now();
    const processingTimeSec = Number(((endTime - startTime) / 1000).toFixed(2));
    const audioDurationSec = audio.length / 16000;

    let fullText = '';
    let segments: any[] = [];

    if (typeof result === 'string') {
      fullText = result.trim();
      segments = createTranscriptSegments(fullText, audioDurationSec);
    } else if (result && typeof result.text === 'string') {
      fullText = result.text.trim();
      if (result.chunks && Array.isArray(result.chunks) && result.chunks.length > 0) {
        segments = parseWhisperChunks(result.chunks, audioDurationSec);
      } else {
        segments = createTranscriptSegments(fullText, audioDurationSec);
      }
    }

    self.postMessage({
      type: 'TRANSCRIBE_RESULT',
      text: fullText,
      segments,
      duration: audioDurationSec,
      language: language || 'en',
      deviceUsed: activeDevice,
      processingTimeSec,
    } as WorkerOutboundMessage);
  } catch (err: any) {
    self.postMessage({
      type: 'ERROR',
      error: err?.message || 'Local transcription inference failed.',
      stage: 'inference',
    } as WorkerOutboundMessage);
  }
}

// Handle messages from main thread
self.onmessage = async (e: MessageEvent<WorkerInboundMessage>) => {
  const msg = e.data;
  if (!msg) return;

  switch (msg.type) {
    case 'LOAD_MODEL':
      await loadModel(msg.modelId, msg.device);
      break;

    case 'TRANSCRIBE':
      await runTranscription(msg.audio, msg.modelId, msg.language, msg.returnTimestamps);
      break;

    case 'UNLOAD_MODEL':
      currentPipeline = null;
      currentModelId = null;
      break;
  }
};
