export type NumericSummary = {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  populationStdDev: number;
  sampleStdDev: number;
};

const finite = (value: number, label: string) => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
};
const nonNegative = (value: number, label: string) => {
  finite(value, label);
  if (value < 0) throw new Error(`${label} cannot be negative.`);
  return value;
};
const positive = (value: number, label: string) => {
  finite(value, label);
  if (value <= 0) throw new Error(`${label} must be greater than zero.`);
  return value;
};
const round = (value: number, digits = 8) => Number(value.toFixed(digits));

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const position = Math.max(0, Math.min(1, p)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function summarizeNumbers(values: number[]): NumericSummary {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) throw new Error('Enter at least one valid number.');
  const sorted = [...clean].sort((a, b) => a - b);
  const sum = clean.reduce((a, b) => a + b, 0);
  const mean = sum / clean.length;
  const populationVariance = clean.reduce((acc, value) => acc + (value - mean) ** 2, 0) / clean.length;
  const sampleVariance = clean.length > 1 ? clean.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (clean.length - 1) : 0;
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  return {
    count: clean.length,
    sum: round(sum),
    mean: round(mean),
    median: round(percentile(sorted, 0.5)),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    range: round(sorted[sorted.length - 1] - sorted[0]),
    q1: round(q1),
    q3: round(q3),
    iqr: round(q3 - q1),
    populationStdDev: round(Math.sqrt(populationVariance)),
    sampleStdDev: round(Math.sqrt(sampleVariance)),
  };
}

export type TimingSummary = {
  samples: number;
  medianIntervalMs: number;
  meanIntervalMs: number;
  minIntervalMs: number;
  maxIntervalMs: number;
  p95IntervalMs: number;
  jitterStdDevMs: number;
  estimatedHz: number;
  stabilityPercent: number;
};

export function summarizeTimestamps(timestamps: number[]): TimingSummary {
  const intervals = timestamps.slice(1).map((value, index) => value - timestamps[index]).filter((value) => Number.isFinite(value) && value > 0 && value < 1000);
  if (intervals.length < 2) throw new Error('Collect more samples first.');
  const stats = summarizeNumbers(intervals);
  const medianIntervalMs = stats.median;
  const jitterStdDevMs = stats.populationStdDev;
  const stabilityPercent = medianIntervalMs > 0 ? Math.max(0, 100 - (jitterStdDevMs / medianIntervalMs) * 100) : 0;
  return {
    samples: intervals.length,
    medianIntervalMs,
    meanIntervalMs: stats.mean,
    minIntervalMs: stats.min,
    maxIntervalMs: stats.max,
    p95IntervalMs: round(percentile([...intervals].sort((a, b) => a - b), 0.95)),
    jitterStdDevMs,
    estimatedHz: round(1000 / medianIntervalMs, 3),
    stabilityPercent: round(stabilityPercent, 2),
  };
}

export type TouchCoverage = {
  visitedCells: number;
  totalCells: number;
  coveragePercent: number;
  edgeCoveragePercent: number;
  maxConcurrentPointers: number;
  samples: number;
};

export function summarizeTouchCoverage(samples: Array<{ x: number; y: number; concurrent: number }>, grid = 8): TouchCoverage {
  const totalCells = grid * grid;
  const visited = new Set<string>();
  const edge = new Set<string>();
  for (const sample of samples) {
    if (!Number.isFinite(sample.x) || !Number.isFinite(sample.y)) continue;
    const col = Math.max(0, Math.min(grid - 1, Math.floor(sample.x * grid)));
    const row = Math.max(0, Math.min(grid - 1, Math.floor(sample.y * grid)));
    const key = `${row}:${col}`;
    visited.add(key);
    if (row === 0 || col === 0 || row === grid - 1 || col === grid - 1) edge.add(key);
  }
  const edgeCells = grid * 4 - 4;
  return {
    visitedCells: visited.size,
    totalCells,
    coveragePercent: round((visited.size / totalCells) * 100, 2),
    edgeCoveragePercent: round((edge.size / edgeCells) * 100, 2),
    maxConcurrentPointers: samples.reduce((max, sample) => Math.max(max, sample.concurrent || 0), 0),
    samples: samples.length,
  };
}

export type KeyboardRolloverSummary = {
  events: number;
  uniqueCodes: number;
  maximumHeld: number;
  repeatedKeydowns: number;
  missingReleaseCandidates: string[];
};

