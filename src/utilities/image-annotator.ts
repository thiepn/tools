export type AnnotationTool='select'|'arrow'|'line'|'rect'|'circle'|'highlighter'|'redact'|'text'|'stepBadge';
export interface BaseAnnotation{id:string;type:AnnotationTool;color:string;strokeWidth:number;}
export interface ArrowAnnotation extends BaseAnnotation{type:'arrow';startX:number;startY:number;endX:number;endY:number;}
export interface LineAnnotation extends BaseAnnotation{type:'line';startX:number;startY:number;endX:number;endY:number;}
export interface RectAnnotation extends BaseAnnotation{type:'rect';x:number;y:number;width:number;height:number;}
export interface CircleAnnotation extends BaseAnnotation{type:'circle';centerX:number;centerY:number;radiusX:number;radiusY:number;}
export interface HighlighterAnnotation extends BaseAnnotation{type:'highlighter';points:{x:number;y:number}[];}
export interface RedactAnnotation extends BaseAnnotation{type:'redact';x:number;y:number;width:number;height:number;}
export interface TextAnnotation extends BaseAnnotation{type:'text';x:number;y:number;text:string;fontSize:number;}
export interface StepBadgeAnnotation extends BaseAnnotation{type:'stepBadge';x:number;y:number;number:number;}
export type AnnotationItem=ArrowAnnotation|LineAnnotation|RectAnnotation|CircleAnnotation|HighlighterAnnotation|RedactAnnotation|TextAnnotation|StepBadgeAnnotation;

export interface NormalizedRect{x:number;y:number;width:number;height:number;}
export function normalizeAnnotationRect(x:number,y:number,width:number,height:number,canvasWidth=Infinity,canvasHeight=Infinity):NormalizedRect{
 const left=Math.min(x,x+width),top=Math.min(y,y+height),right=Math.max(x,x+width),bottom=Math.max(y,y+height);const nx=Math.max(0,left),ny=Math.max(0,top),nr=Math.min(canvasWidth,right),nb=Math.min(canvasHeight,bottom);return{x:nx,y:ny,width:Math.max(0,nr-nx),height:Math.max(0,nb-ny)};
}

/** Redaction is an opaque fill, not reversible-looking pixelation. */
export function applySolidRedaction(ctx:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,color='#000000'):void{
 const rect=normalizeAnnotationRect(x,y,width,height,ctx.canvas.width,ctx.canvas.height);if(rect.width<=0||rect.height<=0)return;ctx.save();ctx.globalAlpha=1;ctx.fillStyle=color||'#000000';ctx.fillRect(rect.x,rect.y,rect.width,rect.height);ctx.restore();
}

export function renderAnnotations(ctx:CanvasRenderingContext2D,annotations:AnnotationItem[],sourceImage:HTMLImageElement):void{
 ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.drawImage(sourceImage,0,0);
 // Flatten redaction immediately over source pixels. Opaque replacement is much
 // safer for screenshots containing passwords, email addresses, IDs, etc.
 for(const item of annotations){if(item.type==='redact')applySolidRedaction(ctx,item.x,item.y,item.width,item.height,item.color||'#000000');}
 for(const item of annotations){if(item.type==='redact')continue;ctx.save();ctx.strokeStyle=item.color;ctx.fillStyle=item.color;ctx.lineWidth=Math.max(1,item.strokeWidth);ctx.lineCap='round';ctx.lineJoin='round';
  switch(item.type){case'arrow':drawArrow(ctx,item.startX,item.startY,item.endX,item.endY,item.strokeWidth);break;case'line':ctx.beginPath();ctx.moveTo(item.startX,item.startY);ctx.lineTo(item.endX,item.endY);ctx.stroke();break;case'rect':{const r=normalizeAnnotationRect(item.x,item.y,item.width,item.height);ctx.strokeRect(r.x,r.y,r.width,r.height);break;}case'circle':ctx.beginPath();ctx.ellipse(item.centerX,item.centerY,Math.abs(item.radiusX),Math.abs(item.radiusY),0,0,Math.PI*2);ctx.stroke();break;case'highlighter':if(item.points.length>1){ctx.globalAlpha=.4;ctx.beginPath();ctx.moveTo(item.points[0].x,item.points[0].y);for(let i=1;i<item.points.length;i++)ctx.lineTo(item.points[i].x,item.points[i].y);ctx.stroke();}break;case'text':{ctx.font=`bold ${Math.max(8,item.fontSize)}px sans-serif`;const metrics=ctx.measureText(item.text);const padding=6;ctx.fillStyle='rgba(0, 0, 0, 0.75)';ctx.beginPath();ctx.roundRect(item.x-padding,item.y-item.fontSize,metrics.width+padding*2,item.fontSize+padding*2,4);ctx.fill();ctx.fillStyle=item.color;ctx.fillText(item.text,item.x,item.y);break;}case'stepBadge':{const radius=Math.max(14,item.strokeWidth*4);ctx.beginPath();ctx.arc(item.x,item.y,radius,0,Math.PI*2);ctx.fillStyle=item.color;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();ctx.fillStyle='#fff';ctx.font=`bold ${Math.round(radius*1.1)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(item.number),item.x,item.y+1);break;}}
  ctx.restore();
 }
}
function drawArrow(ctx:CanvasRenderingContext2D,fromX:number,fromY:number,toX:number,toY:number,strokeWidth:number):void{const head=Math.max(12,strokeWidth*3.5),angle=Math.atan2(toY-fromY,toX-fromX);ctx.beginPath();ctx.moveTo(fromX,fromY);ctx.lineTo(toX,toY);ctx.stroke();ctx.beginPath();ctx.moveTo(toX,toY);ctx.lineTo(toX-head*Math.cos(angle-Math.PI/6),toY-head*Math.sin(angle-Math.PI/6));ctx.lineTo(toX-head*Math.cos(angle+Math.PI/6),toY-head*Math.sin(angle+Math.PI/6));ctx.closePath();ctx.fill();}
