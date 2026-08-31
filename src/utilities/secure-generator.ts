import { EFF_WORD_LIST } from './eff-wordlist';

export type GeneratorMode = 'password' | 'passphrase' | 'pin' | 'random-string';
export interface PasswordConfig { length:number; useUpper:boolean; useLower:boolean; useNumbers:boolean; useSymbols:boolean; excludeAmbiguous:boolean; ensureEachType:boolean; }
export interface PassphraseConfig { wordCount:number; separator:'-'|' '|'_'|'.'|''; capitalization:'lower'|'upper'|'title'|'camel'; includeNumber:boolean; includeSymbol?:boolean; }
export interface PinConfig { length:number; avoidTrivial:boolean; }
export interface RandomStringConfig { length:number; preset:'alphanumeric'|'hex'|'alphanumeric-symbols'|'custom'; customCharset:string; }

const UPPERCASE_CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE_CHARS='abcdefghijklmnopqrstuvwxyz';
const NUMBER_CHARS='0123456789';
const SYMBOL_CHARS='!@#$%^&*()_+-=[]{}|;:,.<>?';
const PASSPHRASE_SYMBOLS='!@#$%^&*?';
const AMBIGUOUS_CHARS='0O1lI|';
const HEX_CHARS='0123456789abcdef';
const UINT32_RANGE=0x100000000;

