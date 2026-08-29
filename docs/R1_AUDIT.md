# R1 Security, Architecture & Performance Audit

Date: 2026-08-29  
Repository: `thiepn/tools`  
Branch: `chatgpt/r1-security-architecture-performance`

## Scope

R1 hardens the certified 50-tool baseline without redesigning the UI or changing tool purposes. The pass covers dependency security, CI integrity, privacy-sensitive runtime data lifetime, and protection of the initial application bundle.

## Dependency security

The R0 dependency graph reported four high-severity advisories. Investigation traced them to Node-side transitive dependencies pulled through `@huggingface/transformers` / `onnxruntime-node`, rather than to browser user-content processing paths:

- `adm-zip@0.5.18`
- `onnxruntime-node@1.24.3` through the vulnerable `adm-zip`
- `sharp@0.34.5`
- the aggregate `@huggingface/transformers` advisory entry caused by those transitive packages

R1 pins patched transitive versions through npm overrides:

- `adm-zip` → `0.6.0`
- `sharp` → `0.35.4`

The regenerated npm lockfile installs successfully and `npm audit --audit-level=high` reports **0 vulnerabilities**. The deprecated `@types/jszip` stub was also removed because JSZip ships its own type declarations.

Major framework/tooling upgrades such as Vite 8 and TypeScript 7 are intentionally deferred; they are not required to resolve the audited security findings and would increase regression risk.

## Runtime privacy and memory lifetime

Tool-to-tool transfers remain memory-only; no transfer content is written to URLs or persistent storage.

R1 reduces retention further:

- the transfer store now retains at most one pending text payload and one pending image payload;
- setting a newer transfer replaces an abandoned older transfer;
- consuming a transfer immediately clears it;
- `App` retains only the active destination's consumed text during navigation instead of accumulating historical transfer payloads.

This bounds the lifetime of potentially private transferred content and large image Blobs without changing the tool-chaining workflow.

## CI and deployment hardening

The GitHub Pages workflow now:

1. uses Node 22;
2. uses current major GitHub Actions (`checkout@v7`, `setup-node@v7`, `upload-pages-artifact@v5`, `deploy-pages@v5`);
3. runs `npm ci`;
4. fails on high-severity npm audit findings;
5. runs TypeScript checking and the complete Vitest suite;
6. builds the production Vite bundle before deployment;
7. enforces initial-load bundle budgets before Pages deployment.

Current initial bundle budgets are deliberately above the certified baseline while low enough to catch accidental eager-loading regressions:

- initial JavaScript: **130 KiB maximum**;
- initial CSS: **150 KiB maximum**.

## Bundle and heavy-runtime findings

The audited production build keeps the normal application shell small:

- initial JavaScript: approximately **82.64 KiB** (**22.44 KiB gzip**);
- initial CSS: approximately **87.99 KiB** (**14.04 KiB gzip**).

Large local speech-recognition assets remain separate from the initial app shell. The build currently emits approximately:

- Whisper worker: **536.70 KiB**;
- ONNX Runtime JS bundles: roughly **400 KiB each**;
- ONNX WASM variants: roughly **23.57 MiB** and **23.91 MiB** raw.

These files support the local Whisper execution path and are not part of the initial application JavaScript entry. Whisper model weights are downloaded as static model assets only when the transcription workflow is used; user audio and transcripts are processed locally.

Reducing or selectively packaging ONNX backend/WASM variants is deferred to a dedicated heavy-runtime optimization pass because backend support differs across WebGPU/WASM/browser environments.

## Node baseline

`package.json` now declares Node `>=22`, matching the CI environment used to validate and deploy the application.

## Validation evidence

The lockfile/security validation run completed with:

- clean npm install;
- **0 npm vulnerabilities** after the overrides;
- TypeScript check passing;
- **141/141 pre-R1-runtime tests passing**;
- production Vite build passing.

R1 also adds focused tests for the bounded text/image transfer lifecycle. The final pull-request CI is the release gate for the updated total test count and bundle-budget check.

## Deferred work

R1 intentionally does not perform:

- major Vite/TypeScript/React ecosystem migrations;
- UI/UX redesign;
- category/search-information-architecture changes;
- aggressive ONNX/Whisper backend pruning;
- broad cross-browser or physical-device acceptance testing;
- feature additions.

Those should be handled as separate, reviewable phases after this security and preservation checkpoint.
