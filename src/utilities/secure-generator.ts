import { EFF_WORD_LIST } from './eff-wordlist';

export type GeneratorMode = 'password' | 'passphrase' | 'pin' | 'random-string';

export interface PasswordConfig {
  length: number;
  useUpper: boolean;
  useLower: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
  excludeAmbiguous: boolean;
  ensureEachType: boolean;
}

export interface PassphraseConfig {
  wordCount: number;
  separator: '-' | ' ' | '_' | '.' | '';
  capitalization: 'lower' | 'upper' | 'title' | 'camel';
  includeNumber: boolean;
  includeSymbol?: boolean;
}

export interface PinConfig {
  length: number;
  avoidTrivial: boolean;
}

export interface RandomStringConfig {
  length: number;
  preset: 'alphanumeric' | 'hex' | 'alphanumeric-symbols' | 'custom';
  customCharset: string;
}

const UPPERCASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const NUMBER_CHARS = '0123456789';
const SYMBOL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const AMBIGUOUS_CHARS = '0O1lI|';
const HEX_CHARS = '0123456789abcdef';

// Secure random integer in range [0, max - 1] using rejection sampling to eliminate modulo bias
export function getSecureRandomInt(max: number): number {
  if (max <= 0) return 0;
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % max);
  const buffer = new Uint32Array(1);

  const cryptoObj = typeof crypto !== 'undefined' ? crypto : (typeof window !== 'undefined' ? window.crypto : undefined);
  if (!cryptoObj || !cryptoObj.getRandomValues) {
    throw new Error('Web Crypto API is not available.');
  }

  let randomVal = 0;
  do {
    cryptoObj.getRandomValues(buffer);
    randomVal = buffer[0];
  } while (randomVal >= limit);

  return randomVal % max;
}

// Secure array shuffle (Fisher-Yates)
export function secureShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export function generatePassword(config: PasswordConfig): string {
  let upper = UPPERCASE_CHARS;
  let lower = LOWERCASE_CHARS;
  let numbers = NUMBER_CHARS;
  let symbols = SYMBOL_CHARS;

  if (config.excludeAmbiguous) {
    upper = upper.split('').filter((c) => !AMBIGUOUS_CHARS.includes(c)).join('');
    lower = lower.split('').filter((c) => !AMBIGUOUS_CHARS.includes(c)).join('');
    numbers = numbers.split('').filter((c) => !AMBIGUOUS_CHARS.includes(c)).join('');
    symbols = symbols.split('').filter((c) => !AMBIGUOUS_CHARS.includes(c)).join('');
  }

  const selectedPools: string[] = [];
  if (config.useUpper && upper.length > 0) selectedPools.push(upper);
  if (config.useLower && lower.length > 0) selectedPools.push(lower);
  if (config.useNumbers && numbers.length > 0) selectedPools.push(numbers);
  if (config.useSymbols && symbols.length > 0) selectedPools.push(symbols);

  if (selectedPools.length === 0) {
    return '';
  }

  const allChars = selectedPools.join('');
  const passwordChars: string[] = [];

  // Guarantee at least one character from each active category
  if (config.ensureEachType && config.length >= selectedPools.length) {
    selectedPools.forEach((pool) => {
      const idx = getSecureRandomInt(pool.length);
      passwordChars.push(pool[idx]);
    });
  }

  // Fill remainder
  while (passwordChars.length < config.length) {
    const idx = getSecureRandomInt(allChars.length);
    passwordChars.push(allChars[idx]);
  }

  return secureShuffle(passwordChars).join('');
}

export function generatePassphrase(config: PassphraseConfig): string {
  const words: string[] = [];
  const list = EFF_WORD_LIST.length > 0 ? EFF_WORD_LIST : ['apple', 'banana', 'orange', 'cherry', 'grape'];

  for (let i = 0; i < config.wordCount; i++) {
    const idx = getSecureRandomInt(list.length);
    let word = list[idx];

    if (config.capitalization === 'upper') {
      word = word.toUpperCase();
    } else if (config.capitalization === 'title' || (config.capitalization === 'camel' && i > 0)) {
      word = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    } else if (config.capitalization === 'camel' && i === 0) {
      word = word.toLowerCase();
    } else {
      word = word.toLowerCase();
    }

    words.push(word);
  }

  if (config.includeNumber) {
    const randomNum = getSecureRandomInt(100);
    const targetIdx = getSecureRandomInt(words.length);
    words[targetIdx] = `${words[targetIdx]}${randomNum}`;
  }

  if (config.includeSymbol) {
    const symbols = '!@#$%^&*?';
    const randomSymbol = symbols[getSecureRandomInt(symbols.length)];
    const targetIdx = getSecureRandomInt(words.length);
    words[targetIdx] = `${words[targetIdx]}${randomSymbol}`;
  }

  return words.join(config.separator);
}

