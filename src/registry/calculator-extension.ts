import{lazy}from'react';
import{PUBLIC_CALCULATOR_TASKS}from'../calculators/publicCalculatorTasks';
import{ensureCategory,registerFamily}from'./register-family';
const CalculatorSuiteTool=lazy(()=>import('../tools/calculator-suite/CalculatorSuiteTool'));
const FitnessHealthCalculators=lazy(()=>import('../tools/s-tier-fitness/FitnessHealthCalculators'));
const FITNESS=new Set(['bmi-calculator','bmr-calculator','tdee-calculator','body-fat-calculator']);
const FITNESS_METADATA:Record<string,{description:string;keywords:string[]}>= {
'bmi-calculator':{description:'Calculate adult BMI with metric or imperial inputs, BMI-band weight ranges at your height, and clear screening limitations.',keywords:['BMI','body mass index','healthy weight range','BMI chart','metric imperial BMI']},
'bmr-calculator':{description:'Compare Mifflin–St Jeor, revised Harris–Benedict, and optional Katch–McArdle resting-energy estimates with formula spread.',keywords:['BMR','basal metabolic rate','Mifflin St Jeor','Harris Benedict','Katch McArdle','resting calories']},
'tdee-calculator':{description:'Estimate maintenance energy from a multi-formula BMR baseline and activity factor, with weekly totals and an explicit uncertainty band.',keywords:['TDEE','maintenance calories','daily energy expenditure','activity multiplier','calorie maintenance']},
'body-fat-calculator':{description:'Estimate body-fat percentage with the U.S. Navy circumference method, metric or imperial measurements, fat/lean mass, and measurement guidance.',keywords:['body fat','Navy body fat','body composition','waist neck hip','lean mass','fat mass']},
};
export function registerCalculatorTools():void{
 ensureCategory('calculator','Everyday Calculators','School, money, household, travel, construction, and general fitness calculation helpers','time');
 registerFamily(PUBLIC_CALCULATOR_TASKS,'calculator','Percent',CalculatorSuiteTool,t=>{
  if(FITNESS.has(t.id)){const meta=FITNESS_METADATA[t.id];return{component:FitnessHealthCalculators,description:meta.description,keywords:[...t.keywords,...meta.keywords,t.group,'calculator'],featured:true};}
  if(t.id==='salary-hourly-calculator')return{description:'Convert annual salary to hourly wage or hourly wage to annual, monthly, weekly, and daily equivalents in either direction.',keywords:[...t.keywords,'annual to hourly','hourly to annual','hourly wage to salary',t.group,'calculator']};
  return{keywords:[...t.keywords,t.group,'calculator']};
 });
}
