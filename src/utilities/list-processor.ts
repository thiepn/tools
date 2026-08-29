export interface ListProcessorOptions {
  caseSensitiveDuplicates: boolean;
  prefixText: string;
  suffixText: string;
  numberingFormat: '1. ' | '1) ' | '[1] ' | '1 - ' | '01. ';
}

export function parseListItems(text: string): string[] {
  if (!text) return [];
  return text.split(/\r\n|\r|\n/);
}

export function trimItems(items: string[]): string[] {
  return items.map((item) => item.trim());
}

export function removeEmptyItems(items: string[]): string[] {
  return items.filter((item) => item.trim().length > 0);
}

export function removeDuplicateItems(items: string[], caseSensitive = true): { items: string[]; duplicatesRemoved: number } {
  const seen = new Set<string>();
  const result: string[] = [];
  let duplicatesRemoved = 0;

  for (const item of items) {
    const key = caseSensitive ? item : item.toLowerCase();
    if (seen.has(key)) {
      duplicatesRemoved++;
    } else {
      seen.add(key);
      result.push(item);
    }
  }

  return { items: result, duplicatesRemoved };
}

export function sortAZ(items: string[]): string[] {
  return [...items].sort((a, b) => a.localeCompare(b));
}

export function sortZA(items: string[]): string[] {
  return [...items].sort((a, b) => b.localeCompare(a));
}

export function naturalSort(items: string[]): string[] {
  return [...items].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

export function numericSort(items: string[], ascending = true): { items: string[]; nonNumericCount: number } {
  const numericEntries: Array<{ original: string; value: number }> = [];
  const nonNumericEntries: string[] = [];

  for (const item of items) {
    // Extract first valid numeric match or parse whole string
    const trimmed = item.trim();
    const parsed = Number(trimmed.replace(/,/g, ''));
    if (!isNaN(parsed) && trimmed.length > 0) {
      numericEntries.push({ original: item, value: parsed });
    } else {
      nonNumericEntries.push(item);
    }
  }

  numericEntries.sort((a, b) => (ascending ? a.value - b.value : b.value - a.value));

  const sortedNumerics = numericEntries.map((e) => e.original);
  return {
    items: [...sortedNumerics, ...nonNumericEntries],
    nonNumericCount: nonNumericEntries.length,
  };
}

export function reverseItems(items: string[]): string[] {
  return [...items].reverse();
}

export function shuffleItems(items: string[]): string[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function addLineNumbers(items: string[], format: string = '1. '): string[] {
  const total = items.length;
  const padLength = total >= 10 ? String(total).length : 2;

  return items.map((item, idx) => {
    const num = idx + 1;
    let prefix = `${num}. `;
    if (format === '1) ') prefix = `${num}) `;
    else if (format === '[1] ') prefix = `[${num}] `;
    else if (format === '1 - ') prefix = `${num} - `;
    else if (format === '01. ') prefix = `${String(num).padStart(padLength, '0')}. `;

    return `${prefix}${item}`;
  });
}

export function removeLineNumbers(items: string[]): string[] {
  // Regex to remove common prefixes like "1. ", "1) ", "[1] ", "4 - ", "01. ", "1: ", "#1 "
  const numberPrefixRegex = /^\s*(?:#|\[)?\d+(?:\]|[.)\-:]|\s+-\s*|\s+)?\s*/;
  return items.map((item) => {
    // Specifically match full leading number sequences like "1. ", "1) ", "[1] ", "1 - ", "1: "
    return item.replace(/^\s*(?:#\s*\d+|\d+\s*[-.)\]:]|\[\d+\])\s*/, '');
  });
}

export function addPrefixSuffix(items: string[], prefix: string, suffix: string): string[] {
  return items.map((item) => `${prefix}${item}${suffix}`);
}

export interface ProcessListConfig {
  removeDuplicates?: boolean;
  trimItems?: boolean;
  removeEmpty?: boolean;
  removeNumbering?: boolean;
  sort?: 'alpha-asc' | 'alpha-desc' | 'natural' | 'numeric-asc' | 'numeric-desc' | 'reverse' | 'shuffle' | 'none';
  caseSensitiveDuplicates?: boolean;
  duplicateMode?: 'case-sensitive' | 'case-insensitive';
  reverse?: boolean;
  shuffle?: boolean;
  joinWith?: string;
  prefix?: string;
  suffix?: string;
  numbering?: string;
}

export function processList(
  items: string[],
  config: ProcessListConfig
): { items: string[]; duplicatesRemoved: number } {
  let result = [...items];
  let duplicatesRemoved = 0;

  if (config.removeNumbering) {
    result = removeLineNumbers(result);
  }
  if (config.trimItems) {
    result = trimItems(result);
  }
  if (config.removeEmpty) {
    result = removeEmptyItems(result);
  }
  if (config.removeDuplicates) {
    const isCaseSensitive =
      config.duplicateMode !== undefined
        ? config.duplicateMode === 'case-sensitive'
        : config.caseSensitiveDuplicates ?? true;
    const dedupe = removeDuplicateItems(result, isCaseSensitive);
    result = dedupe.items;
    duplicatesRemoved = dedupe.duplicatesRemoved;
  }
  if (config.sort) {
    if (config.sort === 'alpha-asc') result = sortAZ(result);
    else if (config.sort === 'alpha-desc') result = sortZA(result);
    else if (config.sort === 'natural' || config.sort === 'numeric-asc') result = naturalSort(result);
    else if (config.sort === 'numeric-desc') result = naturalSort(result).reverse();
    else if (config.sort === 'reverse') result = reverseItems(result);
    else if (config.sort === 'shuffle') result = shuffleItems(result);
  }
  if (config.prefix || config.suffix) {
    result = addPrefixSuffix(result, config.prefix || '', config.suffix || '');
  }
  if (config.numbering) {
    result = addLineNumbers(result, config.numbering);
  }

  return { items: result, duplicatesRemoved };
}