export function summarizeKeyboardRollover(events: Array<{ code: string; type: 'down' | 'up'; repeat?: boolean }>): KeyboardRolloverSummary {
  const held = new Set<string>();
  const unique = new Set<string>();
  let maximumHeld = 0;
  let repeatedKeydowns = 0;
  for (const event of events) {
    if (!event.code) continue;
    unique.add(event.code);
    if (event.type === 'down') {
      if (event.repeat || held.has(event.code)) repeatedKeydowns += 1;
      held.add(event.code);
      maximumHeld = Math.max(maximumHeld, held.size);
    } else held.delete(event.code);
  }
  return { events: events.length, uniqueCodes: unique.size, maximumHeld, repeatedKeydowns, missingReleaseCandidates: [...held].sort() };
}

// ---------------------------
// Calculator engines
// ---------------------------

type Token = { type: 'number' | 'operator' | 'paren' | 'function' | 'constant'; value: string };
const CALC_FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  log: Math.log10,
  ln: Math.log,
};
const CALC_CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function tokenizeExpression(input: string): Token[] {
  const source = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').trim();
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9.]/.test(ch)) {
      let text = '';
      while (i < source.length && /[0-9.eE+-]/.test(source[i])) {
        const next = source[i];
        if ((next === '+' || next === '-') && text && !/[eE]$/.test(text)) break;
        text += next; i += 1;
      }
      const value = Number(text);
      if (!Number.isFinite(value)) throw new Error(`Invalid number: ${text}`);
      tokens.push({ type: 'number', value: String(value) });
      continue;
    }
    if ('+-*/%^'.includes(ch)) { tokens.push({ type: 'operator', value: ch }); i += 1; continue; }
    if ('()'.includes(ch)) { tokens.push({ type: 'paren', value: ch }); i += 1; continue; }
    if (/[A-Za-z]/.test(ch)) {
      let word = '';
      while (i < source.length && /[A-Za-z]/.test(source[i])) { word += source[i]; i += 1; }
      const key = word.toLowerCase();
      if (key in CALC_FUNCTIONS) tokens.push({ type: 'function', value: key });
      else if (key in CALC_CONSTANTS) tokens.push({ type: 'constant', value: key });
      else throw new Error(`Unknown function or constant: ${word}`);
      continue;
    }
    throw new Error(`Unsupported character: ${ch}`);
  }
  return tokens;
}

export function evaluateCalculatorExpression(input: string): number {
  const tokens = tokenizeExpression(input);
  if (!tokens.length) throw new Error('Enter an expression.');
  const output: Token[] = [];
  const operators: Token[] = [];
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, 'u-': 4 };
  const rightAssociative = new Set(['^', 'u-']);
  let previous: Token | undefined;
  for (const original of tokens) {
    let token = original;
    if (token.type === 'operator' && token.value === '-' && (!previous || previous.type === 'operator' || (previous.type === 'paren' && previous.value === '('))) token = { type: 'operator', value: 'u-' };
    if (token.type === 'number' || token.type === 'constant') output.push(token);
    else if (token.type === 'function') operators.push(token);
    else if (token.type === 'operator') {
      while (operators.length) {
        const top = operators[operators.length - 1];
        if (top.type === 'function') { output.push(operators.pop()!); continue; }
        if (top.type !== 'operator') break;
        const topPrec = precedence[top.value] ?? 0;
        const currentPrec = precedence[token.value] ?? 0;
        if (topPrec > currentPrec || (topPrec === currentPrec && !rightAssociative.has(token.value))) output.push(operators.pop()!);
        else break;
      }
      operators.push(token);
    } else if (token.type === 'paren' && token.value === '(') operators.push(token);
    else if (token.type === 'paren' && token.value === ')') {
      while (operators.length && !(operators[operators.length - 1].type === 'paren' && operators[operators.length - 1].value === '(')) output.push(operators.pop()!);
      if (!operators.length) throw new Error('Mismatched parentheses.');
      operators.pop();
      if (operators[operators.length - 1]?.type === 'function') output.push(operators.pop()!);
    }
    previous = token;
  }
  while (operators.length) {
    const token = operators.pop()!;
    if (token.type === 'paren') throw new Error('Mismatched parentheses.');
    output.push(token);
  }
  const stack: number[] = [];
  for (const token of output) {
    if (token.type === 'number') stack.push(Number(token.value));
    else if (token.type === 'constant') stack.push(CALC_CONSTANTS[token.value]);
    else if (token.type === 'function') {
      if (!stack.length) throw new Error(`Missing argument for ${token.value}.`);
      const value = CALC_FUNCTIONS[token.value](stack.pop()!);
      if (!Number.isFinite(value)) throw new Error(`${token.value} produced an invalid result.`);
      stack.push(value);
    } else if (token.type === 'operator') {
      if (token.value === 'u-') { if (!stack.length) throw new Error('Missing value after unary minus.'); stack.push(-stack.pop()!); continue; }
      if (stack.length < 2) throw new Error(`Missing operand for ${token.value}.`);
      const b = stack.pop()!;
      const a = stack.pop()!;
      let value = 0;
      if (token.value === '+') value = a + b;
      else if (token.value === '-') value = a - b;
      else if (token.value === '*') value = a * b;
      else if (token.value === '/') { if (b === 0) throw new Error('Division by zero.'); value = a / b; }
      else if (token.value === '%') { if (b === 0) throw new Error('Modulo by zero.'); value = a % b; }
      else if (token.value === '^') value = a ** b;
      if (!Number.isFinite(value)) throw new Error('The expression produced a non-finite result.');
      stack.push(value);
    }
  }
  if (stack.length !== 1) throw new Error('Incomplete expression.');
  return round(stack[0], 12);
}

