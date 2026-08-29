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
- `data-tool-id` and `data-tool-category` hooks;
- a `.tt-tool-content` boundary used for cross-tool control normalization.

R4 also closes an architectural inconsistency discovered by the first audit: the ten Phase 5 tools (41–50) were intentionally built as bare tool components and therefore did not render `ToolShell` themselves. Rather than rewriting those large tool implementations, `App` now wraps exactly those ten routes in the shared shell through the explicit `APP_MANAGED_TOOL_IDS` registry helper. The other 40 tools remain self-managed and continue rendering `ToolShell` internally.

The result is one shared shell on every tool route, with no double-shell rendering.

All existing IDs, hash routes, favorites, recent-history behavior, related-tool links, and in-memory transfer behavior remain unchanged.

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
- self-managed shell IDs match their registry IDs;
- `App` wraps the app-managed tools and supplies related-tool navigation;
- the shared R4 controls and shell semantics remain present.

The first draft of this guard intentionally failed because it assumed one folder = one registry ID and every component filename ended in `Tool.tsx`. That assumption was false for existing entries such as `encoding-tools`, `discount-vat-calculator`, and the bare Phase 5 set. The corrected guard protects the actual application architecture instead of forcing a cosmetic file-layout rewrite.

## Explicitly deferred

R4 does not claim:

- every bespoke control inside all 50 tools has already been migrated to the new primitives;
- physical-device or cross-browser acceptance;
- complete WCAG conformance;
- visual rebranding;
- heavy Whisper/ONNX optimization;
- new utility functionality.

The shared contract is designed so future tool-specific fixes can be small, reviewable, and regression-protected.

## Validation gate

The R1–R3 release gate remains authoritative:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
```

Existing initial-entry bundle budgets must continue to pass.
