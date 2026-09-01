import type{ToolCategory}from'../types';
export interface CategoryPresentation{label:string;shortLabel:string;description:string;searchTerms:string[];badge:{bg:string;text:string;border:string}}
type Row=[ToolCategory,string,string,string,string,string];
const ROWS:Row[]=[
['productivity','Productivity & Office','Productivity','Notes, planning, scanning, and office helpers.','productivity|office|notes|planning','cyan'],
['pdf','PDF Tools','PDF','Create, edit, organize, and export PDFs.','pdf|document|documents','red'],
['image','Images & Photos','Images','Edit, resize, convert, and inspect images.','image|images|photo|photos','rose'],
['text','Text & Writing','Text','Clean, analyze, compare, and transform text.','text|writing|words','emerald'],
['files','Files & Archives','Files','Convert, inspect, package, and organize files.','files|file|archive|zip|converter','orange'],
['media','Media & Audio','Media','Record, edit, and convert audio or video.','media|audio|video','pink'],
['device','Device Diagnostics','Diagnostics','Test browser-visible hardware and input devices.','device|hardware|diagnostic|diagnostics','sky'],
['time','Time & Dates','Time','Dates, clocks, calendars, and scheduling.','time|date|calendar|schedule|clock','amber'],
['calculator','Everyday Calculators','Calculators','Practical school, money, home, and fitness calculators.','calculator|calculators|calculate','blue'],
['everyday','Everyday Helpers','Everyday','Quick tools for common daily tasks.','everyday|daily|practical','teal'],
['math','Math & Conversion','Math','Math, measurements, pricing, and conversion.','math|convert|conversion|numbers','blue'],
['design','Design & Visuals','Design','Color, contrast, dimensions, and layout tools.','design|visual|color|layout','purple'],
['developer','Developer Utilities','Developer','Coding, data, encoding, and technical utilities.','developer|coding|code|programming','indigo'],
];
export const CATEGORY_ORDER=ROWS.map(r=>r[0]);const AUX='tt-badge';
export const CATEGORY_PRESENTATION=Object.fromEntries(ROWS.map(([id,label,shortLabel,description,terms,color])=>[id,{label,shortLabel,description,searchTerms:terms.split('|'),badge:{bg:`tt-category-${color}`,text:AUX,border:AUX}}]))as Record<ToolCategory,CategoryPresentation>;
export function getCategoryPresentation(category:ToolCategory){return CATEGORY_PRESENTATION[category]}
