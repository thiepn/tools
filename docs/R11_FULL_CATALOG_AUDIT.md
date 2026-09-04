# R11 — Full 351-Tool Catalog Audit

Date: 2026-09-03  
Repository: `thiepn/tools`  
Audited baseline: `24bd9938a0e09427db852af8bc286907fb8745e8` (P20 / 351 public routes)

## Executive verdict

All **351/351 registered Tiny Tools routes mounted successfully** from the production build during the R11 full-catalog run. The audit found **no route that crashed, fell into the application ErrorBoundary, rendered empty tool content, exposed an unfinished-product marker, or developed horizontal page overflow** during the safe interaction pass.

The audit did, however, find **62 quality findings across 38 tools**:

- **55 accessibility findings** across 35 tools: visible form controls lacked a programmatic accessible name.
- **7 catalog/header consistency findings**: the route registry name and the visible tool `<h1>` differed.

Those findings are real product-quality issues, but they are not evidence that the underlying calculation/conversion engines are failing. No uncaught runtime exception was found by R11.

A separate source-level review also found one correctness edge case in P20's **Weighted Decision Matrix**: result rows are looked up by display name, so two alternatives with the same name can show the same ranked score even when their scores differ. This should be corrected before claiming duplicate-named alternatives are handled correctly.

## What R11 actually did

R11 is not another route-presence test. It runs the production `dist/` build under `/tools/`, launches headless Chromium, and visits every registered route.

For every tool it verifies:

- the canonical route mounts with a `ToolShell`;
- the tool has non-empty rendered content;
- no ErrorBoundary fallback appears;
- no uncaught browser/runtime/console error is emitted;
- no visible `coming soon`, `not implemented`, `under construction`, `TODO`, or `replace me` marker appears;
- no horizontal page overflow is introduced;
- visible form controls have a programmatic accessible name;
- safe, type-aware changes can be made to ordinary text, number, date/time, color, range, checkbox, textarea, and select controls without crashing the route.

The safe-interaction pass intentionally does **not** auto-click arbitrary buttons that could request permissions, start recording, perform external network probes, clear user state, or trigger file downloads.

## Coverage results

- Registered routes: **351**
- Routes successfully mounted: **351/351**
- Reactive tools safely mutated: **273/351**
- Upload-first tools identified: **23**
- Action/button-first tools identified: **55**
- Visible controls inspected: **2,044**
- Safe control mutations performed: **916**
- Runtime exceptions found: **0**
- ErrorBoundary fallbacks found: **0**
- Empty tool bodies found: **0**
- Unfinished-product markers found: **0**
- Horizontal-overflow findings: **0**
- R11 findings total: **62**

## Catalog/header consistency findings — 7

The registry title and the visible tool title differ for:

1. `text-cleaner` — registry: **Text Cleaner & Normalizer**; visible heading: **Text Cleaner**
2. `list-processor` — registry: **List Processor & Sorter**; visible heading: **List Processor**
3. `color-converter` — registry: **Color Converter & Contrast**; visible heading: **Color Converter & Contrast Checker**
4. `qr-studio` — registry: **QR Code Studio & Scanner**; visible heading: **QR Code Studio**
5. `document-scanner` — registry: **Document & Receipt Scanner**; visible heading: **Document Scanner & Straightener**
6. `speech-to-text` — registry: **Speech to Text / Voice Transcriber**; visible heading: **Speech to Text Transcriber**
7. `zip-manager` — registry: **ZIP File Pack & Unpack**; visible heading: **ZIP / Archive Manager**

These should be normalized so search/catalog wording and the tool page describe the same product surface.

## Accessible-name findings — 55 across 35 tools

The following tools expose one or more visible controls without a programmatic accessible name:

- `text-cleaner` — tab-size select; input textarea; output textarea
- `list-processor` — operation select; textarea
- `json-formatter` — output textarea
- `encoding-tools` — select; textarea
- `secure-generator` — range input
- `aspect-ratio-calculator` — button; number input; select
- `percentage-calculator` — text input
- `unit-converter` — from-unit select; to-unit select
- `unit-price-comparator` — input; button
- `date-calculator` — date input
- `time-zone-converter` — select; date input
- `qr-studio` — textarea; color input; select
- `image-collage` — select
- `text-to-speech` — textarea
- `random-picker` — textarea
- `recipe-scaler` — number input; text input
- `checklist` — select; input; checkbox; button
- `notepad` — input; button; textarea
- `speech-to-text` — textarea
- `text-diff` — textarea
- `barcode-studio` — select
- `signature-maker` — button
- `whiteboard` — color input; range input; select
- `teleprompter` — textarea
- `calendar-event-maker` — select
- `metronome` — button; range input
- `duplicate-finder` — select
- `meme-maker` — textarea
- `csv-splitter` — textarea
- `csv-merger` — file input
- `file-type-inspector` — file input
- `tar-pack` — file input
- `tar-extract` — file input
- `gzip-compress` — file input
- `gzip-decompress` — file input

The audit only reports controls that are visible at the audited desktop viewport. Hidden implementation file inputs are not treated as visible controls.

## Additional correctness finding from source review

### Weighted Decision Matrix — duplicate option names

The P20 Decision Matrix ranks options correctly internally, but the UI maps a result back to its input row using the option's display name. If two options have the same name, both rows can resolve to the first matching ranked result and display the same weighted score.

Severity: **medium correctness edge case**.  
Recommended fix: preserve a stable source ID/index through ranking and render each result by that stable identity rather than by the editable display name; add a regression test with duplicate names and different scores.

## What the existing test layers already cover

R11 supplements rather than replaces the existing release gates:

- production-build manifest/chunk verification for all registered lazy imports;
- R5 all-route Chromium rendering and responsive overflow acceptance;
- R6 representative end-to-end functional workflows;
- R7 camera/microphone/screen-capture capability and permission workflows;
- R8 optional-browser-API graceful-degradation workflows;
- phase/unit suites for converter, calculator, image, media, text/study, security/developer, Office/eBook, statistics, subtitle, viewer, restoration, network, and P20 utility engines.

## What this audit does not prove

Even after R11, Tiny Tools cannot truthfully claim that every possible input is exhaustively certified. Remaining external/edge coverage includes:

- malformed or adversarial examples of every supported file format;
- extremely large files and long recordings;
- every codec/container/profile combination;
- physical camera, microphone, GPU, gamepad, and display hardware;
- native Firefox and Safari/WebKit behavior;
- Android/iOS real-device behavior;
- every locale, Unicode edge case, and assistive-technology combination;
- external endpoint outages or network middleboxes.

These are separate compatibility/fuzz/performance concerns rather than evidence of a currently broken registered route.

## Audit conclusion

**Core runtime status:** 351/351 routes operational under the audited production Chromium environment.  
**Known critical/high runtime failures:** 0.  
**Known correctness edge cases from this pass:** 1 (Decision Matrix duplicate names).  
**Known accessibility/name issues:** 55 controls across 35 tools.  
**Known catalog/header inconsistencies:** 7 tools.

PR #47 intentionally remains a strict audit branch while these findings are visible. The new R11 harness can be retained as a future regression gate after the findings are resolved or explicitly reclassified by severity.
