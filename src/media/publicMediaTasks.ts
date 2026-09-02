export type PublicMediaEngine='audio'|'video';
export interface PublicMediaTask{id:string;name:string;shortName:string;description:string;keywords:string[];engine:PublicMediaEngine;featured?:boolean;}
type Raw=[string,string,string,string?,boolean?];
const A:Raw[]=[
['audio-joiner','Audio Joiner','Join audio files; export WAV.','combine audio',true],
['audio-converter','Audio Converter','Convert common browser-decodable audio to WAV or AIFF PCM, plus compressed formats exposed by the current browser encoder.','audio converter mp3 wav wave aiff aif m4a aac ogg oga opus flac webm wma mp3 to wav wav to aiff aiff to wav flac to wav m4a to mp3',true],
['audio-volume-changer','Audio Volume Changer','Change gain; export WAV.','louder'],
['audio-speed-changer','Audio Speed Changer','Change speed; changes pitch together with speed.','slow down'],
['audio-normalizer','Audio Normalizer','Normalize peaks and remove DC offset.','',true],
['silence-trimmer','Silence Trimmer','Detect and trim edge silence.','trim silence',true],
['audio-equalizer','Audio Equalizer','Apply bass, mid and treble EQ.','bass treble'],
['reverse-audio','Reverse Audio','Reverse decoded audio samples.','backwards'],
['audio-noise-cleanup','Basic Audio Noise Cleanup','Filter and gate noise; basic cleanup, not AI separation.','noise reduction'],
['stereo-mono-converter','Stereo ↔ Mono Converter','Downmix to mono or duplicate mono to stereo.'],
['ringtone-maker','Ringtone Maker','Trim a short section with fades; export WAV.','phone ringtone'],
['audio-pitch-speed-shifter','Audio Pitch & Speed Shifter','Transpose by playback rate; pitch and duration change together.','semitones'],
];
const V:Raw[]=[
['merge-videos','Merge Videos','Join decodable clips with local real-time rendering.','combine clips',true],
['video-compressor','Video Compressor','Compress via local real-time resize and bitrate encoding.','reduce size',true],
['video-converter','Video Converter','Convert common browser-decodable MP4, MOV/M4V, WebM, MKV, AVI, MPEG/MPG, 3GP, WMV, or FLV sources to a local MediaRecorder output supported by the current browser.','video converter mp4 webm mov m4v mkv avi mpeg mpg 3gp wmv flv mp4 to webm webm to mp4 mov to mp4 mkv to mp4 avi to mp4',true],
['video-to-audio','Video to Audio / WAV','Extract decodable video audio to PCM WAV.','',true],
['add-audio-to-video','Add Audio to Video','Mix another decoded audio track into video.','music'],
['add-text-to-video','Add Text to Video','Burn static text into video frames.','caption'],
['loop-video','Loop Video','Repeat a clip into one video.'],
['video-to-frames','Video to Frames','Export evenly spaced PNG frames as ZIP.','screenshots'],
['video-thumbnail-extractor','Video Thumbnail Extractor','Export an exact video frame as PNG.','screenshot',true],
['webcam-video-recorder','Webcam Video Recorder','Record camera and microphone locally.','',true],
['add-logo-to-video','Add Image / Logo to Video','Overlay a local image or logo.','watermark'],
['subtitle-burner','Subtitle Burner','Burn SRT/WebVTT cues into video.','srt to video subtitles captions burn'],
['video-to-gif','Video GIF Maker','Create a short animated GIF from a local video clip.','video gif maker animated gif'],
['video-speed-changer','Video Speed Changer','Change speed with real-time rendering.','slow motion'],
['crop-resize-video','Crop & Resize Video','Crop common ratios and resize.','vertical'],
['mute-video','Mute Video','Remove the source audio track.'],
['video-volume-changer','Video Volume Changer','Adjust source-audio gain during rendering.','louder'],
];
const expand=(rows:Raw[],engine:PublicMediaEngine):PublicMediaTask[]=>rows.map(([id,name,description,key,featured])=>({id,name,shortName:name,description,keywords:key?[key]:[],engine,featured}));
export const PUBLIC_MEDIA_TASKS:PublicMediaTask[]=[...expand(A,'audio'),...expand(V,'video')];
export function getPublicMediaTask(id:string|null|undefined){return PUBLIC_MEDIA_TASKS.find(task=>task.id===id);}
