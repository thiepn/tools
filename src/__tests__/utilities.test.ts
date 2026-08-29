import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanText, defaultCleanerOptions } from '../utilities/text-cleaner';
import { convertCase } from '../utilities/case-converter';
import { calculateWordStats } from '../utilities/word-counter';
import { processList } from '../utilities/list-processor';
import { formatAndValidateJson } from '../utilities/json-formatter';
import { testRegex } from '../utilities/regex-tester';
import { utf8ToBase64, base64ToUtf8, parseQueryString, buildQueryString } from '../utilities/encoding-tools';
import { parseColor, getContrastRatio, formatColorRepresentations } from '../utilities/color-converter';
import { calculatePercentOf, calculatePercentChange } from '../utilities/percentage-calculator';
import { calculateDateDifference, calculateWorkingDays } from '../utilities/date-calculator';
import { convertUnits } from '../utilities/unit-converter';
import { simplifyRatio, calculateMissingDimension } from '../utilities/aspect-ratio-calculator';
import { detectSmartPasteSuggestions } from '../utilities/smart-paste';
import { getStoredPreferences, savePreferences, toggleFavorite, recordRecentTool } from '../storage/preferences';
import { formatWifiPayload, formatVCardPayload } from '../utilities/qr-studio';
import { generatePassword, generatePassphrase, generatePin, generateRandomString, calculatePasswordEntropy, getEntropyStrength } from '../utilities/secure-generator';
import { evaluateProducts, parseFlexibleNumber, SUPPORTED_UNITS } from '../utilities/unit-price';
import { calculateDiscount, calculateVatAdd, calculateVatExtract, calculateFromCostAndRevenue } from '../utilities/discount-vat';
import { POPULAR_TIMEZONES, createDateInZone, formatZoneTime, generateComparisonSummary } from '../utilities/time-zone-converter';
import { calculateAspectRatio, calculateTargetDimensions, formatFileSize as formatImageFileSize } from '../utilities/image-optimizer';
import { compositeSegmentedImage, BgRemoverOptions } from '../utilities/background-remover';
import { SUPPORTED_OCR_LANGUAGES } from '../utilities/image-ocr';
import { extractWaveformPeaks, audioBufferToWavBlob } from '../utilities/audio-recorder';
import { formatRecordingDuration, formatByteSize, getSupportedVideoMimeType } from '../utilities/screen-recorder';
import { chunkTextForSpeech, getAvailableVoices } from '../utilities/text-to-speech';
import { calculateGridDimensions, calculateCanvasSize } from '../utilities/image-collage';
import { parseItemsList, pickRandomItems, pickRandomOne, shuffleArraySecure, splitIntoTeams, generateRandomPairs, generateSecretSanta, generatePairs, getCryptoRandomInt } from '../utilities/random-picker';
import { scaleRecipe, parseRawRecipeText, formatScaledRecipeToText, convertVolumeToMass, convertCookingTemperature, INGREDIENT_DENSITIES, SAMPLE_RECIPES } from '../utilities/recipe-scaler';
import { calculateChecklistStats, formatChecklistToText, CHECKLIST_TEMPLATES, ChecklistDoc, sanitizeChecklistStore, defaultChecklistStore } from '../utilities/checklist';
import { calculateNoteStats, getStoredNotes, saveNotes, sanitizeNotepadStore, defaultNotepadStore } from '../utilities/quick-notepad';

describe('Text Cleaner', () => {
  it('removes duplicate spaces and trims whitespace', () => {
    const input = '  Hello    world!   ';
    const res = cleanText(input, {
      ...defaultCleanerOptions,
      trimEntireText: true,
      collapseSpaces: true,
    });
    expect(res.output).toBe('Hello world!');
    expect(res.stats.charsRemoved).toBeGreaterThan(0);
  });

  it('normalizes smart quotes and dashes', () => {
    const input = '“Smart quotes” and — em-dash';
    const res = cleanText(input, {
      ...defaultCleanerOptions,
      normalizeSmartQuotes: true,
      normalizeDashes: true,
    });
    expect(res.output).toBe('"Smart quotes" and - em-dash');
  });

  it('preserves non-Latin scripts (Japanese, Greek, Arabic) when cleaning invisible chars', () => {
    const input = '日本語\u200Bテスト αβγ \uFEFF مرحبا';
    const res = cleanText(input, {
      ...defaultCleanerOptions,
      removeInvisibleChars: true,
    });
    expect(res.output).toBe('日本語テスト αβγ مرحبا');
  });

  it('preserves U+200C ZWNJ in Persian/Arabic text and U+200D ZWJ in emoji sequences by default', () => {
    // Persian text with ZWNJ: "می‌خواهم" (U+0645 U+06CC U+200C U+062E U+0648 U+0627 U+0647 U+0645)
    // Plus invisible zero-width space U+200B and BOM U+FEFF
    const persianInput = '\uFEFFمی\u200Cخواهم\u200B کتاب‌ها';
    const resPersian = cleanText(persianInput, defaultCleanerOptions);
    // U+200C (ZWNJ) must be preserved, while BOM U+FEFF and ZWSP U+200B are removed
    expect(resPersian.output).toBe('می\u200Cخواهم کتاب‌ها');
    expect(resPersian.output.includes('\u200C')).toBe(true);
    expect(resPersian.output.includes('\u200B')).toBe(false);
    expect(resPersian.output.includes('\uFEFF')).toBe(false);

    // Emoji ZWJ sequence: "👩‍💻" (Woman technologist: U+1F469 + U+200D + U+1F4BB) & "👨‍👩‍👧" (Family: U+1F468 + U+200D + U+1F469 + U+200D + U+1F467)
    const emojiInput = '👩\u200D💻 Team \u200B 👨\u200D👩\u200D👧';
    const resEmoji = cleanText(emojiInput, defaultCleanerOptions);
    expect(resEmoji.output).toBe('👩\u200D💻 Team 👨\u200D👩\u200D👧');
    expect(resEmoji.output.includes('\u200D')).toBe(true);
    expect(resEmoji.output.includes('\u200B')).toBe(false);
  });

  it('strips ZWNJ and ZWJ only when removeZeroWidthJoiners is explicitly true', () => {
    const persianInput = 'می\u200Cخواهم';
    const resPersianStripped = cleanText(persianInput, {
      ...defaultCleanerOptions,
      removeZeroWidthJoiners: true,
    });
    expect(resPersianStripped.output).toBe('میخواهم');
    expect(resPersianStripped.output.includes('\u200C')).toBe(false);

    const emojiInput = '👩\u200D💻';
    const resEmojiStripped = cleanText(emojiInput, {
      ...defaultCleanerOptions,
      removeZeroWidthJoiners: true,
    });
    expect(resEmojiStripped.output).toBe('👩💻');
    expect(resEmojiStripped.output.includes('\u200D')).toBe(false);
  });
});

