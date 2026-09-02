# Tiny Tools

Tiny Tools is a privacy-first public utility suite with **320 task routes** for text, study, privacy/security, developer tasks, PDFs, device diagnostics, calculators, unified file conversion, images, audio/video, subtitles, everyday documents, planning, productivity, math, statistics, data visualization, design, web, time, and daily work.

The application is a static React + TypeScript + Vite site. User files and content are processed locally in the browser whenever technically possible rather than sent to an application backend.

> Some advanced tools download static runtime/model assets when first used, such as local Whisper transcription, OCR, background-removal assets, or the dedicated PDF runtime. Currency conversion is the only calculator family route that intentionally fetches current external reference-rate data.

## Principles

- Fast, focused utilities with minimal friction.
- General-public usefulness and understandable task names first.
- Client-side processing whenever technically possible.
- No accounts, backend database, analytics, or advertising.
- Route-level lazy loading so heavy tools do not bloat the homepage.
- Shared engines behind task-specific routes instead of duplicated implementations.
- Static deployment compatible with GitHub Pages.

## Unified converters

Tiny Tools deliberately avoids publishing a separate route for every format pair. Related formats live in one upload-first converter: choose or drop a file, confirm the detected source format, select **Convert to**, and download the result.

### Document & eBook Converter

Inputs: **TXT, Markdown, HTML, DOCX, EPUB, PPTX, PDF**.

Outputs: **TXT, Markdown, HTML, DOCX, EPUB, PDF**.

DOCX, EPUB, and PPTX conversions are content-oriented rather than layout-perfect. PDF import performs best-effort local text extraction; scanned or complex PDFs should use the dedicated PDF OCR/export tools. PDF output is generated locally for portable reading and does not claim editable text-layer fidelity.

### Data & Spreadsheet Converter

Converts between compatible **CSV, JSON, XML, XLSX, YAML, and TOML** inputs and outputs. Structured conversions normalize through JSON; XLSX handling is value-oriented and uses the first worksheet rather than claiming full Excel rendering fidelity.

CSV splitting and merging remain separate utilities because they are file operations rather than format conversions.

### Image Converter

Accepts browser-decodable image inputs including common **JPG, PNG, WebP, GIF/BMP raster content, SVG, AVIF, and HEIC/HEIF when supported by the browser/OS**. Outputs are **JPG, PNG, WebP, and AVIF when the browser encoder supports the requested type**. Multiple images can be converted in one batch and downloaded as a ZIP.

Image editing, target-size compression, metadata cleaning, resizing, background tools, favicon creation, and other image operations remain dedicated routes.

### Audio Converter

Accepts browser-decodable audio such as **MP3, WAV, M4A/AAC, OGG/Opus, FLAC, WebM**, and other formats supported by the current browser. **WAV output is always available**. Compressed outputs such as MP3, AAC/M4A, OGG/Opus, or WebM/Opus appear only when `MediaRecorder.isTypeSupported()` confirms that the current browser exposes that local encoder. Compressed conversion may therefore run approximately in real time.

### Video Converter

The existing Video Converter remains the single general video format converter. It uses the browser's available MediaRecorder container/codec combinations and therefore does not claim universal FFmpeg-style MP4/MOV/WebM transcoding. Video GIF Maker remains separate because animated-GIF creation is a specialized rendering workflow rather than another browser video container.

### Subtitle Converter

Converts **SRT, WebVTT, and plain transcript text** in one workspace. SRT/WebVTT conversion preserves cue timing and text; plain-text export removes timestamps; text-to-subtitle output creates deterministic evenly timed cues and does not pretend to perform forced alignment from audio.

Subtitle editing, shifting, drift correction, frame-rate timing conversion, validation, merging, splitting, and reading-speed analysis remain separate operations.

### Archive Converter

ZIP ↔ TAR remains one archive converter. TAR creation/extraction and GZIP compression/decompression remain separate archive operations.

### Legacy route compatibility

Former pairwise routes such as `csv-to-json`, `xlsx-to-csv`, `docx-to-markdown`, `markdown-to-epub`, `heic-image-converter`, `audio-to-wav-converter`, `srt-to-vtt`, `create-pdf`, and `export-pdf` are no longer duplicated in the dashboard. Their old hashes are normalized to the appropriate canonical converter so existing Tiny Tools bookmarks continue to resolve.

## Public-completeness phases

The original 50-tool suite remains the hardened S-tier baseline. P1–P16 expanded it across PDFs, diagnostics, calculators, files, images, media, text/study, privacy/developer utilities, everyday documents, Office/eBook interchange, web authoring, security, statistics/visualization, and subtitle workflows.

