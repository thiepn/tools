# R3 — Interaction, Mobile & Accessibility Hardening

Date: 2026-08-30  
Repository: `thiepn/tools`  
Branch: `chatgpt/r3-interaction-accessibility`

## Scope

R3 hardens the shared interaction layer used by the 50-tool Tiny Tools suite. It does not add tools, change tool algorithms, or perform a visual redesign.

## Shared interaction changes

- adds a reusable modal surface with focus trapping, Escape handling, focus restoration, backdrop close, and background scroll locking;
- moves Command Palette and Smart Paste onto the shared modal behavior;
- prevents Command Palette and Smart Paste from stacking on top of each other;
- removes automatic clipboard reads when Smart Paste opens; clipboard access now occurs only after an explicit user action;
- adds outside-click and Escape dismissal to the ToolShell transfer menu;
- makes the transfer menu width viewport-safe on narrow screens;
- resets tool error boundaries when navigating to a different tool;
- moves focus to main content after client-side route changes and scrolls new routes to the top;
- adds a keyboard-accessible skip-to-content control;
- updates the browser document title and description for active tool routes;
- prevents the `/` global search shortcut from firing inside inputs, textareas, selects, contenteditable surfaces, and textbox/combobox/searchbox roles.

## Mobile and touch baseline

The global stylesheet now provides conservative app-wide defaults for:

- `touch-action: manipulation` on primary interactive elements;
- 44 px minimum coarse-pointer targets for buttons and form controls;
- 16 px form text on narrow screens to avoid mobile browser input zoom;
- responsive media/canvas sizing;
- a 320 px minimum supported viewport;
- global `prefers-reduced-motion` handling.

These are shared safeguards rather than per-tool layout redesigns.

## Preservation

R3 preserves:

- exactly 50 tools;
- all tool IDs and hash routes;
- the R2 discovery architecture and ranked search behavior;
- all calculation, image, audio, video, OCR, archive, and local-AI algorithms;
- R1 dependency audit and bundle-budget gates;
- privacy-sensitive in-memory transfer behavior.

## Validation gate

R3 must pass the existing clean Node 22 CI gate:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
```

The R1 initial-entry raw/gzip bundle budgets remain authoritative. R3 adds focused tests for route metadata, keyboard shortcut targeting, and wrapped command-palette navigation.

## Deferred

R3 does not claim:

- physical-device acceptance;
- Safari/iOS, Firefox, or Android engine certification;
- complete WCAG conformance;
- per-tool visual normalization of every individual form;
- heavy Whisper/ONNX runtime optimization.
