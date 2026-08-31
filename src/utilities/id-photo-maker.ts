/** Passport & ID Photo Maker utilities: physical sizing, safe framing and print sheets. */
export interface IdPhotoPreset {
  id: string;
  name: string;
  countryGuidance: string;
  widthMm: number;
  heightMm: number;
  headMinPercent: number;
  headMaxPercent: number;
  recommendedDpi: number;
}

export const ID_PHOTO_PRESETS: IdPhotoPreset[] = [
  { id: 'eu-standard', name: '35 × 45 mm', countryGuidance: 'Common European passport/ID format; verify current issuing-authority rules.', widthMm: 35, heightMm: 45, headMinPercent: 70, headMaxPercent: 80, recommendedDpi: 300 },
  { id: 'us-passport', name: '2 × 2 inch (51 × 51 mm)', countryGuidance: 'United States passport/visa photo size; verify current State Department rules.', widthMm: 50.8, heightMm: 50.8, headMinPercent: 50, headMaxPercent: 69, recommendedDpi: 300 },
  { id: 'china-visa', name: '33 × 48 mm', countryGuidance: 'Common China visa/passport photo size; verify the specific application requirements.', widthMm: 33, heightMm: 48, headMinPercent: 68, headMaxPercent: 80, recommendedDpi: 300 },
  { id: 'canada-passport', name: '50 × 70 mm', countryGuidance: 'Canada passport photo size; verify current photographer and face-size requirements.', widthMm: 50, heightMm: 70, headMinPercent: 60, headMaxPercent: 75, recommendedDpi: 300 },
  { id: 'standard-30-40', name: '30 × 40 mm', countryGuidance: 'Generic 30 × 40 mm ID format; requirements vary by document and country.', widthMm: 30, heightMm: 40, headMinPercent: 65, headMaxPercent: 75, recommendedDpi: 300 },
  { id: 'custom', name: 'Custom Dimensions', countryGuidance: 'User-defined physical output size.', widthMm: 35, heightMm: 45, headMinPercent: 70, headMaxPercent: 80, recommendedDpi: 300 },
];

export interface PrintSheetPreset { id: string; name: string; widthMm: number; heightMm: number }
export const PRINT_SHEET_PRESETS: PrintSheetPreset[] = [
  { id: 'photo-4x6', name: '4 × 6 inch (10 × 15 cm)', widthMm: 152.4, heightMm: 101.6 },
  { id: 'a4', name: 'A4 Sheet (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  { id: 'a5', name: 'A5 Sheet (148 × 210 mm)', widthMm: 148, heightMm: 210 },
  { id: 'photo-5x7', name: '5 × 7 inch (13 × 18 cm)', widthMm: 177.8, heightMm: 127 },
];

export function mmToPixels(mm: number, dpi = 300): number { return Number.isFinite(mm) && Number.isFinite(dpi) && mm > 0 && dpi > 0 ? Math.round((mm / 25.4) * dpi) : 0; }
export function inchToPixels(inches: number, dpi = 300): number { return Number.isFinite(inches) && Number.isFinite(dpi) && inches > 0 && dpi > 0 ? Math.round(inches * dpi) : 0; }
export function pixelsToMm(pixels: number, dpi = 300): number { return Number.isFinite(pixels) && Number.isFinite(dpi) && pixels > 0 && dpi > 0 ? Number(((pixels * 25.4) / dpi).toFixed(1)) : 0; }
export function pixelsToInches(pixels: number, dpi = 300): number { return Number.isFinite(pixels) && Number.isFinite(dpi) && pixels > 0 && dpi > 0 ? Number((pixels / dpi).toFixed(2)) : 0; }

export interface CoverPlacement {
  scale: number;
  panX: number;
  panY: number;
  renderedWidth: number;
  renderedHeight: number;
  isUpscaled: boolean;
}

/**
 * Computes a cover transform that can never expose empty canvas edges.
 * Rotation is normalized to right angles because ID-photo framing should remain axis-aligned.
 */
export function calculateCoverPlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  zoom = 1,
  panX = 0,
  panY = 0,
  rotation = 0
): CoverPlacement {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every((v) => Number.isFinite(v) && v > 0)) {
    return { scale: 1, panX: 0, panY: 0, renderedWidth: targetWidth || 0, renderedHeight: targetHeight || 0, isUpscaled: false };
  }
  const normalizedRotation = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  const swapped = normalizedRotation === 90 || normalizedRotation === 270;
  const rotatedWidth = swapped ? sourceHeight : sourceWidth;
  const rotatedHeight = swapped ? sourceWidth : sourceHeight;
  const baseScale = Math.max(targetWidth / rotatedWidth, targetHeight / rotatedHeight);
  const scale = baseScale * Math.max(1, Number.isFinite(zoom) ? zoom : 1);
  const renderedWidth = rotatedWidth * scale;
  const renderedHeight = rotatedHeight * scale;
  const maxPanX = Math.max(0, (renderedWidth - targetWidth) / 2);
  const maxPanY = Math.max(0, (renderedHeight - targetHeight) / 2);
  return {
    scale,
    panX: Math.max(-maxPanX, Math.min(maxPanX, Number.isFinite(panX) ? panX : 0)),
    panY: Math.max(-maxPanY, Math.min(maxPanY, Number.isFinite(panY) ? panY : 0)),
    renderedWidth,
    renderedHeight,
    isUpscaled: scale > 1.0001,
  };
}

