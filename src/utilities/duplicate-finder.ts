/**
 * Duplicate File Finder Utilities
 * Uses byte-size grouping and Web Crypto SHA-256 hashing
 */

export interface ScannedFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  fileObject: File;
  path?: string;
  fileHandle?: FileSystemFileHandle;
}

export interface DuplicateGroup {
  hash: string;
  size: number;
  files: ScannedFileItem[];
  reclaimableBytes: number;
}

export interface DuplicateScanReport {
  totalFilesScanned: number;
  totalBytesScanned: number;
  duplicateGroups: DuplicateGroup[];
  totalDuplicateFiles: number;
  totalReclaimableBytes: number;
}

/**
 * Computes SHA-256 hash of a File using Web Crypto API
 */
export async function calculateFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Groups candidate files by byte size, then hashes matching candidates to detect duplicates
 */
export async function findDuplicateFiles(
  files: ScannedFileItem[],
  onProgress?: (processed: number, total: number, currentFile: string) => void
): Promise<DuplicateScanReport> {
  const totalFiles = files.length;
  let totalBytes = 0;

  // 1. Group by exact file size
  const sizeMap = new Map<number, ScannedFileItem[]>();
  for (const f of files) {
    totalBytes += f.size;
    const existing = sizeMap.get(f.size) || [];
    existing.push(f);
    sizeMap.set(f.size, existing);
  }

  // 2. Only candidates with size collisions (> 1 file with same size) need hash verification
  const candidateFiles: ScannedFileItem[] = [];
  for (const [size, group] of sizeMap.entries()) {
    if (size > 0 && group.length > 1) {
      candidateFiles.push(...group);
    }
  }

  let processedCount = totalFiles - candidateFiles.length;
  if (onProgress) {
    onProgress(processedCount, totalFiles, 'Filtering unique file sizes...');
  }

  // 3. Compute SHA-256 for candidate files
  const hashMap = new Map<string, ScannedFileItem[]>();
  for (const fileItem of candidateFiles) {
    if (onProgress) {
      onProgress(processedCount, totalFiles, fileItem.name);
    }
    const hash = await calculateFileSha256(fileItem.fileObject);
    const existing = hashMap.get(hash) || [];
    existing.push(fileItem);
    hashMap.set(hash, existing);
    processedCount++;
  }

  // 4. Build duplicate groups
  const duplicateGroups: DuplicateGroup[] = [];
  let totalDuplicateFiles = 0;
  let totalReclaimableBytes = 0;

  for (const [hash, group] of hashMap.entries()) {
    if (group.length > 1) {
      const size = group[0].size;
      const reclaimable = (group.length - 1) * size;
      duplicateGroups.push({
        hash,
        size,
        files: group,
        reclaimableBytes: reclaimable,
      });
      totalDuplicateFiles += group.length - 1;
      totalReclaimableBytes += reclaimable;
    }
  }

  // Sort groups by reclaimable size descending
  duplicateGroups.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes);

  return {
    totalFilesScanned: totalFiles,
    totalBytesScanned: totalBytes,
    duplicateGroups,
    totalDuplicateFiles,
    totalReclaimableBytes,
  };
}

/**
 * Formats duplicate report as plain text or markdown
 */
export function formatDuplicateReportText(report: DuplicateScanReport): string {
  const lines: string[] = [
    '=== Tiny Tools Duplicate File Report ===',
    `Scanned Files: ${report.totalFilesScanned}`,
    `Duplicate Groups Found: ${report.duplicateGroups.length}`,
    `Redundant Duplicate Files: ${report.totalDuplicateFiles}`,
    `Potentially Reclaimable Space: ${(report.totalReclaimableBytes / (1024 * 1024)).toFixed(2)} MB`,
    '',
  ];

  report.duplicateGroups.forEach((group, idx) => {
    lines.push(`--- Group #${idx + 1} (${(group.size / 1024).toFixed(1)} KB each, SHA-256: ${group.hash.substring(0, 12)}...) ---`);
    group.files.forEach((f) => {
      const dateStr = new Date(f.lastModified).toISOString().split('T')[0];
      lines.push(`  • ${f.name} [${f.path || 'Root'}] (Modified: ${dateStr})`);
    });
    lines.push('');
  });

  return lines.join('\n');
}
