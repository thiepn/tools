# R7 — Browser Capability & Permission Acceptance

Date: 2026-08-30  
Repository: `thiepn/tools`  
Branch: `chatgpt/r7-capability-acceptance`

## Scope

R7 adds deterministic browser-capability acceptance on top of R5 route acceptance and R6 functional workflow acceptance. It targets browser APIs whose failure modes cannot be certified by unit tests or route mounting alone: camera streams, microphone streams, `MediaRecorder`, screen capture, permission denial, and media lifecycle cleanup.

R7 does not add utilities or change the 50-tool product scope.

## Capability harness

The production `dist/` build is served under `/tools/` to preserve the GitHub Pages project-path model. A dependency-free Chrome DevTools Protocol harness launches Chromium with fake camera and microphone devices enabled for deterministic CI.

For screen recording, the harness supplies a browser-native `canvas.captureStream()` display stream through the `getDisplayMedia` boundary. This exercises Tiny Tools' actual `MediaStream`/`MediaRecorder` handling, pause/resume, stop, Blob creation, preview metadata, and cleanup without pretending CI can operate Chromium's native screen-picker UI.

## Certified journeys

R7 executes 12 media and permission workflows:

1. **QR Studio camera** — start fake camera, attach stream to video, stop, verify tracks end.
2. **Barcode Studio camera** — start fake camera, attach stream, execute active detector loop, switch tab, verify cleanup.
3. **Document Scanner camera** — acquire fake camera, render camera view, attach stream after video mount, cancel, verify cleanup.
4. **Audio Recorder microphone** — record from fake microphone, verify active `MediaRecorder`, navigate away through the SPA, verify stream and recorder shutdown.
5. **Speech-to-Text microphone** — record from fake microphone, navigate away, verify stream and recorder shutdown.
6. **Screen Recorder** — capture browser-native synthetic display stream, record, pause, resume, stop, verify preview duration, non-empty Blob, recorder shutdown, and ended display tracks.
7. **QR camera denial** — reject `getUserMedia`, verify visible recovery feedback.
8. **Barcode camera denial** — reject `getUserMedia`, verify visible recovery feedback.
9. **Document Scanner camera denial** — reject `getUserMedia`, verify visible recovery feedback.
10. **Audio Recorder microphone denial** — reject `getUserMedia`, verify visible recovery feedback.
11. **Speech-to-Text microphone denial** — reject `getUserMedia`, verify visible recovery feedback.
12. **Screen Recorder capture denial** — reject `getDisplayMedia`, verify visible recovery feedback.

## Defects discovered and corrected

The first R7 discovery execution passed 8/12 journeys and exposed four genuine browser-capability defects:

- **Barcode Studio:** the camera scan loop was started from the render closure in which `isScanningCamera` was still false, and the conditionally rendered `<video>` did not yet exist. The scanner now attaches the acquired stream after the scanning UI commits and uses the live stream ref rather than stale React state to drive the detector loop.
- **Document Scanner:** `getUserMedia()` completed before the conditionally rendered camera `<video>` existed, so the stream was never attached. The stream is now attached in an effect after the camera view mounts.
- **Screen Recorder:** `MediaRecorder.onstop` captured the initial `elapsedSeconds === 0`, so completed recordings displayed `00:00`. A live elapsed-time ref now supplies final recording metadata while React state continues to drive the visible timer.
- **Audio Recorder:** microphone permission rejection was written only to the console. The tool now renders user-visible, accessible recovery feedback for denied or unavailable microphone access.

No registry IDs, routes, utility count, dependencies, or unrelated media algorithms were changed to resolve these findings.

## Validation evidence

The repaired R7 pull-request run on Node 22 completed successfully with:

- `npm ci`: **PASS**;
- `npm audit --audit-level=high`: **0 vulnerabilities**;
- TypeScript: **PASS**;
- Vitest: **178/178 tests passing across 8 suites**;
- production Vite build: **PASS**;
- initial JavaScript entry: **302.30 KiB raw / 90.34 KiB gzip**;
- initial CSS: **88.59 KiB raw / 14.35 KiB gzip**;
- bundle budgets: **PASS**;
- R5 Chromium route acceptance: **50/50 routes at 1440px + 50/50 routes at 320px**;
- R5 route-level horizontal-overflow findings: **0**;
- R5 uncaught browser/page errors: **0**;
- R6 functional browser acceptance: **10/10 journeys passed**;
- R7 browser capability acceptance: **12/12 journeys passed**;
- QR, Barcode, and Document Scanner camera attach/cleanup: **PASS**;
- Barcode active detection loop: **PASS**;
- Audio Recorder and Speech-to-Text microphone lifecycle cleanup on SPA navigation: **PASS**;
- Screen Recorder record/pause/resume/stop/preview/Blob/cleanup: **PASS**;
- camera, microphone, and screen-capture denial recovery states: **6/6 PASS**.

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
```

All three browser layers must pass before the GitHub Pages artifact is uploaded from `main`.

## Explicit limits

R7 is deterministic Chromium CI acceptance. It does **not** claim:

- physical camera or microphone hardware certification;
- automation of Chromium's native screen-sharing picker UI;
- Android/iOS real-device certification;
- Firefox or Safari/WebKit media certification;
- every OS/browser codec combination;
- real-world multi-camera switching behavior;
- exhaustive media-duration or very-large-recording performance certification;
- complete WCAG conformance.

Those remain separate release-quality concerns and should be added only when they materially increase confidence beyond the deterministic R5–R7 gates.
