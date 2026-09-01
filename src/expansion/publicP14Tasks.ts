import type{ToolCategory}from'../types';
export type P14Engine='security'|'web';
export interface PublicP14Task{id:string;name:string;shortName:string;description:string;keywords:string[];engine:P14Engine;category:ToolCategory}
type Raw=[string,string,string,string,P14Engine,ToolCategory];
const RAW:Raw[]=[
['json-structural-diff','JSON Structural Diff','JSON Diff','Compare two JSON values structurally and list added, removed, and changed paths locally.','json compare|json diff|structural diff','security','developer'],
['json-canonicalizer','JSON Sorter & Canonicalizer','JSON Canonicalizer','Recursively sort JSON object keys for deterministic readable or compact output.','json sort|canonical json|stable json','security','developer'],
['jwt-signature-verifier','JWT Signature Verifier','JWT Verify','Verify HS256/384/512 or RS256/384/512 JWT signatures locally with an explicit secret or public key.','jwt verify|jwt signature|jws verification','security','developer'],
['x509-certificate-inspector','PEM / X.509 Certificate Inspector','Certificate Inspector','Inspect local PEM X.509 certificate subjects, issuers, validity, algorithms, serials, and SHA-256 fingerprints.','x509 certificate|pem inspector|ssl certificate','security','developer'],
['csr-decoder','CSR Decoder','CSR Decoder','Decode PKCS#10 certificate signing requests locally to inspect subject and signature/public-key algorithms.','csr decoder|pkcs10|certificate request','security','developer'],
['sri-hash-generator','Subresource Integrity Hash Generator','SRI Generator','Generate SHA-256, SHA-384, or SHA-512 Subresource Integrity values for text or local files.','sri hash|subresource integrity|integrity attribute','security','developer'],
['csp-builder','Content Security Policy Builder','CSP Builder','Build a Content-Security-Policy header from common source directives without sending policy data anywhere.','csp builder|content security policy|security headers','web','developer'],
['pwa-manifest-generator','PWA Web App Manifest Generator','PWA Manifest','Generate a standards-oriented web app manifest with names, display mode, colors, start URL, and icons.','pwa manifest|web app manifest|manifest json','web','developer'],
['json-ld-generator','JSON-LD Schema Markup Generator','JSON-LD Generator','Generate escaped JSON-LD script markup for common schema.org entity types from local form data.','json ld|schema markup|structured data','web','developer'],
['serp-snippet-preview','SERP Snippet Preview','SERP Preview','Preview title, URL, and description text with practical length guidance for search-result snippets.','serp preview|seo snippet|meta description preview','web','design'],
['slug-generator','URL Slug Generator','Slug Generator','Create clean lowercase URL slugs with Unicode normalization, custom separators, and optional transliteration stripping.','slug generator|url slug|seo slug','web','text'],
['hreflang-generator','Hreflang Tag Generator','Hreflang Generator','Generate escaped alternate-language link tags from locale and URL pairs, including optional x-default.','hreflang generator|alternate language|seo localization','web','developer'],
['har-viewer','HAR File Viewer & Summary','HAR Viewer','Inspect HTTP Archive JSON locally with request counts, statuses, domains, transfer sizes, timing, and entry summaries.','har viewer|http archive|network log','web','developer'],
];
export const PUBLIC_P14_TASKS:PublicP14Task[]=RAW.map(([id,name,shortName,description,keys,engine,category])=>({id,name,shortName,description,keywords:keys.split('|'),engine,category}));
export function getPublicP14Task(id:string|null|undefined){return id?PUBLIC_P14_TASKS.find(t=>t.id===id):undefined}
