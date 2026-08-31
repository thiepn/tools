import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CATEGORIES, TOOLS_REGISTRY } from '../registry/tools';
import { registerPdfPublicTools } from '../registry/pdf-extension';
import { registerDeviceDiagnosticTools } from '../registry/device-extension';
import { registerCalculatorTools } from '../registry/calculator-extension';
import { registerFileConversionTools } from '../registry/file-conversion-extension';
import { registerImageMicroTools } from '../registry/image-micro-extension';
import { searchTools } from '../registry/search';
import { CATEGORY_ORDER, getCategoryPresentation } from '../registry/category-presentation';
import { getStoredPreferences, recordRecentTool, toggleFavorite } from '../storage/preferences';

registerPdfPublicTools();
registerDeviceDiagnosticTools();
registerCalculatorTools();
registerFileConversionTools();
registerImageMicroTools();

describe('R2 catalog information architecture', () => {
  it('covers every registered category exactly once in the discovery order', () => { const registered=CATEGORIES.map(c=>c.id);expect(CATEGORY_ORDER).toHaveLength(registered.length);expect(new Set(CATEGORY_ORDER).size).toBe(registered.length);for(const id of registered)expect(CATEGORY_ORDER).toContain(id); });
  it('keeps general-use discovery ahead of developer utilities', () => { expect(CATEGORY_ORDER[0]).toBe('productivity');expect(CATEGORY_ORDER[1]).toBe('pdf');expect(CATEGORY_ORDER.indexOf('image')).toBeLessThan(CATEGORY_ORDER.indexOf('developer'));expect(CATEGORY_ORDER.indexOf('files')).toBeLessThan(CATEGORY_ORDER.indexOf('developer'));expect(CATEGORY_ORDER.indexOf('device')).toBeLessThan(CATEGORY_ORDER.indexOf('developer'));expect(CATEGORY_ORDER.indexOf('calculator')).toBeLessThan(CATEGORY_ORDER.indexOf('developer'));expect(CATEGORY_ORDER.at(-1)).toBe('developer'); });
  it('provides complete presentation metadata for every category', () => { for(const category of CATEGORIES){const p=getCategoryPresentation(category.id);expect(p.label).toBeTruthy();expect(p.shortLabel).toBeTruthy();expect(p.description).toBeTruthy();expect(p.searchTerms.length).toBeGreaterThan(0);expect(p.badge.bg).toBeTruthy();expect(p.badge.text).toBeTruthy();expect(p.badge.border).toBeTruthy();} });
});

describe('R2 ranked tool discovery', () => {
  it('ranks an exact tool name ahead of partial matches', () => {expect(searchTools('unit converter')[0]?.id).toBe('unit-converter');expect(searchTools('mortgage calculator')[0]?.id).toBe('mortgage-calculator');expect(searchTools('csv to excel')[0]?.id).toBe('csv-to-xlsx');expect(searchTools('crop image')[0]?.id).toBe('crop-image');});
  it('supports multi-word task searches instead of only phrase substrings', () => {expect(searchTools('resize image')[0]?.id).toBe('social-media-image-resizer');expect(searchTools('fuel trip cost')[0]?.id).toBe('fuel-trip-cost-calculator');expect(searchTools('convert json csv')[0]?.id).toBe('json-to-csv');expect(searchTools('photo exif remove')[0]?.id).toBe('image-metadata-cleaner');});
  it('uses category vocabulary and everyday synonyms in discovery', () => {expect(searchTools('photos').some(t=>t.category==='image')).toBe(true);expect(searchTools('office').some(t=>t.category==='productivity')).toBe(true);expect(searchTools('pdf').length).toBeGreaterThan(10);const diagnostic=searchTools('hardware diagnostics');expect(diagnostic.length).toBeGreaterThan(5);expect(diagnostic.every(t=>t.category==='device')).toBe(true);expect(searchTools('calculator').filter(t=>t.category==='calculator').length).toBeGreaterThan(40);expect(searchTools('file converter').filter(t=>t.category==='files').length).toBeGreaterThan(10);expect(searchTools('photo tools').filter(t=>t.category==='image').length).toBeGreaterThan(15);});
  it('respects category filtering while preserving ranked matches', () => {const images=searchTools('', 'image');expect(images.length).toBeGreaterThanOrEqual(23);expect(images.every(t=>t.category==='image')).toBe(true);expect(searchTools('pdf','pdf')).toHaveLength(20);expect(searchTools('','device')).toHaveLength(16);expect(searchTools('','calculator')).toHaveLength(46);expect(searchTools('','files')).toHaveLength(21);});
  it('finds task-oriented queries across names, descriptions, and keywords', () => {expect(searchTools('scan document')[0]?.id).toBe('document-scanner');expect(searchTools('make qr code')[0]?.id).toBe('qr-studio');expect(searchTools('remove background')[0]?.id).toBe('background-remover');expect(searchTools('merge pdf')[0]?.id).toBe('merge-pdf');expect(searchTools('mouse polling rate')[0]?.id).toBe('polling-rate-test');expect(searchTools('guitar tuner')[0]?.id).toBe('instrument-tuner');expect(searchTools('loan monthly payment')[0]?.id).toBe('loan-calculator');expect(searchTools('excel to csv')[0]?.id).toBe('xlsx-to-csv');expect(searchTools('merge csv')[0]?.id).toBe('csv-merger');expect(searchTools('instagram story resize')[0]?.id).toBe('social-media-image-resizer');expect(searchTools('blur license plate')[0]?.id).toBe('privacy-blur-image');expect(searchTools('png to ico')[0]?.id).toBe('favicon-maker');});
  it('returns the unfiltered registry order for an empty query', () => {expect(searchTools('').map(t=>t.id)).toEqual(TOOLS_REGISTRY.map(t=>t.id));});
});

describe('R2 preference defaults and isolation', () => {
  const PREFERENCES_KEY='tiny_tools_preferences_v1';const originalWindow=globalThis.window;let storageStore:Record<string,string>={};
  beforeEach(()=>{storageStore={};const mockStorage={getItem:(key:string)=>storageStore[key]||null,setItem:(key:string,value:string)=>{storageStore[key]=value;},removeItem:(key:string)=>{delete storageStore[key];},clear:()=>{storageStore={};},length:0,key:()=>null};(globalThis as unknown as {window:unknown}).window={localStorage:mockStorage};});
  afterEach(()=>{storageStore={};(globalThis as unknown as {window:Window}).window=originalWindow;});
  it('uses general-purpose favorites for a fresh install',()=>{expect(getStoredPreferences().favorites).toEqual(['text-cleaner','image-optimizer','qr-studio']);});
  it('returns fresh default arrays instead of a shared mutable singleton',()=>{const first=getStoredPreferences();first.favorites.push('mutated-only-in-memory');expect(getStoredPreferences().favorites).not.toContain('mutated-only-in-memory');});
  it('keeps favorite and recent writes scoped to preference metadata only',()=>{toggleFavorite('word-counter');recordRecentTool('word-counter');const persisted=JSON.parse(storageStore[PREFERENCES_KEY]);expect(persisted.favorites).toContain('word-counter');expect(persisted.recents).toEqual(['word-counter']);});
});
