# Phase 5 — Files Family Functional Certification

The final Phase 4 health matrix is authoritative:

- 351 total
- 322 PASS
- 0 BROKEN
- 29 BLOCKED
- 0 FLAKY

The largest remaining blocked family is **files**:

- 24 total file routes
- 13 already smoke-PASS
- 11 TEST_FIXTURE_MISSING / BLOCKED

Phase 5 adds deterministic utility contracts plus production-browser file uploads for all 11 blocked workflows.

## 11 blocked workflows

- Duplicate Finder
- CSV Merger
- File Type Inspector
- Create TAR
- Extract TAR
- GZIP Compress
- GZIP Decompress
- DOCX Metadata Inspector
- EPUB Metadata Editor
- Presentation Viewer
- EPUB Reader

## Test strategy

The focused browser suite generates real local fixture files before launching Chromium:

- duplicate text files
- compatible CSV files
- PNG-signature binary
- portable TAR archive
- GZIP file
- generated DOCX
- generated EPUB
- generated ODP presentation

The suite then injects those exact files through the production app's real `<input type="file">` controls using Chrome DevTools.

Only browser/file-system boundaries are controlled. Tiny Tools parsing, React state, event handlers, validation, metadata extraction, viewer rendering, and download generation are exercised as production code.

## Files-family hardening

### Duplicate Finder

- replaces the ephemeral dynamically-created file input with a persistent hidden input/ref;
- makes the upload path more testable and accessible;
- export now uses the shared hardened download helper instead of immediate Blob URL revocation.

### File conversion/archive tools

Local download helpers now delegate to Phase 2's shared `downloadBlobFile` lifecycle.

### Office/eBook tools

DOCX/EPUB downloads now use the same shared download lifecycle instead of detached anchors and duplicated URL-revocation logic.

## Deterministic contracts

`src/__tests__/phase5-files-contracts.test.ts` hard-gates all 24 file-family routes and verifies:

- exact duplicate SHA-256 grouping
- compatible/incompatible CSV merging
- signature-based PNG detection
- TAR round-trip
- GZIP round-trip
- DOCX metadata
- EPUB metadata editing
- ODP presentation reading
- EPUB reader model

## Global health integration

The global 351-tool health scan now executes Phase 5 certification.

A files route only loses `TEST_FIXTURE_MISSING` when its dedicated Phase 5 browser fixture passes.

A failed fixture becomes a real health failure.

Expected successful impact:

- PASS: 322 → 333
- BLOCKED: 29 → 18
- Files: 24/24 covered

Actual CI artifacts are authoritative.

## Commands

```bash
npm run test:phase5
npm run build
npm run build:verify
npm run browser:files
npm run browser:health
```

## Acceptance gate

Phase 5 completes when:

- all 24 file routes remain represented in the family completeness test;
- all 11 formerly blocked workflows pass deterministic browser fixtures;
- full unit/type/build gates pass;
- the global health report consumes Phase 5 evidence;
- no existing Phase 3/4 or 351-route browser regression is introduced.
