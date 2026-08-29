import { describe, it, expect } from 'vitest';
import {
  calculateEanCheckDigit,
  calculateEan8CheckDigit,
  validateBarcodePayload,
  BARCODE_FORMATS,
} from '../utilities/barcode';
import {
  calculateWatermarkCoordinates,
  DEFAULT_WATERMARK_CONFIG,
} from '../utilities/watermark';
import {
  calculateSpeakingStats,
  calculateScrollStep,
} from '../utilities/teleprompter';
import {
  rgbToHex,
  hexToRgb,
  rgbToHsl,
  hslToRgb,
  getContrastRatio,
  sortExtractedPalette,
  generateHarmonies,
  formatAsCssVariables,
  ExtractedColor,
} from '../utilities/palette-extractor';
import {
  escapeIcsText,
  formatIcsUtcTimestamp,
  validateCalendarEvent,
  generateIcsFile,
  CalendarEventData,
} from '../utilities/calendar-event';
import {
  calculateTapTempo,
  TIME_SIGNATURES,
  SUBDIVISION_FACTORS,
} from '../utilities/metronome';
import {
  getPresetTextBoxes,
} from '../utilities/meme-maker';
import {
  calculateFileSha256,
  findDuplicateFiles,
  formatDuplicateReportText,
  ScannedFileItem,
} from '../utilities/duplicate-finder';
import {
  getElementBoundingBox,
  isPointInsideElement,
  BoardElement,
} from '../utilities/whiteboard';

