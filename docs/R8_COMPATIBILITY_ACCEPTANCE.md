# R8 — Browser Compatibility & Graceful-Degradation Acceptance

Date: 2026-08-30  
Repository: `thiepn/tools`

## Scope

R8 adds deterministic browser-compatibility acceptance on top of R5 route acceptance, R6 functional workflow acceptance, and R7 browser-capability acceptance. It targets optional or unevenly supported browser APIs and verifies that Tiny Tools degrades explicitly and recoverably when those APIs are absent.

R8 does not add utilities, change registry IDs or routes, or expand the frozen 50-tool product scope.

## Compatibility strategy

The production `dist/` build is served under `/tools/` to preserve the GitHub Pages project-path model. A dependency-free Chrome DevTools Protocol harness removes selected browser APIs before the application loads, then exercises the affected production routes.

The purpose is not to pretend Chromium is Firefox or WebKit. The purpose is to prove that Tiny Tools does not assume optional APIs are universally available. Unsupported paths must provide truthful user feedback, disable actions that cannot work, preserve viable fallbacks, and avoid uncaught exceptions or silent hangs.

## Certified degraded-capability journeys

R8 executes nine compatibility workflows:

1. **Barcode Studio without `BarcodeDetector`** — scanning is explicitly unavailable, scan actions are disabled, and barcode generation remains available.
2. **Text-to-Speech without `SpeechSynthesis`** — unsupported guidance is shown, Speak is disabled, and text editing/copying/transfer remains usable.
3. **Metronome without Web Audio** — sound playback is disabled with explicit guidance while BPM controls and tap tempo remain usable.
4. **Duplicate Finder without `navigator.clipboard`** — Copy Summary uses the shared text-copy fallback and reports success only after a successful copy path.
5. **Text Cleaner without `navigator.clipboard`** — the existing shared fallback continues to copy cleaned text successfully.
6. **Screen Recorder without `getDisplayMedia`** — the tool surfaces its existing unsupported-browser guidance without throwing.
7. **QR Studio without `getUserMedia`** — the tool surfaces camera-unavailable guidance rather than failing during scanner startup.
8. **Document Scanner without `getUserMedia`** — camera failure is recoverable and the photo-upload path remains available.
9. **Teleprompter without the Fullscreen API** — the tool enters a real in-page full-viewport fallback and exits cleanly without falsely claiming native fullscreen.

## Compatibility defects discovered and corrected

R8 identified and corrected five genuine product-level compatibility weaknesses:

- **Barcode Studio:** support detection relied on property presence rather than a usable `BarcodeDetector` constructor. Camera/image scan actions could therefore enter an invalid path in unsupported browsers. The scan surface now performs callable capability detection, disables unsupported scan actions, stops safely if capability disappears, and keeps barcode generation available.
- **Text-to-Speech:** support detection was too weak and Speak could remain interactive when synthesis was unavailable. The tool now requires usable speech APIs, disables speech controls when unsupported, provides explicit recovery guidance, and avoids overstating browser voice locality. Voice availability and whether a voice is on-device are now described as platform-dependent.
- **Metronome:** the sound path assumed `AudioContext`/`webkitAudioContext` existed. The tool now guards Web Audio support before playback, disables audio controls when unavailable, and preserves non-audio BPM/tap-tempo functionality.
- **Duplicate Finder:** Copy Summary called `navigator.clipboard.writeText()` directly. It now uses Tiny Tools' shared clipboard helper, preserving the text-copy fallback and showing success only after a successful copy path.
- **Teleprompter:** fullscreen state could be set even when `requestFullscreen()` was absent or rejected. The tool now distinguishes native and fallback fullscreen modes, synchronizes native state with `fullscreenchange`, and supplies a real fixed full-viewport in-page fallback.

These corrections do not change the purpose of any tool or add new dependencies.

## R7 fixture preservation during R8

R8 also exposed two test-fixture interactions in the inherited R7 capability layer. These were corrected in the R7 CI wrapper without weakening production requirements:

- **QR cleanup timing:** the fixture now continuously accepts either of the two valid cleanup outcomes — Tiny Tools' automatic camera stop after an early synthetic-camera decode, or a manual Stop Camera action — while still failing if any captured track remains live.
- **Barcode permission denial:** after R8 correctly made Barcode Studio refuse scanning when `BarcodeDetector` is absent, the R7 permission-denial fixture could no longer reach `getUserMedia` in headless Chromium. The R7 wrapper now provides its deterministic detector while denying only camera permission, preserving the intended permission-boundary assertion.

Both wrapper changes are schema-guarded and fail loudly if the underlying R7 fixture changes unexpectedly.

## Validation evidence

The repaired R8 pull-request run on Node 22 completed successfully with:

- `npm ci`: **PASS**;
- `npm audit --audit-level=high`: **0 vulnerabilities**;
- TypeScript: **PASS**;
- Vitest: **178/178 tests passing across 8 suites**;
- production Vite build: **PASS**;
- initial JavaScript entry: **302.31 KiB raw / 90.37 KiB gzip**;
- initial CSS: **88.71 KiB raw / 14.37 KiB gzip**;
- bundle budgets: **PASS**;
- R5 Chromium route acceptance: **50/50 routes at 1440px + 50/50 routes at 320px**;
- R5 route-level horizontal-overflow findings: **0**;
- R5 uncaught browser/page errors: **0**;
- R6 functional browser acceptance: **10/10 journeys passed**;
- R7 browser capability acceptance: **12/12 journeys passed**;
- R8 browser compatibility acceptance: **9/9 degraded-capability journeys passed**.

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
npm run browser:capabilities
npm run browser:compatibility
```

All four browser layers must pass before the GitHub Pages artifact is uploaded from `main`.

## Explicit limits

R8 is deterministic feature-absence compatibility acceptance. It does **not** claim:

- native Firefox browser certification;
- native Safari/WebKit browser certification;
- Android or iOS real-device certification;
- physical camera, microphone, or screen-picker certification;
- every browser/OS codec combination;
- every clipboard permission/security-context combination;
- exhaustive assistive-technology or WCAG conformance;
- exhaustive performance behavior under very large files or long recordings.

Those remain separate release-quality concerns. R8 specifically certifies graceful degradation at the tested optional-browser-API boundaries.
