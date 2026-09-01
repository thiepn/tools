import{lazy}from'react';
import type{ToolDefinition}from'../types';
import{PUBLIC_PRIVACY_DEV_TASKS}from'../privacy-dev/publicPrivacyDevTasks';
import{TOOLS_REGISTRY}from'./tools';
const SecurityPrivacyMicroTools=lazy(()=>import('../tools/privacy-dev/SecurityPrivacyMicroTools'));
const DeveloperMicroTools=lazy(()=>import('../tools/privacy-dev/DeveloperMicroTools'));
const SECURITY_IDS=new Set(['text-hash-generator','file-checksum-generator','checksum-verifier','hmac-generator','text-encryptor','file-encryptor','password-strength-checker','pii-pattern-redactor']);
const TEXT_INPUT_IDS=new Set(['text-hash-generator','hmac-generator','text-encryptor','pii-pattern-redactor','jwt-decoder','text-hex-converter','html-entity-converter']);
const TEXT_OUTPUT_IDS=new Set(['text-hash-generator','checksum-verifier','hmac-generator','text-encryptor','pii-pattern-redactor','uuid-generator','ulid-generator','number-base-converter','text-hex-converter','html-entity-converter']);
export function registerPrivacyDevTools():void{const known=new Set(TOOLS_REGISTRY.map(t=>t.id));for(const task of PUBLIC_PRIVACY_DEV_TASKS){if(known.has(task.id))continue;const security=SECURITY_IDS.has(task.id),definition:ToolDefinition={id:task.id,name:task.name,shortName:task.shortName,description:task.description,category:task.category,keywords:[...task.keywords,task.group,security?'privacy':'developer'],iconName:security?'ShieldCheck':'Code2',route:`/${task.id}`,featured:Boolean(task.featured),acceptsTextTransfer:TEXT_INPUT_IDS.has(task.id),producesTextTransfer:TEXT_OUTPUT_IDS.has(task.id),component:security?SecurityPrivacyMicroTools:DeveloperMicroTools};TOOLS_REGISTRY.push(definition);known.add(task.id)}}
