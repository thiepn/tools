# R6 — Functional Workflow Acceptance

Date: 2026-08-30  
Repository: `thiepn/tools`  
Branch: `chatgpt/r6-functional-acceptance`

## Scope

R6 adds end-to-end functional browser journeys on top of the R5 route-mount matrix. R5 proves every registered route can load without runtime errors or page overflow; R6 proves representative user tasks actually change state, produce results, persist where intended, transfer privately between tools, and execute browser-native file/export workflows.

R6 does not add tools, redesign utilities, or replace the existing unit and route-level gates.

## Certified journeys

The production `dist/` build is served under `/tools/` to preserve the GitHub Pages project-path model. A dependency-free Chrome DevTools Protocol harness then exercises these ten workflows:

1. **Dashboard search → Unit Converter** at 320px.
2. **Text Cleaner** live whitespace and smart-quote normalization at 320px.
3. **Case Converter** live camelCase and CONSTANT_CASE output.
4. **JSON Formatter** valid/invalid states, key sorting, Blob export, and `.json` download naming.
5. **Unit Converter** metres-to-feet conversion and unit swapping.
6. **Percentage Calculator** default and edited calculations.
7. **Cross-tool text transfer** from Text Cleaner to Word Counter, including verification that the transient payload is not stored in localStorage.
8. **Quick Notepad** intentional local persistence across a browser reload.
9. **Checklist** add/check workflow and intentional persistence across reload.
10. **Duplicate File Finder** real SHA-256 duplicate detection using synthetic browser `File` objects delivered through a drop event.

Each journey also fails on uncaught page exceptions, console errors, assertion errors, and application-resource browser log errors.

## Privacy boundary

R6 explicitly distinguishes two storage classes:

- transient cross-tool payloads must remain memory-only and are checked for absence from `localStorage`;
- Notepad and Checklist content are intentional persisted user data and are checked for successful local persistence.

This makes the privacy model part of executable browser acceptance rather than documentation alone.

## CI gate

The release validation sequence is now:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
npm run browser:smoke
npm run browser:functional
```

Both browser layers must pass before a Pages artifact can be uploaded from `main`.

## Explicit limits

R6 is still deterministic CI acceptance. It does not claim:

- exhaustive interaction coverage for every control in all 50 utilities;
- real camera, microphone, screen-capture, or filesystem permission acceptance;
- Firefox or Safari/WebKit certification;
- physical Android/iOS device certification;
- very-large-file performance acceptance;
- complete WCAG conformance.

Those remain separate release-quality concerns and should be handled only where they materially improve confidence.
