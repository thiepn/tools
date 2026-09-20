import { describe, expect, it } from 'vitest';
import { registerAllPublicTools } from '../registry/register-all';
import { TOOLS_REGISTRY } from '../registry/tools';
import {
  createTar,
  gunzipBytes,
  gzipBytes,
  inspectFile,
  mergeCsvTexts,
  parseTar,
} from '../utilities/file-format-conversion';
import {
  findDuplicateFiles,
  type ScannedFileItem,
} from '../utilities/duplicate-finder';
import {
  createDocx,
  createEpub,
  editEpubMetadata,
  inspectDocxMetadata,
  inspectEpubMetadata,
} from '../utilities/p13-office';
import { createOdp } from '../utilities/mainstream-odp';
import {
  readEbook,
  readPresentation,
  type ViewerFileLike,
} from '../utilities/p17-viewers';

registerAllPublicTools();

const FILE_ROUTE_IDS = [
  'zip-manager',
  'batch-file-renamer',
  'duplicate-finder',
  'data-converter',
  'csv-splitter',
  'csv-merger',
  'file-type-inspector',
  'tar-pack',
  'tar-extract',
  'gzip-compress',
  'gzip-decompress',
  'archive-converter',
  'file-checksum-generator',
  'checksum-verifier',
  'file-encryptor',
  'file-base64-converter',
  'document-converter',
  'docx-metadata-inspector',
  'epub-metadata-editor',
  'document-viewer',
  'spreadsheet-viewer',
  'presentation-viewer',
  'ebook-reader',
  'archive-browser',
].sort();

function viewerFile(name: string, bytes: Uint8Array, type = ''): ViewerFileLike {
  return {
    name,
    size: bytes.byteLength,
    type,
    async text() {
      return new TextDecoder().decode(bytes);
    },
    async arrayBuffer() {
      return bytes.slice().buffer;
    },
  };
}

describe('Phase 5 files-family completeness', () => {
  it('covers exactly the complete 24-route files family', () => {
    const registryIds = TOOLS_REGISTRY
      .filter((tool) => tool.category === 'files')
      .map((tool) => tool.id)
      .sort();

    expect(registryIds).toHaveLength(24);
    expect(registryIds).toEqual(FILE_ROUTE_IDS);
  });
});

describe('Phase 5 duplicate, CSV and inspection contracts', () => {
  it('proves exact duplicates by full SHA-256 after size/sample grouping', async () => {
    const a = new File(['same-content'], 'a.txt', { type: 'text/plain', lastModified: 1000 });
    const b = new File(['same-content'], 'b.txt', { type: 'text/plain', lastModified: 2000 });
    const c = new File(['different!!'], 'c.txt', { type: 'text/plain', lastModified: 3000 });

    const items: ScannedFileItem[] = [a, b, c].map((file, index) => ({
      id: `f-${index}`,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      fileObject: file,
      path: file.name,
    }));

    const report = await findDuplicateFiles(items);
    expect(report.totalFilesScanned).toBe(3);
    expect(report.duplicateGroups).toHaveLength(1);
    expect(report.duplicateGroups[0].files.map((file) => file.name).sort()).toEqual(['a.txt', 'b.txt']);
    expect(report.totalDuplicateFiles).toBe(1);
    expect(report.totalReclaimableBytes).toBe(a.size);
  });

  it('merges compatible CSV files with one header and rejects mismatches', () => {
    expect(mergeCsvTexts([
      'id,name\r\n1,Ada',
      'id,name\r\n2,Lin',
    ])).toBe('id,name\r\n1,Ada\r\n2,Lin');

    expect(() => mergeCsvTexts([
      'id,name\r\n1,Ada',
      'name,id\r\nLin,2',
    ])).toThrow(/header/i);
  });

  it('detects PNG signatures independently of misleading browser MIME hints', async () => {
    const bytes = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
    const inspection = await inspectFile(viewerFile('mystery.bin', bytes, 'text/plain'));
    expect(inspection.detectedType).toBe('PNG image');
    expect(inspection.mime).toBe('image/png');
    expect(inspection.confidence).toBe('high');
    expect(inspection.notes.some((note) => /differs/i.test(note))).toBe(true);
  });
});

describe('Phase 5 TAR and GZIP contracts', () => {
  it('round-trips multiple files through portable TAR', () => {
    const tar = createTar([
      { path: 'hello.txt', bytes: new TextEncoder().encode('hello'), mtime: new Date(0) },
      { path: 'folder/data.csv', bytes: new TextEncoder().encode('a,b\n1,2'), mtime: new Date(1000) },
    ]);

    const entries = parseTar(tar);
    expect(entries.map((entry) => entry.path)).toEqual(['hello.txt', 'folder/data.csv']);
    expect(new TextDecoder().decode(entries[0].bytes)).toBe('hello');
    expect(new TextDecoder().decode(entries[1].bytes)).toBe('a,b\n1,2');
  });

  it('round-trips bytes through browser-compatible GZIP streams', async () => {
    const source = new TextEncoder().encode('Tiny Tools Phase 5 gzip fixture');
    const compressed = await gzipBytes(source);
    expect(compressed[0]).toBe(0x1f);
    expect(compressed[1]).toBe(0x8b);

    const restored = await gunzipBytes(compressed);
    expect(new TextDecoder().decode(restored)).toBe('Tiny Tools Phase 5 gzip fixture');
  });
});

describe('Phase 5 Office/eBook metadata contracts', () => {
  it('reads deterministic DOCX package metadata', async () => {
    const bytes = await createDocx('# Report\n\nHello', { title: 'Phase 5 DOCX', creator: 'Tiny Tools' });
    const metadata = await inspectDocxMetadata(bytes);
    expect(metadata.title).toBe('Phase 5 DOCX');
    expect(metadata.creator).toBe('Tiny Tools');
    expect(metadata.application).toBe('Tiny Tools');
  });

  it('edits EPUB metadata without losing the book package', async () => {
    const bytes = await createEpub('# Chapter\n\nHello reader', {
      title: 'Original Book',
      creator: 'Ada',
      language: 'en',
    });
    const edited = await editEpubMetadata(bytes, {
      title: 'Edited Book',
      publisher: 'Tiny Tools',
    });
    const metadata = await inspectEpubMetadata(edited);
    expect(metadata.title).toBe('Edited Book');
    expect(metadata.creator).toBe('Ada');
    expect(metadata.publisher).toBe('Tiny Tools');
  });
});

describe('Phase 5 presentation and ebook viewer contracts', () => {
  it('opens a generated ODP presentation with ordered slide text', async () => {
    const bytes = await createOdp('# First\n- Alpha\n# Second\n- Beta', 'Phase 5 Deck');
    const view = await readPresentation(viewerFile('deck.odp', bytes));
    expect(view.format).toBe('ODP');
    expect(view.slides.length).toBeGreaterThanOrEqual(2);
    expect(view.slides[0].title).toBe('First');
    expect(view.slides.some((slide) => slide.title === 'Second')).toBe(true);
  });

  it('opens a generated EPUB through the actual reader model', async () => {
    const bytes = await createEpub('# Tiny Book\n\nHello Phase 5', {
      title: 'Tiny Book',
      creator: 'Tiny Tools',
    });
    const view = await readEbook(viewerFile('book.epub', bytes));
    expect(view.metadata.title).toBe('Tiny Book');
    expect(view.metadata.creator).toBe('Tiny Tools');
    expect(view.chapters).toHaveLength(1);
    expect(view.chapters[0].text).toContain('Hello Phase 5');
  });
});
