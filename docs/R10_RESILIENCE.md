# R10 — Large-Input Resilience & Stack Safety

Date: 2026-08-30  
Repository: `thiepn/tools`

## Scope

R10 is a bounded resilience pass for computational tools that can receive unusually large text or structured inputs. It does not add tools, change routes, redesign the UI, or expand the frozen 50-tool scope.

The main product defect addressed by R10 is JSON Formatter's dependence on recursive JavaScript traversal and native recursive serialization for deeply nested valid JSON.

## Product correction

Before R10, JSON Formatter used recursive functions to:

- deep-sort object keys;
- calculate key/depth statistics;
- serialize the parsed result through native `JSON.stringify`.

Deeply nested but syntactically valid JSON could therefore encounter a JavaScript call-stack limit unrelated to JSON validity.

R10 replaces all container traversal in this path with explicit iterative work stacks:

- deep key sorting is iterative;
- key/depth statistics are iterative;
- parsed JSON serialization is iterative;
- primitive and object-key escaping still delegates to native `JSON.stringify`, but only for individual primitive strings/numbers/booleans where recursion is not involved.

The formatter continues to preserve its established compact/2-space/4-space output behavior and existing key-count/depth semantics.

## Large-input regression suite

`src/__tests__/r10-resilience.test.ts` adds eight deterministic cases:

1. **Text Cleaner:** 50,000 input lines, including 25,000 duplicates, with exact duplicate/output statistics.
2. **Word Counter:** 100,000 words with exact frequency, unique-word, reading-time, and speaking-time results.
3. **List Processor:** 30,000 items reduced deterministically to 10,000 unique sorted values.
4. **Case Converter:** 20,000 input words converted to one complete snake_case identifier without truncation.
5. **JSON key sorting:** 12,000 nested object levels traversed and sorted without recursive call-stack growth.
6. **JSON Formatter deep path:** 12,000 nested JSON levels parsed, sorted, serialized, and measured end-to-end without native stringify stack overflow.
7. **JSON Formatter wide path:** 10,000 top-level objects / 30,000 total keys formatted with sorted keys and exact statistics.
8. **JSON semantics preservation:** existing depth/key counting behavior verified after iterative traversal.

These tests use 15-second per-case limits only as hang protection. They intentionally do not assert machine-specific millisecond performance thresholds.

## Validation evidence

The final implementation run before documentation completed successfully on Node 22:

- `npm ci`: **PASS**;
- `npm audit --audit-level=high`: **0 vulnerabilities**;
- TypeScript: **PASS**;
- Vitest: **186/186 tests passing across 9 suites**;
- R10 suite: **8/8 passing**;
- R10 suite runtime on the observed CI runner: **567 ms** (informational only, not a release threshold);
- production Vite build: **PASS**;
- initial JavaScript entry: **302.31 KiB raw / 90.36 KiB gzip**;
- initial CSS: **88.71 KiB raw / 14.37 KiB gzip**;
- existing bundle budgets: **PASS**;
- R5 route acceptance: **50/50 desktop + 50/50 at 320px**;
- R5 route-level horizontal-overflow findings: **0**;
- R5 uncaught browser/page errors: **0**;
- R6 functional acceptance: **10/10**;
- R7 capability acceptance: **12/12**;
- R8 graceful-degradation acceptance: **9/9**.

A final CI run on the documentation head is required before merge; the evidence above records the implementation run that established these measurements.

## Explicit limits

R10 is not an unlimited-input guarantee. Browser memory and available device resources remain finite. In particular, R10 does not claim:

- successful processing of arbitrarily large files or strings;
- fixed performance across low-memory mobile devices;
- stress certification for multi-gigabyte ZIP/video/image/audio workloads;
- long-duration recording endurance;
- Whisper/ONNX model-memory optimization;
- native Firefox/Safari or physical-device certification;
- public deployment certification (tracked separately by R9).

R10 certifies that representative large text/structured workloads remain correct, deterministic, and stack-safe at the tested scales, while the existing R5–R8 release gates continue to pass.
