import type{ToolCategory}from'../types';
export type P15Engine='graph'|'statistics'|'data';
export interface PublicP15Task{id:string;name:string;shortName:string;description:string;keywords:string[];engine:P15Engine;category:ToolCategory}
type Raw=[string,string,string,string,string,P15Engine,ToolCategory];
const RAW:Raw[]=[
['function-graph-plotter','Function Graph Plotter','Function Plotter','Plot mathematical functions of x on a local SVG coordinate plane using a bounded expression parser.','function graph|plot equation|graph y|math plot','graph','math'],
['polynomial-graph-explorer','Polynomial Graph & Roots Explorer','Polynomial Graph','Plot a polynomial from coefficients and estimate real roots within the selected x-range locally.','polynomial graph|polynomial roots|plot polynomial','graph','math'],
['linear-system-solver','System of Linear Equations Solver','Linear System Solver','Solve augmented linear systems with local Gauss-Jordan elimination and classify unique, infinite, or inconsistent systems.','linear equations|system solver|gauss jordan|rref','statistics','math'],
['binomial-distribution-calculator','Binomial Distribution Calculator','Binomial Distribution','Calculate exact binomial point and interval probabilities locally.','binomial distribution|binomial probability|bernoulli trials','statistics','math'],
['poisson-distribution-calculator','Poisson Distribution Calculator','Poisson Distribution','Calculate Poisson point and interval probabilities for a supplied event rate locally.','poisson distribution|poisson probability|event rate','statistics','math'],
['confidence-interval-calculator','Confidence Interval Calculator','Confidence Interval','Calculate t-based mean intervals or Wilson proportion intervals from supplied sample data.','confidence interval|mean interval|proportion interval|wilson','statistics','math'],
['sample-size-calculator','Sample Size Calculator','Sample Size','Estimate sample size for a proportion or mean from confidence level and margin-of-error inputs.','sample size|margin of error|survey sample|power planning','statistics','math'],
['t-test-calculator','t-Test Calculator','t-Test','Run a one-sample or Welch two-sample t-test locally and report the two-sided p-value with assumptions.','t test|welch test|one sample t|two sample t','statistics','math'],
['chi-square-test-calculator','Chi-Square Test Calculator','Chi-Square Test','Run chi-square goodness-of-fit or independence tests locally from supplied frequency data.','chi square|goodness of fit|independence test|contingency table','statistics','math'],
['descriptive-statistics-box-plot','Descriptive Statistics & Box Plot','Statistics & Box Plot','Summarize numeric data with center, spread, quartiles, and a local SVG box plot.','descriptive statistics|box plot|quartiles|median|standard deviation','data','math'],
['histogram-generator','Histogram Generator','Histogram','Turn pasted numeric values into configurable local histogram bins and an SVG frequency chart.','histogram|frequency distribution|data bins|distribution chart','data','math'],
['scatter-plot-generator','Scatter Plot & Correlation','Scatter Plot','Plot paired numeric observations locally and report Pearson correlation plus a fitted least-squares line.','scatter plot|correlation|regression plot|xy chart','data','math'],
['csv-data-plotter','CSV Data Plotter','CSV Plotter','Plot two numeric columns from pasted CSV as a local line or scatter chart without uploading the data.','csv chart|csv plot|data visualization|line chart|scatter chart','data','math'],
];
export const PUBLIC_P15_TASKS:PublicP15Task[]=RAW.map(([id,name,shortName,description,keys,engine,category])=>({id,name,shortName,description,keywords:keys.split('|'),engine,category}));
export function getPublicP15Task(id:string|null|undefined){return id?PUBLIC_P15_TASKS.find(t=>t.id===id):undefined}
