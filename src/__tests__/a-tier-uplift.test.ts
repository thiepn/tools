import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHumanNumber } from '../utilities/human-number';
import { calculatePercentDifference, parseNumberInput } from '../utilities/percentage-calculator';
import { evaluateProducts, parseFlexibleNumber } from '../utilities/unit-price';
import { calculateOriginalPriceFromDiscount, roundFinancial } from '../utilities/discount-vat';
import { resolveDateInZone } from '../utilities/time-zone-converter';
import { convertCase, splitIntoWords, toTitleCase } from '../utilities/case-converter';
import { parseCulinaryAmount, parseRawRecipeText } from '../utilities/recipe-scaler';
import { calculateFileSampleSha256, findDuplicateFiles, type ScannedFileItem } from '../utilities/duplicate-finder';
import { applyRenamingRules, DEFAULT_RENAMER_RULES, sanitizeFilenameComponent } from '../utilities/batch-renamer';
import { filterChecklistItems, sanitizeChecklistStore } from '../utilities/checklist';
import { sanitizeNotepadStore, searchNotes, type NoteDoc } from '../utilities/quick-notepad';
import { calculateFit, simplifyRatio } from '../utilities/aspect-ratio-calculator';
import { addSubtractTime, calculateBusinessDays } from '../utilities/date-calculator';
import { base64UrlToUtf8, buildQueryString, parseQueryString, utf8ToBase64Url } from '../utilities/encoding-tools';
import { calculateRotatedBounds, clampRotatedWatermarkCenter } from '../utilities/watermark';
import { calculateImagePlacement } from '../utilities/image-collage';
import { calculateScrollDelta } from '../utilities/teleprompter';
import { getReadableTextColor, hexToRgb, mergeSimilarExtractedColors, type ExtractedColor } from '../utilities/palette-extractor';
import { normalizeAnnotationRect } from '../utilities/image-annotator';
import { extractWaveformPeaks } from '../utilities/audio-recorder';
import { createZipArchive, parseZipArchive, type PendingZipFile } from '../utilities/zip-manager';
import { getCanvasContentBounds } from '../utilities/signature';
import { calculateBeatIntervalMs, calculateTapTempo } from '../utilities/metronome';
import { calculateElapsedRecordingSeconds, formatByteSize, generateRecordingFilename } from '../utilities/screen-recorder';
import JSZip from 'jszip';

