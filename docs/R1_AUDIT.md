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
7. enforces raw and gzip initial-entry bundle budgets before Pages deployment.

Current bundle budgets are intentionally above the measured baseline while low enough to catch meaningful eager-loading regressions:

- initial JavaScript: **350 KiB raw / 110 KiB gzip maximum**;
- initial CSS: **150 KiB raw / 30 KiB gzip maximum**.

## Bundle and heavy-runtime findings

The production HTML currently references an initial JavaScript entry of approximately **293.17 kB** (**286.30 KiB raw**). Vite reports **88.30 kB gzip** for that entry; the CI budget script's direct zlib measurement is **86.23 KiB gzip**. The initial CSS is approximately **87.99 kB** (**85.93 KiB raw**), with Vite reporting **14.04 kB gzip** and the CI zlib measurement reporting **13.71 KiB gzip**.

An earlier R1 note incorrectly identified an **82.64 kB / 22.44 kB gzip** split chunk as the initial JavaScript entry. The CI budget check now reads `dist/index.html` directly and measures the assets actually referenced by the page, preventing that classification error from recurring.

Large local speech-recognition assets remain separate from the initial HTML entry. The build currently emits approximately:

- Whisper worker: **536.70 KiB**;
- ONNX Runtime JS bundles: roughly **400 KiB each**;
- ONNX WASM variants: roughly **23.57 MiB** and **23.91 MiB** raw.

These files support the local Whisper execution path and are not the JavaScript entry referenced by `dist/index.html`. Whisper model weights are downloaded as static model assets only when the transcription workflow is used; user audio and transcripts are processed locally.

Reducing or selectively packaging ONNX backend/WASM variants is deferred to a dedicated heavy-runtime optimization pass because backend support differs across WebGPU/WASM/browser environments.

## Node baseline

`package.json` now declares Node `>=22`, matching the CI environment used to validate and deploy the application.

## Validation evidence

Final pull-request validation on Node 22 completed successfully with:

- `npm ci`: passing;
- `npm audit --audit-level=high`: **0 vulnerabilities**;
- TypeScript check: passing with **0 errors**;
- Vitest: **143/143 tests passing across 5 suites**;
- production Vite build: passing;
- initial-entry bundle-budget gate: passing at **286.30 KiB raw / 86.23 KiB gzip JS** and **85.93 KiB raw / 13.71 KiB gzip CSS**.

The final 143-test suite consists of the pre-R1 141-test regression baseline plus **2 focused transfer-lifecycle tests**.

## Deferred work

R1 intentionally does not perform:

- major Vite/TypeScript/React ecosystem migrations;
- UI/UX redesign;
- category/search-information-architecture changes;
- aggressive ONNX/Whisper backend pruning;
- broad cross-browser or physical-device acceptance testing;
- feature additions.

Those should be handled as separate, reviewable phases after this security and preservation checkpoint.
