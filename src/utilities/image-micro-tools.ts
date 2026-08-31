import type { CropRect, OutputFormat } from './image-optimizer';

export interface ImageRegion { x:number; y:number; width:number; height:number; }
export interface SocialPreset { id:string; label:string; width:number; height:number; }
export interface ExifMetadata { orientation?:number; make?:string; model?:string; dateTime?:string; software?:string; gpsPresent:boolean; fields:Record<string,string|number>; }

export const SOCIAL_IMAGE_PRESETS: SocialPreset[] = [
  {id:'instagram-square',label:'Instagram square',width:1080,height:1080},
  {id:'instagram-portrait',label:'Instagram portrait',width:1080,height:1350},
  {id:'story-reel',label:'Story / Reel',width:1080,height:1920},
  {id:'youtube-thumbnail',label:'YouTube thumbnail',width:1280,height:720},
  {id:'youtube-channel',label:'YouTube channel art',width:2560,height:1440},
  {id:'x-post',label:'X / Twitter post',width:1600,height:900},
  {id:'linkedin-post',label:'LinkedIn post',width:1200,height:627},
  {id:'facebook-cover',label:'Facebook cover',width:1640,height:624},
  {id:'profile-square',label:'Profile picture',width:1080,height:1080},
];

export function clampRegion(region:ImageRegion,w:number,h:number):ImageRegion {
  const x=Math.max(0,Math.min(w-1,Math.round(region.x)));
  const y=Math.max(0,Math.min(h-1,Math.round(region.y)));
  return {x,y,width:Math.max(1,Math.min(w-x,Math.round(region.width))),height:Math.max(1,Math.min(h-y,Math.round(region.height)))};
}

export function centerCropForAspect(width:number,height:number,aspect:number):CropRect {
  if(!(width>0&&height>0&&aspect>0)) throw new Error('Image dimensions and aspect ratio must be positive.');
  const current=width/height;
  if(Math.abs(current-aspect)<1e-9)return{x:0,y:0,width,height};
  if(current>aspect){const cropW=height*aspect;return{x:(width-cropW)/2,y:0,width:cropW,height};}
  const cropH=width/aspect;return{x:0,y:(height-cropH)/2,width,height:cropH};
}

export function coverCrop(width:number,height:number,targetW:number,targetH:number,focusX=.5,focusY=.5):CropRect {
  const base=centerCropForAspect(width,height,targetW/targetH);
  const x=Math.max(0,Math.min(width-base.width,(width-base.width)*Math.max(0,Math.min(1,focusX))));
  const y=Math.max(0,Math.min(height-base.height,(height-base.height)*Math.max(0,Math.min(1,focusY))));
  return{x,y,width:base.width,height:base.height};
}

export function gridRegions(width:number,height:number,rows:number,columns:number):ImageRegion[] {
  const r=Math.max(1,Math.min(20,Math.trunc(rows))),c=Math.max(1,Math.min(20,Math.trunc(columns))),out:ImageRegion[]=[];
  for(let y=0;y<r;y++)for(let x=0;x<c;x++){const x0=Math.round(x*width/c),x1=Math.round((x+1)*width/c),y0=Math.round(y*height/r),y1=Math.round((y+1)*height/r);out.push({x:x0,y:y0,width:x1-x0,height:y1-y0});}
  return out;
}

export function contactSheetLayout(count:number,thumbW:number,thumbH:number,columns:number,gap=12,padding=16,labelHeight=0){
  const c=Math.max(1,Math.min(20,Math.trunc(columns))),rows=Math.max(1,Math.ceil(Math.max(1,count)/c)),g=Math.max(0,Math.round(gap)),p=Math.max(0,Math.round(padding));
  return{columns:c,rows,width:p*2+c*thumbW+(c-1)*g,height:p*2+rows*(thumbH+labelHeight)+(rows-1)*g};
}

export function buildIcoFromPng(png:Uint8Array,width:number,height:number):Uint8Array {
  if(!png.length)throw new Error('PNG data is empty.');
  const w=Math.max(1,Math.min(256,Math.round(width))),h=Math.max(1,Math.min(256,Math.round(height))),out=new Uint8Array(22+png.length),view=new DataView(out.buffer);
  view.setUint16(0,0,true);view.setUint16(2,1,true);view.setUint16(4,1,true);
  out[6]=w===256?0:w;out[7]=h===256?0:h;out[8]=0;out[9]=0;view.setUint16(10,1,true);view.setUint16(12,32,true);view.setUint32(14,png.length,true);view.setUint32(18,22,true);out.set(png,22);return out;
}

