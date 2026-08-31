/**
 * Batch File Renamer Utility
 * Rule transformations, portable filename sanitization, and deterministic collision resolution.
 */

export interface RenamerFileItem {
  id: string;
  file: File;
  originalName: string;
  originalExt: string;
  newName: string;
  newExt: string;
  hasCollision?: boolean;
}

export type CaseConversionMode = 'none' | 'lowercase' | 'uppercase' | 'titlecase' | 'kebabcase' | 'snakecase' | 'camelcase';
export interface RenamerRules {
  prefix: string; suffix: string; findText: string; replaceText: string; useRegex: boolean; matchCase: boolean;
  replaceSpacesWith: 'none' | 'dash' | 'underscore' | 'dot'; caseConversion: CaseConversionMode;
  sequentialNumbering: boolean; numberingStart: number; numberingPadding: number; numberingPosition: 'start' | 'end';
  insertDate: boolean; dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD' | 'DD-MM-YYYY';
  changeExtension: boolean; customExtension: string; autoResolveCollisions: boolean;
}

export const DEFAULT_RENAMER_RULES: RenamerRules = {
  prefix: '', suffix: '', findText: '', replaceText: '', useRegex: false, matchCase: false,
  replaceSpacesWith: 'none', caseConversion: 'none', sequentialNumbering: false, numberingStart: 1,
  numberingPadding: 2, numberingPosition: 'end', insertDate: false, dateFormat: 'YYYY-MM-DD',
  changeExtension: false, customExtension: '', autoResolveCollisions: true,
};

const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function splitFilename(fullname: string): { base: string; ext: string } {
  const lastDot = fullname.lastIndexOf('.');
  if (lastDot <= 0) return { base: fullname, ext: '' };
  return { base: fullname.substring(0, lastDot), ext: fullname.substring(lastDot + 1) };
}

/** Produces a component that is safe on Windows/macOS/Linux filesystems. */
export function sanitizeFilenameComponent(value: string, fallback = 'untitled', maxLength = 180): string {
  let safe = value
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim();
  if (!safe || safe === '.' || safe === '..') safe = fallback;
  if (WINDOWS_RESERVED.test(safe)) safe = `_${safe}`;
  return Array.from(safe).slice(0, Math.max(1, maxLength)).join('');
}

function collisionKey(base: string, ext: string): string {
  return `${base}${ext ? `.${ext}` : ''}`.normalize('NFC').toLocaleLowerCase();
}

export function applyRenamingRules(files: { id: string; file: File }[], rules: RenamerRules): RenamerFileItem[] {
  const formattedDate = getFormattedDate(rules.dateFormat);
  const transformed: RenamerFileItem[] = files.map((item, index) => {
    const { base, ext } = splitFilename(item.file.name);
    let newBase = base;

    if (rules.findText) {
      try {
        if (rules.useRegex) {
          newBase = newBase.replace(new RegExp(rules.findText, rules.matchCase ? 'g' : 'gi'), rules.replaceText);
        } else if (rules.matchCase) {
          newBase = newBase.split(rules.findText).join(rules.replaceText);
        } else {
          newBase = newBase.replace(new RegExp(escapeRegex(rules.findText), 'gi'), rules.replaceText);
        }
      } catch {
        // Invalid regex leaves the original text intact instead of corrupting names.
      }
    }

    const delimiter = rules.replaceSpacesWith === 'dash' ? '-' : rules.replaceSpacesWith === 'underscore' ? '_' : rules.replaceSpacesWith === 'dot' ? '.' : null;
    if (delimiter) newBase = newBase.replace(/\s+/g, delimiter);
    newBase = applyCaseConversion(newBase, rules.caseConversion);

    if (rules.sequentialNumbering) {
      const numeric = Math.max(0, Math.trunc(rules.numberingStart + index));
      const token = String(numeric).padStart(Math.max(1, rules.numberingPadding), '0');
      newBase = rules.numberingPosition === 'start' ? `${token}_${newBase}` : `${newBase}_${token}`;
    }
    if (rules.insertDate) newBase = `${newBase}_${formattedDate}`;
    if (rules.prefix) newBase = `${rules.prefix}${newBase}`;
    if (rules.suffix) newBase = `${newBase}${rules.suffix}`;

    let targetExt = rules.changeExtension && rules.customExtension.trim() ? rules.customExtension.replace(/^\./, '').trim() : ext;
    newBase = sanitizeFilenameComponent(newBase, 'untitled');
    targetExt = targetExt ? sanitizeFilenameComponent(targetExt, '', 24).replace(/\./g, '') : '';

    return {
      id: item.id, file: item.file, originalName: item.file.name, originalExt: ext,
      newName: newBase, newExt: targetExt, hasCollision: false,
    };
  });

  const used = new Set<string>();
  for (const item of transformed) {
    const originalBase = item.newName;
    let candidateBase = originalBase;
    let suffix = 0;
    while (used.has(collisionKey(candidateBase, item.newExt))) {
      item.hasCollision = true;
      if (!rules.autoResolveCollisions) break;
      suffix += 1;
      candidateBase = sanitizeFilenameComponent(`${originalBase}-${suffix}`, 'untitled');
    }
    if (rules.autoResolveCollisions) item.newName = candidateBase;
    used.add(collisionKey(item.newName, item.newExt));
  }

  // Mark the first member of an unresolved collision group too, so the UI makes
  // the whole conflict visible instead of only later files.
  if (!rules.autoResolveCollisions) {
    const counts = new Map<string, number>();
    for (const item of transformed) {
      const key = collisionKey(item.newName, item.newExt);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const item of transformed) item.hasCollision = (counts.get(collisionKey(item.newName, item.newExt)) || 0) > 1;
  }
  return transformed;
}

function applyCaseConversion(value: string, mode: CaseConversionMode): string {
  switch (mode) {
    case 'lowercase': return value.toLocaleLowerCase();
    case 'uppercase': return value.toLocaleUpperCase();
    case 'titlecase': return value.replace(/[\p{L}\p{N}]+/gu, (token) => token.charAt(0).toLocaleUpperCase() + token.slice(1).toLocaleLowerCase());
    case 'kebabcase': return value.replace(/([\p{Ll}])([\p{Lu}])/gu, '$1-$2').replace(/[\s_.]+/g, '-').toLocaleLowerCase();
    case 'snakecase': return value.replace(/([\p{Ll}])([\p{Lu}])/gu, '$1_$2').replace(/[\s.\-]+/g, '_').toLocaleLowerCase();
    case 'camelcase': {
      const words = value.split(/[\s_.\-]+/).filter(Boolean);
      return words.map((word, index) => index === 0 ? word.toLocaleLowerCase() : word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()).join('');
    }
    default: return value;
  }
}

function getFormattedDate(format: string): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  if (format === 'YYYYMMDD') return `${yyyy}${mm}${dd}`;
  if (format === 'DD-MM-YYYY') return `${dd}-${mm}-${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
