export interface EnhanceOptions{denoise:number;sharpen:number;autoLevels:boolean;localContrast:number;saturation:number}
export interface RestoreOptions{dustRemoval:number;denoise:number;fadeRecovery:number;sharpen:number;warmth:number}
export interface SkewEstimate{correctionAngleDeg:number;detectedAngleDeg:number;confidence:number;edgeSamples:number}
export interface Point2D{x:number;y:number}

const clampByte=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
const lum=(r:number,g:number,b:number)=>.299*r+.587*g+.114*b;

function boxBlur(source:Uint8ClampedArray,width:number,height:number,radius:number){
  const r=Math.max(1,Math.min(12,Math.round(radius))),tmp=new Float32Array(source.length),out=new Uint8ClampedArray(source.length),span=r*2+1;
  for(let y=0;y<height;y++)for(let ch=0;ch<4;ch++){
    let sum=0;for(let k=-r;k<=r;k++){const x=Math.max(0,Math.min(width-1,k));sum+=source[(y*width+x)*4+ch];}
    for(let x=0;x<width;x++){tmp[(y*width+x)*4+ch]=sum/span;const remove=Math.max(0,x-r),add=Math.min(width-1,x+r+1);sum-=source[(y*width+remove)*4+ch];sum+=source[(y*width+add)*4+ch];}
  }
  for(let x=0;x<width;x++)for(let ch=0;ch<4;ch++){
    let sum=0;for(let k=-r;k<=r;k++){const y=Math.max(0,Math.min(height-1,k));sum+=tmp[(y*width+x)*4+ch];}
    for(let y=0;y<height;y++){out[(y*width+x)*4+ch]=clampByte(sum/span);const remove=Math.max(0,y-r),add=Math.min(height-1,y+r+1);sum-=tmp[(remove*width+x)*4+ch];sum+=tmp[(add*width+x)*4+ch];}
  }
  return out;
}

export function edgePreservingDenoiseRgba(source:Uint8ClampedArray,width:number,height:number,strength=1){
  if(width<2||height<2||source.length!==width*height*4||strength<=0)return new Uint8ClampedArray(source);
  const s=Math.max(0,Math.min(4,strength)),blurred=boxBlur(source,width,height,s>=3?2:1),out=new Uint8ClampedArray(source),baseBlend=.16+s*.15,threshold=10+s*11;
  for(let p=0;p<width*height;p++){const i=p*4;for(let ch=0;ch<3;ch++){const diff=Math.abs(source[i+ch]-blurred[i+ch]),blend=diff>threshold?baseBlend*.18:baseBlend;out[i+ch]=clampByte(source[i+ch]*(1-blend)+blurred[i+ch]*blend);}out[i+3]=source[i+3];}
  return out;
}

export function unsharpMaskRgba(source:Uint8ClampedArray,width:number,height:number,amount=.7,radius=1){
  if(width<2||height<2||source.length!==width*height*4||amount<=0)return new Uint8ClampedArray(source);
  const blurred=boxBlur(source,width,height,Math.max(1,Math.min(4,radius))),a=Math.max(0,Math.min(2.5,amount)),out=new Uint8ClampedArray(source);
  for(let p=0;p<width*height;p++){const i=p*4;for(let ch=0;ch<3;ch++)out[i+ch]=clampByte(source[i+ch]+(source[i+ch]-blurred[i+ch])*a);out[i+3]=source[i+3];}
  return out;
}

function percentile(hist:Uint32Array,total:number,fraction:number){const target=Math.max(0,Math.min(total-1,Math.floor(total*fraction)));let seen=0;for(let i=0;i<256;i++){seen+=hist[i];if(seen>target)return i;}return 255;}
export function autoLevelsRgba(source:Uint8ClampedArray,width:number,height:number,clip=.005){
  if(source.length!==width*height*4||!source.length)return new Uint8ClampedArray(source);const h=[new Uint32Array(256),new Uint32Array(256),new Uint32Array(256)],total=width*height;
  for(let p=0;p<total;p++){const i=p*4;if(source[i+3]===0)continue;h[0][source[i]]++;h[1][source[i+1]]++;h[2][source[i+2]]++;}
  const lo=h.map(x=>percentile(x,total,clip)),hi=h.map(x=>percentile(x,total,1-clip)),out=new Uint8ClampedArray(source);
  for(let p=0;p<total;p++){const i=p*4;for(let ch=0;ch<3;ch++){const range=Math.max(1,hi[ch]-lo[ch]);out[i+ch]=clampByte((source[i+ch]-lo[ch])*255/range);}out[i+3]=source[i+3];}return out;
}