describe('Case Converter', () => {
  it('converts to camelCase, snake_case, kebab-case, and PascalCase', () => {
    const text = 'hello world test';
    expect(convertCase(text, 'camelCase')).toBe('helloWorldTest');
    expect(convertCase(text, 'snake_case')).toBe('hello_world_test');
    expect(convertCase(text, 'kebab-case')).toBe('hello-world-test');
    expect(convertCase(text, 'PascalCase')).toBe('HelloWorldTest');
  });

  it('converts accurately to CONSTANT_CASE and dot.case', () => {
    const text = 'hello world test string';
    expect(convertCase(text, 'CONSTANT_CASE')).toBe('HELLO_WORLD_TEST_STRING');
    expect(convertCase(text, 'dot.case')).toBe('hello.world.test.string');

    const mixed = 'getUser_profileId';
    expect(convertCase(mixed, 'CONSTANT_CASE')).toBe('GET_USER_PROFILE_ID');
    expect(convertCase(mixed, 'dot.case')).toBe('get.user.profile.id');
  });
});

describe('Word & Character Counter', () => {
  it('calculates word, character, and sentence stats accurately', () => {
    const sample = 'Hello world! This is a test sentence. Third sentence here.';
    const stats = calculateWordStats(sample);
    expect(stats.words).toBe(10);
    expect(stats.sentences).toBe(3);
    expect(stats.paragraphs).toBe(1);
    expect(stats.charactersWithSpaces).toBe(58);
  });

  it('calculates unique-word count, longest word, and top 10 frequencies', () => {
    const text = 'the quick brown fox jumps over the lazy dog the quick brown fox';
    const stats = calculateWordStats(text);
    expect(stats.words).toBe(13);
    expect(stats.uniqueWords).toBe(8);
    expect(stats.longestWord.length).toBe(5);
    expect(stats.averageWordLength).toBeGreaterThan(3);
    expect(stats.topWords.length).toBeLessThanOrEqual(10);
    expect(stats.topWords[0].word).toBe('the');
    expect(stats.topWords[0].count).toBe(3);
  });

  it('supports configurable reading (wpm) and speaking (cpm/wpm) speeds', () => {
    const words1000 = Array(600).fill('word').join(' ');
    const statsDefault = calculateWordStats(words1000, { readingWpm: 200, speakingWpm: 130 });
    expect(statsDefault.readingTimeSeconds).toBe(180); // 3 minutes = 180s
    expect(statsDefault.speakingTimeSeconds).toBe(277); // ceil(600/130 * 60) = 277s

    const statsCustom = calculateWordStats(words1000, { readingWpm: 300, speakingWpm: 150 });
    expect(statsCustom.readingTimeSeconds).toBe(120); // 2 minutes = 120s
    expect(statsCustom.speakingTimeSeconds).toBe(240); // 4 minutes = 240s
  });
});