export function getSecureRandomInt(max:number):number{
  if(!Number.isSafeInteger(max)||max<=0)return 0;
  if(max>UINT32_RANGE)throw new Error('Secure random range exceeds Uint32 capacity.');
  const cryptoObj=globalThis.crypto;
  if(!cryptoObj?.getRandomValues)throw new Error('Web Crypto API is not available.');
  const limit=Math.floor(UINT32_RANGE/max)*max;
  const buffer=new Uint32Array(1);
  do{cryptoObj.getRandomValues(buffer);}while(buffer[0]>=limit);
  return buffer[0]%max;
}
export function secureShuffle<T>(array:T[]):T[]{const result=[...array];for(let i=result.length-1;i>0;i--){const j=getSecureRandomInt(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;}

export function getPasswordPools(config:PasswordConfig):string[]{
  const filter=(value:string)=>config.excludeAmbiguous?Array.from(value).filter(c=>!AMBIGUOUS_CHARS.includes(c)).join(''):value;
  const pools:string[]=[];
  if(config.useUpper)pools.push(filter(UPPERCASE_CHARS));
  if(config.useLower)pools.push(filter(LOWERCASE_CHARS));
  if(config.useNumbers)pools.push(filter(NUMBER_CHARS));
  if(config.useSymbols)pools.push(filter(SYMBOL_CHARS));
  return pools.filter(Boolean);
}
function randomFromCharset(charset:string,length:number):string{let out='';for(let i=0;i<Math.max(0,Math.trunc(length));i++)out+=charset[getSecureRandomInt(charset.length)];return out;}
function containsEveryPool(secret:string,pools:string[]):boolean{return pools.every(pool=>Array.from(secret).some(char=>pool.includes(char)));}

/** Uniform over the valid policy-constrained password space via rejection sampling. */
export function generatePassword(config:PasswordConfig):string{
  const length=Math.max(0,Math.trunc(config.length));const pools=getPasswordPools(config);if(!length||!pools.length)return'';
  const charset=pools.join('');
  if(!config.ensureEachType||length<pools.length)return randomFromCharset(charset,length);
  for(;;){const candidate=randomFromCharset(charset,length);if(containsEveryPool(candidate,pools))return candidate;}
}
export function generatePassphrase(config:PassphraseConfig):string{
  const count=Math.max(0,Math.trunc(config.wordCount));if(!count)return'';const list=EFF_WORD_LIST.length?EFF_WORD_LIST:['apple','banana','orange','cherry','grape'];const words:string[]=[];
  for(let i=0;i<count;i++){let word=list[getSecureRandomInt(list.length)];if(config.capitalization==='upper')word=word.toUpperCase();else if(config.capitalization==='title'||(config.capitalization==='camel'&&i>0))word=word.charAt(0).toUpperCase()+word.slice(1).toLowerCase();else word=word.toLowerCase();words.push(word);}
  if(config.includeNumber){const i=getSecureRandomInt(words.length);words[i]=`${words[i]}${getSecureRandomInt(100)}`;}
  if(config.includeSymbol){const i=getSecureRandomInt(words.length);words[i]=`${words[i]}${PASSPHRASE_SYMBOLS[getSecureRandomInt(PASSPHRASE_SYMBOLS.length)]}`;}
  return words.join(config.separator);
}
export function isTrivialPin(pin:string):boolean{
  if(!pin||/^(\d)\1+$/.test(pin))return true;
  const digits=Array.from(pin,Number);let asc=true,desc=true;
  for(let i=1;i<digits.length;i++){asc&&=digits[i]===digits[i-1]+1;desc&&=digits[i]===digits[i-1]-1;}
  return asc||desc||['0123456789','9876543210'].some(sequence=>sequence.includes(pin));
}
export function generatePin(config:PinConfig):string{const length=Math.max(1,Math.trunc(config.length));for(;;){const pin=randomFromCharset(NUMBER_CHARS,length);if(!config.avoidTrivial||!isTrivialPin(pin))return pin;}}
export function getRandomStringCharset(config:RandomStringConfig):string{
  let chars=config.preset==='hex'?HEX_CHARS:config.preset==='alphanumeric'?UPPERCASE_CHARS+LOWERCASE_CHARS+NUMBER_CHARS:config.preset==='alphanumeric-symbols'?UPPERCASE_CHARS+LOWERCASE_CHARS+NUMBER_CHARS+SYMBOL_CHARS:config.customCharset.trim()||(UPPERCASE_CHARS+LOWERCASE_CHARS+NUMBER_CHARS);
  return Array.from(new Set(Array.from(chars))).join('');
}
export function generateRandomString(config:RandomStringConfig):string{const chars=getRandomStringCharset(config);return chars?randomFromCharset(chars,config.length):'';}

function constrainedPasswordSpace(config:PasswordConfig):number{
  const pools=getPasswordPools(config);const length=Math.max(0,Math.trunc(config.length));const total=pools.reduce((s,p)=>s+p.length,0);if(!length||!total)return 0;if(!config.ensureEachType||length<pools.length)return Math.pow(total,length);
  let valid=0;const subsets=1<<pools.length;
  for(let mask=0;mask<subsets;mask++){let excluded=0,bits=0;for(let i=0;i<pools.length;i++)if(mask&(1<<i)){excluded+=pools[i].length;bits++;}const remaining=total-excluded;valid+=(bits%2?-1:1)*Math.pow(remaining,length);}
  return Math.max(0,valid);
}
export function calculatePasswordEntropy(config:PasswordConfig):number{const space=constrainedPasswordSpace(config);return space>1?Math.round(Math.log2(space)):0;}
export function calculatePassphraseEntropy(config:PassphraseConfig):number{const listSize=EFF_WORD_LIST.length||1000;let bits=Math.max(0,Math.trunc(config.wordCount))*Math.log2(listSize);if(config.includeNumber)bits+=Math.log2(100);if(config.includeSymbol)bits+=Math.log2(PASSPHRASE_SYMBOLS.length);return Math.round(bits);}
export function calculatePinEntropy(length:number):number{return Math.round(Math.max(0,Math.trunc(length))*Math.log2(10));}
export function calculatePinEntropyForConfig(config:PinConfig):number{const length=Math.max(1,Math.trunc(config.length));if(!config.avoidTrivial)return calculatePinEntropy(length);const total=10**length;let trivial=10;for(const start of [0,9]){for(let i=0;i+length<=10;i++)if((start===0?i:9-i)- (start===0?0:0)>=-10)trivial++;}return Math.max(0,Math.floor(Math.log2(Math.max(1,total-trivial))));}
export function calculateRandomStringEntropy(config:RandomStringConfig):number{const size=getRandomStringCharset(config).length;return size>1?Math.round(Math.max(0,Math.trunc(config.length))*Math.log2(size)):0;}

export interface SecretAudit{entropyBits:number;searchSpaceLog10:number;offlineGuessSecondsAt1e12:number;onlineGuessYearsAt10PerSecond:number;warnings:string[];}
export function auditSecretEntropy(entropyBits:number):SecretAudit{const bits=Math.max(0,entropyBits),guesses=2**Math.min(bits,1023),warnings:string[]=[];if(bits<60)warnings.push('Below 60 bits: unsuitable for a high-value randomly generated secret.');if(bits<80)warnings.push('Below 80 bits: consider increasing length for long-lived secrets.');return{entropyBits:bits,searchSpaceLog10:bits*Math.LOG10E*Math.LN2,offlineGuessSecondsAt1e12:guesses/2/1e12,onlineGuessYearsAt10PerSecond:guesses/2/10/(365.25*86400),warnings};}
export interface EntropyStrength{label:'Very Weak'|'Weak'|'Moderate'|'Strong'|'Very Strong';color:string;percentage:number;}
export function getEntropyStrength(bits:number):EntropyStrength{if(bits<36)return{label:'Very Weak',color:'text-rose-600 dark:text-rose-400 bg-rose-500',percentage:20};if(bits<56)return{label:'Weak',color:'text-amber-600 dark:text-amber-400 bg-amber-500',percentage:40};if(bits<76)return{label:'Moderate',color:'text-yellow-600 dark:text-yellow-400 bg-yellow-500',percentage:65};if(bits<110)return{label:'Strong',color:'text-emerald-600 dark:text-emerald-400 bg-emerald-500',percentage:85};return{label:'Very Strong',color:'text-blue-600 dark:text-blue-400 bg-blue-500',percentage:100};}
