import React, { useState } from 'react';
import {
  FolderArchive,
  Upload,
  Plus,
  Trash2,
  Download,
  File,
  Folder,
  CheckCircle2,
  FileArchive,
  Search,
  Sliders,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  ArchiveEntry,
  PendingZipFile,
  parseZipArchive,
  createZipArchive,
  formatArchiveSize,
} from '../../utilities/zip-manager';
import type JSZip from 'jszip';

export const ZipManagerTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'open'>('create');

  // Create Mode State
  const [pendingFiles, setPendingFiles] = useState<PendingZipFile[]>([]);
  const [zipName, setZipName] = useState<string>('archive.zip');
  const [compressionMode, setCompressionMode] = useState<'DEFLATE' | 'STORE'>('DEFLATE');
  const [isCreatingZip, setIsCreatingZip] = useState<boolean>(false);
  const [createProgress, setCreateProgress] = useState<number>(0);
  const [createdZipUrl, setCreatedZipUrl] = useState<string | null>(null);
  const [createdZipSize, setCreatedZipSize] = useState<number | null>(null);

  // Open & Extract Mode State
  const [openedEntries, setOpenedEntries] = useState<ArchiveEntry[]>([]);
  const [totalArchiveSize, setTotalArchiveSize] = useState<number>(0);
  const [zipInstance, setZipInstance] = useState<JSZip | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [openedFilename, setOpenedFilename] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add files for ZIP creation
  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const newItems: PendingZipFile[] = Array.from(fileList).map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f,
      relativePath: (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name,
      size: f.size,
    }));

    setPendingFiles((prev) => [...prev, ...newItems]);
    setCreatedZipUrl(null);
  };

  const handleRemoveFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
    setCreatedZipUrl(null);
  };

  const handleClearCreate = () => {
    setPendingFiles([]);
    setCreatedZipUrl(null);
    setCreatedZipSize(null);
    setErrorMessage(null);
  };

  // Generate ZIP
  const handleGenerateZip = async () => {
    if (pendingFiles.length === 0) return;
    setIsCreatingZip(true);
    setCreateProgress(0);
    setErrorMessage(null);

    try {
      const blob = await createZipArchive(pendingFiles, compressionMode, (pct) => {
        setCreateProgress(pct);
      });

      const url = URL.createObjectURL(blob);
      setCreatedZipUrl(url);
      setCreatedZipSize(blob.size);
      setIsCreatingZip(false);
    } catch (err: unknown) {
      setIsCreatingZip(false);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create ZIP archive.');
    }
  };

  // Open existing ZIP
  const handleOpenZipFile = async (file: File) => {
    if (!file.name.endsWith('.zip') && file.type !== 'application/zip') {
      setErrorMessage('Please provide a valid .ZIP archive.');
      return;
    }

    setErrorMessage(null);
    setOpenedFilename(file.name);

    try {
      const { entries, totalUncompressedSize, zipInstance: loadedZip } = await parseZipArchive(file);
      setOpenedEntries(entries);
      setTotalArchiveSize(totalUncompressedSize);
      setZipInstance(loadedZip);
    } catch {
      setErrorMessage('Failed to read and parse ZIP file contents.');
    }
  };

  // Extract individual file
  const handleExtractFile = async (entry: ArchiveEntry) => {
    if (!zipInstance || entry.isFolder) return;
    try {
      const fileObj = zipInstance.file(entry.path);
      if (!fileObj) return;

      const blob = await fileObj.async('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = entry.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMessage(`Failed to extract ${entry.name}`);
    }
  };

  const totalCreateSize = pendingFiles.reduce((s, f) => s + f.size, 0);
  const filteredEntries = openedEntries.filter((e) =>
    e.path.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <ToolShell
      toolId="zip-manager"
      title="ZIP / Archive Manager"
      description="Create, compress, inspect, and extract ZIP archives locally in your browser with zero server uploads."
      category="files"
      relatedToolIds={['batch-file-renamer', 'photo-metadata-cleaner', 'pdf-tools']}
    >
      <div className="space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>Create ZIP Archive</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('open')}
            className={`pb-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'open'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <FileArchive className="w-4 h-4" />
            <span>Open & Extract ZIP</span>
          </button>
        </div>

        {/* CREATE ZIP TAB */}
        {activeTab === 'create' && (
          <div className="space-y-5">
            {/* Upload Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleAddFiles(e.dataTransfer.files);
              }}
              className="p-6 border-2 border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 text-center hover:border-blue-500 transition-colors bg-white dark:bg-neutral-900"
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                Drag & Drop Files or Folders to Compress
              </h3>
              <p className="text-xs text-neutral-500 mb-3">
                All processing happens locally on your computer.
              </p>
              <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs">
                <Plus className="w-4 h-4" />
                <span>Add Files</span>
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleAddFiles(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            {/* Pending Files List & Options */}
            {pendingFiles.length > 0 && (
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {pendingFiles.length} Files Selected
                    </span>
                    <span className="text-xs text-neutral-500 ml-2">
                      (Total Uncompressed: {formatArchiveSize(totalCreateSize)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearCreate}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                {/* File list */}
                <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 border rounded-lg">
                  {pendingFiles.map((f) => (
                    <div
                      key={f.id}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-neutral-50 dark:hover:bg-neutral-950"
                    >
                      <div className="flex items-center gap-2 truncate max-w-md">
                        <File className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="truncate font-mono">{f.relativePath}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-neutral-500">{formatArchiveSize(f.size)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(f.id)}
                          className="text-neutral-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Compression Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                      Archive Filename:
                    </label>
                    <input
                      type="text"
                      value={zipName}
                      onChange={(e) => setZipName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                      Compression Mode:
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setCompressionMode('DEFLATE')}
                        className={`py-1.5 rounded border font-medium ${
                          compressionMode === 'DEFLATE'
                            ? 'bg-blue-600 text-white border-transparent'
                            : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700'
                        }`}
                      >
                        Deflate (Compressed)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompressionMode('STORE')}
                        className={`py-1.5 rounded border font-medium ${
                          compressionMode === 'STORE'
                            ? 'bg-blue-600 text-white border-transparent'
                            : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700'
                        }`}
                      >
                        Store (Fast / No-loss)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Generate ZIP action */}
                {isCreatingZip ? (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-center space-y-2">
                    <span className="text-xs text-blue-900 dark:text-blue-200">
                      Compressing Archive... {createProgress}%
                    </span>
                    <div className="w-full bg-blue-200 dark:bg-blue-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all"
                        style={{ width: `${createProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateZip}
                    className="w-full py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md inline-flex items-center justify-center gap-2"
                  >
                    <FolderArchive className="w-4 h-4" />
                    <span>Build & Download ZIP Archive</span>
                  </button>
                )}

                {/* Download banner */}
                {createdZipUrl && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3">
                    <div className="text-xs text-emerald-900 dark:text-emerald-200">
                      <span className="font-bold block flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ZIP Ready!
                      </span>
                      <span>Archive Size: {createdZipSize ? formatArchiveSize(createdZipSize) : 'N/A'}</span>
                    </div>

                    <a
                      href={createdZipUrl}
                      download={zipName.endsWith('.zip') ? zipName : `${zipName}.zip`}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download .ZIP</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* OPEN & EXTRACT ZIP TAB */}
        {activeTab === 'open' && (
          <div className="space-y-5">
            {!zipInstance ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files[0]) handleOpenZipFile(e.dataTransfer.files[0]);
                }}
                className="p-8 sm:p-12 border-2 border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 text-center hover:border-blue-500 transition-colors bg-white dark:bg-neutral-900"
              >
                <FileArchive className="w-10 h-10 mx-auto mb-3 text-neutral-400" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                  Select a .ZIP File to Inspect and Extract
                </h3>
                <p className="text-xs text-neutral-500 mb-4 max-w-sm mx-auto">
                  Inspect archive directory structure and extract individual files without external software.
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs">
                  <Upload className="w-4 h-4" />
                  <span>Choose .ZIP File</span>
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    onChange={(e) => e.target.files?.[0] && handleOpenZipFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 block font-mono">
                      {openedFilename}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {openedEntries.length} entries • Total uncompressed: {formatArchiveSize(totalArchiveSize)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setZipInstance(null);
                      setOpenedEntries([]);
                    }}
                    className="text-xs text-neutral-500 hover:underline"
                  >
                    Open Another ZIP
                  </button>
                </div>

                {/* Filter Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search inside archive..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-lg bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-mono"
                  />
                </div>

                {/* Entries Table */}
                <div className="max-h-72 overflow-y-auto border rounded-lg divide-y divide-neutral-100 dark:divide-neutral-800">
                  {filteredEntries.map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-neutral-50 dark:hover:bg-neutral-950"
                    >
                      <div className="flex items-center gap-2 truncate max-w-md">
                        {entry.isFolder ? (
                          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <File className="w-4 h-4 text-blue-500 shrink-0" />
                        )}
                        <span className="truncate font-mono">{entry.path}</span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-neutral-500">
                          {entry.isFolder ? 'Folder' : formatArchiveSize(entry.uncompressedSize)}
                        </span>
                        {!entry.isFolder && (
                          <button
                            type="button"
                            onClick={() => handleExtractFile(entry)}
                            className="px-2 py-1 text-[11px] font-semibold rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>Extract</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default ZipManagerTool;
