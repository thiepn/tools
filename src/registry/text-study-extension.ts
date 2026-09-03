import{lazy}from'react';
import{PUBLIC_TEXT_STUDY_TASKS}from'../text-study/publicTextStudyTasks';
import{registerFamily}from'./register-family';
const TextMicroTools=lazy(()=>import('../tools/text-study/TextMicroTools')),StudyMicroTools=lazy(()=>import('../tools/text-study/StudyMicroTools')),TextPowerTools=lazy(()=>import('../tools/s-tier-text/TextPowerTools'));
const POWER=new Set(['text-repeater','text-reverser','text-wrapper','lorem-ipsum-generator']);
const NO_INPUT=new Set(['lorem-ipsum-generator','spaced-repetition-planner','study-session-planner','reading-plan-divider','citation-formatter']),OUTPUT=new Set(['text-repeater','text-reverser','text-wrapper','whitespace-visualizer','lorem-ipsum-generator','markdown-to-plain-text','html-to-plain-text','citation-formatter']);
const DESCRIPTIONS:Record<string,string>={
'text-repeater':'Repeat text up to 10,000 times with separators, numbering, prefixes/suffixes, live output metrics, Unicode-safe limits, and copy-ready output.',
'text-reverser':'Reverse Unicode text by grapheme, words, words within each line, or line order, with a configurable palindrome check and live metrics.',
'text-wrapper':'Reflow text with soft word-boundary or hard grapheme-aware wrapping, custom line widths, indentation, paragraph preservation, and output metrics.',
'lorem-ipsum-generator':'Generate reproducible seeded Lorem Ipsum by words, sentences, or paragraphs with configurable sentence structure, classic opening, and live metrics.'};
export function registerTextStudyTools():void{registerFamily(PUBLIC_TEXT_STUDY_TASKS,null,null,null,t=>{const study=t.group==='study'||t.group==='citation',power=POWER.has(t.id);return{category:t.category,description:DESCRIPTIONS[t.id]??t.description,keywords:[...t.keywords,t.group,study?'study':'text',...(power?['unicode aware','advanced text tool']:[])],iconName:study?'GraduationCap':'FileText',acceptsTextTransfer:!NO_INPUT.has(t.id),producesTextTransfer:OUTPUT.has(t.id),component:power?TextPowerTools:study?StudyMicroTools:TextMicroTools,featured:power||Boolean(t.featured)}})}
