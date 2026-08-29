export type CollageLayoutType =
  | 'auto'
  | '2-horizontal'
  | '2-vertical'
  | 'before-after'
  | '2x2'
  | '3x3'
  | 'h-strip'
  | 'v-strip'
  | 'custom';

export type AspectRatioPreset = 'auto' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16' | 'custom';

export type FitMode = 'cover' | 'contain';

export interface CollageItem {
  id: string;
  blob: Blob;
  dataUrl: string;
  imgElement?: HTMLImageElement;
  filename: string;
  naturalWidth: number;
  naturalHeight: number;
  fitMode: FitMode;
  offsetX: number; // 0 to 1 (0.5 is centered)
  offsetY: number; // 0 to 1 (0.5 is centered)
  zoom: number; // 1.0 to 3.0
}

export interface CollageConfig {
  layout: CollageLayoutType;
  customRows: number;
  customCols: number;
  aspectPreset: AspectRatioPreset;
  targetWidth: number;
  targetHeight: number;
  gap: number; // in pixels
  padding: number; // in pixels
  borderRadius: number; // in pixels
  backgroundColor: string;
  format: 'image/png' | 'image/jpeg' | 'image/webp';
  quality: number; // 0.1 to 1.0
}

export interface GridDimensions {
  rows: number;
  cols: number;
  totalCells: number;
}

/**
 * Calculates rows and columns for a given layout and item count
 */
export function calculateGridDimensions(
  layout: CollageLayoutType,
  itemCount: number,
  customRows = 2,
  customCols = 2
): GridDimensions {
  const count = Math.max(1, itemCount);

  switch (layout) {
    case '2-horizontal':
      return { rows: 1, cols: 2, totalCells: 2 };
    case '2-vertical':
      return { rows: 2, cols: 1, totalCells: 2 };
    case 'before-after':
      return { rows: 1, cols: 2, totalCells: 2 };
    case '2x2':
      return { rows: 2, cols: 2, totalCells: 4 };
    case '3x3':
      return { rows: 3, cols: 3, totalCells: 9 };
    case 'h-strip':
      return { rows: 1, cols: count, totalCells: count };
    case 'v-strip':
      return { rows: count, cols: 1, totalCells: count };
    case 'custom':
      return {
        rows: Math.max(1, customRows),
        cols: Math.max(1, customCols),
        totalCells: Math.max(1, customRows) * Math.max(1, customCols),
      };
    case 'auto':
    default: {
      if (count <= 1) return { rows: 1, cols: 1, totalCells: 1 };
      if (count === 2) return { rows: 1, cols: 2, totalCells: 2 };
      if (count === 3) return { rows: 1, cols: 3, totalCells: 3 };
      if (count === 4) return { rows: 2, cols: 2, totalCells: 4 };
      if (count <= 6) return { rows: 2, cols: 3, totalCells: 6 };
      if (count <= 8) return { rows: 2, cols: 4, totalCells: 8 };
      if (count <= 9) return { rows: 3, cols: 3, totalCells: 9 };
      if (count <= 12) return { rows: 3, cols: 4, totalCells: 12 };
      if (count <= 16) return { rows: 4, cols: 4, totalCells: 16 };
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      return { rows, cols, totalCells: rows * cols };
    }
  }
}

/**
 * Calculates the target canvas width and height based on aspect ratio preset
 */
export function calculateCanvasSize(
  preset: AspectRatioPreset,
  baseWidth: number,
  baseHeight: number,
  grid: GridDimensions
): { width: number; height: number } {
  const boundedBaseWidth = Math.min(Math.max(400, baseWidth), 3840);

  switch (preset) {
    case '1:1':
      return { width: boundedBaseWidth, height: boundedBaseWidth };
    case '4:3':
      return { width: boundedBaseWidth, height: Math.round((boundedBaseWidth * 3) / 4) };
    case '3:2':
      return { width: boundedBaseWidth, height: Math.round((boundedBaseWidth * 2) / 3) };
    case '16:9':
      return { width: boundedBaseWidth, height: Math.round((boundedBaseWidth * 9) / 16) };
    case '9:16':
      return { width: boundedBaseWidth, height: Math.round((boundedBaseWidth * 16) / 9) };
    case 'custom':
      return {
        width: boundedBaseWidth,
        height: Math.min(Math.max(300, baseHeight), 3840),
      };
    case 'auto':
    default: {
      const estimatedHeight = Math.round((boundedBaseWidth * grid.rows) / Math.max(1, grid.cols));
      return { width: boundedBaseWidth, height: Math.min(Math.max(300, estimatedHeight), 3840) };
    }
  }
}

/**
 * Renders the collage onto a canvas
 */
export function renderCollageToCanvas(
  canvas: HTMLCanvasElement,
  items: CollageItem[],
  config: CollageConfig
): void {
  const grid = calculateGridDimensions(
    config.layout,
    items.length,
    config.customRows,
    config.customCols
  );

  const { width, height } = calculateCanvasSize(
    config.aspectPreset,
    config.targetWidth,
    config.targetHeight,
    grid
  );

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Background Fill
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // 2. Compute cell geometry
  const totalGapX = config.gap * (grid.cols - 1);
  const totalGapY = config.gap * (grid.rows - 1);
  const availableWidth = width - config.padding * 2 - totalGapX;
  const availableHeight = height - config.padding * 2 - totalGapY;

  const cellWidth = Math.max(1, availableWidth / grid.cols);
  const cellHeight = Math.max(1, availableHeight / grid.rows);

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cellIndex = row * grid.cols + col;
      if (cellIndex >= items.length) continue;

      const item = items[cellIndex];
      const img = item.imgElement;
      if (!img || !img.complete || img.naturalWidth === 0) continue;

      const cellX = config.padding + col * (cellWidth + config.gap);
      const cellY = config.padding + row * (cellHeight + config.gap);

      ctx.save();

      // Clip rounded corners if specified
      if (config.borderRadius > 0) {
        ctx.beginPath();
        const r = Math.min(config.borderRadius, cellWidth / 2, cellHeight / 2);
        ctx.roundRect(cellX, cellY, cellWidth, cellHeight, r);
        ctx.clip();
      } else {
        ctx.beginPath();
        ctx.rect(cellX, cellY, cellWidth, cellHeight);
        ctx.clip();
      }

      // Draw cell image based on fitMode
      if (item.fitMode === 'contain') {
        // Fit within cell maintaining aspect ratio
        const scale = Math.min(cellWidth / img.naturalWidth, cellHeight / img.naturalHeight) * (item.zoom || 1);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;
        const drawX = cellX + (cellWidth - drawW) * item.offsetX;
        const drawY = cellY + (cellHeight - drawH) * item.offsetY;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      } else {
        // Cover cell (Fill & Crop)
        const scale = Math.max(cellWidth / img.naturalWidth, cellHeight / img.naturalHeight) * (item.zoom || 1);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;
        const drawX = cellX + (cellWidth - drawW) * item.offsetX;
        const drawY = cellY + (cellHeight - drawH) * item.offsetY;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }

      // If Before / After layout, draw a subtle badge label
      if (config.layout === 'before-after' && (cellIndex === 0 || cellIndex === 1)) {
        const label = cellIndex === 0 ? 'BEFORE' : 'AFTER';
        ctx.font = 'bold 13px sans-serif';
        const paddingH = 10;
        const badgeH = 24;
        const textMetrics = ctx.measureText(label);
        const badgeW = textMetrics.width + paddingH * 2;
        const badgeX = cellX + 12;
        const badgeY = cellY + 12;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, badgeX + paddingH, badgeY + 16);
      }

      ctx.restore();
    }
  }
}
