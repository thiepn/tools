/**
 * Passport & ID Photo Maker Utility
 * Physical unit conversion (mm, inch, px at DPI), passport presets, alignment guides, and print sheet layout calculator
 */

export interface IdPhotoPreset {
  id: string;
  name: string;
  countryGuidance: string;
  widthMm: number;
  heightMm: number;
  headMinPercent: number; // Head height as % of photo height (typically 70-80%)
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

/**
 * Converts millimeters to pixels given a DPI (default 300)
 */
export function mmToPixels(mm: number, dpi = 300): number {
  if (mm <= 0 || dpi <= 0) return 0;
  return Math.round((mm / 25.4) * dpi);
}

/**
 * Converts inches to pixels given a DPI (default 300)
 */
export function inchToPixels(inches: number, dpi = 300): number {
  if (inches <= 0 || dpi <= 0) return 0;
  return Math.round(inches * dpi);
}

/**
 * Converts pixels to millimeters given a DPI
 */
export function pixelsToMm(pixels: number, dpi = 300): number {
  if (pixels <= 0 || dpi <= 0) return 0;
  return Number(((pixels * 25.4) / dpi).toFixed(1));
}

/**
 * Converts pixels to inches given a DPI
 */
export function pixelsToInches(pixels: number, dpi = 300): number {
  if (pixels <= 0 || dpi <= 0) return 0;
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

/**
 * Calculates optimal grid tiling of passport photos on a print sheet
 */
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
  const marginMm = options.marginMm ?? 5;
  const gapMm = options.gapMm ?? 3;

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

  const columns = Math.max(1, Math.floor((availableWidth + gapXPx) / (photoWidthPx + gapXPx)));
  const rows = Math.max(1, Math.floor((availableHeight + gapYPx) / (photoHeightPx + gapYPx)));
  const maxCopies = columns * rows;

  const actualCopies = options.requestedCopies && options.requestedCopies > 0
    ? Math.min(options.requestedCopies, maxCopies)
    : maxCopies;

  // Compute centered offset
  const gridContentW = columns * photoWidthPx + (columns - 1) * gapXPx;
  const gridContentH = rows * photoHeightPx + (rows - 1) * gapYPx;
  const startX = Math.max(marginXPx, Math.round((sheetWidthPx - gridContentW) / 2));
  const startY = Math.max(marginYPx, Math.round((sheetHeightPx - gridContentH) / 2));

  const positions: { x: number; y: number; width: number; height: number }[] = [];

  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      if (count >= actualCopies) break;
      const x = startX + c * (photoWidthPx + gapXPx);
      const y = startY + r * (photoHeightPx + gapYPx);
      positions.push({
        x,
        y,
        width: photoWidthPx,
        height: photoHeightPx,
      });
      count++;
    }
    if (count >= actualCopies) break;
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

/**
 * Draws print cut marks (corner crosshairs or cut lines) on the print sheet
 */
export function drawPrintCutMarks(
  ctx: CanvasRenderingContext2D,
  positions: { x: number; y: number; width: number; height: number }[],
  cutLineColor = '#CCCCCC'
) {
  ctx.save();
  ctx.strokeStyle = cutLineColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (const pos of positions) {
    ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);
  }

  ctx.restore();
}
