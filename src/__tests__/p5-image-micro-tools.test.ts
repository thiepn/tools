import { describe, expect, it } from 'vitest';
import { PUBLIC_IMAGE_TASKS } from '../image/publicImageTasks';
import { registerPdfPublicTools } from '../registry/pdf-extension';
import { registerDeviceDiagnosticTools } from '../registry/device-extension';
import { registerCalculatorTools } from '../registry/calculator-extension';
import { registerFileConversionTools } from '../registry/file-conversion-extension';
import { registerImageMicroTools } from '../registry/image-micro-extension';
import { TOOLS_REGISTRY } from '../registry/tools';
import {
  SOCIAL_IMAGE_PRESETS,
  buildIcoFromPng,
  centerCropForAspect,
  contactSheetLayout,
  coverCrop,
  gridRegions,
  metadataPrivacySummary,
  parseJpegExif,
  safeImageBaseName,
} from '../utilities/image-micro-tools';

registerPdfPublicTools();registerDeviceDiagnosticTools();registerCalculatorTools();registerFileConversionTools();registerImageMicroTools();

describe('P5 public image catalog',()=>{
  it('contains exactly 23 unique image micro-routes',()=>{expect(PUBLIC_IMAGE_TASKS).toHaveLength(23);expect(new Set(PUBLIC_IMAGE_TASKS.map(t=>t.id)).size).toBe(23);for(const task of PUBLIC_IMAGE_TASKS)expect(TOOLS_REGISTRY.some(t=>t.id===task.id&&t.category==='image')).toBe(true);});
  it('keeps browser capability claims truthful',()=>{const heic=PUBLIC_IMAGE_TASKS.find(t=>t.id==='heic-image-converter')!;expect(heic.description).toContain('when the current browser can decode');const upscale=PUBLIC_IMAGE_TASKS.find(t=>t.id==='image-upscaler')!;expect(upscale.description).toContain('high-quality browser resampling');expect(upscale.description).toContain('without claiming AI-generated detail');const privacy=PUBLIC_IMAGE_TASKS.find(t=>t.id==='privacy-blur-image')!;expect(privacy.description).toContain('Manually');});
  it('provides broad social output presets',()=>{expect(SOCIAL_IMAGE_PRESETS.length).toBeGreaterThanOrEqual(8);expect(SOCIAL_IMAGE_PRESETS.some(p=>p.width===1080&&p.height===1920)).toBe(true);expect(SOCIAL_IMAGE_PRESETS.some(p=>p.width===1280&&p.height===720)).toBe(true);});
});

describe('P5 crop and layout math',()=>{
  it('creates centered crops for square, portrait and widescreen targets',()=>{expect(centerCropForAspect(1600,900,1)).toEqual({x:350,y:0,width:900,height:900});const portrait=centerCropForAspect(1200,1600,4/5);expect(portrait.width/portrait.height).toBeCloseTo(.8,8);const wide=centerCropForAspect(1000,1000,16/9);expect(wide.x).toBe(0);expect(wide.height).toBeCloseTo(562.5,8);});
  it('moves a cover crop focus without leaving source bounds',()=>{const left=coverCrop(2000,1000,1000,1000,0,0.5),right=coverCrop(2000,1000,1000,1000,1,0.5);expect(left.x).toBe(0);expect(right.x+right.width).toBeCloseTo(2000,8);});
  it('splits dimensions without gaps or pixel loss',()=>{const regions=gridRegions(1001,799,3,4);expect(regions).toHaveLength(12);const total=regions.reduce((s,r)=>s+r.width*r.height,0);expect(total).toBe(1001*799);expect(Math.max(...regions.map(r=>r.x+r.width))).toBe(1001);expect(Math.max(...regions.map(r=>r.y+r.height))).toBe(799);});
  it('calculates bounded contact-sheet layouts',()=>{const layout=contactSheetLayout(10,240,180,4,12,16);expect(layout.columns).toBe(4);expect(layout.rows).toBe(3);expect(layout.width).toBe(1028);expect(layout.height).toBe(596);});
});

describe('P5 file/privacy helpers',()=>{
  it('writes a PNG-backed ICO directory entry correctly',()=>{const png=new Uint8Array([0x89,0x50,0x4e,0x47,1,2,3]);const ico=buildIcoFromPng(png,256,256),view=new DataView(ico.buffer);expect(view.getUint16(2,true)).toBe(1);expect(view.getUint16(4,true)).toBe(1);expect(ico[6]).toBe(0);expect(ico[7]).toBe(0);expect(view.getUint32(14,true)).toBe(png.length);expect(view.getUint32(18,true)).toBe(22);expect([...ico.slice(22)]).toEqual([...png]);});
  it('does not invent EXIF data for arbitrary bytes',()=>{const meta=parseJpegExif(new Uint8Array([1,2,3,4]));expect(meta.gpsPresent).toBe(false);expect(meta.fields).toEqual({});expect(metadataPrivacySummary(meta)).toEqual(['No common privacy-sensitive JPEG EXIF fields were detected.']);});
  it('sanitizes output base filenames',()=>{expect(safeImageBaseName('my:photo?.JPG')).toBe('my-photo-');expect(safeImageBaseName('.png')).toBe('image');});
});