describe('Phase 5 Tools - Core Utilities & Logic', () => {
  // 1. Tool 41: Barcode Generator & Scanner
  describe('Tool 41: Barcode Studio', () => {
    it('calculates standard EAN-13 check digit correctly', () => {
      // 590123412345 -> check digit is 7
      const check = calculateEanCheckDigit('590123412345');
      expect(check).toBe(7);

      // 400638133393 -> check digit is 1
      const check2 = calculateEanCheckDigit('400638133393');
      expect(check2).toBe(1);
    });

    it('calculates EAN-8 check digit correctly', () => {
      // 9638507 -> check digit is 4
      const check = calculateEan8CheckDigit('9638507');
      expect(check).toBe(4);
    });

    it('validates and auto-completes EAN-13 payload', () => {
      const valid12 = validateBarcodePayload('EAN13', '590123412345');
      expect(valid12.isValid).toBe(true);
      expect(valid12.normalizedValue).toBe('5901234123457');

      const invalidCheck = validateBarcodePayload('EAN13', '5901234123450');
      expect(invalidCheck.isValid).toBe(false);
      expect(invalidCheck.error).toContain('Invalid EAN-13 check digit');
    });

    it('validates Code 39 characters strictly', () => {
      const valid = validateBarcodePayload('CODE39', 'abc-123');
      expect(valid.isValid).toBe(true);
      expect(valid.normalizedValue).toBe('ABC-123');

      const invalid = validateBarcodePayload('CODE39', 'ITEM@#');
      expect(invalid.isValid).toBe(false);
    });

    it('has all required 1D barcode formats registered', () => {
      expect(BARCODE_FORMATS.length).toBeGreaterThanOrEqual(6);
      expect(BARCODE_FORMATS.some((f) => f.id === 'CODE128')).toBe(true);
      expect(BARCODE_FORMATS.some((f) => f.id === 'EAN13')).toBe(true);
      expect(BARCODE_FORMATS.some((f) => f.id === 'UPCA')).toBe(true);
    });
  });

  // 2. Tool 42: Watermark Maker
  describe('Tool 42: Watermark Maker', () => {
    it('calculates 9-preset coordinate positions accurately', () => {
      const canvasW = 1000;
      const canvasH = 800;
      const elW = 200;
      const elH = 50;
      const pad = 20;

      const topLeft = calculateWatermarkCoordinates(canvasW, canvasH, elW, elH, 'top-left', pad);
      expect(topLeft).toEqual({ x: 20, y: 20 });

      const center = calculateWatermarkCoordinates(canvasW, canvasH, elW, elH, 'center', pad);
      expect(center).toEqual({ x: 400, y: 375 });

      const bottomRight = calculateWatermarkCoordinates(canvasW, canvasH, elW, elH, 'bottom-right', pad);
      expect(bottomRight).toEqual({ x: 780, y: 730 });
    });

    it('has safe default watermark configuration', () => {
      expect(DEFAULT_WATERMARK_CONFIG.opacity).toBeGreaterThan(0);
      expect(DEFAULT_WATERMARK_CONFIG.opacity).toBeLessThanOrEqual(1);
      expect(DEFAULT_WATERMARK_CONFIG.text).toBe('CONFIDENTIAL');
    });
  });

  // 3. Tool 44: Whiteboard & Sketchpad
  describe('Tool 44: Whiteboard', () => {
    it('calculates element bounding box accurately', () => {
      const rectEl: BoardElement = {
        id: '1',
        type: 'rectangle',
        x: 100,
        y: 150,
        width: 200,
        height: 100,
        color: '#000',
        strokeWidth: 2,
        opacity: 1,
      };
      const box = getElementBoundingBox(rectEl);
      expect(box.minX).toBe(100);
      expect(box.minY).toBe(150);
      expect(box.width).toBe(200);
      expect(box.height).toBe(100);
    });

    it('hit-tests points inside bounding boxes', () => {
      const textEl: BoardElement = {
        id: '2',
        type: 'text',
        x: 50,
        y: 50,
        width: 100,
        height: 40,
        color: '#000',
        strokeWidth: 1,
        opacity: 1,
        text: 'Notes',
      };
      expect(isPointInsideElement(60, 60, textEl)).toBe(true);
      expect(isPointInsideElement(200, 200, textEl)).toBe(false);
    });
  });

  // 4. Tool 45: Teleprompter
  describe('Tool 45: Teleprompter', () => {
    it('calculates speaking duration and word count accurately', () => {
      const script = 'One two three four five six seven eight nine ten.';
      const stats = calculateSpeakingStats(script, 120); // 120 words per minute -> 2 words/sec
      expect(stats.wordCount).toBe(10);
      expect(stats.estimatedSeconds).toBe(5);
      expect(stats.formattedDuration).toBe('5s');
    });

    it('calculates scroll step velocity cleanly', () => {
      const stepLow = calculateScrollStep(10);
      const stepHigh = calculateScrollStep(90);
      expect(stepLow).toBeGreaterThan(0.2);
      expect(stepHigh).toBeGreaterThan(stepLow);
    });
  });

  // 5. Tool 46: Color Palette Extractor
  describe('Tool 46: Color Palette Extractor', () => {
    it('converts RGB <-> HEX <-> HSL bidirectionally', () => {
      const hex = rgbToHex(255, 0, 0);
      expect(hex).toBe('#ff0000');

      const rgb = hexToRgb('#00ff00');
      expect(rgb).toEqual({ r: 0, g: 255, b: 0 });

      const hsl = rgbToHsl(0, 0, 255);
      expect(hsl.h).toBe(240);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);

      const backRgb = hslToRgb(240, 100, 50);
      expect(backRgb.b).toBe(255);
    });

    it('calculates WCAG contrast ratio accurately', () => {
      // Black on White -> 21:1
      const ratio = getContrastRatio('#000000', '#ffffff');
      expect(ratio).toBeCloseTo(21.0, 1);

      // White on White -> 1:1
      const ratioSame = getContrastRatio('#ffffff', '#ffffff');
      expect(ratioSame).toBe(1.0);
    });

    it('generates harmonies for base color', () => {
      const harmonies = generateHarmonies('#3b82f6');
      expect(harmonies.length).toBe(4);
      expect(harmonies.find((h) => h.type === 'complementary')?.colors.length).toBe(2);
      expect(harmonies.find((h) => h.type === 'triadic')?.colors.length).toBe(3);
    });

    it('sorts palette by brightness and hue', () => {
      const mockColors: ExtractedColor[] = [
        { hex: '#ffffff', r: 255, g: 255, b: 255, h: 0, s: 0, l: 100, dominancePercent: 30 },
        { hex: '#000000', r: 0, g: 0, b: 0, h: 0, s: 0, l: 0, dominancePercent: 70 },
      ];
      const sortedByBrightness = sortExtractedPalette(mockColors, 'brightness');
      expect(sortedByBrightness[0].hex).toBe('#ffffff');

      const sortedByDominance = sortExtractedPalette(mockColors, 'dominance');
      expect(sortedByDominance[0].hex).toBe('#000000');
    });

    it('formats palette as CSS variables', () => {
      const mockColors: ExtractedColor[] = [
        { hex: '#ff0000', r: 255, g: 0, b: 0, h: 0, s: 100, l: 50, dominancePercent: 100 },
      ];
      const css = formatAsCssVariables(mockColors);
      expect(css).toContain(':root {');
      expect(css).toContain('--color-1: #ff0000');
    });
  });

  // 6. Tool 47: Calendar Event / ICS Maker
  describe('Tool 47: Calendar Event Maker', () => {
    it('escapes ICS special characters per RFC 5545', () => {
      const raw = 'Meeting, with Team; Project \\ Launch\nNotes';
      const escaped = escapeIcsText(raw);
      expect(escaped).toBe('Meeting\\, with Team\\; Project \\\\ Launch\\nNotes');
    });

    it('validates event dates and times', () => {
      const invalidEvent: CalendarEventData = {
        title: '',
        description: '',
        location: '',
        url: '',
        startDate: '2026-09-01',
        startTime: '14:00',
        endDate: '2026-09-01',
        endTime: '12:00', // End before start
        isAllDay: false,
        timezone: 'UTC',
        reminderMinutes: 15,
        recurrence: 'NONE',
      };
      const val = validateCalendarEvent(invalidEvent);
      expect(val.isValid).toBe(false);
      expect(val.errors.some((e) => e.includes('Event title'))).toBe(true);
      expect(val.errors.some((e) => e.includes('End date/time cannot be earlier'))).toBe(true);
    });

    it('generates valid RFC 5545 .ics text with VEVENT and VALARM', () => {
      const validEvent: CalendarEventData = {
        title: 'Strategy Review',
        description: 'Quarterly team roadmap meeting',
        location: 'Room 402',
        url: 'https://example.com/meeting',
        startDate: '2026-09-15',
        startTime: '10:00',
        endDate: '2026-09-15',
        endTime: '11:30',
        isAllDay: false,
        timezone: 'America/New_York',
        reminderMinutes: 30,
        recurrence: 'WEEKLY',
        repeatCount: 4,
      };

      const ics = generateIcsFile(validEvent);
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:Strategy Review');
      expect(ics).toContain('DESCRIPTION:Quarterly team roadmap meeting');
      expect(ics).toContain('LOCATION:Room 402');
      expect(ics).toContain('RRULE:FREQ=WEEKLY;COUNT=4');
      expect(ics).toContain('BEGIN:VALARM');
      expect(ics).toContain('TRIGGER:-PT30M');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('END:VCALENDAR');
    });
  });

  // 7. Tool 48: Metronome & Tap Tempo
  describe('Tool 48: Metronome & Tap Tempo', () => {
    it('calculates BPM accurately from steady tap intervals', () => {
      // 500ms intervals = 120 BPM
      const taps = [1000, 1500, 2000, 2500, 3000];
      const res = calculateTapTempo(taps);
      expect(res.bpm).toBe(120);
      expect(res.tapCount).toBe(5);
    });

    it('filters out outlier tap spikes', () => {
      // 600ms steady with one accidental fast tap
      const taps = [1000, 1600, 2200, 2400, 3000, 3600];
      const res = calculateTapTempo(taps);
      expect(res.bpm).toBeGreaterThan(95);
      expect(res.bpm).toBeLessThan(105);
    });

    it('has all common time signatures and subdivisions', () => {
      expect(TIME_SIGNATURES['4/4'].beatsPerMeasure).toBe(4);
      expect(TIME_SIGNATURES['3/4'].beatsPerMeasure).toBe(3);
      expect(TIME_SIGNATURES['6/8'].beatsPerMeasure).toBe(6);
      expect(SUBDIVISION_FACTORS.triplet).toBe(3);
      expect(SUBDIVISION_FACTORS.sixteenth).toBe(4);
    });
  });

  // 8. Tool 49: Duplicate File Finder
  describe('Tool 49: Duplicate File Finder', () => {
    it('detects duplicate files by SHA-256 hash', async () => {
      const file1 = new File(['duplicate content test string'], 'file1.txt', { type: 'text/plain' });
      const file2 = new File(['duplicate content test string'], 'file2.txt', { type: 'text/plain' });
      const file3 = new File(['unique different content string'], 'file3.txt', { type: 'text/plain' });

      const items: ScannedFileItem[] = [
        { id: '1', name: file1.name, size: file1.size, type: file1.type, lastModified: 1000, fileObject: file1 },
        { id: '2', name: file2.name, size: file2.size, type: file2.type, lastModified: 2000, fileObject: file2 },
        { id: '3', name: file3.name, size: file3.size, type: file3.type, lastModified: 3000, fileObject: file3 },
      ];

      const report = await findDuplicateFiles(items);
      expect(report.totalFilesScanned).toBe(3);
      expect(report.duplicateGroups.length).toBe(1);
      expect(report.duplicateGroups[0].files.length).toBe(2);
      expect(report.totalDuplicateFiles).toBe(1);
      expect(report.totalReclaimableBytes).toBe(file1.size);

      const text = formatDuplicateReportText(report);
      expect(text).toContain('=== Tiny Tools Duplicate File Report ===');
      expect(text).toContain('file1.txt');
      expect(text).toContain('file2.txt');
    });
  });

  // 9. Tool 50: Meme & Caption Maker
  describe('Tool 50: Meme & Caption Maker', () => {
    it('creates classic top & bottom text boxes for meme preset', () => {
      const boxes = getPresetTextBoxes('top-bottom');
      expect(boxes.length).toBe(2);
      expect(boxes[0].text).toBe('TOP TEXT');
      expect(boxes[1].text).toBe('BOTTOM TEXT');
      expect(boxes[0].strokeWidth).toBeGreaterThan(0);
    });

    it('creates quote layout preset with serif font', () => {
      const boxes = getPresetTextBoxes('center-quote');
      expect(boxes.length).toBe(1);
      expect(boxes[0].fontFamily).toContain('Georgia');
    });
  });
});