export type TipResult = {
  subtotal: number;
  tipBase: number;
  tip: number;
  tax: number;
  serviceCharge: number;
  total: number;
  perPerson: number;
  roundedPerPerson: number;
  roundingDifference: number;
};
export function calculateTip(input: { subtotal: number; tipPercent: number; taxPercent?: number; servicePercent?: number; people?: number; tipOnTax?: boolean; roundPerPerson?: number }): TipResult {
  const subtotal = nonNegative(input.subtotal, 'Subtotal');
  const tipPercent = nonNegative(input.tipPercent, 'Tip percentage');
  const taxPercent = nonNegative(input.taxPercent ?? 0, 'Tax percentage');
  const servicePercent = nonNegative(input.servicePercent ?? 0, 'Service percentage');
  const people = positive(input.people ?? 1, 'People');
  const tax = subtotal * taxPercent / 100;
  const serviceCharge = subtotal * servicePercent / 100;
  const tipBase = input.tipOnTax ? subtotal + tax + serviceCharge : subtotal;
  const tip = tipBase * tipPercent / 100;
  const total = subtotal + tax + serviceCharge + tip;
  const perPerson = total / people;
  const increment = positive(input.roundPerPerson ?? 0.01, 'Rounding increment');
  const roundedPerPerson = Math.ceil(perPerson / increment - 1e-12) * increment;
  return { subtotal: round(subtotal, 2), tipBase: round(tipBase, 2), tip: round(tip, 2), tax: round(tax, 2), serviceCharge: round(serviceCharge, 2), total: round(total, 2), perPerson: round(perPerson, 2), roundedPerPerson: round(roundedPerPerson, 2), roundingDifference: round(roundedPerPerson * people - total, 2) };
}

export type BillPerson = { name: string; subtotal: number; share: number; tax: number; tip: number; total: number };
export function splitBillItemized(items: Array<{ amount: number; participants: string[] }>, people: string[], taxPercent = 0, tipPercent = 0): BillPerson[] {
  const names = people.map((name) => name.trim()).filter(Boolean);
  if (!names.length) throw new Error('Add at least one person.');
  const subtotal = Object.fromEntries(names.map((name) => [name, 0])) as Record<string, number>;
  for (const item of items) {
    nonNegative(item.amount, 'Item amount');
    const participants = item.participants.filter((name) => names.includes(name));
    if (!participants.length) continue;
    const each = item.amount / participants.length;
    for (const name of participants) subtotal[name] += each;
  }
  const totalSubtotal = Object.values(subtotal).reduce((a, b) => a + b, 0);
  return names.map((name) => {
    const share = totalSubtotal ? subtotal[name] / totalSubtotal : 1 / names.length;
    const tax = subtotal[name] * nonNegative(taxPercent, 'Tax percentage') / 100;
    const tip = subtotal[name] * nonNegative(tipPercent, 'Tip percentage') / 100;
    return { name, subtotal: round(subtotal[name], 2), share: round(share * 100, 2), tax: round(tax, 2), tip: round(tip, 2), total: round(subtotal[name] + tax + tip, 2) };
  });
}

export type InterestRow = { period: number; principal: number; interest: number; balance: number };
export function simpleInterestSchedule(principal: number, annualRatePercent: number, years: number, periodsPerYear = 12): { interest: number; total: number; effectiveAnnualReturnPercent: number; schedule: InterestRow[] } {
  positive(principal, 'Principal');
  nonNegative(annualRatePercent, 'Annual rate');
  positive(years, 'Years');
  positive(periodsPerYear, 'Periods per year');
  const totalPeriods = Math.max(1, Math.round(years * periodsPerYear));
  const totalInterest = principal * (annualRatePercent / 100) * years;
  const interestPerPeriod = totalInterest / totalPeriods;
  const schedule = Array.from({ length: totalPeriods }, (_, index) => ({ period: index + 1, principal: round(principal, 2), interest: round(interestPerPeriod, 2), balance: round(principal + interestPerPeriod * (index + 1), 2) }));
  return { interest: round(totalInterest, 2), total: round(principal + totalInterest, 2), effectiveAnnualReturnPercent: round(((principal + totalInterest) / principal) ** (1 / years) * 100 - 100, 4), schedule };
}

