import React, { useMemo } from 'react';
import { ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  PUBLIC_PDF_TASKS,
  buildPdfWorkspaceUrl,
  getPublicPdfTask,
  readTinyToolsPdfTaskId,
  shouldEmbedPdfWorkspace,
} from '../../pdf/publicPdfTasks';

export const PdfSuiteGatewayTool: React.FC = () => {
  const task = useMemo(() => {
    const id = typeof window !== 'undefined' ? readTinyToolsPdfTaskId(window.location.hash) : null;
    return getPublicPdfTask(id) ?? PUBLIC_PDF_TASKS[0];
  }, []);

  const workspaceUrl = useMemo(
    () => buildPdfWorkspaceUrl(task, typeof window !== 'undefined' ? window.location : undefined),
    [task]
  );
  const canEmbed = typeof window !== 'undefined' && shouldEmbedPdfWorkspace(window.location.hostname);

  return (
    <ToolShell
      toolId={task.id}
      title={task.name}
      description={task.description}
      category="pdf"
      relatedToolIds={['document-scanner', 'image-to-text', 'signature-maker']}
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50/60 dark:bg-red-950/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3 min-w-0">
              <div className="mt-0.5 rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-neutral-950 p-2 shrink-0">
                <FileText className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Dedicated local PDF workspace</h2>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                  Tiny Tools routes this task to PDF Everything, the shared browser-side PDF engine used for the complete PDF suite. Your document is processed locally rather than uploaded to an application server.
                </p>
              </div>
            </div>
            <a
              href={workspaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            >
              Open full workspace
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-[11px] leading-4 text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Privacy model: local file processing. OCR or PDF runtime assets may download when first needed, but the PDF content itself is not intentionally sent to a processing backend.</span>
          </div>
        </section>

        {canEmbed ? (
          <section className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 px-3 py-2">
              <div>
                <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{task.name}</div>
                <div className="text-[10px] text-neutral-500">Embedded PDF Everything workspace</div>
              </div>
              <a href={workspaceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                Open separately
              </a>
            </div>
            <iframe
              src={workspaceUrl}
              title={`${task.name} — PDF Everything`}
              className="block h-[76vh] min-h-[620px] w-full bg-white"
              allow="camera; clipboard-read; clipboard-write"
              loading="eager"
            />
          </section>
        ) : (
          <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-6 text-center">
            <FileText className="mx-auto h-8 w-8 text-neutral-400" />
            <h3 className="mt-3 text-sm font-bold text-neutral-900 dark:text-neutral-100">{task.name} is ready in the PDF workspace</h3>
            <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-neutral-500">
              The embedded sibling app is disabled on local development hosts so automated route and offline tests stay deterministic. Use the full workspace button to open the production PDF tool.
            </p>
          </section>
        )}
      </div>
    </ToolShell>
  );
};

export default PdfSuiteGatewayTool;
