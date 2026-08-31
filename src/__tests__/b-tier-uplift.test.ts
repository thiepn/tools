import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeRegexRisk, testRegex, type RegexFlags } from '../utilities/regex-tester';
import { getElementBoundingBox, isPointInsideElement, type BoardElement } from '../utilities/whiteboard';
import { buildConnectedBackgroundMask } from '../utilities/background-remover';
import { computeTextDiff } from '../utilities/text-diff';
import { calculateStitchDimensions, type StitchItem } from '../utilities/screenshot-stitcher';
import {
  foldIcsLine,
  generateIcsFile,
  type CalendarEventData,
} from '../utilities/calendar-event';
import { sharpenRgbaPixels } from '../utilities/document-scanner';
import {
  formatTranscriptToSrt,
  formatTranscriptToVtt,
  parseWhisperChunks,
  type TranscriptSegment,
} from '../utilities/speech-to-text';
import { wrapMemeText } from '../utilities/meme-maker';
import { chunkTextForSpeech, formatDurationSeconds } from '../utilities/text-to-speech';
import { calculatePrintSheetLayout } from '../utilities/id-photo-maker';

const DEFAULT_REGEX_FLAGS: RegexFlags = {
  global: true,
  ignoreCase: false,
  multiline: false,
  dotAll: false,
  unicode: false,
  sticky: false,
};

function source(pathFromRoot: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), pathFromRoot), 'utf8');
}

