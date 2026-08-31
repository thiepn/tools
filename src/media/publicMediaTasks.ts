export type PublicMediaEngine='audio'|'video';
export interface PublicMediaTask{id:string;name:string;shortName:string;description:string;keywords:string[];engine:PublicMediaEngine;featured?:boolean;}
type RawTask=[string,string,string,string,PublicMediaEngine,string?,boolean?];
const RAW:RawTask[]=[
['audio-joiner','Audio Joiner','Join decoded audio files and export local WAV.','merge audio|combine audio','audio','',true],
['audio-to-wav-converter','Audio to WAV Converter','Convert browser-decodable audio to PCM WAV.','mp3 to wav|audio converter','audio','Audio to WAV',true],
['audio-volume-changer','Audio Volume Changer','Change audio gain and export WAV.','louder audio|quieter audio','audio','Volume Changer'],
['audio-speed-changer','Audio Speed Changer','Change speed locally; this method changes pitch together with speed.','speed up audio|slow down audio','audio','Audio Speed'],
['audio-normalizer','Audio Normalizer','Normalize peak level, remove DC offset, and export WAV.','normalize audio|peak normalize','audio','Normalize Audio',true],
['silence-trimmer','Silence Trimmer','Detect and trim leading and trailing silence.','remove silence|trim silence','audio','Trim Silence',true],
['audio-equalizer','Audio Equalizer','Apply local bass, mid, and treble EQ.','bass treble|audio eq','audio','Audio EQ'],
['reverse-audio','Reverse Audio','Reverse decoded audio samples and export WAV.','audio backwards','audio'],
['audio-noise-cleanup','Basic Audio Noise Cleanup','Apply local filters and a soft gate; basic cleanup, not AI separation.','noise reduction|noise gate','audio','Noise Cleanup'],
['stereo-mono-converter','Stereo ↔ Mono Converter','Downmix to mono or duplicate mono into stereo.','stereo to mono|mono to stereo','audio','Stereo / Mono'],
['ringtone-maker','Ringtone Maker','Trim a short section with optional fades; export WAV.','trim ringtone|phone ringtone','audio'],
['audio-pitch-speed-shifter','Audio Pitch & Speed Shifter','Transpose by playback rate; pitch and duration change together.','pitch changer|semitones','audio','Pitch / Speed'],
['merge-videos','Merge Videos','Join browser-decodable clips with local real-time rendering.','join videos|combine clips','video','',true],
['video-compressor','Video Compressor','Compress video with local real-time resize and bitrate encoding.','compress video|reduce video size','video','Compress Video',true],
['video-converter','Video Converter','Convert video to a MediaRecorder format supported by the current browser.','mp4 to webm|webm to mp4','video','',true],
['video-to-audio','Video to Audio / WAV','Extract decodable video audio to PCM WAV.','extract audio|video to wav','video','Video to Audio',true],
['add-audio-to-video','Add Audio to Video','Mix another decoded audio track into video locally.','add music to video|background music','video','Add Audio'],
['add-text-to-video','Add Text to Video','Burn a static text caption into video frames.','caption video|text overlay','video','Video Text'],
['loop-video','Loop Video','Repeat a clip and export one locally rendered video.','repeat video','video'],
['video-to-frames','Video to Frames','Extract evenly spaced PNG frames into a ZIP.','extract frames|video screenshots','video','Video Frames'],
['video-thumbnail-extractor','Video Thumbnail Extractor','Export a frame at an exact timestamp as PNG.','video screenshot|extract frame','video','Video Thumbnail',true],
['webcam-video-recorder','Webcam Video Recorder','Record camera and microphone in a browser-supported format.','webcam recorder|record webcam','video','Webcam Recorder',true],
['add-logo-to-video','Add Image / Logo to Video','Overlay a local image or logo during video export.','watermark video|logo overlay','video','Video Logo'],
['subtitle-burner','Subtitle Burner','Burn parsed SRT or WebVTT cues into video frames.','burn subtitles|srt to video','video','Burn Subtitles'],
['video-to-gif','Video to GIF','Sample a short clip and encode an animated GIF locally.','mp4 to gif|webm to gif','video'],
['video-speed-changer','Video Speed Changer','Change video speed with local real-time rendering.','speed up video|slow motion video','video','Video Speed'],
['crop-resize-video','Crop & Resize Video','Crop common aspect ratios and resize before export.','crop video|vertical video','video','Crop Video'],
['mute-video','Mute Video','Remove the source audio track during re-encoding.','remove audio from video|silent video','video'],
['video-volume-changer','Video Volume Changer','Adjust source-audio gain during local video rendering.','video volume|video louder','video','Video Volume'],
];
export const PUBLIC_MEDIA_TASKS:PublicMediaTask[]=RAW.map(([id,name,description,keys,engine,shortName,featured])=>({id,name,shortName:shortName||name,description,keywords:keys.split('|'),engine,featured}));
export function getPublicMediaTask(id:string|null|undefined){return PUBLIC_MEDIA_TASKS.find(task=>task.id===id);}
