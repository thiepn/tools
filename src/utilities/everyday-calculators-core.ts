export function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function positiveNumber(value: unknown, fallback = 0): number {
  return Math.max(0, finiteNumber(value, fallback));
}

export function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

export function formatMoney(value: number, currency = '€'): string {
  if (!Number.isFinite(value)) return '—';
  return `${currency}${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) [x, y] = [y, x % y];
  return x || 1;
}

export function simplifyFraction(numerator: number, denominator: number): { numerator: number; denominator: number } {
  if (denominator === 0) throw new Error('Denominator cannot be zero.');
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return { numerator: sign * numerator / divisor, denominator: Math.abs(denominator) / divisor };
}

export function parseNumberList(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map((part) => Number(part.trim().replace(',', '.')))
    .filter(Number.isFinite);
}

class ExpressionParser {
  private index = 0;
  constructor(private readonly source: string) {}

  parse(): number {
    const value = this.parseExpression();
    this.skipWhitespace();
    if (this.index !== this.source.length) throw new Error(`Unexpected token near “${this.source.slice(this.index, this.index + 8)}”.`);
    if (!Number.isFinite(value)) throw new Error('Result is not finite.');
    return value;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.source[this.index] ?? '')) this.index += 1;
  }

  private consume(char: string): boolean {
    this.skipWhitespace();
    if (this.source[this.index] === char) { this.index += 1; return true; }
    return false;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (true) {
      if (this.consume('+')) value += this.parseTerm();
      else if (this.consume('-')) value -= this.parseTerm();
      else return value;
    }
  }

  private parseTerm(): number {
    let value = this.parsePower();
    while (true) {
      if (this.consume('*')) value *= this.parsePower();
      else if (this.consume('/')) {
        const divisor = this.parsePower();
        if (divisor === 0) throw new Error('Division by zero.');
        value /= divisor;
      } else if (this.consume('%')) {
        const divisor = this.parsePower();
        if (divisor === 0) throw new Error('Modulo by zero.');
        value %= divisor;
      } else return value;
    }
  }

  private parsePower(): number {
    const base = this.parseUnary();
    return this.consume('^') ? base ** this.parsePower() : base;
  }

  private parseUnary(): number {
    if (this.consume('+')) return this.parseUnary();
    if (this.consume('-')) return -this.parseUnary();
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipWhitespace();
    if (this.consume('(')) {
      const value = this.parseExpression();
      if (!this.consume(')')) throw new Error('Missing closing parenthesis.');
      return value;
    }

    const numberMatch = this.source.slice(this.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    if (numberMatch) {
      this.index += numberMatch[0].length;
      return Number(numberMatch[0]);
    }

    const identifierMatch = this.source.slice(this.index).match(/^[A-Za-z]+/);
    if (!identifierMatch) throw new Error('Expected a number, constant, function, or parenthesis.');
    const id = identifierMatch[0].toLowerCase();
    this.index += identifierMatch[0].length;
    if (id === 'pi') return Math.PI;
    if (id === 'e') return Math.E;
    if (!this.consume('(')) throw new Error(`Function ${id} requires parentheses.`);
    const argument = this.parseExpression();
    if (!this.consume(')')) throw new Error(`Missing closing parenthesis for ${id}.`);
    const functions: Record<string, (value: number) => number> = {
      sqrt: Math.sqrt,
      abs: Math.abs,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      ln: Math.log,
      log: Math.log10,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
    };
    const fn = functions[id];
    if (!fn) throw new Error(`Unsupported function: ${id}.`);
    return fn(argument);
  }
}

export function evaluateMathExpression(source: string): number {
  const clean = source.trim();
  if (!clean) throw new Error('Enter an expression.');
  if (clean.length > 500) throw new Error('Expression is too long.');
  return new ExpressionParser(clean).parse();
}

export function monthlyLoanPayment(principal: number, annualRatePercent: number, years: number): number {
  const p = Math.max(0, principal);
  const months = Math.max(1, Math.round(years * 12));
  const rate = annualRatePercent / 100 / 12;
  if (rate === 0) return p / months;
  return p * rate / (1 - (1 + rate) ** -months);
}

export function futureValueWithMonthlyContribution(principal: number, annualRatePercent: number, years: number, monthlyContribution: number): number {
  const months = Math.max(0, Math.round(years * 12));
  const rate = annualRatePercent / 100 / 12;
  if (months === 0) return principal;
  if (rate === 0) return principal + monthlyContribution * months;
  return principal * (1 + rate) ** months + monthlyContribution * (((1 + rate) ** months - 1) / rate);
}

export function monthlyContributionForGoal(goal: number, current: number, annualRatePercent: number, years: number): number {
  const months = Math.max(1, Math.round(years * 12));
  const rate = annualRatePercent / 100 / 12;
  const futureCurrent = rate === 0 ? current : current * (1 + rate) ** months;
  const remaining = Math.max(0, goal - futureCurrent);
  if (rate === 0) return remaining / months;
  return remaining * rate / ((1 + rate) ** months - 1);
}

export function creditCardPayoff(balance: number, annualRatePercent: number, monthlyPayment: number): { months: number; interest: number; possible: boolean } {
  let remaining = Math.max(0, balance);
  const rate = Math.max(0, annualRatePercent) / 100 / 12;
  const payment = Math.max(0, monthlyPayment);
  if (remaining === 0) return { months: 0, interest: 0, possible: true };
  if (payment <= remaining * rate) return { months: Infinity, interest: Infinity, possible: false };
  let interest = 0;
  let months = 0;
  while (remaining > 0.005 && months < 1200) {
    const monthlyInterest = remaining * rate;
    interest += monthlyInterest;
    remaining = Math.max(0, remaining + monthlyInterest - payment);
    months += 1;
  }
  return { months, interest, possible: remaining <= 0.005 };
}

export function bmi(weightKg: number, heightCm: number): number {
  const meters = heightCm / 100;
  return meters > 0 ? weightKg / (meters * meters) : NaN;
}

export function mifflinStJeor(weightKg: number, heightCm: number, ageYears: number, sex: 'male' | 'female'): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === 'male' ? 5 : -161);
}

export function navyBodyFatPercent(sex: 'male' | 'female', heightCm: number, waistCm: number, neckCm: number, hipCm = 0): number {
  const inch = (cm: number) => cm / 2.54;
  const h = inch(heightCm);
  const waist = inch(waistCm);
  const neck = inch(neckCm);
  const hip = inch(hipCm);
  const value = sex === 'male'
    ? 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(h) + 36.76
    : 163.205 * Math.log10(waist + hip - neck) - 97.684 * Math.log10(h) - 78.387;
  return Number.isFinite(value) ? Math.max(0, Math.min(75, value)) : NaN;
}

export function oneRepMax(weight: number, reps: number): { epley: number; brzycki: number; average: number } {
  const r = Math.max(1, Math.min(36, reps));
  const epley = weight * (1 + r / 30);
  const brzycki = weight * (36 / (37 - r));
  return { epley, brzycki, average: (epley + brzycki) / 2 };
}
