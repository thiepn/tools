import { describe, expect, it } from 'vitest';
import {
  CALCULATOR_DEFINITIONS,
  getCalculatorDefinition,
  type CalculatorResult,
} from '../calculators/calculatorDefinitions';
import { PUBLIC_CALCULATOR_TASKS } from '../calculators/publicCalculatorTasks';
import { registerAllPublicTools } from '../registry/register-all';
import { TOOLS_REGISTRY } from '../registry/tools';
import {
  calculatePercentOf,
  calculateWhatPercent,
} from '../utilities/percentage-calculator';
import {
  UNIT_CATEGORIES,
  convertUnits,
  validateUnitValue,
} from '../utilities/unit-converter';
import { calculateDiscount } from '../utilities/discount-vat';
import {
  complexOp,
  gcdBig,
  linearRegression,
  matrixDeterminant,
  nCr,
  normalStats,
  parseComplex,
  parseMatrix,
  solveQuadratic,
  vectorDot,
} from '../utilities/p11-math';
import {
  binomialPmf,
  chiSquareGoodness,
  csvNumericSeries,
  descriptiveStats,
  findPolynomialRealRoots,
  histogram,
  meanConfidenceInterval,
  oneSampleTTest,
  parseCoefficients,
  poissonPmf,
  sampleFunction,
  sampleSizeForProportion,
  scatterStats,
  solveLinearSystem,
} from '../utilities/p15-math-data';
import {
  calculateScreenDensity,
  estimateTransferTime,
} from '../utilities/p20-final-tools';

registerAllPublicTools();

type CalculatorFixture = {
  inputs?: Record<string, string>;
  label?: string;
  expectedNumber?: number;
  expectedText?: string;
  tolerance?: number;
  external?: true;
};

