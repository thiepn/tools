# Phase 2 — Shared Infrastructure Repair

Baseline: Phase 1 head `aebd75247f9e2f2bec782ebb24b832544cf62d4c`.

Phase 2 starts with confirmed cross-cutting defects found by source review while the long Phase 1 runtime scan is still executing. It does not invent PASS/BROKEN counts before the Phase 1 report exists.

## Confirmed systemic repairs

### 1. Preference storage access can throw before fallback

`src/storage/preferences.ts` previously evaluated `window.localStorage` in a guard outside the protective `try`. In sandboxed/private contexts the storage property getter itself may throw, breaking shared favorites, recents and theme persistence rather than degrading gracefully.

Repair:
- central safe `getLocalStorage()` accessor;
- all preference reads/writes degrade to defaults/no-op when storage is blocked;
- regression coverage for throwing getters and throwing storage methods.

### 2. Clipboard fallback can leak its temporary textarea

The shared `copyToClipboard` fallback removed its hidden textarea only after a successful `execCommand('copy')`. If the legacy copy call threw, the temporary control remained in the DOM.

Repair:
- cleanup moved to `finally`;
- the fallback textarea is readonly;
- the shared Expert Workspace copy path now delegates to the same hardened clipboard helper;
- regression coverage verifies cleanup on failure.

### 3. Shared report downloads revoke Blob URLs too early

The R16 and R17 shared export helpers revoked their object URLs with a zero-delay timer immediately after clicking a detached anchor. This is a browser race and can produce intermittent/no download behavior. Similar download implementations were duplicated across strict shared layers.

Blast radius:
- R16 specialist manifest: **198** route IDs;
- R17 specialist manifest: **95** route IDs;
- strict S-tier manifest: **32** route IDs.

Repair:
- new `src/utilities/download.ts`;
- object URLs are retained for 1500 ms by default;
- temporary download anchors are appended to the document, clicked, then removed deterministically;
- R16, R17, strict S-tier and Expert Workspace download helpers now use the same implementation;
- regression coverage verifies delayed URL revocation and anchor lifecycle.

## Tests

New: `src/__tests__/shared-infrastructure.test.ts`

Covers:
- blocked localStorage getter;
- storage method failures;
- clipboard fallback cleanup;
- download anchor and delayed object-URL lifecycle.

## Scope

This phase intentionally avoids individual calculator/converter/text/file correctness changes until the Phase 1 health matrix is available. The first commit removes confirmed shared infrastructure defects with wide blast radius and creates permanent regression protection.
