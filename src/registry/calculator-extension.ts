import{lazy}from'react';
import{PUBLIC_CALCULATOR_TASKS}from'../calculators/publicCalculatorTasks';
import{ensureCategory,registerFamily}from'./register-family';
const CalculatorSuiteTool=lazy(()=>import('../tools/calculator-suite/CalculatorSuiteTool'));
export function registerCalculatorTools():void{ensureCategory('calculator','Everyday Calculators','School, money, household, travel, construction, and general fitness calculation helpers','time');registerFamily(PUBLIC_CALCULATOR_TASKS,'calculator','Percent',CalculatorSuiteTool,t=>t.id==='salary-hourly-calculator'?{description:'Convert annual salary to hourly wage or hourly wage to annual, monthly, weekly, and daily equivalents in either direction.',keywords:[...t.keywords,'annual to hourly','hourly to annual','hourly wage to salary',t.group,'calculator']}:{keywords:[...t.keywords,t.group,'calculator']})}
