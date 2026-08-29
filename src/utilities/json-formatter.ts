export interface JsonFormatOptions {
  indent: 2 | 4 | 'minify';
  sortKeys: boolean;
}

export interface JsonValidationResult {
  isValid: boolean;
  error?: string;
  line?: number;
  column?: number;
  formatted?: string;
  stats?: {
    sizeBytes: number;
    lines: number;
    keysCount: number;
    depth: number;
  };
}

// Deep sort keys of objects
export function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeys);
  }
  if (value !== null && typeof value === 'object') {
    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      sortedObj[key] = sortJsonKeys((value as Record<string, unknown>)[key]);
    }
    return sortedObj;
  }
  return value;
}

function calculateJsonStats(val: unknown, currentDepth = 1): { keysCount: number; maxDepth: number } {
  let keysCount = 0;
  let maxDepth = currentDepth;

  if (Array.isArray(val)) {
    for (const item of val) {
      const child = calculateJsonStats(item, currentDepth + 1);
      keysCount += child.keysCount;
      maxDepth = Math.max(maxDepth, child.maxDepth);
    }
  } else if (val !== null && typeof val === 'object') {
    const keys = Object.keys(val as Record<string, unknown>);
    keysCount += keys.length;
    for (const k of keys) {
      const child = calculateJsonStats((val as Record<string, unknown>)[k], currentDepth + 1);
      keysCount += child.keysCount;
      maxDepth = Math.max(maxDepth, child.maxDepth);
    }
  }

  return { keysCount, maxDepth };
}

function parseJsonError(errorMsg: string, input: string): { line?: number; column?: number; message: string } {
  // Extract position info from typical browser JSON.parse error messages
  // e.g., "Unexpected token } in JSON at position 42" or "at line 3 column 5"
  const lineColMatch = errorMsg.match(/line (\d+) column (\d+)/i);
  if (lineColMatch) {
    return {
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
      message: errorMsg,
    };
  }

  const posMatch = errorMsg.match(/position (\d+)/i);
  if (posMatch) {
    const pos = parseInt(posMatch[1], 10);
    const lines = input.substring(0, pos).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return { line, column, message: errorMsg };
  }

  return { message: errorMsg };
}

export function formatAndValidateJson(
  input: string,
  options: JsonFormatOptions
): JsonValidationResult {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      error: 'Empty JSON input',
    };
  }

  try {
    let parsed = JSON.parse(input);

    if (options.sortKeys) {
      parsed = sortJsonKeys(parsed);
    }

    let formatted: string;
    if (options.indent === 'minify') {
      formatted = JSON.stringify(parsed);
    } else {
      formatted = JSON.stringify(parsed, null, options.indent);
    }

    const { keysCount, maxDepth } = calculateJsonStats(parsed);

    return {
      isValid: true,
      formatted,
      stats: {
        sizeBytes: new Blob([formatted]).size,
        lines: formatted.split('\n').length,
        keysCount,
        depth: maxDepth,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const { line, column, message } = parseJsonError(errorMsg, input);

    return {
      isValid: false,
      error: message,
      line,
      column,
    };
  }
}
