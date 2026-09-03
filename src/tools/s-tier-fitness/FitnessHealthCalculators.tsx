import React, { useMemo, useState } from 'react';
import { Activity, Calculator, Info, Ruler, Scale } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { getPublicCalculatorTask, PUBLIC_CALCULATOR_TASKS } from '../../calculators/publicCalculatorTasks';
import {
  ACTIVITY_LEVELS,
  bmiAssessment,
  cmToInches,
  estimateBmr,
  estimateBodyFat,
  estimateTdee,
  feetAndInchesToCm,
  inchesToCm,
  kgToLb,
  lbToKg,
  type FitnessSex,
  type FitnessUnitSystem,
} from '../../utilities/s-tier-fitness';

const FITNESS_IDS = new Set(['bmi-calculator', 'bmr-calculator', 'tdee-calculator', 'body-fat-calculator']);
const inputClass = 'mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-950';

function currentId() {
  const clean = location.hash.replace(/^#\/?/, '').split('?')[0];
  return clean.startsWith('tool/') ? clean.slice(5).split('/')[0] : clean.split('/')[0];
}

function safe<T>(fn: () => T): { value: T | null; error: string } {
  try { return { value: fn(), error: '' }; }
  catch (error) { return { value: null, error: error instanceof Error ? error.message : String(error) }; }
}

function n(value: number, digits = 1) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

export default function FitnessHealthCalculators() {
  const task = useMemo(() => {
    const id = currentId();
    return getPublicCalculatorTask(FITNESS_IDS.has(id) ? id : '') ?? PUBLIC_CALCULATOR_TASKS.find((item) => item.id === 'bmi-calculator')!;
  }, []);
  const [units, setUnits] = useState<FitnessUnitSystem>('metric');
  const [weightKg, setWeightKg] = useState(75);
  const [heightCm, setHeightCm] = useState(180);
  const [age, setAge] = useState(30);
  const [sex, setSex] = useState<FitnessSex>('male');
  const [bodyFat, setBodyFat] = useState('');
  const [activity, setActivity] = useState(1.55);
  const [waistCm, setWaistCm] = useState(85);
  const [neckCm, setNeckCm] = useState(38);
  const [hipCm, setHipCm] = useState(95);

  const related = task.id === 'bmi-calculator'
    ? ['body-fat-calculator', 'bmr-calculator', 'tdee-calculator']
    : task.id === 'body-fat-calculator'
      ? ['bmi-calculator', 'bmr-calculator', 'tdee-calculator']
      : ['bmi-calculator', 'body-fat-calculator', 'one-rep-max-calculator'];

  return (
    <ToolShell toolId={task.id} title={task.name} description={task.description} category="calculator" relatedToolIds={related}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="flex items-start gap-2 text-xs leading-5 text-blue-900 dark:text-blue-200">
            <Calculator className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Live local estimates with explicit formulas, unit conversion, validation, and context. These are adult screening/planning tools, not diagnoses or individualized medical/nutrition prescriptions.</span>
          </div>
          <UnitToggle value={units} set={setUnits} />
        </div>

        {task.id === 'bmi-calculator' && <BmiTool units={units} weightKg={weightKg} setWeightKg={setWeightKg} heightCm={heightCm} setHeightCm={setHeightCm} />}
        {task.id === 'bmr-calculator' && <BmrTool units={units} weightKg={weightKg} setWeightKg={setWeightKg} heightCm={heightCm} setHeightCm={setHeightCm} age={age} setAge={setAge} sex={sex} setSex={setSex} bodyFat={bodyFat} setBodyFat={setBodyFat} />}
        {task.id === 'tdee-calculator' && <TdeeTool units={units} weightKg={weightKg} setWeightKg={setWeightKg} heightCm={heightCm} setHeightCm={setHeightCm} age={age} setAge={setAge} sex={sex} setSex={setSex} bodyFat={bodyFat} setBodyFat={setBodyFat} activity={activity} setActivity={setActivity} />}
        {task.id === 'body-fat-calculator' && <BodyFatTool units={units} weightKg={weightKg} setWeightKg={setWeightKg} heightCm={heightCm} setHeightCm={setHeightCm} sex={sex} setSex={setSex} waistCm={waistCm} setWaistCm={setWaistCm} neckCm={neckCm} setNeckCm={setNeckCm} hipCm={hipCm} setHipCm={setHipCm} />}
      </div>
    </ToolShell>
  );
}

function UnitToggle({ value, set }: { value: FitnessUnitSystem; set: (value: FitnessUnitSystem) => void }) {
  return <div className="inline-flex rounded-lg border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-950" aria-label="Unit system">
    {(['metric', 'imperial'] as const).map((unit) => <button key={unit} type="button" aria-pressed={value === unit} onClick={() => set(unit)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${value === unit ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-300'}`}>{unit === 'metric' ? 'Metric' : 'US / imperial'}</button>)}
  </div>;
}

function CommonBodyInputs({ units, weightKg, setWeightKg, heightCm, setHeightCm }: { units: FitnessUnitSystem; weightKg: number; setWeightKg: (v: number) => void; heightCm: number; setHeightCm: (v: number) => void }) {
  return <div className="grid gap-3 md:grid-cols-2">
    <label className="text-xs font-semibold">Weight <span className="font-normal text-neutral-500">({units === 'metric' ? 'kg' : 'lb'})</span><input aria-label={`Weight in ${units === 'metric' ? 'kilograms' : 'pounds'}`} type="number" min="1" step="0.1" className={inputClass} value={Number((units === 'metric' ? weightKg : kgToLb(weightKg)).toFixed(2))} onChange={(e) => setWeightKg(units === 'metric' ? Number(e.target.value) : lbToKg(Number(e.target.value)))} /></label>
    <HeightField units={units} heightCm={heightCm} setHeightCm={setHeightCm} />
  </div>;
}

function HeightField({ units, heightCm, setHeightCm }: { units: FitnessUnitSystem; heightCm: number; setHeightCm: (v: number) => void }) {
  if (units === 'metric') return <label className="text-xs font-semibold">Height <span className="font-normal text-neutral-500">(cm)</span><input aria-label="Height in centimeters" type="number" min="50" step="0.1" className={inputClass} value={Number(heightCm.toFixed(1))} onChange={(e) => setHeightCm(Number(e.target.value))} /></label>;
  const totalInches = cmToInches(heightCm);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  return <fieldset className="grid grid-cols-2 gap-2"><legend className="col-span-2 text-xs font-semibold">Height</legend><label className="text-[11px] text-neutral-500">Feet<input aria-label="Height feet" type="number" min="1" step="1" className={inputClass} value={feet} onChange={(e) => setHeightCm(feetAndInchesToCm(Number(e.target.value), inches))} /></label><label className="text-[11px] text-neutral-500">Inches<input aria-label="Height inches" type="number" min="0" max="11.99" step="0.1" className={inputClass} value={Number(inches.toFixed(1))} onChange={(e) => setHeightCm(feetAndInchesToCm(feet, Number(e.target.value)))} /></label></fieldset>;
}

function SexAgeInputs({ sex, setSex, age, setAge }: { sex: FitnessSex; setSex: (v: FitnessSex) => void; age: number; setAge: (v: number) => void }) {
  return <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">Equation sex constant<select aria-label="Sex constant used by equation" className={inputClass} value={sex} onChange={(e) => setSex(e.target.value as FitnessSex)}><option value="male">Male constant</option><option value="female">Female constant</option></select></label><label className="text-xs font-semibold">Age <span className="font-normal text-neutral-500">(years)</span><input aria-label="Age in years" type="number" min="14" max="120" step="1" className={inputClass} value={age} onChange={(e) => setAge(Number(e.target.value))} /></label></div>;
}

function BmiTool(props: { units: FitnessUnitSystem; weightKg: number; setWeightKg: (v: number) => void; heightCm: number; setHeightCm: (v: number) => void }) {
  const result = useMemo(() => safe(() => bmiAssessment(props.weightKg, props.heightCm)), [props.weightKg, props.heightCm]);
  const weightLabel = (kg: number) => props.units === 'metric' ? `${n(kg, 1)} kg` : `${n(kgToLb(kg), 1)} lb`;
  return <>
    <CommonBodyInputs {...props} />
    {result.error && <ErrorBox text={result.error} />}
    {result.value && <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="BMI" value={n(result.value.bmi, 1)} icon={<Scale className="h-4 w-4" />} /><Metric label="Adult screening band" value={result.value.category} /><Metric label="BMI 18.5–24.9 weight range" value={`${weightLabel(result.value.healthyWeightMinKg)} – ${weightLabel(result.value.healthyWeightMaxKg)}`} /><Metric label="Distance to that range" value={result.value.distanceToHealthyRangeKg === 0 ? 'Inside range' : weightLabel(result.value.distanceToHealthyRangeKg)} /></div>
      <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><h3 className="text-sm font-bold">BMI bands at your height</h3><div className="mt-3 grid gap-2 sm:grid-cols-4">{[[0,18.5,'Underweight'],[18.5,25,'Healthy range'],[25,30,'Overweight'],[30,40,'Obesity']].map(([low, high, label]) => { const meters = props.heightCm / 100; const lowKg = Number(low) * meters * meters; const highKg = Number(high) * meters * meters; return <div key={String(label)} className="rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-950"><div className="font-semibold">{label}</div><div className="mt-1 text-neutral-500">BMI {Number(low) === 0 ? `< ${high}` : Number(high) === 40 ? `≥ ${low}` : `${low}–${Number(high)-0.1}`}</div><div className="mt-1 font-mono">{Number(low) === 0 ? `< ${weightLabel(highKg)}` : Number(high) === 40 ? `≥ ${weightLabel(lowKg)}` : `${weightLabel(lowKg)}–${weightLabel(highKg)}`}</div></div>; })}</div></section>
      <InfoBox>For adults, BMI is a population screening measure. It does not directly measure fat mass, muscle, bone, fat distribution, pregnancy-related changes, or individual health.</InfoBox>
    </>}
  </>;
}

function BmrTool(props: { units: FitnessUnitSystem; weightKg: number; setWeightKg: (v: number) => void; heightCm: number; setHeightCm: (v: number) => void; age: number; setAge: (v: number) => void; sex: FitnessSex; setSex: (v: FitnessSex) => void; bodyFat: string; setBodyFat: (v: string) => void }) {
  const bf = props.bodyFat.trim() ? Number(props.bodyFat) : null;
  const result = useMemo(() => safe(() => estimateBmr(props.weightKg, props.heightCm, props.age, props.sex, bf)), [props.weightKg, props.heightCm, props.age, props.sex, bf]);
  return <><CommonBodyInputs {...props} /><SexAgeInputs sex={props.sex} setSex={props.setSex} age={props.age} setAge={props.setAge} /><label className="block text-xs font-semibold">Body-fat % <span className="font-normal text-neutral-500">(optional; enables Katch–McArdle)</span><input aria-label="Optional body fat percentage" type="number" min="1" max="74" step="0.1" className={inputClass} value={props.bodyFat} onChange={(e) => props.setBodyFat(e.target.value)} placeholder="Optional" /></label>{result.error && <ErrorBox text={result.error} />}{result.value && <><div className="grid gap-3 sm:grid-cols-3"><Metric label="Multi-formula midpoint" value={`${n(result.value.consensus, 0)} kcal/day`} icon={<Activity className="h-4 w-4" />} /><Metric label="Formula spread" value={`${n(result.value.spread, 0)} kcal/day`} /><Metric label="Methods included" value={String(result.value.methodsUsed)} /></div><section className="overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800"><table className="w-full min-w-[32rem] text-sm"><thead className="bg-neutral-50 text-left dark:bg-neutral-950"><tr><th className="p-3">Equation</th><th className="p-3">Estimate</th><th className="p-3">What it uses</th></tr></thead><tbody><MethodRow name="Mifflin–St Jeor" value={result.value.mifflinStJeor} note="Weight, height, age, sex constant" /><MethodRow name="Revised Harris–Benedict" value={result.value.revisedHarrisBenedict} note="Weight, height, age, sex constant" />{result.value.katchMcArdle != null && <MethodRow name="Katch–McArdle" value={result.value.katchMcArdle} note="Weight + estimated lean mass" />}</tbody></table></section><InfoBox>BMR estimates energy expenditure at rest under standardized conditions. Formula disagreement is useful context: individual measured resting expenditure can differ from every predictive equation.</InfoBox></>}</>;
}

function TdeeTool(props: { units: FitnessUnitSystem; weightKg: number; setWeightKg: (v: number) => void; heightCm: number; setHeightCm: (v: number) => void; age: number; setAge: (v: number) => void; sex: FitnessSex; setSex: (v: FitnessSex) => void; bodyFat: string; setBodyFat: (v: string) => void; activity: number; setActivity: (v: number) => void }) {
  const bf = props.bodyFat.trim() ? Number(props.bodyFat) : null;
  const bmr = useMemo(() => safe(() => estimateBmr(props.weightKg, props.heightCm, props.age, props.sex, bf)), [props.weightKg, props.heightCm, props.age, props.sex, bf]);
  const result = useMemo(() => bmr.value ? safe(() => estimateTdee(bmr.value!.consensus, props.activity)) : { value: null, error: bmr.error }, [bmr, props.activity]);
  return <><CommonBodyInputs {...props} /><SexAgeInputs sex={props.sex} setSex={props.setSex} age={props.age} setAge={props.setAge} /><div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">Activity level<select aria-label="Activity level" className={inputClass} value={props.activity} onChange={(e) => props.setActivity(Number(e.target.value))}>{ACTIVITY_LEVELS.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.detail}</option>)}</select></label><label className="text-xs font-semibold">Body-fat % <span className="font-normal text-neutral-500">(optional)</span><input aria-label="Optional body fat percentage" type="number" min="1" max="74" step="0.1" className={inputClass} value={props.bodyFat} onChange={(e) => props.setBodyFat(e.target.value)} placeholder="Adds Katch–McArdle BMR" /></label></div>{result.error && <ErrorBox text={result.error} />}{result.value && bmr.value && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="BMR midpoint" value={`${n(bmr.value.consensus, 0)} kcal/day`} /><Metric label="Maintenance estimate" value={`${n(result.value.maintenance, 0)} kcal/day`} icon={<Activity className="h-4 w-4" />} /><Metric label="Weekly equivalent" value={`${n(result.value.weeklyMaintenance, 0)} kcal/week`} /><Metric label="±10% planning band" value={`${n(result.value.uncertaintyLow,0)}–${n(result.value.uncertaintyHigh,0)} kcal/day`} /></div><section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><h3 className="text-sm font-bold">Simple planning scenarios</h3><div className="mt-3 grid gap-3 sm:grid-cols-3"><Metric label="10% below estimate" value={`${n(result.value.planningScenarios.minus10Percent,0)} kcal/day`} /><Metric label="Maintenance estimate" value={`${n(result.value.planningScenarios.maintenance,0)} kcal/day`} /><Metric label="10% above estimate" value={`${n(result.value.planningScenarios.plus10Percent,0)} kcal/day`} /></div><p className="mt-3 text-xs text-neutral-500">These are arithmetic reference scenarios, not recommended calorie targets. Real energy needs vary with training volume, body composition, adaptation, health, and measurement error.</p></section></>}</>;
}

function BodyFatTool(props: { units: FitnessUnitSystem; weightKg: number; setWeightKg: (v: number) => void; heightCm: number; setHeightCm: (v: number) => void; sex: FitnessSex; setSex: (v: FitnessSex) => void; waistCm: number; setWaistCm: (v: number) => void; neckCm: number; setNeckCm: (v: number) => void; hipCm: number; setHipCm: (v: number) => void }) {
  const result = useMemo(() => safe(() => estimateBodyFat(props.sex, props.heightCm, props.waistCm, props.neckCm, props.sex === 'female' ? props.hipCm : undefined, props.weightKg)), [props]);
  const circumference = (label: string, cm: number, set: (v: number) => void) => <label className="text-xs font-semibold">{label} <span className="font-normal text-neutral-500">({props.units === 'metric' ? 'cm' : 'in'})</span><input aria-label={`${label} in ${props.units === 'metric' ? 'centimeters' : 'inches'}`} type="number" min="1" step="0.1" className={inputClass} value={Number((props.units === 'metric' ? cm : cmToInches(cm)).toFixed(2))} onChange={(e) => set(props.units === 'metric' ? Number(e.target.value) : inchesToCm(Number(e.target.value)))} /></label>;
  const mass = (kg: number | null) => kg == null ? '—' : props.units === 'metric' ? `${n(kg,1)} kg` : `${n(kgToLb(kg),1)} lb`;
  return <><CommonBodyInputs units={props.units} weightKg={props.weightKg} setWeightKg={props.setWeightKg} heightCm={props.heightCm} setHeightCm={props.setHeightCm} /><label className="block text-xs font-semibold">Navy equation<select aria-label="Navy body fat equation" className={inputClass} value={props.sex} onChange={(e) => props.setSex(e.target.value as FitnessSex)}><option value="male">Male circumference equation</option><option value="female">Female circumference equation</option></select></label><div className={`grid gap-3 ${props.sex === 'female' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>{circumference('Waist circumference', props.waistCm, props.setWaistCm)}{circumference('Neck circumference', props.neckCm, props.setNeckCm)}{props.sex === 'female' && circumference('Hip circumference', props.hipCm, props.setHipCm)}</div>{result.error && <ErrorBox text={result.error} />}{result.value && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Estimated body fat" value={`${n(result.value.bodyFatPercent,1)}%`} /><Metric label="Estimated fat mass" value={mass(result.value.fatMassKg)} /><Metric label="Estimated lean mass" value={mass(result.value.leanMassKg)} /><Metric label="Waist / height" value={n(result.value.waistToHeightRatio,3)} /></div><section className="rounded-xl border border-neutral-200 p-4 text-xs leading-5 dark:border-neutral-800"><h3 className="flex items-center gap-2 text-sm font-bold"><Ruler className="h-4 w-4" /> Measurement consistency matters</h3><div className="mt-2 grid gap-2 md:grid-cols-3"><p><b>Neck:</b> measure just below the larynx, tape level and snug without compressing skin.</p><p><b>Waist:</b> use the location required by the Navy circumference method and repeat at the same point.</p>{props.sex === 'female' && <p><b>Hip:</b> measure around the widest part of the hips/buttocks with the tape horizontal.</p>}</div></section><InfoBox>The Navy method estimates body composition from circumferences; hydration, tape placement, breathing, posture, and body shape can materially affect the number. Trend repeated measurements taken consistently rather than treating a single estimate as a precise measurement.</InfoBox></>}</>;
}

function MethodRow({ name, value, note }: { name: string; value: number; note: string }) {
  return <tr className="border-t border-neutral-200 dark:border-neutral-800"><td className="p-3 font-semibold">{name}</td><td className="p-3 tabular-nums">{n(value,0)} kcal/day</td><td className="p-3 text-neutral-500">{note}</td></tr>;
}

function Metric({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{icon}{label}</div><div className="mt-1 break-words text-xl font-bold">{value}</div></div>;
}

function ErrorBox({ text }: { text: string }) {
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{text}</div>;
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200"><Info className="mt-0.5 h-4 w-4 shrink-0" />{children}</div>;
}