describe('List Processor', () => {
  it('deduplicates, trims, and sorts lists', () => {
    const lines = ['banana', 'apple', 'banana', 'cherry', 'apple'];
    const res = processList(lines, {
      removeDuplicates: true,
      duplicateMode: 'case-insensitive',
      trimItems: true,
      sort: 'alpha-asc',
      removeNumbering: false,
      removeEmpty: true,
      reverse: false,
      shuffle: false,
      joinWith: '\n',
    });
    expect(res.items).toEqual(['apple', 'banana', 'cherry']);
  });

  it('supports case-sensitive vs case-insensitive duplicate removal', () => {
    const lines = ['Apple', 'apple', 'APPLE', 'Banana'];
    const caseSensitive = processList(lines, {
      removeDuplicates: true,
      duplicateMode: 'case-sensitive',
      removeEmpty: false,
      trimItems: false,
      sort: 'none',
      removeNumbering: false,
      reverse: false,
      shuffle: false,
      joinWith: '\n',
    });
    expect(caseSensitive.items).toEqual(['Apple', 'apple', 'APPLE', 'Banana']);

    const caseInsensitive = processList(lines, {
      removeDuplicates: true,
      duplicateMode: 'case-insensitive',
      removeEmpty: false,
      trimItems: false,
      sort: 'none',
      removeNumbering: false,
      reverse: false,
      shuffle: false,
      joinWith: '\n',
    });
    expect(caseInsensitive.items).toEqual(['Apple', 'Banana']);
  });

  it('removes common line numbering prefixes (1., 2), [3], 4 -)', () => {
    const lines = [
      '1. First item',
      '2) Second item',
      '[3] Third item',
      '4 - Fourth item',
      '5: Fifth item',
    ];
    const res = processList(lines, {
      removeDuplicates: false,
      duplicateMode: 'case-insensitive',
      removeEmpty: false,
      trimItems: false,
      sort: 'none',
      removeNumbering: true,
      reverse: false,
      shuffle: false,
      joinWith: '\n',
    });
    expect(res.items).toEqual([
      'First item',
      'Second item',
      'Third item',
      'Fourth item',
      'Fifth item',
    ]);
  });

  it('performs natural numeric sorting accurately', () => {
    const lines = ['item 10', 'item 2', 'item 1', 'item 20', 'item 3'];
    const res = processList(lines, {
      removeDuplicates: false,
      duplicateMode: 'case-insensitive',
      removeEmpty: false,
      trimItems: false,
      sort: 'numeric-asc',
      removeNumbering: false,
      reverse: false,
      shuffle: false,
      joinWith: '\n',
    });
    expect(res.items).toEqual(['item 1', 'item 2', 'item 3', 'item 10', 'item 20']);
  });
});

