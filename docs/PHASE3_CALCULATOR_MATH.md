# Phase 3 — Calculator & Math Functional Certification

Phase 3 is the first family-level correctness wave. The strengthened Phase 2 health report showed:

- calculator family: **48/48 interactive smoke PASS**
- math family: **24/24 interactive smoke PASS**
- combined scope: **72 routes**

Smoke interaction proves that the pages react; it does not prove numerical correctness. Phase 3 therefore adds deterministic known-input → known-output contracts for every route in these two families.

## Coverage

### Calculator family — 48 routes

- all 46 `PUBLIC_CALCULATOR_TASKS` definitions
- `screen-ppi-calculator`
- `download-time-calculator`

The currency converter is explicitly classified as external-data rather than pretending a live FX quote is deterministic.

### Math family — 24 routes

- Percentage Calculator
- Unit Converter
- Discount/VAT Calculator
- all 8 P11 math routes
- all 13 P15 math/statistics/data routes

The test fails if the registry contains a calculator/math route without a contract.

## Additional engine coverage

- every declared unit round-trips through its base transform;
- temperature below absolute zero is rejected;
- percentage division-by-zero behavior is explicit;
- statistical, matrix, regression, probability, graphing, combinatorics, complex-number and vector engines receive independent known-answer checks.

## Repaired defects

### Decimal ratio simplification

Before: `1.5 : 2.5` could remain `1.5 : 2.5` because the GCD helper rounded each side before simplification.

After: ordinary finite decimal ratios are integerized to bounded decimal precision before the GCD step, so the result is `3 : 5`.

### ROI accepted negative initial investment

Before: the ROI calculator called `abs(initial)` for the denominator while calculating profit from the original negative value, producing nonsensical results.

After: initial investment must be strictly positive and the input metadata declares `min: 0`.

### Pace could render 60 seconds

Before: independent minute/second rounding could produce values such as `4:60 min/km`.

After: pace is rounded once to total seconds and then decomposed into minutes + seconds, producing `5:00 min/km`.

## Commands

```bash
npm run test:phase3
npm test
npm run typecheck
```

## Acceptance gate

Phase 3 is complete when:

- all 48 calculator routes have deterministic coverage;
- all 24 math routes have deterministic coverage;
- all 72 contracts pass;
- repaired regression cases pass;
- full unit regression passes;
- typecheck passes;
- the existing 351-tool runtime/browser gates show no regression.
