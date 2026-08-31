export interface PublicPdfTask {
  id: string;
  pdfTaskId: string;
  name: string;
  shortName: string;
  description: string;
  keywords: string[];
  pdfHash: string;
  featured: boolean;
}

/**
 * Public-facing PDF intents exposed by Tiny Tools. The actual PDF processing
 * remains in the dedicated PDF Everything application so one mature local
 * engine handles every route.
 */
export const PUBLIC_PDF_TASKS: PublicPdfTask[] = [
  {
    id: 'create-pdf',
    pdfTaskId: 'create-pdf',
    name: 'Create PDF',
    shortName: 'Create PDF',
    description: 'Create a PDF from Markdown, plain text, or simple HTML without uploading your content.',
    keywords: ['create pdf', 'make pdf', 'text to pdf', 'markdown to pdf', 'html to pdf', 'new pdf'],
    pdfHash: '#/create',
    featured: true,
  },
  {
    id: 'merge-pdf',
    pdfTaskId: 'merge-pdfs',
    name: 'Merge PDFs',
    shortName: 'Merge PDF',
    description: 'Combine multiple PDF files into one document in the order you choose.',
    keywords: ['merge pdf', 'combine pdf', 'join pdf', 'append pdf', 'multiple pdf files'],
    pdfHash: '#/merge',
    featured: true,
  },
  {
    id: 'scan-to-pdf',
    pdfTaskId: 'scan-to-pdf',
    name: 'Scan to PDF',
    shortName: 'Scan to PDF',
    description: 'Turn camera captures, JPGs, PNGs, and other images into a PDF, with optional OCR.',
    keywords: ['scan to pdf', 'images to pdf', 'jpg to pdf', 'png to pdf', 'photo to pdf', 'camera scan'],
    pdfHash: '#/scan',
    featured: true,
  },
  {
    id: 'edit-pdf',
    pdfTaskId: 'edit-pdf',
    name: 'Edit PDF',
    shortName: 'Edit PDF',
    description: 'Edit supported PDF text, images, vectors, tables, and added objects locally in the browser.',
    keywords: ['edit pdf', 'change pdf', 'edit pdf text', 'replace pdf text', 'pdf editor'],
    pdfHash: '#/tools/edit-pdf',
    featured: true,
  },
  {
    id: 'annotate-pdf',
    pdfTaskId: 'annotate-pdf',
    name: 'Annotate PDF',
    shortName: 'Annotate PDF',
    description: 'Highlight, draw, add notes, shapes, stamps, and review markup to a PDF.',
    keywords: ['annotate pdf', 'highlight pdf', 'comment pdf', 'draw on pdf', 'markup pdf', 'notes'],
    pdfHash: '#/tools/annotate-pdf',
    featured: false,
  },
  {
    id: 'sign-pdf',
    pdfTaskId: 'visual-signature',
    name: 'Sign PDF',
    shortName: 'Sign PDF',
    description: 'Place an appearance-only handwritten or image signature on a PDF locally.',
    keywords: ['sign pdf', 'signature pdf', 'add signature', 'autograph pdf', 'visual signature'],
    pdfHash: '#/tools/visual-signature',
    featured: true,
  },
  {
    id: 'redact-pdf',
    pdfTaskId: 'mark-redaction',
    name: 'Redact PDF',
    shortName: 'Redact PDF',
    description: 'Mark sensitive areas and then permanently remove the covered PDF content from a derived copy.',
    keywords: ['redact pdf', 'blackout pdf', 'remove sensitive information', 'privacy pdf', 'permanent redaction'],
    pdfHash: '#/tools/mark-redaction',
    featured: true,
  },
  {
    id: 'organize-pdf-pages',
    pdfTaskId: 'organize-pages',
    name: 'Organize PDF Pages',
    shortName: 'Organize PDF',
    description: 'Reorder, rotate, duplicate, delete, reverse, or extract pages from a PDF.',
    keywords: ['organize pdf', 'reorder pdf pages', 'rotate pdf', 'delete pdf pages', 'extract pdf pages', 'reverse pdf pages'],
    pdfHash: '#/tools/organize-pages',
    featured: true,
  },
  {
    id: 'split-pdf',
    pdfTaskId: 'split-pdf',
    name: 'Split PDF',
    shortName: 'Split PDF',
    description: 'Divide one multi-page PDF into separate PDF files or page ranges.',
    keywords: ['split pdf', 'divide pdf', 'separate pdf pages', 'pdf page ranges', 'extract pages'],
    pdfHash: '#/tools/split-pdf',
    featured: true,
  },
  {
    id: 'crop-pdf',
    pdfTaskId: 'crop-pages',
    name: 'Crop PDF Pages',
    shortName: 'Crop PDF',
    description: 'Trim visible PDF page margins by changing the page CropBox while preserving the original file.',
    keywords: ['crop pdf', 'trim pdf margins', 'pdf cropbox', 'remove margins', 'resize pdf page'],
    pdfHash: '#/tools/crop-pages',
    featured: false,
  },
  {
    id: 'watermark-pdf',
    pdfTaskId: 'watermark-numbering',
    name: 'Watermark & Number PDF',
    shortName: 'Watermark PDF',
    description: 'Add watermarks, headers, footers, and page numbers to PDF pages.',
    keywords: ['watermark pdf', 'page numbers pdf', 'add page numbers', 'header pdf', 'footer pdf', 'confidential stamp'],
    pdfHash: '#/tools/watermark-numbering',
    featured: false,
  },
  {
    id: 'fill-pdf-forms',
    pdfTaskId: 'fill-forms',
    name: 'Fill PDF Forms',
    shortName: 'Fill PDF Forms',
    description: 'Fill supported writable PDF form fields and export the completed document locally.',
    keywords: ['fill pdf', 'pdf form', 'acroform', 'checkbox pdf', 'fillable pdf', 'form fields'],
    pdfHash: '#/tools/fill-forms',
    featured: false,
  },
  {
    id: 'protect-pdf',
    pdfTaskId: 'password-protect',
    name: 'Password-Protect PDF',
    shortName: 'Protect PDF',
    description: 'Create a password-protected PDF copy with supported encryption settings.',
    keywords: ['protect pdf', 'password pdf', 'encrypt pdf', 'lock pdf', 'secure pdf'],
    pdfHash: '#/tools/password-protect',
    featured: true,
  },
  {
    id: 'clean-pdf',
    pdfTaskId: 'sanitize-pdf',
    name: 'Clean Up PDF',
    shortName: 'Clean PDF',
    description: 'Remove selected metadata, scripts, automatic actions, attachments, links, comments, or form values.',
    keywords: ['clean pdf', 'sanitize pdf', 'remove javascript pdf', 'remove attachments', 'pdf privacy', 'remove metadata'],
    pdfHash: '#/tools/sanitize-pdf',
    featured: false,
  },
  {
    id: 'ocr-pdf',
    pdfTaskId: 'ocr-pdf',
    name: 'OCR PDF',
    shortName: 'OCR PDF',
    description: 'Recognize printed text in scanned PDF pages and create a searchable PDF reconstruction locally.',
    keywords: ['ocr pdf', 'searchable pdf', 'scan text pdf', 'recognize text', 'tesseract pdf'],
    pdfHash: '#/tools/ocr-pdf',
    featured: true,
  },
  {
    id: 'compress-pdf',
    pdfTaskId: 'compress-pdf',
    name: 'Compress PDF',
    shortName: 'Compress PDF',
    description: 'Reduce PDF file size with preservation-oriented or stronger image-based compression options.',
    keywords: ['compress pdf', 'reduce pdf size', 'make pdf smaller', 'optimize pdf', 'shrink pdf'],
    pdfHash: '#/tools/compress-pdf',
    featured: true,
  },
  {
    id: 'pdf-metadata',
    pdfTaskId: 'metadata',
    name: 'PDF Metadata Editor',
    shortName: 'PDF Metadata',
    description: 'View, edit, or remove PDF title, author, subject, keywords, and other document metadata.',
    keywords: ['pdf metadata', 'remove pdf metadata', 'pdf author', 'pdf title', 'document properties', 'privacy'],
    pdfHash: '#/tools/metadata',
    featured: false,
  },
  {
    id: 'export-pdf',
    pdfTaskId: 'export-content',
    name: 'Export PDF Content',
    shortName: 'Export PDF',
    description: 'Export PDF text, Markdown, HTML, page images, or split PDF parts locally.',
    keywords: ['pdf to text', 'pdf to jpg', 'pdf to jpeg', 'pdf to png', 'pdf to html', 'pdf to markdown', 'extract pdf text', 'export pdf images'],
    pdfHash: '#/tools/export-content',
    featured: true,
  },
  {
    id: 'compare-pdf',
    pdfTaskId: 'compare-pdfs',
    name: 'Compare PDFs',
    shortName: 'Compare PDFs',
    description: 'Compare two PDF versions visually or by extracted text to find changes.',
    keywords: ['compare pdf', 'pdf diff', 'changes between pdfs', 'original revised pdf', 'document comparison'],
    pdfHash: '#/compare',
    featured: false,
  },
  {
    id: 'pdf-page-tools',
    pdfTaskId: 'organize-pages',
    name: 'PDF Page Tools',
    shortName: 'PDF Page Tools',
    description: 'Use one page workspace for rotate, delete, duplicate, reverse, reorder, and extract operations.',
    keywords: ['rotate pdf', 'delete pdf page', 'duplicate pdf page', 'reverse pdf', 'extract page', 'reorder pages'],
    pdfHash: '#/tools/organize-pages',
    featured: false,
  },
];

export function getPublicPdfTask(id: string | null | undefined): PublicPdfTask | undefined {
  return id ? PUBLIC_PDF_TASKS.find((task) => task.id === id) : undefined;
}

export function readTinyToolsPdfTaskId(hash: string): string | null {
  const clean = hash.replace(/^#\/?/, '').split('?')[0];
  if (!clean) return null;
  if (clean.startsWith('tool/')) return clean.slice('tool/'.length).split('/')[0] || null;
  return clean.split('/')[0] || null;
}

export function buildPdfWorkspaceUrl(task: PublicPdfTask, locationLike?: Pick<Location, 'hostname' | 'origin'>): string {
  const hostname = locationLike?.hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  const origin = locationLike?.origin ?? (typeof window !== 'undefined' ? window.location.origin : 'https://thiepn.github.io');
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  const base = local ? 'https://thiepn.github.io/pdf/' : `${origin.replace(/\/$/, '')}/pdf/`;
  return `${base}${task.pdfHash}`;
}

export function shouldEmbedPdfWorkspace(hostname: string): boolean {
  return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '0.0.0.0';
}
