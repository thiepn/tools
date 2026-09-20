# Phase 10 — Release-Candidate Hardening

Phase 9 ended the functional-repair sequence with an authoritative result of:

- **351 / 351 PASS**
- **0 BROKEN**
- **0 BLOCKED**
- **0 FLAKY**

Phase 10 does not add tools or product features.

Its purpose is to prove that the exact candidate artifact is reproducible, internally consistent, cryptographically fingerprinted, and eligible to be promoted later without rebuilding different bytes.

## Scope freeze

Phase 10 explicitly freezes:

- public route count: **351**
- public base path: `/tools/`
- package version: `0.22.0`
- current feature set and UI
- Phase 3–9 functional contracts

Feature additions, design changes, and new tool families are out of scope.

## Release-identity repair

A release-hardening audit found:

- `package.json`: **0.22.0**
- `package-lock.json`: **0.9.0**

The application installed correctly, but source release identity was inconsistent.

Phase 10 synchronizes the lockfile top-level/root package versions with `package.json`, and a permanent unit contract now fails if they diverge again.

## Deterministic build identity

`scripts/write-build-generation.mjs` now supports deterministic build metadata through:

- `TINY_TOOLS_BUILD_TIMESTAMP`
- `SOURCE_DATE_EPOCH`
- `TINY_TOOLS_BUILD_COMMIT`

Normal local development still falls back to the current time when those values are absent.

For RC builds the values come from the exact Git candidate commit.

## Byte-for-byte reproducibility

Phase 10 performs two independent production builds from the same source/environment.

`scripts/phase10-compare-builds.mjs` inventories both build trees, SHA-256 hashes every file, compares file sets/content, and produces one aggregate fingerprint.

The RC fails if any byte differs.

## RC source gate

Before packaging, Phase 10 requires:

- exact `npm ci`
- high-severity dependency audit
- valid installed dependency tree
- TypeScript
- Phase 10 release-source contract
- complete unit regression
- production build verification
- previous-generation retention self-test

## Browser hardening gate

The RC re-runs:

- route acceptance
- navigation reliability
- stale-deployment/module recovery
- compatibility acceptance
- authoritative 351-tool health

The health report must be exactly:

```text
351 total
351 PASS
0 BROKEN
0 BLOCKED
0 FLAKY
```

with R18 plus Phase 4–9 evidence present and green.

## Bundle and public-output checks

The RC certifier retains the existing bundle limits:

- JS raw ≤ 350 KiB
- JS gzip ≤ 110 KiB
- CSS raw ≤ 150 KiB
- CSS gzip ≤ 30 KiB

It also rejects public source maps, `.env` files, TypeScript source files, unsafe generated paths, or a PWA manifest that no longer identifies Tiny Tools.

## Cryptographic artifact identity

For every public file in `build-generation.json`, Phase 10 emits `checksums.sha256` and one canonical SHA-256 fingerprint.

`release-candidate.json` records:

- RC identifier
- package version
- exact source commit
- deterministic build timestamp
- public file count
- public artifact fingerprint
- full-build reproducibility fingerprint
- package.json / package-lock.json / tool-health.json hashes
- complete health/family state
- Phase 4–9/R18 evidence
- initial bundle metrics

## Deterministic RC package

The deployable tree is packaged as:

`tiny-tools-v<version>-rc-<12-char-sha>.tar.gz`

The archive uses sorted paths, commit-time mtimes, numeric owner/group 0, and gzip timestamps disabled. A SHA-256 sidecar is generated and immediately verified.

## Evidence output

The Phase 10 artifact contains:

- deployable RC `.tar.gz`
- archive SHA-256
- archive file listing
- `release-candidate.json`
- `release-candidate.md`
- `checksums.sha256`
- `reproducibility.json`
- `reproducibility.md`
- authoritative tool-health JSON/Markdown

Retention: **90 days**.

## Acceptance gate

Phase 10 is complete only when the dedicated workflow proves:

1. package/lock version identity matches
2. dependency security/tree pass
3. typecheck and all unit tests pass
4. two independent production builds are byte-for-byte identical
5. production build verification passes
6. navigation/recovery/compatibility browser gates pass
7. health is **351/351 PASS, 0 broken, 0 blocked, 0 flaky**
8. bundle budgets pass
9. public checksums/fingerprint are generated
10. deterministic archive validates against its SHA-256
11. RC manifest reports **CERTIFIED**

No deployment to `main` occurs in Phase 10.

After Phase 10, the next step is final release acceptance/manual sampling and promotion of the already-certified RC artifact, not another functional repair phase.