function source(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

function makeFile(content: BlobPart[], name: string, type = 'application/octet-stream'): File {
  return new File(content, name, { type, lastModified: 1_700_000_000_000 });
}

describe('A-tier uplift regressions', () => {
  describe('Percentage Calculator', () => {
    it('accepts common European and international pasted number formats', () => {
      expect(parseNumberInput('€1.234,56')).toBe(1234.56);
      expect(parseNumberInput('1,234.56')).toBe(1234.56);
      expect(parseNumberInput('12,5%')).toBe(12.5);
      expect(parseHumanNumber('(1 234,50)')).toBe(-1234.5);
    });

    it('calculates symmetric percentage difference', () => {
      const result = calculatePercentDifference(80, 120);
      expect(result.result).toBe(40);
      expect(result.formatted).toBe('40%');
    });
  });

  describe('Unit Price Comparator', () => {
    it('parses grouped comma decimals', () => {
      expect(parseFlexibleNumber('1 234,50')).toBe(1234.5);
    });

    it('reports the best option savings versus the next distinct price', () => {
      const result = evaluateProducts([
        { id: 'a', name: 'A', price: 5, packCount: 1, unitSize: 1, unitId: 'kg' },
        { id: 'b', name: 'B', price: 6, packCount: 1, unitSize: 1, unitId: 'kg' },
        { id: 'c', name: 'C', price: 10, packCount: 1, unitSize: 1, unitId: 'kg' },
      ]);
      const best = result.items.find((item) => item.id === 'a')!;
      expect(best.isBestValue).toBe(true);
      expect(best.savingsPercentageVsNext).toBeCloseTo(16.67, 2);
      expect(result.hasIncompleteData).toBe(false);
    });
  });

  describe('Discount & VAT', () => {
    it('removes ordinary floating-point noise without forcing currency cents', () => {
      expect(roundFinancial(0.1 + 0.2)).toBe(0.3);
    });

    it('reverses stacked discounts exactly', () => {
      expect(calculateOriginalPriceFromDiscount(72, 20, 10).originalPrice).toBe(100);
      expect(calculateOriginalPriceFromDiscount(0, 100).error).toBeDefined();
    });
  });

  describe('Time Zone Converter', () => {
    it('detects a DST fold as ambiguous with both valid instants', () => {
      const result = resolveDateInZone(2026, 11, 1, 1, 30, 'America/New_York');
      expect(result.status).toBe('ambiguous');
      expect(result.candidates).toHaveLength(2);
      expect(Math.abs(result.candidates[1].getTime() - result.candidates[0].getTime())).toBe(3_600_000);
    });

    it('detects and shifts a nonexistent spring-forward wall time', () => {
      const result = resolveDateInZone(2026, 3, 8, 2, 30, 'America/New_York');
      expect(result.status).toBe('nonexistent');
      expect(result.shiftedByMinutes).toBe(60);
    });
  });

  describe('Case Converter', () => {
    it('splits acronyms and digit transitions without discarding Unicode', () => {
      expect(splitIntoWords('XMLHttpRequest2')).toEqual(['XML', 'Http', 'Request', '2']);
      expect(convertCase('ÜberHTTPServer2', 'snake_case')).toBe('über_http_server_2');
    });

    it('keeps English title-case minor words lowercase away from boundaries', () => {
      expect(toTitleCase('the lord of the rings')).toBe('The Lord of the Rings');
    });
  });

  describe('Timer, Stopwatch & Pomodoro', () => {
    it('primes audio, reconciles background visibility, and uses active-tab transfer output', () => {
      const component = source('src/tools/timer-stopwatch/TimerStopwatchTool.tsx');
      const audio = source('src/utilities/timer-audio.ts');
      expect(component).toContain('visibilitychange');
      expect(component).toContain('primeTimerAudio');
      expect(component).toContain("activeTab==='pomodoro'");
      expect(component).toContain('[1,5,10,15,25,30,45,60,90]');
      expect(audio).toContain('timerAudioContext');
    });
  });

  describe('Recipe Scaler', () => {
    it('parses mixed and Unicode culinary fractions', () => {
      expect(parseCulinaryAmount('1 1/2')).toBe(1.5);
      expect(parseCulinaryAmount('1-1/2')).toBe(1.5);
      expect(parseCulinaryAmount('1½')).toBe(1.5);
      expect(parseCulinaryAmount('¾')).toBe(0.75);
    });

    it('parses a real mixed-fraction ingredient line', () => {
      const recipe = parseRawRecipeText('Pancakes\nServes: 4\n1 1/2 cups flour\n¾ cup milk');
      expect(recipe.ingredients[0]).toMatchObject({ amount: 1.5, unit: 'cups', name: 'flour' });
      expect(recipe.ingredients[1]).toMatchObject({ amount: 0.75, unit: 'cup', name: 'milk' });
    });
  });

  describe('Duplicate Finder', () => {
    it('uses bounded first/middle/end fingerprints to eliminate same-size non-duplicates', async () => {
      const first = 'A'.repeat(1024);
      const last = 'Z'.repeat(1024);
      const fileA = makeFile([first, 'B'.repeat(2048), last], 'a.bin');
      const fileB = makeFile([first, 'C'.repeat(2048), last], 'b.bin');
      expect(fileA.size).toBe(fileB.size);
      expect(await calculateFileSampleSha256(fileA, 1024)).not.toBe(await calculateFileSampleSha256(fileB, 1024));
    });

    it('still proves duplicates using full SHA-256 before reporting them', async () => {
      const a = makeFile(['duplicate payload'], 'a.txt', 'text/plain');
      const b = makeFile(['duplicate payload'], 'b.txt', 'text/plain');
      const items: ScannedFileItem[] = [a, b].map((file, index) => ({ id: String(index), name: file.name, size: file.size, type: file.type, lastModified: file.lastModified, fileObject: file }));
      const report = await findDuplicateFiles(items);
      expect(report.duplicateGroups).toHaveLength(1);
      expect(report.totalDuplicateFiles).toBe(1);
    });
  });

  describe('Batch File Renamer', () => {
    it('resolves an arbitrary collision group deterministically', () => {
      const files = ['a.txt', 'b.txt', 'c.txt'].map((name, index) => ({ id: String(index), file: makeFile([''], name, 'text/plain') }));
      const result = applyRenamingRules(files, { ...DEFAULT_RENAMER_RULES, useRegex: true, findText: '^.*$', replaceText: 'duplicate' });
      expect(result.map((item) => item.newName)).toEqual(['duplicate', 'duplicate-1', 'duplicate-2']);
    });

    it('sanitizes portable filesystem hazards and reserved names', () => {
      expect(sanitizeFilenameComponent('CON')).toBe('_CON');
      expect(sanitizeFilenameComponent('bad:name? ')).toBe('bad-name-');
    });
  });

  describe('Checklist', () => {
    it('repairs duplicate list/item IDs from corrupted persisted state', () => {
      const store = sanitizeChecklistStore({ activeListId: 'same', lists: [
        { id: 'same', title: 'A', items: [{ id: 'x', text: 'One' }, { id: 'x', text: 'Two' }] },
        { id: 'same', title: 'B', items: [] },
      ] });
      expect(new Set(store.lists.map((list) => list.id)).size).toBe(2);
      expect(new Set(store.lists[0].items.map((item) => item.id)).size).toBe(2);
    });

    it('supports fast local checklist filtering', () => {
      expect(filterChecklistItems([{ id: '1', text: 'Passport', completed: false }, { id: '2', text: 'Socks', completed: false }], 'pass')).toHaveLength(1);
    });
  });

  describe('Quick Notepad', () => {
    it('repairs duplicate persisted note IDs', () => {
      const store = sanitizeNotepadStore({ activeNoteId: 'same', notes: [{ id: 'same', title: 'A', content: 'one' }, { id: 'same', title: 'B', content: 'two' }] });
      expect(new Set(store.notes.map((note) => note.id)).size).toBe(2);
    });

    it('searches content while keeping pinned/recent ordering', () => {
      const notes: NoteDoc[] = [
        { id: 'old', title: 'Alpha', content: 'mission notes', updatedAt: 1, isPinned: true },
        { id: 'new', title: 'Beta', content: 'mission plan', updatedAt: 5, isPinned: false },
      ];
      expect(searchNotes(notes, 'mission').map((note) => note.id)).toEqual(['old', 'new']);
    });
  });

  describe('Aspect Ratio Calculator', () => {
    it('reduces decimal ratios rather than truncating them', () => {
      expect(simplifyRatio(1.5, 1).ratioString).toBe('3:2');
    });

    it('calculates cover crop geometry for square targets', () => {
      const fit = calculateFit(1920, 1080, 1000, 1000, 'cover')!;
      expect(fit.outputHeight).toBe(1000);
      expect(fit.outputWidth).toBeCloseTo(1777.7778, 3);
      expect(fit.cropPercentX).toBeGreaterThan(40);
    });
  });

  describe('Date Calculator', () => {
    it('subtracts months across year boundaries without invalid negative modulo', () => {
      expect(addSubtractTime({ year: 2026, month: 1, day: 31 }, 2, 'months', 'subtract')).toEqual({ year: 2025, month: 11, day: 30 });
    });

    it('supports custom excluded business dates', () => {
      const result = calculateBusinessDays({ year: 2026, month: 8, day: 31 }, { year: 2026, month: 9, day: 4 }, {
        excludedDates: [{ year: 2026, month: 9, day: 2 }],
      });
      expect(result.totalCalendarDays).toBe(5);
      expect(result.excludedDays).toBe(1);
      expect(result.workingDays).toBe(4);
    });
  });

  describe('URL & Base64', () => {
    it('round-trips UTF-8 through unpadded Base64URL', () => {
      const encoded = utf8ToBase64Url('Tiny Tools 🚀');
      expect(encoded.result).not.toMatch(/[+/=]/);
      expect(base64UrlToUtf8(encoded.result!).result).toBe('Tiny Tools 🚀');
    });

    it('preserves URL fragments after rebuilt query strings', () => {
      const parsed = parseQueryString('https://example.com/search?q=test#results');
      parsed.params.push({ id: '2', key: 'page', value: '2' });
      expect(buildQueryString(parsed.baseUrl, parsed.params)).toBe('https://example.com/search?q=test&page=2#results');
    });
  });

  describe('Watermark Maker', () => {
    it('computes rotated bounds and clamps edge watermarks inside the canvas', () => {
      const bounds = calculateRotatedBounds(100, 50, 90);
      expect(bounds.width).toBeCloseTo(50, 6);
      expect(bounds.height).toBeCloseTo(100, 6);
      const center = clampRotatedWatermarkCenter(200, 200, 190, 190, 100, 50, 90, 10);
      expect(center.x + bounds.width / 2).toBeLessThanOrEqual(190);
      expect(center.y + bounds.height / 2).toBeLessThanOrEqual(190);
    });
  });

  describe('Image Collage', () => {
    it('uses source-crop rectangles for exact cover positioning', () => {
      const placement = calculateImagePlacement(2000, 1000, 0, 0, 500, 500, 'cover', 0.5, 0.5, 1)!;
      expect(placement).toMatchObject({ sx: 500, sy: 0, sw: 1000, sh: 1000, dx: 0, dy: 0, dw: 500, dh: 500 });
    });
  });

  describe('Teleprompter', () => {
    it('scrolls consistently for equivalent elapsed time at different frame rates', () => {
      const two60HzFrames = calculateScrollDelta(25, 1000 / 60) * 2;
      const one30HzFrame = calculateScrollDelta(25, 1000 / 30);
      expect(two60HzFrames).toBeCloseTo(one30HzFrame, 8);
    });
  });

  describe('Palette Extractor', () => {
    it('rejects malformed HEX values instead of returning NaN channels', () => {
      expect(hexToRgb('#gggggg')).toBeNull();
      expect(hexToRgb('#12345')).toBeNull();
    });

    it('merges visually near-identical quantization buckets', () => {
      const base = (hex: string, r: number, g: number, b: number, dominancePercent: number): ExtractedColor => ({ hex, r, g, b, h: 0, s: 100, l: 50, dominancePercent });
      const merged = mergeSimilarExtractedColors([base('#ff0000', 255, 0, 0, 60), base('#fa0303', 250, 3, 3, 40)]);
      expect(merged).toHaveLength(1);
      expect(merged[0].dominancePercent).toBe(100);
      expect(getReadableTextColor('#ffffff')).toBe('#000000');
    });
  });

  describe('Image Annotator', () => {
    it('normalizes reverse-dragged rectangles', () => {
      expect(normalizeAnnotationRect(100, 100, -50, -20)).toEqual({ x: 50, y: 80, width: 50, height: 20 });
    });

    it('uses opaque redaction rather than pixelation', () => {
      const utility = source('src/utilities/image-annotator.ts');
      expect(utility).toContain('applySolidRedaction');
      expect(utility).not.toContain('applyPixelate');
    });
  });

  describe('Audio Recorder', () => {
    it('produces useful waveform peaks even when samples are fewer than buckets and across channels', () => {
      const left = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const right = new Float32Array([0.9, 0.1, 0.2, 0.1]);
      const buffer = {
        length: 4,
        numberOfChannels: 2,
        getChannelData: (channel: number) => channel === 0 ? left : right,
      } as AudioBuffer;
      const peaks = extractWaveformPeaks(buffer, 8);
      expect(peaks).toHaveLength(8);
      expect(Math.max(...peaks)).toBeCloseTo(0.9, 5);
      expect(peaks.some((peak) => peak > 0)).toBe(true);
    });
  });

  describe('ZIP Manager', () => {
    it('rejects duplicate paths after traversal-safe sanitization when creating archives', async () => {
      const fileA = makeFile(['a'], 'a.txt');
      const fileB = makeFile(['b'], 'b.txt');
      const pending: PendingZipFile[] = [
        { id: '1', file: fileA, relativePath: 'folder/../same.txt', size: fileA.size },
        { id: '2', file: fileB, relativePath: 'same.txt', size: fileB.size },
      ];
      await expect(createZipArchive(pending)).rejects.toThrow(/same archive path/i);
    });

    it('can reject archives above a configured entry limit before extraction', async () => {
      const zip = new JSZip();
      zip.file('one.txt', '1');
      zip.file('two.txt', '2');
      const blob = await zip.generateAsync({ type: 'blob' });
      await expect(parseZipArchive(blob, { maxEntries: 1 })).rejects.toThrow(/entries/i);
    });
  });

  describe('Signature Maker', () => {
    it('includes the final non-transparent pixel in content bounds', () => {
      const rgba = new Uint8ClampedArray(2 * 2 * 4);
      rgba[(3 * 4) + 3] = 255;
      const ctx = { getImageData: () => ({ data: rgba }) } as unknown as CanvasRenderingContext2D;
      expect(getCanvasContentBounds(ctx, 2, 2, 0)).toEqual({ minX: 1, minY: 1, maxX: 2, maxY: 2, width: 1, height: 1 });
    });
  });

  describe('Metronome', () => {
    it('calculates subdivision timing explicitly', () => {
      expect(calculateBeatIntervalMs(120, 'quarter')).toBe(500);
      expect(calculateBeatIntervalMs(120, 'eighth')).toBe(250);
    });

    it('rejects a gross tap outlier while reporting stability', () => {
      const result = calculateTapTempo([1000, 1600, 2200, 2400, 3000, 3600]);
      expect(result.bpm).toBe(100);
      expect(result.stability).toBeGreaterThan(90);
    });
  });

  describe('Screen Recorder', () => {
    it('computes active duration independently of timer ticks and pause time', () => {
      expect(calculateElapsedRecordingSeconds(1000, 2000, 8000)).toBe(5);
    });

    it('uses deterministic timestamped filenames and preserves legacy size precision', () => {
      const date = new Date(2026, 7, 31, 3, 4, 5);
      expect(generateRecordingFilename('video/webm', date)).toMatch(/2026-08-31-030405\.webm$/);
      expect(formatByteSize(3.5 * 1024 * 1024)).toBe('3.50 MB');
    });

    it('exposes selectable recording quality in the tool UI', () => {
      const component = source('src/tools/screen-recorder/ScreenRecorderTool.tsx');
      expect(component).toContain('Balanced · 30 fps');
      expect(component).toContain('High · 60 fps');
      expect(component).toContain('performance.now()');
    });
  });
});