const CALCULATOR_FIXTURES: Record<string, CalculatorFixture> = {
  'basic-calculator': { inputs: { expression: '2 + 3 * 4' }, label: 'Result', expectedNumber: 14 },
  'scientific-calculator': { inputs: { expression: 'sqrt(81) + cos(0)' }, label: 'Result', expectedNumber: 10 },
  'fraction-calculator': { inputs: { n1: '1', d1: '2', operator: '+', n2: '1', d2: '4' }, label: 'Reduced fraction', expectedText: '3/4' },
  'average-calculator': { inputs: { values: '2, 4, 6' }, label: 'Average', expectedNumber: 4 },
  'ratio-calculator': { inputs: { a: '2', b: '3', c: '4' }, label: 'X in A:B = C:X', expectedNumber: 6 },
  'grade-calculator': { inputs: { earned: '8', possible: '10' }, label: 'Grade', expectedNumber: 80 },
  'final-grade-calculator': { inputs: { current: '80', finalWeight: '20', target: '84' }, label: 'Final exam score needed', expectedNumber: 100 },
  'gpa-calculator': { inputs: { points: '4, 3', credits: '1, 1' }, label: 'Weighted GPA', expectedNumber: 3.5 },
  'weighted-average-calculator': { inputs: { values: '10, 20', weights: '1, 3' }, label: 'Weighted average', expectedNumber: 17.5 },
  'statistics-calculator': { inputs: { values: '1, 2, 3' }, label: 'Mean', expectedNumber: 2 },
  'triangle-calculator': { inputs: { a: '3', b: '4', c: '5' }, label: 'Area', expectedNumber: 6 },
  'circle-calculator': { inputs: { radius: '2' }, label: 'Diameter', expectedNumber: 4 },
  'probability-calculator': { inputs: { a: '50', b: '20', mode: 'and' }, label: 'Combined probability', expectedNumber: 10 },
  'tip-calculator': { inputs: { bill: '100', tip: '20', people: '4' }, label: 'Per person', expectedNumber: 30 },
  'bill-splitter': { inputs: { bill: '100', tip: '10', people: '2' }, label: 'Per person', expectedNumber: 55 },
  'currency-converter': { external: true },
  'loan-calculator': { inputs: { principal: '120', rate: '0', years: '1' }, label: 'Monthly payment', expectedNumber: 10 },
  'mortgage-calculator': { inputs: { price: '120', down: '20', rate: '0', years: '1', tax: '0', insurance: '0', hoa: '0' }, label: 'Principal financed', expectedNumber: 100 },
  'amortization-calculator': { inputs: { principal: '120', rate: '0', years: '1' }, label: 'Monthly payment', expectedNumber: 10 },
  'compound-interest-calculator': { inputs: { principal: '100', rate: '0', years: '1', monthly: '10' }, label: 'Projected balance', expectedNumber: 220 },
  'savings-goal-calculator': { inputs: { goal: '120', current: '0', rate: '0', years: '1' }, label: 'Monthly contribution needed', expectedNumber: 10 },
  'simple-interest-calculator': { inputs: { principal: '100', rate: '10', years: '2' }, label: 'Interest', expectedNumber: 20 },
  'roi-calculator': { inputs: { initial: '100', final: '125' }, label: 'ROI', expectedNumber: 25 },
  'retirement-calculator': { inputs: { current: '100', monthly: '10', rate: '0', years: '1' }, label: 'Projected balance', expectedNumber: 220 },
  'credit-card-payoff-calculator': { inputs: { balance: '100', rate: '0', payment: '10' }, label: 'Estimated payoff time', expectedNumber: 10 },
  'salary-hourly-calculator': { inputs: { salary: '520', hours: '10', weeks: '52' }, label: 'Hourly equivalent', expectedNumber: 1 },
  'car-loan-calculator': { inputs: { price: '120', down: '0', trade: '0', tax: '0', rate: '0', years: '1' }, label: 'Monthly payment', expectedNumber: 10 },
  'rent-vs-buy-calculator': { inputs: { rent: '0', price: '100', down: '100', rate: '0', years: '1', rentGrowth: '0', appreciation: '0', propertyTax: '0', maintenance: '0', sellingCost: '0' }, label: 'Difference', expectedNumber: 0 },
  'inflation-calculator': { inputs: { amount: '100', inflation: '10', years: '1' }, label: 'Future price for same basket', expectedNumber: 110 },
  'debt-to-income-calculator': { inputs: { debt: '25', income: '100' }, label: 'Debt-to-income ratio', expectedNumber: 25 },
  'fuel-trip-cost-calculator': { inputs: { distance: '100', consumption: '10', price: '2' }, label: 'Fuel needed', expectedNumber: 10 },
  'fuel-economy-calculator': { inputs: { distance: '100', fuel: '10' }, label: 'Consumption', expectedNumber: 10 },
  'electricity-cost-calculator': { inputs: { watts: '1000', hours: '1', price: '0.5', days: '2' }, label: 'Energy use', expectedNumber: 2 },
  'appliance-cost-calculator': { inputs: { activeWatts: '100', activeHours: '24', standbyWatts: '0', price: '1' }, label: 'Annual energy', expectedNumber: 876 },
  'room-area-calculator': { inputs: { length: '5', width: '4' }, label: 'Floor area', expectedNumber: 20 },
  'paint-calculator': { inputs: { width: '4', height: '2.5', walls: '4', openings: '0', coats: '2', coverage: '10', waste: '0' }, label: 'Paint needed', expectedNumber: 8 },
  'flooring-calculator': { inputs: { length: '5', width: '4', waste: '10', boxCoverage: '2.2' }, label: 'Boxes needed', expectedNumber: 10 },
  'tile-calculator': { inputs: { area: '1', tileWidth: '50', tileHeight: '50', waste: '0' }, label: 'Tiles needed', expectedNumber: 4 },
  'box-volume-calculator': { inputs: { length: '100', width: '100', height: '100' }, label: 'Volume', expectedNumber: 1 },
  'concrete-calculator': { inputs: { length: '2', width: '3', depth: '10', waste: '0' }, label: 'Base concrete volume', expectedNumber: 0.6 },
  'bmi-calculator': { inputs: { weight: '81', height: '180' }, label: 'BMI', expectedNumber: 25 },
  'bmr-calculator': { inputs: { sex: 'male', age: '60', weight: '30', height: '120' }, label: 'Estimated BMR', expectedNumber: 755 },
  'tdee-calculator': { inputs: { sex: 'male', age: '60', weight: '30', height: '120', activity: '1.2' }, label: 'Estimated TDEE', expectedNumber: 906 },
  'running-pace-calculator': { inputs: { distance: '10', minutes: '50' }, label: 'Pace', expectedText: '5:00 min/km' },
  'body-fat-calculator': { inputs: { sex: 'male', height: '180', waist: '85', neck: '38', hip: '95' }, label: 'Estimated body fat', expectedNumber: 16.15, tolerance: 0.01 },
  'one-rep-max-calculator': { inputs: { weight: '100', reps: '1' }, label: 'Blended estimate', expectedNumber: 101.7, tolerance: 0.05 },
};

function byLabel(results: CalculatorResult[], label: string): CalculatorResult {
  const row = results.find((item) => item.label === label);
  if (!row) throw new Error(`Missing result label: ${label}`);
  return row;
}

