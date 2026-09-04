# R13 — Former A-tier → S-tier uplift

## Scope

R13 upgrades the **126 routes explicitly listed in the September 2026 A-tier ranking**. It does not add or remove public routes; Tiny Tools remains a 351-route catalog.

The A-tier routes were already strong specialist tools. R13 therefore preserves their existing engines and adds professional workflow, reproducibility, quality-control, and reporting capabilities rather than replacing stable implementations.

## S-tier quality contract

Every R13 target now receives two complementary browser-local layers:

1. **Expert workspace**
   - named state snapshots with restore and comparison;
   - versioned JSON import/export;
   - batch execution through real tool controls;
   - numeric sensitivity sweeps;
   - Unicode-aware text diagnostics;
   - local file dossiers with SHA-256/signatures/metadata where applicable;
   - live visible-output tracing;
   - native form-validity surfacing;
   - automatic omission of password/token/private-key-like fields from snapshots.

2. **Professional QA console**
   - deterministic reproducibility fingerprints over non-sensitive control state plus visible output;
   - exportable Markdown and JSON professional reports;
   - control inventory and searchable focus map;
   - native validity, programmatic-name, and duplicate-ID diagnostics;
   - sensitive-value redaction in all QA surfaces;
   - four-sample visible-output repeatability checks that distinguish stable from dynamic behavior;
   - quick focus for the first invalid control;
   - local-only console processing.

## Why this is an A → S uplift

The existing A-tier tools already solved their primary task well. S-tier status requires more than adding extra buttons to the core task. R13 adds reusable professional workflows around the specialist engine:

- **reproducibility:** a tool state can be captured, fingerprinted, compared, restored, and reported;
- **depth:** compatible tools gain batch and sensitivity workflows without duplicate public routes;
- **diagnostics:** complex file/media/device/browser tools gain trace and file-inspection support;
- **quality control:** current form validity and control structure are inspectable directly from the route;
- **portability:** reports can be copied or downloaded in human-readable Markdown and machine-readable JSON;
- **privacy:** secret-like fields are omitted automatically and the uplift itself performs no uploads.

Dynamic tools such as clocks, timers, live device diagnostics, random generators, or progress-based media tools may intentionally fail a repeatability check because changing output is correct behavior. The console reports that fact rather than treating it as an application defect.

## Target catalog

`src/s-tier-a/manifest.ts` is the source of truth and contains exactly **126 unique route IDs**. R13 also asserts that the A-tier set does not overlap the 154-route former B-tier set.

## Verification

R13 adds dedicated regression coverage:

- `src/__tests__/r13-s-tier-a-uplift.test.ts`
  - exact 126-route scope and uniqueness;
  - no A/B target overlap;
  - unchanged 351-route public total;
  - registry decoration and real capability markers;
  - deterministic fingerprints;
  - sensitive-value redaction;
  - quality summaries;
  - repeatability analysis;
  - Markdown/JSON report generation.

- `scripts/r13-a-uplift-smoke.mjs`
  - loads all 126 production routes in Chromium;
  - requires both Expert workspace and Professional QA console;
  - requires all 4 expert modes and all 3 professional modes;
  - checks the fingerprint surface;
  - rejects unnamed workspace actions, ErrorBoundary fallback, runtime exceptions, and horizontal overflow;
  - exercises representative batch/sensitivity and control-map surfaces.

- `.github/workflows/r13-s-tier-a-uplift.yml`
  - typecheck;
  - complete unit suite;
  - production build and chunk verification;
  - dedicated 126-route R13 Chromium acceptance.

The existing R11 full-catalog audit, R12 former-B acceptance, and production GitHub Pages workflow remain independent release gates.
