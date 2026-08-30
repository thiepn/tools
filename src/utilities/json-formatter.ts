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

function isContainer(value: unknown): value is unknown[] | Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/**
 * Deep-sort object keys without recursive calls.
 *
 * JSON can legally be much deeper than the JavaScript call stack. The old
 * recursive implementation could therefore turn valid, deeply nested JSON
 * into a RangeError when "Sort keys" was enabled. An explicit work stack
 * keeps traversal bounded by heap memory instead of call-stack depth.
 */
export function sortJsonKeys(value: unknown): unknown {
  if (!isContainer(value)) return value;

  const root: unknown[] | Record<string, unknown> = Array.isArray(value) ? [] : {};
  const stack: Array<{
    source: unknown[] | Record<string, unknown>;
    target: unknown[] | Record<string, unknown>;
  }> = [{ source: value, target: root }];

  while (stack.length > 0) {
    const frame = stack.pop()!;

    if (Array.isArray(frame.source)) {
      const target = frame.target as unknown[];
      target.length = frame.source.length;

      for (let index = frame.source.length - 1; index >= 0; index--) {
        const child = frame.source[index];
        if (isContainer(child)) {
          const childTarget: unknown[] | Record<string, unknown> = Array.isArray(child) ? [] : {};
          target[index] = childTarget;
          stack.push({ source: child, target: childTarget });
        } else {
          target[index] = child;
        }
      }
      continue;
    }

    const source = frame.source as Record<string, unknown>;
    const target = frame.target as Record<string, unknown>;
    const keys = Object.keys(source).sort();

    // Assign keys in sorted insertion order. Push child containers in reverse
    // so traversal order is deterministic without affecting key order.
    const pendingChildren: Array<{
      source: unknown[] | Record<string, unknown>;
      target: unknown[] | Record<string, unknown>;
    }> = [];

    for (const key of keys) {
      const child = source[key];
      if (isContainer(child)) {
        const childTarget: unknown[] | Record<string, unknown> = Array.isArray(child) ? [] : {};
        target[key] = childTarget;
        pendingChildren.push({ source: child, target: childTarget });
      } else {
        target[key] = child;
      }
    }

    for (let index = pendingChildren.length - 1; index >= 0; index--) {
      stack.push(pendingChildren[index]);
    }
  }

  return root;
}

function calculateJsonStats(value: unknown): { keysCount: number; maxDepth: number } {
  if (!isContainer(value)) {
    return { keysCount: 0, maxDepth: 1 };
  }

  let keysCount = 0;
  let maxDepth = 1;
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 1 }];

  while (stack.length > 0) {
    const current = stack.pop()!;
    maxDepth = Math.max(maxDepth, current.depth);

    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index--) {
        const child = current.value[index];
        if (isContainer(child)) {
          stack.push({ value: child, depth: current.depth + 1 });
        }
      }
      continue;
    }

    if (isContainer(current.value)) {
      const record = current.value as Record<string, unknown>;
      const keys = Object.keys(record);
      keysCount += keys.length;
      for (let index = keys.length - 1; index >= 0; index--) {
        const child = record[keys[index]];
        if (isContainer(child)) {
          stack.push({ value: child, depth: current.depth + 1 });
        }
      }
    }
  }

  return { keysCount, maxDepth };
}

function parseJsonError(errorMsg: string, input: string): { line?: number; column?: number; message: string } {
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