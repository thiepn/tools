import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeTextDiff, computeWordDiff, detectMovedLines, generateUnifiedDiffPatch } from '../utilities/text-diff';
import { analyzeAudioBuffer, findActiveAudioRange } from '../utilities/audio-recorder';
import { cleanText, defaultCleanerOptions } from '../utilities/text-cleaner';
import { planImageProcessing } from '../utilities/image-optimizer';
import { analyzeRecipeScaling, calculateBakersPercentages, canonicalizeCulinaryUnit, type RecipeDoc } from '../utilities/recipe-scaler';
import { numericSort, setOperation, sortByDelimitedColumn } from '../utilities/list-processor';
import { TIME_SIGNATURES, calculateSwingPairMs, calculateTempoStability } from '../utilities/metronome';
import { formatTranscriptToSrt, normalizeTranscriptSegments } from '../utilities/speech-to-text';
import { planScreenRecording } from '../utilities/screen-recorder';
import { assessDocumentQuad } from '../utilities/document-scanner';
import { ID_PHOTO_PRESETS, assessManualIdPhotoFraming, chooseBestPrintOrientation } from '../utilities/id-photo-maker';
import { estimateOcrDeskewAngle } from '../utilities/image-ocr';
import { chunkTextForSpeech, inferSpeechLanguageHint } from '../utilities/text-to-speech';
import { boardStateToSvg, duplicateBoardElements, moveElementLayer, type BoardState } from '../utilities/whiteboard';
import { normalizeMemeTextBox, parseMemeProject, serializeMemeProject, type MemeProject } from '../utilities/meme-maker';
import { quantizeRgbaWithDither } from '../utilities/gif-maker';
import { planVideoExport, type VideoProcessingOptions } from '../utilities/video-toolkit';
import { auditRecurringMeeting, findOffsetTransitions } from '../utilities/time-zone-converter';
import { assessMaskQuality, decontaminateForegroundEdges } from '../utilities/background-remover';
import { deltaE2000, type LabColor } from '../utilities/palette-extractor';
import { calculateCellRects, parseCollageProject, serializeCollageProject, type CollageConfig, type CollageItem } from '../utilities/image-collage';
import { calculateOverlapConfidence, summarizeStitchConfidence, type StitchItem } from '../utilities/screenshot-stitcher';
import { calculateCueTimeline, calculatePaceDrift } from '../utilities/teleprompter';
import { parseSignatureProject, serializeSignatureProject, signatureStrokesToSvg, type SignatureStroke } from '../utilities/signature';
import { getOverdueChecklistItems, serializeChecklistCsv, sortChecklistItems, type ChecklistDoc } from '../utilities/checklist';
import { calculateNoteStats, findDuplicateNotes, parsePortableNotepadBackup, serializePortableNotepadBackup, type NotepadStore } from '../utilities/quick-notepad';

