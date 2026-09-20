import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStoredPreferences, savePreferences, toggleFavorite } from '../storage/preferences';
import { copyToClipboard } from '../utilities/clipboard';
import { downloadTextFile } from '../utilities/download';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('shared storage resilience', () => {
  it('falls back safely when the localStorage getter itself throws', () => {
    const fakeWindow = {};
    Object.defineProperty(fakeWindow, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: storage blocked');
      },
    });
    vi.stubGlobal('window', fakeWindow);

    expect(() => getStoredPreferences()).not.toThrow();
    expect(getStoredPreferences()).toMatchObject({ version: 1, theme: 'system', recents: [] });
    expect(() => savePreferences(getStoredPreferences())).not.toThrow();
    expect(() => toggleFavorite('word-counter')).not.toThrow();
  });

  it('falls back safely when storage methods throw', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
      },
    });

    expect(getStoredPreferences().theme).toBe('system');
    expect(() => savePreferences(getStoredPreferences())).not.toThrow();
  });
});

describe('shared clipboard fallback cleanup', () => {
  it('removes the temporary textarea even when execCommand throws', async () => {
    const remove = vi.fn();
    const textArea = {
      value: '',
      style: {} as Record<string, string>,
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
      remove,
    };
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', {
      createElement: vi.fn(() => textArea),
      body: { appendChild: vi.fn() },
      execCommand: vi.fn(() => { throw new Error('copy blocked'); }),
    });

    await expect(copyToClipboard('hello')).resolves.toBe(false);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('shared download lifecycle', () => {
  it('delays object URL revocation until after the browser can consume the click', () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = { href: '', download: '', style: {} as Record<string, string>, click, remove };
    const appendChild = vi.fn();
    const revokeObjectURL = vi.fn();

    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild },
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:tiny-tools-test'),
      revokeObjectURL,
    });

    expect(downloadTextFile('report.txt', 'hello')).toBe(true);
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1499);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:tiny-tools-test');
  });
});
