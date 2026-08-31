/**
 * Duplicate File Finder Utilities
 * Uses byte-size grouping, sampled SHA-256 prefiltering, then full SHA-256 verification.
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

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function calculateFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return bytesToHex(await crypto.subtle.digest('SHA-256', buffer));
}

/**
 * Hashes bounded slices from the beginning/middle/end. This is not used as
 * duplicate proof; it cheaply eliminates most same-size non-duplicates before
 * the expensive full-file read.
 */
export async function calculateFileSampleSha256(file: File, sampleBytes = 64 * 1024): Promise<string> {
  const sampleSize = Math.max(1024, Math.floor(sampleBytes));
  if (file.size <= sampleSize * 3) return calculateFileSha256(file);
  const middleStart = Math.max(0, Math.floor(file.size / 2 - sampleSize / 2));
  const chunks = [
    file.slice(0, sampleSize),
    file.slice(middleStart, Math.min(file.size, middleStart + sampleSize)),
    file.slice(Math.max(0, file.size - sampleSize), file.size),
  ];
  const sample = new Blob([`size:${file.size}|`, ...chunks]);
  return bytesToHex(await crypto.subtle.digest('SHA-256', await sample.arrayBuffer()));
}

export async function findDuplicateFiles(
  files: ScannedFileItem[],
  onProgress?: (processed: number, total: number, currentFile: string) => void
): Promise<DuplicateScanReport> {
  const totalFiles = files.length;
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const sizeMap = new Map<number, ScannedFileItem[]>();
  for (const file of files) {
    const group = sizeMap.get(file.size) || [];
    group.push(file);
    sizeMap.set(file.size, group);
  }

  const sizeCandidates = [...sizeMap.values()].filter((group) => group.length > 1).flat();
  let processedCount = totalFiles - sizeCandidates.length;
  onProgress?.(processedCount, totalFiles, 'Filtering unique file sizes...');

  // Stage 2: bounded sample fingerprints.
  const sampleMap = new Map<string, ScannedFileItem[]>();
  for (const fileItem of sizeCandidates) {
    onProgress?.(processedCount, totalFiles, `Sampling ${fileItem.name}`);
    const fingerprint = await calculateFileSampleSha256(fileItem.fileObject);
    const key = `${fileItem.size}:${fingerprint}`;
    const group = sampleMap.get(key) || [];
    group.push(fileItem);
    sampleMap.set(key, group);
  }

  const fullHashCandidates: ScannedFileItem[] = [];
  for (const group of sampleMap.values()) {
    if (group.length > 1) fullHashCandidates.push(...group);
    else processedCount += group.length;
  }

  // Stage 3: cryptographic proof. Only sample-colliding candidates are fully read.
  const hashMap = new Map<string, ScannedFileItem[]>();
  for (const fileItem of fullHashCandidates) {
    onProgress?.(processedCount, totalFiles, `Verifying ${fileItem.name}`);
    const hash = await calculateFileSha256(fileItem.fileObject);
    const group = hashMap.get(hash) || [];
    group.push(fileItem);
    hashMap.set(hash, group);
    processedCount++;
  }
  onProgress?.(totalFiles, totalFiles, 'Duplicate verification complete');

  const duplicateGroups: DuplicateGroup[] = [];
  let totalDuplicateFiles = 0;
  let totalReclaimableBytes = 0;
  for (const [hash, group] of hashMap.entries()) {
    if (group.length <= 1) continue;
    const size = group[0].size;
    const reclaimableBytes = (group.length - 1) * size;
    duplicateGroups.push({ hash, size, files: group, reclaimableBytes });
    totalDuplicateFiles += group.length - 1;
    totalReclaimableBytes += reclaimableBytes;
  }
  duplicateGroups.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes || a.files[0].name.localeCompare(b.files[0].name));

  return { totalFilesScanned: totalFiles, totalBytesScanned: totalBytes, duplicateGroups, totalDuplicateFiles, totalReclaimableBytes };
}

export function formatDuplicateReportText(report: DuplicateScanReport): string {
  const lines = [
    '=== Tiny Tools Duplicate File Report ===',
    `Scanned Files: ${report.totalFilesScanned}`,
    `Duplicate Groups Found: ${report.duplicateGroups.length}`,
    `Redundant Duplicate Files: ${report.totalDuplicateFiles}`,
    `Potentially Reclaimable Space: ${(report.totalReclaimableBytes / (1024 * 1024)).toFixed(2)} MB`,
    '',
  ];
  report.duplicateGroups.forEach((group, index) => {
    lines.push(`--- Group #${index + 1} (${(group.size / 1024).toFixed(1)} KB each, SHA-256: ${group.hash.substring(0, 12)}...) ---`);
    group.files.forEach((file) => {
      const date = Number.isFinite(file.lastModified) ? new Date(file.lastModified).toISOString().split('T')[0] : 'unknown';
      lines.push(`  • ${file.name} [${file.path || 'Root'}] (Modified: ${date})`);
    });
    lines.push('');
  });
  return lines.join('\n');
}
