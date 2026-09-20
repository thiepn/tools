# Phase 7 — PDF Production Functional Certification

Phase 7 targets the five PDF routes that remained `TEST_FIXTURE_MISSING` in the authoritative health matrix:

- Merge PDF
- Split PDF
- OCR PDF
- Compress PDF
- PDF Metadata

The complete PDF family contains **18 Tiny Tools routes**.

## Architecture

Tiny Tools does not implement these PDF engines inside `thiepn/tools`.

Each PDF route is a gateway to the sibling **PDF Everything** application at:

`https://thiepn.github.io/pdf/`

That application owns merge, page splitting, OCR, compression, metadata and the rest of the PDF engine.

For that reason Phase 7 intentionally certifies the **real deployed sibling application** rather than replacing it with a fake local implementation.

Existing Tiny Tools tests continue to verify:

- all 18 PDF routes are registered;
- the gateway renders;
- route IDs are unique;
- each route maps to the intended PDF task hash.

Phase 7 adds actual production workflow evidence across the gateway boundary.

## Five certified route mappings

| Tiny Tools | PDF Everything |
|---|---|
| `merge-pdf` | `#/merge` |
| `split-pdf` | `#/tools/split-pdf` |
| `ocr-pdf` | `#/tools/ocr-pdf` |
| `compress-pdf` | `#/tools/compress-pdf` |
| `pdf-metadata` | `#/tools/metadata` |

## Deterministic route contracts

`src/__tests__/phase7-pdf-contracts.test.ts`:

- hard-gates all 18 PDF routes;
- hard-gates the exact five Phase 7 targets;
- verifies their PDF task IDs and hashes;
- verifies production GitHub Pages URLs.

## Production PDF fixtures

`scripts/phase7-pdf-certification.mjs` generates valid PDFs locally at test time:

- two one-page merge inputs;
- one three-page PDF with metadata;
- one one-page high-contrast OCR fixture.

The script uses Chrome DevTools to upload these local files into the actual deployed PDF application.

No user file or repository fixture is uploaded anywhere.

## Merge certification

- opens `#/merge`;
- uploads two one-page PDFs;
- requires the PDF app to inspect both sources;
- requires **2 total pages**;
- runs **Download merged PDF**;
- requires the app's own output validation status;
- requires a non-empty `application/pdf` Blob named `merged.pdf`.

## Split certification

- opens `#/tools/split-pdf`;
- uploads a three-page PDF;
- waits for the focused Split PDF workspace;
- sets **Pages per PDF = 1**;
- runs **Split and download ZIP**;
- requires a non-empty ZIP output.

## Compression certification

- opens `#/tools/compress-pdf`;
- uploads the three-page PDF;
- uses the default structure-preserving/lossless profile;
- runs **Compress PDF**;
- requires **Compressed PDF checked and ready**;
- downloads a non-empty validated PDF.

## Metadata certification

- opens `#/tools/metadata`;
- uploads the three-page PDF;
- changes Title to `Phase 7 Metadata`;
- changes Author to `Tiny Tools`;
- creates an updated PDF project;
- requires navigation into the derived viewer project;
- opens the Info tab;
- requires the saved title to be visible in the reopened document.

## OCR certification

OCR is not mocked.

Phase 7:

- opens `#/tools/ocr-pdf`;
- uploads a one-page PDF containing large high-contrast text;
- selects page 1;
- selects the Fast 1.5× recognition profile;
- installs English trained data using PDF Everything's normal local language-pack workflow when not already installed;
- selects English;
- runs the real browser-side Tesseract OCR worker;
- requires **Searchable PDF checked and ready**;
- downloads a non-empty searchable PDF.

The OCR test has an extended timeout because first-run English traineddata installation and WebAssembly initialization are legitimate expensive operations.

## Download evidence

The browser harness instruments object-URL creation and download-anchor clicks.

For each download it records:

- filename;
- Blob size;
- MIME type.

The application continues running its own internal validation before the download is accepted.

## Global health integration

The complete 351-tool health scan now executes Phase 7.

A PDF route loses `TEST_FIXTURE_MISSING` only when its dedicated Phase 7 production workflow passes.

A failed PDF workflow becomes a real health failure.

Phase 7 execution is also required by the health-report completeness gate.

## Expected cumulative impact

Authoritative Phase 4 baseline:

- 322 PASS
- 29 BLOCKED
- 0 BROKEN
- 0 FLAKY

If Phases 5, 6 and 7 all pass:

- **346 PASS**
- **5 BLOCKED**
- 0 BROKEN
- 0 FLAKY

The expected remaining gaps would be:

- Image: 2
- Design: 1
- Developer: 1
- Text: 1

## Commands

```bash
npm run test:phase7
npm run browser:pdf
npm run browser:health
```

## Acceptance gate

Phase 7 completes when:

- all 18 PDF routes remain present and uniquely mapped;
- all five production PDF workflows pass;
- merge output is internally validated;
- split produces a ZIP;
- compression produces a validated PDF;
- metadata survives into the derived project;
- OCR produces a validated searchable PDF;
- full Tiny Tools unit/type/build gates pass;
- the global health report consumes Phase 7 evidence;
- no earlier family or 351-route regression is introduced.
