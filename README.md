# Tiny Tools

Tiny Tools is a privacy-first public utility suite with **300 task routes** for text, study, privacy/security, developer tasks, PDFs, device diagnostics, calculators, file conversion, images, audio/video, everyday documents, planning, productivity, math, design, web, time, and daily work.

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

## Public completeness expansion

The original 50-tool suite remains the hardened S-tier baseline. Public-completeness phases add general-purpose task families without weakening those existing release gates.

### P1 — PDF Suite
20 public PDF task routes use the dedicated local-first PDF Everything engine.

### P2 — Device Diagnostics Suite
16 native browser diagnostics cover camera, microphone, audio output, displays, input devices, controllers, battery status, tone generation, and tuning with truthful browser capability boundaries.

### P3 — Everyday Calculator Suite
46 config-driven calculators cover school/math, money, household/travel/construction, and low-risk fitness estimates. Forty-five are fully local; live currency conversion explicitly discloses its reference-rate network request.

### P4 — File & Format Conversion Suite
18 routes cover CSV/JSON/XML/XLSX interchange, CSV split/merge, signature-based file inspection, TAR/GZIP, and ZIP↔TAR. XLSX is deliberately value-oriented rather than a claim of full Excel fidelity.

### P5 — Image Micro-Tools Suite
23 task-specific image routes reuse the existing image optimizer and local background-removal engines for crop/rotation, format conversion, target-size compression, EXIF cleaning, social sizing, privacy redaction, favicon packs, grids, filters, comparison, background workflows, contact sheets, guided portrait cropping, and high-quality non-AI resampling.

### P6 — Audio & Video Micro-Tools Suite
P6 adds **29 public media routes**: 12 audio workflows and 17 video workflows. Audio covers joining, WAV conversion, gain, speed, normalization, silence trimming, EQ, reverse, cleanup, channel conversion, ringtone trimming, and coupled pitch/speed shifting. Video covers merging, compression, browser-supported conversion, WAV extraction, audio mixing, overlays, looping, frame/thumbnail extraction, webcam recording, subtitle burning, GIF export, speed, crop/resize, mute, and volume adjustment.

Transformed video uses a shared Canvas + Web Audio + MediaRecorder renderer and exports only containers/codecs supported by the current browser. P6 does not claim arbitrary FFmpeg-style transcoding or automatic stabilization.

### P7 — Text & Study Expansion
P7 adds **22 public routes**: 14 text/Markdown workflows and 8 study/citation workflows. Text covers readability, n-grams, extraction, repeated phrases, similarity, Unicode inspection, repetition, reversal, hard wrapping, whitespace visualization, Lorem Ipsum, Markdown preview/plain text, and HTML → plain text. Study routes cover flashcards, cloze practice, memorization scoring, self-testing, spaced-review planning, study-session planning, reading plans, and basic citation formatting.

### P8 — Privacy & Developer Essentials
P8 adds **16 public routes**: 8 privacy/security workflows and 8 developer essentials. Privacy/security covers SHA hashing/checksums, checksum verification, HMAC, password-based AES-GCM text/file encryption, password-strength heuristics, and deterministic PII-pattern redaction. Developer routes cover UUID/ULID, JWT decoding, Unix timestamps, BigInt base conversion, UTF-8 ↔ hex, HTML entities, and cron validation/preview.

JWT decoding is not signature verification; password strength is not a breach lookup; PII detection is pattern-based; and encrypted data cannot be recovered without the password.

### P9 — Everyday Documents & Planning
P9 adds **13 public routes**: invoices, quotes, receipts, email signatures, labels, printable calendars, weekly schedules, resumes, countdowns, work-hours totals, ISO week lookup, elapsed time, and calendar age. Generated documents are generic helpers rather than jurisdiction-specific tax, legal, payroll, or employment systems.

### P10 — Public Completeness & Catalog Hardening
P10 is a closure/integrity phase rather than a route-count phase. It centralizes public registration, makes catalog counts runtime-derived, hardens search/accessibility, audits canonical IDs/routes and metadata, validates related-tool links, and keeps the original startup and browser-acceptance budgets intact.

### P11 — Remaining High-Value Gaps
P11 adds **29 public routes** without a backend or new runtime dependency. Developer/data routes cover YAML/TOML formatting and conversion, SQL formatting, bounded JSON Schema and JSONPath tools, Base32/Base58/Ascii85, file↔Base64, CIDR/subnets, user-agent parsing, UTM links, and Markdown↔HTML. Math/statistics adds matrices, combinatorics, normal probabilities, regression/correlation, GCD/LCM/factors, complex numbers, quadratics, and vectors. Design/web/everyday adds SVG cleanup, DPI/print sizing, color-vision approximation, robots.txt, sitemaps, vCard, TOTP, and CSS minification.

