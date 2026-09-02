import type{ToolCategory}from'../types';
export type P16Engine='subtitle'|'transcript';
export interface PublicP16Task{id:string;name:string;shortName:string;description:string;keywords:string[];engine:P16Engine;category:ToolCategory}
type Raw=[string,string,string,string,string,P16Engine,ToolCategory];
const RAW:Raw[]=[
['subtitle-editor','Subtitle Cue Editor','Subtitle Editor','Edit SRT or WebVTT cue text and timing locally in a structured browser workspace.','subtitle editor|srt editor|vtt editor|caption editor','subtitle','media'],
['subtitle-converter','Subtitle Converter','Subtitle Converter','Convert mainstream SRT, WebVTT, ASS, SSA, SBV, TTML/DFXP, and plain transcript text locally in one workspace.','subtitle converter|srt vtt ass ssa sbv ttml dfxp text|vtt srt|ass to srt|srt to ass|ssa to srt|sbv to srt|ttml to srt|dfxp to vtt|srt text|text to subtitles|transcript to srt','subtitle','media'],
['subtitle-time-shifter','Subtitle Time Shifter','Subtitle Shifter','Shift every subtitle cue forward or backward by a precise local time offset.','subtitle delay|subtitle offset|shift srt|sync captions','subtitle','media'],
['subtitle-resynchronizer','Subtitle Drift Resynchronizer','Subtitle Resync','Correct subtitle timing drift locally by mapping the current first and last cue starts onto target anchor times.','subtitle resync|subtitle drift|sync srt|timing anchors','subtitle','media'],
['subtitle-frame-rate-converter','Subtitle Frame-Rate Converter','Subtitle FPS Converter','Rescale subtitle timing locally between source and target frame rates such as 23.976, 24, 25, or 29.97 fps.','subtitle fps|frame rate subtitles|23.976 25|pal speedup','subtitle','media'],
['subtitle-cleaner-validator','Subtitle Cleaner & Validator','Subtitle Validator','Clean subtitle whitespace locally and flag overlaps, invalid durations, long lines, and excessive reading speed.','subtitle validator|clean srt|fix subtitles|caption quality','subtitle','media'],
['subtitle-merger','Subtitle Merger','Merge Subtitles','Merge two local subtitle tracks by timeline, append one after another, or combine paired cues as bilingual subtitles.','merge subtitles|combine srt|bilingual subtitles|join captions','subtitle','media'],
['subtitle-splitter','Subtitle Splitter','Split Subtitles','Split a local subtitle track at a chosen time, with optional rebasing of the second part to zero.','split subtitles|split srt|subtitle segment|caption split','subtitle','media'],
['subtitle-reading-speed-analyzer','Subtitle Reading-Speed Analyzer','Reading Speed Analyzer','Analyze local subtitle cues for characters per second, words per minute, overlaps, and readability timing flags.','subtitle cps|reading speed subtitles|caption analyzer|subtitle wpm','subtitle','media'],
];
export const PUBLIC_P16_TASKS:PublicP16Task[]=RAW.map(([id,name,shortName,description,keys,engine,category])=>({id,name,shortName,description,keywords:keys.split('|'),engine,category}));
export function getPublicP16Task(id:string|null|undefined){return id?PUBLIC_P16_TASKS.find(t=>t.id===id):undefined}