const source = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('Final 27 A-tier to S-tier certification regressions', () => {
  it('Text Diff handles Unicode tokens, moved lines, and unified patches', () => {
    const tokens = computeWordDiff('안녕하세요 세계', '안녕하세요 새로운 세계');
    expect(tokens.some((token) => token.added && token.text.includes('새로운'))).toBe(true);
    const summary = computeTextDiff('alpha\nbeta\ngamma', 'beta\nalpha\ngamma');
    expect(detectMovedLines(summary).length).toBeGreaterThan(0);
    expect(generateUnifiedDiffPatch('a\nb', 'a\nc')).toContain('@@');
  });

  it('Audio Recorder analyzes clipping and proposes silence trimming', () => {
    const samples = new Float32Array([0, 0, 0, 0.05, 0.8, 1, 0.7, 0.04, 0, 0]);
    const fake = {
      numberOfChannels: 1,
      sampleRate: 10,
      length: samples.length,
      duration: 1,
      getChannelData: () => samples,
    } as unknown as AudioBuffer;
    const analysis = analyzeAudioBuffer(fake, 0.99);
    expect(analysis.clippedSamples).toBe(1);
    expect(analysis.peak).toBe(1);
    const active = findActiveAudioRange(fake, -30, 0);
    expect(active.startSeconds).toBeGreaterThanOrEqual(0);
    expect(active.endSeconds).toBeLessThanOrEqual(1);
  });

  it('Text Cleaner normalizes Unicode while preserving fenced code spacing', () => {
    const input = 'Cafe\u0301   text\n\n```js\nconst  x =  1;\n```';
    const result = cleanText(input, { ...defaultCleanerOptions, unicodeNormalization: 'NFC', preserveFencedCodeBlocks: true });
    expect(result.output).toContain('Café text');
    expect(result.output).toContain('const  x =  1;');
    expect(result.stats.unicodeChanged).toBe(true);
  });

  it('Timer completion is backed by multi-pattern WebAudio plus vibration fallback', () => {
    const audio = source('src/utilities/timer-audio.ts');
    const component = source('src/tools/timer-stopwatch/TimerStopwatchTool.tsx');
    expect(audio).toContain("export type TimerChimePattern='completion'|'focus'|'break'");
    expect(audio).toContain('navigator.vibrate');
    expect(component).toContain('visibilitychange');
    expect(component).toContain('primeTimerAudio');
  });

  it('Image Optimizer detects progressive-downscale and browser-memory risk', () => {
    const plan = planImageProcessing(8000, 6000, 800, 600);
    expect(plan.requiresProgressiveDownscale).toBe(true);
    expect(plan.estimatedWorkingBytes).toBeGreaterThan(0);
    expect(planImageProcessing(12000, 10000, 9000, 6000).warnings.length).toBeGreaterThan(0);
  });

  it('Recipe Scaler understands aliases, scaling hazards, and baker percentages', () => {
    expect(canonicalizeCulinaryUnit('cups')).toBe('cup');
    const recipe: RecipeDoc = { id: 'r', title: 'Test', servings: 4, ingredients: [{ id: '1', amount: 2, unit: 'eggs', name: 'Eggs' }] };
    expect(analyzeRecipeScaling(recipe, 5).warnings.some((w) => w.includes('whole-item'))).toBe(true);
    expect(calculateBakersPercentages([{ name: 'Flour', grams: 500 }, { name: 'Water', grams: 350 }])[1].percent).toBe(70);
  });

  it('List Processor performs international numeric, set, and delimited-column operations', () => {
    expect(numericSort(['1.234,5', '20', '3'], true).items[0]).toBe('3');
    expect(setOperation(['A', 'B'], ['b', 'C'], 'union', false)).toEqual(['A', 'B', 'C']);
    expect(sortByDelimitedColumn(['b,20', 'a,3'], 1, ',', true)).toEqual(['a,3', 'b,20']);
    expect(source('src/utilities/list-processor.ts')).toContain('getRandomValues');
  });

  it('Metronome supports compound meters, swing, and tap-stability analysis', () => {
    expect(TIME_SIGNATURES['9/8'].grouping).toEqual([3, 3, 3]);
    expect(calculateSwingPairMs(120, 60)).toEqual([300, 200]);
    const stability = calculateTempoStability([0, 500, 1005, 1500, 2000]);
    expect(stability.bpmStdDev).toBeLessThan(2);
  });

  it('Speech to Text normalizes overlapping cues and exports sanitized SRT', () => {
    const normalized = normalizeTranscriptSegments([
      { id: 'a', start: 1, end: 3, text: '  Hello   world  ' },
      { id: 'b', start: 2, end: 4, text: 'Second cue' },
    ]);
    expect(normalized[1].start).toBe(3);
    const srt = formatTranscriptToSrt(normalized);
    expect(srt).toContain('00:00:01,000 --> 00:00:03,000');
    expect(srt).toContain('Hello world');
  });

  it('Screen Recorder plans bitrate, size, and high-load warnings', () => {
    const plan = planScreenRecording(3840, 2160, 60, 'high', true);
    expect(plan.videoBitsPerSecond).toBeGreaterThan(1_000_000);
    expect(plan.estimatedBytesPerMinute).toBeGreaterThan(0);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('Document Scanner scores valid page quads and exposes auto-page proposals', () => {
    const score = assessDocumentQuad([{ x: 10, y: 10 }, { x: 990, y: 20 }, { x: 980, y: 780 }, { x: 20, y: 790 }], 1000, 800);
    expect(score.score).toBeGreaterThan(80);
    expect(source('src/utilities/document-scanner.ts')).toContain('detectDocumentCornersFromRgba');
  });

  it('ID Photo Maker audits manual framing and chooses the best print orientation', () => {
    const preset = ID_PHOTO_PRESETS.find((p) => p.id === 'eu-standard')!;
    const framing = assessManualIdPhotoFraming(preset, 10, 80, 42);
    expect(framing.headSizePass).toBe(true);
    expect(framing.verticalCenterPass).toBe(true);
    const best = chooseBestPrintOrientation(152.4, 101.6, 35, 45);
    expect(best.layout.maxCopies).toBeGreaterThan(0);
  });

  it('OCR has deskew analysis and a warm-worker batch workflow', () => {
    const blank = new Uint8ClampedArray(64 * 64 * 4).fill(255);
    expect(estimateOcrDeskewAngle(blank, 64, 64)).toBe(0);
    const utility = source('src/utilities/image-ocr.ts');
    expect(utility).toContain('performBatchLocalOcr');
    expect(utility).toContain('Using warm OCR model');
  });

  it('Text to Speech segments CJK punctuation and infers local language hints', () => {
    expect(inferSpeechLanguageHint('안녕하세요. 반갑습니다.')).toBe('ko-KR');
    const chunks = chunkTextForSpeech('こんにちは。次の文です。', 20);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.map((c) => c.text).join('')).toContain('次の文');
  });

  it('Whiteboard supports vector export, layer ordering, and duplication', () => {
    const state: BoardState = { version: 1, id: 'b', title: 'Board', background: 'white', updatedAt: 1, elements: [
      { id: 'a', type: 'rectangle', x: 10, y: 10, width: 100, height: 50, color: '#000', strokeWidth: 2, opacity: 1 },
      { id: 'b', type: 'text', x: 20, y: 20, color: '#111', strokeWidth: 1, opacity: 1, text: 'Hello', fontSize: 18 },
    ] };
    expect(boardStateToSvg(state)).toContain('<rect');
    expect(moveElementLayer(state.elements, 'a', 'front').at(-1)?.id).toBe('a');
    expect(duplicateBoardElements(state.elements, ['b'])).toHaveLength(3);
  });

  it('Meme Maker normalizes safe areas and round-trips portable projects', () => {
    const project: MemeProject = { version: 1, config: { preset: 'top-bottom', aspectRatio: '1:1', backgroundColor: '#fff', headerPaddingTop: 0 }, textBoxes: [
      { id: 't', text: 'Hello', xPercent: 500, yPercent: -10, fontSize: 400, fontFamily: 'Impact', color: '#fff', strokeColor: '#000', strokeWidth: 4, isUppercase: true, alignment: 'center', rotationDeg: 0 },
    ] };
    const parsed = parseMemeProject(serializeMemeProject(project))!;
    const normalized = normalizeMemeTextBox(parsed.textBoxes[0]);
    expect(normalized.xPercent).toBe(98);
    expect(normalized.yPercent).toBe(2);
    expect(normalized.fontSize).toBe(160);
  });

  it('GIF Maker dithers pixels against the adaptive palette engine', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
    const palette: [number, number, number][] = [[0, 0, 0], [255, 0, 0], [0, 0, 255], [255, 255, 255]];
    const indexed = quantizeRgbaWithDither(rgba, palette, 2, 2, true);
    expect(indexed).toHaveLength(4);
    expect(source('src/utilities/gif-maker.ts')).toContain('coalesceIdenticalGifFrames');
  });

  it('Video Toolkit produces bounded browser export feasibility plans', () => {
    const options: VideoProcessingOptions = { trimStart: 0, trimEnd: 3600, cropPreset: 'free', rotation: 0, flipHorizontal: false, flipVertical: false, resizeMode: '1080p', preserveAspectRatio: true, playbackSpeed: 1, muteAudio: false, volume: 1 };
    const plan = planVideoExport({ width: 3840, height: 2160, duration: 3600 }, options, 'high', 60);
    expect(plan.width).toBeLessThanOrEqual(1920);
    expect(plan.estimatedBytes).toBeGreaterThan(0);
    expect(plan.warnings.some((w) => w.includes('real time'))).toBe(true);
  });

  it('Time Zone finds DST transitions and audits recurring local-time drift', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-12-31T23:59:59Z');
    const transitions = findOffsetTransitions('America/New_York', start, end);
    expect(transitions).toHaveLength(2);
    const audit = auditRecurringMeeting(new Date('2026-03-01T15:00:00Z'), ['America/New_York', 'Europe/Berlin'], 8, 7);
    expect(audit.hasDstDrift).toBe(true);
  });

  it('Background Remover measures masks and decontaminates semi-transparent edges', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 0, 240, 200, 200, 128, 10, 10, 10, 255]);
    const quality = assessMaskQuality(rgba, 3, 1);
    expect(quality.transparentPercent).toBeGreaterThan(30);
    expect(quality.edgePercent).toBeGreaterThan(30);
    const cleaned = decontaminateForegroundEdges(rgba, 3, 1, { r: 255, g: 255, b: 255 });
    expect(cleaned[4]).toBeLessThan(rgba[4]);
  });

  it('Palette Extractor uses CIEDE2000 perceptual color difference', () => {
    const a: LabColor = { l: 50, a: 2.6772, b: -79.7751 };
    const b: LabColor = { l: 50, a: 0, b: -82.7485 };
    expect(deltaE2000(a, b)).toBeCloseTo(2.0425, 3);
    expect(source('src/utilities/palette-extractor.ts')).toContain('buildContrastMatrix');
  });

  it('Collage centers partial rows and round-trips portable layout state', () => {
    const cells = calculateCellRects({ rows: 2, cols: 3, totalCells: 6 }, 4, 1200, 800, 10, 20);
    expect(cells[3].x).toBeGreaterThan(20);
    const config: CollageConfig = { layout: 'auto', customRows: 2, customCols: 3, aspectPreset: '1:1', targetWidth: 1000, targetHeight: 1000, gap: 10, padding: 10, borderRadius: 8, backgroundColor: '#fff', format: 'image/png', quality: 0.9 };
    const item = { id: '1', filename: 'a.jpg', fitMode: 'cover', offsetX: 0.5, offsetY: 0.5, zoom: 1 } as CollageItem;
    expect(parseCollageProject(serializeCollageProject(config, [item]))?.items[0].filename).toBe('a.jpg');
  });

  it('Screenshot Stitcher reports ambiguous seams and aggregate confidence', () => {
    expect(calculateOverlapConfidence(10, 40)).toBeGreaterThan(calculateOverlapConfidence(35, 40));
    const items = [
      { id: '1', file: {} as File, img: {} as HTMLImageElement, width: 100, height: 100, overlapPx: 0 },
      { id: '2', file: {} as File, img: {} as HTMLImageElement, width: 100, height: 100, overlapPx: 20, overlapConfidence: 0.2 },
      { id: '3', file: {} as File, img: {} as HTMLImageElement, width: 100, height: 100, overlapPx: 20, overlapConfidence: 0.8 },
    ] as StitchItem[];
    expect(summarizeStitchConfidence(items)).toMatchObject({ lowConfidenceJoins: 1, totalJoins: 2 });
    expect(source('src/utilities/screenshot-stitcher.ts')).toContain('featherPx');
  });

  it('Teleprompter provides cue timelines and live pace drift', () => {
    const script = 'Opening paragraph with several words.\n\n[[cue: Key Point]]\n\nSecond paragraph continues here.';
    const cues = calculateCueTimeline(script, 120);
    expect(cues).toHaveLength(1);
    expect(cues[0].label).toBe('Key Point');
    expect(calculatePaceDrift(120, 0.5, 75).status).toBe('behind');
  });

  it('Signature Maker exports pressure-aware SVG and portable stroke projects', () => {
    const strokes: SignatureStroke[] = [{ color: '#111111', width: 4, points: [{ x: 10, y: 10, pressure: 0.2 }, { x: 20, y: 20, pressure: 0.9 }, { x: 40, y: 15, pressure: 0.5 }] }];
    const svg = signatureStrokesToSvg(strokes);
    expect(svg).toContain('<path');
    expect(parseSignatureProject(serializeSignatureProject(strokes))?.[0].points).toHaveLength(3);
  });

  it('Checklist sorts due work, detects overdue items, and exports CSV', () => {
    const list: ChecklistDoc = { id: 'l', title: 'Launch', updatedAt: 1, items: [
      { id: 'a', text: 'Later', completed: false, priority: 'low', dueDate: '2026-09-10' },
      { id: 'b', text: 'Soon', completed: false, priority: 'high', dueDate: '2026-08-30', category: 'release' },
    ] };
    expect(sortChecklistItems(list.items, 'due')[0].id).toBe('b');
    expect(getOverdueChecklistItems(list.items, new Date('2026-08-31T12:00:00')).map((i) => i.id)).toContain('b');
    expect(serializeChecklistCsv(list)).toContain('due_date');
  });

  it('Quick Notepad uses Unicode stats, duplicate fingerprints, and integrity-checked backups', () => {
    const store: NotepadStore = { version: 1, activeNoteId: 'a', notes: [
      { id: 'a', title: '한국어', content: '안녕하세요 세계', updatedAt: 2 },
      { id: 'b', title: '한국어', content: '안녕하세요 세계', updatedAt: 1 },
    ] };
    expect(calculateNoteStats(store.notes[0].content).words).toBeGreaterThanOrEqual(2);
    expect(findDuplicateNotes(store.notes)).toHaveLength(1);
    const backup = serializePortableNotepadBackup(store, new Date('2026-08-31T00:00:00Z'));
    expect(parsePortableNotepadBackup(backup)?.notes).toHaveLength(2);
  });
});
