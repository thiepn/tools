# R14 — Strict 351-Tool Reaudit

## Objective

R14 re-audits every public Tiny Tools route under a stricter contract than R11. It is deliberately designed to find quality defects that a route-mount smoke test can miss.

The public catalog remains exactly **351 routes**. R14 adds no new utility routes and does not alter tool behavior by itself.

## What is stricter than R11

R11 already verifies that every route mounts, has canonical intent metadata, avoids unfinished-product placeholders and ErrorBoundary fallbacks, survives safe form mutation, exposes accessible names under its broader naming rules, and does not overflow horizontally.

R14 raises the bar in several ways:

1. **Two viewport passes per tool**
   - desktop: 1440 × 1000;
   - narrow mobile: 360 × 800;
   - horizontal overflow is checked before and after interaction.

2. **Stricter accessibility semantics**
   - placeholders are no longer accepted as a substitute for a programmatic label;
   - visible buttons, links, inputs, textareas, and selects require a programmatic name;
   - `aria-labelledby` and `aria-describedby` references must resolve;
   - `label[for]` targets must exist;
   - duplicate IDs are rejected;
   - positive `tabindex` values are rejected;
   - visible enabled controls must remain keyboard focusable;
   - nested interactive controls are rejected;
   - visible images must carry an `alt` attribute;
   - icon-only button/link targets below 24 × 24 CSS pixels are rejected.

3. **Adversarial but valid input mutation**
   - text controls receive Unicode and multilingual input (`Ångström`, emoji, Japanese text);
   - structured-input tools receive domain-shaped JSON/YAML/XML/HTML/CSS/SQL/Markdown/URL/email/IP/CIDR samples;
   - date, time, month, week, color, numeric, range, checkbox, and select controls are mutated using browser-native setters and events;
   - file, password, hidden, submit, reset, and image controls are not synthesized.

4. **Safe action execution**
   - after inputs are populated, R14 can click up to two non-destructive actions such as Calculate, Convert, Generate, Format, Validate, Solve, Apply, Process, Compare, Extract, Clean, Normalize, Render, or Preview;
   - download/save/share/print/delete/reset/record/camera/microphone/play/connect/import/export/permission actions are excluded.

5. **Output-integrity checks**
   - interaction must not introduce raw `NaN`, `undefined`, or `[object Object]` output tokens that were not present before interaction;
   - the route must keep exactly one visible H1 matching the registry name;
   - the page must retain a `<main>` landmark and non-empty core tool UI.

6. **Runtime and privacy checks**
   - uncaught exceptions, console errors/assertions, and browser error-log entries fail the route;
   - automatic cross-origin HTTP(S) requests made while merely opening the route are reported as failures;
   - requests caused later by the generic audit interaction are not classified as automatic route-load traffic.

7. **Strict local performance ceiling**
   - a production route that takes more than 5 seconds to mount in the local CI environment is reported as a strict finding.

## Reports

The harness writes both:

- `artifacts/r14-strict-audit.json` — machine-readable per-route results;
- `artifacts/r14-strict-audit.md` — human-readable findings grouped by tool.

The workflow uploads both files even when the strict audit fails, so findings remain inspectable instead of being buried in CI logs.

## Interpretation

A clean R14 run is stronger evidence than R11, but it still does not prove every codec, malformed file, browser engine, physical device, permission state, large-file boundary, network environment, or user workflow is correct. Those require targeted family fuzzing, cross-browser testing, real hardware, and format-specific corpora.

R14 should remain a failing gate while real findings exist. The audit must not be weakened merely to obtain a green check.