describe('B-tier uplift regressions', () => {
  describe('Image to Text / OCR', () => {
    it('keeps a warm language worker and exposes rerunnable OCR in the tool UI', () => {
      const utility = source('src/utilities/image-ocr.ts');
      const component = source('src/tools/image-to-text/ImageToTextTool.tsx');
      expect(utility).toContain('activeWorkerLanguage');
      expect(utility).toContain('getOrCreateWorker');
      expect(utility).toContain('Using warm OCR model');
      expect(component).toContain("'Run OCR again'");
      expect(component).toContain('Language data may download when first used');
    });
  });

  describe('Regex Tester', () => {
    it('flags nested quantified groups and blocks them on large synchronous input', () => {
      const risk = analyzeRegexRisk('(a+)+$');
      expect(risk.level).toBe('high');
      const result = testRegex('(a+)+$', DEFAULT_REGEX_FLAGS, `${'a'.repeat(25_000)}!`);
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/backtracking-heavy pattern blocked/i);
      expect(result.executionTimeMs).toBe(0);
    });

    it('keeps normal regex matching available', () => {
      const result = testRegex('item-(\\d+)', DEFAULT_REGEX_FLAGS, 'item-1 item-22 item-333');
      expect(result.isValid).toBe(true);
      expect(result.matchCount).toBe(3);
      expect(result.risk.level).toBe('low');
    });
  });

  describe('Whiteboard', () => {
    it('uses real ellipse geometry instead of the whole bounding rectangle', () => {
      const ellipse: BoardElement = {
        id: 'ellipse',
        type: 'ellipse',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        color: '#000000',
        strokeWidth: 2,
        opacity: 1,
      };
      expect(isPointInsideElement(50, 50, ellipse, 0)).toBe(true);
      expect(isPointInsideElement(5, 5, ellipse, 0)).toBe(false);
    });

    it('preserves exact geometric rectangle bounds', () => {
      const rectangle: BoardElement = {
        id: 'rect',
        type: 'rectangle',
        x: 100,
        y: 150,
        width: 200,
        height: 100,
        color: '#000000',
        strokeWidth: 8,
        opacity: 1,
      };
      expect(getElementBoundingBox(rectangle)).toEqual({
        minX: 100,
        minY: 150,
        maxX: 300,
        maxY: 250,
        width: 200,
        height: 100,
      });
    });
  });

  describe('Background Remover', () => {
    it('removes only matching background pixels connected to the image edge', () => {
      const width = 9;
      const height = 9;
      const rgba = new Uint8ClampedArray(width * height * 4);
      for (let pixel = 0; pixel < width * height; pixel++) {
        rgba[pixel * 4] = 255;
        rgba[pixel * 4 + 1] = 255;
        rgba[pixel * 4 + 2] = 255;
        rgba[pixel * 4 + 3] = 255;
      }
      for (let y = 3; y <= 5; y++) {
        for (let x = 3; x <= 5; x++) {
          const index = (y * width + x) * 4;
          rgba[index] = 0;
          rgba[index + 1] = 0;
          rgba[index + 2] = 0;
        }
      }
      // A white foreground hole surrounded by black pixels must stay foreground.
      const center = (4 * width + 4) * 4;
      rgba[center] = rgba[center + 1] = rgba[center + 2] = 255;

      const mask = buildConnectedBackgroundMask(rgba, width, height, 45);
      expect(mask[0]).toBe(1);
      expect(mask[3 * width + 3]).toBe(0);
      expect(mask[4 * width + 4]).toBe(0);
    });
  });

  describe('Text Diff Checker', () => {
    it('handles multi-thousand-line documents without an O(n*m) matrix', () => {
      const original = Array.from({ length: 1600 }, (_, index) => `line ${index}`);
      const revised = [...original];
      revised[800] = 'line 800 changed';
      const result = computeTextDiff(original.join('\n'), revised.join('\n'));
      expect(result.modifiedCount).toBe(1);
      expect(result.unchangedCount).toBe(1599);
      expect(result.similarityScore).toBeGreaterThan(99);
    });
  });

  describe('Screenshot Stitcher', () => {
    it('keeps horizontal overlap sizing based on image width', () => {
      const items: StitchItem[] = [
        { id: '1', file: {} as File, img: {} as HTMLImageElement, width: 500, height: 800, overlapPx: 0 },
        { id: '2', file: {} as File, img: {} as HTMLImageElement, width: 500, height: 700, overlapPx: 125 },
      ];
      expect(calculateStitchDimensions(items, 'horizontal', 0)).toEqual({ width: 875, height: 800 });
      const component = source('src/tools/screenshot-stitcher/ScreenshotStitcherTool.tsx');
      expect(component).toContain('estimateStitchOverlap');
      expect(component).toContain("direction === 'vertical' ? item.height : item.width");
    });
  });

  describe('Calendar Event Maker', () => {
    const allDayEvent: CalendarEventData = {
      title: 'Very long international planning event — ' + '한국어 일정 '.repeat(8),
      description: 'Planning notes',
      location: 'Cologne',
      url: '',
      startDate: '2026-09-15',
      startTime: '',
      endDate: '2026-09-15',
      endTime: '',
      isAllDay: true,
      timezone: 'UTC',
      reminderMinutes: 15,
      recurrence: 'NONE',
      organizerName: 'Dr. Doe, Jr.',
      organizerEmail: 'doe@example.com',
    };

    it('serializes inclusive UI all-day dates to exclusive RFC 5545 DTEND', () => {
      const ics = generateIcsFile(allDayEvent);
      expect(ics).toContain('DTSTART;VALUE=DATE:20260915');
      expect(ics).toContain('DTEND;VALUE=DATE:20260916');
      expect(ics).toContain('ORGANIZER;CN="Dr. Doe, Jr.":mailto:doe@example.com');
    });

    it('folds long UTF-8 ICS lines to RFC-safe octet lengths', () => {
      const ics = generateIcsFile(allDayEvent);
      for (const line of ics.split('\r\n')) {
        expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
      }
      expect(foldIcsLine(`SUMMARY:${'é'.repeat(80)}`).length).toBeGreaterThan(1);
    });
  });

  describe('Document Scanner', () => {
    it('actually sharpens RGB pixels while preserving alpha and borders', () => {
      const rgba = new Uint8ClampedArray(3 * 3 * 4);
      for (let pixel = 0; pixel < 9; pixel++) {
        rgba[pixel * 4] = 20;
        rgba[pixel * 4 + 1] = 20;
        rgba[pixel * 4 + 2] = 20;
        rgba[pixel * 4 + 3] = 200;
      }
      const center = (1 * 3 + 1) * 4;
      rgba[center] = rgba[center + 1] = rgba[center + 2] = 100;
      const sharpened = sharpenRgbaPixels(rgba, 3, 3);
      expect(sharpened[center]).toBe(255);
      expect(sharpened[center + 3]).toBe(200);
      expect(sharpened[0]).toBe(20);
    });
  });

  describe('Speech to Text', () => {
    const segments: TranscriptSegment[] = [
      { id: 'one', start: 0.125, end: 1.75, text: 'First subtitle.' },
      { id: 'two', start: 1.75, end: 4.005, text: 'Second subtitle.' },
    ];

    it('exports standards-compatible SRT and WebVTT timestamps', () => {
      expect(formatTranscriptToSrt(segments)).toContain('00:00:00,125 --> 00:00:01,750');
      const vtt = formatTranscriptToVtt(segments);
      expect(vtt.startsWith('WEBVTT')).toBe(true);
      expect(vtt).toContain('00:00:01.750 --> 00:00:04.005');
    });

    it('uses deterministic segment IDs and does not invent confidence', () => {
      const parsed = parseWhisperChunks([{ text: 'Hello', timestamp: [null, null] }], 1);
      expect(parsed).toEqual([{ id: 'seg-1', start: 0, end: 1, text: 'Hello' }]);
    });
  });

  describe('Meme Maker', () => {
    it('automatically wraps measured text while preserving explicit newlines', () => {
      const measure = (value: string) => value.length * 10;
      expect(wrapMemeText('one two three', 50, measure)).toEqual(['one', 'two', 'three']);
      expect(wrapMemeText('top line\nbottom', 100, measure)).toEqual(['top line', 'bottom']);
    });
  });

  describe('Barcode Studio', () => {
    it('uses one cached detector and throttles the camera recognition loop', () => {
      const component = source('src/tools/barcode-studio/BarcodeStudioTool.tsx');
      expect(component).toContain('detectorRef');
      expect(component).toContain('CAMERA_SCAN_INTERVAL_MS');
      expect(component.match(/new \(window as any\)\.BarcodeDetector/g)?.length).toBe(1);
      expect(component).toContain('detectionInFlightRef');
    });
  });

  describe('Text to Speech', () => {
    it('preserves final unpunctuated text and formats hour-long durations', () => {
      const input = 'First sentence. trailing text without punctuation';
      const chunks = chunkTextForSpeech(input, 160);
      expect(chunks.map((chunk) => chunk.text).join(' ')).toBe(input);
      expect(formatDurationSeconds(3665)).toBe('1:01:05');
    });

    it('splits a single oversized token instead of returning an unsafe huge chunk', () => {
      const chunks = chunkTextForSpeech('x'.repeat(250), 60);
      expect(chunks.length).toBeGreaterThan(3);
      expect(Math.max(...chunks.map((chunk) => chunk.text.length))).toBeLessThanOrEqual(60);
    });
  });

  describe('ID Photo Maker', () => {
    it('returns zero copies when the requested photo physically cannot fit', () => {
      const layout = calculatePrintSheetLayout(30, 30, 35, 45, { dpi: 300, marginMm: 0, gapMm: 0 });
      expect(layout.columns).toBe(0);
      expect(layout.rows).toBe(0);
      expect(layout.actualCopies).toBe(0);
      expect(layout.positions).toEqual([]);
    });

    it('centers a partial final print row instead of left-aligning it', () => {
      const layout = calculatePrintSheetLayout(210, 297, 35, 45, {
        dpi: 300,
        requestedCopies: 6,
        marginMm: 5,
        gapMm: 3,
      });
      expect(layout.columns).toBeGreaterThan(1);
      expect(layout.positions).toHaveLength(6);
      const last = layout.positions[5];
      const lastCenter = last.x + last.width / 2;
      expect(Math.abs(lastCenter - layout.sheetWidthPx / 2)).toBeLessThanOrEqual(1);
    });
  });
});