describe('JSON Formatter', () => {
  it('validates and formats valid JSON', () => {
    const raw = '{"b":2,"a":1}';
    const res = formatAndValidateJson(raw, { indent: 2, sortKeys: true });
    expect(res.isValid).toBe(true);
    expect(res.formatted).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('detects invalid JSON with error details', () => {
    const raw = '{ invalid json }';
    const res = formatAndValidateJson(raw, { indent: 2, sortKeys: false });
    expect(res.isValid).toBe(false);
    expect(res.error).toBeDefined();
  });
});

describe('Regex Tester', () => {
  it('identifies matches, start/end indices, and named groups safely', () => {
    const pattern = '(?<user>\\w+)@(?<domain>\\w+\\.\\w+)';
    const text = 'Contact support@example.com or sales@test.org';
    const res = testRegex(
      pattern,
      {
        global: true,
        ignoreCase: false,
        multiline: false,
        dotAll: false,
        unicode: false,
        sticky: false,
      },
      text,
      '[$<user> on $<domain>]'
    );
    expect(res.isValid).toBe(true);
    expect(res.matchCount).toBe(2);
    expect(res.matches[0].index).toBe(8);
    expect(res.matches[0].endIndex).toBe(27);
    expect(res.matches[0].namedGroups).toEqual({ user: 'support', domain: 'example.com' });
    expect(res.replacementPreview).toBe('Contact [support on example.com] or [sales on test.org]');
  });

  it('safely handles zero-length global matches without infinite loops', () => {
    const pattern = '^|\\b';
    const text = 'abc def';
    const res = testRegex(
      pattern,
      {
        global: true,
        ignoreCase: false,
        multiline: false,
        dotAll: false,
        unicode: false,
        sticky: false,
      },
      text
    );
    expect(res.isValid).toBe(true);
    expect(res.matchCount).toBeGreaterThan(0);
  });

  it('supports sticky (y) flag evaluation', () => {
    const pattern = '\\d+';
    const text = '123 456';
    const res = testRegex(
      pattern,
      {
        global: false,
        ignoreCase: false,
        multiline: false,
        dotAll: false,
        unicode: false,
        sticky: true,
      },
      text
    );
    expect(res.isValid).toBe(true);
    expect(res.matchCount).toBe(1);
  });
});

describe('Encoding Tools', () => {
  it('encodes and decodes UTF-8 and Unicode strings to Base64', () => {
    const sample = 'Tiny Tools 🚀 日本語';
    const encoded = utf8ToBase64(sample);
    expect(encoded.result).toBeDefined();
    const decoded = base64ToUtf8(encoded.result!);
    expect(decoded.result).toBe(sample);
  });

  it('parses and builds query strings correctly', () => {
    const url = 'https://example.com/search?q=test&limit=10';
    const parsed = parseQueryString(url);
    expect(parsed.params).toHaveLength(2);
    expect(parsed.params[0].key).toBe('q');
    expect(parsed.params[0].value).toBe('test');

    const rebuilt = buildQueryString(parsed.baseUrl, parsed.params);
    expect(rebuilt).toBe('https://example.com/search?q=test&limit=10');
  });
});

describe('Color Converter & Contrast', () => {
  it('parses hex, rgb, and hsl correctly', () => {
    const parsedHex = parseColor('#2563eb');
    expect(parsedHex).toBeDefined();
    expect(parsedHex?.r).toBe(37);
    expect(parsedHex?.g).toBe(99);
    expect(parsedHex?.b).toBe(235);

    const formats = formatColorRepresentations(parsedHex!);
    expect(formats.hex).toBe('#2563EB');
  });

  it('calculates WCAG contrast ratio between black and white', () => {
    const black = parseColor('#000000')!;
    const white = parseColor('#ffffff')!;
    const contrast = getContrastRatio(black, white);
    expect(contrast.ratio).toBe(21);
    expect(contrast.wcagAANormal).toBe(true);
    expect(contrast.wcagAAANormal).toBe(true);
  });
});

describe('Percentage Calculator', () => {
  it('computes percentage of number and percentage change', () => {
    const p1 = calculatePercentOf(20, 500);
    expect(p1.result).toBe(100);

    const change = calculatePercentChange(100, 150);
    expect(change.result).toBe(50);
  });
});

describe('Date Calculator', () => {
  it('computes exact date difference and working days', () => {
    const d1 = { year: 2025, month: 1, day: 1 };
    const d2 = { year: 2025, month: 1, day: 15 };
    const diff = calculateDateDifference(d1, d2, false);
    expect(diff.totalDays).toBe(14);
    expect(diff.weeks).toBe(2);

    const workDays = calculateWorkingDays(d1, d2, true);
    expect(workDays.workingDays).toBeGreaterThan(0);
  });
});

describe('Unit Converter', () => {
  it('converts meters to feet and digital bytes', () => {
    const res = convertUnits('length', 'm', 'ft', 10);
    expect(res?.result).toBeCloseTo(32.8084, 2);

    const digital = convertUnits('digital', 'mb', 'gb', 1000);
    expect(digital?.result).toBeCloseTo(1, 4);
  });
});

describe('Aspect Ratio Calculator', () => {
  it('simplifies 1920x1080 to 16:9, decimal ratio, orientation and scales dimensions', () => {
    const simplified = simplifyRatio(1920, 1080);
    expect(simplified.ratioString).toBe('16:9');
    expect(simplified.orientation).toBe('Landscape');
    expect(simplified.decimal).toBe(1.7778);

    const portrait = simplifyRatio(1080, 1920);
    expect(portrait.orientation).toBe('Portrait');

    const square = simplifyRatio(500, 500);
    expect(square.orientation).toBe('Square');

    const scaledH = calculateMissingDimension(16, 9, 1280, 'width', true);
    expect(scaledH).toBe(720);
  });

  it('safely handles 0 and negative dimensions without crashing', () => {
    const invalid = simplifyRatio(0, 100);
    expect(invalid.ratioString).toBe('Invalid dimensions');
    const missing = calculateMissingDimension(0, 0, 100, 'width');
    expect(missing).toBeNull();
  });
});

describe('Smart Paste Detector', () => {
  it('detects JSON, URLs, query-strings, dimensions, and Color formats with <= 3 suggestions', () => {
    const jsonSug = detectSmartPasteSuggestions('{"hello": "world"}');
    expect(jsonSug.some((s) => s.toolId === 'json-formatter')).toBe(true);

    const qsSug = detectSmartPasteSuggestions('foo=bar&baz=qux&num=123');
    expect(qsSug.some((s) => s.toolId === 'encoding-tools')).toBe(true);

    const dimSug = detectSmartPasteSuggestions('1920 × 1080');
    expect(dimSug.some((s) => s.toolId === 'aspect-ratio-calculator')).toBe(true);

    const rgbColorSug = detectSmartPasteSuggestions('rgb(255, 128, 0)');
    expect(rgbColorSug.some((s) => s.toolId === 'color-converter')).toBe(true);

    const multilineSug = detectSmartPasteSuggestions('item 1\nitem 2\nitem 3');
    expect(multilineSug.length).toBeLessThanOrEqual(3);
  });
});

describe('Preferences & Persistence Resilience', () => {
  const PREFERENCES_KEY = 'tiny_tools_preferences_v1';
  let storageStore: Record<string, string> = {};

  beforeEach(() => {
    storageStore = {};
    const mockStorage = {
      getItem: (key: string) => storageStore[key] || null,
      setItem: (key: string, value: string) => {
        storageStore[key] = value;
      },
      removeItem: (key: string) => {
        delete storageStore[key];
      },
      clear: () => {
        storageStore = {};
      },
      length: 0,
      key: () => null,
    };

    if (typeof window === 'undefined') {
      (globalThis as unknown as { window: unknown }).window = {
        localStorage: mockStorage,
      };
    } else {
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
      });
    }
  });

  afterEach(() => {
    storageStore = {};
  });

  it('recovers gracefully when localStorage contains corrupted JSON or invalid data', () => {
    window.localStorage.setItem(PREFERENCES_KEY, '{ invalid corrupted json! }');
    const prefs = getStoredPreferences();
    expect(prefs.theme).toBe('system');
    expect(Array.isArray(prefs.favorites)).toBe(true);
    expect(Array.isArray(prefs.recents)).toBe(true);
  });

  it('recovers when localStorage values are primitive strings or nulls', () => {
    window.localStorage.setItem(PREFERENCES_KEY, '"just a string"');
    const prefs = getStoredPreferences();
    expect(prefs.theme).toBe('system');
  });

  it('safely records recent tools and toggles favorites without persisting user tool content', () => {
    toggleFavorite('word-counter');
    recordRecentTool('word-counter');
    const prefs = getStoredPreferences();
    expect(prefs.favorites).toContain('word-counter');
    expect(prefs.recents).toContain('word-counter');
  });
});

