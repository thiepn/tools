# Tiny Tools

Tiny Tools is a privacy-first public utility suite with **70 task routes** for text, PDFs, files, images, media, productivity, math, time, and everyday tasks.

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

P1 adds a first-class PDF category with 20 public task routes covering:

- create and merge PDFs
- scan/images to PDF
- edit and annotate PDFs
- visual signatures and redaction workflows
- page organization, splitting, cropping, rotation, deletion, extraction, watermarking, and page numbers
- form filling, password protection, and PDF cleanup/sanitization
- OCR and compression
- metadata editing
- PDF export to text, Markdown, HTML, and page images
- PDF comparison

Tiny Tools intentionally does not maintain a second PDF processing stack. These routes use one shared gateway into the dedicated **PDF Everything** browser application, which already implements the mature PDF engine and task-specific safety/capability checks. On deployed sites the specialized workspace can be embedded directly inside the Tiny Tools route, with a full-workspace option.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Vitest
- Browser APIs including Canvas, Web Audio, Web Crypto, MediaRecorder, and MediaStreams
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

The original R5–R10 hardening/release gates remain in place. The original R5 route sweep continues to certify the frozen 50-tool baseline; expansion phases add their own targeted regression coverage while the full application still passes build, functional, capability, compatibility, deployment, and live-site gates.

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
- PDF creation, editing, organization, OCR, protection, and conversion through the local-first PDF workspace

Some libraries and model weights may be fetched as static assets on first use. Tiny Tools does not intentionally transmit the user's files, microphone audio, transcripts, notes, signatures, images, or PDF contents to a remote processing service.

## Browser limitations

Capabilities vary by browser and operating system. In particular:

- camera, microphone, screen capture, and clipboard APIs require a secure context and user permission;
- available audio/video codecs differ by browser;
- WebGPU acceleration is not available everywhere and local ML tools may fall back to WebAssembly;
- browser file APIs cannot universally modify or delete arbitrary files on disk;
- available text-to-speech voices depend on the browser and operating system;
- PDF tasks that require Web Workers/WebAssembly or document-specific structures expose capability warnings in the dedicated PDF workspace.

## Project structure

```text
src/
├── components/       Shared application UI
├── pdf/              Public PDF task metadata and gateway routing
├── registry/         Base 50-tool registry plus expansion-family registration
├── storage/          Local preferences and in-memory transfer helpers
├── tools/            Lazy-loaded tool UIs and shared family gateways
├── utilities/        Pure calculation/transformation helpers
└── __tests__/        Regression and utility tests
```

## Adding a tool or public task family

1. Prefer extending a proven shared engine when several public intents use the same underlying operation family.
2. Create focused UI under `src/tools/<tool-id>/`, or a shared gateway for a family such as PDF.
3. Put reusable/pure logic under `src/utilities/` or a dedicated family module.
4. Register stable IDs, routes, categories, keywords, and lazy components.
5. Add meaningful tests for correctness, discovery, and regression-sensitive behavior.
6. Run type checking, tests, production build, and the established release gates before merging.

## Status

The original 50 tools are the hardened S-tier foundation. **P1 expands the public catalog to 70 routes** while retaining one processing implementation per capability family. Future public-completeness phases will continue the same shared-engine model.
