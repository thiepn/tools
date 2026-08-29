# R0 — Repository Baseline

## Scope

R0 is a preservation-oriented cleanup for `thiepn/tools`. It normalizes the exported Google AI Studio repository without redesigning tools, changing UX, or refactoring application behavior.

## Baseline application

- Product: Tiny Tools
- Architecture: static React + TypeScript + Vite application
- Tool count: 50
- Registry contract: 50 unique tool IDs and routes
- Routing: hash-based client routing
- Deployment target: GitHub Pages repository subpath
- Canonical package manager: npm with `package-lock.json`

## Privacy architecture

Tiny Tools has no application backend. User content is intended to remain in the browser.

Known heavier local/browser runtimes include:

- `@huggingface/transformers` for local Whisper transcription
- `tesseract.js` for OCR
- `@imgly/background-removal` for local background removal
- browser Canvas, Web Audio, Web Crypto, MediaRecorder, and MediaStream APIs

Some tools may download static runtime/model assets on first use. That is distinct from uploading user content for remote processing.

## R0 cleanup goals

- remove obsolete AI Studio, Gemini API, and Cloud Run scaffolding
- normalize package metadata and dependency placement
- standardize on npm and one lockfile
- preserve all 50 stable tool IDs and routes
- retain route-level lazy loading for heavy tools
- add reproducible validation and GitHub Pages deployment
- document the repository as the project source of truth

## Validation gates

Clean CI must run:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

GitHub Actions is the authoritative clean-environment validation for R0.

## Intentionally deferred

R0 does not include:

- homepage/information-architecture redesign
- category or search overhaul
- visual-system consolidation
- broad component or state-management refactors
- deep heavy-runtime performance optimization
- physical-device acceptance testing
- broad cross-browser acceptance testing

Those belong in later phases after this baseline is merged.