describe('QR Studio Payloads', () => {
  it('generates valid WiFi connection payload string', () => {
    const wifi = formatWifiPayload({ ssid: 'MyHomeNetwork', password: 'SecretPassword123', security: 'WPA', hidden: false });
    expect(wifi).toBe('WIFI:T:WPA;S:MyHomeNetwork;P:SecretPassword123;H:false;;');
  });

  it('generates valid vCard 3.0 contact payload string', () => {
    const vcard = formatVCardPayload({
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+1-555-0199',
      email: 'jane@example.com',
      organization: 'Acme Corp',
      website: 'https://example.com',
    });
    expect(vcard.includes('BEGIN:VCARD')).toBe(true);
    expect(vcard.includes('N:Doe;Jane;;;')).toBe(true);
    expect(vcard.includes('FN:Jane Doe')).toBe(true);
    expect(vcard.includes('TEL;TYPE=CELL:+1-555-0199')).toBe(true);
    expect(vcard.includes('EMAIL:jane@example.com')).toBe(true);
    expect(vcard.includes('END:VCARD')).toBe(true);
  });
});

describe('Password & Passphrase Generator', () => {
  it('generates passwords of specified length and character sets', () => {
    const config = {
      length: 18,
      useUpper: true,
      useLower: true,
      useNumbers: true,
      useSymbols: true,
      excludeAmbiguous: false,
      ensureEachType: true,
    };
    const pwd = generatePassword(config);
    expect(pwd.length).toBe(18);
    const entropyBits = calculatePasswordEntropy(config);
    expect(entropyBits).toBeGreaterThan(60);
    const strength = getEntropyStrength(entropyBits);
    expect(strength.label).toMatch(/Strong|Very Strong/);
  });

  it('generates multi-word passphrases from EFF word list with custom separators', () => {
    const phrase = generatePassphrase({
      wordCount: 5,
      separator: '-',
      capitalization: 'title',
      includeNumber: true,
    });
    const parts = phrase.split('-');
    expect(parts.length).toBe(5);
    expect(/\d/.test(phrase)).toBe(true);
  });

  it('generates numeric PINs of specified length using crypto.getRandomValues', () => {
    const pin4 = generatePin({ length: 4, avoidTrivial: true });
    expect(pin4).toHaveLength(4);
    expect(/^\d{4}$/.test(pin4)).toBe(true);

    const pin8 = generatePin({ length: 8, avoidTrivial: true });
    expect(pin8).toHaveLength(8);
    expect(/^\d{8}$/.test(pin8)).toBe(true);
  });

  it('generates cryptographic hexadecimal tokens of specified length', () => {
    const hex16 = generateRandomString({ length: 32, preset: 'hex', customCharset: '' });
    expect(hex16).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(hex16)).toBe(true);

    const hex64 = generateRandomString({ length: 64, preset: 'hex', customCharset: '' });
    expect(hex64).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hex64)).toBe(true);
  });

  it('generates custom random strings from specific charset', () => {
    const alphanumeric = generateRandomString({ length: 24, preset: 'custom', customCharset: 'ABCDEF0123456789' });
    expect(alphanumeric).toHaveLength(24);
    expect(/^[A-F0-9]{24}$/.test(alphanumeric)).toBe(true);
  });
});

describe('Unit Price Comparator', () => {
  it('accurately normalizes prices across mixed units and identifies the best value', () => {
    const products = [
      { id: '1', name: 'Option A (500g)', price: 4.5, packCount: 1, unitSize: 500, unitId: 'g' }, // $9.00 / kg
      { id: '2', name: 'Option B (1.2kg)', price: 9.0, packCount: 1, unitSize: 1.2, unitId: 'kg' }, // $7.50 / kg
      { id: '3', name: 'Option C (2-pack of 400g)', price: 6.0, packCount: 2, unitSize: 400, unitId: 'g' }, // $7.50 / kg
    ];
    const res = evaluateProducts(products, 'standard');
    expect(res.hasMismatchedCategories).toBe(false);
    expect(res.items.length).toBe(3);
    const optB = res.items.find((i: any) => i.id === '2');
    expect(optB.pricePerStandardUnit).toBeCloseTo(7.5, 2);
    expect(optB.isBestValue).toBe(true);
  });

  it('supports per 100g / 100ml normalization basis', () => {
    const products = [
      { id: '1', name: 'Cereal Box (500g)', price: 5.0, packCount: 1, unitSize: 500, unitId: 'g' },
    ];
    const res = evaluateProducts(products, 'hundred');
    expect(res.items[0].standardUnitLabel).toBe('100g');
    expect(res.items[0].pricePerStandardUnit).toBeCloseTo(1.0, 2); // $1.00 per 100g
  });

  it('detects ties when products have identical normalized unit prices', () => {
    const products = [
      { id: '1', name: 'Brand A (1kg)', price: 10.0, packCount: 1, unitSize: 1, unitId: 'kg' },
      { id: '2', name: 'Brand B (500g)', price: 5.0, packCount: 1, unitSize: 500, unitId: 'g' },
    ];
    const res = evaluateProducts(products, 'standard');
    expect(res.items[0].isBestValue).toBe(true);
    expect(res.items[1].isBestValue).toBe(true);
    expect(res.items[0].isTie).toBe(true);
    expect(res.items[1].isTie).toBe(true);
  });

  it('flags mismatched dimensions when comparing weight with volume', () => {
    const products = [
      { id: '1', name: 'Milk (1L)', price: 2.5, packCount: 1, unitSize: 1, unitId: 'l' },
      { id: '2', name: 'Cheese (500g)', price: 4.0, packCount: 1, unitSize: 500, unitId: 'g' },
    ];
    const res = evaluateProducts(products, 'standard');
    expect(res.hasMismatchedCategories).toBe(true);
  });

  it('parses comma decimals safely with parseFlexibleNumber', () => {
    expect(parseFlexibleNumber('4,99')).toBe(4.99);
    expect(parseFlexibleNumber('12.50')).toBe(12.5);
    expect(parseFlexibleNumber('')).toBe(0);
  });
});

