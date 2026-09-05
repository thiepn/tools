import{describe,expect,it}from'vitest';
import{STRICT_B_TO_S_TARGETS}from'../strict-b-to-s/manifest';
import{STRICT_B_PROFILES,getStrictBProfile}from'../strict-b-to-s/profiles';
import{getCalculatorProSpec,CALCULATOR_PRO_IDS}from'../strict-b-to-s/calculatorSpecs';
import{analyzeDocumentTime,analyzeMathData,analyzeMedia,analyzePlanning,analyzeRestoration,analyzeSecurityDev,analyzeSubtitle,analyzeTextStudy,analyzeVisual}from'../strict-b-to-s/analysisEngines';
import{registerAllPublicTools}from'../registry/register-all';
import{TOOLS_REGISTRY}from'../registry/tools';
registerAllPublicTools();

describe('R16 strict B to S uplift',()=>{
 it('binds exactly the 198 routes from the strict B rerank',()=>{expect(STRICT_B_TO_S_TARGETS).toHaveLength(198);expect(new Set(STRICT_B_TO_S_TARGETS).size).toBe(198)});
 it('assigns one specialist family to every route',()=>{expect(STRICT_B_PROFILES).toHaveLength(198);for(const id of STRICT_B_TO_S_TARGETS){const p=getStrictBProfile(id);expect(p,id).toBeTruthy();expect(p?.label.length,id).toBeGreaterThan(10);expect(p?.focus,id).toContain('specialist workflow')}});
 it('keeps every route registered and marks specialist core without changing catalog size',()=>{expect(TOOLS_REGISTRY).toHaveLength(351);for(const id of STRICT_B_TO_S_TARGETS){const tool=TOOLS_REGISTRY.find(x=>x.id===id);expect(tool,id).toBeTruthy();expect(tool?.keywords,id).toContain('r16 specialist core');expect(tool?.description,id).toMatch(/route-specific/i)}});
 it('covers every strict-B calculator with a precision scenario model',()=>{const calc=STRICT_B_PROFILES.filter(p=>p.family==='calculator');expect(calc).toHaveLength(31);expect(CALCULATOR_PRO_IDS.size).toBe(31);for(const p of calc){const spec=getCalculatorProSpec(p.id);expect(spec,p.id).toBeTruthy();const defaults=Object.fromEntries(spec!.inputs.map(x=>[x.id,x.defaultValue]));const out=spec!.evaluate(defaults);expect(out.length,p.id).toBeGreaterThanOrEqual(4)}});
 it('adds route-specific text and developer analysis',()=>{expect(analyzeTextStudy('ngram-analyzer','one two one two one',2).find(x=>x.label==='Repeated n-grams')?.value).toBe('2');expect(analyzeSecurityDev('uuid-generator','550e8400-e29b-41d4-a716-446655440000','')[0].value).toBe('Yes');expect(analyzeSecurityDev('query-string-tool','?a=1&a=2','').find(x=>x.label==='Repeated keys')?.value).toBe('1')});
 it('adds production visual and media planning',()=>{expect(analyzeVisual('favicon-maker',512,512,20).find(x=>x.label==='Square padding needed')?.value).toBe('0 px');expect(analyzeMedia('video-speed-changer',120,10,40,2).find(x=>x.label==='Result duration')?.value).toBe('15 s')});
 it('adds statistical and subtitle verification',()=>{expect(analyzeMathData('quadratic-solver',1,-3,2,10).find(x=>x.label==='Root type')?.value).toBe('Two real');expect(analyzeSubtitle('subtitle-cleaner-validator','1\n00:00:01,000 --> 00:00:02,000\nHi\n',25).find(x=>x.label==='Cues detected')?.value).toBe('1')});
 it('adds document, restoration and planning QA',()=>{expect(analyzeDocumentTime('checklist','- [x] A\n- [ ] B',1,1).find(x=>x.label==='Completion')?.value).toBe('50%');expect(analyzeRestoration('auto-deskew-image',3000,2000,20).find(x=>x.label==='Search range')?.value).toContain('±');expect(analyzePlanning('eisenhower-matrix','A\nB\nC',2,2).find(x=>x.label==='Tasks')?.value).toBe('3')});
});
