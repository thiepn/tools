import type{ToolCategory}from'../types';
export interface CategoryPresentation{label:string;shortLabel:string;description:string;searchTerms:string[];badge:{bg:string;text:string;border:string}}
type Row=[ToolCategory,string,string,string,string];
const ROWS:Row[]=[
['productivity','Productivity & Office','Productivity','productivity|office|notes|planning','cyan'],
['pdf','PDF Tools','PDF','pdf|document|documents','red'],
['image','Images & Photos','Images','image|images|photo|photos','rose'],
['text','Text & Writing','Text','text|writing|words','emerald'],
['files','Files & Archives','Files','files|file|archive|zip|converter','orange'],
['media','Media & Audio','Media','media|audio|video','pink'],
['device','Device Diagnostics','Diagnostics','device|hardware|diagnostic|diagnostics','sky'],
['time','Time & Dates','Time','time|date|calendar|schedule|clock','amber'],
['calculator','Everyday Calculators','Calculators','calculator|calculators|calculate','blue'],
['everyday','Everyday Helpers','Everyday','everyday|daily|practical','teal'],
['math','Math & Conversion','Math','math|convert|conversion|numbers','blue'],
['design','Design & Visuals','Design','design|visual|color|layout','purple'],
['developer','Developer Utilities','Developer','developer|coding|code|programming','indigo'],
];
export const CATEGORY_ORDER=ROWS.map(r=>r[0]);const AUX='x';
export const CATEGORY_PRESENTATION=Object.fromEntries(ROWS.map(([id,label,shortLabel,terms,color])=>[id,{label,shortLabel,description:`${shortLabel} tools.`,searchTerms:terms.split('|'),badge:{bg:`tt-category-${color}`,text:AUX,border:AUX}}]))as Record<ToolCategory,CategoryPresentation>;
export function getCategoryPresentation(category:ToolCategory){return CATEGORY_PRESENTATION[category]}
