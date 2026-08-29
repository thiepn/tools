/**
 * Text Diff Checker Utility
 * Line-by-line & word-level Myers LCS diff engine, similarity percentage, and statistics
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

/**
 * Computes Myers LCS line-by-line difference between original and revised texts
 */
export function computeTextDiff(
  originalText: string,
  revisedText: string,
  options: DiffOptions = { ignoreCase: false, ignoreWhitespace: false, ignoreBlankLines: false }
): DiffSummary {
  let origLines = originalText.split(/\r?\n/);
  let revLines = revisedText.split(/\r?\n/);

  if (options.ignoreBlankLines) {
    origLines = origLines.filter((l) => l.trim().length > 0);
    revLines = revLines.filter((l) => l.trim().length > 0);
  }

  const normalize = (line: string) => {
    let s = line;
    if (options.ignoreWhitespace) {
      s = s.trim().replace(/\s+/g, ' ');
    }
    if (options.ignoreCase) {
      s = s.toLowerCase();
    }
    return s;
  };

  const n = origLines.length;
  const m = revLines.length;

  // Compute LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (normalize(origLines[i]) === normalize(revLines[j])) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to build diff lines
  let i = n;
  let j = m;
  const rawDiff: { type: DiffChangeType; orig?: string; rev?: string; origNum?: number; revNum?: number }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalize(origLines[i - 1]) === normalize(revLines[j - 1])) {
      rawDiff.unshift({
        type: 'unchanged',
        orig: origLines[i - 1],
        rev: revLines[j - 1],
        origNum: i,
        revNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.unshift({
        type: 'added',
        rev: revLines[j - 1],
        revNum: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawDiff.unshift({
        type: 'removed',
        orig: origLines[i - 1],
        origNum: i,
      });
      i--;
    }
  }

  // Group adjacent removed + added lines into modified
  const lines: DiffLine[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;

  for (let k = 0; k < rawDiff.length; k++) {
    const cur = rawDiff[k];
    const next = rawDiff[k + 1];

    if (cur.type === 'removed' && next && next.type === 'added') {
      lines.push({
        type: 'modified',
        originalLineNum: cur.origNum,
        revisedLineNum: next.revNum,
        originalText: cur.orig,
        revisedText: next.rev,
        wordTokens: computeWordDiff(cur.orig || '', next.rev || ''),
      });
      modifiedCount++;
      k++; // Skip next since merged
    } else if (cur.type === 'added') {
      lines.push({
        type: 'added',
        revisedLineNum: cur.revNum,
        revisedText: cur.rev,
      });
      addedCount++;
    } else if (cur.type === 'removed') {
      lines.push({
        type: 'removed',
        originalLineNum: cur.origNum,
        originalText: cur.orig,
      });
      removedCount++;
    } else {
      lines.push({
        type: 'unchanged',
        originalLineNum: cur.origNum,
        revisedLineNum: cur.revNum,
        originalText: cur.orig,
        revisedText: cur.rev,
      });
      unchangedCount++;
    }
  }

  const totalLines = Math.max(1, n + m);
  const lcsLength = dp[n][m];
  const similarityScore = Math.min(100, Math.round(((2 * lcsLength) / totalLines) * 100));

  return {
    lines,
    addedCount,
    removedCount,
    modifiedCount,
    unchangedCount,
    similarityScore,
  };
}

/**
 * Computes word-level highlights between two modified strings using LCS
 */
export function computeWordDiff(
  strA: string,
  strB: string
): { text: string; added?: boolean; removed?: boolean }[] {
  const wordsA = strA.split(/(\s+)/);
  const wordsB = strB.split(/(\s+)/);

  const n = wordsA.length;
  const m = wordsB.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (wordsA[i] === wordsB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = n;
  let j = m;
  const tokens: { text: string; added?: boolean; removed?: boolean }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      tokens.unshift({ text: wordsA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({ text: wordsB[j - 1], added: true });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      tokens.unshift({ text: wordsA[i - 1], removed: true });
      i--;
    }
  }

  return tokens;
}

/**
 * Formats diff lines into a standard unified markdown diff block
 */
export function formatToMarkdownDiff(summary: DiffSummary): string {
  const output: string[] = ['```diff'];

  for (const l of summary.lines) {
    if (l.type === 'added') {
      output.push(`+ ${l.revisedText || ''}`);
    } else if (l.type === 'removed') {
      output.push(`- ${l.originalText || ''}`);
    } else if (l.type === 'modified') {
      output.push(`- ${l.originalText || ''}`);
      output.push(`+ ${l.revisedText || ''}`);
    } else {
      output.push(`  ${l.originalText || ''}`);
    }
  }

  output.push('```');
  return output.join('\n');
}
