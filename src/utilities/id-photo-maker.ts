/**
 * Passport & ID Photo Maker Utility
 * Physical unit conversion, passport presets, alignment guides and print-sheet layout.
 */

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
  {
    id: 'eu-standard',
    name: '35 × 45 mm',
    countryGuidance: 'EU, UK, Schengen, Australia, New Zealand, Singapore, Vietnam, etc.',
    widthMm: 35,
    heightMm: 45,
    headMinPercent: 70,
    headMaxPercent: 80,
    recommendedDpi: 300,
  },
  {
    id: 'us-passport',
    name: '2 × 2 inch (51 × 51 mm)',
    countryGuidance: 'United States Passport & Visa, India Visa, Philippines',
    widthMm: 50.8,
    heightMm: 50.8,
    headMinPercent: 50,
    headMaxPercent: 69,
    recommendedDpi: 300,
  },
  {
    id: 'china-visa',
    name: '33 × 48 mm',
    countryGuidance: 'China Visa & Passport',
    widthMm: 33,
    heightMm: 48,
    headMinPercent: 70,
    headMaxPercent: 80,
    recommendedDpi: 300,
  },
  {
    id: 'canada-passport',
    name: '50 × 70 mm',
    countryGuidance: 'Canada Passport & Permanent Resident',
    widthMm: 50,
    heightMm: 70,
    headMinPercent: 60,
    headMaxPercent: 75,
    recommendedDpi: 300,
  },
  {
    id: 'standard-30-40',
    name: '30 × 40 mm',
    countryGuidance: 'Brazil, Colombia, Japan Driver License, ID card',
    widthMm: 30,
    heightMm: 40,
    headMinPercent: 65,
    headMaxPercent: 75,
    recommendedDpi: 300,
  },
  {
    id: 'custom',
    name: 'Custom Dimensions',
    countryGuidance: 'Custom user-specified size in mm, inches, or pixels',
    widthMm: 35,
    heightMm: 45,
    headMinPercent: 70,
    headMaxPercent: 80,
    recommendedDpi: 300,
  },
];

export interface PrintSheetPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
}

