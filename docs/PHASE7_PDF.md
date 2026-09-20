# Phase 7 — Delegated PDF Engine Certification

Tiny Tools does not implement its PDF engines inside this repository.

All 18 PDF routes intentionally delegate to the sibling **PDF Studio / PDF Everything** application at:

`https://thiepn.github.io/pdf/`

The earlier Phase 7 harness duplicated five PDF Studio UI workflows from a separate repository. That produced brittle cross-app timing failures even while the PDF application's own qualified browser suite was green.

Phase 7 now certifies the architectural boundary directly.

## What is certified

For the five previously fixture-blocked Tiny Tools routes:

- `merge-pdf`
- `split-pdf`
- `ocr-pdf`
- `compress-pdf`
- `pdf-metadata`

the certification requires all of the following.

### 1. Live delegated application

The live PDF application must serve:

- its application shell;
- `manifest.webmanifest`;
- `release-metadata.json`;
- `release-integrity.json`.

The manifest must identify **PDF Studio**, and the integrity manifest must contain a non-zero file count.

### 2. Exact qualified source version

The deployed release metadata provides:

- version;
- release channel.

For a Stable deployment, the certification resolves `v<version>` in `thiepn/pdf`.
For a release-candidate deployment, it resolves `main`.

The source `package.json` at that exact commit must report the same version as the live deployment.

### 3. Native PDF Studio qualification

At the exact qualified commit, GitHub Actions must show successful runs for:

- **PDF Studio CI**
- **Deploy PDF Studio to GitHub Pages**

The PDF Studio CI definition at that commit must still include:

- browser regression via `npm run test:e2e`;
- the frozen `release:web` gate;
- generated browser corpora;
- high-severity security gate.

The deployment workflow must still include:

- verified/reproducible builds;
- browser qualification of the exact distribution;
- dependency security;
- release-integrity smoke evidence.

This is stronger and more maintainable than duplicating the PDF application's own internal workflows in Tiny Tools.

### 4. Exact task mappings

The qualified PDF source task catalog must contain the intended mappings:

| Tiny Tools route | PDF task | Qualified target |
|---|---|---|
| `merge-pdf` | `merge-pdfs` | dedicated Merge route |
| `split-pdf` | `split-pdf` | Toolbox workspace |
| `ocr-pdf` | `ocr-pdf` | OCR workspace |
| `compress-pdf` | `compress-pdf` | Compress workspace |
| `pdf-metadata` | `metadata` | Toolbox workspace |

Tiny Tools' own `phase7-pdf-contracts.test.ts` independently verifies its side of these route mappings.

## Why this is the correct gate

The delegated PDF application has its own independent repository and release lifecycle.

Its current CI performs:

- compatibility/stress/adversarial PDF corpora;
- unit tests and TypeScript;
- exact dependency/security audits;
- reproducible verified builds;
- full Playwright browser regression;
- release qualification;
- Pages deployment qualification.

Tiny Tools should verify that it points to a live, qualified version of that app. It should not maintain a second partial clone of the PDF application's browser tests.

## Health integration

The output schema remains route-level:

- 5 target results;
- PASS / FAIL;
- exact qualified commit;
- CI/deploy run IDs;
- source task mapping evidence.

Therefore the existing 351-tool health classifier can continue consuming Phase 7 evidence without weakening its semantics.

A PDF route only clears `TEST_FIXTURE_MISSING` after the delegated release and its exact mapping both pass certification.