### P12 — Web & Developer Authoring
P12 adds **18 public routes**, bringing Tiny Tools to **300**.

Developer/interchange routes cover XML formatting with balanced-tag validation, URL decomposition, query-string parsing/building, Semantic Version precedence comparison, chmod octal↔symbolic permissions, JSON→TypeScript inference, HTTP header parsing, common MIME-type lookup, Unicode NFC/NFD/NFKC/NFKD normalization, `.env` formatting/parsing, and HTML minification.

Web/design authoring routes cover common HTML meta tags, Open Graph/Twitter card metadata, WCAG 2.x color-contrast ratios, CSS linear/radial gradients, CSS box shadows, responsive `clamp()` expressions, and escaped semantic HTML table generation from CSV/TSV/semicolon data.

P12 keeps claims narrow: XML validation checks balanced tag structure rather than XSD/DTD semantics; JSON→TypeScript describes the supplied sample rather than proving an API contract; MIME lookup is curated rather than exhaustive; `.env` parsing follows a documented common subset; metadata generators do not promise search ranking or social-preview behavior; and contrast checking uses WCAG 2.x luminance thresholds rather than newer perceptual models.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Vitest
- Canvas, Web Audio/OfflineAudioContext, Web Crypto, MediaRecorder/MediaStreams, Pointer Events, Gamepad, Fullscreen, Screen, CompressionStream/DecompressionStream, and Battery Status when available
- Local browser ML/OCR/background-removal runtimes for tools that require them
- A shared dedicated local-first PDF workspace
- Config-driven calculator formulas
- Shared table/ZIP safety layers and shared image/audio/video processing engines
- Dependency-free text/study, privacy/developer, everyday-document/planning, P11, and P12 processing engines
- Central idempotent public-catalog registration and full-catalog integrity tests

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

The historical R5 source still certifies the frozen 50-tool baseline first. The expansion-aware wrapper appends P1–P9, P11, and P12 catalogs and browser-tests the full **300-route** runtime catalog at desktop and mobile widths (**600 route renders**) before the later functional, capability, and compatibility gates.

## Privacy model

Tiny Tools has no application backend. User content is processed in browser memory or, for explicitly persistent tools such as the notepad and checklist, local browser storage. Image and media micro-tools operate on local Blob/Canvas/Web Audio/MediaStream data. Text/study, privacy/developer, document/planning, P11, and P12 workflows use local deterministic algorithms and browser APIs. Background removal uses the existing local model/fallback path rather than uploading images.

Currency conversion necessarily makes a small external request containing only the selected currency pair. It does not send the entered amount.

## Browser limitations

Capabilities vary by browser and operating system. Camera/microphone/screen/clipboard APIs require permissions; media decoders and MediaRecorder codecs differ; transformed video is a real-time browser export; video-to-audio depends on source codec support; HEIC/HEIF and AVIF decoding depends on browser/OS support; large canvases are memory-limited; local ML assets may need an initial static download; GZIP needs CompressionStream/DecompressionStream; and spreadsheet conversion is value-oriented rather than a full Excel rendering engine. Lightweight P7/P11/P12 parsers and generators deliberately document their supported subsets instead of claiming complete language, schema, crawler, SEO, or platform semantics.

## Project structure

```text
src/
├── calculators/      P3 calculator catalog
├── components/       Shared application UI
├── device/           P2 device task metadata
├── everyday/         P9 document/planning metadata
├── expansion/        P11 + P12 expansion metadata
├── files/            P4 file-conversion metadata
├── image/            P5 image metadata
├── media/            P6 audio/video metadata
├── pdf/              P1 PDF metadata/gateway routing
├── privacy-dev/      P8 privacy/developer metadata
├── text-study/       P7 text/study metadata
├── registry/         Base registry, phase adapters, and central registration
├── storage/          Local preferences/transfers
├── tools/            Lazy-loaded tools/shared family shells
├── utilities/        Pure/shared processing helpers
└── __tests__/        Regression and full-catalog integrity tests
```

## Status

The original 50 tools remain the hardened S-tier foundation. **P1 through P12 now produce and certify a 300-route public catalog** while preserving truthful browser boundaries, shared-engine architecture, the fixed startup bundle budget, and exhaustive desktop/mobile route acceptance.
