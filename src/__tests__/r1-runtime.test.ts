import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllTransfers,
  consumePendingImageTransfer,
  consumePendingTransfer,
  getPendingTransfer,
  setPendingImageTransfer,
  setPendingTransfer,
} from '../storage/transfer';

describe('R1 session transfer lifecycle', () => {
  beforeEach(() => {
    clearAllTransfers();
  });

  it('retains only the newest pending text transfer and clears it when consumed', () => {
    setPendingTransfer('text-cleaner', 'first private payload');
    setPendingTransfer('word-counter', 'newest private payload');

    expect(getPendingTransfer('text-cleaner')).toBeNull();
    expect(getPendingTransfer('word-counter')).toBe('newest private payload');
    expect(consumePendingTransfer('word-counter')).toBe('newest private payload');
    expect(getPendingTransfer('word-counter')).toBeNull();
  });

  it('retains only the newest pending image transfer and clears it when consumed', () => {
    const first = { blob: new Blob(['first'], { type: 'image/png' }), filename: 'first.png' };
    const second = { blob: new Blob(['second'], { type: 'image/png' }), filename: 'second.png' };

    setPendingImageTransfer('image-optimizer', first);
    setPendingImageTransfer('image-annotator', second);

    expect(consumePendingImageTransfer('image-optimizer')).toBeNull();
    const consumed = consumePendingImageTransfer('image-annotator');
    expect(consumed?.filename).toBe('second.png');
    expect(consumed?.blob.size).toBe(second.blob.size);
    expect(consumePendingImageTransfer('image-annotator')).toBeNull();
  });
});
