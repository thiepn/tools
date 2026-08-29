/**
 * Batch File Renamer Utility
 * Rule transformation engine, case formatting, collision detection, and sequential numbering
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

export type CaseConversionMode =
  | 'none'
  | 'lowercase'
  | 'uppercase'
  | 'titlecase'
  | 'kebabcase'
  | 'snakecase'
  | 'camelcase';

export interface RenamerRules {
  prefix: string;
  suffix: string;
  findText: string;
  replaceText: string;
  useRegex: boolean;
  matchCase: boolean;
  replaceSpacesWith: 'none' | 'dash' | 'underscore' | 'dot';
  caseConversion: CaseConversionMode;
  sequentialNumbering: boolean;
  numberingStart: number;
  numberingPadding: number; // 1, 2, 3, 4
  numberingPosition: 'start' | 'end';
  insertDate: boolean;
  dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD' | 'DD-MM-YYYY';
  changeExtension: boolean;
  customExtension: string;
  autoResolveCollisions: boolean;
}

export const DEFAULT_RENAMER_RULES: RenamerRules = {
  prefix: '',
  suffix: '',
  findText: '',
  replaceText: '',
  useRegex: false,
  matchCase: false,
  replaceSpacesWith: 'none',
  caseConversion: 'none',
  sequentialNumbering: false,
  numberingStart: 1,
  numberingPadding: 2,
  numberingPosition: 'end',
  insertDate: false,
  dateFormat: 'YYYY-MM-DD',
  changeExtension: false,
  customExtension: '',
  autoResolveCollisions: true,
};

/**
 * Splits filename into base name and extension
 */
export function splitFilename(fullname: string): { base: string; ext: string } {
  const lastDot = fullname.lastIndexOf('.');
  if (lastDot <= 0) {
    return { base: fullname, ext: '' };
  }
  return {
    base: fullname.substring(0, lastDot),
    ext: fullname.substring(lastDot + 1),
  };
}

/**
 * Applies renaming rules across a batch of files with duplicate collision detection
 */
export function applyRenamingRules(
  files: { id: string; file: File }[],
  rules: RenamerRules
): RenamerFileItem[] {
  const formattedDate = getFormattedDate(rules.dateFormat);
  const nameOccurrences = new Map<string, number>();

  // Pass 1: Transform base names according to rules
  const results: RenamerFileItem[] = files.map((item, idx) => {
    const { base, ext } = splitFilename(item.file.name);
    let newBase = base;

    // 1. Find & Replace
    if (rules.findText) {
      try {
        if (rules.useRegex) {
          const flags = rules.matchCase ? 'g' : 'gi';
          const reg = new RegExp(rules.findText, flags);
          newBase = newBase.replace(reg, rules.replaceText);
        } else {
          if (rules.matchCase) {
            newBase = newBase.split(rules.findText).join(rules.replaceText);
          } else {
            const reg = new RegExp(escapeRegex(rules.findText), 'gi');
            newBase = newBase.replace(reg, rules.replaceText);
          }
        }
      } catch {
        // Regex syntax fallback
      }
    }

    // 2. Replace Spaces
    if (rules.replaceSpacesWith === 'dash') {
      newBase = newBase.replace(/\s+/g, '-');
    } else if (rules.replaceSpacesWith === 'underscore') {
      newBase = newBase.replace(/\s+/g, '_');
    } else if (rules.replaceSpacesWith === 'dot') {
      newBase = newBase.replace(/\s+/g, '.');
    }

    // 3. Case Conversion
    newBase = applyCaseConversion(newBase, rules.caseConversion);

    // 4. Sequential Numbering
    if (rules.sequentialNumbering) {
      const numVal = rules.numberingStart + idx;
      const numStr = String(numVal).padStart(rules.numberingPadding, '0');
      if (rules.numberingPosition === 'start') {
        newBase = `${numStr}_${newBase}`;
      } else {
        newBase = `${newBase}_${numStr}`;
      }
    }

    // 5. Insert Date
    if (rules.insertDate) {
      newBase = `${newBase}_${formattedDate}`;
    }

    // 6. Prefix & Suffix
    if (rules.prefix) {
      newBase = `${rules.prefix}${newBase}`;
    }
    if (rules.suffix) {
      newBase = `${newBase}${rules.suffix}`;
    }

    // Extension resolution
    let targetExt = ext;
    if (rules.changeExtension && rules.customExtension.trim()) {
      targetExt = rules.customExtension.replace(/^\./, '').trim();
    }

    return {
      id: item.id,
      file: item.file,
      originalName: item.file.name,
      originalExt: ext,
      newName: newBase,
      newExt: targetExt,
      hasCollision: false,
    };
  });

  // Pass 2: Collision detection and resolution
  for (let i = 0; i < results.length; i++) {
    const it = results[i];
    const fullTarget = it.newExt ? `${it.newName}.${it.newExt}` : it.newName;
    const currentCount = nameOccurrences.get(fullTarget) || 0;

    if (currentCount > 0) {
      it.hasCollision = true;
      if (rules.autoResolveCollisions) {
        it.newName = `${it.newName}-${currentCount}`;
      }
    }

    nameOccurrences.set(fullTarget, currentCount + 1);
  }

  return results;
}

function applyCaseConversion(str: string, mode: CaseConversionMode): string {
  switch (mode) {
    case 'lowercase':
      return str.toLowerCase();
    case 'uppercase':
      return str.toUpperCase();
    case 'titlecase':
      return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    case 'kebabcase':
      return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_.]+/g, '-')
        .toLowerCase();
    case 'snakecase':
      return str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-.]+/g, '_')
        .toLowerCase();
    case 'camelcase': {
      const words = str.split(/[\s_.-]+/);
      return words
        .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.substring(1).toLowerCase()))
        .join('');
    }
    case 'none':
    default:
      return str;
  }
}

function getFormattedDate(fmt: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  if (fmt === 'YYYYMMDD') return `${yyyy}${mm}${dd}`;
  if (fmt === 'DD-MM-YYYY') return `${dd}-${mm}-${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
