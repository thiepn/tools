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
 * JSON can legally be much deeper than the JavaScript call stack. An explicit
 * work stack keeps traversal bounded by heap memory instead of call-stack depth.
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
  const stack: Array<{ value: unknown[] | Record<string, unknown>; depth: number }> = [
    { value, depth: 1 },
  ];

  while (stack.length > 0) {
    const current = stack.pop()!;
    maxDepth = Math.max(maxDepth, current.depth);

    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index--) {
        const child = current.value[index];
        const childDepth = current.depth + 1;
        maxDepth = Math.max(maxDepth, childDepth);
        if (isContainer(child)) {
          stack.push({ value: child, depth: childDepth });
        }
      }
      continue;
    }

    const record = current.value as Record<string, unknown>;
    const keys = Object.keys(record);
    keysCount += keys.length;
    for (let index = keys.length - 1; index >= 0; index--) {
      const child = record[keys[index]];
      const childDepth = current.depth + 1;
      maxDepth = Math.max(maxDepth, childDepth);
      if (isContainer(child)) {
        stack.push({ value: child, depth: childDepth });
      }
    }
  }

  return { keysCount, maxDepth };
}

type SerializeTask =
  | { type: 'text'; text: string }
  | { type: 'value'; value: unknown; depth: number };

/**
 * Serialize parsed JSON without recursive JavaScript calls. JSON.parse only
 * produces JSON-safe primitives, arrays, and plain objects, so primitive
 * escaping can still delegate to native JSON.stringify while container
 * traversal remains iterative.
 */
function stringifyParsedJson(value: unknown, indent: JsonFormatOptions['indent']): string {
  const pretty = indent !== 'minify';
  const indentSize = pretty ? indent : 0;
  const pieces: string[] = [];
  const stack: SerializeTask[] = [{ type: 'value', value, depth: 0 }];
  const indentation = (depth: number) => (pretty ? ' '.repeat(depth * indentSize) : '');

  while (stack.length > 0) {
    const task = stack.pop()!;
    if (task.type === 'text') {
      pieces.push(task.text);
      continue;
    }

    if (!isContainer(task.value)) {
      const serialized = JSON.stringify(task.value);
      pieces.push(serialized === undefined ? 'null' : serialized);
      continue;
    }

    if (Array.isArray(task.value)) {
      if (task.value.length === 0) {
        pieces.push('[]');
        continue;
      }

      pieces.push('[');
      if (pretty) pieces.push('\n');
      stack.push({
        type: 'text',
        text: pretty ? `\n${indentation(task.depth)}]` : ']',
      });

      for (let index = task.value.length - 1; index >= 0; index--) {
        if (index < task.value.length - 1) {
          stack.push({ type: 'text', text: pretty ? ',\n' : ',' });
        }
        stack.push({ type: 'value', value: task.value[index], depth: task.depth + 1 });
        if (pretty) {
          stack.push({ type: 'text', text: indentation(task.depth + 1) });
        }
      }
      continue;
    }

    const record = task.value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 0) {
      pieces.push('{}');
      continue;
    }

    pieces.push('{');
    if (pretty) pieces.push('\n');
    stack.push({
      type: 'text',
      text: pretty ? `\n${indentation(task.depth)}}` : '}',
    });

    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      if (index < keys.length - 1) {
        stack.push({ type: 'text', text: pretty ? ',\n' : ',' });
      }
      stack.push({ type: 'value', value: record[key], depth: task.depth + 1 });
      stack.push({ type: 'text', text: `${JSON.stringify(key)}${pretty ? ': ' : ':'}` });
      if (pretty) {
        stack.push({ type: 'text', text: indentation(task.depth + 1) });
      }
    }
  }

  return pieces.join('');
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

    const formatted = stringifyParsedJson(parsed, options.indent);
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