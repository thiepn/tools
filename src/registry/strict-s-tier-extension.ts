import{createElement,lazy,type ComponentType}from'react';
import{STRICT_S_TIER_TARGET_SET}from'../strict-s-tier/manifest';
import{TOOLS_REGISTRY}from'./tools';

const MARKER='strict s-tier core upgrade';
const CurrencyCore=lazy(()=>import('../tools/strict-s-tier/StrictCurrencyConverter'));
const PwaCore=lazy(()=>import('../tools/strict-s-tier/StrictPwaManifest'));

const DESCRIPTION:Record<string,string>={
'refresh-rate-test':'Measure browser-visible display cadence over timed sessions with median, P95, jitter, stability, repeatability evidence, and CSV export.',
'touchscreen-test':'Map multi-touch coverage across an 8×8 grid, inspect edge/corner coverage, pressure, concurrency, and export local touch evidence.',
'polling-rate-test':'Measure browser-delivered pointer event cadence with median rate, P95 interval, jitter, stability, path distance, and sample export.',
'keyboard-ghosting-test':'Audit browser-delivered keyboard rollover with simultaneous-key history, repeat detection, missing-release candidates, and event export.',
'battery-status':'Track browser-exposed battery level, charging state, time estimates, and local session trend history without inventing unavailable health metrics.',
'basic-calculator':'Evaluate safe arithmetic and function expressions with memory, history, validation, and exportable calculation evidence.',
'average-calculator':'Analyze numeric lists with mean, median, quartiles, IQR, range, and population/sample standard deviation.',
'tip-calculator':'Model tax, service charge, pre/post-tax tipping, group splitting, rounding strategies, and per-person reconciliation.',
'bill-splitter':'Split itemized expenses across unequal participant groups with proportional tax/tip allocation and auditable per-person totals.',
'simple-interest-calculator':'Calculate simple-interest totals, annualized return, period schedules, and side-by-side compound-interest comparison.',
'room-area-calculator':'Combine rectangular, triangular, and circular room shapes with named areas, contingency allowances, and purchase-area totals.',
'paint-calculator':'Estimate paint from net wall area, openings, coats, coverage, waste, container sizing, leftovers, and cost.',
'flooring-calculator':'Estimate flooring purchase area, waste, pack counts, leftovers, and project cost from package coverage.',
'tile-calculator':'Estimate tiles using tile dimensions, grout width, waste, box quantities, purchased tiles, and cost.',
'box-volume-calculator':'Calculate box volume, surface area, internal diagonal, capacity context, and carrier-style dimensional weight.',
'tar-pack':'Create browser-local USTAR archives with member preview, padded-size accounting, SHA-256/CRC32, and immediate round-trip verification.',
'tar-extract':'Inspect TAR structure, validate member boundaries, show per-member CRC32, select entries, and download safely without filesystem path traversal.',
'gzip-compress':'Compress files with browser GZIP streams, verify by byte-for-byte decompression, inspect headers, checksums, and compression ratio.',
'gzip-decompress':'Validate GZIP headers before local decompression, expose integrity metadata, and download verified output.',
'reverse-audio':'Reverse an exact decoded audio range while preserving surrounding samples, with fades, normalization, PCM metrics, and WAV export.',
'stereo-mono-converter':'Remix decoded audio between stereo, mono, left/right, swapped, and difference channels with gain, normalization, and WAV export.',
'loop-video':'Render an exact video segment for a chosen repeat count with duration preview, FPS control, audio handling, and local WebM output.',
'mute-video':'Render a local video output with the audio track omitted rather than merely silenced during playback.',
'video-volume-changer':'Apply explicit dB gain to a video audio stream before local WebM re-encoding, with trim and codec constraints shown.',
'text-repeater':'Repeat text at scale with separators, prefixes/suffixes, numbering, UTF-8 byte counts, hard output guards, and file export.',
'text-reverser':'Reverse text by Unicode grapheme, word, per-line, or line-order modes with round-trip checks and export.',
'lorem-ipsum-generator':'Generate deterministic seeded filler text by paragraphs, sentences, and words with plain, Markdown, or HTML output.',
'reading-plan-divider':'Build date-bounded reading plans with rest weekdays, front-loading, exact unit conservation, catch-up days, CSV and Markdown export.',
'pwa-manifest-generator':'Build validated web-app manifest JSON with structured installability fields, icons, shortcuts, warnings, safe raw import, and clean errors.',
'number-words-converter':'Convert batches of signed decimals into English words with ordinal and USD/EUR/GBP currency modes and CSV export.',
'habit-consistency-tracker':'Analyze scheduled habits with partial completion, skips, current/longest streaks, rolling adherence, weekday breakdowns, and exports.',
'currency-converter':'Convert major currencies with explicit network consent, cached ECB reference rates, manual offline rates, source timestamps, and no background fetch on route load.',
};

function strictWithA(toolId:string,Core:ComponentType<{initialText?:string}>){
 return lazy(async()=>{const{STierARouteWrapper}=await import('../tools/s-tier-a/STierARouteWrapper');const Wrapped:ComponentType<{initialText?:string}>=(props)=>createElement(STierARouteWrapper,{toolId,Base:Core,initialText:props.initialText});return{default:Wrapped}})
}
function strictWithB(toolId:string,Core:ComponentType<{initialText?:string}>){
 return lazy(async()=>{const{STierBRouteWrapper}=await import('../tools/s-tier-b/STierBRouteWrapper');const Wrapped:ComponentType<{initialText?:string}>=(props)=>createElement(STierBRouteWrapper,{toolId,Base:Core,initialText:props.initialText});return{default:Wrapped}})
}

export function applyStrictSTierUpgrades():void{
 for(const tool of TOOLS_REGISTRY){
  if(!STRICT_S_TIER_TARGET_SET.has(tool.id)||tool.keywords.includes(MARKER))continue;
  const strictDescription=DESCRIPTION[tool.id];
  if(strictDescription&&!tool.description.includes(strictDescription))tool.description=`${tool.description.replace(/\s+$/,'')} ${strictDescription}`;
  tool.keywords=[...new Set([...tool.keywords,MARKER,'advanced workflow','edge case validation','exportable results','local first'])];
  if(tool.id==='currency-converter'){tool.component=strictWithA(tool.id,CurrencyCore);continue}
  if(tool.id==='pwa-manifest-generator'){tool.component=strictWithB(tool.id,PwaCore);continue}
  const Base=tool.component,toolId=tool.id;
  tool.component=lazy(async()=>{const{StrictSTierRouteWrapper}=await import('../tools/strict-s-tier/StrictSTierRouteWrapper');const Wrapped:ComponentType<{initialText?:string}>=(props)=>createElement(StrictSTierRouteWrapper,{toolId,Base,initialText:props.initialText});return{default:Wrapped}})
 }
}
