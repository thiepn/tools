import type{ToolCategory}from'../types';
export type P11Engine='developer'|'math'|'web';
export interface PublicP11Task{id:string;name:string;shortName:string;description:string;keywords:string[];engine:P11Engine;category:ToolCategory}
type Raw=[string,string,string,P11Engine,ToolCategory];
const RAW:Raw[]=[
['yaml-formatter','YAML Formatter & Validator','yaml formatter','developer','developer'],
['toml-formatter','TOML Formatter & Validator','toml formatter','developer','developer'],
['sql-formatter','SQL Formatter & Minifier','sql formatter','developer','developer'],
['json-schema-validator','JSON Schema Validator','json schema','developer','developer'],
['jsonpath-tester','JSONPath Tester','jsonpath','developer','developer'],
['base-encoding-converter','Base32 / Base58 / Base85 Converter','base32 base58 base85','developer','developer'],
['file-base64-converter','File ↔ Base64 Converter','file base64','developer','files'],
['cidr-subnet-calculator','CIDR / Subnet Calculator','subnet calculator','developer','developer'],
['user-agent-parser','User-Agent Parser','user agent','developer','developer'],
['utm-link-builder','UTM Link Builder','utm builder','developer','developer'],
['matrix-calculator','Matrix Calculator','matrix calculator','math','math'],
['combinations-permutations-calculator','Combinations & Permutations Calculator','ncr npr','math','math'],
['normal-distribution-calculator','Normal Distribution & Z-Score Calculator','normal z score','math','math'],
['linear-regression-calculator','Correlation & Linear Regression Calculator','linear regression','math','math'],
['gcd-lcm-prime-factorization','GCD, LCM & Prime Factorization','gcd lcm factors','math','math'],
['complex-number-calculator','Complex Number Calculator','complex numbers','math','math'],
['quadratic-solver','Quadratic Equation Solver','quadratic solver','math','math'],
['vector-calculator','Vector Calculator','vector calculator','math','math'],
['svg-optimizer','SVG Optimizer & Minifier','svg optimizer','web','design'],
['dpi-print-size-calculator','DPI & Print Size Calculator','dpi print size','web','design'],
['color-blindness-simulator','Color-Blindness Simulator','color blindness','web','design'],
['robots-txt-builder','robots.txt Builder','robots generator','web','developer'],
['sitemap-xml-builder','Sitemap XML Builder','sitemap generator','web','developer'],
['vcard-generator','vCard / VCF Contact Generator','vcard generator','web','everyday'],
['totp-generator','TOTP / 2FA Code Generator','totp generator','web','developer'],
['css-minifier','CSS Minifier','css minifier','web','developer'],
];
export const PUBLIC_P11_TASKS:PublicP11Task[]=RAW.map(([id,name,key,engine,category])=>({id,name,shortName:name,description:`Local ${name.toLowerCase()} with documented scope and browser-only processing.`,keywords:[key],engine,category}));
export function getPublicP11Task(id:string|null|undefined){return id?PUBLIC_P11_TASKS.find(t=>t.id===id):undefined}
