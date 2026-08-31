# Tiny Tools

Tiny Tools is a privacy-first public utility suite with **202 task routes** for text, PDFs, device diagnostics, calculators, file conversion, images, audio/video, productivity, math, time, and everyday tasks.

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
P6 adds **29 public media routes**: 12 audio workflows and 17 video workflows.

Audio routes cover joining, browser-decodable audio → PCM WAV conversion, gain, speed, peak normalization, silence trimming, three-band EQ, reverse, basic filter/gate cleanup, stereo↔mono conversion, ringtone trimming, and coupled pitch/speed shifting. Audio export deliberately uses standard WAV because browsers do not expose a reliable universal MP3/AAC encoder. Speed/pitch routes clearly state that native playback-rate rendering changes pitch and duration together.

Video routes cover merging, compression, browser-supported format conversion, WAV extraction, adding/mixing audio, text and logo overlays, looping, PNG frame extraction, thumbnail extraction, webcam recording, SRT/WebVTT subtitle burning, video → GIF, speed changes, crop/resize, mute, and source-volume adjustment.

Transformed video uses a shared Canvas + Web Audio + MediaRecorder renderer. It is intentionally real-time, must remain in a visible tab, and exports only containers/codecs actually supported by the current browser. Mixed-aspect merge inputs are letterboxed rather than stretched. Mute Video omits the source audio track instead of merely reducing volume to zero. Additional audio is decoded through Web Audio and mixed locally. P6 does not claim GIF → MP4 conversion or automatic video stabilization because those would require a dedicated animated-GIF/transcoding or motion-analysis engine that Tiny Tools does not currently ship.

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

The historical R5 source still certifies the frozen 50-tool baseline first. The expansion-aware wrapper appends P1–P6 catalogs and browser-tests the full **202-route** runtime catalog at desktop and mobile widths (**404 route renders**) before the later R6–R9 gates.

## Privacy model

Tiny Tools has no application backend. User content is processed in browser memory or, for explicitly persistent tools such as the notepad and checklist, local browser storage. Image and media micro-tools operate on local Blob/Canvas/Web Audio/MediaStream data. Background removal uses the existing local model/fallback path rather than uploading images.

Currency conversion necessarily makes a small external request containing only the selected currency pair. It does not send the entered amount.

## Browser limitations

Capabilities vary by browser and operating system. Camera/microphone/screen/clipboard APIs require appropriate permissions; media decoders and MediaRecorder codecs differ; transformed video is a real-time browser export rather than FFmpeg-style arbitrary transcoding; video-to-audio works only when Web Audio can decode the source container/audio codec; HEIC/HEIF and AVIF decoding depends on browser/OS support; large canvases are memory-limited; local ML assets may need an initial static download; GZIP needs CompressionStream/DecompressionStream; and P4 XLSX conversion is value-oriented rather than a full spreadsheet-rendering engine.

## Project structure

```text
src/
├── calculators/      P3 calculator catalog
├── components/       Shared application UI
├── device/           P2 device task metadata
├── files/            P4 file-conversion metadata
├── image/            P5 public image task metadata
├── media/            P6 public audio/video task metadata
├── pdf/              P1 PDF metadata/gateway routing
├── registry/         Base 50-tool registry plus expansion registration
├── storage/          Local preferences/transfers
├── tools/            Lazy-loaded tools/shared family shells
├── utilities/        Pure/shared processing helpers
└── __tests__/        Regression tests
```

## Status

The original 50 tools remain the hardened S-tier foundation. **P1 + P2 + P3 + P4 + P5 + P6 expand the public catalog to 202 routes** while preserving the original release baseline, truthful browser boundaries, and shared-engine architecture.
