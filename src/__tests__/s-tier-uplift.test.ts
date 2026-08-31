import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditSecretEntropy, calculatePasswordEntropy, getPasswordPools, getRandomStringCharset, type PasswordConfig } from '../utilities/secure-generator';
import { assessQrPayload, formatVCardPayload, formatWifiPayload, parseScannedQr } from '../utilities/qr-studio';
import { generateGoogleCalendarUrl, generateIcsFile, getSupportedCalendarTimeZones, type CalendarEventData } from '../utilities/calendar-event';
import { allocateProportionalDiscount, calculateBreakEven, calculatePricingScenario } from '../utilities/discount-vat';
import { evaluateProducts, rankProductsForNeed, type ProductItem } from '../utilities/unit-price';
import { addBusinessDays, calculateBusinessDays, fromUtcTimestamp, getIsoWeek, toUtcTimestamp } from '../utilities/date-calculator';
import { analyzeScriptMix, countWordsAndStats } from '../utilities/word-counter';
import { convertUnits, parseMeasurement, validateUnitValue } from '../utilities/unit-converter';
import { validateBarcodePayloadDetailed, validateDetectedBarcode, verifyGtin } from '../utilities/barcode';
import { createZipArchive, inspectZipCentralDirectory, parseZipArchive, type PendingZipFile } from '../utilities/zip-manager';
import { hitTestAnnotation, parseAnnotationProject, serializeAnnotationProject, translateAnnotation, type RectAnnotation } from '../utilities/image-annotator';
import { calculateTileCenters, resolveWatermarkTemplate } from '../utilities/watermark';
import { analyzeRegexFeatures, analyzeRegexRisk, escapeRegexLiteral } from '../utilities/regex-tester';
import { compositeColors, deltaEOklab, formatColorRepresentations, getContrastRatio, oklabToRgb, parseColor, rgbToOklab } from '../utilities/color-converter';
import { convertCaseAdvanced, detectCaseStyle, slugify } from '../utilities/case-converter';

