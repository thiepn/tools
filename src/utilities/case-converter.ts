export type CaseType =
  | 'lowercase'
  | 'UPPERCASE'
  | 'Sentence case'
  | 'Title Case'
  | 'camelCase'
  | 'PascalCase'
  | 'snake_case'
  | 'kebab-case'
  | 'CONSTANT_CASE'
  | 'dot.case';

export interface CaseConversionResult {
  type: CaseType;
  label: string;
  example: string;
  result: string;
}

// Split text into semantic words handling spaces, camelCase, PascalCase, snake_case, kebab-case, punctuation
export function splitIntoWords(text: string): string[] {
  if (!text.trim()) return [];

  // Replace common delimiters and punctuation with spaces, keeping alphanumeric Unicode letters
  const cleaned = text
    // Handle camelCase / PascalCase word boundaries (e.g., 'myVariableName' -> 'my Variable Name', 'HTMLParser' -> 'HTML Parser')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1 $2')
    // Replace hyphens, underscores, dots, slashes, and general non-word symbols with space
    .replace(/[\-_./\\~|:,;!?'"()[\]{}<>@#$%^&*+=]+/g, ' ')
    .trim();

  return cleaned.split(/\s+/).filter(Boolean);
}

export function toLowercase(text: string): string {
  return text.toLowerCase();
}

export function toUppercase(text: string): string {
  return text.toUpperCase();
}

export function toSentenceCase(text: string): string {
  if (!text) return '';
  // Convert lines/sentences: capitalize first letter after period, exclamation, question mark, or newline
  return text.toLowerCase().replace(/(^\s*|[.!?\n]\s*)([\p{L}])/gu, (_, p1, p2) => {
    return p1 + p2.toUpperCase();
  });
}

export function toTitleCase(text: string): string {
  if (!text) return '';
  const minorWords = new Set([
    'a', 'an', 'and', 'as', 'at', 'but', 'by', 'en', 'for', 'if', 'in', 'of', 'on', 'or', 'the', 'to', 'via', 'vs', 'with'
  ]);

  const lines = text.split('\n');
  return lines
    .map((line) => {
      const words = line.split(/(\s+)/);
      let isFirstOrLast = true;

      return words
        .map((segment, idx) => {
          if (/^\s+$/.test(segment) || !segment) return segment;
          const lower = segment.toLowerCase();
          const isLast = idx === words.length - 1;

          if (isFirstOrLast || isLast || !minorWords.has(lower)) {
            isFirstOrLast = false;
            return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
          }
          isFirstOrLast = false;
          return lower;
        })
        .join('');
    })
    .join('\n');
}

export function toCamelCase(text: string): string {
  const words = splitIntoWords(text);
  if (words.length === 0) return '';
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

export function toPascalCase(text: string): string {
  const words = splitIntoWords(text);
  return words
    .map((w) => {
      const lower = w.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

export function toSnakeCase(text: string): string {
  const words = splitIntoWords(text);
  return words.map((w) => w.toLowerCase()).join('_');
}

export function toKebabCase(text: string): string {
  const words = splitIntoWords(text);
  return words.map((w) => w.toLowerCase()).join('-');
}

export function toConstantCase(text: string): string {
  const words = splitIntoWords(text);
  return words.map((w) => w.toUpperCase()).join('_');
}

export function toDotCase(text: string): string {
  const words = splitIntoWords(text);
  return words.map((w) => w.toLowerCase()).join('.');
}

export function convertCase(text: string, type: CaseType): string {
  switch (type) {
    case 'lowercase':
      return toLowercase(text);
    case 'UPPERCASE':
      return toUppercase(text);
    case 'Sentence case':
      return toSentenceCase(text);
    case 'Title Case':
      return toTitleCase(text);
    case 'camelCase':
      return toCamelCase(text);
    case 'PascalCase':
      return toPascalCase(text);
    case 'snake_case':
      return toSnakeCase(text);
    case 'kebab-case':
      return toKebabCase(text);
    case 'CONSTANT_CASE':
      return toConstantCase(text);
    case 'dot.case':
      return toDotCase(text);
    default:
      return text;
  }
}

export function convertAllCases(input: string): CaseConversionResult[] {
  return [
    { type: 'lowercase', label: 'lower case', example: 'hello world', result: toLowercase(input) },
    { type: 'UPPERCASE', label: 'UPPER CASE', example: 'HELLO WORLD', result: toUppercase(input) },
    { type: 'Sentence case', label: 'Sentence case', example: 'Hello world. Example text.', result: toSentenceCase(input) },
    { type: 'Title Case', label: 'Title Case', example: 'Hello World and Universe', result: toTitleCase(input) },
    { type: 'camelCase', label: 'camelCase', example: 'helloWorldExample', result: toCamelCase(input) },
    { type: 'PascalCase', label: 'PascalCase', example: 'HelloWorldExample', result: toPascalCase(input) },
    { type: 'snake_case', label: 'snake_case', example: 'hello_world_example', result: toSnakeCase(input) },
    { type: 'kebab-case', label: 'kebab-case', example: 'hello-world-example', result: toKebabCase(input) },
    { type: 'CONSTANT_CASE', label: 'CONSTANT_CASE', example: 'HELLO_WORLD_EXAMPLE', result: toConstantCase(input) },
    { type: 'dot.case', label: 'dot.case', example: 'hello.world.example', result: toDotCase(input) },
  ];
}
