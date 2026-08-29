import { describe, it, expect } from 'vitest';

// 31. Video Toolkit
import {
  calculateVideoOutputDimensions,
  calculateEffectiveDuration,
  formatVideoTime,
  formatVideoFileSize,
} from '../utilities/video-toolkit';

// 32. Document Scanner
import {
  orderQuadCorners,
  euclideanDistance,
  calculateWarpDimensions,
  detectDefaultCorners,
} from '../utilities/document-scanner';

// 33. Speech to Text
import {
  formatSpeechTimestamp,
  formatTranscriptToText,
  createTranscriptSegments,
  parseWhisperChunks,
  AVAILABLE_SPEECH_MODELS,
  SUPPORTED_LANGUAGES,
} from '../utilities/speech-to-text';
import {
  resampleAudioBufferTo16kMono,
  normalizeAudioFloat32,
} from '../utilities/speech-audio';

// 34. ZIP Manager
import {
  sanitizeZipPath,
  formatArchiveSize,
} from '../utilities/zip-manager';

// 35. Screenshot Stitcher
import {
  calculateStitchDimensions,
  StitchItem,
} from '../utilities/screenshot-stitcher';

// 36. Photo Metadata / EXIF
import {
  parsePhotoMetadata,
} from '../utilities/photo-metadata';

// 37. GIF Maker
import {
  generateStandardPalette,
  findClosestPaletteIndex,
} from '../utilities/gif-maker';

// 38. Batch Renamer
import {
  splitFilename,
  applyRenamingRules,
  DEFAULT_RENAMER_RULES,
  RenamerRules,
} from '../utilities/batch-renamer';

// 39. Text Diff
import {
  computeTextDiff,
  computeWordDiff,
} from '../utilities/text-diff';

// 40. ID Photo Maker
import {
  mmToPixels,
  inchToPixels,
  pixelsToMm,
  pixelsToInches,
  calculatePrintSheetLayout,
  ID_PHOTO_PRESETS,
  PRINT_SHEET_PRESETS,
} from '../utilities/id-photo-maker';