export type RoomShape =
  | { kind: 'rectangle'; width: number; length: number }
  | { kind: 'triangle'; base: number; height: number }
  | { kind: 'circle'; diameter: number };
export function areaOfShape(shape: RoomShape): number {
  if (shape.kind === 'rectangle') return positive(shape.width, 'Width') * positive(shape.length, 'Length');
  if (shape.kind === 'triangle') return positive(shape.base, 'Base') * positive(shape.height, 'Height') / 2;
  return Math.PI * (positive(shape.diameter, 'Diameter') / 2) ** 2;
}
export function summarizeRooms(rooms: RoomShape[], wastePercent = 0): { netArea: number; wasteArea: number; purchaseArea: number } {
  if (!rooms.length) throw new Error('Add at least one room or shape.');
  const netArea = rooms.reduce((sum, shape) => sum + areaOfShape(shape), 0);
  const wasteArea = netArea * nonNegative(wastePercent, 'Waste percentage') / 100;
  return { netArea: round(netArea, 3), wasteArea: round(wasteArea, 3), purchaseArea: round(netArea + wasteArea, 3) };
}

export function paintEstimate(input: { wallArea: number; openingArea?: number; coats?: number; coveragePerUnit: number; wastePercent?: number; containerSizes?: number[]; pricePerContainer?: number }): { paintArea: number; requiredVolume: number; containers: number; purchasedVolume: number; leftoverVolume: number; estimatedCost: number } {
  const wallArea = nonNegative(input.wallArea, 'Wall area');
  const openingArea = nonNegative(input.openingArea ?? 0, 'Opening area');
  const coats = positive(input.coats ?? 1, 'Coats');
  const coverage = positive(input.coveragePerUnit, 'Coverage');
  const netArea = Math.max(0, wallArea - openingArea) * coats;
  const requiredVolume = (netArea / coverage) * (1 + nonNegative(input.wastePercent ?? 0, 'Waste percentage') / 100);
  const sizes = (input.containerSizes?.length ? input.containerSizes : [1]).filter((size) => size > 0).sort((a, b) => b - a);
  const largest = sizes[0];
  let remaining = requiredVolume;
  let containers = 0;
  let purchasedVolume = 0;
  while (remaining > 1e-9 && containers < 10000) {
    const chosen = [...sizes].reverse().find((size) => size >= remaining) ?? largest;
    containers += 1;
    purchasedVolume += chosen;
    remaining = Math.max(0, remaining - chosen);
  }
  const estimatedCost = containers * nonNegative(input.pricePerContainer ?? 0, 'Container price');
  return { paintArea: round(netArea, 2), requiredVolume: round(requiredVolume, 3), containers, purchasedVolume: round(purchasedVolume, 3), leftoverVolume: round(Math.max(0, purchasedVolume - requiredVolume), 3), estimatedCost: round(estimatedCost, 2) };
}

export function flooringEstimate(input: { area: number; wastePercent?: number; packCoverage: number; pricePerPack?: number }): { requiredArea: number; packs: number; purchasedArea: number; leftoverArea: number; cost: number } {
  const requiredArea = positive(input.area, 'Area') * (1 + nonNegative(input.wastePercent ?? 0, 'Waste percentage') / 100);
  const packCoverage = positive(input.packCoverage, 'Pack coverage');
  const packs = Math.ceil(requiredArea / packCoverage - 1e-12);
  const purchasedArea = packs * packCoverage;
  return { requiredArea: round(requiredArea, 3), packs, purchasedArea: round(purchasedArea, 3), leftoverArea: round(purchasedArea - requiredArea, 3), cost: round(packs * nonNegative(input.pricePerPack ?? 0, 'Pack price'), 2) };
}

export function tileEstimate(input: { area: number; tileWidth: number; tileHeight: number; groutWidth?: number; wastePercent?: number; tilesPerBox?: number; pricePerBox?: number }): { tileAreaWithGrout: number; tiles: number; tilesWithWaste: number; boxes: number; purchasedTiles: number; cost: number } {
  const area = positive(input.area, 'Area');
  const grout = nonNegative(input.groutWidth ?? 0, 'Grout width');
  const tileWidth = positive(input.tileWidth, 'Tile width');
  const tileHeight = positive(input.tileHeight, 'Tile height');
  const effectiveTileArea = (tileWidth + grout) * (tileHeight + grout);
  const rawTiles = Math.ceil(area / effectiveTileArea - 1e-12);
  const tilesWithWaste = Math.ceil(rawTiles * (1 + nonNegative(input.wastePercent ?? 0, 'Waste percentage') / 100) - 1e-12);
  const tilesPerBox = Math.max(1, Math.floor(positive(input.tilesPerBox ?? 1, 'Tiles per box')));
  const boxes = Math.ceil(tilesWithWaste / tilesPerBox);
  return { tileAreaWithGrout: round(effectiveTileArea, 6), tiles: rawTiles, tilesWithWaste, boxes, purchasedTiles: boxes * tilesPerBox, cost: round(boxes * nonNegative(input.pricePerBox ?? 0, 'Box price'), 2) };
}

