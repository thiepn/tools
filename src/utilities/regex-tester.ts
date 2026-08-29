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

export interface RegexTestResult {
  isValid: boolean;
  error?: string;
  matches: RegexMatchItem[];
  matchCount: number;
  replacementPreview: string;
  executionTimeMs: number;
  isTruncated: boolean;
}

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

export function testRegex(
  pattern: string,
  flags: RegexFlags,
  text: string,
  replacement: string = ''
): RegexTestResult {
  if (!pattern) {
    return {
      isValid: true,
      matches: [],
      matchCount: 0,
      replacementPreview: text,
      executionTimeMs: 0,
      isTruncated: false,
    };
  }

  const startTime = performance.now();
  const flagStr = buildFlagString(flags);

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flagStr);
  } catch (err: unknown) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : String(err),
      matches: [],
      matchCount: 0,
      replacementPreview: text,
      executionTimeMs: 0,
      isTruncated: false,
    };
  }

  const matches: RegexMatchItem[] = [];
  const maxMatches = 2500;
  let isTruncated = false;

  try {
    if (flags.global || flags.sticky) {
      let match: RegExpExecArray | null;
      let loopCount = 0;

      while ((match = regex.exec(text)) !== null) {
        loopCount++;
        if (loopCount > maxMatches) {
          isTruncated = true;
          break;
        }

        const groups = match.slice(1);
        const namedGroups = match.groups ? { ...match.groups } : undefined;

        matches.push({
          index: match.index,
          endIndex: match.index + match[0].length,
          match: match[0],
          groups,
          namedGroups,
        });

        // Zero-length match protection: advance index to prevent infinite loop
        if (match[0].length === 0) {
          regex.lastIndex = match.index + 1;
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

    // Generate replacement preview safely
    let replacementPreview = text;
    try {
      // Re-create regex to reset lastIndex
      const replaceRegex = new RegExp(pattern, flagStr);
      replacementPreview = text.replace(replaceRegex, replacement);
    } catch {
      replacementPreview = text;
    }

    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

    return {
      isValid: true,
      matches,
      matchCount: matches.length,
      replacementPreview,
      executionTimeMs,
      isTruncated,
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
    };
  }
}
