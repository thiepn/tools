export type FitnessSex = 'male' | 'female';
export type FitnessUnitSystem = 'metric' | 'imperial';

export interface BodyMeasurementsMetric {
  weightKg: number;
  heightCm: number;
}

export interface BmiAssessment {
  bmi: number;
  category: 'Underweight' | 'Healthy range' | 'Overweight' | 'Obesity';
  healthyWeightMinKg: number;
  healthyWeightMaxKg: number;
  distanceToHealthyRangeKg: number;
}

export interface BmrEstimate {
  mifflinStJeor: number;
  revisedHarrisBenedict: number;
  katchMcArdle: number | null;
  consensus: number;
  spread: number;
  methodsUsed: number;
}

export interface TdeeEstimate {
  maintenance: number;
  weeklyMaintenance: number;
  uncertaintyLow: number;
  uncertaintyHigh: number;
  planningScenarios: {
    minus10Percent: number;
    maintenance: number;
    plus10Percent: number;
  };
}

export interface BodyFatEstimate {
  bodyFatPercent: number;
  fatMassKg: number | null;
  leanMassKg: number | null;
  waistToHeightRatio: number;
}

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

function requireFinitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be greater than zero.`);
  return value;
}

function requireAge(age: number): number {
  if (!Number.isFinite(age) || age < 14 || age > 120) throw new Error('Age must be between 14 and 120 years for these adult-oriented estimates.');
  return age;
}

export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}

export function kgToLb(kg: number): number {
  return kg / 0.45359237;
}

export function inchesToCm(inches: number): number {
  return inches * 2.54;
}

export function cmToInches(cm: number): number {
  return cm / 2.54;
}

export function feetAndInchesToCm(feet: number, inches: number): number {
  if (!Number.isFinite(feet) || !Number.isFinite(inches) || feet < 0 || inches < 0) throw new Error('Height values cannot be negative.');
  return inchesToCm(feet * 12 + inches);
}

export function bmiAssessment(weightKg: number, heightCm: number): BmiAssessment {
  const weight = requireFinitePositive(weightKg, 'Weight');
  const height = requireFinitePositive(heightCm, 'Height');
  const meters = height / 100;
  const bmi = weight / (meters * meters);
  const category = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy range' : bmi < 30 ? 'Overweight' : 'Obesity';
  const healthyWeightMinKg = 18.5 * meters * meters;
  const healthyWeightMaxKg = 24.9 * meters * meters;
  const distanceToHealthyRangeKg = weight < healthyWeightMinKg
    ? healthyWeightMinKg - weight
    : weight > healthyWeightMaxKg
      ? weight - healthyWeightMaxKg
      : 0;
  return {
    bmi: round(bmi, 2),
    category,
    healthyWeightMinKg: round(healthyWeightMinKg, 2),
    healthyWeightMaxKg: round(healthyWeightMaxKg, 2),
    distanceToHealthyRangeKg: round(distanceToHealthyRangeKg, 2),
  };
}

export function mifflinStJeor(weightKg: number, heightCm: number, age: number, sex: FitnessSex): number {
  const weight = requireFinitePositive(weightKg, 'Weight');
  const height = requireFinitePositive(heightCm, 'Height');
  const years = requireAge(age);
  return 10 * weight + 6.25 * height - 5 * years + (sex === 'male' ? 5 : -161);
}

export function revisedHarrisBenedict(weightKg: number, heightCm: number, age: number, sex: FitnessSex): number {
  const weight = requireFinitePositive(weightKg, 'Weight');
  const height = requireFinitePositive(heightCm, 'Height');
  const years = requireAge(age);
  return sex === 'male'
    ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * years
    : 447.593 + 9.247 * weight + 3.098 * height - 4.33 * years;
}

export function katchMcArdle(weightKg: number, bodyFatPercent: number): number {
  const weight = requireFinitePositive(weightKg, 'Weight');
  if (!Number.isFinite(bodyFatPercent) || bodyFatPercent <= 0 || bodyFatPercent >= 75) {
    throw new Error('Body-fat percentage must be greater than 0 and below 75%.');
  }
  const leanMassKg = weight * (1 - bodyFatPercent / 100);
  return 370 + 21.6 * leanMassKg;
}

export function estimateBmr(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: FitnessSex,
  bodyFatPercent?: number | null,
): BmrEstimate {
  const mifflin = mifflinStJeor(weightKg, heightCm, age, sex);
  const harris = revisedHarrisBenedict(weightKg, heightCm, age, sex);
  let katch: number | null = null;
  if (bodyFatPercent != null && Number.isFinite(bodyFatPercent) && bodyFatPercent > 0) {
    katch = katchMcArdle(weightKg, bodyFatPercent);
  }
  const methods = [mifflin, harris, ...(katch == null ? [] : [katch])];
  const consensus = methods.reduce((sum, value) => sum + value, 0) / methods.length;
  return {
    mifflinStJeor: round(mifflin, 1),
    revisedHarrisBenedict: round(harris, 1),
    katchMcArdle: katch == null ? null : round(katch, 1),
    consensus: round(consensus, 1),
    spread: round(Math.max(...methods) - Math.min(...methods), 1),
    methodsUsed: methods.length,
  };
}

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Sedentary', detail: 'Little structured exercise' },
  { value: 1.375, label: 'Lightly active', detail: 'Light exercise around 1–3 days/week' },
  { value: 1.55, label: 'Moderately active', detail: 'Moderate exercise around 3–5 days/week' },
  { value: 1.725, label: 'Very active', detail: 'Hard exercise around 6–7 days/week' },
  { value: 1.9, label: 'Extra active', detail: 'Very hard training and/or a physical job' },
] as const;

export function estimateTdee(bmr: number, activityFactor: number): TdeeEstimate {
  const base = requireFinitePositive(bmr, 'BMR');
  if (!Number.isFinite(activityFactor) || activityFactor < 1.1 || activityFactor > 2.2) {
    throw new Error('Activity multiplier must be between 1.1 and 2.2.');
  }
  const maintenance = base * activityFactor;
  return {
    maintenance: round(maintenance, 0),
    weeklyMaintenance: round(maintenance * 7, 0),
    uncertaintyLow: round(maintenance * 0.9, 0),
    uncertaintyHigh: round(maintenance * 1.1, 0),
    planningScenarios: {
      minus10Percent: round(maintenance * 0.9, 0),
      maintenance: round(maintenance, 0),
      plus10Percent: round(maintenance * 1.1, 0),
    },
  };
}

export function navyBodyFatPercent(
  sex: FitnessSex,
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm?: number,
): number {
  const height = requireFinitePositive(heightCm, 'Height');
  const waist = requireFinitePositive(waistCm, 'Waist circumference');
  const neck = requireFinitePositive(neckCm, 'Neck circumference');
  const hip = hipCm == null ? 0 : requireFinitePositive(hipCm, 'Hip circumference');
  const heightIn = cmToInches(height);
  const waistIn = cmToInches(waist);
  const neckIn = cmToInches(neck);
  const hipIn = cmToInches(hip);
  const circumferenceTerm = sex === 'male' ? waistIn - neckIn : waistIn + hipIn - neckIn;
  if (circumferenceTerm <= 0) throw new Error('The circumference measurements are not valid for the selected equation.');
  const raw = sex === 'male'
    ? 86.01 * Math.log10(circumferenceTerm) - 70.041 * Math.log10(heightIn) + 36.76
    : 163.205 * Math.log10(circumferenceTerm) - 97.684 * Math.log10(heightIn) - 78.387;
  if (!Number.isFinite(raw) || raw < 0 || raw > 75) throw new Error('The supplied measurements produce an implausible Navy-method estimate. Recheck measurement positions and units.');
  return round(raw, 2);
}

export function estimateBodyFat(
  sex: FitnessSex,
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm: number | undefined,
  weightKg?: number | null,
): BodyFatEstimate {
  const bodyFatPercent = navyBodyFatPercent(sex, heightCm, waistCm, neckCm, hipCm);
  const validWeight = weightKg != null && Number.isFinite(weightKg) && weightKg > 0 ? weightKg : null;
  const fatMassKg = validWeight == null ? null : validWeight * bodyFatPercent / 100;
  const leanMassKg = validWeight == null ? null : validWeight - fatMassKg!;
  return {
    bodyFatPercent,
    fatMassKg: fatMassKg == null ? null : round(fatMassKg, 2),
    leanMassKg: leanMassKg == null ? null : round(leanMassKg, 2),
    waistToHeightRatio: round(waistCm / heightCm, 3),
  };
}
