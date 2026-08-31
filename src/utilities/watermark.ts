/** Watermark Processing Utilities */
export type WatermarkPosition = 'top-left'|'top-center'|'top-right'|'center-left'|'center'|'center-right'|'bottom-left'|'bottom-center'|'bottom-right'|'custom'|'tiled';
export interface WatermarkConfig {
  type: 'text'|'logo'; text: string; fontFamily: string; fontSizeRatio: number; fontWeight: 'normal'|'bold'|'900';
  color: string; opacity: number; rotationDeg: number; position: WatermarkPosition; customXPercent: number; customYPercent: number;
  paddingPx: number; tileSpacingPx: number; logoDataUrl?: string; logoScaleRatio: number;
}
export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  type:'text', text:'CONFIDENTIAL', fontFamily:'Inter, system-ui, sans-serif', fontSizeRatio:0.05, fontWeight:'bold', color:'#ffffff', opacity:0.7,
  rotationDeg:0, position:'bottom-right', customXPercent:50, customYPercent:50, paddingPx:24, tileSpacingPx:120, logoScaleRatio:0.2,
};

export function calculateWatermarkCoordinates(canvasWidth:number, canvasHeight:number, elementWidth:number, elementHeight:number, position:WatermarkPosition, padding:number, customXPercent=50, customYPercent=50): {x:number;y:number} {
  switch(position){
    case'top-left':return{x:padding,y:padding}; case'top-center':return{x:(canvasWidth-elementWidth)/2,y:padding}; case'top-right':return{x:canvasWidth-elementWidth-padding,y:padding};
    case'center-left':return{x:padding,y:(canvasHeight-elementHeight)/2}; case'center':return{x:(canvasWidth-elementWidth)/2,y:(canvasHeight-elementHeight)/2};
    case'center-right':return{x:canvasWidth-elementWidth-padding,y:(canvasHeight-elementHeight)/2}; case'bottom-left':return{x:padding,y:canvasHeight-elementHeight-padding};
    case'bottom-center':return{x:(canvasWidth-elementWidth)/2,y:canvasHeight-elementHeight-padding}; case'bottom-right':return{x:canvasWidth-elementWidth-padding,y:canvasHeight-elementHeight-padding};
    case'custom':return{x:(canvasWidth*customXPercent)/100-elementWidth/2,y:(canvasHeight*customYPercent)/100-elementHeight/2}; default:return{x:padding,y:padding};
  }
}

export function calculateRotatedBounds(width:number,height:number,rotationDeg:number):{width:number;height:number}{
  const rad=(rotationDeg*Math.PI)/180; const cos=Math.abs(Math.cos(rad)); const sin=Math.abs(Math.sin(rad));
  return{width:width*cos+height*sin,height:width*sin+height*cos};
}

export function clampRotatedWatermarkCenter(canvasWidth:number,canvasHeight:number,centerX:number,centerY:number,elementWidth:number,elementHeight:number,rotationDeg:number,padding=0):{x:number;y:number}{
  const bounds=calculateRotatedBounds(elementWidth,elementHeight,rotationDeg); const pad=Math.max(0,padding);
  const minX=pad+bounds.width/2; const maxX=canvasWidth-pad-bounds.width/2; const minY=pad+bounds.height/2; const maxY=canvasHeight-pad-bounds.height/2;
  return{
    x:minX>maxX?canvasWidth/2:Math.max(minX,Math.min(maxX,centerX)),
    y:minY>maxY?canvasHeight/2:Math.max(minY,Math.min(maxY,centerY)),
  };
}

export async function applyWatermarkToImage(imageSource:HTMLImageElement|ImageBitmap,config:WatermarkConfig,logoImg?:HTMLImageElement|null):Promise<HTMLCanvasElement>{
  const canvas=document.createElement('canvas'); const width=imageSource.width; const height=imageSource.height; canvas.width=width; canvas.height=height;
  const ctx=canvas.getContext('2d'); if(!ctx)throw new Error('Could not obtain canvas 2D rendering context.'); ctx.drawImage(imageSource,0,0,width,height);
  ctx.save(); ctx.globalAlpha=Math.max(0,Math.min(1,config.opacity));
  if(config.position==='tiled'){
    const fontSize=Math.max(14,Math.round(height*config.fontSizeRatio)); ctx.font=`${config.fontWeight} ${fontSize}px ${config.fontFamily}`; ctx.fillStyle=config.color; ctx.textAlign='center';ctx.textBaseline='middle';
    const spacing=Math.max(60,config.tileSpacingPx); const rad=(config.rotationDeg*Math.PI)/180;
    for(let y=-height;y<height*2;y+=spacing){for(let x=-width;x<width*2;x+=spacing*1.5){ctx.save();ctx.translate(x,y);ctx.rotate(rad);
      if(config.type==='text')ctx.fillText(config.text,0,0); else if(config.type==='logo'&&logoImg){const logoW=Math.max(20,width*config.logoScaleRatio);const logoH=(logoW/logoImg.width)*logoImg.height;ctx.drawImage(logoImg,-logoW/2,-logoH/2,logoW,logoH);}ctx.restore();}}
  }else if(config.type==='text'){
    const fontSize=Math.max(14,Math.round(height*config.fontSizeRatio));ctx.font=`${config.fontWeight} ${fontSize}px ${config.fontFamily}`;const metrics=ctx.measureText(config.text);const textW=Math.max(1,metrics.width);const textH=Math.max(fontSize,(metrics.actualBoundingBoxAscent||fontSize)+(metrics.actualBoundingBoxDescent||0));
    const coords=calculateWatermarkCoordinates(width,height,textW,textH,config.position,config.paddingPx,config.customXPercent,config.customYPercent);
    const center=clampRotatedWatermarkCenter(width,height,coords.x+textW/2,coords.y+textH/2,textW,textH,config.rotationDeg,config.paddingPx);
    ctx.translate(center.x,center.y);ctx.rotate((config.rotationDeg*Math.PI)/180);ctx.fillStyle=config.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(config.text,0,0);
  }else if(config.type==='logo'&&logoImg){
    const logoW=Math.max(20,width*config.logoScaleRatio);const logoH=(logoW/logoImg.width)*logoImg.height;const coords=calculateWatermarkCoordinates(width,height,logoW,logoH,config.position,config.paddingPx,config.customXPercent,config.customYPercent);
    const center=clampRotatedWatermarkCenter(width,height,coords.x+logoW/2,coords.y+logoH/2,logoW,logoH,config.rotationDeg,config.paddingPx);
    ctx.translate(center.x,center.y);ctx.rotate((config.rotationDeg*Math.PI)/180);ctx.drawImage(logoImg,-logoW/2,-logoH/2,logoW,logoH);
  }
  ctx.restore();return canvas;
}
