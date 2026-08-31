# Tiny Tools

Tiny Tools is a privacy-first public utility suite with **150 task routes** for text, PDFs, device diagnostics, calculators, file conversion, images, media, productivity, math, time, and everyday tasks.

The application is a static React + TypeScript + Vite site. User files and content are processed locally in the browser whenever technically possible rather than sent to an application backend.

> Some advanced tools download static runtime/model assets when first used, such as local Whisper transcription, OCR, background-removal assets, or the dedicated PDF runtime. Currency conversion is the only P3 calculator that intentionally fetches current external reference-rate data.

## Principles

- Fast, focused utilities with minimal friction.
- General-public usefulness and understandable task names first.
- Client-side processing whenever technically possible.
- No accounts, backend database, analytics, or advertising.
- Route-level lazy loading so heavy tools do not bloat the homepage.
- Shared engines behind task-specific routes instead of duplicating implementations.
- Static deployment compatible with GitHub Pages.

## Public completeness expansion

The original 50-tool suite remains the hardened S-tier baseline. Public-completeness phases add general-purpose task families without weakening those existing release gates.

### P1 — PDF Suite

P1 adds 20 public PDF task routes covering creation, merge, scan/images-to-PDF, edit, annotation, visual signatures, redaction, page organization, split, crop, watermark/page numbers, forms, password protection, sanitization, OCR, compression, metadata, export, comparison, and page operations. These routes share the dedicated **PDF Everything** local-first engine instead of duplicating a PDF stack.

### P2 — Device Diagnostics Suite

P2 adds 16 native browser diagnostic routes for microphone, webcam, speakers/headphones, keyboard, mouse, pixels/display patterns, refresh rate, screen/device information, touch, gamepad/stick drift, pointer-event rate, keyboard ghosting/NKRO, battery status, tone generation, and instrument tuning.

Device diagnostics are capability-aware and avoid overstating what the browser can measure. Pointer rate is browser-delivered event cadence rather than raw USB polling; Battery Status does not invent health/cycle values; controller axes are browser-normalized observations rather than calibration certification.

### P3 — Everyday Calculator Suite

P3 adds 46 config-driven calculator routes for school/math, money, household/travel/construction, and low-risk fitness estimates. The calculator family uses one shared typed UI and pure formula engine. Scientific expressions use a dedicated parser rather than `eval`. Forty-five routes are fully local; currency conversion is the sole network-dependent calculator and discloses that boundary.

P3 intentionally excludes higher-stakes reproductive estimators and country-specific income-tax calculators from the timeless formula catalog.

### P4 — File & Format Conversion Suite

P4 adds 18 public routes for:

- CSV ↔ JSON
- CSV ↔ XML
- XML → JSON and JSON → XML
- CSV → XLSX and XLSX → CSV
- JSON → XLSX and XLSX → JSON
- CSV splitting and merging
- local file-type/signature inspection
- TAR creation and extraction
- GZIP compression and decompression when the browser exposes CompressionStream APIs
- ZIP ↔ TAR conversion using the existing hardened ZIP preflight

The P4 implementation reuses the established table parser and JSZip dependency instead of shipping another spreadsheet/archive stack. XLSX handling intentionally focuses on cell values from the first worksheet. It does not claim to preserve formulas, macros, charts, styles, merged-cell layout, or other workbook features. P4 also does not claim 7Z or high-fidelity office-document conversion without a suitable local codec/conversion engine.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Vitest
- Browser APIs including Canvas, Web Audio, Web Crypto, MediaRecorder, MediaStreams, Pointer Events, Gamepad, Fullscreen, Screen, CompressionStream/DecompressionStream, and Battery Status when available
- Local browser ML/OCR runtimes for tools that require them
- A shared dedicated local-first PDF workspace for PDF routes
- Config-driven pure TypeScript calculator formulas
- Existing shared table parser and ZIP safety layer for file conversion

## Local development

Prerequisite: Node.js 22+.

```bash
npm ci
npm run dev
```

The development server runs on port 3000 by default.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

The production build is emitted to `dist/`.

The original R5–R10 hardening/release gates remain in place. The historical R5 source still certifies the frozen 50-tool baseline first. The expansion-aware wrapper then appends the P1, P2, P3, and P4 catalogs and browser-tests the full runtime catalog at desktop and mobile widths.

## GitHub Pages

The repository includes a GitHub Actions workflow that validates the project and deploys `dist/` to GitHub Pages after successful pushes to `main`.

Tiny Tools uses hash-based client routing and relative build assets, so repository-subpath hosting remains supported.

PDF routes link to the sibling `/pdf/` application on deployed hosts. The currency converter uses `api.frankfurter.dev` only when the user requests a current exchange rate.

## Privacy model

Tiny Tools has no application backend. User content is processed in browser memory or, for explicitly persistent tools such as the notepad and checklist, local browser storage.

Examples of local processing include text transformations/calculations, image/canvas operations, ZIP/TAR/GZIP work, CSV/JSON/XML/XLSX conversion, duplicate hashing, audio/video capture/editing, OCR/Whisper, PDF work in the local-first sibling workspace, device diagnostic streams/events, and all non-currency calculator inputs.

Currency conversion necessarily makes a small external request containing only the selected currency pair. It does not send the entered amount.

## Browser limitations

Capabilities vary by browser and operating system. Camera/microphone/screen/clipboard APIs require appropriate permissions; codecs and hardware APIs differ; browsers can coalesce input events or throttle animation; PDF tasks have document/runtime-specific limits; live currency conversion requires network access; GZIP conversion requires CompressionStream/DecompressionStream support; and P4 XLSX conversion is a value-oriented interchange workflow rather than a full Excel rendering engine.

## Project structure

```text
src/
├── calculators/      P3 public calculator catalog and typed definitions
├── components/       Shared application UI
├── device/           Public device-diagnostic task metadata
├── files/            P4 public file-conversion task metadata
├── pdf/              Public PDF task metadata and gateway routing
├── registry/         Base 50-tool registry plus expansion-family registration
├── storage/          Local preferences and in-memory transfer helpers
├── tools/            Lazy-loaded tool UIs and shared family gateways
├── utilities/        Pure calculation/transformation helpers
└── __tests__/        Regression and utility tests
```

## Adding a tool or public task family

1. Prefer a proven shared engine when multiple public intents use the same capability family.
2. Create a focused UI or shared family shell.
3. Put reusable logic in pure modules where possible.
4. Register stable IDs, routes, categories, keywords, and lazy components.
5. Add correctness, discovery, capability-claim, and regression tests.
6. Run type checking, tests, build, browser gates, deployment, and live acceptance before merging.

## Status

The original 50 tools remain the hardened S-tier foundation. **P1 + P2 + P3 + P4 expand the public catalog to 150 routes** while preserving the original release baseline and shared-engine architecture.