After P16 the catalog reached 352 routes. The converter-consolidation pass then reduced unnecessary route duplication to **320 public routes** while increasing the number of useful conversion combinations available inside the canonical converters.

Current expansion-family counts after consolidation include:

- P1 dedicated PDF operations: **18** routes; create/export conversion entry points moved into Document Converter.
- P2 device diagnostics: **16** routes.
- P3 calculators: **46** routes.
- P4 file/data/archive: **9** routes; pairwise CSV/JSON/XML/XLSX entries collapsed into Data Converter.
- P5 image expansion: **19** routes; format-specific image converters collapsed into Image Converter.
- P6 audio/video: **29** routes; Audio Converter replaces the WAV-only converter while Video Converter remains canonical.
- P7 text/study: **22** routes.
- P8 privacy/developer: **16** routes.
- P9 everyday documents/planning: **13** routes.
- P11 remaining gaps: **26** routes after YAML/TOML and Markdown format-pair routes moved into canonical converters.
- P12 web/developer authoring: **18** routes.
- P13 Office/eBook: **3** routes: Document Converter, DOCX metadata inspection, and EPUB metadata editing.
- P14 developer/security: **13** routes.
- P15 math/data visualization: **13** routes.
- P16 subtitle/media: **9** routes after SRT/VTT/text pairwise conversion routes collapsed into Subtitle Converter.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Vitest
- JSZip for local ZIP/package workflows including archives, Office Open XML, EPUB, and batch exports
- Web Crypto for hashing, HMAC, AES-GCM, JWT signature verification, SRI hashes, and certificate fingerprints
- Canvas, Web Audio/OfflineAudioContext, MediaRecorder/MediaStreams, Pointer Events, Gamepad, Fullscreen, Screen, CompressionStream/DecompressionStream, and Battery Status when available
- Dependency-free SVG graphing and numerical statistics
- Dependency-free SRT/WebVTT parsing and timing workflows
- Local browser ML/OCR/background-removal runtimes for tools that require them
- A shared dedicated local-first PDF workspace
- Central idempotent public-catalog registration and full-catalog integrity tests

No new runtime dependency or application backend is required by the unified converters.

## Local development

Prerequisite: Node.js 22+.

```bash
npm ci
npm run dev
```

## Validation

```bash
npm run typecheck
npm test
npm run build
```

The historical R5 source certifies the frozen 50-tool baseline first. The expansion-aware wrapper appends the currently published expansion catalogs and browser-tests the full **320-route** runtime catalog at desktop and mobile widths (**640 route renders**) before functional, capability, and compatibility gates.

## Privacy model

Tiny Tools has no application backend. User content is processed in browser memory or, for explicitly persistent tools such as the notepad and checklist, local browser storage. Image/media tools operate on local Blob/Canvas/Web Audio/MediaStream data. Office/eBook interchange opens and creates ZIP/XML packages locally through JSZip. Converter files are inspected, decoded, transformed, and exported in browser memory; browser-dependent codecs are exposed only when the runtime reports the necessary capability.

Currency conversion necessarily makes a small external request containing only the selected currency pair. It does not send the entered amount.

## Browser limitations

Capabilities vary by browser and operating system. Camera/microphone/screen/clipboard APIs require permissions; media decoders and MediaRecorder codecs differ; transformed video and some compressed audio conversions are real-time browser exports; HEIC/HEIF and AVIF decoding/encoding depends on browser/OS support; large canvases and large ZIP/data/document inputs are memory-limited; local ML assets may need an initial static download; GZIP needs CompressionStream/DecompressionStream; and spreadsheet/document conversion is deliberately content/value-oriented rather than a claim of full Microsoft Office rendering fidelity.

## Project structure

```text
src/
├── calculators/      Calculator catalog
├── components/       Shared application UI
├── device/           Device diagnostics metadata
├── everyday/         Document/planning metadata
├── expansion/        P11–P16 expansion metadata
├── files/            Data/archive/file metadata
├── image/            Image metadata
├── media/            Audio/video metadata
├── pdf/              PDF metadata/gateway routing
├── privacy-dev/      Privacy/developer metadata
├── text-study/       Text/study metadata
├── registry/         Registry, aliases, adapters, central registration
├── storage/          Local preferences/transfers
├── tools/converters/ Unified upload-first converter workspaces
├── tools/            Other lazy-loaded tool families
├── utilities/        Pure/shared processing helpers
└── __tests__/        Regression and full-catalog integrity tests
```

## Status

**320 public routes** are published from the original baseline through P16 plus the converter-consolidation pass, preserving the fixed startup bundle budget, local-first architecture, legacy converter URL compatibility, and exhaustive desktop/mobile route acceptance.