function u16(view:DataView,o:number,little:boolean){return view.getUint16(o,little);}function u32(view:DataView,o:number,little:boolean){return view.getUint32(o,little);}
export function parseJpegExif(bytes:Uint8Array):ExifMetadata {
  const empty:ExifMetadata={gpsPresent:false,fields:{}};
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)return empty;
  for(let offset=2;offset+4<bytes.length;){if(bytes[offset]!==0xff){offset++;continue;}const marker=bytes[offset+1];if(marker===0xda||marker===0xd9)break;const length=(bytes[offset+2]<<8)|bytes[offset+3];if(length<2||offset+2+length>bytes.length)break;
    if(marker===0xe1&&length>=10&&String.fromCharCode(...bytes.subarray(offset+4,offset+10))==='Exif\0\0'){
      const start=offset+10,view=new DataView(bytes.buffer,bytes.byteOffset+start,bytes.length-start),little=view.getUint16(0,false)===0x4949;if(!little&&view.getUint16(0,false)!==0x4d4d)return empty;
      const first=u32(view,4,little),fields:Record<string,string|number>={};let gpsPresent=false;
      const readAscii=(pos:number,count:number)=>{if(pos<0||pos+count>view.byteLength)return'';return new TextDecoder().decode(new Uint8Array(view.buffer,view.byteOffset+pos,Math.max(0,count-1))).replace(/\0/g,'').trim();};
      const parseIfd=(ifd:number)=>{if(ifd<0||ifd+2>view.byteLength)return;const count=u16(view,ifd,little);for(let i=0;i<count;i++){const p=ifd+2+i*12;if(p+12>view.byteLength)break;const tag=u16(view,p,little),type=u16(view,p+2,little),n=u32(view,p+4,little),size=type===2?n:type===3?n*2:type===4?n*4:0,valuePos=size>4?u32(view,p+8,little):p+8;let value:string|number|undefined;if(type===2&&n>0)value=readAscii(valuePos,n);else if(type===3&&n===1)value=u16(view,p+8,little);else if(type===4&&n===1)value=u32(view,p+8,little);if(value!==undefined)fields[`0x${tag.toString(16).padStart(4,'0')}`]=value;if(tag===0x8825)gpsPresent=true;}};
      parseIfd(first);
      const get=(tag:number)=>fields[`0x${tag.toString(16).padStart(4,'0')}`];
      return{orientation:typeof get(0x0112)==='number'?get(0x0112) as number:undefined,make:typeof get(0x010f)==='string'?get(0x010f) as string:undefined,model:typeof get(0x0110)==='string'?get(0x0110) as string:undefined,dateTime:typeof get(0x0132)==='string'?get(0x0132) as string:undefined,software:typeof get(0x0131)==='string'?get(0x0131) as string:undefined,gpsPresent,fields};
    }
    offset+=2+length;
  }
  return empty;
}

export function metadataPrivacySummary(metadata:ExifMetadata):string[]{const out:string[]=[];if(metadata.gpsPresent)out.push('GPS location metadata is present.');if(metadata.make||metadata.model)out.push('Camera/device identification metadata is present.');if(metadata.dateTime)out.push('Capture/edit timestamp metadata is present.');if(metadata.software)out.push('Software metadata is present.');return out.length?out:['No common privacy-sensitive JPEG EXIF fields were detected.'];}

export function outputExtension(format:OutputFormat|'image/avif'):string{return format==='image/jpeg'?'jpg':format==='image/png'?'png':format==='image/webp'?'webp':'avif';}
export function safeImageBaseName(name:string):string{return(name.replace(/\.[^/.]+$/,'').trim()||'image').replace(/[\\/:*?"<>|]+/g,'-');}

export function replaceMetadataByReencodeNotice(type:string):string {
  return type==='image/jpeg'?'JPEG EXIF/app metadata is removed by canvas re-encoding.':'Canvas re-encoding creates a fresh image file without carrying source metadata chunks.';
}
