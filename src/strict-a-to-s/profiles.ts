import{STRICT_A_TO_S_TARGETS,type StrictAToSId}from'./manifest';
export type StrictAFamily='content-code'|'security'|'productivity'|'capture-media'|'pdf'|'device'|'calculation'|'file-view'|'subtitle';
const set=(s:string)=>new Set(s.trim().split(/\s+/).filter(Boolean));
const FAMILY:Record<StrictAFamily,Set<string>>={
'content-code':set(`case-converter encoding-tools color-converter readability-checker unicode-inspector markdown-preview html-to-plain-text citation-formatter yaml-formatter sql-formatter xml-formatter url-parser json-to-typescript unicode-normalizer color-contrast-checker json-structural-diff json-canonicalizer slug-generator`),
security:set(`secure-generator text-hash-generator file-checksum-generator jwt-signature-verifier x509-certificate-inspector sri-hash-generator csp-builder`),
productivity:set(`timer-stopwatch notepad calendar-event-maker metronome flashcard-maker spaced-repetition-planner work-hours-timesheet`),
'capture-media':set(`image-to-text audio-recorder video-toolkit document-scanner speech-to-text screenshot-stitcher gif-maker batch-file-renamer id-photo-maker barcode-studio watermark-maker palette-extractor crop-image image-converter compress-image-to-size privacy-blur-image image-metadata-cleaner image-upscaler audio-joiner audio-converter audio-normalizer video-compressor video-converter image-enhancer`),
pdf:set(`scan-to-pdf edit-pdf annotate-pdf sign-pdf redact-pdf organize-pdf-pages crop-pdf watermark-pdf fill-pdf-forms protect-pdf clean-pdf compare-pdf pdf-page-tools`),
device:set(`microphone-test webcam-test keyboard-test`),
calculation:set(`percentage-calculator scientific-calculator statistics-calculator loan-calculator amortization-calculator credit-card-payoff-calculator matrix-calculator linear-regression-calculator function-graph-plotter linear-system-solver descriptive-statistics-box-plot decision-matrix monthly-budget-planner screen-ppi-calculator download-time-calculator`),
'file-view':set(`zip-manager archive-converter document-viewer spreadsheet-viewer archive-browser svg-viewer`),
subtitle:set(`subtitle-editor subtitle-converter`),
};
const LABEL:Record<StrictAFamily,string>={
'content-code':'semantic correctness & interoperability lab',security:'cryptographic trust & integrity lab',productivity:'workflow precision & recovery lab','capture-media':'production fidelity & export lab',pdf:'document integrity & page-operations lab',device:'measurement repeatability lab',calculation:'auditable model & sensitivity lab','file-view':'structure, limits & integrity lab',subtitle:'timing, format & accessibility lab'};
export type StrictAProfile={id:StrictAToSId;family:StrictAFamily;label:string;focus:string};
const human=(id:string)=>id.split('-').map(x=>({pdf:'PDF',json:'JSON',yaml:'YAML',sql:'SQL',xml:'XML',url:'URL',jwt:'JWT',x509:'X.509',sri:'SRI',csp:'CSP',svg:'SVG',ppi:'PPI'}[x]??x.charAt(0).toUpperCase()+x.slice(1))).join(' ');
export function getStrictAProfile(id:string):StrictAProfile|undefined{if(!STRICT_A_TO_S_TARGETS.includes(id as StrictAToSId))return;const hit=(Object.entries(FAMILY)as[StrictAFamily,Set<string>][]).find(([,s])=>s.has(id));if(!hit)throw new Error(`Missing R17 specialist family for ${id}`);return{id:id as StrictAToSId,family:hit[0],label:LABEL[hit[0]],focus:`${human(id)} — S-tier specialist verification`}}
export const STRICT_A_PROFILES=STRICT_A_TO_S_TARGETS.map(id=>getStrictAProfile(id)!);
