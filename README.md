# Tiny Tools

Tiny Tools is a privacy-first public utility suite with **86 task routes** for text, PDFs, device diagnostics, files, images, media, productivity, math, time, and everyday tasks.

The application is a static React + TypeScript + Vite site. User files and content are processed locally in the browser whenever technically possible rather than sent to an application backend.

> Some advanced tools download static runtime/model assets when first used, such as local Whisper transcription, OCR, background-removal assets, or the dedicated PDF runtime. Those downloads are separate from user-content processing.

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

P1 adds a first-class PDF category with 20 public task routes covering creation, merge, scan/images-to-PDF, edit, annotation, visual signatures, redaction, page organization, split, crop, watermark/page numbers, forms, password protection, sanitization, OCR, compression, metadata, export, comparison, and page operations.

Tiny Tools intentionally does not maintain a second PDF processing stack. These routes use one shared gateway into the dedicated **PDF Everything** browser application, which already implements the mature PDF engine and task-specific safety/capability checks.

### P2 — Device Diagnostics Suite

P2 adds 16 native browser diagnostic routes:

- microphone level test
- webcam preview and active camera settings
- speaker/headphone stereo test
- keyboard event tester
- mouse/button/wheel test
- dead/stuck pixel test
- fullscreen display patterns
- browser-visible refresh-rate measurement
- screen and browser-exposed device information
- touchscreen and multi-touch contact test
- gamepad/controller and observed stick-drift test
- browser pointer-event rate measurement
- keyboard ghosting/NKRO observation
- Battery Status API viewer
- local Web Audio tone generator
- microphone-based chromatic instrument tuner

Device diagnostics are intentionally capability-aware. Tiny Tools reports only what browser APIs expose: for example, the pointer-rate tool does not claim to measure raw USB HID polling, and the battery tool does not invent health, cycle count, wear, or temperature values that web browsers do not provide.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Vitest
- Browser APIs including Canvas, Web Audio, Web Crypto, MediaRecorder, MediaStreams, Pointer Events, Gamepad, Fullscreen, Screen, and Battery Status when available
- Local browser ML/OCR runtimes for tools that require them
- A shared dedicated local-first PDF workspace for PDF routes

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

The original R5–R10 hardening/release gates remain in place. The original R5 source still certifies the frozen 50-tool baseline first. The expansion-aware wrapper then appends the P1 and P2 public route catalogs and browser-tests the entire runtime catalog at desktop and mobile widths.

## GitHub Pages

The repository includes a GitHub Actions workflow that validates the project and deploys `dist/` to GitHub Pages after successful pushes to `main`.

The Vite build uses relative asset URLs and Tiny Tools uses hash-based client routing, so the application remains compatible with repository-subpath hosting such as:

```text
https://thiepn.github.io/tools/
```

PDF routes link to the sibling PDF application at `/pdf/` on deployed hosts. Local development uses the canonical production PDF application rather than trying to load a nonexistent local sibling route.

In GitHub repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## Privacy model

Tiny Tools has no application backend. User content is processed in browser memory or, for explicitly persistent tools such as the notepad and checklist, local browser storage.

Examples of local processing include:

- text transformations and calculations
- image/canvas operations
- ZIP creation/extraction
- SHA-256 duplicate-file detection
- audio/video capture and editing
- OCR and local Whisper speech transcription
- PDF work through the local-first PDF workspace
- microphone/camera/device diagnostic streams handled inside the active page
- display, keyboard, pointer, touchscreen, and gamepad measurements derived from local browser events

Some libraries and model weights may be fetched as static assets on first use. Tiny Tools does not intentionally transmit the user's files, microphone audio, camera stream, diagnostic event data, transcripts, notes, signatures, images, or PDF contents to a remote processing service.

## Browser limitations

Capabilities vary by browser and operating system. In particular:

- camera, microphone, screen capture, and clipboard APIs require a secure context and user permission;
- available audio/video codecs differ by browser;
- WebGPU acceleration is not available everywhere and local ML tools may fall back to WebAssembly;
- browser file APIs cannot universally modify or delete arbitrary files on disk;
- available text-to-speech voices depend on the browser and operating system;
- Gamepad and Battery Status APIs are not exposed identically by every browser;
- browsers may coalesce pointer events, throttle animation frames, and reduce hardware information for privacy;
- PDF tasks that require Web Workers/WebAssembly or document-specific structures expose capability warnings in the dedicated PDF workspace.

## Project structure

```text
src/
├── components/       Shared application UI
├── device/           Public device-diagnostic task metadata
├── pdf/              Public PDF task metadata and gateway routing
├── registry/         Base 50-tool registry plus expansion-family registration
├── storage/          Local preferences and in-memory transfer helpers
├── tools/            Lazy-loaded tool UIs and shared family gateways
├── utilities/        Pure calculation/transformation helpers
└── __tests__/        Regression and utility tests
```

## Adding a tool or public task family

1. Prefer extending a proven shared engine when several public intents use the same underlying operation family.
2. Create focused UI under `src/tools/<tool-id>/`, or a shared implementation/gateway for a family.
3. Put reusable/pure logic under `src/utilities/` or a dedicated family module.
4. Register stable IDs, routes, categories, keywords, and lazy components.
5. Add meaningful tests for correctness, discovery, capability claims, and regression-sensitive behavior.
6. Run type checking, tests, production build, and the established release gates before merging.

## Status

The original 50 tools remain the hardened S-tier foundation. **P1 + P2 expand the public catalog to 86 routes** while retaining one implementation per capability family and preserving the original release baseline.
