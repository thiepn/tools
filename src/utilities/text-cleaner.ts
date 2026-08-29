export interface TextCleanerOptions {
  trimEntireText: boolean;
  trimEachLine: boolean;
  collapseSpaces: boolean;
  tabsToSpaces: boolean;
  tabSize: number;
  normalizeLineEndings: boolean;
  removeTrailingSpaces: boolean;
  removeEmptyLines: boolean;
  collapseEmptyLines: boolean;
  removeDuplicates: boolean;
  caseSensitiveDuplicates: boolean;
  removeInvisibleChars: boolean;
  removeZeroWidthJoiners: boolean;
  normalizeSmartQuotes: boolean;
  normalizeDashes: boolean;
}

export const defaultCleanerOptions: TextCleanerOptions = {
  trimEntireText: false,
  trimEachLine: true,
  collapseSpaces: true,
  tabsToSpaces: true,
  tabSize: 2,
  normalizeLineEndings: true,
  removeTrailingSpaces: true,
  removeEmptyLines: false,
  collapseEmptyLines: true,
  removeDuplicates: false,
  caseSensitiveDuplicates: true,
  removeInvisibleChars: true,
  removeZeroWidthJoiners: false,
  normalizeSmartQuotes: true,
  normalizeDashes: true,
};

export interface TextCleanerStats {
  inputChars: number;
  outputChars: number;
  inputLines: number;
  outputLines: number;
  linesRemoved: number;
  charsRemoved: number;
  duplicatesRemoved: number;
}

export function cleanText(
  input: string,
  options: TextCleanerOptions
): { output: string; stats: TextCleanerStats } {
  if (!input) {
    return {
      output: '',
      stats: {
        inputChars: 0,
        outputChars: 0,
        inputLines: 0,
        outputLines: 0,
        linesRemoved: 0,
        charsRemoved: 0,
        duplicatesRemoved: 0,
      },
    };
  }

  let text = input;

  // 1. Remove invisible / zero-width space and BOM, but preserve ZWNJ (\u200C) and ZWJ (\u200D) by default
  if (options.removeInvisibleChars) {
    text = text.replace(/[\u200B\uFEFF\u00AD\u2060]/g, '');
  }

  // 1b. Advanced optional removal of Zero-Width Non-Joiner (U+200C) & Zero-Width Joiner (U+200D)
  if (options.removeZeroWidthJoiners) {
    text = text.replace(/[\u200C\u200D]/g, '');
  }

  // 2. Normalize smart quotation marks: “ ” „ « » ” -> ", ‘ ’ ‚ ‹ › -> '
  if (options.normalizeSmartQuotes) {
    text = text
      .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
      .replace(/[\u2018\u2019\u201A\u2039\u203A]/g, "'");
  }

  // 3. Normalize common dash characters (en-dash, em-dash, figure dash, horizontal bar) -> -
  if (options.normalizeDashes) {
    text = text.replace(/[\u2012\u2013\u2014\u2015\u2212]/g, '-');
  }

  // 4. Normalize line endings to \n
  if (options.normalizeLineEndings) {
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  // 5. Convert tabs to spaces
  if (options.tabsToSpaces) {
    const spaces = ' '.repeat(Math.max(1, options.tabSize));
    text = text.replace(/\t/g, spaces);
  }

  // Split into lines for line-level processing
  const lines = text.split(options.normalizeLineEndings ? '\n' : /(?:\r\n|\r|\n)/);
  let processedLines: string[] = [];
  let duplicatesRemoved = 0;
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (options.trimEachLine) {
      line = line.trim();
    } else if (options.removeTrailingSpaces) {
      line = line.replace(/[ \t]+$/, '');
    }

    if (options.collapseSpaces) {
      line = line.replace(/ {2,}/g, ' ');
    }

    // Check empty lines
    const isEmpty = line.trim().length === 0;

    if (options.removeEmptyLines && isEmpty) {
      continue;
    }

    if (options.collapseEmptyLines && isEmpty) {
      const prevLine = processedLines[processedLines.length - 1];
      if (prevLine !== undefined && prevLine.trim().length === 0) {
        continue;
      }
    }

    // Check duplicate lines
    if (options.removeDuplicates) {
      const key = options.caseSensitiveDuplicates ? line : line.toLowerCase();
      if (seen.has(key)) {
        duplicatesRemoved++;
        continue;
      }
      seen.add(key);
    }

    processedLines.push(line);
  }

  let output = processedLines.join('\n');

  if (options.trimEntireText) {
    output = output.trim();
  }

  const inputLinesCount = input.split(/\r\n|\r|\n/).length;
  const outputLinesCount = output ? output.split('\n').length : 0;

  return {
    output,
    stats: {
      inputChars: input.length,
      outputChars: output.length,
      inputLines: inputLinesCount,
      outputLines: outputLinesCount,
      linesRemoved: Math.max(0, inputLinesCount - outputLinesCount),
      charsRemoved: Math.max(0, input.length - output.length),
      duplicatesRemoved,
    },
  };
}