describe('Time Zone Converter Utilities', () => {
  it('retrieves comprehensive list of popular time zones', () => {
    expect(POPULAR_TIMEZONES.length).toBeGreaterThanOrEqual(25);
    const utcZone = POPULAR_TIMEZONES.find((z) => z.id === 'UTC');
    expect(utcZone).toBeDefined();
    expect(utcZone?.city).toBe('UTC');
  });

  it('accurately translates local wall clock time into UTC date and targets', () => {
    // 2026-06-15 14:00 in America/New_York (EDT, UTC-4) -> 18:00 UTC
    const utcDate = createDateInZone(2026, 6, 15, 14, 0, 'America/New_York');
    expect(utcDate.getUTCHours()).toBe(18);

    const londonRow = formatZoneTime(utcDate, 'Europe/London', utcDate, true);
    // London in June is BST (UTC+1) -> 19:00
    expect(londonRow.formattedTime).toMatch(/19:00|7:00/);

    const summary = generateComparisonSummary([londonRow]);
    expect(summary.includes('London')).toBe(true);
  });
});

describe('Discount, VAT & Margin Calculator', () => {
  it('calculates stacked discounts and saved amounts', () => {
    // $100 with 20% off + extra 10% off
    const res = calculateDiscount(100, 20, 10, 0);
    expect(res.finalPrice).toBe(72);
    expect(res.totalSaved).toBeCloseTo(28, 2);
    expect(res.effectiveDiscountPercent).toBeCloseTo(28, 2);
  });

  it('calculates VAT addition and reverse VAT extraction accurately', () => {
    const added = calculateVatAdd(100, 20);
    expect(added.netAmount).toBe(100);
    expect(added.taxAmount).toBe(20);
    expect(added.grossAmount).toBe(120);

    const extracted = calculateVatExtract(120, 20);
    expect(extracted.netAmount).toBeCloseTo(100, 2);
    expect(extracted.taxAmount).toBeCloseTo(20, 2);
  });

  it('calculates gross profit, margin %, and markup % correctly', () => {
    // Cost $60, Revenue $100 -> Profit $40, Margin 40%, Markup 66.67%
    const res = calculateFromCostAndRevenue(60, 100);
    expect(res.profit).toBe(40);
    expect(res.marginPercent).toBe(40);
    expect(res.markupPercent).toBeCloseTo(66.666, 1);
  });
});

describe('Tool 21: Image Optimizer & Resizer', () => {
  it('calculates aspect ratios and reduces common fractions accurately', () => {
    expect(calculateAspectRatio(1920, 1080)).toBe('16:9');
    expect(calculateAspectRatio(800, 600)).toBe('4:3');
    expect(calculateAspectRatio(1000, 1000)).toBe('1:1');
  });

  it('calculates target dimensions with lockAspectRatio and preventUpscale options', () => {
    // 1920x1080 scaled to width 960 with locked aspect
    const dims = calculateTargetDimensions(1920, 1080, 960, 540, true, false);
    expect(dims.width).toBe(960);
    expect(dims.height).toBe(540);

    // Prevent upscale: original 800x600, requested 1600x1200 with preventUpscale: true
    const dimsUpscale = calculateTargetDimensions(800, 600, 1600, 1200, true, true);
    expect(dimsUpscale.width).toBe(800);
    expect(dimsUpscale.height).toBe(600);
  });

  it('formats image byte sizes correctly', () => {
    expect(formatImageFileSize(512)).toBe('512 B');
    expect(formatImageFileSize(1048576 * 2.5)).toBe('2.50 MB');
  });
});

describe('Tool 22: Background Remover', () => {
  it('supports background composition configurations', () => {
    const options: BgRemoverOptions = {
      backgroundStyle: 'white',
      customColor: '#ffffff',
      smoothing: 2,
      feather: 2,
      quality: 0.9,
      format: 'image/png',
    };
    expect(options.backgroundStyle).toBe('white');
    expect(options.format).toBe('image/png');
  });
});

describe('Tool 23: OCR Image to Text', () => {
  it('provides supported ISO OCR language models list', () => {
    expect(SUPPORTED_OCR_LANGUAGES.length).toBeGreaterThanOrEqual(4);
    const eng = SUPPORTED_OCR_LANGUAGES.find((l) => l.id === 'eng');
    expect(eng).toBeDefined();
    expect(eng?.label).toContain('English');
  });
});

