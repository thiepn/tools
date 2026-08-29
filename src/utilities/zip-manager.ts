/**
 * ZIP / Archive Manager Utility
 * In-browser zip archive creation, parsing, path sanitization, and compression helpers using JSZip
 */

import JSZip from 'jszip';

export interface ArchiveEntry {
  path: string;
  name: string;
  isFolder: boolean;
  uncompressedSize: number;
  compressedSize?: number;
  date?: Date;
  comment?: string;
}

export interface PendingZipFile {
  id: string;
  file: File;
  relativePath: string;
  size: number;
}

/**
 * Sanitizes zip file path to prevent directory traversal attacks (e.g. ../ or / paths)
 */
export function sanitizeZipPath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  const safeSegments: string[] = [];

  for (const seg of segments) {
    if (seg === '.') {
      continue;
    } else if (seg === '..') {
      if (safeSegments.length > 0) {
        safeSegments.pop();
      }
    } else {
      safeSegments.push(seg);
    }
  }

  return safeSegments.join('/');
}

/**
 * Parses and inspects an uploaded ZIP file buffer safely
 */
export async function parseZipArchive(zipBlob: Blob | ArrayBuffer): Promise<{
  entries: ArchiveEntry[];
  totalUncompressedSize: number;
  zipInstance: JSZip;
}> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipBlob);
  const entries: ArchiveEntry[] = [];
  let totalUncompressedSize = 0;

  loadedZip.forEach((relativePath, fileObj) => {
    const safePath = sanitizeZipPath(relativePath);
    const isFolder = fileObj.dir || relativePath.endsWith('/');
    const size = (fileObj as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0;
    totalUncompressedSize += size;

    const parts = safePath.split('/');
    const name = parts[parts.length - 1] || safePath;

    entries.push({
      path: safePath,
      name,
      isFolder,
      uncompressedSize: size,
      date: fileObj.date,
      comment: fileObj.comment,
    });
  });

  return {
    entries,
    totalUncompressedSize,
    zipInstance: loadedZip,
  };
}

/**
 * Creates and compresses a new ZIP archive from user files
 */
export async function createZipArchive(
  files: PendingZipFile[],
  compressionLevel: 'STORE' | 'DEFLATE' = 'DEFLATE',
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const zip = new JSZip();

  for (const item of files) {
    const safePath = sanitizeZipPath(item.relativePath || item.file.name);
    zip.file(safePath, item.file);
  }

  const compressionOptions: JSZip.JSZipGeneratorOptions<'blob'> = {
    type: 'blob',
    compression: compressionLevel,
    compressionOptions: {
      level: compressionLevel === 'DEFLATE' ? 6 : 1,
    },
  };

  const blob = await zip.generateAsync(compressionOptions, (metadata) => {
    if (onProgress) {
      onProgress(Math.round(metadata.percent));
    }
  });

  return blob;
}

/**
 * Formats byte sizes cleanly
 */
export function formatArchiveSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
