# Phase 6 — Media Family Functional Certification

Phase 6 targets the next-largest blocked family after Files.

The authoritative pre-Phase-5 health report contained:

- 351 total
- 322 PASS
- 0 BROKEN
- 29 BLOCKED
- 0 FLAKY

The remaining family distribution showed **8 blocked media routes**, larger than PDF (5), Image (2), and the remaining one-route gaps. This ordering remains valid even while Phase 5 CI is queued because Phase 5 only changes the Files family.

## Scope

The complete Media family contains **44 routes**.

Phase 6 adds dedicated production-browser fixtures for the 8 blocked workflows:

- Screen Recorder
- Reverse Audio
- Stereo ↔ Mono Converter
- Ringtone Maker
- Loop Video
- Crop & Resize Video
- Mute Video
- Video Volume Changer

## Media download hardening

The remaining custom media download implementations now delegate to the shared Phase 2 Blob lifecycle:

- Audio Micro Tools
- Video Micro Tools
- Screen Recorder
- Reverse Audio

Reverse Audio keeps a preview object URL but stores the processed Blob separately and downloads that Blob through the shared helper.

## Deterministic contracts

`src/__tests__/phase6-media-contracts.test.ts` hard-gates all **44 media routes** and verifies:

- partial-selection reverse audio
- deterministic stereo → mono downmixing
- ringtone trim/fade boundaries
- dB-to-gain mapping
- loop duration planning
- square crop/resize dimensions
- mute-video export size/audio semantics
- volume-preserving video geometry
- screen-recording bitrate/size planning
- active elapsed-time calculations
- deterministic screen-recording filenames

## Production-browser media certification

The Phase 6 Chromium harness injects mocks only at browser/media boundaries:

- AudioContext / AudioBuffer
- MediaStream / MediaStreamTrack
- MediaRecorder
- video metadata, seeking and playback
- canvas 2D rendering / captureStream
- screen-capture mediaDevices

The actual Tiny Tools React workflows remain under test:

- file selection
- audio decoding flow
- transform controls
- reverse processing
- mono output allocation
- ringtone trimming
- video repeat count
- crop/resize settings
- muted output-track construction
- source gain
- screen recording start/stop/preview/download
- generated download filenames

## Route-specific browser assertions

- Reverse Audio must reverse 4,800 samples and export `sample-reversed.wav`.
- Stereo/Mono must allocate a one-channel output buffer.
- Ringtone Maker must trim from 0.02s through the end of the 0.10s fixture.
- Loop Video must play the source three times after setting repeats to three.
- Crop/Resize must capture a 480×480 output stream after choosing 480-class + 1:1.
- Mute Video must create a recorder stream with zero audio tracks.
- Video Volume must apply a source gain of 0.5 after setting the UI to 50%.
- Screen Recorder must start, stop, preview and emit a timestamped WebM download.

## Global health integration

The 351-tool health scan now requires Phase 6 execution.

A Media route only loses `TEST_FIXTURE_MISSING` when its dedicated Phase 6 fixture passes.

A failed media fixture becomes a genuine health failure.

Expected cumulative impact if Phase 5 and Phase 6 both pass:

- PASS: 322 → 341
- BLOCKED: 29 → 10
- Media: 44/44 covered
- Files: 24/24 covered

The expected ten remaining gaps would then be concentrated in PDF (5), Image (2), Design (1), Developer (1), and Text (1).

Actual CI artifacts remain authoritative.

## Commands

```bash
npm run test:phase6
npm run build
npm run build:verify
npm run browser:media
npm run browser:health
```

## Acceptance gate

Phase 6 completes when:

- all 44 media routes remain represented in the family completeness test;
- all 8 formerly blocked media workflows pass dedicated browser fixtures;
- full unit/type/build gates pass;
- the global health report consumes Phase 6 evidence;
- no Phase 3–5 or 351-route browser regression is introduced.
