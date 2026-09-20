# Phase 2 — Health-classification integrity

The completed Phase 1 artifact for commit `aebd75247f9e2f2bec782ebb24b832544cf62d4c` reported:

- 351 total
- 351 PASS
- 0 BROKEN
- 0 BLOCKED
- 0 FLAKY

That result was structurally valid but too optimistic. Inspection of the same artifact showed:

- `actionAttempted: false` for **351/351** tools;
- `actionEffect: null` for **351/351** tools;
- **35** tools received no safe input mutation;
- therefore the health matrix could label a mounted but functionally unexercised route as PASS.

Phase 2 corrects this test-system defect instead of treating false-green coverage as product proof.

## Changes

### R18 evidence

- broadens the allowlist of safe local action verbs without permitting permission/network/destructive actions;
- records `mutationEffect` by comparing observable result/body surfaces before and after safe input mutation;
- records visible file-input count in per-tool evidence.

### Health classification

A tool is no longer PASS merely because it mounted cleanly.

`TEST_FIXTURE_MISSING` / `BLOCKED` is emitted when:
- the route exposes controls/actions/file inputs but no core workflow was exercised; or
- safe input mutation occurred but produced no observable result change and no safe primary action was available.

This is intentionally a coverage status, not a product-bug verdict. It creates an honest queue for later deterministic family fixtures.

`ACTION_NO_EFFECT` remains a BROKEN condition when a safe primary action is actually clicked and produces no observable response.
