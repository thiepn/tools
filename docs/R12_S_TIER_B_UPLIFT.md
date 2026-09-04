# R12 — Former B-tier → S-tier uplift

## Scope

R12 upgrades the **explicit 154-route B-tier list** from the September 2026 quality ranking. The earlier prose ranking contained an aggregate B-tier count that did not match its explicit route list; R12 deliberately binds to the 154 named routes rather than propagating the stale aggregate.

No new public routes are added. The certified catalog remains 351 tools.

## S-tier quality contract

Every targeted route keeps its existing specialist engine and receives an **Expert workspace** that materially expands what can be done with that tool without uploading user data:

1. **Reproducible scenarios**
   - capture named tool states;
   - compare a saved state with the current state;
   - restore previous configurations or page defaults;
   - export/import versioned JSON snapshots;
   - store snapshots locally only after explicit user action;
   - automatically omit password/secret/token/private-key-like fields.

2. **Batch runner**
   - select an existing text/number/select input;
   - run up to 30 cases through the actual tool UI;
   - capture the tool’s visible output after each case;
   - restore the original form state afterwards;
   - export batch results as quote-safe CSV.

3. **Numeric sensitivity sweep**
   - detect numeric/range inputs automatically;
   - test −20%, −10%, −5%, +5%, +10%, and +20% scenarios;
   - capture visible output deltas;
   - respect the existing control validity constraints;
   - restore baseline values when complete.

4. **Live text diagnostics**
   - Unicode grapheme count;
   - UTF-8 byte size;
   - words and unique words;
   - lines and longest line;
   - non-ASCII and whitespace counts.

5. **Local file dossier**
   - inspect files already chosen in the underlying tool;
   - size, MIME declaration, modified date, leading-byte signature;
   - SHA-256 up to the browser-safe 128 MiB analysis threshold;
   - image dimensions when decodable;
   - audio/video duration when readable;
   - duplicate-content detection by SHA-256;
   - export a local JSON report.

6. **Live output trace**
   - record meaningful visible-output changes once per second;
   - deduplicate identical frames;
   - retain up to 120 changes in memory;
   - export the trace as CSV.

7. **Validation and privacy**
   - surface current native form-validity failures;
   - do not automatically persist inputs;
   - sensitive-looking fields are excluded from saved snapshots;
   - all expert-workspace processing is browser-local.

## Target routes

The source of truth is `src/s-tier-b/manifest.ts`. It contains exactly 154 unique IDs and is covered by automated tests.

The list spans calculators, device diagnostics, image/media utilities, text/study tools, privacy/developer utilities, document/planning tools, web-authoring tools, statistics/math utilities, file viewers, restoration tools, browser diagnostics, and the remaining P20 general utilities.

## Verification

R12 adds three levels of regression coverage:

- `src/__tests__/r12-s-tier-b-uplift.test.ts` verifies the exact 154-route catalog, registry decoration, unchanged 351-route public total, scenario diffing, batch parsing, sensitivity generation, Unicode diagnostics, secret omission, cross-tool import rejection, and CSV export.
- `scripts/r12-b-uplift-smoke.mjs` loads all 154 targeted production routes in Chromium and requires the Expert workspace, all four workspace modes, accessible actions, no ErrorBoundary fallback, no runtime exceptions, and no horizontal overflow.
- `.github/workflows/r12-s-tier-b-uplift.yml` runs typecheck, all unit tests, production build verification, and the dedicated 154-route browser acceptance on pull requests and main.

The existing R11 full 351-tool audit remains in place, so R12 must pass both the targeted uplift gate and the complete-catalog gate before release.
