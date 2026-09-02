import{lazy}from'react';
import{PUBLIC_FILE_CONVERSION_TASKS}from'../files/publicFileConversionTasks';
import{registerFamily}from'./register-family';
const FileFormatConversionTool=lazy(()=>import('../tools/file-format-conversion/FileFormatConversionTool')),MainstreamConverters=lazy(()=>import('../tools/converters/MainstreamConverters'));
export function registerFileConversionTools():void{registerFamily(PUBLIC_FILE_CONVERSION_TASKS,'files','FileText',FileFormatConversionTool,t=>({keywords:[...t.keywords,t.group,'file converter','format converter'],component:t.id==='data-converter'||t.id==='archive-converter'?MainstreamConverters:FileFormatConversionTool}))}
