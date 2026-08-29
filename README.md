# Tiny Tools

Tiny Tools is a privacy-first collection of **50 browser utilities** for text, files, images, media, productivity, math, time, and everyday tasks.

The application is a static React + TypeScript + Vite site. User files and content are processed locally in the browser rather than sent to an application backend.

> Some advanced tools download static runtime/model assets when first used, such as local Whisper transcription, OCR, or background-removal assets. Those downloads are separate from user-content processing.

## Principles

- Fast, focused utilities with minimal friction.
- Client-side processing whenever technically possible.
- No accounts, backend database, analytics, or advertising.
- Route-level lazy loading so heavy tools do not bloat the homepage.
- Static deployment compatible with GitHub Pages.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Vitest
- Browser APIs including Canvas, Web Audio, Web Crypto, MediaRecorder, and MediaStreams
- Local browser ML/OCR runtimes for tools that require them

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

## GitHub Pages

The repository includes a GitHub Actions workflow that validates the project and deploys `dist/` to GitHub Pages after successful pushes to `main`.

The Vite build uses relative asset URLs and Tiny Tools uses hash-based client routing, so the application remains compatible with repository-subpath hosting such as:

```text
https://thiepn.github.io/tools/
```

In GitHub repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## Privacy model

Tiny Tools has no application backend. User content is processed in browser memory or, for explicitly persistent tools such as the notepad and checklist, local browser storage.

Examples of local processing include:

- text transformations and calculations
- image/canvas operations
- ZIP creation/extraction
- SHA-256 duplicate-file detection
- audio/video capture and editing
- OCR
- local Whisper speech transcription

Some libraries and model weights may be fetched as static assets on first use. Tiny Tools does not intentionally transmit the user's files, microphone audio, transcripts, notes, signatures, or image contents to a remote processing service.

## Browser limitations

Capabilities vary by browser and operating system. In particular:

- camera, microphone, screen capture, and clipboard APIs require a secure context and user permission;
- available audio/video codecs differ by browser;
- WebGPU acceleration is not available everywhere and local ML tools may fall back to WebAssembly;
- browser file APIs cannot universally modify or delete arbitrary files on disk;
- available text-to-speech voices depend on the browser and operating system.

## Project structure

```text
src/
├── components/       Shared application UI
├── registry/         Typed 50-tool registry and search metadata
├── storage/          Local preferences and in-memory transfer helpers
├── tools/            Individual lazy-loaded tool UIs
├── utilities/        Pure calculation/transformation helpers
└── __tests__/        Regression and utility tests
```

## Adding a tool

1. Create the tool UI under `src/tools/<tool-id>/`.
2. Put reusable/pure logic under `src/utilities/` where appropriate.
3. Register the tool once in `src/registry/tools.ts` with a stable ID, route, category, keywords, and lazy import.
4. Add meaningful tests for pure logic and regression-sensitive behavior.
5. Run type checking, tests, and the production build before merging.

## Status

The current feature set is intentionally frozen at **50 tools** while the project moves through repository cleanup, UX consolidation, performance review, deployment, and real-device acceptance testing.