export function generatePin(config: PinConfig): string {
  const isTrivial = (pinStr: string): boolean => {
    // All same digits, e.g. 1111, 0000
    if (/^(\d)\1+$/.test(pinStr)) return true;
    // Sequential ascending, e.g. 1234, 4567
    let isAsc = true;
    for (let i = 1; i < pinStr.length; i++) {
      if (pinStr.charCodeAt(i) !== pinStr.charCodeAt(i - 1) + 1) {
        isAsc = false;
        break;
      }
    }
    if (isAsc) return true;
    // Sequential descending, e.g. 4321
    let isDesc = true;
    for (let i = 1; i < pinStr.length; i++) {
      if (pinStr.charCodeAt(i) !== pinStr.charCodeAt(i - 1) - 1) {
        isDesc = false;
        break;
      }
    }
    return isDesc;
  };

  let attempts = 0;
  while (attempts < 50) {
    const digits: string[] = [];
    for (let i = 0; i < config.length; i++) {
      digits.push(String(getSecureRandomInt(10)));
    }
    const pin = digits.join('');
    if (!config.avoidTrivial || !isTrivial(pin)) {
      return pin;
    }
    attempts++;
  }

  // Fallback
  return '9371'.slice(0, config.length);
}

export function generateRandomString(config: RandomStringConfig): string {
  let charset = '';
  if (config.preset === 'alphanumeric') {
    charset = UPPERCASE_CHARS + LOWERCASE_CHARS + NUMBER_CHARS;
  } else if (config.preset === 'hex') {
    charset = HEX_CHARS;
  } else if (config.preset === 'alphanumeric-symbols') {
    charset = UPPERCASE_CHARS + LOWERCASE_CHARS + NUMBER_CHARS + SYMBOL_CHARS;
  } else {
    charset = config.customCharset.trim() || (UPPERCASE_CHARS + LOWERCASE_CHARS + NUMBER_CHARS);
  }

  // Remove duplicate characters from charset
  const uniqueChars = Array.from(new Set(charset.split(''))).join('');
  if (!uniqueChars) return '';

  const chars: string[] = [];
  for (let i = 0; i < config.length; i++) {
    const idx = getSecureRandomInt(uniqueChars.length);
    chars.push(uniqueChars[idx]);
  }

  return chars.join('');
}

// Calculate theoretical entropy in bits
export function calculatePasswordEntropy(config: PasswordConfig): number {
  let poolSize = 0;
  if (config.useUpper) poolSize += 26;
  if (config.useLower) poolSize += 26;
  if (config.useNumbers) poolSize += 10;
  if (config.useSymbols) poolSize += 28;
  if (config.excludeAmbiguous) poolSize -= 6;

  if (poolSize <= 1 || config.length <= 0) return 0;
  return Math.round(config.length * Math.log2(poolSize));
}

export function calculatePassphraseEntropy(config: PassphraseConfig): number {
  const wordlistSize = EFF_WORD_LIST.length || 1000;
  let bits = config.wordCount * Math.log2(wordlistSize);
  if (config.includeNumber) bits += Math.log2(100);
  if (config.includeSymbol) bits += Math.log2(10);
  return Math.round(bits);
}

export function calculatePinEntropy(length: number): number {
  return Math.round(length * Math.log2(10));
}

export function calculateRandomStringEntropy(config: RandomStringConfig): number {
  let poolSize = 62;
  if (config.preset === 'alphanumeric') {
    poolSize = 62;
  } else if (config.preset === 'hex') {
    poolSize = 16;
  } else if (config.preset === 'alphanumeric-symbols') {
    poolSize = 90;
  } else {
    const uniqueChars = Array.from(new Set(config.customCharset.trim().split('')));
    poolSize = Math.max(1, uniqueChars.length);
  }
  return Math.round(config.length * Math.log2(poolSize));
}

export interface EntropyStrength {
  label: 'Very Weak' | 'Weak' | 'Moderate' | 'Strong' | 'Very Strong';
  color: string;
  percentage: number;
}

export function getEntropyStrength(entropyBits: number): EntropyStrength {
  if (entropyBits < 36) {
    return { label: 'Very Weak', color: 'text-rose-600 dark:text-rose-400 bg-rose-500', percentage: 20 };
  }
  if (entropyBits < 56) {
    return { label: 'Weak', color: 'text-amber-600 dark:text-amber-400 bg-amber-500', percentage: 40 };
  }
  if (entropyBits < 76) {
    return { label: 'Moderate', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500', percentage: 65 };
  }
  if (entropyBits < 110) {
    return { label: 'Strong', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500', percentage: 85 };
  }
  return { label: 'Very Strong', color: 'text-blue-600 dark:text-blue-400 bg-blue-500', percentage: 100 };
}