const source = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('Strict B-tier to S-tier uplift regressions', () => {
  it('Secure Generator measures the actual constrained secret space', () => {
    const config: PasswordConfig = { length: 16, useUpper: true, useLower: true, useNumbers: true, useSymbols: true, excludeAmbiguous: true, ensureEachType: true };
    const pools = getPasswordPools(config);
    expect(pools).toHaveLength(4);
    expect(pools.join('')).not.toMatch(/[0O1lI|]/);
    const filtered = calculatePasswordEntropy(config);
    expect(filtered).toBeGreaterThan(80);
    expect(filtered).toBeLessThan(calculatePasswordEntropy({ ...config, excludeAmbiguous: false }));
    expect(auditSecretEntropy(filtered).searchSpaceLog10).toBeGreaterThan(20);
    expect(getRandomStringCharset({ length: 10, preset: 'custom', customCharset: 'AABBBCC' })).toBe('ABC');
  });

  it('QR Studio round-trips escaped payloads and audits scan reliability', () => {
    const raw = formatWifiPayload({ ssid: 'Cafe;Guest:5G', password: 'p;ass\\word', security: 'WPA', hidden: true });
    expect(parseScannedQr(raw).parsedData?.wifi).toMatchObject({ ssid: 'Cafe;Guest:5G', password: 'p;ass\\word', hidden: true });
    expect(formatVCardPayload({ firstName: 'Jane', lastName: 'Doe', organization: 'Acme, Inc.; Labs' })).toContain('ORG:Acme\\, Inc.\\; Labs');
    const assessment = assessQrPayload('hello', 'H', '#777777', '#888888', 1);
    expect(assessment.warnings.join(' ')).toMatch(/quiet zone/i);
    expect(assessment.warnings.join(' ')).toMatch(/contrast/i);
  });

  it('Calendar Maker emits portable IANA-zone recurrence, attendees and alarms', () => {
    const event: CalendarEventData = {
      title: 'S-tier planning', description: 'International planning', location: 'Cologne', url: 'https://example.com',
      startDate: '2026-10-20', startTime: '14:00', endDate: '2026-10-20', endTime: '15:00', isAllDay: false,
      timezone: 'Europe/Berlin', reminderMinutes: 15, recurrence: 'WEEKLY', repeatUntil: '2026-11-20', organizerName: 'Jane Doe',
      organizerEmail: 'jane@example.com', attendees: ['a@example.com', 'b@example.com'], recurrenceInterval: 2,
      recurrenceByWeekday: ['TU', 'TH'], status: 'CONFIRMED', transparency: 'OPAQUE', additionalReminders: [60],
    };
    expect(getSupportedCalendarTimeZones()).toContain('Europe/Berlin');
    const ics = generateIcsFile(event);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;UNTIL=');
    expect(ics).toContain('ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:a@example.com');
    expect((ics.match(/BEGIN:VALARM/g) || [])).toHaveLength(2);
    expect(generateGoogleCalendarUrl(event)).toContain('dates=');
  });

  it('Discount/VAT supports ordered pricing, exact minor units and break-even', () => {
    const scenario = calculatePricingScenario(100, [{ type: 'percent-discount', value: 10 }, { type: 'tax', value: 20 }]);
    expect(scenario.steps.map((step) => step.after)).toEqual([90, 108]);
    const allocation = allocateProportionalDiscount([10, 20, 30], 10.01, 2);
    expect(allocation.reduce((a, b) => a + b, 0)).toBeCloseTo(10.01, 8);
    expect(calculateBreakEven(1000, 25, 15).units).toBe(100);
  });

  it('Unit Price distinguishes unit-price winners from whole-package purchase winners', () => {
    const products: ProductItem[] = [
      { id: 'a', name: '500g pack', price: 4, packCount: 1, unitSize: 500, unitId: 'g' },
      { id: 'b', name: '1kg pack', price: 7.5, packCount: 1, unitSize: 1, unitId: 'kg' },
    ];
    const evaluated = evaluateProducts(products).items;
    expect(evaluated.find((x) => x.id === 'b')?.isBestValue).toBe(true);
    const ranked = rankProductsForNeed(products, 1200);
    expect(ranked[0]).toMatchObject({ id: 'a', packagesForNeed: 3, purchaseCostForNeed: 12 });
    expect(evaluateProducts([{ id: 'x', name: 'Bottle', price: 2, packCount: 1, unitSize: 1, unitId: 'l', depositAmount: 0.25, discountAmount: 0.5 }]).items[0].effectivePrice).toBeCloseTo(1.75, 8);
  });

  it('Date Calculator is proleptic-Gregorian-safe and scales across long spans', () => {
    const ancient = { year: 50, month: 3, day: 1 };
    expect(fromUtcTimestamp(toUtcTimestamp(ancient))).toEqual(ancient);
    const business = calculateBusinessDays({ year: 2000, month: 1, day: 1 }, { year: 2100, month: 12, day: 31 });
    expect(business.totalCalendarDays).toBeGreaterThan(36_000);
    expect(business.workingDays).toBeGreaterThan(26_000);
    expect(addBusinessDays({ year: 2026, month: 8, day: 28 }, 1)).toEqual({ year: 2026, month: 8, day: 31 });
    expect(getIsoWeek({ year: 2026, month: 1, day: 1 })).toMatchObject({ week: 1, weekYear: 2026 });
  });

  it('Word Counter segments CJK/Hangul and reports script mix', () => {
    const stats = countWordsAndStats('안녕하세요 세계. 日本語のテストです。 中文分词测试。');
    expect(stats.words).toBeGreaterThanOrEqual(5);
    expect(stats.sentences).toBeGreaterThanOrEqual(3);
    expect(stats.graphemes).toBeGreaterThan(stats.words);
    const scripts = analyzeScriptMix('한국어 日本語 English');
    expect(scripts.hangul).toBeGreaterThan(0);
    expect(scripts.cjk).toBeGreaterThan(0);
  });

  it('Unit Converter covers engineering/data categories and physical validation', () => {
    expect(convertUnits('pressure', 'atm', 'kpa', 1)?.result).toBeCloseTo(101.325, 6);
    expect(convertUnits('energy', 'kwh', 'j', 1)?.result).toBe(3_600_000);
    expect(validateUnitValue('temperature', 'c', -274).valid).toBe(false);
    expect(parseMeasurement('60 mph')).toMatchObject({ value: 60, category: 'speed', unitId: 'mph' });
  });

  it('Barcode validates retail check digits, detected formats and ITF normalization', () => {
    expect(verifyGtin('5901234123457').valid).toBe(true);
    expect(validateDetectedBarcode('5901234123450', 'ean_13').isValid).toBe(false);
    const odd = validateBarcodePayloadDetailed('ITF', '12345');
    expect(odd.normalizedValue).toBe('012345');
    expect(odd.warnings?.join(' ')).toMatch(/leading zero/i);
  });

  it('ZIP preflights real central-directory metadata before extraction', async () => {
    const files: PendingZipFile[] = [
      { id: '1', file: new File(['hello'], 'a.txt', { type: 'text/plain' }), relativePath: 'docs/a.txt', size: 5 },
      { id: '2', file: new File(['world'], 'b.txt', { type: 'text/plain' }), relativePath: 'docs/b.txt', size: 5 },
    ];
    const blob = await createZipArchive(files);
    const preflight = await inspectZipCentralDirectory(blob);
    expect(preflight.entries.filter((entry) => !entry.rawPath.endsWith('/'))).toHaveLength(2);
    expect(preflight.totalUncompressedSize).toBe(10);
    const parsed = await parseZipArchive(blob, { verifyCrc32: true });
    expect(parsed.entries.filter((entry) => !entry.isFolder)).toHaveLength(2);
  });

  it('Image Annotator supports geometry hit-testing, movement and project round-trip', () => {
    const rect: RectAnnotation = { id: 'r', type: 'rect', x: 10, y: 20, width: 100, height: 50, color: '#f00', strokeWidth: 4 };
    expect(hitTestAnnotation(12, 22, rect, 0)).toBe(true);
    const moved = translateAnnotation(rect, 25, -5) as RectAnnotation;
    expect(moved).toMatchObject({ x: 35, y: 15 });
    const raw = serializeAnnotationProject({ version: 1, width: 800, height: 600, annotations: [moved] });
    expect(parseAnnotationProject(raw)?.annotations).toHaveLength(1);
  });

  it('Watermark supports deterministic batch templates and full tiled coverage', () => {
    expect(resolveWatermarkTemplate('{stem}-{date}-{index}-of-{total}', { filename: 'photo.jpg', date: new Date('2026-08-31T00:00:00Z'), index: 2, total: 5 })).toBe('photo-2026-08-31-2-of-5');
    const centers = calculateTileCenters(1000, 600, 120, true);
    expect(centers.length).toBeGreaterThan(40);
    expect(Math.min(...centers.map((point) => point.x))).toBeLessThan(0);
  });

  it('Regex exposes real worker isolation with static feature/risk analysis', () => {
    expect(analyzeRegexRisk('(a+)+$').level).toBe('high');
    expect(analyzeRegexFeatures('(?<name>\\p{L}+)(?<=x)\\1')).toMatchObject({ lookbehind: true, namedGroups: true, unicodeProperties: true, backreferences: true });
    expect(escapeRegexLiteral('a+b?')).toBe('a\\+b\\?');
    const component = source('src/tools/regex-tester/RegexTesterTool.tsx');
    expect(component).toContain('testRegexWithTimeout');
    expect(component).toContain('Worker-isolated');
    expect(component).toContain('300 ms timeout');
  });

  it('Color Converter is bidirectional for perceptual colors and alpha-aware contrast', () => {
    const color = parseColor('rgb(100% 0% 0% / 50%)')!;
    expect(color).toMatchObject({ r: 255, g: 0, b: 0, a: 0.5 });
    const lab = rgbToOklab({ r: 37, g: 99, b: 235, a: 1 });
    expect(oklabToRgb(lab)).toMatchObject({ r: 37, g: 99, b: 235 });
    const encoded = formatColorRepresentations({ r: 37, g: 99, b: 235, a: 1 }).oklch;
    const decoded = parseColor(encoded)!;
    expect(decoded.r).toBeCloseTo(37, 0);
    expect(decoded.g).toBeCloseTo(99, 0);
    expect(decoded.b).toBeCloseTo(235, 0);
    const blended = compositeColors(color, { r: 255, g: 255, b: 255, a: 1 });
    expect(getContrastRatio(color, { r: 255, g: 255, b: 255, a: 1 }).ratio).toBeCloseTo(getContrastRatio(blended, { r: 255, g: 255, b: 255, a: 1 }).ratio, 2);
    expect(deltaEOklab(color, color)).toBe(0);
  });

  it('Case Converter handles locale, acronyms, extra developer cases and Unicode slugs', () => {
    expect(convertCaseAdvanced('istanbul ışık', 'UPPERCASE', { locale: 'tr-TR' })).toBe('İSTANBUL IŞIK');
    expect(convertCaseAdvanced('hello world', 'path/case')).toBe('hello/world');
    expect(convertCaseAdvanced('http api client', 'PascalCase', { preserveAcronyms: ['HTTP', 'API'] })).toBe('HTTPAPIClient');
    expect(detectCaseStyle('hello_world')).toBe('snake_case');
    expect(slugify('Crème brûlée')).toBe('creme-brulee');
  });
});
