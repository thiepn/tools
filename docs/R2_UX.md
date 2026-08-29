# R2 — UX Consolidation & Product Coherence

Date: 2026-08-30  
Repository: `thiepn/tools`  
Branch: `chatgpt/r2-ux-consolidation`

## Scope

R2 turns the certified 50-tool baseline into a more coherent product without adding tools or redesigning individual utilities. The focus is discovery, information architecture, shared presentation rules, truthful privacy language, and low-risk interaction consistency.

## Goals

- keep all 50 tool IDs, routes, and tool behavior unchanged;
- make general-purpose utilities easier to discover than developer-focused utilities;
- replace the flat 50-card catalog with category-grouped browsing;
- improve task-oriented search ranking and multi-word queries;
- make the command palette useful before the user types by prioritizing recents and favorites;
- unify category labels and badge styling between the dashboard, command palette, and tool shell;
- remove invalid nested interactive controls from tool cards;
- improve focus states and basic ARIA semantics in shared navigation surfaces;
- keep preference defaults general-purpose and prevent shared mutable default state;
- replace absolute privacy/network wording with accurate local-processing language.

## Explicitly out of scope

R2 does not:

- add or remove tools;
- redesign the internals of individual tools;
- change calculations or media-processing algorithms;
- prune Whisper/ONNX runtime assets;
- perform broad physical-device acceptance;
- claim cross-browser certification;
- perform major framework upgrades.

## UX architecture

The discovery order is intentionally general-use first:

1. Productivity & Office
2. Images & Photos
3. Text & Writing
4. Files & Archives
5. Media & Audio
6. Time & Dates
7. Everyday Helpers
8. Math & Conversion
9. Design & Visuals
10. Developer Utilities

The underlying `ToolCategory` values remain unchanged, so stored preferences, routes, registry IDs, and tool behavior are preserved.

## Search behavior

R2 adds ranked task search outside the core tool registry. Ranking prefers:

- exact tool names and short names;
- exact or prefix ID/name matches;
- explicit tool keywords;
- multi-word task matches across names, descriptions, keywords, and category vocabulary;
- category aliases such as `photos`, `office`, and `archives`.

Common intent filler words such as `make`, `create`, and `tool` do not block task searches.

## Validation gate

R2 must pass the existing R1 clean-environment gate:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
```

The R1 initial-entry raw/gzip bundle budgets remain authoritative. Final test counts and bundle measurements will be recorded after pull-request CI completes.
