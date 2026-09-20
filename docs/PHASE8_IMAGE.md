# Phase 8 — Image Functional Certification

Phase 8 begins from the latest authoritative 351-tool health artifact:

- 351 total
- 340 PASS
- 6 BROKEN
- 5 BLOCKED
- 0 FLAKY

The six BROKEN routes are not new product regressions:

- Reverse Audio: one rendered-label assertion mismatch in Phase 6
- five PDF routes: Phase 7 harness did not click `Choose PDF` before assigning the selected task's hidden file input

Phase 8 repairs those prerequisites first instead of stacking new certification on known red gates.

## Phase 6 prerequisite repair

Reverse Audio's result card renders the correct summary, but the fixture required exact title case for `Samples reversed`.

The Phase 8 prerequisite repair:

- makes the assertion case-insensitive;
- accepts locale-safe `4,800` / equivalent spacing;
- leaves the actual 4,800-sample requirement intact.

## Phase 7 prerequisite repair

The PDF Everything `#/tools/<task>` routes use a selected-task launcher:

1. the user clicks `Choose PDF`;
2. PDF Everything stores the selected task;
3. the hidden PDF input opens;
4. the uploaded file is imported into that task's workspace.

The original Phase 7 harness skipped step 1. As a result, the file input received a file but the selected task remained null, so Split/OCR/Compress/Metadata never navigated into their workspaces.

The repair now performs the real launcher flow.

Phase 7 download verification is also strengthened:

- Chromium is allowed to perform real downloads;
- CDP download events capture the suggested filename;
- the downloaded file must exist on disk and be non-trivial;
- PDF outputs must begin with `%PDF-`;
- split output must have a ZIP `PK` signature.

This is stronger than the earlier patched-anchor-only evidence.

## Phase 8 target — Image family

The complete Image family contains **32 routes**.

The two remaining fixture-blocked routes are:

- `image-optimizer`
- `background-remover`

All other 30 Image routes already passed the strengthened health contract.

## Deterministic contracts

`src/__tests__/phase8-image-contracts.test.ts` hard-gates all 32 Image routes and verifies:

### Image Optimizer

- aspect-ratio reduction
- locked resize geometry
- 50% scaling
- prevent-upscale behavior
- progressive downscale planning
- browser working-memory estimates
- output filename/extension mapping

### Background Remover

A deterministic 8×8 synthetic image is modeled as:

- white connected background
- 4×4 red foreground subject

Contracts verify:

- corner background color estimation
- bounded tolerance calculation
- exactly 48 connected background pixels
- center subject remains outside the background mask
- 75% transparent / 25% opaque segmentation before feathering
- erase brush reduces alpha
- restore brush restores original alpha

## Production-browser Image certification

`scripts/phase8-image-certification.mjs` generates a real 8×8 PNG fixture at runtime with:

- standards-valid PNG signature/chunks
- zlib-compressed RGBA scanlines
- white border/background
- red 4×4 center subject

The exact file is injected through the production app's real file inputs.

### Image Optimizer workflow

The browser test requires:

1. load the 8×8 PNG;
2. render initial optimized preview;
3. click the `50%` preset;
4. produce an actual 4×4 result;
5. change output format to PNG;
6. require the optimized preview image itself to decode as 4×4;
7. download `phase8-source-optimized.png`;
8. require a non-empty `image/png` Blob.

### Background Remover workflow

The browser test:

1. loads the same PNG;
2. forces the optional neural-model network fetch path offline so the product's documented connected-background fallback executes deterministically;
3. clicks `Remove background`;
4. requires `Ready for edge refinement`;
5. reads the actual output canvas;
6. requires low corner alpha and strongly opaque center alpha;
7. downloads the resulting transparent PNG;
8. requires a non-empty `image/png` Blob.

The fallback is product code, not a test reimplementation.

## Image download hardening

Two remaining custom image download paths are consolidated onto the shared Phase 2 Blob lifecycle:

- Image Optimizer
- Background Remover

This removes another immediate/detached object-URL download pattern and ensures delayed URL revocation.

## Global health integration

The 351-tool health scan now executes Phase 8.

An Image route loses `TEST_FIXTURE_MISSING` only after its dedicated Phase 8 fixture passes.

A failed Image fixture becomes a real health failure.

Phase 8 execution is required by the health-report completeness gate.

## Expected result

Current authoritative state:

- 340 PASS
- 6 BROKEN
- 5 BLOCKED

If the Phase 6 prerequisite, Phase 7 prerequisite, and Phase 8 Image certification all pass:

- **348 PASS**
- **0 BROKEN**
- **3 BLOCKED**
- **0 FLAKY**

The expected final three fixture gaps are:

- Text: `text-cleaner`
- Developer: `structured-data-viewer`
- Design: `font-viewer`

These three singletons can be finished together in the next family-completion wave rather than creating three tiny phases.

## Commands

```bash
npm run test:phase8
npm run browser:image
npm run browser:media
npm run browser:pdf
npm run browser:health
```

## Acceptance gate

Phase 8 completes when:

- all 32 image routes remain represented;
- Image Optimizer passes its 8×8 → 4×4 production-browser workflow;
- Background Remover passes deterministic connected-background removal and PNG export;
- Phase 6 Reverse Audio returns to PASS;
- all five Phase 7 PDF workflows return to PASS;
- full unit/type/build gates pass;
- the global health artifact reports zero BROKEN routes;
- no earlier family regression is introduced.