export function adjustSaturationRgba(source:Uint8ClampedArray,width:number,height:number,saturation=1){
  const s=Math.max(0,Math.min(2.5,saturation)),out=new Uint8ClampedArray(source);if(source.length!==width*height*4)return out;
  for(let p=0;p<width*height;p++){const i=p*4,l=lum(source[i],source[i+1],source[i+2]);out[i]=clampByte(l+(source[i]-l)*s);out[i+1]=clampByte(l+(source[i+1]-l)*s);out[i+2]=clampByte(l+(source[i+2]-l)*s);out[i+3]=source[i+3];}return out;
}

export function localContrastRgba(source:Uint8ClampedArray,width:number,height:number,amount=.25){
  if(amount<=0||source.length!==width*height*4)return new Uint8ClampedArray(source);const blurred=boxBlur(source,width,height,5),a=Math.max(0,Math.min(1.5,amount)),out=new Uint8ClampedArray(source);
  for(let p=0;p<width*height;p++){const i=p*4,l=lum(source[i],source[i+1],source[i+2]),b=lum(blurred[i],blurred[i+1],blurred[i+2]),delta=(l-b)*a;out[i]=clampByte(source[i]+delta);out[i+1]=clampByte(source[i+1]+delta);out[i+2]=clampByte(source[i+2]+delta);out[i+3]=source[i+3];}return out;
}

export function enhanceRgba(source:Uint8ClampedArray,width:number,height:number,options:Partial<EnhanceOptions>={}){
  const o:EnhanceOptions={denoise:options.denoise??1.2,sharpen:options.sharpen??.7,autoLevels:options.autoLevels??true,localContrast:options.localContrast??.2,saturation:options.saturation??1.03};
  let out=edgePreservingDenoiseRgba(source,width,height,o.denoise);if(o.autoLevels)out=autoLevelsRgba(out,width,height);if(o.localContrast>0)out=localContrastRgba(out,width,height,o.localContrast);if(Math.abs(o.saturation-1)>.001)out=adjustSaturationRgba(out,width,height,o.saturation);if(o.sharpen>0)out=unsharpMaskRgba(out,width,height,o.sharpen,1);return out;
}

export function removeDustScratchesRgba(source:Uint8ClampedArray,width:number,height:number,strength=1){
  if(width<3||height<3||source.length!==width*height*4||strength<=0)return new Uint8ClampedArray(source);const out=new Uint8ClampedArray(source),threshold=48-Math.min(3,strength)*9;
  const values=new Array<number>(8);for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=(y*width+x)*4,center=lum(source[i],source[i+1],source[i+2]);let k=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy){const j=((y+dy)*width+x+dx)*4;values[k++]=lum(source[j],source[j+1],source[j+2]);}values.sort((a,b)=>a-b);const median=(values[3]+values[4])/2;if(Math.abs(center-median)<threshold)continue;const neighbors=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]],rgb=[0,0,0];for(const[nx,ny]of neighbors){const j=(ny*width+nx)*4;rgb[0]+=source[j];rgb[1]+=source[j+1];rgb[2]+=source[j+2];}out[i]=clampByte(rgb[0]/4);out[i+1]=clampByte(rgb[1]/4);out[i+2]=clampByte(rgb[2]/4);}
  return out;
}

