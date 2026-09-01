import type{ToolCategory}from'../types';
export interface CategoryPresentation{label:string;shortLabel:string;description:string;searchTerms:string[];badge:{bg:string;text:string;border:string}}
type Row=[ToolCategory,string,string,string,string,string];
export const CATEGORY_ORDER:ToolCategory[]=['productivity','pdf','image','text','files','media','device','time','calculator','everyday','math','design','developer'];
const ROWS:Row[]=[
['productivity','Productivity & Office','Productivity','Notes, checklists, scanning, speech, planning, and practical work helpers.','productivity|office|work|notes|planning|documents','cyan'],
['pdf','PDF Tools','PDF','Merge, split, compress, edit, scan, OCR, sign, protect, organize, and export PDFs locally.','pdf|document|documents|acrobat|merge pdf|split pdf|compress pdf|scan pdf','red'],
['image','Images & Photos','Images','Resize, clean up, combine, annotate, scan, and export images locally.','image|images|photo|photos|picture|pictures|graphics','rose'],
['text','Text & Writing','Text','Clean, count, compare, transform, and organize text.','text|writing|words|copy|content','emerald'],
['files','Files & Archives','Files','Rename, package, inspect, compare, and organize local files.','files|file|archive|archives|zip|folders','orange'],
['media','Media & Audio','Media','Record, trim, edit, convert, and create audio or video media.','media|audio|video|recording|music|voice','pink'],
['device','Device Diagnostics','Diagnostics','Test cameras, microphones, speakers, displays, keyboards, mice, touchscreens, controllers, and browser-exposed hardware status.','device|hardware|diagnostic|diagnostics|test hardware|microphone test|webcam test|keyboard test|mouse test|monitor test|controller test','sky'],
['time','Time & Dates','Time','Dates, time zones, timers, calendars, and scheduling helpers.','time|date|dates|calendar|schedule|clock','amber'],
['calculator','Everyday Calculators','Calculators','School, money, household, travel, construction, and general fitness calculators with transparent formulas.','calculator|calculators|calculate|money|loan|mortgage|grade|fuel|electricity|bmi|pace|household','blue'],
['everyday','Everyday Helpers','Everyday','Quick utilities for common daily tasks such as QR codes and comparisons.','everyday|daily|practical|quick|helper|helpers','teal'],
['math','Math & Conversion','Math','Percentages, measurements, unit conversion, pricing, and arithmetic.','math|calculator|calculation|convert|conversion|numbers','blue'],
['design','Design & Visuals','Design','Colors, contrast, dimensions, palettes, and visual layout helpers.','design|visual|visuals|color|layout|graphics','purple'],
['developer','Developer Utilities','Developer','JSON, regex, encoding, secure generators, and technical text workflows.','developer|development|coding|code|programming|technical','indigo'],
];
const AUX='tt-badge';
export const CATEGORY_PRESENTATION=Object.fromEntries(ROWS.map(([id,label,shortLabel,description,terms,color])=>[id,{label,shortLabel,description,searchTerms:terms.split('|'),badge:{bg:`tt-category-${color}`,text:AUX,border:AUX}}]))as Record<ToolCategory,CategoryPresentation>;
export function getCategoryPresentation(category:ToolCategory):CategoryPresentation{return CATEGORY_PRESENTATION[category]}
