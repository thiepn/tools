/**
 * Text Diff Checker Utility
 * Exact line/word LCS for normal inputs with a bounded large-document fallback.
 */

export type DiffChangeType = 'unchanged' | 'added' | 'removed' | 'modified';

export interface DiffLine {
  type: DiffChangeType;
  originalLineNum?: number;
  revisedLineNum?: number;
  originalText?: string;
  revisedText?: string;
  wordTokens?: { text: string; added?: boolean; removed?: boolean }[];
}

export interface DiffOptions {
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
  ignoreBlankLines: boolean;
}

export interface DiffSummary {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
  similarityScore: number; // 0 to 100%
}

interface RawDiffLine {
  type: 'unchanged' | 'added' | 'removed';
  orig?: string;
  rev?: string;
  origNum?: number;
  revNum?: number;
}

const MAX_EXACT_LINE_MATRIX_CELLS = 2_000_000;
const MAX_EXACT_WORD_MATRIX_CELLS = 120_000;
const LARGE_DIFF_LOOKAHEAD = 80;

function buildExactLineDiff(
  origLines: string[],
  revLines: string[],
  normalize: (line: string) => string
): { raw: RawDiffLine[]; unchanged: number } {
  const n = origLines.length;
  const m = revLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i < n; i++) {
    const left = normalize(origLines[i]);
    for (let j = 0; j < m; j++) {
      if (left === normalize(revLines[j])) dp[i + 1][j + 1] = dp[i][j] + 1;
      else dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let i = n;
  let j = m;
  const reversed: RawDiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalize(origLines[i - 1]) === normalize(revLines[j - 1])) {
      reversed.push({
        type: 'unchanged',
        orig: origLines[i - 1],
        rev: revLines[j - 1],
        origNum: i,
        revNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversed.push({ type: 'added', rev: revLines[j - 1], revNum: j });
      j--;
    } else {
      reversed.push({ type: 'removed', orig: origLines[i - 1], origNum: i });
      i--;
    }
  }

  return { raw: reversed.reverse(), unchanged: dp[n][m] };
}

/**
 * Bounded alignment for large documents. It looks ahead for a nearby matching
 * anchor instead of allocating an O(n*m) matrix. This keeps the browser usable
 * for thousands of lines while preserving exact LCS behavior on normal inputs.
 */
function buildLargeLineDiff(
  origLines: string[],
  revLines: string[],
  normalize: (line: string) => string
): { raw: RawDiffLine[]; unchanged: number } {
  const raw: RawDiffLine[] = [];
  let unchanged = 0;
  let i = 0;
  let j = 0;

  while (i < origLines.length || j < revLines.length) {
    if (i >= origLines.length) {
      raw.push({ type: 'added', rev: revLines[j], revNum: j + 1 });
      j++;
      continue;
    }
    if (j >= revLines.length) {
      raw.push({ type: 'removed', orig: origLines[i], origNum: i + 1 });
      i++;
      continue;
    }

    if (normalize(origLines[i]) === normalize(revLines[j])) {
      raw.push({
        type: 'unchanged',
        orig: origLines[i],
        rev: revLines[j],
        origNum: i + 1,
        revNum: j + 1,
      });
      unchanged++;
      i++;
      j++;
      continue;
    }

    const revAnchors = new Map<string, number>();
    const revLimit = Math.min(revLines.length, j + LARGE_DIFF_LOOKAHEAD + 1);
    for (let candidate = j; candidate < revLimit; candidate++) {
      const key = normalize(revLines[candidate]);
      if (!revAnchors.has(key)) revAnchors.set(key, candidate - j);
    }

    let bestOrigOffset = -1;
    let bestRevOffset = -1;
    let bestScore = Infinity;
    const origLimit = Math.min(origLines.length, i + LARGE_DIFF_LOOKAHEAD + 1);
    for (let candidate = i; candidate < origLimit; candidate++) {
      const revOffset = revAnchors.get(normalize(origLines[candidate]));
      if (revOffset === undefined) continue;
      const origOffset = candidate - i;
      if (origOffset === 0 && revOffset === 0) continue;
      const score = origOffset + revOffset;
      if (score < bestScore) {
        bestScore = score;
        bestOrigOffset = origOffset;
        bestRevOffset = revOffset;
      }
    }

    if (bestOrigOffset >= 0 && bestRevOffset >= 0) {
      for (let offset = 0; offset < bestOrigOffset; offset++) {
        raw.push({ type: 'removed', orig: origLines[i + offset], origNum: i + offset + 1 });
      }
      for (let offset = 0; offset < bestRevOffset; offset++) {
        raw.push({ type: 'added', rev: revLines[j + offset], revNum: j + offset + 1 });
      }
      i += bestOrigOffset;
      j += bestRevOffset;
      continue;
    }

    // No nearby anchor: treat the current pair as a replacement and move on.
    raw.push({ type: 'removed', orig: origLines[i], origNum: i + 1 });
    raw.push({ type: 'added', rev: revLines[j], revNum: j + 1 });
    i++;
    j++;
  }

  return { raw, unchanged };
}

function appendChangedRun(
  lines: DiffLine[],
  run: RawDiffLine[],
  counts: { added: number; removed: number; modified: number }
) {
  if (run.length === 0) return;
  const removed = run.filter((item) => item.type === 'removed');
  const added = run.filter((item) => item.type === 'added');
  const paired = Math.min(removed.length, added.length);

  for (let i = 0; i < paired; i++) {
    lines.push({
      type: 'modified',
      originalLineNum: removed[i].origNum,
      revisedLineNum: added[i].revNum,
      originalText: removed[i].orig,
      revisedText: added[i].rev,
      wordTokens: computeWordDiff(removed[i].orig || '', added[i].rev || ''),
    });
    counts.modified++;
  }

  for (let i = paired; i < removed.length; i++) {
    lines.push({
      type: 'removed',
      originalLineNum: removed[i].origNum,
      originalText: removed[i].orig,
    });
    counts.removed++;
  }
  for (let i = paired; i < added.length; i++) {
    lines.push({
      type: 'added',
      revisedLineNum: added[i].revNum,
      revisedText: added[i].rev,
    });
    counts.added++;
  }
}

export function computeTextDiff(
  originalText: string,
  revisedText: string,
  options: DiffOptions = { ignoreCase: false, ignoreWhitespace: false, ignoreBlankLines: false }
): DiffSummary {
  let origLines = originalText.split(/\r?\n/);
  let revLines = revisedText.split(/\r?\n/);

  if (options.ignoreBlankLines) {
    origLines = origLines.filter((line) => line.trim().length > 0);
    revLines = revLines.filter((line) => line.trim().length > 0);
  }

  const normalize = (line: string) => {
    let value = line;
    if (options.ignoreWhitespace) value = value.trim().replace(/\s+/g, ' ');
    if (options.ignoreCase) value = value.toLocaleLowerCase();
    return value;
  };

  const matrixCells = (origLines.length + 1) * (revLines.length + 1);
  const alignment = matrixCells <= MAX_EXACT_LINE_MATRIX_CELLS
    ? buildExactLineDiff(origLines, revLines, normalize)
    : buildLargeLineDiff(origLines, revLines, normalize);

  const lines: DiffLine[] = [];
  const counts = { added: 0, removed: 0, modified: 0 };
  let unchangedCount = 0;
  let changedRun: RawDiffLine[] = [];

  const flushRun = () => {
    appendChangedRun(lines, changedRun, counts);
    changedRun = [];
  };

  for (const item of alignment.raw) {
    if (item.type !== 'unchanged') {
      changedRun.push(item);
      continue;
    }
    flushRun();
    lines.push({
      type: 'unchanged',
      originalLineNum: item.origNum,
      revisedLineNum: item.revNum,
      originalText: item.orig,
      revisedText: item.rev,
    });
    unchangedCount++;
  }
  flushRun();

  const totalLines = Math.max(1, origLines.length + revLines.length);
  const similarityScore = Math.min(100, Math.round(((2 * alignment.unchanged) / totalLines) * 100));

  return {
    lines,
    addedCount: counts.added,
    removedCount: counts.removed,
    modifiedCount: counts.modified,
    unchangedCount,
    similarityScore,
  };
}

/** Computes word-level highlights between two modified strings using LCS. */
export function computeWordDiff(
  strA: string,
  strB: string
): { text: string; added?: boolean; removed?: boolean }[] {
  const wordsA = strA.split(/(\s+)/);
  const wordsB = strB.split(/(\s+)/);
  const n = wordsA.length;
  const m = wordsB.length;

  // A single extremely long line should not allocate another huge quadratic
  // matrix. In that case retain the full old/new text as a coarse replacement.
  if ((n + 1) * (m + 1) > MAX_EXACT_WORD_MATRIX_CELLS) {
    const output: { text: string; added?: boolean; removed?: boolean }[] = [];
    if (strA) output.push({ text: strA, removed: true });
    if (strB) output.push({ text: strB, added: true });
    return output;
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (wordsA[i] === wordsB[j]) dp[i + 1][j + 1] = dp[i][j] + 1;
      else dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let i = n;
  let j = m;
  const reversed: { text: string; added?: boolean; removed?: boolean }[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      reversed.push({ text: wordsA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversed.push({ text: wordsB[j - 1], added: true });
      j--;
    } else {
      reversed.push({ text: wordsA[i - 1], removed: true });
      i--;
    }
  }

  return reversed.reverse();
}

/** Formats diff lines into a standard unified markdown diff block. */
export function formatToMarkdownDiff(summary: DiffSummary): string {
  const output: string[] = ['```diff'];

  for (const line of summary.lines) {
    if (line.type === 'added') output.push(`+ ${line.revisedText || ''}`);
    else if (line.type === 'removed') output.push(`- ${line.originalText || ''}`);
    else if (line.type === 'modified') {
      output.push(`- ${line.originalText || ''}`);
      output.push(`+ ${line.revisedText || ''}`);
    } else output.push(`  ${line.originalText || ''}`);
  }

  output.push('```');
  return output.join('\n');
}