export function restoreOldPhotoRgba(source:Uint8ClampedArray,width:number,height:number,options:Partial<RestoreOptions>={}){
  const o:RestoreOptions={dustRemoval:options.dustRemoval??1.5,denoise:options.denoise??1.2,fadeRecovery:options.fadeRecovery??.8,sharpen:options.sharpen??.55,warmth:options.warmth??0};let out=removeDustScratchesRgba(source,width,height,o.dustRemoval);out=edgePreservingDenoiseRgba(out,width,height,o.denoise);if(o.fadeRecovery>0){const leveled=autoLevelsRgba(out,width,height,.01),mix=Math.max(0,Math.min(1,o.fadeRecovery)),next=new Uint8ClampedArray(out);for(let p=0;p<width*height;p++){const i=p*4;for(let ch=0;ch<3;ch++)next[i+ch]=clampByte(out[i+ch]*(1-mix)+leveled[i+ch]*mix);}out=next;}if(o.warmth!==0){const w=Math.max(-1,Math.min(1,o.warmth))*18,next=new Uint8ClampedArray(out);for(let p=0;p<width*height;p++){const i=p*4;next[i]=clampByte(out[i]+w);next[i+2]=clampByte(out[i+2]-w*.75);}out=next;}if(o.sharpen>0)out=unsharpMaskRgba(out,width,height,o.sharpen,1);return out;
}

export function paintCircularMask(mask:Uint8Array,width:number,height:number,cx:number,cy:number,radius:number,value=1){const out=new Uint8Array(mask),r=Math.max(1,radius),x0=Math.max(0,Math.floor(cx-r)),x1=Math.min(width-1,Math.ceil(cx+r)),y0=Math.max(0,Math.floor(cy-r)),y1=Math.min(height-1,Math.ceil(cy+r));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(Math.hypot(x-cx,y-cy)<=r)out[y*width+x]=value?1:0;return out;}

export function inpaintMaskedRgba(source:Uint8ClampedArray,width:number,height:number,mask:Uint8Array){
  if(source.length!==width*height*4||mask.length!==width*height)throw new Error('Image and mask dimensions must match.');const out=new Uint8ClampedArray(source),remaining=new Uint8Array(mask),queue=new Int32Array(width*height),queued=new Uint8Array(width*height);let head=0,tail=0;
  const knownNeighborCount=(p:number)=>{const x=p%width,y=Math.floor(p/width);let n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx>=0&&nx<width&&ny>=0&&ny<height&&!remaining[ny*width+nx])n++;}return n;};
  for(let p=0;p<remaining.length;p++)if(remaining[p]&&knownNeighborCount(p)>0){queue[tail++]=p;queued[p]=1;}
  while(head<tail){const p=queue[head++];if(!remaining[p])continue;const x=p%width,y=Math.floor(p/width),sum=[0,0,0,0];let n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;const np=ny*width+nx;if(remaining[np])continue;const j=np*4;sum[0]+=out[j];sum[1]+=out[j+1];sum[2]+=out[j+2];sum[3]+=out[j+3];n++;}if(!n)continue;const i=p*4;out[i]=clampByte(sum[0]/n);out[i+1]=clampByte(sum[1]/n);out[i+2]=clampByte(sum[2]/n);out[i+3]=clampByte(sum[3]/n);remaining[p]=0;for(const[np]of[[p-1],[p+1],[p-width],[p+width]] as[number][])if(np>=0&&np<remaining.length&&remaining[np]&&!queued[np]){queue[tail++]=np;queued[np]=1;}}
  const softened=boxBlur(out,width,height,1);for(let p=0;p<mask.length;p++)if(mask[p]){const i=p*4;out[i]=clampByte(out[i]*.7+softened[i]*.3);out[i+1]=clampByte(out[i+1]*.7+softened[i+1]*.3);out[i+2]=clampByte(out[i+2]*.7+softened[i+2]*.3);}return out;
}

