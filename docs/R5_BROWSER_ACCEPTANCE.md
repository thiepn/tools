# R5 — Chromium Browser Acceptance & Route Matrix

Date: 2026-08-30  
Repository: `thiepn/tools`  
Branch: `chatgpt/r5-browser-acceptance`

## Scope

R5 adds a real-browser release gate on top of the R0–R4 unit, source-contract, TypeScript, security, and production-build checks. It does not add tools, change tool algorithms, or redesign the product.

The goal is to catch failures that static/unit tests cannot prove away: broken lazy chunks, bad GitHub Pages-relative asset paths, route-level runtime exceptions, global horizontal overflow, shell regressions, and shared keyboard-navigation failures.

## Browser harness

`scripts/r5-browser-smoke.mjs` is intentionally dependency-free. It uses:

- the production `dist/` output;
- a small Node static server mounted at `/tools/` to emulate the real `thiepn.github.io/tools/` subpath;
- the Chrome DevTools Protocol over Node 22's built-in WebSocket implementation;
- the Chrome/Chromium binary already present on the GitHub Actions runner.

No Playwright/Puppeteer dependency or browser package download is added to the production or development dependency graph.

## Route matrix

The script reads the 50 canonical IDs from `src/registry/tools.ts` and tests every registered tool route at:

- desktop: **1440 × 1000**;
- narrow mobile baseline: **320 × 844**.

For each route it verifies:

- the lazy component actually renders;
- exactly one canonical `ToolShell` is present;
- `data-tool-id` matches the registry ID;
- category metadata is present;
- `#main-content` remains present;
- document metadata is populated;
- the ErrorBoundary fallback is not visible;
- the page itself does not horizontally overflow the viewport;
- no uncaught runtime exception or browser/console error is produced during route mount.

This produces 100 tool-route browser checks per CI run.

## Dashboard acceptance

At both viewports, the dashboard must:

- expose links to all 50 unique tool routes;
- remain within the viewport width;
- render with Tiny Tools document metadata;
- mount without browser/page errors.

## Keyboard acceptance

R5 verifies shared keyboard behavior in Chromium:

- the first Tab reaches the skip-to-main control;
- Enter/Space activation of the skip control focuses `#main-content`;
- `/` opens the command palette when focus is not in a text-entry surface;
- the command palette focuses its search field;
- Escape dismisses the command palette.

The browser run exposed that the skip control relied only on the browser's synthesized button click. R5 makes Enter/Space activation explicit while retaining normal pointer `onClick` behavior, making the focus transfer deterministic and independently testable.

## Final validation evidence

Final pull-request validation on Node 22 completed successfully with:

- `npm ci`: passing;
- `npm audit --audit-level=high`: **0 vulnerabilities**;
- TypeScript check: **0 errors**;
- Vitest: **178/178 tests passing across 8 suites**;
- production Vite build: passing;
- initial JavaScript entry: **302.30 KiB raw / 90.35 KiB gzip**;
- initial CSS: **88.59 KiB raw / 14.35 KiB gzip**;
- R1 bundle budgets: passing (**350/110 KiB JS raw/gzip, 150/30 KiB CSS raw/gzip**);
- Chromium route matrix: **50/50 desktop routes passing**;
- Chromium route matrix: **50/50 320px routes passing**;
- dashboard discovery: **50/50 tool links at both viewports**;
- route-level horizontal overflow findings: **0**;
- uncaught browser/page errors: **0**;
- skip-to-main and command-palette keyboard checks: **passing**.

## CI gate

The release validation sequence is now:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
npm run browser:smoke
```

The browser acceptance step must pass before the Pages artifact can be uploaded from `main`.

## Explicit limits

R5 is a Chromium route/interaction smoke layer, not a claim of:

- full end-to-end testing of every control in every utility;
- Firefox or Safari/WebKit certification;
- physical Android/iPhone acceptance;
- complete WCAG conformance;
- camera/microphone permission acceptance on real devices;
- validation of every large-file or long-running media workflow.

Those require targeted acceptance beyond a deterministic CI browser smoke.
