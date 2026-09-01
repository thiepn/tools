import type{ToolCategory}from'../types';
export interface CategoryPresentation{label:string;shortLabel:string;description:string;searchTerms:string[];badge:{bg:string;text:string;border:string}}
type Row=[ToolCategory,string,string,string,string,string];
const ROWS:Row[]=[
['productivity','Productivity & Office','Productivity','Office and planning tools.','productivity|office|notes|planning','cyan'],
['pdf','PDF Tools','PDF','PDF utilities.','pdf|document|documents','red'],
['image','Images & Photos','Images','Image and photo tools.','image|images|photo|photos','rose'],
['text','Text & Writing','Text','Text utilities.','text|writing|words','emerald'],
['files','Files & Archives','Files','File and archive tools.','files|file|archive|zip|converter','orange'],
['media','Media & Audio','Media','Audio and video tools.','media|audio|video','pink'],
['device','Device Diagnostics','Diagnostics','Hardware tests.','device|hardware|diagnostic|diagnostics','sky'],
['time','Time & Dates','Time','Date and time tools.','time|date|calendar|schedule|clock','amber'],
['calculator','Everyday Calculators','Calculators','Practical calculators.','calculator|calculators|calculate','blue'],
['everyday','Everyday Helpers','Everyday','Daily utilities.','everyday|daily|practical','teal'],
['math','Math & Conversion','Math','Math and conversion.','math|convert|conversion|numbers','blue'],
['design','Design & Visuals','Design','Design utilities.','design|visual|color|layout','purple'],
['developer','Developer Utilities','Developer','Developer utilities.','developer|coding|code|programming','indigo'],
];
export const CATEGORY_ORDER=ROWS.map(r=>r[0]);const AUX='x';
export const CATEGORY_PRESENTATION=Object.fromEntries(ROWS.map(([id,label,shortLabel,description,terms,color])=>[id,{label,shortLabel,description,searchTerms:terms.split('|'),badge:{bg:`tt-category-${color}`,text:AUX,border:AUX}}]))as Record<ToolCategory,CategoryPresentation>;
export function getCategoryPresentation(category:ToolCategory){return CATEGORY_PRESENTATION[category]}