function firstNumber(value: string): number {
  const normalized = value.replace(/\u00a0/g, ' ');
  const match = normalized.match(/[-+]?\d+(?:[.,]\d+)?/);
  if (!match) throw new Error(`No numeric value in: ${value}`);
  return Number(match[0].replace(',', '.'));
}

const MATH_CONTRACTS: Record<string, () => void> = {
  'percentage-calculator': () => {
    expect(calculatePercentOf(25, 200).result).toBe(50);
    expect(calculateWhatPercent(1, 0).result).toBeNull();
  },
  'unit-converter': () => {
    expect(convertUnits('temperature', 'c', 'f', 0)?.result).toBeCloseTo(32, 10);
    expect(validateUnitValue('temperature', 'c', -274).valid).toBe(false);
  },
  'discount-vat-calculator': () => {
    expect(calculateDiscount(100, 20, 10).finalPrice).toBe(72);
  },
  'matrix-calculator': () => {
    expect(matrixDeterminant(parseMatrix('1 2\n3 4'))).toBeCloseTo(-2, 10);
  },
  'combinations-permutations-calculator': () => {
    expect(nCr(5, 2)).toBe(10n);
  },
  'normal-distribution-calculator': () => {
    expect(normalStats(0, 0, 1).cdf).toBeCloseTo(0.5, 5);
  },
  'linear-regression-calculator': () => {
    expect(linearRegression([1, 2, 3], [2, 4, 6]).slope).toBeCloseTo(2, 10);
  },
  'gcd-lcm-prime-factorization': () => {
    expect(gcdBig(18n, 24n)).toBe(6n);
  },
  'complex-number-calculator': () => {
    expect(complexOp(parseComplex('1+2i'), parseComplex('3-4i'), 'add')).toEqual({ re: 4, im: -2 });
  },
  'quadratic-solver': () => {
    const roots = solveQuadratic(1, -3, 2).roots as number[];
    expect([...roots].sort((a, b) => a - b)).toEqual([1, 2]);
  },
  'vector-calculator': () => {
    expect(vectorDot([1, 2, 3], [4, 5, 6])).toBe(32);
  },
  'function-graph-plotter': () => {
    expect(sampleFunction('x^2', 2, 3, 25)[0].y).toBeCloseTo(4, 10);
  },
  'polynomial-graph-explorer': () => {
    const roots = findPolynomialRealRoots(parseCoefficients('1 0 -4'), -5, 5);
    expect(roots).toHaveLength(2);
    expect(roots[0]).toBeCloseTo(-2, 5);
    expect(roots[1]).toBeCloseTo(2, 5);
  },
  'linear-system-solver': () => {
    const solved = solveLinearSystem([[2, 1, 5], [1, -1, 1]]);
    expect(solved.kind).toBe('unique');
    expect(solved.solution?.[0]).toBeCloseTo(2, 10);
    expect(solved.solution?.[1]).toBeCloseTo(1, 10);
  },
  'binomial-distribution-calculator': () => {
    expect(binomialPmf(4, 2, 0.5)).toBeCloseTo(0.375, 10);
  },
  'poisson-distribution-calculator': () => {
    expect(poissonPmf(2, 0)).toBeCloseTo(Math.exp(-2), 10);
  },
  'confidence-interval-calculator': () => {
    const ci = meanConfidenceInterval([1, 2, 3, 4, 5], 0.95);
    expect(ci.mean).toBe(3);
    expect(ci.lower).toBeLessThan(3);
    expect(ci.upper).toBeGreaterThan(3);
  },
  'sample-size-calculator': () => {
    expect(sampleSizeForProportion(0.95, 0.05, 0.5).required).toBe(385);
  },
  't-test-calculator': () => {
    expect(oneSampleTTest([1, 2, 3], 0).t).toBeCloseTo(3.464101615, 8);
  },
  'chi-square-test-calculator': () => {
    expect(chiSquareGoodness([10, 20, 30], [20, 20, 20]).statistic).toBeCloseTo(10, 10);
  },
  'descriptive-statistics-box-plot': () => {
    expect(descriptiveStats([1, 2, 3, 4, 5])).toMatchObject({ mean: 3, median: 3, q1: 2, q3: 4 });
  },
  'histogram-generator': () => {
    const result = histogram([1, 1, 2, 2, 3, 3], 3);
    expect(result.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(6);
  },
  'scatter-plot-generator': () => {
    expect(scatterStats([1, 2, 3], [2, 4, 6]).slope).toBeCloseTo(2, 10);
  },
  'csv-data-plotter': () => {
    expect(csvNumericSeries('x,y\n1,2\n2,4\n3,6', 'x', 'y').points).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ]);
  },
};

