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
- render with the expected Tiny Tools document title;
- mount without browser/page errors.

## Keyboard acceptance

R5 also verifies shared keyboard behavior in Chromium:

- the first Tab reaches the skip-to-main control;
- activating the skip control focuses `#main-content`;
- `/` opens the command palette when focus is not in a text-entry surface;
- the command palette focuses its search field;
- Escape dismisses the command palette.

## CI gate

The existing validation sequence remains intact and gains one additional step after the production build and bundle-budget check:

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