export interface SourceResolutionAssessment {
  adequate: boolean;
  sourceMegapixels: number;
  outputMegapixels: number;
  scaleFactor: number;
  message: string;
}
export function assessSourceResolution(sourceWidth: number, sourceHeight: number, outputWidth: number, outputHeight: number): SourceResolutionAssessment {
  const sourcePixels = Math.max(0, sourceWidth) * Math.max(0, sourceHeight);
  const outputPixels = Math.max(0, outputWidth) * Math.max(0, outputHeight);
  const scaleFactor = outputPixels > 0 && sourcePixels > 0 ? Math.sqrt(outputPixels / sourcePixels) : 0;
  const adequate = sourcePixels >= outputPixels && sourceWidth > 0 && sourceHeight > 0;
  return {
    adequate,
    sourceMegapixels: Number((sourcePixels / 1_000_000).toFixed(2)),
    outputMegapixels: Number((outputPixels / 1_000_000).toFixed(2)),
    scaleFactor: Number(scaleFactor.toFixed(2)),
    message: adequate ? 'Source resolution is sufficient for this nominal output size.' : 'Output requires upscaling; use a higher-resolution source when possible.',
  };
}

export interface SheetLayoutResult {
  sheetWidthPx: number; sheetHeightPx: number; photoWidthPx: number; photoHeightPx: number;
  columns: number; rows: number; maxCopies: number; actualCopies: number;
  positions: { x: number; y: number; width: number; height: number }[];
  marginXPx: number; marginYPx: number; gapXPx: number; gapYPx: number;
}
function emptyLayout(sheetWidthPx: number, sheetHeightPx: number, photoWidthPx: number, photoHeightPx: number, marginXPx: number, marginYPx: number, gapXPx: number, gapYPx: number): SheetLayoutResult {
  return { sheetWidthPx, sheetHeightPx, photoWidthPx, photoHeightPx, columns: 0, rows: 0, maxCopies: 0, actualCopies: 0, positions: [], marginXPx, marginYPx, gapXPx, gapYPx };
}

export function calculatePrintSheetLayout(
  sheetWidthMm: number,
  sheetHeightMm: number,
  photoWidthMm: number,
  photoHeightMm: number,
  options: { dpi?: number; requestedCopies?: number; marginMm?: number; gapMm?: number } = {}
): SheetLayoutResult {
  const dpi = Number.isFinite(options.dpi) && (options.dpi || 0) > 0 ? options.dpi! : 300;
  const marginMm = Math.max(0, options.marginMm ?? 5);
  const gapMm = Math.max(0, options.gapMm ?? 3);
  const sheetWidthPx = mmToPixels(sheetWidthMm, dpi), sheetHeightPx = mmToPixels(sheetHeightMm, dpi);
  const photoWidthPx = mmToPixels(photoWidthMm, dpi), photoHeightPx = mmToPixels(photoHeightMm, dpi);
  const marginXPx = mmToPixels(marginMm, dpi), marginYPx = mmToPixels(marginMm, dpi);
  const gapXPx = mmToPixels(gapMm, dpi), gapYPx = mmToPixels(gapMm, dpi);
  const availableWidth = sheetWidthPx - marginXPx * 2, availableHeight = sheetHeightPx - marginYPx * 2;
  if (availableWidth <= 0 || availableHeight <= 0 || photoWidthPx <= 0 || photoHeightPx <= 0) return emptyLayout(sheetWidthPx, sheetHeightPx, photoWidthPx, photoHeightPx, marginXPx, marginYPx, gapXPx, gapYPx);
  const columns = Math.floor((availableWidth + gapXPx) / (photoWidthPx + gapXPx));
  const rows = Math.floor((availableHeight + gapYPx) / (photoHeightPx + gapYPx));
  if (columns < 1 || rows < 1) return emptyLayout(sheetWidthPx, sheetHeightPx, photoWidthPx, photoHeightPx, marginXPx, marginYPx, gapXPx, gapYPx);
  const maxCopies = columns * rows;
  const requested = Number.isFinite(options.requestedCopies) ? Math.max(0, Math.floor(options.requestedCopies || 0)) : 0;
  const actualCopies = requested > 0 ? Math.min(requested, maxCopies) : maxCopies;
  const actualRows = Math.ceil(actualCopies / columns);
  const usedHeight = actualRows * photoHeightPx + Math.max(0, actualRows - 1) * gapYPx;
  const startY = Math.max(marginYPx, Math.round((sheetHeightPx - usedHeight) / 2));
  const positions: SheetLayoutResult['positions'] = [];
  let remaining = actualCopies;
  for (let row = 0; row < actualRows && remaining > 0; row++) {
    const itemsInRow = Math.min(columns, remaining);
    const rowWidth = itemsInRow * photoWidthPx + Math.max(0, itemsInRow - 1) * gapXPx;
    const startX = Math.max(marginXPx, Math.round((sheetWidthPx - rowWidth) / 2));
    for (let column = 0; column < itemsInRow; column++) positions.push({ x: startX + column * (photoWidthPx + gapXPx), y: startY + row * (photoHeightPx + gapYPx), width: photoWidthPx, height: photoHeightPx });
    remaining -= itemsInRow;
  }
  return { sheetWidthPx, sheetHeightPx, photoWidthPx, photoHeightPx, columns, rows, maxCopies, actualCopies, positions, marginXPx, marginYPx, gapXPx, gapYPx };
}

export function drawPrintCutMarks(ctx: CanvasRenderingContext2D, positions: { x: number; y: number; width: number; height: number }[], cutLineColor = '#CCCCCC') {
  ctx.save(); ctx.strokeStyle = cutLineColor; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  for (const pos of positions) ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);
  ctx.restore();
}
