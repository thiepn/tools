# Phase 1 — Automated Runtime Health Audit

Phase 1 adds a persistent, registry-driven health scan for the complete Tiny Tools catalog.

## What runs

`npm run browser:health` performs:

1. Two independent R11 full-catalog runtime scans against all 351 canonical registry entries.
2. One R18 evidence pass to exercise safe primary actions, desktop/mobile rendering, and interaction depth.
3. Cross-run stability analysis to flag flaky tools.
4. Normalization of findings into Phase 1 failure codes.
5. Observable-response checks for safely triggered primary actions.
6. Automatic screenshots for tools with runtime-audit findings.
7. Failure clustering across tools and categories.
8. Machine-readable and human-readable health reports.

The implementation intentionally reuses the proven R11/R18 Chromium/CDP infrastructure rather than maintaining a second browser harness.

## Output

Generated under `artifacts/tool-health/`:

- `tool-health.json` — complete health model and per-tool evidence.
- `tool-health.csv` — spreadsheet-friendly 351-tool matrix.
- `tool-health.md` — readable summary, family health, clusters, and full matrix.
- `failure-clusters.json` — normalized root-cause clusters.
- `tool-health-run-1.json`, `tool-health-run-2.json`, ... — individual stability runs.
- `r11-run-*.log` — raw runtime-audit diagnostics.
- `r18.log` — safe-action/mobile evidence log.
- `failed-tools/run-*/<tool-id>.png` — automatic viewport screenshots for tools with R11 findings.

## Status semantics

- `PASS` — no Phase 1 runtime finding was reproduced.
- `BROKEN` — at least one application defect was reproduced.
- `BLOCKED` — only an external/test-environment dependency prevented evaluation.
- `flaky: true` — the repeated R11 runs disagreed on status or failure-code signature.

Phase 1 does not use `VERIFIED`; exact business-output correctness belongs to later family-specific functional repair phases.

## Failure codes

The health report normalizes findings to the Phase 1 vocabulary, including `RENDER_FAILURE`, `RUNTIME_EXCEPTION`, `CONSOLE_ERROR`, `INPUT_MISSING`, `TIMEOUT`, `EXTERNAL_DEPENDENCY`, and `UNKNOWN_FAILURE`. The complete vocabulary is retained in the harness so later repair phases can add more specific evidence without changing report shape.

## Commands

```bash
npm run build
npm run build:verify
npm run browser:health
```

Or run all three through:

```bash
npm run tools:health
```

Set `TOOL_HEALTH_RUNS` to a value greater than 2 for a longer flakiness soak.

## CI behavior

`.github/workflows/phase1-tool-health.yml` runs typecheck, unit tests, production build verification, and the complete health scan on pull requests to `main`.

The health scan itself is allowed to report broken tools without preventing artifact upload. CI still fails if the report is missing, does not cover exactly 351 tools, does not contain at least two runtime passes, or fails to produce the R18 evidence pass. This keeps Phase 1 useful as a discovery gate while later phases repair the defects it finds.
