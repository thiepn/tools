export type CollageLayoutType='auto'|'2-horizontal'|'2-vertical'|'before-after'|'2x2'|'3x3'|'h-strip'|'v-strip'|'custom';
export type AspectRatioPreset='auto'|'1:1'|'4:3'|'3:2'|'16:9'|'9:16'|'custom';
export type FitMode='cover'|'contain';
export interface CollageItem{id:string;blob:Blob;dataUrl:string;imgElement?:HTMLImageElement;filename:string;naturalWidth:number;naturalHeight:number;fitMode:FitMode;offsetX:number;offsetY:number;zoom:number;}
export interface CollageConfig{layout:CollageLayoutType;customRows:number;customCols:number;aspectPreset:AspectRatioPreset;targetWidth:number;targetHeight:number;gap:number;padding:number;borderRadius:number;backgroundColor:string;format:'image/png'|'image/jpeg'|'image/webp';quality:number;}
export interface GridDimensions{rows:number;cols:number;totalCells:number;}

export function calculateGridDimensions(layout:CollageLayoutType,itemCount:number,customRows=2,customCols=2):GridDimensions{
 const count=Math.max(1,itemCount);switch(layout){case'2-horizontal':case'before-after':return{rows:1,cols:2,totalCells:2};case'2-vertical':return{rows:2,cols:1,totalCells:2};case'2x2':return{rows:2,cols:2,totalCells:4};case'3x3':return{rows:3,cols:3,totalCells:9};case'h-strip':return{rows:1,cols:count,totalCells:count};case'v-strip':return{rows:count,cols:1,totalCells:count};case'custom':{const rows=Math.max(1,Math.floor(customRows));const cols=Math.max(1,Math.floor(customCols));return{rows,cols,totalCells:rows*cols};}default:{if(count<=1)return{rows:1,cols:1,totalCells:1};if(count===2)return{rows:1,cols:2,totalCells:2};if(count===3)return{rows:1,cols:3,totalCells:3};if(count===4)return{rows:2,cols:2,totalCells:4};if(count<=6)return{rows:2,cols:3,totalCells:6};if(count<=8)return{rows:2,cols:4,totalCells:8};if(count<=9)return{rows:3,cols:3,totalCells:9};if(count<=12)return{rows:3,cols:4,totalCells:12};if(count<=16)return{rows:4,cols:4,totalCells:16};const cols=Math.ceil(Math.sqrt(count));const rows=Math.ceil(count/cols);return{rows,cols,totalCells:rows*cols};}}}

export function calculateCanvasSize(preset:AspectRatioPreset,baseWidth:number,baseHeight:number,grid:GridDimensions):{width:number;height:number}{
 const width=Math.min(Math.max(400,Number.isFinite(baseWidth)?baseWidth:1200),3840);switch(preset){case'1:1':return{width,height:width};case'4:3':return{width,height:Math.round(width*3/4)};case'3:2':return{width,height:Math.round(width*2/3)};case'16:9':return{width,height:Math.round(width*9/16)};case'9:16':return{width,height:Math.round(width*16/9)};case'custom':return{width,height:Math.min(Math.max(300,Number.isFinite(baseHeight)?baseHeight:800),3840)};default:return{width,height:Math.min(Math.max(300,Math.round(width*grid.rows/Math.max(1,grid.cols))),3840)};}
}

export interface ImagePlacement{sx:number;sy:number;sw:number;sh:number;dx:number;dy:number;dw:number;dh:number;}
const clamp01=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0.5));
/** Calculates exact source/destination rectangles for cover/contain without oversized intermediate drawing. */
export function calculateImagePlacement(imageW:number,imageH:number,cellX:number,cellY:number,cellW:number,cellH:number,fitMode:FitMode,offsetX=0.5,offsetY=0.5,zoom=1):ImagePlacement|null{
 if([imageW,imageH,cellW,cellH].some(v=>!Number.isFinite(v)||v<=0))return null;const z=Math.max(1,Math.min(4,Number.isFinite(zoom)?zoom:1));
 if(fitMode==='contain'){
  const scale=Math.min(cellW/imageW,cellH/imageH)*z;const dw=imageW*scale;const dh=imageH*scale;return{sx:0,sy:0,sw:imageW,sh:imageH,dx:cellX+(cellW-dw)*clamp01(offsetX),dy:cellY+(cellH-dh)*clamp01(offsetY),dw,dh};
 }
 const baseScale=Math.max(cellW/imageW,cellH/imageH)*z;const sourceW=Math.min(imageW,cellW/baseScale);const sourceH=Math.min(imageH,cellH/baseScale);const maxX=Math.max(0,imageW-sourceW);const maxY=Math.max(0,imageH-sourceH);
 return{sx:maxX*clamp01(offsetX),sy:maxY*clamp01(offsetY),sw:sourceW,sh:sourceH,dx:cellX,dy:cellY,dw:cellW,dh:cellH};
}

export function renderCollageToCanvas(canvas:HTMLCanvasElement,items:CollageItem[],config:CollageConfig):void{
 const grid=calculateGridDimensions(config.layout,items.length,config.customRows,config.customCols);const{width,height}=calculateCanvasSize(config.aspectPreset,config.targetWidth,config.targetHeight,grid);canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.fillStyle=config.backgroundColor;ctx.fillRect(0,0,width,height);const gap=Math.max(0,config.gap);const padding=Math.max(0,config.padding);const availableWidth=Math.max(1,width-padding*2-gap*(grid.cols-1));const availableHeight=Math.max(1,height-padding*2-gap*(grid.rows-1));const cellWidth=availableWidth/grid.cols;const cellHeight=availableHeight/grid.rows;
 for(let row=0;row<grid.rows;row++){for(let col=0;col<grid.cols;col++){const index=row*grid.cols+col;if(index>=items.length)continue;const item=items[index];const img=item.imgElement;if(!img||!img.complete||img.naturalWidth<=0||img.naturalHeight<=0)continue;const x=padding+col*(cellWidth+gap);const y=padding+row*(cellHeight+gap);ctx.save();ctx.beginPath();const radius=Math.max(0,Math.min(config.borderRadius,cellWidth/2,cellHeight/2));if(radius>0)ctx.roundRect(x,y,cellWidth,cellHeight,radius);else ctx.rect(x,y,cellWidth,cellHeight);ctx.clip();
  const placement=calculateImagePlacement(img.naturalWidth,img.naturalHeight,x,y,cellWidth,cellHeight,item.fitMode,item.offsetX,item.offsetY,item.zoom);if(placement)ctx.drawImage(img,placement.sx,placement.sy,placement.sw,placement.sh,placement.dx,placement.dy,placement.dw,placement.dh);
  if(config.layout==='before-after'&&(index===0||index===1)){const label=index===0?'BEFORE':'AFTER';ctx.font='bold 13px sans-serif';const pad=10;const badgeH=24;const badgeW=ctx.measureText(label).width+pad*2;const bx=x+12;const by=y+12;ctx.fillStyle='rgba(15, 23, 42, 0.75)';ctx.beginPath();ctx.roundRect(bx,by,badgeW,badgeH,4);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(label,bx+pad,by+16);}ctx.restore();}}
}
