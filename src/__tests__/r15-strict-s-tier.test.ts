import{describe,expect,it}from'vitest';
import{STRICT_S_TIER_TARGETS}from'../strict-s-tier/manifest';
import{registerAllPublicTools}from'../registry/register-all';
import{TOOLS_REGISTRY}from'../registry/tools';
import{
 analyzeHabit,boxMetrics,buildReadingPlan,calculateTip,convertCurrency,evaluateCalculatorExpression,extractTar,flooringEstimate,generateLorem,numberToEnglishWords,packTar,paintEstimate,repeatTextStrict,reverseTextStrict,simpleInterestSchedule,splitBillItemized,summarizeNumbers,summarizeRooms,summarizeTimestamps,tileEstimate,validatePwaManifest
}from'../utilities/strict-s-tier';

registerAllPublicTools();

describe('R15 strict C/D to S uplift',()=>{
 it('binds exactly the 32 routes from the strict C/D rerank',()=>{
  expect(STRICT_S_TIER_TARGETS).toHaveLength(32);
  expect(new Set(STRICT_S_TIER_TARGETS).size).toBe(32);
  for(const id of STRICT_S_TIER_TARGETS){const tool=TOOLS_REGISTRY.find(row=>row.id===id);expect(tool,id).toBeTruthy();expect(tool?.keywords).toContain('strict s-tier core upgrade');expect(tool?.description.length).toBeGreaterThan(60)}
 });
 it('keeps the public catalog at 351 routes',()=>expect(TOOLS_REGISTRY).toHaveLength(351));

 it('evaluates calculator expressions without eval',()=>{
  expect(evaluateCalculatorExpression('sqrt(144) + 3^4 / 9')).toBe(21);
  expect(evaluateCalculatorExpression('2 * (3 + 4)')).toBe(14);
  expect(()=>evaluateCalculatorExpression('1/0')).toThrow(/Division by zero/);
 });
 it('produces deep average statistics',()=>{const r=summarizeNumbers([1,2,3,4,5]);expect(r.mean).toBe(3);expect(r.median).toBe(3);expect(r.q1).toBe(2);expect(r.q3).toBe(4);expect(r.populationStdDev).toBeGreaterThan(1)});
 it('summarizes timing cadence robustly',()=>{const r=summarizeTimestamps([0,10,20,30,40,50]);expect(r.estimatedHz).toBe(100);expect(r.stabilityPercent).toBe(100)});
 it('models tips and itemized bill allocation',()=>{const tip=calculateTip({subtotal:100,tipPercent:20,taxPercent:10,people:2});expect(tip.total).toBe(130);expect(tip.perPerson).toBe(65);const split=splitBillItemized([{amount:30,participants:['A','B']},{amount:10,participants:['A']}],['A','B'],10,20);expect(split.find(row=>row.name==='A')?.subtotal).toBe(25);expect(split.find(row=>row.name==='B')?.subtotal).toBe(15)});
 it('builds simple-interest schedules and project estimates',()=>{const interest=simpleInterestSchedule(1000,10,2,12);expect(interest.interest).toBe(200);expect(interest.schedule).toHaveLength(24);expect(summarizeRooms([{kind:'rectangle',width:4,length:5}],10).purchaseArea).toBe(22);expect(paintEstimate({wallArea:100,openingArea:10,coats:2,coveragePerUnit:10,containerSizes:[5]}).containers).toBe(4);expect(flooringEstimate({area:10,wastePercent:10,packCoverage:2}).packs).toBe(6);expect(tileEstimate({area:1,tileWidth:.5,tileHeight:.5,tilesPerBox:4}).boxes).toBe(1);expect(boxMetrics(10,20,30,5000).volume).toBe(6000)});
 it('packs and extracts ordinary USTAR members',()=>{const source=[{name:'a.txt',bytes:new TextEncoder().encode('alpha'),mtime:0},{name:'b.txt',bytes:new TextEncoder().encode('beta'),mtime:0}];const tar=packTar(source);const out=extractTar(tar);expect(out.map(row=>row.name)).toEqual(['a.txt','b.txt']);expect(new TextDecoder().decode(out[1].bytes)).toBe('beta')});
 it('uses Unicode-safe and bounded text transforms',()=>{expect(reverseTextStrict('A👩‍🚀B','graphemes')).toBe('B👩‍🚀A');const repeated=repeatTextStrict('x',3,'\n',{numberLines:true});expect(repeated.output).toBe('1. x\n2. x\n3. x');expect(()=>repeatTextStrict('x',Number.NaN,'')).toThrow()});
 it('generates deterministic lorem and exact reading plans',()=>{const a=generateLorem({seed:42,paragraphs:2,sentencesPerParagraph:2,wordsPerSentence:5,format:'plain'}),b=generateLorem({seed:42,paragraphs:2,sentencesPerParagraph:2,wordsPerSentence:5,format:'plain'});expect(a).toBe(b);const plan=buildReadingPlan({totalUnits:100,startDate:'2026-09-01',endDate:'2026-09-10',restWeekdays:[0]});expect(plan.at(-1)?.cumulative).toBe(100);expect(plan.reduce((sum,row)=>sum+row.amount,0)).toBe(100)});
 it('handles number words, ordinal/currency modes, and habit analytics',()=>{expect(numberToEnglishWords('42')).toBe('forty-two');expect(numberToEnglishWords('21',{ordinal:true})).toBe('twenty-first');expect(numberToEnglishWords('12.50',{currency:'EUR'})).toContain('euros');const habit=analyzeHabit([{date:'2026-09-01',status:'done'},{date:'2026-09-02',status:'partial'},{date:'2026-09-03',status:'missed'}],[2,3,4]);expect(habit.completedEquivalent).toBe(1.5);expect(habit.adherencePercent).toBe(50)});
 it('returns friendly PWA validation instead of raw undefined errors',()=>{const missing=validatePwaManifest({display:'standalone'});expect(missing.errors).toContain('App name is required.');expect(()=>validatePwaManifest({display:'standalone'})).not.toThrow();const good=validatePwaManifest({name:'Tiny Tools',short_name:'Tools',display:'standalone',icons:[{src:'icon.png',sizes:'192x192'}]});expect(good.errors).toEqual([]);expect(good.manifest.name).toBe('Tiny Tools')});
 it('converts cached currency tables without network access',()=>{const table={base:'EUR',date:'2026-09-01',fetchedAt:'2026-09-01T10:00:00Z',provider:'test',rates:{USD:1.2,GBP:.8}};expect(convertCurrency(100,'EUR','USD',table)).toBe(120);expect(convertCurrency(120,'USD','EUR',table)).toBe(100);expect(convertCurrency(120,'USD','GBP',table)).toBe(80)});
});
