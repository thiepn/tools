import React, { useState, useRef } from 'react';
import {
  Files,
  FolderSearch,
  CheckSquare,
  Square,
  Download,
  FileCheck,
  HardDrive,
  Copy,
  Check,
} from 'lucide-react';
import {
  ScannedFileItem,
  DuplicateGroup,
  DuplicateScanReport,
  findDuplicateFiles,
  formatDuplicateReportText,
} from '../../utilities/duplicate-finder';
import { copyToClipboard } from '../../utilities/clipboard';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const DuplicateFinderTool: React.FC = () => {
  const [minSizeBytes, setMinSizeBytes] = useState<number>(0);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number; current: string } | null>(null);
  const [report, setReport] = useState<DuplicateScanReport | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const handleFilesSelected = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length < 2) {
      window.alert('Please select at least 2 files to scan for duplicates.');
      return;
    }

    const items: ScannedFileItem[] = list
      .filter((f) => f.size >= minSizeBytes)
      .map((f, i) => ({
        id: `file-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        name: f.name,
        size: f.size,
        type: f.type,
        lastModified: f.lastModified,
        fileObject: f,
        path: (f as any).webkitRelativePath || f.name,
      }));

    if (items.length < 2) {
      window.alert('At least 2 files must meet the minimum size threshold.');
      return;
    }

    setIsScanning(true);
    setReport(null);
    setSelectedIds(new Set());

    try {
      const scanReport = await findDuplicateFiles(items, (processed, total, current) => {
        setProgress({ processed, total, current });
      });
      setReport(scanReport);

      const defaultSelected = new Set<string>();
      scanReport.duplicateGroups.forEach((grp) => {
        grp.files.slice(1).forEach((f) => defaultSelected.add(f.id));
      });
      setSelectedIds(defaultSelected);
    } catch (err: any) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectKeepOldest = () => {
    if (!report) return;
    const next = new Set<string>();
    report.duplicateGroups.forEach((grp) => {
      const sorted = [...grp.files].sort((a, b) => a.lastModified - b.lastModified);
      sorted.slice(1).forEach((f) => next.add(f.id));
    });
    setSelectedIds(next);
  };

  const selectKeepNewest = () => {
    if (!report) return;
    const next = new Set<string>();
    report.duplicateGroups.forEach((grp) => {
      const sorted = [...grp.files].sort((a, b) => b.lastModified - a.lastModified);
      sorted.slice(1).forEach((f) => next.add(f.id));
    });
    setSelectedIds(next);
  };

  const handleExportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duplicate-files-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = async () => {
    if (!report) return;
    const text = formatDuplicateReportText(report);
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
          }}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors bg-white dark:bg-slate-950/50 cursor-pointer"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.onchange = (e: any) => {
              if (e.target.files) handleFilesSelected(e.target.files);
            };
            input.click();
          }}
        >
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <FolderSearch className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Choose or Drop Files to Find Duplicates
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
            Detects exact binary duplicates using in-browser SHA-256 Web Crypto hashing. Fast two-stage size grouping. No file data leaves your device.
          </p>

          <div className="flex justify-center gap-2">
            <span className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 pointer-events-none">
              <Files className="w-4 h-4" />
              Select Batch of Files
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Min File Size:</span>
            <select
              value={minSizeBytes}
              onChange={(e) => setMinSizeBytes(Number(e.target.value))}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value={0}>Any Size (0 B+)</option>
              <option value={102400}>100 KB+</option>
              <option value={1048576}>1 MB+</option>
              <option value={10485760}>10 MB+</option>
            </select>
          </div>

          {report && (
            <div className="text-xs text-slate-500 font-mono">
              Scanned {report.totalFilesScanned} files ({formatBytes(report.totalBytesScanned)})
            </div>
          )}
        </div>

        {isScanning && progress && (
          <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg space-y-2">
            <div className="flex justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              <span>Hashing and comparing files...</span>
              <span>
                {progress.processed} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-indigo-200 dark:bg-indigo-900 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all"
                style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
              />
            </div>
            <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-mono truncate">
              {progress.current}
            </div>
          </div>
        )}
      </div>

      {report && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-600 text-white">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Found {report.duplicateGroups.length} Duplicate Sets ({report.totalDuplicateFiles} redundant copies)
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Potentially reclaimable disk space:{' '}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {formatBytes(report.totalReclaimableBytes)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={selectKeepOldest}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium"
              >
                Keep Oldest
              </button>
              <button
                onClick={selectKeepNewest}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium"
              >
                Keep Newest
              </button>
              <button
                onClick={handleCopyReport}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Summary'}
              </button>
              <button
                onClick={handleExportJson}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export Audit Report (JSON)
              </button>
            </div>
          </div>

          {report.duplicateGroups.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              No exact duplicates detected among the scanned files.
            </div>
          ) : (
            <div className="space-y-3">
              {report.duplicateGroups.map((group, groupIdx) => (
                <div
                  key={group.hash}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 shadow-xs"
                >
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                      Set #{groupIdx + 1} • {group.files.length} Copies ({formatBytes(group.size)} each)
                    </span>
                    <span className="font-mono text-slate-500 font-normal">
                      Reclaimable: {formatBytes(group.reclaimableBytes)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.files.map((f, fIdx) => {
                      const isSelected = selectedIds.has(f.id);
                      return (
                        <div
                          key={f.id}
                          onClick={() => toggleSelectId(f.id)}
                          className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                            <div>
                              <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                                {f.name}{' '}
                                {fIdx === 0 && (
                                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded ml-1">
                                    Original Candidate
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                Modified: {new Date(f.lastModified).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                            {formatBytes(f.size)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DuplicateFinderTool;
