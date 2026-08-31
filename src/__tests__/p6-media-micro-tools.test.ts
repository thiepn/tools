import{describe,expect,it}from'vitest';
import{PUBLIC_MEDIA_TASKS}from'../media/publicMediaTasks';
import{registerPdfPublicTools}from'../registry/pdf-extension';
import{registerDeviceDiagnosticTools}from'../registry/device-extension';
import{registerCalculatorTools}from'../registry/calculator-extension';
import{registerFileConversionTools}from'../registry/file-conversion-extension';
import{registerImageMicroTools}from'../registry/image-micro-extension';
import{registerMediaMicroTools}from'../registry/media-micro-extension';
import{TOOLS_REGISTRY}from'../registry/tools';
import{dbToGain,downmixChannels,estimateLoopedDuration,joinedAudioDuration,mediaExtensionFromMime,parseSubtitleCues,parseSubtitleTimestamp,planVideoFrameTimes,playbackRateForSemitones,reverseSamples,sanitizeMediaBaseName,softNoiseGateSample,subtitleAtTime}from'../utilities/media-micro-tools';

registerPdfPublicTools();registerDeviceDiagnosticTools();registerCalculatorTools();registerFileConversionTools();registerImageMicroTools();registerMediaMicroTools();

describe('P6 public media catalog',()=>{
  it('contains 29 unique audio/video micro-routes',()=>{expect(PUBLIC_MEDIA_TASKS).toHaveLength(29);expect(new Set(PUBLIC_MEDIA_TASKS.map(t=>t.id)).size).toBe(29);expect(PUBLIC_MEDIA_TASKS.filter(t=>t.engine==='audio')).toHaveLength(12);expect(PUBLIC_MEDIA_TASKS.filter(t=>t.engine==='video')).toHaveLength(17);for(const task of PUBLIC_MEDIA_TASKS)expect(TOOLS_REGISTRY.some(t=>t.id===task.id&&t.category==='media')).toBe(true);});
  it('does not claim unsupported GIF-to-video or stabilization engines',()=>{const ids=new Set(PUBLIC_MEDIA_TASKS.map(t=>t.id));expect(ids.has('gif-to-mp4')).toBe(false);expect(ids.has('video-stabilizer')).toBe(false);});
  it('keeps browser and signal-processing claims explicit',()=>{expect(PUBLIC_MEDIA_TASKS.find(t=>t.id==='audio-speed-changer')?.description).toContain('changes pitch together with speed');expect(PUBLIC_MEDIA_TASKS.find(t=>t.id==='audio-noise-cleanup')?.description).toContain('not AI');expect(PUBLIC_MEDIA_TASKS.find(t=>t.id==='video-converter')?.description).toContain('supported by the current browser');expect(PUBLIC_MEDIA_TASKS.find(t=>t.id==='video-compressor')?.description).toContain('real-time');});
});

describe('P6 subtitle and timeline helpers',()=>{
  it('parses SRT and WebVTT timing',()=>{expect(parseSubtitleTimestamp('01:02:03,500')).toBe(3723.5);const srt=parseSubtitleCues('1\n00:00:01,000 --> 00:00:03,500\nHello <b>world</b>\n\n2\n00:00:04.000 --> 00:00:05.000\nAgain');expect(srt).toEqual([{start:1,end:3.5,text:'Hello world'},{start:4,end:5,text:'Again'}]);const vtt=parseSubtitleCues('WEBVTT\n\n00:00:00.500 --> 00:00:01.500\nHi');expect(vtt).toEqual([{start:.5,end:1.5,text:'Hi'}]);});
  it('selects active subtitle cues at boundaries',()=>{const cues=[{start:1,end:2,text:'one'},{start:2,end:3,text:'two'}];expect(subtitleAtTime(cues,.99)).toBe('');expect(subtitleAtTime(cues,1)).toBe('one');expect(subtitleAtTime(cues,2)).toBe('two');expect(subtitleAtTime(cues,3)).toBe('');});
  it('samples bounded, evenly spaced frame times',()=>{expect(planVideoFrameTimes(10,3)).toEqual([0,5,10]);expect(planVideoFrameTimes(10,1,2,8)).toEqual([5]);expect(planVideoFrameTimes(10,999)).toHaveLength(240);});
});

describe('P6 audio math helpers',()=>{
  it('maps semitones and dB to expected ratios',()=>{expect(playbackRateForSemitones(12)).toBeCloseTo(2,10);expect(playbackRateForSemitones(-12)).toBeCloseTo(.5,10);expect(dbToGain(0)).toBeCloseTo(1,10);expect(dbToGain(6)).toBeCloseTo(1.995262,5);});
  it('computes joined and looped durations safely',()=>{expect(joinedAudioDuration([1,2,3])).toBe(6);expect(joinedAudioDuration([1,-2,NaN,3])).toBe(4);expect(estimateLoopedDuration(5,3,2)).toBe(7.5);});
  it('downmixes, reverses, and gates samples deterministically',()=>{expect([...downmixChannels([new Float32Array([1,.5]),new Float32Array([-1,.5])])]).toEqual([0,.5]);expect([...reverseSamples(new Float32Array([1,2,3]))]).toEqual([3,2,1]);expect(Math.abs(softNoiseGateSample(.001,-40))).toBeLessThan(.001);expect(softNoiseGateSample(.5,-40)).toBe(.5);});
});

describe('P6 media naming helpers',()=>{
  it('sanitizes names and maps browser containers',()=>{expect(sanitizeMediaBaseName('my:clip?.MP4')).toBe('my-clip-');expect(sanitizeMediaBaseName('.mp4')).toBe('media');expect(mediaExtensionFromMime('video/mp4;codecs=avc1')).toBe('mp4');expect(mediaExtensionFromMime('video/webm')).toBe('webm');expect(mediaExtensionFromMime('image/gif')).toBe('gif');});
});
