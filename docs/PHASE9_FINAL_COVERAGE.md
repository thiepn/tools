# Phase 9 — Final Functional Coverage

Phase 9 is the final feature-correctness wave before release hardening.

The last authoritative global health artifact before Phase 9 reported:

- 351 total
- 340 PASS
- 6 BROKEN
- 5 BLOCKED
- 0 FLAKY

Subsequent focused evidence has already restored:

- Phase 6 Media: 8/8 PASS
- Phase 8 Image: 2/2 PASS

The remaining work is therefore:

1. finish the five PDF production workflows;
2. certify the three singleton fixture gaps:
   - `text-cleaner`
   - `structured-data-viewer`
   - `font-viewer`

The target end state is **351 PASS / 0 BROKEN / 0 BLOCKED / 0 FLAKY**.

## PDF prerequisite repair

The Phase 7 production harness is strengthened in Phase 9.

### Known-good PDF fixture structure

The hand-written Phase 7 fixture generator is replaced with the same minimal PDF structure used by PDF Everything's own validated fixture:

- PDF 1.7 header;
- catalog;
- pages tree;
- Helvetica font resource;
- one content stream per page;
- searchable text;
- exact xref offsets;
- valid trailer and `startxref`.

The generator supports one or multiple pages while keeping the known-good object structure.

### Real file chooser path

PDF Everything's task launcher stores the selected task only when the user clicks **Choose PDF** and the browser opens the file chooser.

Phase 9 now uses Chrome DevTools' real file-chooser interception:

1. enable file-chooser interception;
2. click **Choose PDF**;
3. wait for `Page.fileChooserOpened`;
4. assign the local PDF to that exact chooser backend node;
5. let PDF Everything's real `change` handler import and route the project.

This is stronger than setting an arbitrary hidden input after the fact.

### Existing download validation remains strict

- real Chromium downloads are written to disk;
- PDF outputs must begin with `%PDF-`;
- split ZIP must begin with `PK`;
- outputs must exceed trivial size;
- product status/validation messages must also complete.

## Final three singleton targets

### Text Cleaner

The browser fixture writes intentionally dirty text containing:

- smart quotes;
- em dash;
- CRLF line endings;
- blank line;
- tab;
- zero-width space.

With default options, it requires the exact output:

```text
"Hello"-world

second line
```

It then clicks **Copy Result** and verifies the exact cleaned text reaches the browser clipboard API.

Deterministic contracts also verify:

- smart quote/dash normalization;
- invisible-character removal;
- joiner preservation by default;
- exact line/character statistics.

### Structured Data Viewer

A real JSON fixture is uploaded through the production file input.

The test requires:

- JSON format recognition;
- node count/depth rendering;
- nested `Ada` and `phase9` values;
- working tree search/filter.

Unit contracts independently verify JSON parsing, exact node/depth statistics, and malformed-JSON rejection.

### Font Viewer

The CI runner provides a real installed TTF font.

Phase 9:

- locates a known Ubuntu system TTF;
- copies it only into the temporary local test fixture directory;
- uploads it through the real Font Viewer file input;
- requires TrueType format detection;
- requires the browser `FontFace` API to load it locally;
- requires the character map;
- changes preview text and verifies the rendered preview updates.

The font fixture itself is intentionally **not uploaded as a workflow artifact**.

Unit contracts independently validate TTF, OTF, WOFF, and WOFF2 signature parsing without distributing font binaries.

## Family completeness gates

Phase 9 hard-gates the authoritative family sizes:

- Text: 21
- Developer: 52
- Design: 14

It also requires all three singleton route IDs to remain registered in their expected categories.

## Global health integration

`scripts/phase1-tool-health.mjs` now executes Phase 9.

Only these exact route IDs consume Phase 9 evidence:

- `text-cleaner`
- `structured-data-viewer`
- `font-viewer`

A passing Phase 9 fixture clears `TEST_FIXTURE_MISSING` for that route.

A failed fixture becomes a genuine health failure.

Phase 9 execution is mandatory for health-report completeness.

## Dedicated Phase 9 workflow

The Phase 9 CI gate requires:

1. dependency audit;
2. TypeScript;
3. Phase 9 deterministic contracts;
4. complete unit regression;
5. production build;
6. production build verification;
7. live PDF Everything availability;
8. repaired Phase 7 PDF production certification at 5/5 PASS;
9. Phase 9 singleton browser certification at 3/3 PASS.

Only JSON/Markdown evidence is uploaded. The temporary system-font fixture is not included in artifacts.

## Commands

```bash
npm run test:phase9
npm run browser:pdf
npm run browser:final
npm run browser:health
```

## Acceptance gate

Phase 9 is complete when:

- Phase 7 PDF production certification is 5/5 PASS;
- Text Cleaner is functionally certified;
- Structured Data Viewer is functionally certified;
- Font Viewer is functionally certified with a real TTF/FontFace flow;
- full unit/type/build gates pass;
- the complete 351-tool health artifact reports:
  - 351 PASS
  - 0 BROKEN
  - 0 BLOCKED
  - 0 FLAKY.

After this gate, feature-repair phases stop. The next work should be release hardening, final manual sampling, packaging, and release-candidate certification rather than another functional family wave.
