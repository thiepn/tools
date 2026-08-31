export interface PublicDeviceTask {
  id: string;
  name: string;
  shortName: string;
  description: string;
  keywords: string[];
  featured: boolean;
}

export const PUBLIC_DEVICE_TASKS: PublicDeviceTask[] = [
  {
    id: 'microphone-test',
    name: 'Microphone Test',
    shortName: 'Microphone Test',
    description: 'Test microphone permission, live input level, peak level, and audio activity locally in your browser.',
    keywords: ['microphone test', 'mic test', 'test microphone', 'audio input', 'mic level', 'microphone volume'],
    featured: true,
  },
  {
    id: 'webcam-test',
    name: 'Webcam Test',
    shortName: 'Webcam Test',
    description: 'Preview your camera locally and inspect the resolution, frame rate, facing mode, and active video track settings.',
    keywords: ['webcam test', 'camera test', 'test webcam', 'test camera', 'video camera', 'camera resolution'],
    featured: true,
  },
  {
    id: 'speaker-test',
    name: 'Speaker & Headphone Test',
    shortName: 'Speaker Test',
    description: 'Play local test tones through both channels or isolate left and right audio for speaker and headphone checks.',
    keywords: ['speaker test', 'headphone test', 'left right audio test', 'stereo test', 'sound test', 'audio output test'],
    featured: true,
  },
  {
    id: 'keyboard-test',
    name: 'Keyboard Tester',
    shortName: 'Keyboard Test',
    description: 'See keydown and keyup events, physical key codes, repeat state, key location, and currently held keys.',
    keywords: ['keyboard test', 'key tester', 'test keys', 'broken key', 'keydown', 'keycode', 'keyboard checker'],
    featured: true,
  },
  {
    id: 'mouse-test',
    name: 'Mouse Tester',
    shortName: 'Mouse Test',
    description: 'Check pointer movement, mouse buttons, wheel direction, double-clicks, coordinates, and browser pointer events.',
    keywords: ['mouse test', 'mouse button test', 'scroll wheel test', 'double click test', 'pointer test', 'mouse checker'],
    featured: true,
  },
  {
    id: 'dead-pixel-test',
    name: 'Dead Pixel Test',
    shortName: 'Dead Pixel Test',
    description: 'Fill the display with solid diagnostic colors to inspect for dead, stuck, bright, or discolored pixels.',
    keywords: ['dead pixel test', 'stuck pixel test', 'screen pixel test', 'monitor pixel test', 'dead pixels', 'screen color test'],
    featured: true,
  },
  {
    id: 'display-test',
    name: 'Display Test Patterns',
    shortName: 'Display Test',
    description: 'Inspect gradients, grayscale steps, color bars, contrast, checkerboards, and other fullscreen display patterns.',
    keywords: ['display test', 'monitor test', 'screen test', 'gradient test', 'grayscale test', 'contrast test', 'color bars'],
    featured: false,
  },
  {
    id: 'refresh-rate-test',
    name: 'Refresh Rate Test',
    shortName: 'Refresh Rate',
    description: 'Estimate the browser-visible display refresh rate from animation-frame timing and report frame-time stability.',
    keywords: ['refresh rate test', 'hz test', 'monitor hz', 'screen refresh rate', 'fps display test', '144hz test', '240hz test'],
    featured: true,
  },
  {
    id: 'device-info',
    name: 'Screen & Device Info',
    shortName: 'Device Info',
    description: 'Inspect browser-exposed display dimensions, pixel ratio, color depth, orientation, CPU concurrency, and memory hints.',
    keywords: ['device info', 'screen info', 'display resolution', 'pixel ratio', 'color depth', 'hardware concurrency', 'device memory'],
    featured: false,
  },
  {
    id: 'touchscreen-test',
    name: 'Touchscreen Tester',
    shortName: 'Touch Test',
    description: 'Visualize simultaneous touch or pointer contacts and verify multi-touch movement, pressure, and contact tracking.',
    keywords: ['touchscreen test', 'touch test', 'multi touch test', 'touch points', 'screen touch checker', 'pointer pressure'],
    featured: false,
  },
  {
    id: 'gamepad-test',
    name: 'Gamepad & Stick Drift Test',
    shortName: 'Gamepad Test',
    description: 'Inspect connected gamepad buttons and axes in real time and measure observed resting analog-stick drift.',
    keywords: ['gamepad test', 'controller test', 'stick drift test', 'joystick test', 'controller buttons', 'gamepad axes'],
    featured: true,
  },
  {
    id: 'polling-rate-test',
    name: 'Pointer Event Rate Test',
    shortName: 'Polling Test',
    description: 'Measure browser-delivered pointer-event frequency and timing while moving the mouse; this is not a raw USB polling-rate claim.',
    keywords: ['mouse polling rate test', 'polling rate', 'pointer event rate', 'mouse hz test', 'event frequency', 'mouse response rate'],
    featured: false,
  },
  {
    id: 'keyboard-ghosting-test',
    name: 'Keyboard Ghosting & NKRO Test',
    shortName: 'Ghosting Test',
    description: 'Track simultaneous key combinations and the maximum keys your browser receives while you test rollover and ghosting behavior.',
    keywords: ['keyboard ghosting test', 'nkro test', 'n key rollover', 'key rollover test', 'simultaneous keys', 'keyboard matrix test'],
    featured: false,
  },
  {
    id: 'battery-status',
    name: 'Battery Status',
    shortName: 'Battery Status',
    description: 'Show charging state, reported level, and time estimates when the browser exposes the Battery Status API.',
    keywords: ['battery status', 'battery level', 'charging status', 'battery api', 'battery percentage', 'charging time'],
    featured: false,
  },
  {
    id: 'tone-generator',
    name: 'Tone Generator',
    shortName: 'Tone Generator',
    description: 'Generate local sine, square, sawtooth, or triangle tones with adjustable frequency and output level.',
    keywords: ['tone generator', 'frequency generator', 'sine wave generator', 'audio tone', 'hz generator', 'test tone'],
    featured: false,
  },
  {
    id: 'instrument-tuner',
    name: 'Instrument Tuner',
    shortName: 'Tuner',
    description: 'Use your microphone locally to estimate pitch, musical note, tuning cents, and signal confidence.',
    keywords: ['instrument tuner', 'guitar tuner', 'chromatic tuner', 'pitch detector', 'tune instrument', 'frequency tuner'],
    featured: true,
  },
];

export function getPublicDeviceTask(id: string | null | undefined): PublicDeviceTask | undefined {
  return id ? PUBLIC_DEVICE_TASKS.find((task) => task.id === id) : undefined;
}

export function readTinyToolsDeviceTaskId(hash: string): string | null {
  const clean = hash.replace(/^#\/?/, '').split('?')[0];
  if (!clean) return null;
  if (clean.startsWith('tool/')) return clean.slice('tool/'.length).split('/')[0] || null;
  return clean.split('/')[0] || null;
}