export function boxMetrics(length: number, width: number, height: number, dimensionalDivisor = 5000): { volume: number; surfaceArea: number; diagonal: number; dimensionalWeight: number } {
  positive(length, 'Length'); positive(width, 'Width'); positive(height, 'Height'); positive(dimensionalDivisor, 'Dimensional divisor');
  return { volume: round(length * width * height, 6), surfaceArea: round(2 * (length * width + length * height + width * height), 6), diagonal: round(Math.sqrt(length ** 2 + width ** 2 + height ** 2), 6), dimensionalWeight: round((length * width * height) / dimensionalDivisor, 6) };
}

// ---------------------------
// TAR / GZIP helpers
// ---------------------------

function writeAscii(target: Uint8Array, offset: number, length: number, value: string) {
  const bytes = new TextEncoder().encode(value);
  target.set(bytes.slice(0, length), offset);
}
function writeOctal(target: Uint8Array, offset: number, length: number, value: number) {
  const text = Math.max(0, Math.floor(value)).toString(8).padStart(length - 1, '0').slice(-(length - 1)) + '\0';
  writeAscii(target, offset, length, text);
}
function tarHeader(name: string, size: number, mtime: number): Uint8Array {
  const header = new Uint8Array(512);
  writeAscii(header, 0, 100, name);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, Math.floor(mtime / 1000));
  header.fill(32, 148, 156);
  header[156] = '0'.charCodeAt(0);
  writeAscii(header, 257, 6, 'ustar\0');
  writeAscii(header, 263, 2, '00');
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  const text = checksum.toString(8).padStart(6, '0').slice(-6) + '\0 ';
  writeAscii(header, 148, 8, text);
  return header;
}
export type TarInput = { name: string; bytes: Uint8Array; mtime?: number };
export function packTar(files: TarInput[]): Uint8Array {
  if (!files.length) throw new Error('Add at least one file.');
  const chunks: Uint8Array[] = [];
  let total = 1024;
  for (const file of files) {
    if (!file.name || file.name.includes('\0')) throw new Error('Every TAR member needs a valid file name.');
    const body = file.bytes;
    const header = tarHeader(file.name.slice(0, 100), body.length, file.mtime ?? Date.now());
    const padded = Math.ceil(body.length / 512) * 512;
    const block = new Uint8Array(512 + padded);
    block.set(header, 0); block.set(body, 512);
    chunks.push(block); total += block.length;
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}
function readNullTerminated(bytes: Uint8Array, start: number, length: number): string {
  const part = bytes.slice(start, start + length);
  const end = part.indexOf(0);
  return new TextDecoder().decode(end >= 0 ? part.slice(0, end) : part).trim();
}
function readOctal(bytes: Uint8Array, start: number, length: number): number {
  const text = readNullTerminated(bytes, start, length).replace(/\0/g, '').trim();
  return text ? parseInt(text, 8) : 0;
}
export type TarEntry = { name: string; size: number; mtime: number; type: string; bytes: Uint8Array };
export function extractTar(bytes: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.slice(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = readNullTerminated(header, 0, 100);
    const size = readOctal(header, 124, 12);
    const mtime = readOctal(header, 136, 12) * 1000;
    const type = String.fromCharCode(header[156] || 48);
    if (!name) throw new Error(`Invalid TAR header at byte ${offset}.`);
    if (size < 0 || offset + 512 + size > bytes.length) throw new Error(`TAR member ${name} extends beyond the archive.`);
    entries.push({ name, size, mtime, type, bytes: bytes.slice(offset + 512, offset + 512 + size) });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

export function crc32(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

export function inspectGzipHeader(bytes: Uint8Array): { valid: boolean; method: number; flags: number; mtime: number | null; originalSize: number | null } {
  if (bytes.length < 10 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return { valid: false, method: bytes[2] ?? -1, flags: bytes[3] ?? 0, mtime: null, originalSize: null };
  const mtimeSeconds = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  const originalSize = bytes.length >= 4 ? (bytes[bytes.length - 4] | (bytes[bytes.length - 3] << 8) | (bytes[bytes.length - 2] << 16) | (bytes[bytes.length - 1] << 24)) >>> 0 : null;
  return { valid: bytes[2] === 8, method: bytes[2], flags: bytes[3], mtime: mtimeSeconds > 0 ? mtimeSeconds * 1000 : null, originalSize };
}

// ---------------------------
// Text and planning
// ---------------------------

export type ReverseMode = 'graphemes' | 'words' | 'lines' | 'line-order';
export function reverseTextStrict(input: string, mode: ReverseMode): string {
  if (mode === 'lines') return input.split(/\r?\n/).map((line) => reverseGraphemes(line)).join('\n');
  if (mode === 'line-order') return input.split(/\r?\n/).reverse().join('\n');
  if (mode === 'words') return input.split(/(\s+)/).reverse().join('');
  return reverseGraphemes(input);
}
function reverseGraphemes(input: string): string {
  const SegmenterCtor = (Intl as typeof Intl & { Segmenter?: new (...args: any[]) => { segment: (value: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (SegmenterCtor) return [...new SegmenterCtor(undefined, { granularity: 'grapheme' }).segment(input)].map((part) => part.segment).reverse().join('');
  return Array.from(input).reverse().join('');
}

export function repeatTextStrict(input: string, count: number, separator: string, options?: { prefix?: string; suffix?: string; numberLines?: boolean; startAt?: number }): { output: string; characters: number; bytes: number } {
  const safeCount = Math.max(0, Math.min(100000, Math.floor(finite(count, 'Repeat count'))));
  const prefix = options?.prefix ?? '';
  const suffix = options?.suffix ?? '';
  const startAt = Math.floor(options?.startAt ?? 1);
  const parts = Array.from({ length: safeCount }, (_, index) => `${options?.numberLines ? `${startAt + index}. ` : ''}${prefix}${input}${suffix}`);
  const output = parts.join(separator);
  return { output, characters: Array.from(output).length, bytes: new TextEncoder().encode(output).length };
}

const LOREM_WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure dolor reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');
function seeded(seed: number) { let state = (seed >>> 0) || 0x9e3779b9; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; }; }
export function generateLorem(input: { seed: number; paragraphs: number; sentencesPerParagraph: number; wordsPerSentence: number; format?: 'plain' | 'markdown' | 'html' }): string {
  const random = seeded(Math.floor(finite(input.seed, 'Seed')));
  const paragraphs = Math.max(1, Math.min(200, Math.floor(positive(input.paragraphs, 'Paragraphs'))));
  const sentences = Math.max(1, Math.min(50, Math.floor(positive(input.sentencesPerParagraph, 'Sentences per paragraph'))));
  const words = Math.max(3, Math.min(100, Math.floor(positive(input.wordsPerSentence, 'Words per sentence'))));
  const values = Array.from({ length: paragraphs }, () => Array.from({ length: sentences }, () => {
    const sentence = Array.from({ length: words }, (_, index) => {
      const word = LOREM_WORDS[Math.floor(random() * LOREM_WORDS.length)];
      return index === 0 ? word[0].toUpperCase() + word.slice(1) : word;
    }).join(' ');
    return `${sentence}.`;
  }).join(' '));
  if (input.format === 'html') return values.map((value) => `<p>${value}</p>`).join('\n');
  if (input.format === 'markdown') return values.join('\n\n');
  return values.join('\n\n');
}

export type ReadingPlanDay = { day: number; date: string; start: number; end: number; amount: number; cumulative: number; rest: boolean };
export function buildReadingPlan(input: { totalUnits: number; startDate: string; endDate: string; restWeekdays?: number[]; frontLoadPercent?: number; unitLabel?: string }): ReadingPlanDay[] {
  const totalUnits = Math.max(1, Math.floor(positive(input.totalUnits, 'Total units')));
  const start = new Date(`${input.startDate}T12:00:00`);
  const end = new Date(`${input.endDate}T12:00:00`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) throw new Error('Choose valid start and end dates.');
  if (end < start) throw new Error('End date cannot be before start date.');
  const dates: Date[] = [];
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) dates.push(new Date(date));
  const rest = new Set((input.restWeekdays ?? []).map((value) => Math.max(0, Math.min(6, Math.floor(value)))));
  const active = dates.filter((date) => !rest.has(date.getDay()));
  if (!active.length) throw new Error('At least one reading day is required.');
  const front = Math.max(-50, Math.min(50, input.frontLoadPercent ?? 0)) / 100;
  const weights = active.map((_, index) => {
    const t = active.length === 1 ? 0 : index / (active.length - 1);
    return Math.max(0.1, 1 + front * (1 - 2 * t));
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((weight) => totalUnits * weight / weightSum);
  const amounts = exact.map(Math.floor);
  let remainder = totalUnits - amounts.reduce((a, b) => a + b, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remainder; i += 1) amounts[order[i % order.length].index] += 1;
  let activeIndex = 0;
  let cumulative = 0;
  return dates.map((date, index) => {
    const isRest = rest.has(date.getDay());
    const amount = isRest ? 0 : amounts[activeIndex++];
    const startUnit = cumulative + (amount > 0 ? 1 : 0);
    cumulative += amount;
    return { day: index + 1, date: date.toISOString().slice(0, 10), start: amount ? startUnit : cumulative, end: cumulative, amount, cumulative, rest: isRest };
  });
}

// ---------------------------
// Number words and habits
// ---------------------------

const SMALL = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion'];
function underThousand(value: number): string {
  const parts: string[] = [];
  if (value >= 100) { parts.push(`${SMALL[Math.floor(value / 100)]} hundred`); value %= 100; }
  if (value >= 20) { const ten = TENS[Math.floor(value / 10)]; const one = value % 10; parts.push(one ? `${ten}-${SMALL[one]}` : ten); }
  else if (value > 0 || !parts.length) parts.push(SMALL[value]);
  return parts.join(' ');
}
export function numberToEnglishWords(value: string | number, options?: { ordinal?: boolean; currency?: 'USD' | 'EUR' | 'GBP' | 'none' }): string {
  const raw = String(value).trim().replace(/,/g, '');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(raw)) throw new Error('Enter a plain decimal number.');
  const negative = raw.startsWith('-');
  const unsigned = raw.replace(/^[+-]/, '');
  const [wholeText, fractionText = ''] = unsigned.split('.');
  const whole = BigInt(wholeText || '0');
  if (whole > 999999999999999999n) throw new Error('Values above 999 quadrillion are outside this converter’s named scale.');
  let n = whole;
  const groups: string[] = [];
  let scale = 0;
  if (n === 0n) groups.push('zero');
  while (n > 0n) {
    const group = Number(n % 1000n);
    if (group) groups.unshift(`${underThousand(group)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`);
    n /= 1000n; scale += 1;
  }
  let words = `${negative ? 'minus ' : ''}${groups.join(' ')}`;
  const currency = options?.currency ?? 'none';
  if (currency !== 'none') {
    const major = currency === 'USD' ? ['dollar','dollars'] : currency === 'EUR' ? ['euro','euros'] : ['pound','pounds'];
    const cents = fractionText ? Math.round(Number(`0.${fractionText}`) * 100) : 0;
    words += ` ${whole === 1n ? major[0] : major[1]}`;
    if (cents) words += ` and ${underThousand(cents)} ${cents === 1 ? 'cent' : 'cents'}`;
  } else if (fractionText) words += ` point ${[...fractionText].map((digit) => SMALL[Number(digit)]).join(' ')}`;
  if (options?.ordinal && currency === 'none' && !fractionText) words = cardinalToOrdinal(words);
  return words;
}
function cardinalToOrdinal(words: string): string {
  const replacements: Record<string,string> = { one:'first',two:'second',three:'third',five:'fifth',eight:'eighth',nine:'ninth',twelve:'twelfth',twenty:'twentieth',thirty:'thirtieth',forty:'fortieth',fifty:'fiftieth',sixty:'sixtieth',seventy:'seventieth',eighty:'eightieth',ninety:'ninetieth',hundred:'hundredth',thousand:'thousandth',million:'millionth',billion:'billionth',trillion:'trillionth',quadrillion:'quadrillionth',quintillion:'quintillionth' };
  const parts = words.split(' ');
  const last = parts.pop() ?? '';
  if (last.includes('-')) {
    const segments = last.split('-');
    const tail = segments.pop()!;
    segments.push(replacements[tail] ?? `${tail}th`);
    parts.push(segments.join('-'));
  } else parts.push(replacements[last] ?? `${last}th`);
  return parts.join(' ');
}

export type HabitEntry = { date: string; status: 'done' | 'partial' | 'missed' | 'skip' };
export function analyzeHabit(entries: HabitEntry[], targetWeekdays: number[] = [0,1,2,3,4,5,6]): { scheduled: number; completedEquivalent: number; adherencePercent: number; currentStreak: number; longestStreak: number; last30Percent: number; byWeekday: Array<{ weekday: number; scheduled: number; completedEquivalent: number; adherencePercent: number }> } {
  const allowed = new Set(targetWeekdays);
  const sorted = [...entries].filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date)).sort((a, b) => a.date.localeCompare(b.date));
  const scheduledEntries = sorted.filter((entry) => allowed.has(new Date(`${entry.date}T12:00:00`).getDay()) && entry.status !== 'skip');
  const score = (status: HabitEntry['status']) => status === 'done' ? 1 : status === 'partial' ? 0.5 : 0;
  const completedEquivalent = scheduledEntries.reduce((sum, entry) => sum + score(entry.status), 0);
  let currentStreak = 0;
  for (let i = scheduledEntries.length - 1; i >= 0; i -= 1) {
    if (score(scheduledEntries[i].status) >= 1) currentStreak += 1; else break;
  }
  let longestStreak = 0; let run = 0;
  for (const entry of scheduledEntries) { if (score(entry.status) >= 1) { run += 1; longestStreak = Math.max(longestStreak, run); } else run = 0; }
  const last30 = scheduledEntries.slice(-30);
  const byWeekday = Array.from({ length: 7 }, (_, weekday) => {
    const rows = scheduledEntries.filter((entry) => new Date(`${entry.date}T12:00:00`).getDay() === weekday);
    const completed = rows.reduce((sum, entry) => sum + score(entry.status), 0);
    return { weekday, scheduled: rows.length, completedEquivalent: completed, adherencePercent: rows.length ? round(completed / rows.length * 100, 2) : 0 };
  });
  return { scheduled: scheduledEntries.length, completedEquivalent: round(completedEquivalent, 2), adherencePercent: scheduledEntries.length ? round(completedEquivalent / scheduledEntries.length * 100, 2) : 0, currentStreak, longestStreak, last30Percent: last30.length ? round(last30.reduce((sum, entry) => sum + score(entry.status), 0) / last30.length * 100, 2) : 0, byWeekday };
}

// ---------------------------
// PWA + currency
// ---------------------------

export type PwaValidation = { manifest: Record<string, unknown>; errors: string[]; warnings: string[] };
export function validatePwaManifest(input: unknown): PwaValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { manifest: {}, errors: ['Manifest must be a JSON object.'], warnings };
  const source = input as Record<string, unknown>;
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  if (!name) errors.push('App name is required.');
  const shortName = typeof source.short_name === 'string' ? source.short_name.trim() : typeof source.shortName === 'string' ? source.shortName.trim() : '';
  if (!shortName) warnings.push('short_name is recommended for compact installation UI.');
  const startUrl = typeof source.start_url === 'string' ? source.start_url : typeof source.startUrl === 'string' ? source.startUrl : '/';
  const scope = typeof source.scope === 'string' ? source.scope : '/';
  const display = typeof source.display === 'string' ? source.display : 'standalone';
  if (!['standalone','fullscreen','minimal-ui','browser'].includes(display)) errors.push('display must be standalone, fullscreen, minimal-ui, or browser.');
  const icons = Array.isArray(source.icons) ? source.icons.filter((icon) => icon && typeof icon === 'object') as Array<Record<string, unknown>> : [];
  if (!icons.length) warnings.push('At least one install icon is recommended.');
  if (!icons.some((icon) => String(icon.sizes ?? '').split(/\s+/).some((size) => size === '192x192' || size === '512x512' || size === 'any'))) warnings.push('Provide a 192×192 or 512×512 install icon when possible.');
  const manifest: Record<string, unknown> = { name, short_name: shortName || name, start_url: startUrl, scope, display };
  for (const [sourceKey, targetKey] of [['description','description'],['theme_color','theme_color'],['background_color','background_color'],['orientation','orientation'],['lang','lang'],['dir','dir'],['id','id']] as const) if (source[sourceKey] != null && source[sourceKey] !== '') manifest[targetKey] = source[sourceKey];
  if (source.themeColor && !manifest.theme_color) manifest.theme_color = source.themeColor;
  if (source.backgroundColor && !manifest.background_color) manifest.background_color = source.backgroundColor;
  if (icons.length) manifest.icons = icons.map((icon) => ({ src: String(icon.src ?? ''), sizes: String(icon.sizes ?? 'any'), ...(icon.type ? { type: String(icon.type) } : {}), ...(icon.purpose ? { purpose: String(icon.purpose) } : {}) })).filter((icon) => icon.src);
  if (Array.isArray(source.shortcuts)) manifest.shortcuts = source.shortcuts;
  if (Array.isArray(source.screenshots)) manifest.screenshots = source.screenshots;
  return { manifest, errors, warnings };
}

export type CurrencyRateTable = { base: string; date: string; fetchedAt: string; provider: string; rates: Record<string, number> };
export function convertCurrency(amount: number, from: string, to: string, table: CurrencyRateTable): number {
  finite(amount, 'Amount');
  const source = from.toUpperCase(); const target = to.toUpperCase(); const base = table.base.toUpperCase();
  if (source === target) return round(amount, 6);
  const rateToBase = source === base ? 1 : table.rates[source];
  const rateFromBase = target === base ? 1 : table.rates[target];
  if (!Number.isFinite(rateToBase) || rateToBase <= 0) throw new Error(`No valid ${source} rate is available.`);
  if (!Number.isFinite(rateFromBase) || rateFromBase <= 0) throw new Error(`No valid ${target} rate is available.`);
  return round((amount / rateToBase) * rateFromBase, 8);
}

export function currencyCrossRate(from: string, to: string, table: CurrencyRateTable): number {
  return convertCurrency(1, from, to, table);
}