describe('Phase 4 Tools Test Suite (Tools 31–40)', () => {
  // ==========================================
  // Tool 31: Video Toolkit
  // ==========================================
  describe('Tool 31: Video Toolkit', () => {
    it('calculates output dimensions for various resize modes correctly', () => {
      const orig = { width: 1920, height: 1080 };

      const dims720p = calculateVideoOutputDimensions(orig.width, orig.height, {
        rotation: 0,
        resizeMode: '720p',
      });
      expect(dims720p.height).toBe(720);
      expect(dims720p.width).toBe(1280);

      const dims1080p = calculateVideoOutputDimensions(orig.width, orig.height, {
        rotation: 0,
        resizeMode: '1080p',
      });
      expect(dims1080p.height).toBe(1080);
      expect(dims1080p.width).toBe(1920);

      const dims50 = calculateVideoOutputDimensions(orig.width, orig.height, {
        rotation: 0,
        resizeMode: '50%',
      });
      expect(dims50.width).toBe(960);
      expect(dims50.height).toBe(540);
    });

    it('swaps width and height when rotated 90 or 270 degrees', () => {
      const orig = { width: 1920, height: 1080 };
      const dimsRot90 = calculateVideoOutputDimensions(orig.width, orig.height, {
        rotation: 90,
        resizeMode: 'original',
      });
      expect(dimsRot90.width).toBe(1080);
      expect(dimsRot90.height).toBe(1920);
    });

    it('calculates effective duration with trim boundaries and speed scaling', () => {
      // 10 seconds at 1x = 10s
      expect(calculateEffectiveDuration(5, 15, 1)).toBe(10);
      // 10 seconds at 2x = 5s
      expect(calculateEffectiveDuration(5, 15, 2)).toBe(5);
      // 10 seconds at 0.5x = 20s
      expect(calculateEffectiveDuration(5, 15, 0.5)).toBe(20);
    });

    it('formats video time and byte size correctly', () => {
      expect(formatVideoTime(65)).toBe('01:05');
      expect(formatVideoTime(3665)).toBe('61:05');
      expect(formatVideoFileSize(1048576)).toBe('1 MB');
    });
  });

  // ==========================================
  // Tool 32: Document Scanner
  // ==========================================
  describe('Tool 32: Document Scanner', () => {
    it('orders quad corners into TL, TR, BR, BL clockwise orientation', () => {
      const corners = [
        { x: 100, y: 100 }, // BR
        { x: 10, y: 100 },  // BL
        { x: 100, y: 10 },  // TR
        { x: 10, y: 10 },   // TL
      ];
      const ordered = orderQuadCorners(corners);
      expect(ordered[0]).toEqual({ x: 10, y: 10 }); // TL
      expect(ordered[1]).toEqual({ x: 100, y: 10 }); // TR
      expect(ordered[2]).toEqual({ x: 100, y: 100 }); // BR
      expect(ordered[3]).toEqual({ x: 10, y: 100 }); // BL
    });

    it('calculates euclidean distance and warp bounding dimensions', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 300, y: 400 };
      expect(euclideanDistance(p1, p2)).toBe(500);

      const quad: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 300 },
        { x: 0, y: 300 },
      ];
      const warpDims = calculateWarpDimensions(quad);
      expect(warpDims.width).toBe(200);
      expect(warpDims.height).toBe(300);
    });

    it('detects default margin corners correctly', () => {
      const corners = detectDefaultCorners(1000, 800);
      expect(corners[0].x).toBe(80);
      expect(corners[0].y).toBe(64);
      expect(corners[2].x).toBe(920);
      expect(corners[2].y).toBe(736);
    });
  });

  // ==========================================
  // Tool 33: Speech to Text Transcriber
  // ==========================================
  describe('Tool 33: Speech to Text Transcriber', () => {
    it('formats speech timestamps to MM:SS and HH:MM:SS format', () => {
      expect(formatSpeechTimestamp(15)).toBe('00:15');
      expect(formatSpeechTimestamp(125)).toBe('02:05');
      expect(formatSpeechTimestamp(3665)).toBe('01:01:05');
    });

    it('creates transcript segments from sentence text with durations', () => {
      const text = 'Hello world. How are you today? We are testing Tiny Tools.';
      const segments = createTranscriptSegments(text, 12);
      expect(segments.length).toBe(3);
      expect(segments[0].text).toBe('Hello world.');
      expect(segments[2].end).toBe(12);
    });

    it('formats segments with timestamps for text export', () => {
      const segs = [
        { id: '1', start: 0, end: 4.5, text: 'First segment.' },
        { id: '2', start: 4.5, end: 9.0, text: 'Second segment.' },
      ];
      const textWithTime = formatTranscriptToText(segs, true);
      expect(textWithTime).toContain('[00:00 - 00:04] First segment.');
      expect(textWithTime).toContain('[00:04 - 00:09] Second segment.');

      const plainText = formatTranscriptToText(segs, false);
      expect(plainText).toBe('First segment. Second segment.');
    });

    it('parses raw Whisper timestamped chunks into typed segments', () => {
      const chunks = [
        { text: 'Hello everyone welcome to the stream', timestamp: [0, 3.2] as [number, number] },
        { text: 'Today we will discuss local privacy AI', timestamp: [3.2, 7.8] as [number, number] },
      ];
      const segments = parseWhisperChunks(chunks, 10);
      expect(segments.length).toBe(2);
      expect(segments[0].start).toBe(0);
      expect(segments[0].end).toBe(3.2);
      expect(segments[0].text).toBe('Hello everyone welcome to the stream');
      expect(segments[1].start).toBe(3.2);
      expect(segments[1].end).toBe(7.8);
    });

    it('has local Whisper models configured with correct size metadata', () => {
      expect(AVAILABLE_SPEECH_MODELS.length).toBeGreaterThanOrEqual(3);
      const tinyEn = AVAILABLE_SPEECH_MODELS.find((m) => m.id === 'whisper-tiny-en');
      expect(tinyEn).toBeDefined();
      expect(tinyEn?.repo).toBe('onnx-community/whisper-tiny.en');
      expect(tinyEn?.approxDownloadMB).toBe(39);

      const tinyMulti = AVAILABLE_SPEECH_MODELS.find((m) => m.id === 'whisper-tiny-multi');
      expect(tinyMulti).toBeDefined();
      expect(tinyMulti?.multilingual).toBe(true);
    });

    it('resamples audio buffer and mixes multi-channel to 16kHz mono', () => {
      // Mock an AudioBuffer with 2 channels at 44.1kHz
      const origSampleRate = 44100;
      const length = 44100; // 1 second
      const ch1 = new Float32Array(length).fill(0.5);
      const ch2 = new Float32Array(length).fill(0.5);

      const mockAudioBuffer = {
        numberOfChannels: 2,
        length,
        sampleRate: origSampleRate,
        duration: 1,
        getChannelData: (ch: number) => (ch === 0 ? ch1 : ch2),
      } as unknown as AudioBuffer;

      const resampled = resampleAudioBufferTo16kMono(mockAudioBuffer, 16000);
      expect(resampled.length).toBe(16000);
      expect(resampled[0]).toBeCloseTo(0.5, 2);
    });

    it('normalizes and clamps audio Float32 samples safely', () => {
      const clipped = new Float32Array([2.0, -2.0, 0.5, -0.5]);
      const normalized = normalizeAudioFloat32(clipped);
      expect(normalized[0]).toBe(1.0);
      expect(normalized[1]).toBe(-1.0);
      expect(normalized[2]).toBe(0.25);
    });

    it('has supported languages registered', () => {
      expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(10);
      expect(SUPPORTED_LANGUAGES.some((l) => l.code === 'en')).toBe(true);
    });
  });

  // ==========================================
  // Tool 34: ZIP Manager & Security
  // ==========================================
  describe('Tool 34: ZIP Manager & Path Traversal Security', () => {
    it('sanitizes zip file paths and eliminates traversal tokens (../)', () => {
      expect(sanitizeZipPath('../../../etc/passwd')).toBe('etc/passwd');
      expect(sanitizeZipPath('folder/../../secret.txt')).toBe('secret.txt');
      expect(sanitizeZipPath('/var/log/app.log')).toBe('var/log/app.log');
      expect(sanitizeZipPath('subfolder\\nested\\file.png')).toBe('subfolder/nested/file.png');
      expect(sanitizeZipPath('./folder/./doc.pdf')).toBe('folder/doc.pdf');
    });

    it('formats archive byte sizes cleanly', () => {
      expect(formatArchiveSize(0)).toBe('0 B');
      expect(formatArchiveSize(2048)).toBe('2 KB');
      expect(formatArchiveSize(5242880)).toBe('5 MB');
    });
  });

  // ==========================================
  // Tool 35: Screenshot Stitcher
  // ==========================================
  describe('Tool 35: Screenshot Stitcher', () => {
    it('calculates vertical stitched dimensions subtracting overlap px', () => {
      const mockItems: StitchItem[] = [
        { id: '1', file: new File([], 's1.png'), img: {} as any, width: 800, height: 600, overlapPx: 0 },
        { id: '2', file: new File([], 's2.png'), img: {} as any, width: 800, height: 600, overlapPx: 100 },
        { id: '3', file: new File([], 's3.png'), img: {} as any, width: 800, height: 600, overlapPx: 150 },
      ];

      const dims = calculateStitchDimensions(mockItems, 'vertical', 0);
      expect(dims.width).toBe(800);
      // Total height = 600 + (600 - 100) + (600 - 150) = 600 + 500 + 450 = 1550
      expect(dims.height).toBe(1550);
    });

    it('calculates horizontal stitched dimensions correctly', () => {
      const mockItems: StitchItem[] = [
        { id: '1', file: new File([], 's1.png'), img: {} as any, width: 500, height: 800, overlapPx: 0 },
        { id: '2', file: new File([], 's2.png'), img: {} as any, width: 500, height: 800, overlapPx: 50 },
      ];

      const dims = calculateStitchDimensions(mockItems, 'horizontal', 0);
      expect(dims.width).toBe(950);
      expect(dims.height).toBe(800);
    });
  });

  // ==========================================
  // Tool 36: EXIF & Photo Metadata Cleaner
  // ==========================================
  describe('Tool 36: EXIF & Photo Metadata Cleaner', () => {
    it('correctly handles non-JPEG or empty buffers gracefully', () => {
      const emptyBuffer = new ArrayBuffer(16);
      const parsed = parsePhotoMetadata(emptyBuffer);
      expect(parsed.hasSensitiveData).toBe(false);
      expect(parsed.sensitiveReasons).toHaveLength(0);
    });
  });

  // ==========================================
  // Tool 37: Animated GIF Maker
  // ==========================================
  describe('Tool 37: Animated GIF Maker', () => {
    it('generates standard 256 color web-safe and grayscale palette', () => {
      const palette = generateStandardPalette();
      expect(palette.length).toBe(256);
      expect(palette[0]).toEqual([0, 0, 0]); // Black
      expect(palette[215]).toEqual([255, 255, 255]); // White
    });

    it('quantizes RGB values to closest standard palette index', () => {
      const palette = generateStandardPalette();
      const blackIdx = findClosestPaletteIndex(0, 0, 0, palette);
      expect(blackIdx).toBe(0);

      const redIdx = findClosestPaletteIndex(255, 0, 0, palette);
      expect(redIdx).toBe(180); // 5 * 36 = 180
    });
  });

  // ==========================================
  // Tool 38: Batch File Renamer
  // ==========================================
  describe('Tool 38: Batch File Renamer', () => {
    it('splits filename and extension correctly', () => {
      expect(splitFilename('report.pdf')).toEqual({ base: 'report', ext: 'pdf' });
      expect(splitFilename('archive.tar.gz')).toEqual({ base: 'archive.tar', ext: 'gz' });
      expect(splitFilename('noextension')).toEqual({ base: 'noextension', ext: '' });
    });

    it('applies prefix, suffix, and find-and-replace rules', () => {
      const files = [
        { id: '1', file: new File([], 'IMG_001.JPG') },
        { id: '2', file: new File([], 'IMG_002.JPG') },
      ];

      const rules: RenamerRules = {
        ...DEFAULT_RENAMER_RULES,
        findText: 'IMG_',
        replaceText: 'photo_',
        suffix: '_final',
      };

      const result = applyRenamingRules(files, rules);
      expect(result[0].newName).toBe('photo_001_final');
      expect(result[0].newExt).toBe('JPG');
      expect(result[1].newName).toBe('photo_002_final');
    });

    it('applies sequential numbering and space replacement', () => {
      const files = [
        { id: '1', file: new File([], 'my vacation photo.png') },
        { id: '2', file: new File([], 'my vacation photo 2.png') },
      ];

      const rules: RenamerRules = {
        ...DEFAULT_RENAMER_RULES,
        replaceSpacesWith: 'dash',
        sequentialNumbering: true,
        numberingStart: 1,
        numberingPadding: 3,
        numberingPosition: 'start',
      };

      const result = applyRenamingRules(files, rules);
      expect(result[0].newName).toBe('001_my-vacation-photo');
      expect(result[1].newName).toBe('002_my-vacation-photo-2');
    });

    it('detects and auto-resolves name collisions', () => {
      const files = [
        { id: '1', file: new File([], 'a.txt') },
        { id: '2', file: new File([], 'b.txt') },
      ];

      const rules: RenamerRules = {
        ...DEFAULT_RENAMER_RULES,
        findText: '^.*$',
        replaceText: 'duplicate',
        useRegex: true,
        autoResolveCollisions: true,
      };

      const result = applyRenamingRules(files, rules);
      expect(result[0].newName).toBe('duplicate');
      expect(result[1].newName).toBe('duplicate-1');
    });
  });

  // ==========================================
  // Tool 39: Text Diff Checker
  // ==========================================
  describe('Tool 39: Text Diff Checker', () => {
    it('detects line additions, removals, and modifications', () => {
      const orig = 'Apple\nBanana\nCherry';
      const rev = 'Apple\nBlueberry\nCherry\nDate';

      const diff = computeTextDiff(orig, rev);
      expect(diff.modifiedCount).toBe(1); // Banana -> Blueberry
      expect(diff.addedCount).toBe(1); // Date
      expect(diff.unchangedCount).toBe(2); // Apple, Cherry
      expect(diff.similarityScore).toBeGreaterThan(0);
    });

    it('respects ignoreCase and ignoreWhitespace options', () => {
      const orig = 'HELLO  WORLD';
      const rev = 'hello world';

      const diffStrict = computeTextDiff(orig, rev, {
        ignoreCase: false,
        ignoreWhitespace: false,
        ignoreBlankLines: false,
      });
      expect(diffStrict.unchangedCount).toBe(0);

      const diffLax = computeTextDiff(orig, rev, {
        ignoreCase: true,
        ignoreWhitespace: true,
        ignoreBlankLines: false,
      });
      expect(diffLax.unchangedCount).toBe(1);
    });

    it('computes word-level diff tokens', () => {
      const tokens = computeWordDiff('The quick brown fox', 'The fast brown fox');
      expect(tokens.some((t) => t.text === 'quick' && t.removed)).toBe(true);
      expect(tokens.some((t) => t.text === 'fast' && t.added)).toBe(true);
    });
  });

  // ==========================================
  // Tool 40: Passport & ID Photo Maker
  // ==========================================
  describe('Tool 40: Passport & ID Photo Maker', () => {
    it('converts physical millimeters and inches to pixels accurately at 300 DPI', () => {
      // 25.4 mm = 1 inch = 300 px at 300 DPI
      expect(mmToPixels(25.4, 300)).toBe(300);
      expect(inchToPixels(1, 300)).toBe(300);
      expect(inchToPixels(2, 300)).toBe(600); // 2x2 inch US Passport = 600x600 px

      // 35x45 mm EU standard at 300 DPI
      expect(mmToPixels(35, 300)).toBe(413);
      expect(mmToPixels(45, 300)).toBe(531);

      // Reverse conversions
      expect(pixelsToInches(300, 300)).toBe(1);
      expect(pixelsToMm(300, 300)).toBe(25.4);
    });

    it('calculates print sheet layout and maximum copies on 4x6 photo sheet', () => {
      // 4x6 inch = 152.4 x 101.6 mm sheet
      // 35x45 mm photo with 5mm margin and 3mm gap
      const sheet = PRINT_SHEET_PRESETS[0];
      const layout = calculatePrintSheetLayout(sheet.widthMm, sheet.heightMm, 35, 45, {
        dpi: 300,
        requestedCopies: 6,
        marginMm: 5,
        gapMm: 3,
      });

      expect(layout.columns).toBeGreaterThanOrEqual(2);
      expect(layout.rows).toBeGreaterThanOrEqual(1);
      expect(layout.actualCopies).toBeLessThanOrEqual(layout.maxCopies);
      expect(layout.positions.length).toBe(layout.actualCopies);
    });

    it('has standard passport presets registered', () => {
      expect(ID_PHOTO_PRESETS.length).toBeGreaterThanOrEqual(5);
      const eu = ID_PHOTO_PRESETS.find((p) => p.id === 'eu-standard');
      expect(eu?.widthMm).toBe(35);
      expect(eu?.heightMm).toBe(45);

      const us = ID_PHOTO_PRESETS.find((p) => p.id === 'us-passport');
      expect(us?.widthMm).toBeCloseTo(50.8, 1);
    });
  });
});
