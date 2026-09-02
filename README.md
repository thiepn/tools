# Tiny Tools

Tiny Tools is a privacy-first public utility suite with **320 task routes** for text, study, privacy/security, developer tasks, PDFs, device diagnostics, calculators, unified file conversion, images, audio/video, subtitles, everyday documents, planning, productivity, math, statistics, data visualization, design, web, time, and daily work.

The application is a static React + TypeScript + Vite site. User files and content are processed locally in the browser whenever technically possible rather than sent to an application backend.

> Some advanced tools download static runtime/model assets when first used, such as local Whisper transcription, OCR, background-removal assets, the dedicated PDF runtime, or optional format runtimes for legacy XLS, RAR/7Z reading, MP3 encoding, and HEIC/TIFF fallback decoding. These runtimes execute against the file locally after loading; Tiny Tools does not upload the user's file to a conversion service. Currency conversion is the only calculator family route that intentionally fetches current external reference-rate data.

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

Inputs and outputs: **TXT, Markdown, HTML, RTF, DOCX, ODT, EPUB, PPTX, ODP, PDF**.

DOCX, ODT, EPUB, PPTX, and ODP conversions are content-oriented rather than layout-perfect. PDF import performs best-effort local text extraction; scanned or complex PDFs should use the dedicated PDF OCR/export tools. PDF output is generated locally for portable reading and does not claim editable text-layer fidelity. Legacy binary DOC/PPT are intentionally not presented as supported modern interchange formats.

### Data & Spreadsheet Converter

Converts between compatible **CSV, TSV, JSON, XML, XLS, XLSX, ODS, YAML, TOML, and HTML tables**. Structured conversions normalize through JSON. XLS support loads a pinned SheetJS runtime only when legacy `.xls` is used. Spreadsheet conversions are value-oriented and use the first worksheet rather than claiming formula/chart/macro/layout preservation.

CSV splitting and merging remain separate utilities because they are file operations rather than format conversions.

### Image Converter

Accepts mainstream **JPG/JPEG/JFIF, PNG/APNG, WebP, GIF, BMP, SVG, AVIF, HEIC/HEIF, ICO, and TIFF** sources. Outputs are **JPG, PNG, WebP, AVIF, static GIF, BMP, ICO, TIFF, and PDF**. Multiple images can be converted in one batch; ordinary image outputs download as ZIP while PDF creates a multi-page document.

HEIC/HEIF and TIFF first use native browser decoding and fall back to small pinned local decoder runtimes when needed. Animated source formats are treated as decoded still frames; Tiny Tools does not falsely claim animation-preserving APNG/GIF/WebP transcoding in this lightweight converter.

Image editing, target-size compression, metadata cleaning, resizing, background tools, favicon creation, and other image operations remain dedicated routes.

### Audio Converter

Accepts common browser-decodable audio such as **MP3, WAV, AIFF/AIF, M4A/AAC, OGG/Opus, FLAC, WebM, and WMA**. **WAV, AIFF, and MP3 output are always offered**. MP3 uses a pinned LAME encoder loaded only when MP3 output is selected. Additional AAC/M4A, OGG/Opus, WebM/Opus, FLAC, or WMA outputs appear only when the browser exposes the required local MediaRecorder encoder.

### Video Converter

The Video Converter recognizes mainstream video containers such as **MP4, MOV/M4V, WebM, MKV, AVI, MPEG/MPG, 3GP, WMV, and FLV** when the browser can decode the contained codecs. Output remains limited to MediaRecorder containers/codecs supported by the current browser, so Tiny Tools does not claim universal FFmpeg-style transcoding. Video GIF Maker remains separate because animated-GIF creation is a specialized rendering workflow.

### Subtitle Converter

Converts **SRT, WebVTT, ASS, SSA, SBV, TTML/DFXP, and plain transcript text** in one workspace. Timing and cue text are preserved where the formats allow it. Plain-text export removes timestamps; text-to-subtitle output creates deterministic evenly timed cues and does not pretend to perform forced alignment from audio. Advanced ASS styles, WebVTT regions/CSS, and broadcast-caption metadata are outside this lightweight interchange layer.

Subtitle editing, shifting, drift correction, frame-rate timing conversion, validation, merging, splitting, and reading-speed analysis remain separate operations.

### Archive Converter

Converts **ZIP ↔ TAR ↔ TGZ/TAR.GZ** directly. It also accepts mainstream **RAR and 7Z inputs** and converts their regular files to ZIP, TAR, or TGZ through a pinned libarchive WebAssembly reader loaded only when needed. RAR/7Z creation and password-protected archive conversion are not claimed.

