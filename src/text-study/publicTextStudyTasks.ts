import type{ToolCategory}from'../types';
export type TextStudyGroup='analysis'|'transform'|'markdown'|'study'|'citation';
export interface PublicTextStudyTask{id:string;name:string;shortName:string;description:string;keywords:string[];group:TextStudyGroup;category:ToolCategory;featured?:boolean;}
type Raw=[string,string,string,string,TextStudyGroup,ToolCategory,string?,boolean?];
const RAW:Raw[]=[
['readability-checker','Readability Checker','Measure English Flesch Reading Ease and Flesch–Kincaid grade level.','readability|flesch score|grade level','analysis','text','',true],
['ngram-analyzer','N-gram Analyzer','Count repeated one-, two-, or three-word phrases in text.','bigrams|trigrams|phrase frequency','analysis','text'],
['text-pattern-extractor','Text Pattern Extractor','Extract emails, URLs, hashtags, and @mentions from pasted text.','extract emails|extract urls|hashtags|mentions','analysis','text','',true],
['duplicate-phrase-finder','Duplicate Phrase Finder','Find repeated multi-word phrases that may indicate accidental repetition.','repeated phrases|duplicate wording|writing repetition','analysis','text'],
['text-similarity-checker','Text Similarity Checker','Compare two texts with token-set and cosine similarity scores.','text similarity|compare similarity|jaccard|cosine','analysis','text'],
['unicode-inspector','Unicode Inspector','Inspect graphemes, code points, UTF-16 length, and invisible characters.','unicode code point|character inspector|grapheme|invisible characters','analysis','text'],
['text-repeater','Text Repeater','Repeat text a chosen number of times with a custom separator.','repeat text|duplicate text|text multiplier','transform','text'],
['text-reverser','Text Reverser','Reverse characters, words, or sentence order without changing the source.','reverse characters|reverse words|backwards text','transform','text'],
['text-wrapper','Text Wrapper','Wrap prose to a chosen line width while preserving paragraph boundaries.','wrap text|line width|hard wrap','transform','text'],
['whitespace-visualizer','Whitespace Visualizer','Reveal spaces, tabs, non-breaking spaces, zero-width spaces, and line endings.','show whitespace|tabs spaces|zero width space|invisible text','transform','text'],
['lorem-ipsum-generator','Lorem Ipsum Generator','Generate deterministic placeholder paragraphs without network access.','lorem ipsum|placeholder text|dummy text','transform','text','Lorem Ipsum',true],
['markdown-preview','Markdown Preview','Preview common Markdown headings, lists, quotes, code, links, and emphasis safely.','markdown preview|md preview|render markdown','markdown','text','',true],
['markdown-to-plain-text','Markdown to Plain Text','Remove common Markdown syntax while preserving readable text.','markdown to text|strip markdown|md plain text','markdown','text'],
['html-to-plain-text','HTML to Plain Text','Turn HTML fragments into readable text with entities decoded locally.','html to text|strip html|remove html tags','markdown','text'],
['flashcard-maker','Flashcard Maker','Create a local flip-through deck from Front :: Back lines.','flashcards|study cards|quiz cards|front back','study','productivity','',true],
['cloze-deletion-trainer','Cloze Deletion Trainer','Study {{answer}} or {{c1::answer}} blanks with reveal controls.','cloze deletion|fill in blank|active recall','study','productivity','Cloze Trainer',true],
['memorization-trainer','Memorization Trainer','Hide parts of a passage, type it from memory, and score normalized accuracy.','memorize text|memory practice|recall trainer','study','productivity','',true],
['self-test-maker','Self-Test Maker','Turn Question :: Answer lines into a reveal-and-score practice session.','self test|practice quiz|question answer|quiz maker','study','productivity','Self-Test',true],
['spaced-repetition-planner','Spaced Repetition Planner','Calculate a simple next-review interval from current spacing and recall quality.','spaced repetition|review schedule|study interval','study','productivity','SRS Planner'],
['study-session-planner','Study Session Planner','Split available study time across weighted subjects and planned breaks.','study planner|study schedule|time blocking|subjects','study','productivity','Study Planner',true],
['reading-plan-divider','Reading Plan Divider','Divide a page range across a chosen number of study days.','reading plan|pages per day|book schedule','study','productivity','Reading Plan'],
['citation-formatter','Citation Formatter','Build basic APA 7, MLA 9, or Chicago author-date citations from supplied metadata.','apa citation|mla citation|chicago citation|bibliography','citation','productivity','',true],
];
export const PUBLIC_TEXT_STUDY_TASKS:PublicTextStudyTask[]=RAW.map(([id,name,description,keys,group,category,shortName,featured])=>({id,name,shortName:shortName||name,description,keywords:keys.split('|'),group,category,featured}));
export function getPublicTextStudyTask(id:string|null|undefined){return id?PUBLIC_TEXT_STUDY_TASKS.find(t=>t.id===id):undefined;}
