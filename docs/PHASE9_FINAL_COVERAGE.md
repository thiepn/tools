# Phase 9 — Final Functional Coverage

Phase 9 closes the final three Tiny Tools-local fixture gaps:

- `text-cleaner`
- `structured-data-viewer`
- `font-viewer`

and requires the delegated PDF engine boundary to be certified before the phase can pass.

## PDF prerequisite

PDF tools are implemented in the sibling `thiepn/pdf` application.

Phase 9 therefore requires Phase 7's delegated-engine certification:

- live PDF Studio release metadata/integrity;
- version-matched qualified source commit;
- successful PDF Studio CI;
- successful Pages qualification/deploy workflow;
- browser/release/security gates present in the qualified source;
- exact five task mappings.

This replaces the previous brittle duplication of PDF Studio's own UI tests.

## Final three local workflows

### Text Cleaner
- exact default Unicode cleanup;
- smart quote/dash normalization;
- zero-width removal;
- joiner preservation;
- production-browser text input/output;
- exact clipboard Copy Result verification.

### Structured Data Viewer
- real JSON upload;
- exact parsed tree values;
- node/depth statistics;
- filter/search;
- malformed JSON rejection.

### Font Viewer
- real Ubuntu system TTF;
- format/header inspection;
- browser FontFace load;
- character map;
- live preview text update.

The temporary system-font fixture is never uploaded as a workflow artifact.

## Acceptance

Phase 9 completes only when:

- delegated PDF certification is 5/5 PASS;
- singleton browser certification is 3/3 PASS;
- complete unit/type/build gates pass;
- the 351-tool health matrix reaches 351 PASS / 0 BROKEN / 0 BLOCKED / 0 FLAKY.

After this point, feature repair stops and the project moves to release hardening.