describe('Tool 24 & 25: Media Recorders (Audio & Screen)', () => {
  it('formats screen and audio recording durations correctly', () => {
    expect(formatRecordingDuration(0)).toBe('00:00');
    expect(formatRecordingDuration(65)).toBe('01:05');
    expect(formatRecordingDuration(3665)).toBe('01:01:05');
  });

  it('formats byte sizes accurately', () => {
    expect(formatByteSize(500)).toBe('500 B');
    expect(formatByteSize(1024 * 2.5)).toBe('2.5 KB');
    expect(formatByteSize(1024 * 1024 * 3.5)).toBe('3.50 MB');
  });

  it('detects video mime type fallback gracefully', () => {
    const mime = getSupportedVideoMimeType();
    expect(mime).toMatch(/video\/(webm|mp4)/);
  });
});

describe('Tool 21: Image Collage Maker', () => {
  it('calculates optimal grid dimensions for auto, strips, and custom grids', () => {
    expect(calculateGridDimensions('auto', 1)).toEqual({ rows: 1, cols: 1, totalCells: 1 });
    expect(calculateGridDimensions('auto', 4)).toEqual({ rows: 2, cols: 2, totalCells: 4 });
    expect(calculateGridDimensions('2-horizontal', 2)).toEqual({ rows: 1, cols: 2, totalCells: 2 });
    expect(calculateGridDimensions('2-vertical', 2)).toEqual({ rows: 2, cols: 1, totalCells: 2 });
    expect(calculateGridDimensions('h-strip', 5)).toEqual({ rows: 1, cols: 5, totalCells: 5 });
    expect(calculateGridDimensions('v-strip', 3)).toEqual({ rows: 3, cols: 1, totalCells: 3 });
    expect(calculateGridDimensions('custom', 6, 2, 3)).toEqual({ rows: 2, cols: 3, totalCells: 6 });
  });

  it('calculates correct canvas dimensions for aspect ratio presets', () => {
    const grid = { rows: 2, cols: 2, totalCells: 4 };
    const square = calculateCanvasSize('1:1', 1200, 1200, grid);
    expect(square).toEqual({ width: 1200, height: 1200 });

    const widescreen = calculateCanvasSize('16:9', 1600, 900, grid);
    expect(widescreen).toEqual({ width: 1600, height: 900 });

    const photo43 = calculateCanvasSize('4:3', 1200, 900, grid);
    expect(photo43).toEqual({ width: 1200, height: 900 });
  });
});

describe('Tool 26: Text to Speech (TTS)', () => {
  it('chunks long text into conversational speech segments', () => {
    const text = 'Hello world! Welcome to Tiny Tools. How are you doing today? Great to see you.';
    const chunks = chunkTextForSpeech(text, 50);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].text).toBe('Hello world!');
    expect(chunks[0].charStart).toBe(0);
  });
});