TAR creation/extraction and standalone GZIP compression/decompression remain separate archive operations.

### Legacy route compatibility

Former pairwise routes such as `csv-to-json`, `xlsx-to-csv`, `docx-to-markdown`, `markdown-to-epub`, `heic-image-converter`, `audio-to-wav-converter`, `srt-to-vtt`, `create-pdf`, and `export-pdf` are no longer duplicated in the dashboard. Their old hashes are normalized to the appropriate canonical converter so existing Tiny Tools bookmarks continue to resolve.

## Public-completeness phases

The original 50-tool suite remains the hardened S-tier baseline. P1–P16 expanded it across PDFs, diagnostics, calculators, files, images, media, text/study, privacy/developer utilities, everyday documents, Office/eBook interchange, web authoring, security, statistics/visualization, and subtitle workflows.

After P16 the catalog reached 352 routes. The converter-consolidation pass then reduced unnecessary route duplication to **320 public routes** while increasing the number of useful conversion combinations available inside the canonical converters. The mainstream-format expansion increases coverage again without adding route sprawl.

Current expansion-family counts after consolidation remain:

- P1 dedicated PDF operations: **18** routes.
- P2 device diagnostics: **16** routes.
- P3 calculators: **46** routes.
- P4 file/data/archive: **9** routes.
- P5 image expansion: **19** routes.
- P6 audio/video: **29** routes.
- P7 text/study: **22** routes.
- P8 privacy/developer: **16** routes.
- P9 everyday documents/planning: **13** routes.
- P11 remaining gaps: **26** routes.
- P12 web/developer authoring: **18** routes.
- P13 Office/eBook: **3** routes.
- P14 developer/security: **13** routes.
- P15 math/data visualization: **13** routes.
- P16 subtitle/media: **9** routes.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Vitest
- JSZip for local ZIP/package workflows including archives, Office Open XML, EPUB, OpenDocument, and batch exports
- Web Crypto for hashing, HMAC, AES-GCM, JWT signature verification, SRI hashes, and certificate fingerprints
- Canvas, Web Audio/OfflineAudioContext, MediaRecorder/MediaStreams, Pointer Events, Gamepad, Fullscreen, Screen, CompressionStream/DecompressionStream, and Battery Status when available
- Dependency-free SVG graphing and numerical statistics
- Local subtitle parsing/generation for SRT, WebVTT, ASS/SSA, SBV, and TTML/DFXP
- Local browser ML/OCR/background-removal runtimes for tools that require them
- A shared dedicated local-first PDF workspace
- Optional version-pinned, on-demand browser runtimes for legacy XLS, RAR/7Z reading, MP3 encoding, and HEIC/TIFF fallback decoding
- Central idempotent public-catalog registration and full-catalog integrity tests

The optional converter runtimes are not part of the initial application bundle and are fetched only for the formats that require them.

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

Tiny Tools has no application backend. User content is processed in browser memory or, for explicitly persistent tools such as the notepad and checklist, local browser storage. Image/media tools operate on local Blob/Canvas/Web Audio/MediaStream data. Office/eBook/OpenDocument interchange opens and creates ZIP/XML packages locally through JSZip. Converter files are decoded, transformed, and exported in browser memory. When an optional codec/parser runtime is required, the executable runtime is downloaded but the user's file is not uploaded to that runtime host.

Currency conversion necessarily makes a small external request containing only the selected currency pair. It does not send the entered amount.

## Browser limitations

Capabilities vary by browser and operating system. Camera/microphone/screen/clipboard APIs require permissions; source media codecs still have to be decodable by the browser; transformed video and some compressed audio conversions are real-time browser exports; AVIF encoding and optional MediaRecorder formats vary by browser; large canvases and large archives/data/documents are memory-limited; local ML and optional conversion assets may need an initial static download; and spreadsheet/document conversion is deliberately content/value-oriented rather than a claim of full Microsoft Office or LibreOffice rendering fidelity.

The suite targets generally used modern formats rather than every historical or specialist format. Examples intentionally outside the universal claim include legacy binary DOC/PPT, RAR/7Z **creation**, password-protected archives, DRM eBooks, professional broadcast captions, and arbitrary FFmpeg-grade video codec/container combinations.

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

**320 public routes** are published from the original baseline through P16 plus converter consolidation. The mainstream-format expansion increases conversion breadth without reversing that consolidation, while preserving the fixed startup bundle budget, local-first architecture, legacy converter URL compatibility, and exhaustive desktop/mobile route acceptance.
