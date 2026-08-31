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

/**
 * Splits identifiers/prose into semantic words using Unicode letter/number
 * classes. Handles acronym boundaries and digit transitions such as
 * XMLHTTPRequest2 -> XML HTTP Request 2 without discarding non-Latin text.
 */
export function splitIntoWords(text: string): string[] {
  if (!text.trim()) return [];

  const withBoundaries = text
    .normalize('NFC')
    .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, '$1 $2')
    .replace(/([\p{Lu}]+)([\p{Lu}][\p{Ll}])/gu, '$1 $2')
    .replace(/([\p{L}])(\p{N})/gu, '$1 $2')
    .replace(/(\p{N})([\p{L}])/gu, '$1 $2')
    .replace(/[_\-./\\~|:,;!?"'()[\]{}<>@#$%^&*+=]+/g, ' ')
    .trim();

  return withBoundaries.split(/\s+/u).filter(Boolean);
}

export function toLowercase(text: string): string {
  return text.toLocaleLowerCase();
}

export function toUppercase(text: string): string {
  return text.toLocaleUpperCase();
}

export function toSentenceCase(text: string): string {
  if (!text) return '';
  return text.toLocaleLowerCase().replace(/(^\s*|[.!?。！？\n]\s*)([\p{L}])/gu, (_, prefix, letter) => {
    return prefix + letter.toLocaleUpperCase();
  });
}

const TITLE_MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'en', 'for', 'if', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'via', 'vs', 'with',
]);

function capitalizeToken(token: string): string {
  const lower = token.toLocaleLowerCase();
  return lower.replace(/^([^\p{L}]*)(\p{L})/u, (_, prefix, letter) => prefix + letter.toLocaleUpperCase());
}

/** English-style title case while preserving line breaks and punctuation. */
export function toTitleCase(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => {
      const tokens = line.match(/\S+|\s+/gu) || [];
      const wordIndices = tokens
        .map((token, index) => (/\p{L}/u.test(token) ? index : -1))
        .filter((index) => index >= 0);
      const firstIndex = wordIndices[0];
      const lastIndex = wordIndices.at(-1);

      return tokens
        .map((token, index) => {
          if (/^\s+$/u.test(token) || !/\p{L}/u.test(token)) return token;
          // Apply title casing independently to hyphenated lexical pieces.
          return token
            .split(/(-)/)
            .map((part, partIndex, parts) => {
              if (part === '-') return part;
              const bare = part.replace(/^[^\p{L}]*/u, '').replace(/[^\p{L}]*$/u, '').toLocaleLowerCase();
              const isBoundary = index === firstIndex || index === lastIndex || partIndex === 0 || partIndex === parts.length - 1;
              return !isBoundary && TITLE_MINOR_WORDS.has(bare) ? part.toLocaleLowerCase() : capitalizeToken(part);
            })
            .join('');
        })
        .join('');
    })
    .join('\n');
}

function lowerWord(word: string): string {
  return word.toLocaleLowerCase();
}

function upperInitial(word: string): string {
  const lower = lowerWord(word);
  const chars = Array.from(lower);
  return chars.length ? chars[0].toLocaleUpperCase() + chars.slice(1).join('') : '';
}

export function toCamelCase(text: string): string {
  return splitIntoWords(text).map((word, index) => index === 0 ? lowerWord(word) : upperInitial(word)).join('');
}

export function toPascalCase(text: string): string {
  return splitIntoWords(text).map(upperInitial).join('');
}

export function toSnakeCase(text: string): string {
  return splitIntoWords(text).map(lowerWord).join('_');
}

export function toKebabCase(text: string): string {
  return splitIntoWords(text).map(lowerWord).join('-');
}

export function toConstantCase(text: string): string {
  return splitIntoWords(text).map((word) => word.toLocaleUpperCase()).join('_');
}

export function toDotCase(text: string): string {
  return splitIntoWords(text).map(lowerWord).join('.');
}

export function convertCase(text: string, type: CaseType): string {
  switch (type) {
    case 'lowercase': return toLowercase(text);
    case 'UPPERCASE': return toUppercase(text);
    case 'Sentence case': return toSentenceCase(text);
    case 'Title Case': return toTitleCase(text);
    case 'camelCase': return toCamelCase(text);
    case 'PascalCase': return toPascalCase(text);
    case 'snake_case': return toSnakeCase(text);
    case 'kebab-case': return toKebabCase(text);
    case 'CONSTANT_CASE': return toConstantCase(text);
    case 'dot.case': return toDotCase(text);
    default: return text;
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
