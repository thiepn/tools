export interface RegexFlags {
  global: boolean;
  ignoreCase: boolean;
  multiline: boolean;
  dotAll: boolean;
  unicode: boolean;
  sticky: boolean;
}

export interface RegexMatchItem {
  index: number;
  endIndex: number;
  match: string;
  groups: string[];
  namedGroups?: Record<string, string>;
}

export interface RegexRiskAnalysis {
  level: 'low' | 'medium' | 'high';
  warnings: string[];
}

export interface RegexTestResult {
  isValid: boolean;
  error?: string;
  matches: RegexMatchItem[];
  matchCount: number;
  replacementPreview: string;
  executionTimeMs: number;
  isTruncated: boolean;
  risk: RegexRiskAnalysis;
}

const MAX_MATCHES = 2500;
const LARGE_RISKY_SUBJECT_CHARS = 20_000;
const ABSOLUTE_SUBJECT_CHARS = 2_000_000;

export function buildFlagString(flags: RegexFlags): string {
  let str = '';
  if (flags.global) str += 'g';
  if (flags.ignoreCase) str += 'i';
  if (flags.multiline) str += 'm';
  if (flags.dotAll) str += 's';
  if (flags.unicode) str += 'u';
  if (flags.sticky) str += 'y';
  return str;
}

function simplifyPatternForRiskScan(pattern: string): string {
  // Escaped characters and character classes are atomic for this heuristic and
  // should not be mistaken for quantifier syntax.
  return pattern
    .replace(/\\./g, 'x')
    .replace(/\[(?:\\.|[^\]\\])*\]/g, '[]');
}

/**
 * Lightweight static warning pass for common catastrophic-backtracking shapes.
 * It is intentionally conservative: it does not claim to prove regex safety.
 */
export function analyzeRegexRisk(pattern: string): RegexRiskAnalysis {
  if (!pattern) return { level: 'low', warnings: [] };
  const scan = simplifyPatternForRiskScan(pattern);
  const warnings: string[] = [];
  let high = false;

  const quantifier = String.raw`(?:\*|\+|\{\d+(?:,\d*)?\})`;
  const nestedQuantifier = new RegExp(String.raw`\([^)]*${quantifier}[^)]*\)${quantifier}`);
  const repeatedAlternation = new RegExp(String.raw`\([^)]*\|[^)]*\)${quantifier}`);

  if (nestedQuantifier.test(scan)) {
    warnings.push('Nested quantified groups can cause excessive backtracking on long input.');
    high = true;
  }
  if (repeatedAlternation.test(scan)) {
    warnings.push('A repeated alternation group may be ambiguous and backtracking-heavy.');
    high = true;
  }
  if (/\.\*[^\n]{0,80}\.\*/.test(scan) || /\.\+[^\n]{0,80}\.\+/.test(scan)) {
    warnings.push('Multiple broad wildcard repetitions may scan the same input many times.');
  }
  if (pattern.length > 1000) {
    warnings.push('Very large regular-expression patterns can be expensive to compile and execute.');
  }

  return {
    level: high ? 'high' : warnings.length ? 'medium' : 'low',
    warnings,
  };
}

function emptyResult(text: string, risk: RegexRiskAnalysis, error?: string): RegexTestResult {
  return {
    isValid: !error,
    error,
    matches: [],
    matchCount: 0,
    replacementPreview: text,
    executionTimeMs: 0,
    isTruncated: false,
    risk,
  };
}

function advanceAfterZeroLengthMatch(text: string, index: number, unicode: boolean): number {
  if (!unicode) return index + 1;
  const codePoint = text.codePointAt(index);
  return index + (codePoint !== undefined && codePoint > 0xffff ? 2 : 1);
}

export function testRegex(
  pattern: string,
  flags: RegexFlags,
  text: string,
  replacement: string = ''
): RegexTestResult {
  const risk = analyzeRegexRisk(pattern);
  if (!pattern) return emptyResult(text, risk);

  if (text.length > ABSOLUTE_SUBJECT_CHARS) {
    return emptyResult(
      text,
      risk,
      `Test text is too large for synchronous browser regex execution (${text.length.toLocaleString()} characters). Reduce it below ${ABSOLUTE_SUBJECT_CHARS.toLocaleString()} characters.`
    );
  }

  if (risk.level === 'high' && text.length > LARGE_RISKY_SUBJECT_CHARS) {
    return emptyResult(
      text,
      risk,
      `Potentially backtracking-heavy pattern blocked on large input. Reduce the test text below ${LARGE_RISKY_SUBJECT_CHARS.toLocaleString()} characters or simplify nested/repeated groups.`
    );
  }

  const startTime = performance.now();
  const flagStr = buildFlagString(flags);

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flagStr);
  } catch (err: unknown) {
    return {
      ...emptyResult(text, risk, err instanceof Error ? err.message : String(err)),
      executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
    };
  }

  const matches: RegexMatchItem[] = [];
  let isTruncated = false;

  try {
    if (flags.global || flags.sticky) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        if (matches.length >= MAX_MATCHES) {
          isTruncated = true;
          break;
        }

        matches.push({
          index: match.index,
          endIndex: match.index + match[0].length,
          match: match[0],
          groups: match.slice(1),
          namedGroups: match.groups ? { ...match.groups } : undefined,
        });

        if (match[0].length === 0) {
          regex.lastIndex = advanceAfterZeroLengthMatch(text, match.index, flags.unicode);
          if (regex.lastIndex > text.length) break;
        }
      }
    } else {
      const match = regex.exec(text);
      if (match) {
        matches.push({
          index: match.index,
          endIndex: match.index + match[0].length,
          match: match[0],
          groups: match.slice(1),
          namedGroups: match.groups ? { ...match.groups } : undefined,
        });
      }
    }

    let replacementPreview = text;
    try {
      const replaceRegex = new RegExp(pattern, flagStr);
      replacementPreview = text.replace(replaceRegex, replacement);
    } catch {
      replacementPreview = text;
    }

    return {
      isValid: true,
      matches,
      matchCount: matches.length,
      replacementPreview,
      executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
      isTruncated,
      risk,
    };
  } catch (err: unknown) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : 'Regex execution error',
      matches: [],
      matchCount: 0,
      replacementPreview: text,
      executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
      isTruncated: false,
      risk,
    };
  }
}
