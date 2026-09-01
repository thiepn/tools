import type{ToolCategory}from'../types';
export type PrivacyDevGroup='security'|'privacy'|'developer';
export interface PublicPrivacyDevTask{id:string;name:string;shortName:string;description:string;keywords:string[];group:PrivacyDevGroup;category:ToolCategory;featured?:boolean}
type Raw=[string,string,string,string,PrivacyDevGroup,ToolCategory,string?,boolean?];
const RAW:Raw[]=[
['text-hash-generator','Text Hash Generator','Create SHA-256, SHA-384, or SHA-512 digests from text locally.','text hash|sha256 text|sha512|digest','security','developer','Text Hash',true],
['file-checksum-generator','File Checksum Generator','Calculate SHA-256, SHA-384, or SHA-512 checksums for a local file.','file checksum|sha256 file|file hash|verify download','security','files','File Checksum',true],
['checksum-verifier','Checksum Verifier','Compare a local file against an expected SHA-256, SHA-384, or SHA-512 checksum.','verify checksum|check sha256|file integrity|checksum compare','security','files','Verify Checksum',true],
['hmac-generator','HMAC Generator','Create keyed HMAC-SHA digests from a message and secret key using Web Crypto.','hmac generator|hmac sha256|message authentication|web crypto','security','developer','HMAC'],
['text-encryptor','Text Encrypt & Decrypt','Encrypt or decrypt portable text envelopes with PBKDF2 and AES-256-GCM locally.','encrypt text|decrypt text|aes gcm|pbkdf2|private text','security','productivity','Text Encrypt',true],
['file-encryptor','File Encrypt & Decrypt','Encrypt or decrypt local files with a password-derived AES-256-GCM key.','encrypt file|decrypt file|aes file|password protect file','security','files','File Encrypt',true],
['password-strength-checker','Password Strength Checker','Inspect password length, character variety, repetition, and local heuristic entropy without transmitting it.','password strength|password checker|entropy|weak password','security','productivity','Password Strength',true],
['pii-pattern-redactor','PII Pattern Finder & Redactor','Find and redact common email, phone-like, IPv4, and payment-card patterns in pasted text.','pii redactor|redact personal data|email redactor|phone redactor|privacy','privacy','productivity','PII Redactor',true],
['uuid-generator','UUID Generator','Generate cryptographically random UUID v4 or time-ordered UUID v7 identifiers locally.','uuid generator|uuid v4|uuid v7|guid','developer','developer','UUID Generator',true],
['ulid-generator','ULID Generator','Generate sortable timestamp-based ULIDs with cryptographic random bytes.','ulid generator|sortable id|crockford base32','developer','developer','ULID Generator'],
['jwt-decoder','JWT Decoder & Inspector','Decode JWT header and payload fields locally without claiming signature verification.','jwt decoder|json web token|decode token|jwt payload','developer','developer','JWT Decoder',true],
['unix-timestamp-converter','Unix Timestamp Converter','Convert Unix seconds or milliseconds to dates and convert date strings back to epoch values.','unix timestamp|epoch converter|timestamp to date|date to epoch','developer','time','Unix Timestamp',true],
['number-base-converter','Number Base Converter','Convert signed integers exactly between bases 2 through 36 using BigInt.','binary decimal hex converter|base converter|hex decimal|radix','developer','developer','Base Converter',true],
['text-hex-converter','Text ↔ Hex Converter','Convert UTF-8 text to hexadecimal bytes or decode valid hexadecimal back to text.','text to hex|hex to text|utf8 hex|hexadecimal','developer','developer','Text ↔ Hex'],
['html-entity-converter','HTML Entity Encoder & Decoder','Encode HTML-sensitive characters or decode common named and numeric HTML entities.','html entities|html encode|html decode|escape html','developer','developer','HTML Entities'],
['cron-expression-helper','Cron Expression Helper','Validate standard five-field cron expressions and preview upcoming browser-local matches.','cron expression|cron helper|cron schedule|crontab','developer','developer','Cron Helper',true],
];
export const PUBLIC_PRIVACY_DEV_TASKS:PublicPrivacyDevTask[]=RAW.map(([id,name,description,keys,group,category,shortName,featured])=>({id,name,shortName:shortName||name,description,keywords:keys.split('|'),group,category,featured}));
export function getPublicPrivacyDevTask(id:string|null|undefined){return id?PUBLIC_PRIVACY_DEV_TASKS.find(t=>t.id===id):undefined}
