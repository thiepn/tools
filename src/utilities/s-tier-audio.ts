export interface ReverseAudioOptions{startSeconds:number;endSeconds:number;fadeMs:number;normalizePeak:boolean;}
export interface AudioProcessSummary{startSample:number;endSample:number;reversedSamples:number;peakBefore:number;peakAfter:number;gainApplied:number;}
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
export function peakAmplitude(channels:Float32Array[]):number{let peak=0;for(const channel of channels)for(const sample of channel)peak=Math.max(peak,Math.abs(sample));return peak;}
export function processReverseChannels(channels:Float32Array[],sampleRate:number,options:ReverseAudioOptions):{channels:Float32Array[];summary:AudioProcessSummary}{
 if(!channels.length)throw new Error('Audio has no channels.');if(!Number.isFinite(sampleRate)||sampleRate<=0)throw new Error('Sample rate must be positive.');const length=Math.min(...channels.map(c=>c.length));if(!length)throw new Error('Audio has no samples.');
 const duration=length/sampleRate;const start=clamp(Number.isFinite(options.startSeconds)?options.startSeconds:0,0,duration);const end=clamp(Number.isFinite(options.endSeconds)?options.endSeconds:duration,start,duration);const startSample=Math.floor(start*sampleRate),endSample=Math.min(length,Math.ceil(end*sampleRate));if(endSample<=startSample)throw new Error('Reverse selection must contain at least one sample.');
 const before=peakAmplitude(channels);const out=channels.map(source=>{const dest=new Float32Array(source);let left=startSample,right=endSample-1;while(left<right){const tmp=dest[left];dest[left]=dest[right];dest[right]=tmp;left++;right--;}return dest;});
 const fadeSamples=Math.min(Math.floor(Math.max(0,options.fadeMs)*sampleRate/1000),Math.floor((endSample-startSample)/2));if(fadeSamples>0){for(const channel of out){for(let i=0;i<fadeSamples;i++){const factor=(i+1)/(fadeSamples+1);channel[startSample+i]*=factor;channel[endSample-1-i]*=factor;}}}
 let gain=1;if(options.normalizePeak){const peak=peakAmplitude(out);if(peak>0){gain=Math.min(8,0.98/peak);for(const channel of out)for(let i=0;i<channel.length;i++)channel[i]*=gain;}}
 return{channels:out,summary:{startSample,endSample,reversedSamples:endSample-startSample,peakBefore:before,peakAfter:peakAmplitude(out),gainApplied:gain}};
}

export function encodePcm16Wav(channels:Float32Array[],sampleRate:number):Blob{
 if(!channels.length)throw new Error('No channels to encode.');const length=Math.min(...channels.map(c=>c.length)),channelCount=channels.length,bytesPerSample=2,blockAlign=channelCount*bytesPerSample,dataSize=length*blockAlign;const buffer=new ArrayBuffer(44+dataSize),view=new DataView(buffer);let offset=0;
 const str=(value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset++,value.charCodeAt(i));};const u16=(v:number)=>{view.setUint16(offset,v,true);offset+=2};const u32=(v:number)=>{view.setUint32(offset,v,true);offset+=4};str('RIFF');u32(36+dataSize);str('WAVE');str('fmt ');u32(16);u16(1);u16(channelCount);u32(sampleRate);u32(sampleRate*blockAlign);u16(blockAlign);u16(16);str('data');u32(dataSize);
 for(let i=0;i<length;i++)for(let c=0;c<channelCount;c++){const sample=clamp(channels[c][i]??0,-1,1);view.setInt16(offset,sample<0?sample*0x8000:sample*0x7fff,true);offset+=2;}
 return new Blob([buffer],{type:'audio/wav'});
}
export function formatAudioTime(seconds:number){const safe=Math.max(0,Number.isFinite(seconds)?seconds:0),m=Math.floor(safe/60),s=safe-m*60;return`${m}:${s.toFixed(2).padStart(5,'0')}`;}
