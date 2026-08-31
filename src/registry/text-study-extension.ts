import{lazy}from'react';
import type{ToolDefinition}from'../types';
import{PUBLIC_TEXT_STUDY_TASKS}from'../text-study/publicTextStudyTasks';
import{TOOLS_REGISTRY}from'./tools';
const TextMicroTools=lazy(()=>import('../tools/text-study/TextMicroTools'));
const StudyMicroTools=lazy(()=>import('../tools/text-study/StudyMicroTools'));
export function registerTextStudyTools():void{const known=new Set(TOOLS_REGISTRY.map(t=>t.id));for(const task of PUBLIC_TEXT_STUDY_TASKS){if(known.has(task.id))continue;const study=task.group==='study'||task.group==='citation',definition:ToolDefinition={id:task.id,name:task.name,shortName:task.shortName,description:task.description,category:task.category,keywords:[...task.keywords,task.group,study?'study':'text'],iconName:study?'GraduationCap':'FileText',route:`/${task.id}`,featured:Boolean(task.featured),acceptsTextTransfer:task.id!=='lorem-ipsum-generator'&&!['spaced-repetition-planner','study-session-planner','reading-plan-divider','citation-formatter'].includes(task.id),producesTextTransfer:['text-repeater','text-reverser','text-wrapper','whitespace-visualizer','lorem-ipsum-generator','markdown-to-plain-text','html-to-plain-text','citation-formatter'].includes(task.id),component:study?StudyMicroTools:TextMicroTools};TOOLS_REGISTRY.push(definition);known.add(task.id)}}
