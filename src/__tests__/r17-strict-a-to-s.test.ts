import{describe,expect,it}from'vitest';
import{STRICT_A_TO_S_TARGETS}from'../strict-a-to-s/manifest';
import{STRICT_A_PROFILES}from'../strict-a-to-s/profiles';
import{ROUTE_GATE,analyzeStrictA,getStrictAInputSpec}from'../strict-a-to-s/analysis';
import{registerAllPublicTools}from'../registry/register-all';
import{TOOLS_REGISTRY}from'../registry/tools';
registerAllPublicTools();

describe('R17 strict A-to-S uplift',()=>{
 it('binds exactly the 95 routes from the strict rerank',()=>{expect(STRICT_A_TO_S_TARGETS).toHaveLength(95);expect(new Set(STRICT_A_TO_S_TARGETS).size).toBe(95);expect(STRICT_A_PROFILES).toHaveLength(95);for(const id of STRICT_A_TO_S_TARGETS){const tool=TOOLS_REGISTRY.find(row=>row.id===id);expect(tool,id).toBeTruthy();expect(tool?.keywords,id).toContain('r17 strict a-to-s core');expect(ROUTE_GATE[id].length,id).toBeGreaterThan(45)}});
 it('keeps the public catalog exactly at 351 routes',()=>expect(TOOLS_REGISTRY).toHaveLength(351));
 it('assigns every target to one specialist family',()=>{for(const profile of STRICT_A_PROFILES)expect(profile.family,profile.id).toMatch(/content-code|security|productivity|capture-media|pdf|device|calculation|file-view|subtitle/)});
 it('produces validation-safe specialist evidence for every target',()=>{for(const id of STRICT_A_TO_S_TARGETS){const s=getStrictAInputSpec(id),metrics=analyzeStrictA(id,{text:s.textDefault,a:s.aDefault,b:s.bDefault,c:s.cDefault});expect(metrics.length,id).toBeGreaterThanOrEqual(8);const output=metrics.map(x=>`${x.label}: ${x.value}`).join('\n');expect(output,id).not.toMatch(/\b(?:NaN|undefined|\[object Object\])\b/);expect(metrics.some(x=>x.label==='S-tier acceptance gate'),id).toBe(true);expect(metrics.some(x=>x.label==='Input state fingerprint'),id).toBe(true)}});
 it('stress-tests all targets with empty and non-finite-like UI states safely',()=>{for(const id of STRICT_A_TO_S_TARGETS){const metrics=analyzeStrictA(id,{text:'',a:Number.NaN,b:Number.POSITIVE_INFINITY,c:Number.NEGATIVE_INFINITY});const output=metrics.map(x=>String(x.value)).join(' ');expect(output,id).not.toMatch(/\b(?:NaN|undefined|Infinity)\b/)}});
 it('adds auditable finance sensitivity rather than a single answer',()=>{const loan=analyzeStrictA('loan-calculator',{text:'test',a:250000,b:4.5,c:30});expect(loan.find(x=>x.label==='Monthly payment')).toBeTruthy();expect(loan.find(x=>x.label==='Rate sensitivity')).toBeTruthy();const card=analyzeStrictA('credit-card-payoff-calculator',{text:'test',a:6000,b:21.9,c:50});expect(card.find(x=>x.label==='Payoff status')?.value).toBe('Negative amortization')});
 it('adds numerical stability checks to matrix/system tools',()=>{const matrix=analyzeStrictA('matrix-calculator',{text:'m',a:4,b:1,c:3});expect(matrix.find(x=>x.label==='Determinant')?.value).toBe('11');expect(matrix.find(x=>x.label==='Invertibility')?.value).toBe('Invertible');const system=analyzeStrictA('linear-system-solver',{text:'s',a:1,b:1,c:8});expect(system.find(x=>x.label==='Singularity check')?.value).toMatch(/Singular/)});
 it('keeps security and viewer labs explicitly local-first',()=>{expect(analyzeStrictA('secure-generator',{text:'abc',a:128,b:32,c:1}).find(x=>x.label==='Automatic network use')?.value).toBe('None from R17 core');expect(analyzeStrictA('document-viewer',{text:'doc',a:10,b:100,c:2}).find(x=>x.label==='Local-only inspection')?.value).toBe('Yes')});
});
