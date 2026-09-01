import{lazy}from'react';
import{PUBLIC_TEXT_STUDY_TASKS}from'../text-study/publicTextStudyTasks';
import{registerFamily}from'./register-family';
const TextMicroTools=lazy(()=>import('../tools/text-study/TextMicroTools')),StudyMicroTools=lazy(()=>import('../tools/text-study/StudyMicroTools'));
const NO_INPUT=new Set(['lorem-ipsum-generator','spaced-repetition-planner','study-session-planner','reading-plan-divider','citation-formatter']),OUTPUT=new Set(['text-repeater','text-reverser','text-wrapper','whitespace-visualizer','lorem-ipsum-generator','markdown-to-plain-text','html-to-plain-text','citation-formatter']);
export function registerTextStudyTools():void{registerFamily(PUBLIC_TEXT_STUDY_TASKS,null,null,null,t=>{const study=t.group==='study'||t.group==='citation';return{category:t.category,keywords:[...t.keywords,t.group,study?'study':'text'],iconName:study?'GraduationCap':'FileText',acceptsTextTransfer:!NO_INPUT.has(t.id),producesTextTransfer:OUTPUT.has(t.id),component:study?StudyMicroTools:TextMicroTools}})}
