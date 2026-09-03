import { describe, expect, it } from 'vitest';
import { PUBLIC_P20_TASKS } from '../expansion/publicP20Tasks';
import {
  calculateHabitStats,
  calculateScreenDensity,
  categorizeEisenhower,
  englishWordsToNumber,
  estimateTransferTime,
  formatCompactDuration,
  generateColorPalette,
  numberToEnglishWords,
  rankDecisionOptions,
  recentDateKeys,
  summarizeBudget,
} from '../utilities/p20-final-tools';

describe('P20 final general utilities', () => {
  it('publishes exactly eight distinct final-gap routes', () => {
    expect(PUBLIC_P20_TASKS).toHaveLength(8);
    expect(new Set(PUBLIC_P20_TASKS.map((task) => task.id)).size).toBe(8);
    expect(PUBLIC_P20_TASKS.every((task) => task.description.length >= 40)).toBe(true);
  });

  it('normalizes decision weights and ranks stronger weighted scores first', () => {
    const ranked = rankDecisionOptions(
      [{ name: 'Impact', weight: 3 }, { name: 'Ease', weight: 1 }],
      [
        { name: 'A', scores: [9, 4] },
        { name: 'B', scores: [6, 10] },
      ]
    );
    expect(ranked.map((item) => item.name)).toEqual(['A', 'B']);
    expect(ranked[0].score).toBe(7.75);
    expect(ranked[1].score).toBe(7);
  });

  it('summarizes income, categorized expenses, balance, and savings rate', () => {
    const summary = summarizeBudget(
      [3000, 200],
      [
        { category: 'Housing', amount: 1200 },
        { category: 'Food', amount: 400 },
        { category: 'Food', amount: 100 },
      ]
    );
    expect(summary.totalIncome).toBe(3200);
    expect(summary.totalExpenses).toBe(1700);
    expect(summary.balance).toBe(1500);
    expect(summary.savingsRate).toBe(46.9);
    expect(summary.categoryTotals.find((row) => row.category === 'Food')?.amount).toBe(500);
  });

  it('converts numbers to English words and parses standard words back', () => {
    expect(numberToEnglishWords('0')).toBe('zero');
    expect(numberToEnglishWords('-42')).toBe('minus forty-two');
    expect(numberToEnglishWords('1234567.89')).toBe(
      'one million two hundred thirty-four thousand five hundred sixty-seven point eight nine'
    );
    expect(numberToEnglishWords('-0.05')).toBe('minus zero point zero five');
    expect(englishWordsToNumber('one thousand two hundred and thirty-four')).toBe('1234');
    expect(englishWordsToNumber('minus forty-two point zero five')).toBe('-42.05');
  });

  it('calculates physical display density and simplified aspect ratio', () => {
    const result = calculateScreenDensity(1920, 1080, 24);
    expect(result.ppi).toBeCloseTo(91.79, 2);
    expect(result.pixelPitchMm).toBeCloseTo(0.2767, 4);
    expect(result.megapixels).toBe(2.07);
    expect([result.aspectWidth, result.aspectHeight]).toEqual([16, 9]);
  });

  it('estimates transfer duration across file-size and throughput units', () => {
    const estimate = estimateTransferTime(1, 'GB', 100, 'Mbps');
    expect(estimate.seconds).toBe(80);
    expect(formatCompactDuration(estimate.seconds)).toBe('1m 20s');
    expect(estimateTransferTime(1, 'GiB', 100, 'MB/s').seconds).toBeCloseTo(10.73741824, 8);
  });

  it('generates deterministic color harmonies from a base color', () => {
    expect(generateColorPalette('#ff0000', 'complementary')).toEqual(['#FF0000', '#00FFFF']);
    expect(generateColorPalette('#2563EB', 'triadic')).toHaveLength(3);
    expect(generateColorPalette('#2563EB', 'tetradic')).toHaveLength(4);
    expect(generateColorPalette('#2563EB', 'monochromatic').length).toBeGreaterThanOrEqual(3);
  });

  it('calculates habit streaks and bounded completion windows', () => {
    const keys = recentDateKeys(5, '2026-09-03');
    expect(keys).toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03']);
    const stats = calculateHabitStats(['2026-08-30', '2026-09-01', '2026-09-02', '2026-09-03'], 5, '2026-09-03');
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
    expect(stats.completedInWindow).toBe(4);
    expect(stats.completionRate).toBe(80);
  });

  it('rejects impossible calendar dates instead of normalizing them', () => {
    expect(() => recentDateKeys(5, '2026-02-30')).toThrow(/invalid today date/i);
  });

  it('places priority tasks into all four Eisenhower quadrants', () => {
    const groups = categorizeEisenhower([
      { id: 'a', text: 'A', urgent: true, important: true },
      { id: 'b', text: 'B', urgent: false, important: true },
      { id: 'c', text: 'C', urgent: true, important: false },
      { id: 'd', text: 'D', urgent: false, important: false },
    ]);
    expect(groups.doNow.map((task) => task.id)).toEqual(['a']);
    expect(groups.schedule.map((task) => task.id)).toEqual(['b']);
    expect(groups.delegate.map((task) => task.id)).toEqual(['c']);
    expect(groups.eliminate.map((task) => task.id)).toEqual(['d']);
  });
});
