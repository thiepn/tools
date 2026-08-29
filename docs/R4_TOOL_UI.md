# R4 — Per-Tool UI Contract & Workflow Normalization

Date: 2026-08-30  
Repository: `thiepn/tools`  
Branch: `chatgpt/r4-tool-ui-contract`

## Scope

R4 establishes a shared UI contract for the 50 existing Tiny Tools utilities. It does not add tools, redesign the product, or change calculation/media-processing algorithms.

The problem addressed in R4 is consistency inside individual tools: the suite has a strong shared shell after R2/R3, but tool implementations still repeat slightly different patterns for feedback, copy actions, drop zones, form semantics, disabled states, and responsive action groups.

## Shared contract

R4 adds reusable controls in `src/components/tool-ui/ToolControls.tsx`:

- `ToolStatus` — polite status/error announcements with shared visual tones and busy state;
- `CopyButton` — consistent copy/copy-success behavior with timer cleanup;
- `ToolActionBar` — responsive action grouping that stacks safely on narrow screens;
- `AccessibleDropZone` — keyboard-operable file/drop activation with Enter/Space semantics.

These components are intentionally small and dependency-light so individual tools can migrate incrementally without a framework rewrite.

## ToolShell contract

The shared `ToolShell` now supplies:

- semantic section/header/aside structure;
- stable title and description IDs;
- `aria-labelledby` and `aria-describedby` linkage;
- canonical `data-tool-id` and `data-tool-category` hooks;
- a `.tt-tool-content` boundary used for cross-tool control normalization.

R4 also closes an architectural inconsistency discovered by the first audit: the ten Phase 5 tools (41–50) were built as bare tool components and therefore did not render `ToolShell` themselves. Rather than rewriting those large tool implementations, `App` now wraps exactly those ten routes in the shared shell through the explicit `APP_MANAGED_TOOL_IDS` helper. The other 40 tools remain self-managed and continue rendering `ToolShell` internally.

The result is one shared shell on every tool route, with no double-shell rendering.

A second audit found one older internal alias: QR Studio is registered as `qr-studio` but its certified component passes the historical string `qr-code-studio` to `ToolShell`. R4 preserves the QR implementation byte-for-byte and canonicalizes that alias centrally to `qr-studio`. This prevents phantom favorite/data-hook IDs without rewriting QR scanning or generation behavior.

All public tool IDs, hash routes, recent-history behavior, related-tool links, and in-memory transfer behavior remain unchanged.

## Global tool-content normalization

Within `.tt-tool-content`, R4 standardizes conservative baseline behavior for:

- disabled controls;
- read-only fields;
- code/pre overflow handling;
- responsive action groups;
- shared status width constraints.

The R3 mobile and reduced-motion safeguards remain in place.

## Reference migration

`UnitConverterTool` is migrated as the first reference implementation:

- category buttons expose pressed state;
- numeric/unit controls have explicit labels and IDs;
- the swap control has an accessible name;
- result updates are announced politely;
- copy feedback uses the shared `CopyButton` rather than a tool-specific timer.

This establishes the pattern for later low-risk migrations without forcing a simultaneous rewrite of every bespoke control.

## Preservation guard

R4 adds a source-level CI contract that validates the real registry architecture rather than assuming folder names or filenames:

- the registry still contains exactly 50 unique lazy component imports;
- every registered component path resolves to source;
- exactly ten known bare tools are app-managed by `ToolShell`;
- the other 40 tools remain self-managed through `ToolShell`;
- self-managed shell IDs resolve to their canonical registry IDs;
- `App` wraps the app-managed tools and supplies related-tool navigation;
- the shared R4 controls and shell semantics remain present.

The initial static guard exposed false file-layout assumptions, which were corrected rather than forcing cosmetic renames. The refined guard then exposed the genuine legacy QR shell alias described above.

## Validation evidence

Final pull-request validation on Node 22 completed successfully with:

- `npm ci`: passing;
- `npm audit --audit-level=high`: **0 vulnerabilities**;
- TypeScript check: **0 errors**;
- Vitest: **178/178 tests passing across 8 suites**;
- R4-specific suite: **8/8 tests passing**;
- production Vite build: passing;
- initial JavaScript entry: **302.22 KiB raw / 90.34 KiB gzip**;
- initial CSS: **88.56 KiB raw / 14.34 KiB gzip**;
- R1 bundle budgets: passing (**350/110 KiB JS raw/gzip, 150/30 KiB CSS raw/gzip**).

R4 adds eight contract tests on top of the R3 170-test baseline. The shared UI contract and the app-managed shell wrapper remain inside the established entry-bundle budget.

## Explicitly deferred

R4 does not claim:

- every bespoke control inside all 50 tools has already been migrated to the new primitives;
- physical-device or cross-browser acceptance;
- complete WCAG conformance;
- visual rebranding;
- heavy Whisper/ONNX optimization;
- new utility functionality.

The shared contract is designed so future tool-specific fixes can be small, reviewable, and regression-protected.
