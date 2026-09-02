# Tiny Tools

Tiny Tools is a privacy-first public utility suite with **343 task routes** for text, study, privacy/security, developer tasks, PDFs, device diagnostics, network/browser diagnostics, calculators, unified file conversion, file viewing and inspection, image enhancement/restoration, audio/video, subtitles, everyday documents, planning, productivity, math, statistics, data visualization, design, web, time, and daily work.

The application is a static React + TypeScript + Vite site. User files and content are processed locally in the browser whenever technically possible rather than sent to an application backend.

> Some advanced tools download static runtime/model assets when first used, such as local Whisper transcription, OCR, background-removal assets, the dedicated PDF runtime, or optional format runtimes for legacy XLS, RAR/7Z reading, MP3 encoding, and HEIC/TIFF fallback decoding. These runtimes execute against the file locally after loading; Tiny Tools does not upload the user's file to a conversion service. Currency conversion intentionally fetches current external reference-rate data. P19 Internet/network diagnostics intentionally contact clearly disclosed external test endpoints only after the user starts a probe; browser capability, graphics, codec, and storage inspectors remain local-only.

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

## P17 — File Viewers & Inspection

P17 adds eight local, upload-first viewers that complement conversion rather than duplicate it:

- **Document Viewer** — DOCX, ODT, RTF, TXT, Markdown, and HTML with searchable extracted text, headings, and available metadata.
- **Spreadsheet Viewer** — CSV, TSV, JSON/XML tables, XLS, XLSX, and ODS with worksheet navigation where available, search, sortable columns, and value-oriented inspection.
- **Presentation Viewer** — PPTX and ODP with slide navigation and searchable slide text.
- **EPUB Reader** — EPUB spine/chapter navigation, book metadata, search, and a local reading view.
- **Structured Data Viewer** — JSON, XML, YAML, and TOML as expandable trees plus raw source and node/depth statistics.
- **Archive Browser** — ZIP, TAR, TGZ/TAR.GZ, RAR, and 7Z inventory browsing with filtering, sizes, and safe-path handling.
- **SVG Viewer & Inspector** — sanitized local preview, dimensions/viewBox, element inventory, warnings, and source inspection.
- **Font Viewer & Character Map** — TTF, OTF, WOFF, and WOFF2 preview using the browser FontFace API, format/signature inspection, sample text, and a U+0020–U+00FF character map.

These viewers deliberately avoid false fidelity claims. Office/OpenDocument previews are content-oriented; spreadsheet viewers do not reproduce macros/charts/pivot/layout state; presentation viewers do not reproduce animations or master-layout fidelity; EPUB scripts and DRM are not executed; and SVG active content is stripped from the preview. RAR/7Z browsing uses the same pinned local libarchive runtime as archive conversion.

## P18 — Image Enhancement & Restoration

P18 adds six local restoration workflows and upgrades the existing Image Upscaler without duplicating its route:

- **Image Enhancer** — edge-preserving denoise, auto levels, local contrast, saturation, and adjustable unsharp-mask refinement in one workspace.
- **Object & Blemish Remover** — paint an unwanted small object or blemish and fill the mask deterministically from neighboring pixels.
- **Old Photo Restorer** — suppress isolated dust/spot artifacts, denoise scans, recover faded tonal range, adjust warmth, and apply controlled sharpening.
- **Perspective Corrector** — four-corner projective correction for photographed pages, signs, artwork, screens, and other rectangular planes.
- **Auto Deskew Image** — estimate common ±12° rotational skew from strong horizontal edge structure and apply a correction with optional manual trim.
- **Red-Eye Remover** — click/select an eye region and suppress only strongly red-dominant pixels inside the correction circle.

The existing **Image Upscaler** now uses staged high-quality browser resampling followed by restrained local edge refinement instead of a single resize pass. It remains deliberately non-generative: Tiny Tools does not describe classical resampling as AI super-resolution or claim reconstruction of detail that was never captured.

P18 restoration tools are also deliberately bounded. Neighborhood inpainting is intended for small objects and simple backgrounds rather than large generative removals; old-photo restoration does not invent missing faces, colorize monochrome photos, or reconstruct torn regions; perspective correction relies on user-specified corners; and auto-deskew reports confidence because images without text/horizons may not contain enough directional structure.

## P19 — Network & Browser Diagnostics

P19 adds nine diagnostic routes. Four make explicit, user-triggered external network probes; five inspect only browser-local capabilities.

- **Internet Speed Test** — measures download/upload payload throughput plus HTTPS latency and jitter against Cloudflare public speed-test endpoints. Test bytes are generated in memory; no user file is uploaded.
- **Connection Stability Test** — repeats small HTTPS probes and summarizes average/min/max latency, jitter, standard deviation, slow spikes, and request failures. It deliberately does not label HTTP-request failures as ICMP packet loss.
- **IPv4 / IPv6 Connectivity Test** — probes IPv4-only and IPv6-only Cloudflare hosts and reports IPv4-only, IPv6-only, dual-stack, or unavailable reachability. Optional Cloudflare metadata can show the public address/edge information returned by that service.
- **WebRTC Leak Test** — gathers ICE candidates locally and can optionally use `stun:stun.cloudflare.com:3478` to inspect server-reflexive candidates. Literal private/public IPs and privacy-preserving `.local` mDNS candidates are identified separately.
- **Browser Capability Inspector** — checks modern browser/runtime APIs including workers, WebAssembly, WebRTC, WebGPU, WebCodecs, storage, compression, clipboard, and File System Access features without a remote probe.
- **WebGL Inspector** — reports WebGL/WebGL2 context type, renderer/vendor strings when exposed, limits, antialiasing, and extensions locally.
- **WebGPU Inspector** — requests a local GPU adapter and reports exposed adapter information, features, and selected limits without sending graphics data elsewhere.
- **Media Codec Support Tester** — queries browser-declared decoding and MediaRecorder encoding support for mainstream MP4/H.264, HEVC, AV1, VP8/VP9, Opus, AAC, MP3, FLAC, Ogg, WebM, and WAV MIME combinations.
- **Browser Storage & Quota Inspector** — reports `navigator.storage` usage/quota, persistence status, IndexedDB, Cache Storage, localStorage, and OPFS capability, with an explicit user action for requesting persistent storage.

External diagnostic routes do not auto-run when opened. Their interfaces disclose that Cloudflare receives the connection information required to serve the probe. The local five routes do not make diagnostic network requests. Speed results are browser-to-test-endpoint estimates and are not advertised as ISP-certified measurements; codec results are browser-declared MIME capability rather than proof that every profile/resolution/DRM stream will work.

## Public-completeness phases

The original 50-tool suite remains the hardened S-tier baseline. P1–P19 expanded it across PDFs, diagnostics, calculators, files, images, media, text/study, privacy/developer utilities, everyday documents, Office/eBook interchange, web authoring, security, statistics/visualization, subtitle workflows, file viewing/inspection, image restoration, and network/browser diagnostics.

After P16 the catalog reached 352 routes. The converter-consolidation pass then reduced unnecessary route duplication to **320 public routes** while increasing the number of useful conversion combinations available inside the canonical converters. The mainstream-format expansion increased conversion breadth without route sprawl. P17 added eight distinct viewer/inspection workflows for **328 routes**. P18 added six restoration workflows while upgrading the existing upscaler in place for **334 routes**. P19 adds nine network/browser diagnostics, bringing the current catalog to **343 public routes**.

Current expansion-family counts:

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
- P17 file viewers/inspection: **8** routes.
- P18 image enhancement/restoration: **6** routes.
- P19 network/browser diagnostics: **9** routes.
