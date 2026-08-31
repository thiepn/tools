import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateOtsuThreshold, validateDocumentQuad } from '../utilities/document-scanner';
import { assessSourceResolution, calculateCoverPlacement } from '../utilities/id-photo-maker';
import { preprocessOcrRgba, SUPPORTED_OCR_LANGUAGES } from '../utilities/image-ocr';
import { chooseBestVoice, chunkTextForSpeech, inferSpeechLanguageHint, type SpeechVoiceOption } from '../utilities/text-to-speech';
import { parseBoardState, serializeBoardState, simplifyBoardPath, translateBoardElement, type BoardElement } from '../utilities/whiteboard';
import { fitMemeTextLayout } from '../utilities/meme-maker';
import { findClosestPaletteIndex, generateAdaptivePalette } from '../utilities/gif-maker';
import { calculateRecommendedVideoBitrate, chooseVideoRenderFps, normalizeVideoTrimRange } from '../utilities/video-toolkit';

const source = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('D-tier to A-tier uplift regressions', () => {
  describe('Document Scanner', () => {
    it('validates convex document quads and rejects crossing corners', () => {
      expect(validateDocumentQuad([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 150 }, { x: 0, y: 150 }])).toBe(true);
      expect(validateDocumentQuad([{ x: 0, y: 0 }, { x: 100, y: 150 }, { x: 100, y: 0 }, { x: 0, y: 150 }])).toBe(false);
    });

    it('derives a deterministic automatic threshold from a bimodal document histogram', () => {
      const values = new Uint8Array([...Array(100).fill(24), ...Array(100).fill(230)]);
      const threshold = calculateOtsuThreshold(values);
      expect(threshold).toBeGreaterThanOrEqual(24);
      expect(threshold).toBeLessThan(230);
    });

    it('uses explicit high-quality rendering instead of continuously warping while corners move', () => {
      const utility = source('src/utilities/document-scanner.ts');
      const component = source('src/tools/document-scanner/DocumentScannerTool.tsx');
      expect(utility).toContain('createUnitSquareToQuadMap');
      expect(utility).toContain('bilinear pixel sampling');
      expect(component).toContain("'Generate Scan'");
      expect(component).toContain('aspectRatio: `${dimensions.width} / ${dimensions.height}`');
    });
  });

  describe('Passport & ID Photo Maker', () => {
    it('clamps panning so no blank frame edge can enter the export', () => {
      const placement = calculateCoverPlacement(1000, 1000, 600, 800, 1, 999, -999, 0);
      expect(placement.scale).toBeCloseTo(0.8, 8);
      expect(placement.panX).toBeCloseTo(100, 8);
      expect(placement.panY).toBe(0);
      expect(placement.renderedWidth).toBeCloseTo(800, 8);
      expect(placement.renderedHeight).toBeCloseTo(800, 8);
    });

    it('warns when nominal output resolution requires source upscaling', () => {
      const assessment = assessSourceResolution(600, 600, 600, 800);
      expect(assessment.adequate).toBe(false);
      expect(assessment.scaleFactor).toBeGreaterThan(1);
    });

    it('is explicit that guides are not biometric certification', () => {
      const component = source('src/tools/id-photo-maker/IdPhotoMakerTool.tsx');
      expect(component).toContain('calculateCoverPlacement');
      expect(component).toContain('Preparation aid, not biometric certification');
      expect(component).toContain('Resolution check');
    });
  });

  describe('Image to Text / OCR', () => {
    it('normalizes document contrast while preserving alpha', () => {
      const rgba = new Uint8ClampedArray([
        18, 22, 26, 255,
        235, 240, 245, 128,
      ]);
      const result = preprocessOcrRgba(rgba, 2, 1);
      expect(result[0]).toBe(result[1]);
      expect(result[1]).toBe(result[2]);
      expect(result[4]).toBe(result[5]);
      expect(result[5]).toBe(result[6]);
      expect(result[0]).toBeLessThan(result[4]);
      expect(result[3]).toBe(255);
      expect(result[7]).toBe(128);
    });

    it('expands local OCR language coverage beyond the original four languages', () => {
      expect(SUPPORTED_OCR_LANGUAGES.length).toBeGreaterThanOrEqual(9);
      expect(SUPPORTED_OCR_LANGUAGES.some((language) => language.id === 'kor')).toBe(true);
      expect(SUPPORTED_OCR_LANGUAGES.some((language) => language.id === 'jpn')).toBe(true);
      expect(source('src/utilities/image-ocr.ts')).toContain('preprocessOcrRgba');
    });
  });

  describe('Text to Speech', () => {
    const voices: SpeechVoiceOption[] = [
      { name: 'Default English', lang: 'en-US', voiceURI: 'en', default: true, localService: false },
      { name: 'Local Korean', lang: 'ko-KR', voiceURI: 'ko', default: false, localService: true },
    ];

    it('prefers a matching installed language voice and provides script hints', () => {
      expect(inferSpeechLanguageHint('안녕하세요')).toBe('ko-KR');
      expect(chooseBestVoice(voices, '', 'ko-KR')?.voiceURI).toBe('ko');
    });

    it('preserves stable source offsets for repeated sentence text', () => {
      const chunks = chunkTextForSpeech('Hello. Hello. Final text without punctuation');
      expect(chunks[0]).toMatchObject({ text: 'Hello.', charStart: 0, charEnd: 6 });
      expect(chunks[1]).toMatchObject({ text: 'Hello.', charStart: 7, charEnd: 13 });
      expect(chunks.at(-1)?.text).toContain('Final text without punctuation');
    });

    it('wires boundary progress and stale-session-safe playback into the UI', () => {
      const component = source('src/tools/text-to-speech/TextToSpeechTool.tsx');
      expect(component).toContain('utterance.onboundary');
      expect(component).toContain('sessionRef.current');
      expect(component).toContain('Speak Text');
    });
  });

  describe('Whiteboard', () => {
    const pathElement: BoardElement = {
      id: 'path', type: 'path', x: 0, y: 0, points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }],
      color: '#000', strokeWidth: 2, opacity: 1,
    };

    it('moves path geometry without corrupting its points', () => {
      const moved = translateBoardElement(pathElement, 10, 20);
      expect(moved.x).toBe(10);
      expect(moved.y).toBe(20);
      expect(moved.points).toEqual([{ x: 10, y: 20 }, { x: 60, y: 20 }, { x: 110, y: 20 }]);
    });

    it('simplifies redundant freehand points and round-trips versioned board state', () => {
      expect(simplifyBoardPath(pathElement.points!, 0.1)).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
      const raw = serializeBoardState({ version: 1, id: 'board', title: 'Test', elements: [pathElement], background: 'grid', updatedAt: 123 });
      expect(parseBoardState(raw)?.elements).toHaveLength(1);
      expect(parseBoardState('{"version":99,"elements":[]}')).toBeNull();
    });

    it('wires selection, persistence and keyboard editing into the board UI', () => {
      const component = source('src/tools/whiteboard/WhiteboardTool.tsx');
      expect(component).toContain('findTopmostElementAt');
      expect(component).toContain('localStorage.setItem');
      expect(component).toContain("event.key === 'Delete'");
      expect(component).toContain('Import board');
    });
  });

  describe('Meme Maker', () => {
    it('shrinks long captions until they fit both width and height constraints', () => {
      let size = 60;
      const layout = fitMemeTextLayout(
        'THIS IS A LONG CAPTION THAT MUST FIT A NARROW BOX',
        60,
        180,
        110,
        (next) => { size = next; },
        (value) => value.length * size * 0.58
      );
      expect(layout.fontSize).toBeLessThan(60);
      expect(layout.totalHeight).toBeLessThanOrEqual(110);
      expect(layout.lines.length).toBeGreaterThan(1);
    });

    it('exposes multiple movable caption layers with auto-fit export', () => {
      const component = source('src/tools/meme-maker/MemeMakerTool.tsx');
      expect(component).toContain('Add layer');
      expect(component).toContain('maxWidthPercent');
      expect(component).toContain('Auto-fit');
      expect(source('src/utilities/meme-maker.ts')).toContain('fitMemeTextLayout');
    });
  });

  describe('Animated GIF Maker', () => {
    it('builds an adaptive palette containing colors from the animation sample', () => {
      const samples: [number, number, number][] = [
        ...Array.from({ length: 40 }, () => [250, 10, 10] as [number, number, number]),
        ...Array.from({ length: 40 }, () => [10, 240, 20] as [number, number, number]),
        ...Array.from({ length: 40 }, () => [20, 30, 245] as [number, number, number]),
      ];
      const palette = generateAdaptivePalette(samples, 256);
      const redIndex = findClosestPaletteIndex(250, 10, 10, palette);
      expect(palette[redIndex][0]).toBeGreaterThan(200);
      expect(palette[redIndex][1]).toBeLessThan(80);
    });

    it('wires adaptive quantization, safe pixel-frame limits and per-frame delays', () => {
      expect(source('src/utilities/gif-maker.ts')).toContain('generateAdaptivePalette');
      const component = source('src/tools/gif-maker/GifMakerTool.tsx');
      expect(component).toContain('MAX_PIXEL_FRAMES');
      expect(component).toContain('Adaptive color quantization');
      expect(component).toContain('delayMs');
    });
  });

  describe('Video Toolkit', () => {
    it('normalizes trim ranges to the decoded source duration', () => {
      expect(normalizeVideoTrimRange(-4, 50, 10)).toEqual({ start: 0, end: 10, duration: 10 });
    });

    it('scales render bitrate and frame-rate caps with the requested quality', () => {
      const compact = calculateRecommendedVideoBitrate(1920, 1080, 30, 'compact');
      const high = calculateRecommendedVideoBitrate(1920, 1080, 30, 'high');
      expect(high).toBeGreaterThan(compact);
      expect(chooseVideoRenderFps(60, 'compact')).toBe(24);
      expect(chooseVideoRenderFps(60, 'balanced')).toBe(30);
      expect(chooseVideoRenderFps(60, 'high')).toBe(60);
    });

    it('uses decoded-frame scheduling, visibility protection, bitrate planning and full cleanup', () => {
      const component = source('src/tools/video-toolkit/VideoToolkitTool.tsx');
      expect(component).toContain('requestVideoFrameCallback');
      expect(component).toContain("'visibilitychange'");
      expect(component).toContain('calculateRecommendedVideoBitrate');
      expect(component).toContain('stopActiveStreams');
      expect(component).not.toContain('setInterval(() =>');
    });
  });
});
