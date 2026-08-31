import {
  bmi,
  creditCardPayoff,
  evaluateMathExpression,
  finiteNumber,
  formatMoney,
  formatNumber,
  futureValueWithMonthlyContribution,
  mifflinStJeor,
  monthlyContributionForGoal,
  monthlyLoanPayment,
  navyBodyFatPercent,
  oneRepMax,
  parseNumberList,
  simplifyFraction,
} from '../utilities/everyday-calculators-core';

export type CalculatorInputType = 'number' | 'text' | 'select';

export interface CalculatorInput {
  id: string;
  label: string;
  type: CalculatorInputType;
  defaultValue: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  help?: string;
}

export interface CalculatorResult {
  label: string;
  value: string;
  note?: string;
}

export interface CalculatorDefinition {
  id: string;
  inputs: CalculatorInput[];
  calculate(values: Record<string, string>): CalculatorResult[];
  formula?: string;
  notice?: string;
  externalData?: 'currency';
}

const N = (values: Record<string, string>, id: string, fallback = 0) => finiteNumber(values[id], fallback);
const S = (values: Record<string, string>, id: string) => values[id] ?? '';
const money = (value: number) => formatMoney(value, '€');
const pct = (value: number) => `${formatNumber(value, 2)}%`;
const number = (value: number, digits = 2) => formatNumber(value, digits);
const result = (label: string, value: string, note?: string): CalculatorResult => ({ label, value, ...(note ? { note } : {}) });
const requirePositive = (value: number, label: string) => { if (!(value > 0)) throw new Error(`${label} must be greater than zero.`); return value; };
const requireNonNegative = (value: number, label: string) => { if (value < 0) throw new Error(`${label} cannot be negative.`); return value; };
const degree = (radians: number) => radians * 180 / Math.PI;

const activityOptions = [
  { value: '1.2', label: 'Sedentary (little exercise)' },
  { value: '1.375', label: 'Lightly active (1–3 days/week)' },
  { value: '1.55', label: 'Moderately active (3–5 days/week)' },
  { value: '1.725', label: 'Very active (6–7 days/week)' },
  { value: '1.9', label: 'Extra active (very hard training/job)' },
];

