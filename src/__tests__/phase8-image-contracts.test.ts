import { describe, expect, it } from 'vitest';
import { registerAllPublicTools } from '../registry/register-all';
import { TOOLS_REGISTRY } from '../registry/tools';
import {
  applyScalePreset,
  calculateAspectRatio,
  calculateTargetDimensions,
  generateOptimizedFilename,
  planImageProcessing,
} from '../utilities/image-optimizer';
import {
  applyCircularMaskBrush,
  assessMaskQuality,
  buildConnectedBackgroundMask,
  estimateBackgroundTolerance,
  estimateCornerBackgroundColor,
  refineAlphaMaskRgba,
} from '../utilities/background-remover';

registerAllPublicTools();

const IMAGE_ROUTE_IDS = [
  'image-optimizer',
  'image-annotator',
  'image-collage',
  'background-remover',
  'screenshot-stitcher',
  'id-photo-maker',
  'watermark-maker',
  'crop-image',
  'rotate-flip-image',
  'image-converter',
  'compress-image-to-size',
  'profile-picture-maker',
  'blur-pixelate-image',
  'privacy-blur-image',
  'image-metadata-cleaner',
  'social-media-image-resizer',
  'favicon-maker',
  'image-grid-splitter',
  'image-border-frame',
  'photo-filters',
  'image-compare',
  'background-changer',
  'transparent-image-maker',
  'contact-sheet-maker',
  'image-upscaler',
  'headshot-cropper',
  'image-enhancer',
  'object-remover',
  'old-photo-restorer',
  'perspective-corrector',
  'auto-deskew-image',
  'red-eye-remover',
].sort();

describe('Phase 8 image-family completeness', () => {
  it('covers exactly the complete 32-route image family', () => {
    const registryIds = TOOLS_REGISTRY
      .filter((tool) => tool.category === 'image')
      .map((tool) => tool.id)
      .sort();

    expect(registryIds).toHaveLength(32);
    expect(registryIds).toEqual(IMAGE_ROUTE_IDS);
  });

  it('tracks the two formerly fixture-blocked image workflows explicitly', () => {
    expect(IMAGE_ROUTE_IDS).toContain('image-optimizer');
    expect(IMAGE_ROUTE_IDS).toContain('background-remover');
  });
});

describe('Phase 8 image optimizer contracts', () => {
  it('reduces aspect ratios and preserves locked geometry', () => {
    expect(calculateAspectRatio(800, 400)).toBe('2:1');
    expect(calculateTargetDimensions(800, 400, 400, 400, true, true)).toEqual({
      width: 400,
      height: 200,
    });
  });

  it('applies deterministic presets without accidental upscaling', () => {
    expect(applyScalePreset(800, 400, '50%')).toEqual({ width: 400, height: 200 });
    expect(applyScalePreset(800, 400, '1920max')).toEqual({ width: 800, height: 400 });
    expect(calculateTargetDimensions(800, 400, 1600, 800, true, true)).toEqual({
      width: 800,
      height: 400,
    });
  });

  it('plans progressive downscale and bounded memory warnings', () => {
    const plan = planImageProcessing(4000, 3000, 1000, 750);
    expect(plan).toMatchObject({
      targetWidth: 1000,
      targetHeight: 750,
      pixelCount: 750000,
      requiresProgressiveDownscale: true,
    });
    expect(plan.estimatedWorkingBytes).toBeGreaterThan(4000 * 3000 * 4);
  });

  it('generates format-correct optimized filenames', () => {
    expect(generateOptimizedFilename('photo.JPG', 'image/png')).toBe('photo-optimized.png');
    expect(generateOptimizedFilename('portrait.png', 'image/webp')).toBe('portrait-optimized.webp');
    expect(generateOptimizedFilename('no-extension', 'image/jpeg')).toBe('no-extension-optimized.jpg');
  });
});

describe('Phase 8 deterministic background-mask contracts', () => {
  function fixture() {
    const width = 8;
    const height = 8;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const foreground = x >= 2 && x <= 5 && y >= 2 && y <= 5;
        rgba[i] = foreground ? 220 : 255;
        rgba[i + 1] = foreground ? 30 : 255;
        rgba[i + 2] = foreground ? 30 : 255;
        rgba[i + 3] = 255;
      }
    }
    return { width, height, rgba };
  }

  it('estimates the white connected background without consuming the red subject', () => {
    const { width, height, rgba } = fixture();
    const background = estimateCornerBackgroundColor(rgba, width, height);
    expect(background.r).toBeCloseTo(255, 8);
    expect(background.g).toBeCloseTo(255, 8);
    expect(background.b).toBeCloseTo(255, 8);

    const tolerance = estimateBackgroundTolerance(rgba, width, height, background);
    expect(tolerance).toBeGreaterThanOrEqual(28);
    expect(tolerance).toBeLessThanOrEqual(85);

    const mask = buildConnectedBackgroundMask(rgba, width, height, tolerance, background);
    expect([...mask].reduce((sum, value) => sum + value, 0)).toBe(48);
    expect(mask[0]).toBe(1);
    expect(mask[4 * width + 4]).toBe(0);
  });

  it('produces a 75% transparent / 25% opaque deterministic segmentation before feathering', () => {
    const { width, height, rgba } = fixture();
    const background = estimateCornerBackgroundColor(rgba, width, height);
    const mask = buildConnectedBackgroundMask(rgba, width, height, 45, background);
    const segmented = new Uint8ClampedArray(rgba);
    for (let p = 0; p < mask.length; p += 1) {
      if (mask[p]) segmented[p * 4 + 3] = 0;
    }

    const refined = refineAlphaMaskRgba(segmented, width, height, 0, 0);
    expect(assessMaskQuality(refined, width, height)).toEqual({
      transparentPercent: 75,
      opaquePercent: 25,
      edgePercent: 0,
    });
  });

  it('supports deterministic erase and restore brush refinement', () => {
    const { width, height, rgba } = fixture();
    const erased = applyCircularMaskBrush(
      rgba,
      rgba,
      width,
      height,
      [{ x: 4, y: 4 }],
      2,
      'erase'
    );
    expect(erased[(4 * width + 4) * 4 + 3]).toBeLessThan(255);

    const restored = applyCircularMaskBrush(
      erased,
      rgba,
      width,
      height,
      [{ x: 4, y: 4 }],
      2,
      'restore'
    );
    expect(restored[(4 * width + 4) * 4 + 3]).toBe(255);
  });
});
