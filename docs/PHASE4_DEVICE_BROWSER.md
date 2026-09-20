# Phase 4 — Device & Browser Diagnostics Functional Certification

Phase 3 completed successfully across all focused and global gates.

The latest strengthened health matrix before Phase 4 contains:

- 351 total routes
- 300 PASS
- 0 BROKEN
- 51 BLOCKED
- 0 FLAKY

The largest blocked family is **device**:

- 25 total device routes
- 3 generic-smoke PASS
- 22 TEST_FIXTURE_MISSING / BLOCKED

Phase 4 replaces those generic gaps with route-specific production-browser fixtures.

## Scope

### P2 device diagnostics — 16 routes

- microphone
- webcam
- speaker/headphone
- keyboard
- mouse
- dead pixel
- display patterns
- refresh rate
- device info
- touchscreen
- gamepad
- pointer event rate
- keyboard rollover/ghosting
- battery
- tone generator
- instrument tuner

### P19 browser/network diagnostics — 9 routes

- Internet speed
- connection stability
- IPv4/IPv6
- WebRTC leak inspection
- browser capabilities
- WebGL
- WebGPU
- codec support
- storage/quota

Total: **25/25 device routes**.

## Browser fixture strategy

The certification runs against the production Vite build in headless Chromium.

Where physical hardware or external services would make CI nondeterministic, Phase 4 injects mocks only at the browser API boundary and then exercises the actual Tiny Tools UI:

- getUserMedia / AudioContext
- Gamepad API
- Battery Status API
- requestAnimationFrame timing
- pointer and keyboard events
- Cloudflare-facing fetch calls
- RTCPeerConnection ICE gathering
- WebGL context
- WebGPU adapter
- media codec probes
- StorageManager

The product components, event handlers, formatting, result rendering and state transitions are not mocked.

## Global health integration

`scripts/phase1-tool-health.mjs` now runs Phase 4 device certification as part of the health scan.

A device route only loses `TEST_FIXTURE_MISSING` when its dedicated Phase 4 fixture passes.

If a fixture fails, the route becomes a real health failure rather than being hidden.

Expected successful impact from the pre-Phase-4 baseline:

- PASS: 300 → approximately 322
- BLOCKED: 51 → approximately 29
- device family: 25/25 functionally covered

Actual post-CI numbers are authoritative.

## Product defects repaired

### Tone Generator unsupported Web Audio

Before, `new AudioContext()` was unguarded and could throw from the button handler.

After:
- explicit Web Audio availability check
- visible unsupported state
- try/catch around context setup
- safe cleanup

### Battery Infinity semantics

The `Infinity -> Not applicable` branch was unreachable because the generic non-finite check ran first.

After:
- positive Infinity maps to `Not applicable`
- NaN and invalid/negative values remain `Unknown`

### Malformed dotted ICE addresses

A string matching the dotted-quad shape could be classified as public IPv4 even when an octet exceeded 255.

After:
- IPv4 literals are validated numerically before family/scope classification
- malformed dotted addresses remain `unknown`

## Commands

```bash
npm run test:phase4
npm run build
npm run build:verify
npm run browser:device
npm run browser:health
```

## Acceptance gate

Phase 4 is complete when:

- 25/25 device routes have a dedicated production-browser fixture;
- all Phase 4 deterministic utility contracts pass;
- the three repaired regressions pass;
- 25/25 device browser fixtures pass;
- full unit/type/build gates pass;
- the global health report consumes Phase 4 evidence;
- no existing 351-route browser regression is introduced.
