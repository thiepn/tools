/** Metronome & Tap Tempo Utilities */
export type TimeSignature='2/4'|'3/4'|'4/4'|'5/4'|'6/8'|'7/8';
export type Subdivision='quarter'|'eighth'|'triplet'|'sixteenth';
export interface TimeSignatureDetails{beatsPerMeasure:number;beatUnit:number;name:string;}
export const TIME_SIGNATURES:Record<TimeSignature,TimeSignatureDetails>={
 '2/4':{beatsPerMeasure:2,beatUnit:4,name:'2/4 (Duple)'},'3/4':{beatsPerMeasure:3,beatUnit:4,name:'3/4 (Waltz / Triple)'},'4/4':{beatsPerMeasure:4,beatUnit:4,name:'4/4 (Common Time)'},'5/4':{beatsPerMeasure:5,beatUnit:4,name:'5/4 (Odd Meter)'},'6/8':{beatsPerMeasure:6,beatUnit:8,name:'6/8 (Compound Duple)'},'7/8':{beatsPerMeasure:7,beatUnit:8,name:'7/8 (Complex)'}
};
export const SUBDIVISION_FACTORS:Record<Subdivision,number>={quarter:1,eighth:2,triplet:3,sixteenth:4};

function median(values:number[]):number{const sorted=[...values].sort((a,b)=>a-b);const mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}
export function calculateTapTempo(tapTimesMs:number[]):{bpm:number|null;tapCount:number;stability?:number}{
 if(tapTimesMs.length<2)return{bpm:null,tapCount:tapTimesMs.length,stability:0};const intervals:number[]=[];for(let i=1;i<tapTimesMs.length;i++){const diff=tapTimesMs[i]-tapTimesMs[i-1];if(Number.isFinite(diff)&&diff>=180&&diff<=2500)intervals.push(diff);}if(!intervals.length)return{bpm:null,tapCount:tapTimesMs.length,stability:0};const recent=intervals.slice(-8);const center=median(recent);const deviations=recent.map(value=>Math.abs(value-center));const mad=median(deviations);const tolerance=Math.max(35,mad*3);const filtered=recent.filter(value=>Math.abs(value-center)<=tolerance);const robust=filtered.length?filtered:recent;const average=robust.reduce((sum,value)=>sum+value,0)/robust.length;const bpm=Math.round(Math.max(30,Math.min(300,60000/average)));const stability=Math.round(Math.max(0,Math.min(100,100-(mad/Math.max(1,center))*400)));return{bpm,tapCount:tapTimesMs.length,stability};
}
export function calculateBeatIntervalMs(bpm:number,subdivision:Subdivision='quarter'):number{const safe=Math.max(30,Math.min(300,Number.isFinite(bpm)?bpm:120));return 60000/safe/SUBDIVISION_FACTORS[subdivision];}

export class MetronomeEngine{
 private audioCtx:AudioContext|null=null;private isRunning=false;private bpm=120;private timeSignature:TimeSignature='4/4';private subdivision:Subdivision='quarter';private accentFirstBeat=true;private volume=.8;private currentSubdivisionIndex=0;private nextNoteTime=0;private timerWorkerId:number|null=null;private onBeatCallback?: (beatInMeasure:number,isAccent:boolean)=>void;
 private initAudio(){if(!this.audioCtx){const Ctx=window.AudioContext||(window as unknown as{webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(!Ctx)throw new Error('Web Audio is unavailable.');this.audioCtx=new Ctx();}if(this.audioCtx.state==='suspended')void this.audioCtx.resume();}
 public setParams(params:{bpm?:number;timeSignature?:TimeSignature;subdivision?:Subdivision;accentFirstBeat?:boolean;volume?:number}){if(params.bpm!==undefined)this.bpm=Math.max(30,Math.min(300,params.bpm));if(params.timeSignature)this.timeSignature=params.timeSignature;if(params.subdivision)this.subdivision=params.subdivision;if(params.accentFirstBeat!==undefined)this.accentFirstBeat=params.accentFirstBeat;if(params.volume!==undefined)this.volume=Math.max(0,Math.min(1,params.volume));}
 public setOnBeatCallback(cb:(beatInMeasure:number,isAccent:boolean)=>void){this.onBeatCallback=cb;}
 public start(){if(this.isRunning)return;this.initAudio();if(!this.audioCtx)return;this.isRunning=true;this.currentSubdivisionIndex=0;this.nextNoteTime=this.audioCtx.currentTime+.05;const lookaheadMs=25,scheduleAhead=.18;const scheduler=()=>{if(!this.isRunning||!this.audioCtx)return;
   // If a background tab throttled timers, skip stale notes instead of firing a
   // burst on resume. The musical phase restarts cleanly from the next tick.
   if(this.nextNoteTime<this.audioCtx.currentTime-.05){this.nextNoteTime=this.audioCtx.currentTime+.02;this.currentSubdivisionIndex=0;}
   while(this.nextNoteTime<this.audioCtx.currentTime+scheduleAhead){this.scheduleNote(this.nextNoteTime);this.advanceNote();}this.timerWorkerId=window.setTimeout(scheduler,lookaheadMs);};scheduler();}
 public stop(){this.isRunning=false;if(this.timerWorkerId!==null){clearTimeout(this.timerWorkerId);this.timerWorkerId=null;}}
 public destroy(){this.stop();if(this.audioCtx){void this.audioCtx.close().catch(()=>{});this.audioCtx=null;}}
 private advanceNote(){this.nextNoteTime+=calculateBeatIntervalMs(this.bpm,this.subdivision)/1000;this.currentSubdivisionIndex++;}
 private scheduleNote(time:number){if(!this.audioCtx)return;const details=TIME_SIGNATURES[this.timeSignature],factor=SUBDIVISION_FACTORS[this.subdivision],measureIndex=this.currentSubdivisionIndex%(details.beatsPerMeasure*factor),isMainBeat=measureIndex%factor===0,beat=Math.floor(measureIndex/factor),isAccent=this.accentFirstBeat&&measureIndex===0;if(this.onBeatCallback&&isMainBeat){const delay=Math.max(0,(time-this.audioCtx.currentTime)*1000);window.setTimeout(()=>{if(this.isRunning)this.onBeatCallback?.(beat,isAccent);},delay);}const osc=this.audioCtx.createOscillator(),gain=this.audioCtx.createGain();osc.connect(gain);gain.connect(this.audioCtx.destination);if(isAccent){osc.frequency.setValueAtTime(1400,time);gain.gain.setValueAtTime(this.volume,time);gain.gain.exponentialRampToValueAtTime(.001,time+.05);}else if(isMainBeat){osc.frequency.setValueAtTime(880,time);gain.gain.setValueAtTime(this.volume*.7,time);gain.gain.exponentialRampToValueAtTime(.001,time+.04);}else{osc.frequency.setValueAtTime(550,time);gain.gain.setValueAtTime(this.volume*.35,time);gain.gain.exponentialRampToValueAtTime(.001,time+.025);}osc.start(time);osc.stop(time+.06);}
}
