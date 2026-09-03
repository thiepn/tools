import { describe, expect, it } from 'vitest';
import { isModuleLoadError } from '../utilities/module-load-recovery';

describe('module-load recovery classification', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://thiepn.dev/tools/assets/Tool-old.js',
    'error loading dynamically imported module: https://thiepn.dev/tools/assets/Tool-old.js',
    'Importing a module script failed.',
    'Failed to load module script: Expected a JavaScript-or-Wasm module script',
    'ChunkLoadError: Loading chunk 42 failed.',
    'Unable to preload CSS for /tools/assets/tool-old.css',
  ])('recognizes recoverable asset/import failures: %s', (message) => {
    expect(isModuleLoadError(new TypeError(message))).toBe(true);
  });

  it.each([
    'Cannot read properties of undefined',
    'Canvas rendering failed',
    'Invalid QR input',
    'Quota exceeded while saving a preference',
    'Permission denied',
  ])('does not classify normal tool/runtime errors as chunk failures: %s', (message) => {
    expect(isModuleLoadError(new Error(message))).toBe(false);
  });

  it('recognizes a module failure wrapped as an error cause', () => {
    const error = new Error('Tool bootstrap failed', {
      cause: new TypeError('Failed to fetch dynamically imported module'),
    });
    expect(isModuleLoadError(error)).toBe(true);
  });
});
