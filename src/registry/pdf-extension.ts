import{lazy}from'react';
import{PUBLIC_PDF_TASKS}from'../pdf/publicPdfTasks';
import{ensureCategory,registerFamily}from'./register-family';
const PdfSuiteGatewayTool=lazy(()=>import('../tools/pdf-suite/PdfSuiteGatewayTool'));
export function registerPdfPublicTools():void{ensureCategory('pdf','PDF Tools','Create, merge, edit, organize, protect, OCR, compress, and export PDF documents','productivity');registerFamily(PUBLIC_PDF_TASKS,'pdf','FileText',PdfSuiteGatewayTool)}
