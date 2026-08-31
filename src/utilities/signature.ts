/** Signature Maker & Background Cleaning Utilities */
export interface Point{x:number;y:number;time?:number;}
export interface SignatureStroke{points:Point[];color:string;width:number;}
export interface BoundingBox{minX:number;minY:number;maxX:number;maxY:number;width:number;height:number;}

/** Finds the tight inclusive content rectangle and applies pixel-safe padding. */
export function getCanvasContentBounds(ctx:CanvasRenderingContext2D,width:number,height:number,padding=16):BoundingBox|null{
 if(width<=0||height<=0)return null;const data=ctx.getImageData(0,0,width,height).data;let minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++){for(let x=0;x<width;x++){if(data[(y*width+x)*4+3]>10){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}}
 if(maxX<0)return null;const pad=Math.max(0,Math.floor(padding));const left=Math.max(0,minX-pad),top=Math.max(0,minY-pad),right=Math.min(width,maxX+1+pad),bottom=Math.min(height,maxY+1+pad);return{minX:left,minY:top,maxX:right,maxY:bottom,width:right-left,height:bottom-top};
}
export function cropCanvasToContent(sourceCanvas:HTMLCanvasElement,bounds:BoundingBox):HTMLCanvasElement{const cropped=document.createElement('canvas');cropped.width=Math.max(1,Math.round(bounds.width));cropped.height=Math.max(1,Math.round(bounds.height));cropped.getContext('2d')?.drawImage(sourceCanvas,bounds.minX,bounds.minY,bounds.width,bounds.height,0,0,cropped.width,cropped.height);return cropped;}

function parseInkColor(color:string):{r:number;g:number;b:number}{const clean=color.trim().replace(/^#/,'');let expanded='0f172a';if(/^[0-9a-f]{3}$/i.test(clean))expanded=clean.split('').map(c=>c+c).join('');else if(/^[0-9a-f]{6}$/i.test(clean))expanded=clean;return{r:parseInt(expanded.slice(0,2),16),g:parseInt(expanded.slice(2,4),16),b:parseInt(expanded.slice(4,6),16)};}

export function cleanSignatureImage(sourceImage:HTMLImageElement|HTMLCanvasElement,threshold=200,contrast=1.2,inkColor='#0f172a'):HTMLCanvasElement{
 const canvas=document.createElement('canvas');const w='naturalWidth'in sourceImage&&(sourceImage as HTMLImageElement).naturalWidth?(sourceImage as HTMLImageElement).naturalWidth:sourceImage.width;const h='naturalHeight'in sourceImage&&(sourceImage as HTMLImageElement).naturalHeight?(sourceImage as HTMLImageElement).naturalHeight:sourceImage.height;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return canvas;ctx.drawImage(sourceImage,0,0,w,h);const image=ctx.getImageData(0,0,w,h),data=image.data;const ink=parseInkColor(inkColor);const safeThreshold=Math.max(1,Math.min(255,Number.isFinite(threshold)?threshold:200));const safeContrast=Math.max(0.1,Math.min(4,Number.isFinite(contrast)?contrast:1.2));
 for(let i=0;i<data.length;i+=4){const luminance=.299*data[i]+.587*data[i+1]+.114*data[i+2];const adjusted=(luminance-128)*safeContrast+128;if(adjusted>=safeThreshold){data[i+3]=0;}else{const alpha=Math.round(255*(1-Math.max(0,adjusted)/safeThreshold));data[i]=ink.r;data[i+1]=ink.g;data[i+2]=ink.b;data[i+3]=Math.max(0,Math.min(255,alpha));}}
 ctx.putImageData(image,0,0);return canvas;
}