export const CALCULATOR_DEFINITIONS: CalculatorDefinition[] = [
  {
    id: 'basic-calculator',
    inputs: [{ id: 'expression', label: 'Expression', type: 'text', defaultValue: '(12 + 8) * 3', placeholder: 'e.g. (12 + 8) * 3' }],
    calculate: (v) => [result('Result', number(evaluateMathExpression(S(v, 'expression')), 12))],
    formula: 'Supports +, −, ×, ÷, %, powers (^), and parentheses.',
  },
  {
    id: 'scientific-calculator',
    inputs: [{ id: 'expression', label: 'Expression', type: 'text', defaultValue: 'sqrt(144) + sin(pi / 2)', placeholder: 'e.g. sqrt(144) + sin(pi / 2)' }],
    calculate: (v) => [result('Result', number(evaluateMathExpression(S(v, 'expression')), 12))],
    formula: 'Functions: sqrt, abs, sin, cos, tan, asin, acos, atan, ln, log, floor, ceil, round. Trigonometric angles are radians.',
  },
  {
    id: 'fraction-calculator',
    inputs: [
      { id: 'n1', label: 'First numerator', type: 'number', defaultValue: '1', step: 1 },
      { id: 'd1', label: 'First denominator', type: 'number', defaultValue: '2', step: 1 },
      { id: 'operator', label: 'Operation', type: 'select', defaultValue: '+', options: [{ value: '+', label: 'Add (+)' }, { value: '-', label: 'Subtract (−)' }, { value: '*', label: 'Multiply (×)' }, { value: '/', label: 'Divide (÷)' }] },
      { id: 'n2', label: 'Second numerator', type: 'number', defaultValue: '1', step: 1 },
      { id: 'd2', label: 'Second denominator', type: 'number', defaultValue: '3', step: 1 },
    ],
    calculate: (v) => {
      const n1 = Math.trunc(N(v, 'n1')); const d1 = Math.trunc(N(v, 'd1')); const n2 = Math.trunc(N(v, 'n2')); const d2 = Math.trunc(N(v, 'd2'));
      if (d1 === 0 || d2 === 0) throw new Error('Denominators cannot be zero.');
      const op = S(v, 'operator');
      let numerator = 0; let denominator = 1;
      if (op === '+') { numerator = n1 * d2 + n2 * d1; denominator = d1 * d2; }
      else if (op === '-') { numerator = n1 * d2 - n2 * d1; denominator = d1 * d2; }
      else if (op === '*') { numerator = n1 * n2; denominator = d1 * d2; }
      else { if (n2 === 0) throw new Error('Cannot divide by a zero fraction.'); numerator = n1 * d2; denominator = d1 * n2; }
      const simplified = simplifyFraction(numerator, denominator);
      return [result('Reduced fraction', `${simplified.numerator}/${simplified.denominator}`), result('Decimal', number(simplified.numerator / simplified.denominator, 10))];
    },
  },
  {
    id: 'average-calculator',
    inputs: [{ id: 'values', label: 'Numbers', type: 'text', defaultValue: '12, 18, 25, 31', placeholder: 'Separate with commas or spaces' }],
    calculate: (v) => { const xs = parseNumberList(S(v, 'values')); if (!xs.length) throw new Error('Enter at least one number.'); return [result('Average', number(xs.reduce((a, b) => a + b, 0) / xs.length, 10)), result('Count', String(xs.length)), result('Sum', number(xs.reduce((a, b) => a + b, 0), 10))]; },
  },
  {
    id: 'ratio-calculator',
    inputs: [
      { id: 'a', label: 'A', type: 'number', defaultValue: '16' }, { id: 'b', label: 'B', type: 'number', defaultValue: '24' },
      { id: 'c', label: 'C (optional proportion A:B = C:X)', type: 'number', defaultValue: '10' },
    ],
    calculate: (v) => { const a = N(v, 'a'); const b = N(v, 'b'); const c = N(v, 'c'); requirePositive(Math.abs(a), 'A'); requirePositive(Math.abs(b), 'B'); const scale = Math.abs(a) && Math.abs(b) ? Math.abs((awaitGcd(a, b))) : 1; return [result('Simplified ratio', `${number(a / scale, 6)} : ${number(b / scale, 6)}`), result('X in A:B = C:X', number(c * b / a, 8))]; },
    formula: 'Direct proportion: X = C × B ÷ A.',
  },
  {
    id: 'grade-calculator',
    inputs: [{ id: 'earned', label: 'Points earned', type: 'number', defaultValue: '42', min: 0 }, { id: 'possible', label: 'Points possible', type: 'number', defaultValue: '50', min: 0 }],
    calculate: (v) => { const possible = requirePositive(N(v, 'possible'), 'Points possible'); const value = N(v, 'earned') / possible * 100; return [result('Grade', pct(value)), result('Points not earned', number(Math.max(0, possible - N(v, 'earned')), 2))]; },
  },
  {
    id: 'final-grade-calculator',
    inputs: [
      { id: 'current', label: 'Current course grade', type: 'number', defaultValue: '82', unit: '%' },
      { id: 'finalWeight', label: 'Final exam weight', type: 'number', defaultValue: '30', unit: '%' },
      { id: 'target', label: 'Target course grade', type: 'number', defaultValue: '85', unit: '%' },
    ],
    calculate: (v) => { const w = N(v, 'finalWeight') / 100; if (!(w > 0 && w <= 1)) throw new Error('Final exam weight must be between 0 and 100%.'); const needed = (N(v, 'target') - N(v, 'current') * (1 - w)) / w; return [result('Final exam score needed', pct(needed), needed > 100 ? 'The target is not reachable with a 100% final score.' : needed < 0 ? 'The target is already secured even with a zero on the final.' : undefined)]; },
  },
  {
    id: 'gpa-calculator',
    inputs: [{ id: 'points', label: 'Grade points', type: 'text', defaultValue: '4.0, 3.3, 3.7, 4.0' }, { id: 'credits', label: 'Credits', type: 'text', defaultValue: '3, 4, 3, 2' }],
    calculate: (v) => { const points = parseNumberList(S(v, 'points')); const credits = parseNumberList(S(v, 'credits')); if (!points.length || points.length !== credits.length) throw new Error('Enter the same number of grade-point and credit values.'); const totalCredits = credits.reduce((a, b) => a + b, 0); requirePositive(totalCredits, 'Total credits'); return [result('Weighted GPA', number(points.reduce((sum, point, i) => sum + point * credits[i], 0) / totalCredits, 4)), result('Total credits', number(totalCredits, 2))]; },
  },
  {
    id: 'weighted-average-calculator',
    inputs: [{ id: 'values', label: 'Values', type: 'text', defaultValue: '80, 92, 75' }, { id: 'weights', label: 'Weights', type: 'text', defaultValue: '20, 50, 30', help: 'Weights can be percentages or any proportional numbers.' }],
    calculate: (v) => { const xs = parseNumberList(S(v, 'values')); const ws = parseNumberList(S(v, 'weights')); if (!xs.length || xs.length !== ws.length) throw new Error('Enter the same number of values and weights.'); const weightSum = ws.reduce((a, b) => a + b, 0); requirePositive(weightSum, 'Weight total'); return [result('Weighted average', number(xs.reduce((sum, x, i) => sum + x * ws[i], 0) / weightSum, 8)), result('Weight total', number(weightSum, 4))]; },
  },
  {
    id: 'statistics-calculator',
    inputs: [{ id: 'values', label: 'Dataset', type: 'text', defaultValue: '4, 7, 7, 9, 12, 15' }],
    calculate: (v) => { const xs = parseNumberList(S(v, 'values')).sort((a, b) => a - b); if (!xs.length) throw new Error('Enter at least one number.'); const count = xs.length; const sum = xs.reduce((a, b) => a + b, 0); const mean = sum / count; const median = count % 2 ? xs[(count - 1) / 2] : (xs[count / 2 - 1] + xs[count / 2]) / 2; const variance = xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / count; return [result('Count', String(count)), result('Sum', number(sum, 8)), result('Mean', number(mean, 8)), result('Median', number(median, 8)), result('Minimum', number(xs[0], 8)), result('Maximum', number(xs[count - 1], 8)), result('Range', number(xs[count - 1] - xs[0], 8)), result('Population variance', number(variance, 8)), result('Population standard deviation', number(Math.sqrt(variance), 8))]; },
  },
  {
    id: 'triangle-calculator',
    inputs: [{ id: 'a', label: 'Side a', type: 'number', defaultValue: '3', min: 0 }, { id: 'b', label: 'Side b', type: 'number', defaultValue: '4', min: 0 }, { id: 'c', label: 'Side c', type: 'number', defaultValue: '5', min: 0 }],
    calculate: (v) => { const a = requirePositive(N(v, 'a'), 'Side a'); const b = requirePositive(N(v, 'b'), 'Side b'); const c = requirePositive(N(v, 'c'), 'Side c'); if (a + b <= c || a + c <= b || b + c <= a) throw new Error('Those side lengths do not form a valid triangle.'); const s = (a + b + c) / 2; const area = Math.sqrt(s * (s - a) * (s - b) * (s - c)); const A = degree(Math.acos((b*b + c*c - a*a)/(2*b*c))); const B = degree(Math.acos((a*a + c*c - b*b)/(2*a*c))); return [result('Perimeter', number(a+b+c, 8)), result('Area', number(area, 8)), result('Angle A', `${number(A, 4)}°`), result('Angle B', `${number(B, 4)}°`), result('Angle C', `${number(180-A-B, 4)}°`)]; },
  },
  {
    id: 'circle-calculator',
    inputs: [{ id: 'radius', label: 'Radius', type: 'number', defaultValue: '5', min: 0 }],
    calculate: (v) => { const r = requirePositive(N(v, 'radius'), 'Radius'); return [result('Diameter', number(2*r, 8)), result('Circumference', number(2*Math.PI*r, 8)), result('Area', number(Math.PI*r*r, 8))]; },
  },
  {
    id: 'probability-calculator',
    inputs: [
      { id: 'a', label: 'Probability A', type: 'number', defaultValue: '40', unit: '%', min: 0, max: 100 },
      { id: 'b', label: 'Probability B', type: 'number', defaultValue: '30', unit: '%', min: 0, max: 100 },
      { id: 'mode', label: 'Outcome', type: 'select', defaultValue: 'and', options: [{ value: 'and', label: 'A AND B' }, { value: 'or', label: 'A OR B (independent)' }, { value: 'atleast', label: 'At least one of A or B' }] },
    ],
    calculate: (v) => { const a = N(v, 'a')/100; const b = N(v, 'b')/100; if (a<0||a>1||b<0||b>1) throw new Error('Probabilities must be between 0 and 100%.'); const mode=S(v,'mode'); const p = mode==='and' ? a*b : a+b-a*b; return [result('Combined probability', pct(p*100))]; },
    formula: 'Assumes A and B are statistically independent.',
  },

  {
    id: 'tip-calculator', inputs: [{ id:'bill',label:'Bill amount',type:'number',defaultValue:'60',unit:'€',min:0 },{ id:'tip',label:'Tip',type:'number',defaultValue:'15',unit:'%',min:0 },{ id:'people',label:'People',type:'number',defaultValue:'2',min:1,step:1 }],
    calculate:(v)=>{const bill=requireNonNegative(N(v,'bill'),'Bill');const tip=Math.max(0,N(v,'tip'))/100;const people=Math.max(1,Math.trunc(N(v,'people',1)));const tipAmount=bill*tip;const total=bill+tipAmount;return[result('Tip amount',money(tipAmount)),result('Total',money(total)),result('Per person',money(total/people))];},
  },
  {
    id:'bill-splitter', inputs:[{id:'bill',label:'Bill amount',type:'number',defaultValue:'84',unit:'€',min:0},{id:'tip',label:'Tip',type:'number',defaultValue:'10',unit:'%',min:0},{id:'people',label:'People',type:'number',defaultValue:'4',min:1,step:1}],
    calculate:(v)=>{const total=requireNonNegative(N(v,'bill'),'Bill')*(1+Math.max(0,N(v,'tip'))/100);const people=Math.max(1,Math.trunc(N(v,'people',1)));return[result('Total with tip',money(total)),result('Per person',money(total/people))];},
  },
  { id:'currency-converter', inputs:[], calculate:()=>[], externalData:'currency', notice:'Exchange rates require a network request. No amount or other personal content is sent; the request contains only the selected currency pair.' },
  {
    id:'loan-calculator', inputs:[{id:'principal',label:'Loan amount',type:'number',defaultValue:'20000',unit:'€',min:0},{id:'rate',label:'Annual interest rate',type:'number',defaultValue:'5',unit:'%',min:0},{id:'years',label:'Term',type:'number',defaultValue:'5',unit:'years',min:0.1}],
    calculate:(v)=>{const p=requirePositive(N(v,'principal'),'Loan amount');const years=requirePositive(N(v,'years'),'Term');const monthly=monthlyLoanPayment(p,N(v,'rate'),years);const months=Math.round(years*12);const total=monthly*months;return[result('Monthly payment',money(monthly)),result('Total repayment',money(total)),result('Total interest',money(total-p))];},
  },
  {
    id:'mortgage-calculator', inputs:[{id:'price',label:'Home price',type:'number',defaultValue:'350000',unit:'€',min:0},{id:'down',label:'Down payment',type:'number',defaultValue:'70000',unit:'€',min:0},{id:'rate',label:'Mortgage rate',type:'number',defaultValue:'4',unit:'%',min:0},{id:'years',label:'Term',type:'number',defaultValue:'30',unit:'years',min:1},{id:'tax',label:'Annual property tax',type:'number',defaultValue:'3500',unit:'€',min:0},{id:'insurance',label:'Annual home insurance',type:'number',defaultValue:'900',unit:'€',min:0},{id:'hoa',label:'Monthly HOA / service fee',type:'number',defaultValue:'0',unit:'€',min:0}],
    calculate:(v)=>{const price=requirePositive(N(v,'price'),'Home price');const principal=Math.max(0,price-N(v,'down'));const years=requirePositive(N(v,'years'),'Term');const pi=monthlyLoanPayment(principal,N(v,'rate'),years);const totalMonthly=pi+N(v,'tax')/12+N(v,'insurance')/12+N(v,'hoa');const totalPI=pi*Math.round(years*12);return[result('Principal financed',money(principal)),result('Principal & interest / month',money(pi)),result('Estimated total / month',money(totalMonthly)),result('Total mortgage interest',money(Math.max(0,totalPI-principal)))];},
    notice:'Estimate only. Taxes, insurance, fees, lender terms, and local rules vary.',
  },
  {
    id:'amortization-calculator', inputs:[{id:'principal',label:'Loan amount',type:'number',defaultValue:'150000',unit:'€',min:0},{id:'rate',label:'Annual interest rate',type:'number',defaultValue:'4.5',unit:'%',min:0},{id:'years',label:'Term',type:'number',defaultValue:'20',unit:'years',min:0.1}],
    calculate:(v)=>{const p=requirePositive(N(v,'principal'),'Loan amount');const years=requirePositive(N(v,'years'),'Term');const payment=monthlyLoanPayment(p,N(v,'rate'),years);const monthlyRate=N(v,'rate')/100/12;const firstInterest=p*monthlyRate;const firstPrincipal=payment-firstInterest;const total=payment*Math.round(years*12);return[result('Monthly payment',money(payment)),result('First payment — interest',money(firstInterest)),result('First payment — principal',money(firstPrincipal)),result('Total interest',money(total-p))];},
  },
  {
    id:'compound-interest-calculator', inputs:[{id:'principal',label:'Starting balance',type:'number',defaultValue:'10000',unit:'€',min:0},{id:'rate',label:'Annual return',type:'number',defaultValue:'6',unit:'%'},{id:'years',label:'Years',type:'number',defaultValue:'10',min:0},{id:'monthly',label:'Monthly contribution',type:'number',defaultValue:'250',unit:'€',min:0}],
    calculate:(v)=>{const fv=futureValueWithMonthlyContribution(N(v,'principal'),N(v,'rate'),Math.max(0,N(v,'years')),N(v,'monthly'));const contributed=N(v,'principal')+N(v,'monthly')*Math.round(Math.max(0,N(v,'years'))*12);return[result('Projected balance',money(fv)),result('Total contributed',money(contributed)),result('Estimated growth',money(fv-contributed))];},
    notice:'Projection only; real investment returns are not guaranteed.',
  },
  {
    id:'savings-goal-calculator', inputs:[{id:'goal',label:'Savings goal',type:'number',defaultValue:'50000',unit:'€',min:0},{id:'current',label:'Current savings',type:'number',defaultValue:'5000',unit:'€',min:0},{id:'rate',label:'Annual return / interest',type:'number',defaultValue:'3',unit:'%'},{id:'years',label:'Time available',type:'number',defaultValue:'5',unit:'years',min:0.1}],
    calculate:(v)=>[result('Monthly contribution needed',money(monthlyContributionForGoal(N(v,'goal'),N(v,'current'),N(v,'rate'),requirePositive(N(v,'years'),'Time available'))))],
    notice:'Projection only; interest rates and investment returns can change.',
  },
  {
    id:'simple-interest-calculator', inputs:[{id:'principal',label:'Principal',type:'number',defaultValue:'10000',unit:'€',min:0},{id:'rate',label:'Annual rate',type:'number',defaultValue:'5',unit:'%',min:0},{id:'years',label:'Years',type:'number',defaultValue:'3',min:0}],
    calculate:(v)=>{const p=N(v,'principal');const interest=p*N(v,'rate')/100*N(v,'years');return[result('Interest',money(interest)),result('Final balance',money(p+interest))];},
  },
  {
    id:'roi-calculator', inputs:[{id:'initial',label:'Initial investment',type:'number',defaultValue:'10000',unit:'€'},{id:'final',label:'Final value',type:'number',defaultValue:'12500',unit:'€'}],
    calculate:(v)=>{const initial=requirePositive(Math.abs(N(v,'initial')),'Initial investment');const profit=N(v,'final')-N(v,'initial');return[result('Profit / loss',money(profit)),result('ROI',pct(profit/initial*100))];},
  },
  {
    id:'retirement-calculator', inputs:[{id:'current',label:'Current savings',type:'number',defaultValue:'30000',unit:'€',min:0},{id:'monthly',label:'Monthly contribution',type:'number',defaultValue:'500',unit:'€',min:0},{id:'rate',label:'Annual return',type:'number',defaultValue:'5',unit:'%'},{id:'years',label:'Years until retirement',type:'number',defaultValue:'30',min:0}],
    calculate:(v)=>{const fv=futureValueWithMonthlyContribution(N(v,'current'),N(v,'rate'),N(v,'years'),N(v,'monthly'));return[result('Projected balance',money(fv)),result('Total contributions',money(N(v,'current')+N(v,'monthly')*Math.round(N(v,'years')*12)))];},
    notice:'Long-term projection only; returns, inflation, taxes, and retirement rules are not modeled.',
  },
  {
    id:'credit-card-payoff-calculator', inputs:[{id:'balance',label:'Card balance',type:'number',defaultValue:'5000',unit:'€',min:0},{id:'rate',label:'APR',type:'number',defaultValue:'19.9',unit:'%',min:0},{id:'payment',label:'Monthly payment',type:'number',defaultValue:'200',unit:'€',min:0}],
    calculate:(v)=>{const payoff=creditCardPayoff(N(v,'balance'),N(v,'rate'),N(v,'payment'));if(!payoff.possible) return[result('Payoff', 'Payment is too low', 'The payment does not exceed the first month’s interest, so the balance will not amortize under this model.')];return[result('Estimated payoff time',`${payoff.months} months`),result('Estimated interest',money(payoff.interest)),result('Estimated total paid',money(N(v,'balance')+payoff.interest))];},
    notice:'Assumes a fixed APR, no new purchases or fees, and the same payment every month.',
  },
  {
    id:'salary-hourly-calculator', inputs:[{id:'salary',label:'Annual salary',type:'number',defaultValue:'50000',unit:'€',min:0},{id:'hours',label:'Hours per week',type:'number',defaultValue:'40',min:0.1},{id:'weeks',label:'Paid weeks per year',type:'number',defaultValue:'52',min:0.1}],
    calculate:(v)=>{const salary=N(v,'salary');const hours=requirePositive(N(v,'hours'),'Hours per week');const weeks=requirePositive(N(v,'weeks'),'Weeks per year');return[result('Hourly equivalent',money(salary/(hours*weeks))),result('Monthly equivalent',money(salary/12)),result('Weekly equivalent',money(salary/weeks)),result('Daily equivalent (5-day week)',money(salary/weeks/5))];},
  },
  {
    id:'car-loan-calculator', inputs:[{id:'price',label:'Vehicle price',type:'number',defaultValue:'30000',unit:'€',min:0},{id:'down',label:'Down payment',type:'number',defaultValue:'5000',unit:'€',min:0},{id:'trade',label:'Trade-in value',type:'number',defaultValue:'0',unit:'€',min:0},{id:'tax',label:'Sales tax',type:'number',defaultValue:'0',unit:'%',min:0},{id:'rate',label:'APR',type:'number',defaultValue:'5.5',unit:'%',min:0},{id:'years',label:'Term',type:'number',defaultValue:'5',unit:'years',min:0.1}],
    calculate:(v)=>{const taxable=Math.max(0,N(v,'price')-N(v,'trade'));const financed=Math.max(0,taxable*(1+N(v,'tax')/100)-N(v,'down'));const payment=monthlyLoanPayment(financed,N(v,'rate'),N(v,'years'));const total=payment*Math.round(N(v,'years')*12);return[result('Amount financed',money(financed)),result('Monthly payment',money(payment)),result('Total interest',money(Math.max(0,total-financed)))];},
  },
  {
    id:'rent-vs-buy-calculator', inputs:[{id:'rent',label:'Current monthly rent',type:'number',defaultValue:'1500',unit:'€',min:0},{id:'price',label:'Home price',type:'number',defaultValue:'350000',unit:'€',min:0},{id:'down',label:'Down payment',type:'number',defaultValue:'70000',unit:'€',min:0},{id:'rate',label:'Mortgage rate',type:'number',defaultValue:'4',unit:'%',min:0},{id:'years',label:'Comparison horizon',type:'number',defaultValue:'7',unit:'years',min:1},{id:'rentGrowth',label:'Annual rent growth',type:'number',defaultValue:'2',unit:'%'},{id:'appreciation',label:'Annual home appreciation',type:'number',defaultValue:'2',unit:'%'},{id:'propertyTax',label:'Annual property tax',type:'number',defaultValue:'1',unit:'% of home value',min:0},{id:'maintenance',label:'Annual maintenance',type:'number',defaultValue:'1',unit:'% of home value',min:0},{id:'sellingCost',label:'Selling cost',type:'number',defaultValue:'5',unit:'%',min:0}],
    calculate:(v)=>{const years=Math.max(1,Math.round(N(v,'years')));let totalRent=0;let monthlyRent=N(v,'rent');for(let y=0;y<years;y++){totalRent+=monthlyRent*12;monthlyRent*=1+N(v,'rentGrowth')/100;}const price=N(v,'price');const down=Math.min(price,N(v,'down'));const principal=Math.max(0,price-down);const payment=monthlyLoanPayment(principal,N(v,'rate'),30);const months=years*12;const r=N(v,'rate')/100/12;let balance=principal;let interestPaid=0;for(let m=0;m<months;m++){const interest=balance*r;interestPaid+=interest;balance=Math.max(0,balance+interest-payment);}const futureHome=price*(1+N(v,'appreciation')/100)**years;const taxesMaint=Array.from({length:years},(_,i)=>price*(1+N(v,'appreciation')/100)**i*(N(v,'propertyTax')+N(v,'maintenance'))/100).reduce((a,b)=>a+b,0);const selling=futureHome*N(v,'sellingCost')/100;const equity=futureHome-balance-selling;const buyCashCost=down+payment*months+taxesMaint-equity;return[result('Approx. rent cost',money(totalRent)),result('Approx. net buy cost',money(buyCashCost)),result('Difference',money(Math.abs(totalRent-buyCashCost)), totalRent<buyCashCost?'Rent is lower under these assumptions.':'Buy is lower under these assumptions.')];},
    notice:'Simplified scenario model, not financial advice. It omits taxes on sale, transaction details, opportunity cost, mortgage fees, utilities, and local rules.',
  },
  {
    id:'inflation-calculator', inputs:[{id:'amount',label:'Amount today',type:'number',defaultValue:'1000',unit:'€',min:0},{id:'inflation',label:'Annual inflation',type:'number',defaultValue:'2.5',unit:'%'},{id:'years',label:'Years',type:'number',defaultValue:'10',min:0}],
    calculate:(v)=>{const factor=(1+N(v,'inflation')/100)**N(v,'years');return[result('Future price for same basket',money(N(v,'amount')*factor)),result('Future purchasing power of today’s amount',money(N(v,'amount')/factor)),result('Cumulative price increase',pct((factor-1)*100))];},
  },
  {
    id:'debt-to-income-calculator', inputs:[{id:'debt',label:'Monthly debt payments',type:'number',defaultValue:'900',unit:'€',min:0},{id:'income',label:'Gross monthly income',type:'number',defaultValue:'4000',unit:'€',min:0}],
    calculate:(v)=>[result('Debt-to-income ratio',pct(N(v,'debt')/requirePositive(N(v,'income'),'Gross monthly income')*100))],
    notice:'Lenders can define qualifying debt and acceptable thresholds differently.',
  },

  {
    id:'fuel-trip-cost-calculator', inputs:[{id:'distance',label:'Distance',type:'number',defaultValue:'500',unit:'km',min:0},{id:'consumption',label:'Fuel consumption',type:'number',defaultValue:'7',unit:'L/100 km',min:0},{id:'price',label:'Fuel price',type:'number',defaultValue:'1.75',unit:'€/L',min:0}],
    calculate:(v)=>{const liters=N(v,'distance')*N(v,'consumption')/100;return[result('Fuel needed',`${number(liters,2)} L`),result('Estimated fuel cost',money(liters*N(v,'price')))];},
  },
  {
    id:'fuel-economy-calculator', inputs:[{id:'distance',label:'Distance traveled',type:'number',defaultValue:'650',unit:'km',min:0},{id:'fuel',label:'Fuel used',type:'number',defaultValue:'45',unit:'L',min:0}],
    calculate:(v)=>{const d=requirePositive(N(v,'distance'),'Distance');const f=requirePositive(N(v,'fuel'),'Fuel used');const kmL=d/f;return[result('Consumption',`${number(f/d*100,2)} L/100 km`),result('Efficiency',`${number(kmL,2)} km/L`),result('US MPG',`${number(kmL*2.35214583,2)} mpg`)]},
  },
  {
    id:'electricity-cost-calculator', inputs:[{id:'watts',label:'Power',type:'number',defaultValue:'1000',unit:'W',min:0},{id:'hours',label:'Use per day',type:'number',defaultValue:'2',unit:'hours',min:0},{id:'price',label:'Electricity price',type:'number',defaultValue:'0.35',unit:'€/kWh',min:0},{id:'days',label:'Days',type:'number',defaultValue:'30',min:0}],
    calculate:(v)=>{const kwh=N(v,'watts')/1000*N(v,'hours')*N(v,'days');return[result('Energy use',`${number(kwh,3)} kWh`),result('Estimated cost',money(kwh*N(v,'price'))),result('Average daily cost',money(kwh*N(v,'price')/Math.max(1,N(v,'days'))))];},
  },
  {
    id:'appliance-cost-calculator', inputs:[{id:'activeWatts',label:'Active power',type:'number',defaultValue:'120',unit:'W',min:0},{id:'activeHours',label:'Active use per day',type:'number',defaultValue:'5',unit:'hours',min:0},{id:'standbyWatts',label:'Standby power',type:'number',defaultValue:'2',unit:'W',min:0},{id:'price',label:'Electricity price',type:'number',defaultValue:'0.35',unit:'€/kWh',min:0}],
    calculate:(v)=>{const active=N(v,'activeWatts')*N(v,'activeHours');const standby=N(v,'standbyWatts')*Math.max(0,24-N(v,'activeHours'));const annual=(active+standby)/1000*365;return[result('Annual energy',`${number(annual,2)} kWh`),result('Annual cost',money(annual*N(v,'price'))),result('Monthly average',money(annual*N(v,'price')/12))];},
  },
  {
    id:'room-area-calculator', inputs:[{id:'length',label:'Length',type:'number',defaultValue:'5',unit:'m',min:0},{id:'width',label:'Width',type:'number',defaultValue:'4',unit:'m',min:0}],
    calculate:(v)=>{const l=N(v,'length');const w=N(v,'width');return[result('Floor area',`${number(l*w,3)} m²`),result('Perimeter',`${number(2*(l+w),3)} m`)];},
  },
  {
    id:'paint-calculator', inputs:[{id:'width',label:'Average wall width',type:'number',defaultValue:'4',unit:'m',min:0},{id:'height',label:'Wall height',type:'number',defaultValue:'2.5',unit:'m',min:0},{id:'walls',label:'Number of walls',type:'number',defaultValue:'4',min:1,step:1},{id:'openings',label:'Doors/windows area to subtract',type:'number',defaultValue:'6',unit:'m²',min:0},{id:'coats',label:'Coats',type:'number',defaultValue:'2',min:1,step:1},{id:'coverage',label:'Coverage per liter',type:'number',defaultValue:'10',unit:'m²/L',min:0.1},{id:'waste',label:'Waste / touch-up allowance',type:'number',defaultValue:'10',unit:'%',min:0}],
    calculate:(v)=>{const area=Math.max(0,N(v,'width')*N(v,'height')*Math.max(1,N(v,'walls'))-N(v,'openings'));const liters=area*Math.max(1,N(v,'coats'))/requirePositive(N(v,'coverage'),'Coverage')*(1+N(v,'waste')/100);return[result('Paintable area',`${number(area,2)} m²`),result('Paint needed',`${number(liters,2)} L`),result('Round-up purchase',`${Math.ceil(liters)} L`)];},
  },
  {
    id:'flooring-calculator', inputs:[{id:'length',label:'Room length',type:'number',defaultValue:'5',unit:'m',min:0},{id:'width',label:'Room width',type:'number',defaultValue:'4',unit:'m',min:0},{id:'waste',label:'Waste allowance',type:'number',defaultValue:'10',unit:'%',min:0},{id:'boxCoverage',label:'Coverage per box',type:'number',defaultValue:'2.2',unit:'m²',min:0.01}],
    calculate:(v)=>{const area=N(v,'length')*N(v,'width');const required=area*(1+N(v,'waste')/100);return[result('Room area',`${number(area,2)} m²`),result('Area incl. waste',`${number(required,2)} m²`),result('Boxes needed',String(Math.ceil(required/requirePositive(N(v,'boxCoverage'),'Coverage per box'))))];},
  },
  {
    id:'tile-calculator', inputs:[{id:'area',label:'Area to cover',type:'number',defaultValue:'12',unit:'m²',min:0},{id:'tileWidth',label:'Tile width',type:'number',defaultValue:'30',unit:'cm',min:0.1},{id:'tileHeight',label:'Tile height',type:'number',defaultValue:'60',unit:'cm',min:0.1},{id:'waste',label:'Waste allowance',type:'number',defaultValue:'10',unit:'%',min:0}],
    calculate:(v)=>{const tileArea=N(v,'tileWidth')/100*N(v,'tileHeight')/100;const count=Math.ceil(N(v,'area')*(1+N(v,'waste')/100)/requirePositive(tileArea,'Tile area'));return[result('Single tile area',`${number(tileArea,4)} m²`),result('Tiles needed',String(count))];},
  },
  {
    id:'box-volume-calculator', inputs:[{id:'length',label:'Length',type:'number',defaultValue:'60',unit:'cm',min:0},{id:'width',label:'Width',type:'number',defaultValue:'40',unit:'cm',min:0},{id:'height',label:'Height',type:'number',defaultValue:'30',unit:'cm',min:0}],
    calculate:(v)=>{const cm3=N(v,'length')*N(v,'width')*N(v,'height');return[result('Volume',`${number(cm3/1_000_000,6)} m³`),result('Volume',`${number(cm3/1000,3)} L`),result('Cubic centimeters',`${number(cm3,0)} cm³`)];},
  },
  {
    id:'concrete-calculator', inputs:[{id:'length',label:'Slab length',type:'number',defaultValue:'5',unit:'m',min:0},{id:'width',label:'Slab width',type:'number',defaultValue:'3',unit:'m',min:0},{id:'depth',label:'Depth',type:'number',defaultValue:'12',unit:'cm',min:0},{id:'waste',label:'Waste allowance',type:'number',defaultValue:'8',unit:'%',min:0}],
    calculate:(v)=>{const base=N(v,'length')*N(v,'width')*N(v,'depth')/100;const total=base*(1+N(v,'waste')/100);return[result('Base concrete volume',`${number(base,3)} m³`),result('Order volume incl. waste',`${number(total,3)} m³`)];},
  },

  {
    id:'bmi-calculator', inputs:[{id:'weight',label:'Weight',type:'number',defaultValue:'75',unit:'kg',min:0},{id:'height',label:'Height',type:'number',defaultValue:'180',unit:'cm',min:0}],
    calculate:(v)=>{const value=bmi(N(v,'weight'),N(v,'height'));if(!Number.isFinite(value))throw new Error('Enter a valid height and weight.');const category=value<18.5?'Below standard adult BMI range':value<25?'Within standard adult BMI range':value<30?'Above standard adult BMI range':'Well above standard adult BMI range';return[result('BMI',number(value,1)),result('General adult screening range',category)];},
    notice:'BMI is a population-level screening measure, not a diagnosis. It does not directly measure body fat or individual health.',
  },
  {
    id:'bmr-calculator', inputs:[{id:'sex',label:'Sex used by equation',type:'select',defaultValue:'male',options:[{value:'male',label:'Male equation constant'},{value:'female',label:'Female equation constant'}]},{id:'age',label:'Age',type:'number',defaultValue:'30',unit:'years',min:1},{id:'weight',label:'Weight',type:'number',defaultValue:'75',unit:'kg',min:0},{id:'height',label:'Height',type:'number',defaultValue:'180',unit:'cm',min:0}],
    calculate:(v)=>[result('Estimated BMR',`${number(mifflinStJeor(N(v,'weight'),N(v,'height'),N(v,'age'),S(v,'sex')==='female'?'female':'male'),0)} kcal/day`)],
    notice:'Estimate from the Mifflin–St Jeor equation; individual energy needs can differ substantially.',
  },
  {
    id:'tdee-calculator', inputs:[{id:'sex',label:'Sex used by equation',type:'select',defaultValue:'male',options:[{value:'male',label:'Male equation constant'},{value:'female',label:'Female equation constant'}]},{id:'age',label:'Age',type:'number',defaultValue:'30',unit:'years',min:1},{id:'weight',label:'Weight',type:'number',defaultValue:'75',unit:'kg',min:0},{id:'height',label:'Height',type:'number',defaultValue:'180',unit:'cm',min:0},{id:'activity',label:'Activity level',type:'select',defaultValue:'1.55',options:activityOptions}],
    calculate:(v)=>{const bmrValue=mifflinStJeor(N(v,'weight'),N(v,'height'),N(v,'age'),S(v,'sex')==='female'?'female':'male');const tdee=bmrValue*N(v,'activity',1.2);return[result('Estimated BMR',`${number(bmrValue,0)} kcal/day`),result('Estimated TDEE',`${number(tdee,0)} kcal/day`)];},
    notice:'General estimate only. Activity multipliers are coarse and are not a medical or nutrition prescription.',
  },
  {
    id:'running-pace-calculator', inputs:[{id:'distance',label:'Distance',type:'number',defaultValue:'10',unit:'km',min:0},{id:'minutes',label:'Elapsed time',type:'number',defaultValue:'50',unit:'minutes',min:0}],
    calculate:(v)=>{const d=requirePositive(N(v,'distance'),'Distance');const minutes=requirePositive(N(v,'minutes'),'Elapsed time');const pace=minutes/d;const whole=Math.floor(pace);const seconds=Math.round((pace-whole)*60);const speed=d/(minutes/60);return[result('Pace',`${whole}:${String(seconds).padStart(2,'0')} min/km`),result('Average speed',`${number(speed,2)} km/h`),result('Equivalent 5 km time',formatDurationMinutes(pace*5)),result('Equivalent half-marathon time',formatDurationMinutes(pace*21.0975))];},
    notice:'Equivalent times assume the same pace over the other distance; they are not race-performance predictions.',
  },
  {
    id:'body-fat-calculator', inputs:[{id:'sex',label:'Method',type:'select',defaultValue:'male',options:[{value:'male',label:'Male Navy equation'},{value:'female',label:'Female Navy equation'}]},{id:'height',label:'Height',type:'number',defaultValue:'180',unit:'cm',min:0},{id:'waist',label:'Waist circumference',type:'number',defaultValue:'85',unit:'cm',min:0},{id:'neck',label:'Neck circumference',type:'number',defaultValue:'38',unit:'cm',min:0},{id:'hip',label:'Hip circumference (used for female equation)',type:'number',defaultValue:'95',unit:'cm',min:0}],
    calculate:(v)=>{const value=navyBodyFatPercent(S(v,'sex')==='female'?'female':'male',N(v,'height'),N(v,'waist'),N(v,'neck'),N(v,'hip'));if(!Number.isFinite(value))throw new Error('Measurements are not valid for the selected formula.');return[result('Estimated body fat',pct(value))];},
    notice:'Circumference-based estimate only. Measurement technique and individual body composition can materially change the result.',
  },
  {
    id:'one-rep-max-calculator', inputs:[{id:'weight',label:'Weight lifted',type:'number',defaultValue:'80',unit:'kg',min:0},{id:'reps',label:'Repetitions',type:'number',defaultValue:'8',min:1,max:36,step:1}],
    calculate:(v)=>{const estimate=oneRepMax(N(v,'weight'),N(v,'reps'));return[result('Blended estimate',`${number(estimate.average,1)} kg`),result('Epley',`${number(estimate.epley,1)} kg`),result('Brzycki',`${number(estimate.brzycki,1)} kg`)];},
    notice:'1RM formulas are estimates. Accuracy generally falls as repetition count rises and varies by exercise and athlete.',
  },
];

function awaitGcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

function formatDurationMinutes(minutes: number): string {
  const totalSeconds = Math.round(Math.max(0, minutes) * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return hours > 0 ? `${hours}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}` : `${mins}:${String(secs).padStart(2,'0')}`;
}

export function getCalculatorDefinition(id: string | null | undefined): CalculatorDefinition | undefined {
  return id ? CALCULATOR_DEFINITIONS.find((definition) => definition.id === id) : undefined;
}

export function createDefaultCalculatorValues(definition: CalculatorDefinition): Record<string, string> {
  return Object.fromEntries(definition.inputs.map((input) => [input.id, input.defaultValue]));
}
