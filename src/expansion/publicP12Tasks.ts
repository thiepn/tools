import type{ToolCategory}from'../types';
export type P12Engine='developer'|'web';
export interface PublicP12Task{id:string;name:string;shortName:string;description:string;keywords:string[];engine:P12Engine;category:ToolCategory}
type Raw=[string,string,string,P12Engine,ToolCategory];
const RAW:Raw[]=[
['xml-formatter','XML Formatter & Validator','xml formatter validator','developer','developer'],
['url-parser','URL Parser','url parser components','developer','developer'],
['query-string-tool','Query String Parser & Builder','query string url parameters','developer','developer'],
['semver-comparator','Semantic Version Comparator','semver semantic version compare','developer','developer'],
['chmod-calculator','chmod Permission Calculator','chmod permissions octal rwx','developer','developer'],
['json-to-typescript','JSON → TypeScript Generator','json typescript interface type','developer','developer'],
['http-header-parser','HTTP Header Parser','http headers request response parser','developer','developer'],
['mime-type-lookup','MIME Type Lookup','mime content type extension','developer','developer'],
['unicode-normalizer','Unicode Normalizer','unicode nfc nfd nfkc nfkd','developer','text'],
['dotenv-formatter','.env Formatter & Parser','dotenv env formatter parser','developer','developer'],
['html-minifier','HTML Minifier','html minifier compress markup','developer','developer'],
['meta-tags-generator','HTML Meta Tags Generator','meta tags seo title description canonical','web','developer'],
['open-graph-generator','Open Graph & Social Meta Generator','open graph og twitter card social meta','web','developer'],
['color-contrast-checker','Color Contrast Checker','wcag contrast accessibility colors','web','design'],
['css-gradient-generator','CSS Gradient Generator','css gradient linear radial','web','design'],
['box-shadow-generator','CSS Box Shadow Generator','box shadow css generator','web','design'],
['css-clamp-calculator','CSS clamp() Calculator','css clamp fluid typography responsive','web','design'],
['html-table-generator','HTML Table Generator','html table csv tsv generator','web','developer'],
];
export const PUBLIC_P12_TASKS:PublicP12Task[]=RAW.map(([id,name,key,engine,category])=>({id,name,shortName:name,description:`Local ${name.toLowerCase()} with deterministic browser-only processing and documented scope.`,keywords:[key],engine,category}));
export function getPublicP12Task(id:string|null|undefined){return id?PUBLIC_P12_TASKS.find(t=>t.id===id):undefined}
