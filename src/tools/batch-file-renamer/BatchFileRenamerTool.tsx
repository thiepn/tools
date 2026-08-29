import React, { useState, useMemo } from 'react';
import {
  FileText,
  Upload,
  FolderArchive,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sliders,
  Sparkles,
  RefreshCw,
  CaseSensitive,
  Binary,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  RenamerRules,
  DEFAULT_RENAMER_RULES,
  applyRenamingRules,
  CaseConversionMode,
} from '../../utilities/batch-renamer';
import { createZipArchive, PendingZipFile } from '../../utilities/zip-manager';

interface UploadedFileItem {
  id: string;
  file: File;
}

export const BatchFileRenamerTool: React.FC = () => {
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [rules, setRules] = useState<RenamerRules>(DEFAULT_RENAMER_RULES);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const newFiles: UploadedFileItem[] = Array.from(fileList).map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearFiles = () => {
    setFiles([]);
    setErrorMessage(null);
  };

  const handleResetRules = () => {
    setRules(DEFAULT_RENAMER_RULES);
  };

  // Compute live renamed items
  const renamedItems = useMemo(() => {
    return applyRenamingRules(files, rules);
  }, [files, rules]);

  // Export renamed files in ZIP archive
  const handleDownloadZip = async () => {
    if (renamedItems.length === 0) return;
    setIsZipping(true);
    setErrorMessage(null);

    try {
      const pending: PendingZipFile[] = renamedItems.map((it) => {
        const fullName = it.newExt ? `${it.newName}.${it.newExt}` : it.newName;
        return {
          id: it.id,
          file: it.file,
          relativePath: fullName,
          size: it.file.size,
        };
      });

      const zipBlob = await createZipArchive(pending, 'DEFLATE');
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'renamed-files.zip';
      link.click();
      URL.revokeObjectURL(url);
      setIsZipping(false);
    } catch {
      setIsZipping(false);
      setErrorMessage('Failed to pack renamed files into archive.');
    }
  };

  return (
    <ToolShell
      toolId="batch-file-renamer"
      title="Batch File Renamer"
      description="Rename dozens of files simultaneously with custom prefixes, sequential numbering, regex search & replace, and case converters."
      category="files"
      relatedToolIds={['zip-manager', 'photo-metadata-cleaner', 'list-processor']}
    >
      <div className="space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) handleAddFiles(e.dataTransfer.files);
          }}
          className="p-6 border-2 border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 text-center hover:border-blue-500 transition-colors bg-white dark:bg-neutral-900"
        >
          <FileText className="w-6 h-6 mx-auto mb-2 text-blue-600" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            Drop Any Files to Rename
          </h3>
          <p className="text-xs text-neutral-500 mb-3">
            Documents, photos, code files, archives, and media. 100% processed locally on your machine.
          </p>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs">
            <Upload className="w-4 h-4" />
            <span>Select Files</span>
            <input
              type="file"
              multiple
              onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
              className="hidden"
            />
          </label>
        </div>

        {files.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Rule Configuration Panel */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Renaming Rules
                  </h4>
                  <button
                    type="button"
                    onClick={handleResetRules}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Reset Rules
                  </button>
                </div>

                {/* 1. Prefix & Suffix */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-neutral-600 dark:text-neutral-400 block mb-1">Prefix</label>
                    <input
                      type="text"
                      value={rules.prefix}
                      onChange={(e) => setRules({ ...rules, prefix: e.target.value })}
                      placeholder="e.g. Doc_"
                      className="w-full px-2.5 py-1.5 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-neutral-600 dark:text-neutral-400 block mb-1">Suffix</label>
                    <input
                      type="text"
                      value={rules.suffix}
                      onChange={(e) => setRules({ ...rules, suffix: e.target.value })}
                      placeholder="e.g. _v2"
                      className="w-full px-2.5 py-1.5 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-mono"
                    />
                  </div>
                </div>

                {/* 2. Find & Replace */}
                <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 block">
                    Find & Replace
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={rules.findText}
                      onChange={(e) => setRules({ ...rules, findText: e.target.value })}
                      placeholder="Find..."
                      className="px-2.5 py-1.5 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-mono"
                    />
                    <input
                      type="text"
                      value={rules.replaceText}
                      onChange={(e) => setRules({ ...rules, replaceText: e.target.value })}
                      placeholder="Replace with..."
                      className="px-2.5 py-1.5 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-neutral-600 dark:text-neutral-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rules.matchCase}
                        onChange={(e) => setRules({ ...rules, matchCase: e.target.checked })}
                      />
                      <span>Match Case</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rules.useRegex}
                        onChange={(e) => setRules({ ...rules, useRegex: e.target.checked })}
                      />
                      <span>Use Regex</span>
                    </label>
                  </div>
                </div>

                {/* 3. Case Conversion */}
                <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <CaseSensitive className="w-3.5 h-3.5" />
                    <span>Change Letter Case</span>
                  </label>
                  <select
                    value={rules.caseConversion}
                    onChange={(e) =>
                      setRules({ ...rules, caseConversion: e.target.value as CaseConversionMode })
                    }
                    className="w-full px-2.5 py-1.5 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                  >
                    <option value="none">Preserve Original Case</option>
                    <option value="lowercase">lowercase</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="titlecase">Title Case</option>
                    <option value="kebabcase">kebab-case</option>
                    <option value="snakecase">snake_case</option>
                    <option value="camelcase">camelCase</option>
                  </select>
                </div>

                {/* 4. Sequential Numbering */}
                <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-neutral-700 dark:text-neutral-300">
                    <input
                      type="checkbox"
                      checked={rules.sequentialNumbering}
                      onChange={(e) =>
                        setRules({ ...rules, sequentialNumbering: e.target.checked })
                      }
                    />
                    <Binary className="w-3.5 h-3.5" />
                    <span>Sequential Numbering</span>
                  </label>

                  {rules.sequentialNumbering && (
                    <div className="grid grid-cols-3 gap-2 pl-5">
                      <div>
                        <label className="text-[10px] text-neutral-500 block mb-1">Start #</label>
                        <input
                          type="number"
                          value={rules.numberingStart}
                          onChange={(e) =>
                            setRules({ ...rules, numberingStart: parseInt(e.target.value) || 1 })
                          }
                          className="w-full px-2 py-1 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 block mb-1">Padding</label>
                        <select
                          value={rules.numberingPadding}
                          onChange={(e) =>
                            setRules({ ...rules, numberingPadding: parseInt(e.target.value) || 2 })
                          }
                          className="w-full px-2 py-1 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-mono"
                        >
                          <option value={1}>1 (1, 2...)</option>
                          <option value={2}>2 (01, 02...)</option>
                          <option value={3}>3 (001, 002...)</option>
                          <option value={4}>4 (0001...)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 block mb-1">Position</label>
                        <select
                          value={rules.numberingPosition}
                          onChange={(e) =>
                            setRules({ ...rules, numberingPosition: e.target.value as 'start' | 'end' })
                          }
                          className="w-full px-2 py-1 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                        >
                          <option value="end">At End</option>
                          <option value="start">At Start</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Date & Extension Settings */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-neutral-700 dark:text-neutral-300 font-semibold">
                    <input
                      type="checkbox"
                      checked={rules.insertDate}
                      onChange={(e) => setRules({ ...rules, insertDate: e.target.checked })}
                    />
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Append Today's Date</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Right: Live Preview Table & Export */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      Live Renaming Preview ({renamedItems.length} Files)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearFiles}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Clear Files
                  </button>
                </div>

                {/* Table */}
                <div className="max-h-[380px] overflow-y-auto border rounded-lg divide-y divide-neutral-100 dark:divide-neutral-800">
                  {renamedItems.map((it) => {
                    const fullTarget = it.newExt ? `${it.newName}.${it.newExt}` : it.newName;
                    return (
                      <div
                        key={it.id}
                        className="p-2.5 flex items-center justify-between text-xs hover:bg-neutral-50 dark:hover:bg-neutral-950 gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-neutral-500 block truncate line-through">
                            {it.originalName}
                          </span>
                          <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 block truncate">
                            {fullTarget}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {it.hasCollision && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded font-medium">
                              Auto-Numbered
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(it.id)}
                            className="text-neutral-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Download Zip Action */}
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isZipping || renamedItems.length === 0}
                  className="w-full py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md inline-flex items-center justify-center gap-2"
                >
                  <FolderArchive className="w-4 h-4" />
                  <span>{isZipping ? 'Packing ZIP...' : 'Download Renamed Files (.ZIP)'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default BatchFileRenamerTool;
