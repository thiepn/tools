import { describe, expect, it } from 'vitest';
import { PUBLIC_CALCULATOR_TASKS } from '../calculators/publicCalculatorTasks';
import { CALCULATOR_DEFINITIONS, createDefaultCalculatorValues, getCalculatorDefinition } from '../calculators/calculatorDefinitions';
import {
  bmi,
  creditCardPayoff,
  evaluateMathExpression,
  futureValueWithMonthlyContribution,
  mifflinStJeor,
  monthlyLoanPayment,
  navyBodyFatPercent,
  oneRepMax,
  simplifyFraction,
} from '../utilities/everyday-calculators-core';
import {
  salaryEquivalentsFromAnnual,
  salaryEquivalentsFromHourly,
} from '../utilities/salary-converter';
import { CATEGORIES, TOOLS_REGISTRY } from '../registry/tools';
import { registerPdfPublicTools } from '../registry/pdf-extension';
import { registerDeviceDiagnosticTools } from '../registry/device-extension';
import { registerCalculatorTools } from '../registry/calculator-extension';

registerPdfPublicTools();
registerDeviceDiagnosticTools();
registerCalculatorTools();

describe('P3 public calculator catalog', () => {
  it('contains exactly 46 unique calculator routes', () => {
    expect(PUBLIC_CALCULATOR_TASKS).toHaveLength(46);
    expect(new Set(PUBLIC_CALCULATOR_TASKS.map((task) => task.id)).size).toBe(46);
    expect(TOOLS_REGISTRY.filter((tool) => tool.category === 'calculator')).toHaveLength(46);
    expect(CATEGORIES.some((category) => category.id === 'calculator')).toBe(true);
  });

  it('has a calculation definition for every public route', () => {
    expect(CALCULATOR_DEFINITIONS).toHaveLength(46);
    for (const task of PUBLIC_CALCULATOR_TASKS) expect(getCalculatorDefinition(task.id)).toBeDefined();
  });

  it('all formula-based default scenarios calculate without errors', () => {
    for (const definition of CALCULATOR_DEFINITIONS) {
      if (definition.externalData) continue;
      const results = definition.calculate(createDefaultCalculatorValues(definition));
      expect(results.length, definition.id).toBeGreaterThan(0);
      expect(results.every((item) => item.label && item.value), definition.id).toBe(true);
    }
  });

  it('keeps higher-stakes reproductive and country-specific tax calculators out of the timeless formula catalog', () => {
    const ids = new Set(PUBLIC_CALCULATOR_TASKS.map((task) => task.id));
    expect(ids.has('pregnancy-calculator')).toBe(false);
    expect(ids.has('ovulation-calculator')).toBe(false);
    expect(ids.has('income-tax-calculator')).toBe(false);
  });

  it('marks currency conversion as the only external-data calculator', () => {
    const external = CALCULATOR_DEFINITIONS.filter((definition) => definition.externalData);
    expect(external.map((definition) => definition.id)).toEqual(['currency-converter']);
  });

  it('describes salary conversion as bidirectional in public registry discovery', () => {
    const tool = TOOLS_REGISTRY.find((candidate) => candidate.id === 'salary-hourly-calculator');
    expect(tool?.description).toContain('either direction');
    expect(tool?.keywords).toContain('hourly wage to salary');
  });
});

describe('P3 calculator core correctness', () => {
  it('evaluates arithmetic and scientific expressions without eval semantics', () => {
    expect(evaluateMathExpression('(12 + 8) * 3')).toBe(60);
    expect(evaluateMathExpression('sqrt(144) + sin(pi / 2)')).toBeCloseTo(13, 10);
    expect(() => evaluateMathExpression('globalThis.process')).toThrow();
    expect(() => evaluateMathExpression('1 / 0')).toThrow('Division by zero');
  });

  it('reduces fractions with normalized denominator signs', () => {
    expect(simplifyFraction(8, 12)).toEqual({ numerator: 2, denominator: 3 });
    expect(simplifyFraction(8, -12)).toEqual({ numerator: -2, denominator: 3 });
    expect(() => simplifyFraction(1, 0)).toThrow();
  });

  it('calculates standard amortizing loan payments', () => {
    expect(monthlyLoanPayment(20000, 5, 5)).toBeCloseTo(377.42, 1);
    expect(monthlyLoanPayment(12000, 0, 1)).toBeCloseTo(1000, 8);
  });

  it('projects compounded savings with monthly contributions', () => {
    const value = futureValueWithMonthlyContribution(10000, 6, 10, 250);
    expect(value).toBeGreaterThan(50000);
    expect(value).toBeLessThan(70000);
  });

  it('detects non-amortizing credit-card payments', () => {
    expect(creditCardPayoff(5000, 24, 50).possible).toBe(false);
    const payoff = creditCardPayoff(5000, 19.9, 200);
    expect(payoff.possible).toBe(true);
    expect(payoff.months).toBeGreaterThan(20);
    expect(payoff.interest).toBeGreaterThan(0);
  });

  it('converts annual salary and hourly wage in both directions consistently', () => {
    const annual = salaryEquivalentsFromAnnual(52000, 40, 52);
    expect(annual.hourly).toBeCloseTo(25, 8);
    expect(annual.monthly).toBeCloseTo(4333.3333, 3);

    const hourly = salaryEquivalentsFromHourly(25, 40, 52);
    expect(hourly.annual).toBeCloseTo(52000, 8);
    expect(hourly.weekly).toBeCloseTo(1000, 8);
    expect(hourly.hourly).toBeCloseTo(25, 8);
  });

  it('rejects impossible work schedules in salary conversion', () => {
    expect(() => salaryEquivalentsFromAnnual(50000, 0, 52)).toThrow('Hours per week');
    expect(() => salaryEquivalentsFromHourly(25, 40, 0)).toThrow('Paid weeks per year');
  });

  it('implements common fitness estimate equations deterministically', () => {
    expect(bmi(75, 180)).toBeCloseTo(23.148, 3);
    expect(mifflinStJeor(75, 180, 30, 'male')).toBeCloseTo(1730, 8);
    expect(navyBodyFatPercent('male', 180, 85, 38)).toBeGreaterThan(5);
    const max = oneRepMax(80, 8);
    expect(max.epley).toBeCloseTo(101.33, 1);
    expect(max.brzycki).toBeGreaterThan(95);
  });
});
