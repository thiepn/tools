import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Upload,
  Trash2,
  Download,
  MapPin,
  Camera,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  FolderArchive,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  ParsedExifData,
  parsePhotoMetadata,
  stripExifFromJpeg,
} from '../../utilities/photo-metadata';
import { createZipArchive, PendingZipFile } from '../../utilities/zip-manager';

interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  rawBuffer: ArrayBuffer;
  metadata: ParsedExifData;
  cleanedBlob?: Blob;
  cleanedUrl?: string;
  isCleaned: boolean;
}

export const PhotoMetadataCleanerTool: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [isCleaningAll, setIsCleaningAll] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddPhotos = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const newItems: PhotoItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith('image/')) continue;

      const buffer = await file.arrayBuffer();
      const meta = parsePhotoMetadata(buffer);
      const url = URL.createObjectURL(file);

      newItems.push({
        id: `photo-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: url,
        rawBuffer: buffer,
        metadata: meta,
        isCleaned: !meta.hasSensitiveData,
      });
    }

    setPhotos((prev) => {
      const combined = [...prev, ...newItems];
      if (!selectedPhotoId && combined.length > 0) {
        setSelectedPhotoId(combined[0].id);
      }
      return combined;
    });
  };

  const handleCleanSinglePhoto = (photo: PhotoItem) => {
    const cleanedBlob = stripExifFromJpeg(photo.rawBuffer);
    const cleanedUrl = URL.createObjectURL(cleanedBlob);

    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photo.id
          ? {
              ...p,
              cleanedBlob,
              cleanedUrl,
              isCleaned: true,
              metadata: {
                hasSensitiveData: false,
                sensitiveReasons: [],
              },
            }
          : p
      )
    );
  };

  const handleCleanAllPhotos = () => {
    setIsCleaningAll(true);
    setTimeout(() => {
      setPhotos((prev) =>
        prev.map((p) => {
          const cleanedBlob = stripExifFromJpeg(p.rawBuffer);
          const cleanedUrl = URL.createObjectURL(cleanedBlob);
          return {
            ...p,
            cleanedBlob,
            cleanedUrl,
            isCleaned: true,
            metadata: {
              hasSensitiveData: false,
              sensitiveReasons: [],
            },
          };
        })
      );
      setIsCleaningAll(false);
    }, 200);
  };

  const handleDownloadAllZip = async () => {
    if (photos.length === 0) return;
    setIsZipping(true);
    try {
      const pendingFiles: PendingZipFile[] = photos.map((p) => {
        const blob = p.cleanedBlob || stripExifFromJpeg(p.rawBuffer);
        const cleanFile = new File([blob], `clean-${p.file.name}`, { type: p.file.type });
        return {
          id: p.id,
          file: cleanFile,
          relativePath: `clean-${p.file.name}`,
          size: cleanFile.size,
        };
      });

      const zipBlob = await createZipArchive(pendingFiles, 'DEFLATE');
      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = 'cleaned-photos.zip';
      link.click();
      URL.revokeObjectURL(zipUrl);
      setIsZipping(false);
    } catch {
      setIsZipping(false);
      setErrorMessage('Failed to pack cleaned photos into zip.');
    }
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (selectedPhotoId === id) {
        setSelectedPhotoId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const selectedPhoto = photos.find((p) => p.id === selectedPhotoId);
  const sensitiveCount = photos.filter((p) => !p.isCleaned && p.metadata.hasSensitiveData).length;

  return (
    <ToolShell
      toolId="photo-metadata-cleaner"
      title="EXIF & Photo Privacy Cleaner"
      description="Inspect hidden GPS coordinates, camera hardware identifiers, and timestamps, then losslessly strip metadata to safeguard your privacy."
      category="image"
      relatedToolIds={['image-optimizer', 'zip-manager', 'image-annotator']}
    >
      <div className="space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Top Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) handleAddPhotos(e.dataTransfer.files);
          }}
          className="p-6 border-2 border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 text-center hover:border-blue-500 transition-colors bg-white dark:bg-neutral-900"
        >
          <ShieldAlert className="w-6 h-6 mx-auto mb-2 text-rose-500" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            Drop Photos to Inspect & Clean Metadata
          </h3>
          <p className="text-xs text-neutral-500 mb-3">
            Losslessly removes GPS location, camera serial numbers, and creation timestamps before sharing online.
          </p>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs">
            <Upload className="w-4 h-4" />
            <span>Select Photos</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => e.target.files && handleAddPhotos(e.target.files)}
              className="hidden"
            />
          </label>
        </div>

        {photos.length > 0 && (
          <div className="space-y-4">
            {/* Batch Status Bar */}
            <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  {photos.length} Photos Loaded
                </span>
                {sensitiveCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {sensitiveCount} Contain Sensitive Metadata
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    All Photos Cleaned & Safe
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCleanAllPhotos}
                  disabled={sensitiveCount === 0 || isCleaningAll}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Strip All EXIF Metadata</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAllZip}
                  disabled={isZipping}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-2xs inline-flex items-center gap-1.5"
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>Download Cleaned (.ZIP)</span>
                </button>
              </div>
            </div>

            {/* Main Inspection Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Photo Thumbnails List */}
              <div className="lg:col-span-4 space-y-2 max-h-[460px] overflow-y-auto">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPhotoId(p.id)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      selectedPhotoId === p.id
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="w-12 h-12 rounded bg-neutral-100 dark:bg-neutral-800 overflow-hidden shrink-0 border border-neutral-200 dark:border-neutral-700">
                      <img src={p.previewUrl} alt="thumb" className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block truncate">
                        {p.file.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.isCleaned ? (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" /> Safe
                          </span>
                        ) : p.metadata.hasSensitiveData ? (
                          <span className="text-[10px] text-rose-600 font-bold flex items-center gap-0.5">
                            <ShieldAlert className="w-3 h-3" /> EXIF Found
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400">No EXIF</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePhoto(p.id);
                      }}
                      className="text-neutral-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Photo Detail & Metadata Table */}
              {selectedPhoto && (
                <div className="lg:col-span-8 p-5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                    <div>
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        {selectedPhoto.file.name}
                      </h4>
                      <span className="text-xs text-neutral-500">
                        {(selectedPhoto.file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    {selectedPhoto.isCleaned ? (
                      <span className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Cleaned Losslessly
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCleanSinglePhoto(selectedPhoto)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-2xs inline-flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Clean This Photo</span>
                      </button>
                    )}
                  </div>

                  {/* Privacy Badges Alert */}
                  {selectedPhoto.metadata.hasSensitiveData && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800 space-y-1.5">
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-200 block flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Identified Privacy Risks:
                      </span>
                      <ul className="text-xs text-rose-700 dark:text-rose-300 list-disc list-inside space-y-0.5">
                        {selectedPhoto.metadata.sensitiveReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Metadata Fields Table */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
                      Parsed EXIF Header Tags
                    </span>

                    <div className="border rounded-lg divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                      {/* GPS Location */}
                      <div className="p-2.5 flex items-center justify-between">
                        <span className="text-neutral-500 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          <span>GPS Coordinates</span>
                        </span>
                        {selectedPhoto.metadata.gps ? (
                          <div className="flex items-center gap-2 font-mono font-semibold text-rose-600">
                            <span>
                              {selectedPhoto.metadata.gps.latitude}, {selectedPhoto.metadata.gps.longitude}
                            </span>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${selectedPhoto.metadata.gps.latitude},${selectedPhoto.metadata.gps.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              <span>View Map</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-neutral-400">None detected</span>
                        )}
                      </div>

                      {/* Camera Make & Model */}
                      <div className="p-2.5 flex items-center justify-between">
                        <span className="text-neutral-500 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-blue-500" />
                          <span>Camera / Device</span>
                        </span>
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {selectedPhoto.metadata.make || selectedPhoto.metadata.model
                            ? `${selectedPhoto.metadata.make || ''} ${selectedPhoto.metadata.model || ''}`.trim()
                            : 'None detected'}
                        </span>
                      </div>

                      {/* Software */}
                      <div className="p-2.5 flex items-center justify-between">
                        <span className="text-neutral-500">Software / Firmware</span>
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {selectedPhoto.metadata.software || 'None detected'}
                        </span>
                      </div>

                      {/* Date Time */}
                      <div className="p-2.5 flex items-center justify-between">
                        <span className="text-neutral-500 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-500" />
                          <span>Capture Timestamp</span>
                        </span>
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {selectedPhoto.metadata.dateTime || 'None detected'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cleaned Download */}
                  {selectedPhoto.cleanedUrl && (
                    <div className="pt-2">
                      <a
                        href={selectedPhoto.cleanedUrl}
                        download={`clean-${selectedPhoto.file.name}`}
                        className="w-full py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-center shadow-2xs inline-flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Cleaned Image</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default PhotoMetadataCleanerTool;
