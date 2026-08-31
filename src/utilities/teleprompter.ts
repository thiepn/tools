/** Teleprompter Utilities & Calculations */
export interface TeleprompterConfig{speed:number;fontSize:number;lineHeight:number;textColor:string;backgroundColor:string;textAlign:'left'|'center'|'right';isMirrored:boolean;showFocusGuide:boolean;marginWidthPercent:number;}
export const DEFAULT_TELEPROMPTER_CONFIG:TeleprompterConfig={speed:25,fontSize:44,lineHeight:1.6,textColor:'#ffffff',backgroundColor:'#09090b',textAlign:'center',isMirrored:false,showFocusGuide:true,marginWidthPercent:85};

export function calculateSpeakingStats(text:string,wpm=140):{wordCount:number;estimatedSeconds:number;formattedDuration:string}{
 const clean=text.trim();if(!clean)return{wordCount:0,estimatedSeconds:0,formattedDuration:'0s'};const wordCount=clean.split(/\s+/).filter(Boolean).length;const safeWpm=Math.max(1,Number.isFinite(wpm)?wpm:140);const estimatedSeconds=Math.round(wordCount/safeWpm*60);const hours=Math.floor(estimatedSeconds/3600);const mins=Math.floor((estimatedSeconds%3600)/60);const secs=estimatedSeconds%60;const formattedDuration=hours>0?`${hours}h ${mins}m ${secs}s`:mins>0?`${mins}m ${secs}s`:`${secs}s`;return{wordCount,estimatedSeconds,formattedDuration};
}

/** Legacy 60-Hz step retained for callers/tests; prefer delta-time scrolling below. */
export function calculateScrollStep(speed:number):number{if(speed<=0)return 0;const normalized=Math.max(1,Math.min(100,speed));return 0.2+(normalized/100)**1.5*7.8;}
export function calculateScrollSpeedPixelsPerSecond(speed:number):number{return calculateScrollStep(speed)*60;}
export function calculateScrollDelta(speed:number,deltaMs:number):number{const safeDelta=Math.max(0,Math.min(250,Number.isFinite(deltaMs)?deltaMs:0));return calculateScrollSpeedPixelsPerSecond(speed)*(safeDelta/1000);}