describe('Phase 3 calculator/math route coverage', () => {
  it('has deterministic contracts for all 48 calculator and all 24 math routes', () => {
    const calculatorIds = TOOLS_REGISTRY.filter((tool) => tool.category === 'calculator').map((tool) => tool.id).sort();
    const mathIds = TOOLS_REGISTRY.filter((tool) => tool.category === 'math').map((tool) => tool.id).sort();
    const expectedCalculatorIds = [...Object.keys(CALCULATOR_FIXTURES), 'screen-ppi-calculator', 'download-time-calculator'].sort();

    expect(calculatorIds).toHaveLength(48);
    expect(mathIds).toHaveLength(24);
    expect(expectedCalculatorIds).toEqual(calculatorIds);
    expect(Object.keys(MATH_CONTRACTS).sort()).toEqual(mathIds);
    expect(new Set([...calculatorIds, ...mathIds]).size).toBe(72);
  });

  it('keeps the 46 formula/external calculator definitions in one-to-one correspondence with public P3 routes', () => {
    expect(CALCULATOR_DEFINITIONS).toHaveLength(46);
    expect(Object.keys(CALCULATOR_FIXTURES).sort()).toEqual(PUBLIC_CALCULATOR_TASKS.map((task) => task.id).sort());
  });
});

describe('Phase 3 deterministic P3 calculator contracts', () => {
  for (const [id, fixture] of Object.entries(CALCULATOR_FIXTURES)) {
    it(id, () => {
      const definition = getCalculatorDefinition(id);
      expect(definition).toBeDefined();

      if (fixture.external) {
        expect(definition?.externalData).toBe('currency');
        return;
      }

      const results = definition!.calculate(fixture.inputs ?? {});
      const row = byLabel(results, fixture.label!);

      if (fixture.expectedText !== undefined) {
        expect(row.value).toBe(fixture.expectedText);
      } else {
        expect(firstNumber(row.value)).toBeCloseTo(
          fixture.expectedNumber!,
          fixture.tolerance !== undefined ? Math.max(0, Math.ceil(-Math.log10(fixture.tolerance))) : 6
        );
      }
    });
  }
});

describe('Phase 3 deterministic extra calculator contracts', () => {
  it('screen-ppi-calculator', () => {
    const result = calculateScreenDensity(1920, 1080, 24);
    expect(result.ppi).toBeCloseTo(91.79, 2);
    expect(result.aspectWidth).toBe(16);
    expect(result.aspectHeight).toBe(9);
  });

  it('download-time-calculator', () => {
    const result = estimateTransferTime(1, 'GB', 1, 'Gbps');
    expect(result.seconds).toBeCloseTo(8, 10);
    expect(result.bytes).toBe(1_000_000_000);
    expect(result.bitsPerSecond).toBe(1_000_000_000);
  });
});

describe('Phase 3 deterministic math-route contracts', () => {
  for (const [id, contract] of Object.entries(MATH_CONTRACTS)) {
    it(id, contract);
  }

  it('round-trips every declared unit through its category base transform', () => {
    for (const category of UNIT_CATEGORIES) {
      for (const unit of category.units) {
        const sample = category.id === 'temperature' ? 20 : 12.345;
        expect(unit.fromBase(unit.toBase(sample)), `${category.id}:${unit.id}`).toBeCloseTo(sample, 8);
      }
    }
  });
});

describe('Phase 3 repaired calculator regressions', () => {
  it('reduces decimal ratios exactly enough for ordinary calculator input', () => {
    const definition = getCalculatorDefinition('ratio-calculator')!;
    const result = byLabel(definition.calculate({ a: '1.5', b: '2.5', c: '3' }), 'Simplified ratio');
    expect(result.value).toBe('3 : 5');
  });

  it('rejects a negative initial investment instead of silently taking its absolute value', () => {
    const definition = getCalculatorDefinition('roi-calculator')!;
    expect(() => definition.calculate({ initial: '-100', final: '125' })).toThrow('Initial investment must be greater than zero');
  });

  it('normalizes pace rounding so seconds never render as 60', () => {
    const definition = getCalculatorDefinition('running-pace-calculator')!;
    const result = byLabel(definition.calculate({ distance: '3', minutes: '14.999' }), 'Pace');
    expect(result.value).toBe('5:00 min/km');
  });
});