export function suppressRedEyeRgba(source:Uint8ClampedArray,width:number,height:number,center:Point2D,radius:number,strength=.9){const out=new Uint8ClampedArray(source),r=Math.max(1,radius),s=Math.max(0,Math.min(1,strength)),x0=Math.max(0,Math.floor(center.x-r)),x1=Math.min(width-1,Math.ceil(center.x+r)),y0=Math.max(0,Math.floor(center.y-r)),y1=Math.min(height-1,Math.ceil(center.y+r));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const d=Math.hypot(x-center.x,y-center.y);if(d>r)continue;const i=(y*width+x)*4,R=source[i],G=source[i+1],B=source[i+2],base=Math.max(G,B);if(R<70||R<base*1.28||R-G<28)continue;const feather=Math.min(1,(r-d)/Math.max(1,r*.22)),target=base*1.04,blend=s*feather;out[i]=clampByte(R*(1-blend)+target*blend);out[i+1]=clampByte(G*(1-blend*.08));out[i+2]=clampByte(B*(1-blend*.08));}return out;}

export function estimateSkewAngleRgba(source:Uint8ClampedArray,width:number,height:number,maxAngle=12,stepDeg=.5):SkewEstimate{
  if(width<8||height<8||source.length!==width*height*4)return{correctionAngleDeg:0,detectedAngleDeg:0,confidence:0,edgeSamples:0};const stride=Math.max(1,Math.ceil(Math.max(width,height)/700)),points:{x:number;y:number}[]=[];
  for(let y=stride;y<height-stride;y+=stride)for(let x=stride;x<width-stride;x+=stride){const i=(y*width+x)*4,up=((y-stride)*width+x)*4,down=((y+stride)*width+x)*4,g=Math.abs(lum(source[down],source[down+1],source[down+2])-lum(source[up],source[up+1],source[up+2]));if(g>42&&lum(source[i],source[i+1],source[i+2])<235)points.push({x,y});if(points.length>=14000)break;}if(points.length<40)return{correctionAngleDeg:0,detectedAngleDeg:0,confidence:0,edgeSamples:points.length};
  let bestAngle=0,best=-Infinity,second=-Infinity;const binSize=Math.max(1,Math.round(stride*1.5)),offset=Math.ceil((height+width*Math.sin(maxAngle*Math.PI/180))/binSize)+4,bins=new Uint32Array(offset*2+height+width);
  for(let a=-maxAngle;a<=maxAngle+1e-6;a+=stepDeg){bins.fill(0);const rad=a*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);for(const p of points){const b=Math.round((p.y*c-p.x*s)/binSize)+offset;if(b>=0&&b<bins.length)bins[b]++;}let score=0;for(const n of bins)if(n>1)score+=n*n;if(score>best){second=best;best=score;bestAngle=a;}else if(score>second)second=score;}
  const confidence=best>0?Math.max(0,Math.min(1,(best-Math.max(0,second))/best*6)):0,detected=Number(bestAngle.toFixed(2));return{detectedAngleDeg:detected,correctionAngleDeg:Number((-detected).toFixed(2)),confidence:Number(confidence.toFixed(3)),edgeSamples:points.length};
}

export function upscaleCanvasStaged(source:HTMLImageElement|HTMLCanvasElement,factor:number,sharpen=.38){const sw=source instanceof HTMLCanvasElement?source.width:(source.naturalWidth||source.width),sh=source instanceof HTMLCanvasElement?source.height:(source.naturalHeight||source.height),targetW=Math.max(1,Math.round(sw*Math.max(1,Math.min(4,factor)))),targetH=Math.max(1,Math.round(sh*Math.max(1,Math.min(4,factor))));let current=document.createElement('canvas');current.width=sw;current.height=sh;let ctx=current.getContext('2d');if(!ctx)throw new Error('Canvas is unavailable.');ctx.drawImage(source,0,0,sw,sh);while(current.width<targetW||current.height<targetH){const next=document.createElement('canvas'),nw=Math.min(targetW,Math.max(current.width+1,Math.round(current.width*1.75))),nh=Math.min(targetH,Math.max(current.height+1,Math.round(current.height*1.75)));next.width=nw;next.height=nh;ctx=next.getContext('2d');if(!ctx)throw new Error('Canvas is unavailable.');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(current,0,0,nw,nh);current=next;}if(sharpen>0){ctx=current.getContext('2d',{willReadFrequently:true});if(ctx){const image=ctx.getImageData(0,0,current.width,current.height);image.data.set(unsharpMaskRgba(image.data,current.width,current.height,sharpen,1));ctx.putImageData(image,0,0);}}return current;}