export const PRINT_SHEET_PRESETS: PrintSheetPreset[] = [
  { id: 'photo-4x6', name: '4 × 6 inch (10 × 15 cm)', widthMm: 152.4, heightMm: 101.6 },
  { id: 'a4', name: 'A4 Sheet (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  { id: 'a5', name: 'A5 Sheet (148 × 210 mm)', widthMm: 148, heightMm: 210 },
  { id: 'photo-5x7', name: '5 × 7 inch (13 × 18 cm)', widthMm: 177.8, heightMm: 127 },
];

export function mmToPixels(mm: number, dpi = 300): number {
  if (!Number.isFinite(mm) || !Number.isFinite(dpi) || mm <= 0 || dpi <= 0) return 0;
  return Math.round((mm / 25.4) * dpi);
}

export function inchToPixels(inches: number, dpi = 300): number {
  if (!Number.isFinite(inches) || !Number.isFinite(dpi) || inches <= 0 || dpi <= 0) return 0;
  return Math.round(inches * dpi);
}

export function pixelsToMm(pixels: number, dpi = 300): number {
  if (!Number.isFinite(pixels) || !Number.isFinite(dpi) || pixels <= 0 || dpi <= 0) return 0;
  return Number(((pixels * 25.4) / dpi).toFixed(1));
}

export function pixelsToInches(pixels: number, dpi = 300): number {
  if (!Number.isFinite(pixels) || !Number.isFinite(dpi) || pixels <= 0 || dpi <= 0) return 0;
  return Number((pixels / dpi).toFixed(2));
}

export interface SheetLayoutResult {
  sheetWidthPx: number;
  sheetHeightPx: number;
  photoWidthPx: number;
  photoHeightPx: number;
  columns: number;
  rows: number;
  maxCopies: number;
  actualCopies: number;
  positions: { x: number; y: number; width: number; height: number }[];
  marginXPx: number;
  marginYPx: number;
  gapXPx: number;
  gapYPx: number;
}

function emptyLayout(
  sheetWidthPx: number,
  sheetHeightPx: number,
  photoWidthPx: number,
  photoHeightPx: number,
  marginXPx: number,
  marginYPx: number,
  gapXPx: number,
  gapYPx: number
): SheetLayoutResult {
  return {
    sheetWidthPx,
    sheetHeightPx,
    photoWidthPx,
    photoHeightPx,
    columns: 0,
    rows: 0,
    maxCopies: 0,
    actualCopies: 0,
    positions: [],
    marginXPx,
    marginYPx,
    gapXPx,
    gapYPx,
  };
}

/** Calculates a centered grid of passport photos on a print sheet. */
export function calculatePrintSheetLayout(
  sheetWidthMm: number,
  sheetHeightMm: number,
  photoWidthMm: number,
  photoHeightMm: number,
  options: {
    dpi?: number;
    requestedCopies?: number; // 0 for max fit
    marginMm?: number;
    gapMm?: number;
  } = {}
): SheetLayoutResult {
  const dpi = options.dpi || 300;
  const marginMm = Math.max(0, options.marginMm ?? 5);
  const gapMm = Math.max(0, options.gapMm ?? 3);

  const sheetWidthPx = mmToPixels(sheetWidthMm, dpi);
  const sheetHeightPx = mmToPixels(sheetHeightMm, dpi);
  const photoWidthPx = mmToPixels(photoWidthMm, dpi);
  const photoHeightPx = mmToPixels(photoHeightMm, dpi);
  const marginXPx = mmToPixels(marginMm, dpi);
  const marginYPx = mmToPixels(marginMm, dpi);
  const gapXPx = mmToPixels(gapMm, dpi);
  const gapYPx = mmToPixels(gapMm, dpi);

  const availableWidth = sheetWidthPx - marginXPx * 2;
  const availableHeight = sheetHeightPx - marginYPx * 2;

  if (availableWidth <= 0 || availableHeight <= 0 || photoWidthPx <= 0 || photoHeightPx <= 0) {
    return emptyLayout(sheetWidthPx, sheetHeightPx, photoWidthPx, photoHeightPx, marginXPx, marginYPx, gapXPx, gapYPx);
  }

  const columns = Math.floor((availableWidth + gapXPx) / (photoWidthPx + gapXPx));
  const rows = Math.floor((availableHeight + gapYPx) / (photoHeightPx + gapYPx));

  // Do not invent a 1×1 layout when the photo physically cannot fit inside the
  // printable area. The old Math.max(1, ...) behavior could draw off-sheet.
  if (columns < 1 || rows < 1) {
    return emptyLayout(sheetWidthPx, sheetHeightPx, photoWidthPx, photoHeightPx, marginXPx, marginYPx, gapXPx, gapYPx);
  }

  const maxCopies = columns * rows;
  const requestedCopies = Number.isFinite(options.requestedCopies)
    ? Math.max(0, Math.floor(options.requestedCopies || 0))
    : 0;
  const actualCopies = requestedCopies > 0 ? Math.min(requestedCopies, maxCopies) : maxCopies;
  const actualRows = Math.ceil(actualCopies / columns);
  const usedHeight = actualRows * photoHeightPx + Math.max(0, actualRows - 1) * gapYPx;
  const startY = Math.max(marginYPx, Math.round((sheetHeightPx - usedHeight) / 2));
  const positions: { x: number; y: number; width: number; height: number }[] = [];

  let remaining = actualCopies;
  for (let row = 0; row < actualRows && remaining > 0; row++) {
    const itemsInRow = Math.min(columns, remaining);
    const rowWidth = itemsInRow * photoWidthPx + Math.max(0, itemsInRow - 1) * gapXPx;
    const startX = Math.max(marginXPx, Math.round((sheetWidthPx - rowWidth) / 2));

    for (let column = 0; column < itemsInRow; column++) {
      positions.push({
        x: startX + column * (photoWidthPx + gapXPx),
        y: startY + row * (photoHeightPx + gapYPx),
        width: photoWidthPx,
        height: photoHeightPx,
      });
    }
    remaining -= itemsInRow;
  }

  return {
    sheetWidthPx,
    sheetHeightPx,
    photoWidthPx,
    photoHeightPx,
    columns,
    rows,
    maxCopies,
    actualCopies,
    positions,
    marginXPx,
    marginYPx,
    gapXPx,
    gapYPx,
  };
}

export function drawPrintCutMarks(
  ctx: CanvasRenderingContext2D,
  positions: { x: number; y: number; width: number; height: number }[],
  cutLineColor = '#CCCCCC'
) {
  ctx.save();
  ctx.strokeStyle = cutLineColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (const pos of positions) ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);
  ctx.restore();
}