describe('Tool 27: Random Picker & Team Generator', () => {
  it('parses input lines into clean non-empty items', () => {
    const raw = ' Alice \n\n Bob \n Charlie \n   ';
    const items = parseItemsList(raw);
    expect(items).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('picks exactly one item and returns remaining list', () => {
    const items = ['A', 'B', 'C'];
    const res = pickRandomOne(items);
    expect(res).not.toBeNull();
    expect(items.includes(res!.winner)).toBe(true);
    expect(res!.remaining.length).toBe(2);
    expect(res!.remaining.includes(res!.winner)).toBe(false);
  });

  it('picks unique random items without duplicates using Web Crypto', () => {
    const items = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
    const winners = pickRandomItems(items, 3, false);
    expect(winners.length).toBe(3);
    const uniqueWinners = new Set(winners);
    expect(uniqueWinners.size).toBe(3);
  });

  it('generates deranged Secret Santa pairings where no one is paired with themselves when self-pairing is disallowed', () => {
    const items = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
    const pairs = generateSecretSanta(items);
    expect(pairs.length).toBe(5);
    pairs.forEach((p) => {
      expect(p.giver).not.toBe(p.receiver);
    });
  });

  it('splits participants fairly into requested number of teams or target team size', () => {
    const items = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
    const teamsByCount = splitIntoTeams(items, 3, 'by-count');
    expect(teamsByCount.length).toBe(3);
    const totalMembers = teamsByCount.reduce((sum, t) => sum + t.members.length, 0);
    expect(totalMembers).toBe(7);

    const teamsBySize = splitIntoTeams(items, 2, 'by-size');
    expect(teamsBySize.length).toBeGreaterThanOrEqual(3);
  });

  it('generates 2-person pairs with clean trio handling when odd number of people', () => {
    const items = ['P1', 'P2', 'P3', 'P4', 'P5'];
    const resTrio = generateRandomPairs(items, 'trio');
    expect(resTrio.pairs.length).toBe(2);
    expect(resTrio.pairs[1].members.length).toBe(3); // formed trio

    const resBystander = generateRandomPairs(items, 'bystander');
    expect(resBystander.pairs.length).toBe(2);
    expect(resBystander.bystander).toBeDefined();
  });

  it('generates cryptographic random integers in range [0, max)', () => {
    for (let i = 0; i < 20; i++) {
      const rand = getCryptoRandomInt(10);
      expect(rand).toBeGreaterThanOrEqual(0);
      expect(rand).toBeLessThan(10);
    }
  });
});

describe('Tool 28: Recipe Scaler & Conversions', () => {
  it('accurately parses raw recipe text and scales ingredient quantities', () => {
    const rawRecipe = `Classic Cookies\nServes: 4\n• 2 cups all-purpose flour\n• 1 cup granulated sugar\n• 2 pcs eggs`;
    const doc = parseRawRecipeText(rawRecipe);
    expect(doc.servings).toBe(4);
    expect(doc.ingredients.length).toBe(3);

    // Scale 2x (from 4 servings to 8 servings)
    const scaled = scaleRecipe(doc, 8, 'original', true);
    expect(scaled.multiplier).toBe(2);
    expect(scaled.ingredients[0].formatted).toBe('4 cups');
    expect(scaled.ingredients[1].formatted).toBe('2 cup');
    expect(scaled.ingredients[2].formatted).toBe('4 pcs');

    const txt = formatScaledRecipeToText(scaled);
    expect(txt.includes('Servings: 8')).toBe(true);
  });

  it('performs density-based volume to mass conversion correctly', () => {
    // 1 cup of all-purpose flour = 120 grams
    const flourResult = convertVolumeToMass('all-purpose-flour', 1, 'cup');
    expect(flourResult).not.toBeNull();
    expect(flourResult?.grams).toBe(120);

    // 2 tbsp of granulated sugar = 2 * (200 / 16) = 25 grams
    const sugarResult = convertVolumeToMass('granulated-sugar', 2, 'tbsp');
    expect(sugarResult).not.toBeNull();
    expect(sugarResult?.grams).toBeCloseTo(25, 1);

    // 1 cup of water = 236.6 grams
    const waterResult = convertVolumeToMass('water', 1, 'cup');
    expect(waterResult).not.toBeNull();
    expect(waterResult?.grams).toBeCloseTo(236.6, 1);
  });

  it('converts cooking temperatures across Fahrenheit, Celsius, and Gas Marks', () => {
    // 350°F -> 177°C, Gas Mark 4
    const conv350F = convertCookingTemperature(350, 'f');
    expect(conv350F.celsius).toBe(177);
    expect(conv350F.gasMark).toBe('4');

    // 200°C -> 392°F, Gas Mark 6
    const conv200C = convertCookingTemperature(200, 'c');
    expect(conv200C.fahrenheit).toBe(392);
    expect(conv200C.gasMark).toBe('6');
  });
});

describe('Tool 29: Checklist & Packing List', () => {
  it('calculates completion metrics accurately', () => {
    const items = [
      { id: '1', text: 'Passport', completed: true },
      { id: '2', text: 'Tickets', completed: true },
      { id: '3', text: 'Sunscreen', completed: false },
      { id: '4', text: 'Hat', completed: false },
    ];
    const stats = calculateChecklistStats(items);
    expect(stats.total).toBe(4);
    expect(stats.completed).toBe(2);
    expect(stats.percent).toBe(50);
  });

  it('formats checklist to plain text representation with completion markers', () => {
    const list: ChecklistDoc = {
      id: 'travel',
      title: 'Vacation Checklist',
      updatedAt: Date.now(),
      items: [
        { id: '1', text: 'Passport', completed: true },
        { id: '2', text: 'Camera', completed: false },
      ],
    };
    const formatted = formatChecklistToText(list);
    expect(formatted.includes('Vacation Checklist')).toBe(true);
    expect(formatted.includes('[x] Passport')).toBe(true);
    expect(formatted.includes('[ ] Camera')).toBe(true);
  });

  it('provides built-in travel, camping, and moving templates', () => {
    expect(CHECKLIST_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    const travel = CHECKLIST_TEMPLATES.find((t) => t.id === 'travel');
    expect(travel).toBeDefined();
    expect(travel?.items.length).toBeGreaterThan(5);
  });

  it('defensively recovers from malformed or corrupted localStorage payloads', () => {
    expect(sanitizeChecklistStore(null)).toEqual(defaultChecklistStore);
    expect(sanitizeChecklistStore('garbage string')).toEqual(defaultChecklistStore);
    expect(sanitizeChecklistStore({ lists: [] })).toEqual(defaultChecklistStore);
    expect(sanitizeChecklistStore({ lists: [{ id: 'valid', title: 'Test', items: [] }] })).toEqual({
      version: 1,
      activeListId: 'valid',
      lists: [{ id: 'valid', title: 'Test', updatedAt: expect.any(Number), items: [] }],
    });
  });
});

describe('Tool 30: Quick Notepad', () => {
  it('calculates real-time word, character, and line count for notes', () => {
    const content = `# Meeting Notes\n- Review design specs\n- Finalize release candidate`;
    const stats = calculateNoteStats(content);
    expect(stats.words).toBe(11);
    expect(stats.lines).toBe(3);
    expect(stats.chars).toBe(content.length);
  });

  it('retrieves default notes store safely', () => {
    const store = getStoredNotes();
    expect(store.notes.length).toBeGreaterThanOrEqual(1);
    expect(store.activeNoteId).toBeDefined();
  });

  it('defensively recovers from malformed or corrupted localStorage payloads', () => {
    expect(sanitizeNotepadStore(null)).toEqual(defaultNotepadStore);
    expect(sanitizeNotepadStore('broken json')).toEqual(defaultNotepadStore);
    expect(sanitizeNotepadStore({ notes: [] })).toEqual(defaultNotepadStore);
    expect(sanitizeNotepadStore({ notes: [{ id: 'note-1', title: 'My Note', content: 'hello' }] })).toEqual({
      version: 1,
      activeNoteId: 'note-1',
      notes: [{ id: 'note-1', title: 'My Note', content: 'hello', updatedAt: expect.any(Number), isPinned: false }],
    });
  });
});
