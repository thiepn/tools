import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Battery,
  Camera,
  CircleDot,
  Gamepad2,
  Gauge,
  Keyboard,
  Mic,
  Monitor,
  MousePointer2,
  Music2,
  Play,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Square,
  Volume2,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { PUBLIC_DEVICE_TASKS, getPublicDeviceTask, readTinyToolsDeviceTaskId } from '../../device/publicDeviceTasks';
import {
  axisDriftMagnitude,
  decibelsFromRms,
  detectPitch,
  formatDurationSeconds,
  frequencyToNote,
  rmsFromTimeDomain,
  summarizeEventRate,
  summarizeFrameTimes,
  type EventRateResult,
  type FrameRateResult,
} from '../../utilities/device-diagnostics';

const panel = 'rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50';
const muted = 'text-xs leading-5 text-neutral-500 dark:text-neutral-400';

function CapabilityNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-[11px] leading-4 text-emerald-800 dark:text-emerald-300">
      <ShieldCheck className="h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Unsupported({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs leading-5 text-amber-900 dark:text-amber-200">{children}</div>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-neutral-900 dark:text-neutral-100 break-words">{value}</div>
    </div>
  );
}

function MicrophoneDiagnostic() {
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (contextRef.current) void contextRef.current.close();
    contextRef.current = null;
    setActive(false);
    setLevel(0);
  }, []);

  useEffect(() => stop, [stop]);

  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone capture is unavailable in this browser session. Use a current browser over HTTPS or localhost.');
      return;
    }
    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      contextRef.current = context;
      const samples = new Uint8Array(analyser.fftSize);
      setPeak(0);
      setActive(true);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        const rms = rmsFromTimeDomain(samples);
        setLevel(rms);
        setPeak((current) => Math.max(current, rms));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Microphone permission was denied or the device could not be opened.');
      stop();
    }
  };

  const db = decibelsFromRms(level);
  return (
    <div className="space-y-4">
      <CapabilityNotice>Microphone samples stay in this page. Tiny Tools does not upload or record the audio unless a separate recording tool is explicitly used.</CapabilityNotice>
      <section className={panel}>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={start} disabled={active}><Mic className="h-4 w-4" />Start microphone</button>
          <button className={secondaryButton} onClick={stop} disabled={!active}><Square className="h-4 w-4" />Stop</button>
        </div>
        {error && <div className="mt-3"><Unsupported>{error}</Unsupported></div>}
        <div className="mt-4 h-5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-label="Microphone level">
          <div className="h-full bg-emerald-500 transition-[width] duration-75" style={{ width: `${Math.min(100, level * 240)}%` }} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Live level" value={`${Math.round(level * 100)}%`} />
          <Metric label="Approx. dBFS" value={Number.isFinite(db) ? `${db.toFixed(1)} dB` : 'Silence'} />
          <Metric label="Session peak" value={`${Math.round(peak * 100)}%`} />
        </div>
      </section>
    </div>
  );
}

function WebcamDiagnostic() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [settings, setSettings] = useState<MediaTrackSettings | null>(null);
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setSettings(null);
  }, []);
  useEffect(() => stop, [stop]);

  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera capture is unavailable in this browser session. Use HTTPS or localhost in a current browser.');
      return;
    }
    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      setSettings(track?.getSettings() ?? null);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Camera permission was denied or the camera could not be opened.');
      stop();
    }
  };

  return (
    <div className="space-y-4">
      <CapabilityNotice>The camera stream is attached only to the local preview element and is stopped when you leave this tool.</CapabilityNotice>
      <section className={panel}>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={start} disabled={active}><Camera className="h-4 w-4" />Start camera</button>
          <button className={secondaryButton} onClick={stop} disabled={!active}><Square className="h-4 w-4" />Stop</button>
        </div>
        {error && <div className="mt-3"><Unsupported>{error}</Unsupported></div>}
        <video ref={videoRef} muted playsInline className="mt-4 aspect-video w-full rounded-lg bg-black object-contain" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Resolution" value={settings?.width && settings?.height ? `${settings.width} × ${settings.height}` : '—'} />
          <Metric label="Frame rate" value={settings?.frameRate ? `${settings.frameRate.toFixed(1)} fps` : '—'} />
          <Metric label="Facing" value={settings?.facingMode ?? 'Not reported'} />
          <Metric label="Device" value={settings?.deviceId ? 'Active camera selected' : 'Not reported'} />
        </div>
      </section>
    </div>
  );
}

function SpeakerDiagnostic() {
  const [frequency, setFrequency] = useState(440);
  const [volume, setVolume] = useState(0.2);
  const [error, setError] = useState('');

  const play = async (pan: -1 | 0 | 1) => {
    setError('');
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = volume;
      oscillator.connect(gain);
      if (typeof context.createStereoPanner === 'function') {
        const panner = context.createStereoPanner();
        panner.pan.value = pan;
        gain.connect(panner).connect(context.destination);
      } else {
        if (pan !== 0) setError('This browser does not expose stereo panning, so left/right isolation is unavailable.');
        gain.connect(context.destination);
      }
      oscillator.start();
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);
      oscillator.stop(context.currentTime + 0.82);
      oscillator.addEventListener('ended', () => void context.close(), { once: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audio output could not be started.');
    }
  };

  return (
    <section className={panel}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Frequency: {frequency} Hz<input className="mt-2 w-full" type="range" min="100" max="2000" step="10" value={frequency} onChange={(event) => setFrequency(Number(event.target.value))} /></label>
        <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Output level: {Math.round(volume * 100)}%<input className="mt-2 w-full" type="range" min="0.02" max="0.5" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={secondaryButton} onClick={() => void play(-1)}>Left</button>
        <button className={button} onClick={() => void play(0)}><Volume2 className="h-4 w-4" />Both</button>
        <button className={secondaryButton} onClick={() => void play(1)}>Right</button>
      </div>
      {error && <div className="mt-3"><Unsupported>{error}</Unsupported></div>}
      <p className={`mt-3 ${muted}`}>Start at a low volume. This test verifies browser audio output and stereo routing; it cannot diagnose amplifier or driver hardware beyond what you can hear.</p>
    </section>
  );
}

interface KeyEventSnapshot { key: string; code: string; type: string; repeat: boolean; location: number; time: number }

function useKeyboardEvents() {
  const [pressed, setPressed] = useState<string[]>([]);
  const [events, setEvents] = useState<KeyEventSnapshot[]>([]);
  const [maxSimultaneous, setMaxSimultaneous] = useState(0);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      setPressed((current) => {
        const next = current.includes(event.code) ? current : [...current, event.code];
        setMaxSimultaneous((max) => Math.max(max, next.length));
        return next;
      });
      setEvents((current) => [{ key: event.key, code: event.code, type: 'down', repeat: event.repeat, location: event.location, time: Date.now() }, ...current].slice(0, 18));
    };
    const up = (event: KeyboardEvent) => {
      setPressed((current) => current.filter((code) => code !== event.code));
      setEvents((current) => [{ key: event.key, code: event.code, type: 'up', repeat: event.repeat, location: event.location, time: Date.now() }, ...current].slice(0, 18));
    };
    const clear = () => setPressed([]);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);
  return { pressed, events, maxSimultaneous, resetMax: () => setMaxSimultaneous(pressed.length) };
}

function KeyboardDiagnostic({ ghosting = false }: { ghosting?: boolean }) {
  const { pressed, events, maxSimultaneous, resetMax } = useKeyboardEvents();
  return (
    <div className="space-y-4">
      <section className={panel}>
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="text-sm font-bold">{ghosting ? 'Hold key combinations' : 'Press any keys'}</h3><p className={muted}>{ghosting ? 'Try combinations across different keyboard areas. Only keys delivered to the browser can appear here.' : 'Physical `code` and interpreted `key` values are shown separately.'}</p></div>
          {ghosting && <button className={secondaryButton} onClick={resetMax}>Reset maximum</button>}
        </div>
        <div className="mt-4 min-h-24 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Held now ({pressed.length})</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {pressed.length ? pressed.map((code) => <kbd key={code} className="rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 px-2 py-1 text-xs font-semibold">{code}</kbd>) : <span className="text-xs text-neutral-400">No keys held</span>}
          </div>
        </div>
        {ghosting && <div className="mt-3 grid gap-3 sm:grid-cols-2"><Metric label="Current simultaneous keys" value={pressed.length} /><Metric label="Maximum observed" value={maxSimultaneous} /></div>}
      </section>
      {!ghosting && <section className={panel}><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-neutral-500"><tr><th className="pb-2">Event</th><th className="pb-2">Key</th><th className="pb-2">Code</th><th className="pb-2">Repeat</th><th className="pb-2">Location</th></tr></thead><tbody>{events.map((item, index) => <tr key={`${item.time}-${index}`} className="border-t border-neutral-100 dark:border-neutral-900"><td className="py-2">{item.type}</td><td>{item.key}</td><td className="font-mono">{item.code}</td><td>{item.repeat ? 'yes' : 'no'}</td><td>{item.location}</td></tr>)}</tbody></table></div></section>}
      {ghosting && <Unsupported>This is an application-level rollover test. Operating systems and browsers may transform or reserve some combinations, so it cannot certify the keyboard’s electrical matrix or advertised NKRO independently of the software stack.</Unsupported>}
    </div>
  );
}

function MouseDiagnostic() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [buttons, setButtons] = useState(0);
  const [wheel, setWheel] = useState({ x: 0, y: 0 });
  const [doubleClicks, setDoubleClicks] = useState(0);
  return (
    <section className={panel}>
      <div
        className="relative h-72 touch-none overflow-hidden rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50"
        onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top }); setButtons(event.buttons); }}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setButtons(event.buttons); }}
        onPointerUp={(event) => setButtons(event.buttons)}
        onWheel={(event) => { event.preventDefault(); setWheel({ x: event.deltaX, y: event.deltaY }); }}
        onDoubleClick={() => setDoubleClicks((value) => value + 1)}
      >
        <div className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-500 bg-blue-200/70" style={{ left: position.x, top: position.y }} />
        <div className="absolute inset-x-0 bottom-3 text-center text-xs text-neutral-500">Move, click, scroll, and double-click inside this area</div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Pointer" value={`${Math.round(position.x)}, ${Math.round(position.y)}`} />
        <Metric label="Buttons bitmask" value={buttons} />
        <Metric label="Last wheel delta" value={`${Math.round(wheel.x)}, ${Math.round(wheel.y)}`} />
        <Metric label="Double-clicks" value={doubleClicks} />
      </div>
    </section>
  );
}

const PIXEL_COLORS = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080'];

function FullscreenSurface({ mode }: { mode: 'pixel' | 'display' }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [pattern, setPattern] = useState<'gradient' | 'grayscale' | 'bars' | 'checker'>('gradient');
  const requestFullscreen = () => void surfaceRef.current?.requestFullscreen?.();
  const background = mode === 'pixel'
    ? { background: PIXEL_COLORS[index] }
    : pattern === 'gradient'
      ? { background: 'linear-gradient(90deg,#000 0%,#fff 100%)' }
      : pattern === 'grayscale'
        ? { background: 'linear-gradient(90deg,#000 0 10%,#1c1c1c 10% 20%,#383838 20% 30%,#555 30% 40%,#717171 40% 50%,#8e8e8e 50% 60%,#aaa 60% 70%,#c6c6c6 70% 80%,#e3e3e3 80% 90%,#fff 90%)' }
        : pattern === 'bars'
          ? { background: 'linear-gradient(90deg,#fff 0 14.28%,#ff0 14.28% 28.56%,#0ff 28.56% 42.84%,#0f0 42.84% 57.12%,#f0f 57.12% 71.4%,#f00 71.4% 85.68%,#00f 85.68%)' }
          : { backgroundColor: '#fff', backgroundImage: 'linear-gradient(45deg,#000 25%,transparent 25%),linear-gradient(-45deg,#000 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#000 75%),linear-gradient(-45deg,transparent 75%,#000 75%)', backgroundSize: '40px 40px', backgroundPosition: '0 0,0 20px,20px -20px,-20px 0' };
  return (
    <section className={panel}>
      <div className="mb-3 flex flex-wrap gap-2">
        {mode === 'pixel' ? PIXEL_COLORS.map((color, colorIndex) => <button key={color} onClick={() => setIndex(colorIndex)} className="h-9 w-9 rounded-lg border border-neutral-300 dark:border-neutral-700" aria-label={`Use ${color}`} style={{ background: color }} />) : (['gradient', 'grayscale', 'bars', 'checker'] as const).map((value) => <button key={value} className={pattern === value ? button : secondaryButton} onClick={() => setPattern(value)}>{value}</button>)}
        <button className={secondaryButton} onClick={requestFullscreen}><Monitor className="h-4 w-4" />Fullscreen</button>
      </div>
      <div ref={surfaceRef} className="aspect-video w-full cursor-pointer rounded-lg border border-neutral-300 dark:border-neutral-700" style={background} onClick={() => mode === 'pixel' && setIndex((value) => (value + 1) % PIXEL_COLORS.length)} />
      <p className={`mt-3 ${muted}`}>{mode === 'pixel' ? 'Inspect the entire panel from a normal viewing distance, then closer. Click the surface to cycle solid colors.' : 'Fullscreen patterns can reveal banding, clipping, uneven backlight, scaling artifacts, or contrast problems. Results are visual rather than automatically scored.'}</p>
    </section>
  );
}

function RefreshRateDiagnostic() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FrameRateResult | null>(null);
  const rafRef = useRef<number | null>(null);
  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);
  const measure = () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    const timestamps: number[] = [];
    const tick = (time: number) => {
      timestamps.push(time);
      if (timestamps.length >= 181) {
        setResult(summarizeFrameTimes(timestamps));
        setRunning(false);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  return (
    <section className={panel}>
      <button className={button} onClick={measure} disabled={running}><RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />{running ? 'Measuring…' : 'Measure refresh rate'}</button>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Estimated refresh" value={result ? `${result.hz.toFixed(1)} Hz` : '—'} /><Metric label="Median frame time" value={result ? `${result.frameTimeMs.toFixed(2)} ms` : '—'} /><Metric label="Timing jitter" value={result ? `${result.jitterMs.toFixed(2)} ms` : '—'} /></div>
      <p className={`mt-3 ${muted}`}>This measures `requestAnimationFrame` cadence visible to the browser. Power saving, background throttling, variable refresh rate, compositor behavior, and browser scheduling can affect the result.</p>
    </section>
  );
}

function DeviceInfoDiagnostic() {
  const info = useMemo(() => {
    if (typeof window === 'undefined') return [] as Array<[string, string]>;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const orientation = screen.orientation?.type ?? 'Not reported';
    return [
      ['Screen size', `${screen.width} × ${screen.height} CSS px`],
      ['Available screen', `${screen.availWidth} × ${screen.availHeight} CSS px`],
      ['Viewport', `${window.innerWidth} × ${window.innerHeight} CSS px`],
      ['Device pixel ratio', String(window.devicePixelRatio || 1)],
      ['Estimated physical pixels', `${Math.round(screen.width * window.devicePixelRatio)} × ${Math.round(screen.height * window.devicePixelRatio)}`],
      ['Color depth', `${screen.colorDepth} bit`],
      ['Pixel depth', `${screen.pixelDepth} bit`],
      ['Orientation', orientation],
      ['Logical CPU threads', navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : 'Not reported'],
      ['Device memory hint', nav.deviceMemory ? `${nav.deviceMemory} GB` : 'Not reported'],
      ['Touch points', String(navigator.maxTouchPoints ?? 0)],
      ['Platform hint', navigator.platform || 'Not reported'],
    ];
  }, []);
  return <div className="space-y-4"><CapabilityNotice>These values are read from browser APIs and displayed locally. Browsers intentionally reduce or omit some hardware detail for privacy.</CapabilityNotice><section className={panel}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{info.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div></section></div>;
}

interface TouchPoint { id: number; x: number; y: number; pressure: number; pointerType: string }
function TouchscreenDiagnostic() {
  const [points, setPoints] = useState<TouchPoint[]>([]);
  const update = (event: React.PointerEvent<HTMLDivElement>, remove = false) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPoints((current) => {
      const filtered = current.filter((point) => point.id !== event.pointerId);
      if (remove) return filtered;
      return [...filtered, { id: event.pointerId, x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100, pressure: event.pressure, pointerType: event.pointerType }];
    });
  };
  return (
    <section className={panel}>
      <div className="relative h-96 touch-none overflow-hidden rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); update(event); }} onPointerMove={(event) => { if (event.buttons || event.pointerType === 'touch') update(event); }} onPointerUp={(event) => update(event, true)} onPointerCancel={(event) => update(event, true)}>
        {points.map((point) => <div key={point.id} className="absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-300/30 text-[10px] font-bold text-blue-900" style={{ left: `${point.x}%`, top: `${point.y}%`, transform: `translate(-50%,-50%) scale(${0.75 + Math.max(0, point.pressure) * 0.5})` }}>{point.id}</div>)}
        <div className="absolute inset-x-0 bottom-3 text-center text-xs text-neutral-500">Touch with one or more fingers</div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric label="Active contacts" value={points.length} /><Metric label="Browser max touch points" value={navigator.maxTouchPoints ?? 0} /></div>
    </section>
  );
}

interface GamepadSnapshot { id: string; index: number; connected: boolean; mapping: string; axes: number[]; buttons: Array<{ pressed: boolean; value: number }> }
function GamepadDiagnostic() {
  const [pads, setPads] = useState<GamepadSnapshot[]>([]);
  const [maxDrift, setMaxDrift] = useState(0);
  useEffect(() => {
    if (!navigator.getGamepads) return;
    let raf = 0;
    let lastPublish = 0;
    const tick = (time: number) => {
      if (time - lastPublish > 80) {
        const next = Array.from(navigator.getGamepads()).filter((pad): pad is Gamepad => Boolean(pad)).map((pad) => ({ id: pad.id, index: pad.index, connected: pad.connected, mapping: pad.mapping, axes: [...pad.axes], buttons: pad.buttons.map((item) => ({ pressed: item.pressed, value: item.value })) }));
        setPads(next);
        const drift = next.reduce((max, pad) => Math.max(max, axisDriftMagnitude(pad.axes)), 0);
        setMaxDrift((current) => Math.max(current, drift));
        lastPublish = time;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!navigator.getGamepads) return <Unsupported>The Gamepad API is unavailable in this browser.</Unsupported>;
  const pad = pads[0];
  return (
    <div className="space-y-4">
      <section className={panel}>
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">{pad ? pad.id : 'No gamepad detected'}</h3><p className={muted}>Connect a controller and press a button if the browser requires user activation before exposing it.</p></div><button className={secondaryButton} onClick={() => setMaxDrift(0)}>Reset drift peak</button></div>
        {pad && <><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Axes" value={pad.axes.length} /><Metric label="Buttons" value={pad.buttons.length} /><Metric label="Observed max |axis|" value={maxDrift.toFixed(4)} /></div><div className="mt-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Axes</div><div className="mt-2 grid gap-2 sm:grid-cols-2">{pad.axes.map((value, index) => <div key={index} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2 text-xs"><div className="flex justify-between"><span>Axis {index}</span><strong>{value.toFixed(4)}</strong></div><div className="mt-1 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"><div className="h-full bg-blue-500" style={{ width: `${Math.abs(value) * 100}%` }} /></div></div>)}</div></div><div className="mt-4 flex flex-wrap gap-2">{pad.buttons.map((item, index) => <span key={index} className={`rounded border px-2 py-1 text-[10px] font-semibold ${item.pressed || item.value > 0.1 ? 'border-emerald-500 bg-emerald-100 dark:bg-emerald-950' : 'border-neutral-300 dark:border-neutral-700'}`}>B{index}: {item.value.toFixed(2)}</span>)}</div></>}
      </section>
      <Unsupported>Stick-drift values are browser-reported normalized axes, not a calibration certificate. Keep the sticks untouched after connecting, and compare the resting values with the controller manufacturer’s expected deadzone.</Unsupported>
    </div>
  );
}

function PollingRateDiagnostic() {
  const timestampsRef = useRef<number[]>([]);
  const [result, setResult] = useState<EventRateResult | null>(null);
  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const list = timestampsRef.current;
    list.push(event.timeStamp);
    if (list.length > 400) list.splice(0, list.length - 400);
    if (list.length % 12 === 0) setResult(summarizeEventRate(list));
  };
  return (
    <div className="space-y-4">
      <section className={panel}>
        <div className="h-72 touch-none rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 flex items-center justify-center text-sm font-semibold text-neutral-500" onPointerMove={onMove}>Move the pointer rapidly here</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Browser event rate" value={result ? `${Math.round(result.hz)} Hz` : '—'} /><Metric label="Median interval" value={result ? `${result.intervalMs.toFixed(2)} ms` : '—'} /><Metric label="Timing jitter" value={result ? `${result.jitterMs.toFixed(2)} ms` : '—'} /></div>
        <button className={`${secondaryButton} mt-3`} onClick={() => { timestampsRef.current = []; setResult(null); }}>Reset samples</button>
      </section>
      <Unsupported>Browsers may coalesce, throttle, resample, or align pointer events with display frames. This measures the event stream delivered to this page and must not be interpreted as a direct USB HID polling-rate measurement.</Unsupported>
    </div>
  );
}

interface BatteryManagerLike extends EventTarget { charging: boolean; chargingTime: number; dischargingTime: number; level: number }
type NavigatorWithBattery = Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
function BatteryDiagnostic() {
  const [battery, setBattery] = useState<{ charging: boolean; chargingTime: number; dischargingTime: number; level: number } | null>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const nav = navigator as NavigatorWithBattery;
    if (!nav.getBattery) { setSupported(false); return; }
    let manager: BatteryManagerLike | null = null;
    let cancelled = false;
    const publish = () => manager && !cancelled && setBattery({ charging: manager.charging, chargingTime: manager.chargingTime, dischargingTime: manager.dischargingTime, level: manager.level });
    void nav.getBattery().then((value) => { manager = value; publish(); ['chargingchange', 'chargingtimechange', 'dischargingtimechange', 'levelchange'].forEach((name) => manager?.addEventListener(name, publish)); }).catch(() => setSupported(false));
    return () => { cancelled = true; if (manager) ['chargingchange', 'chargingtimechange', 'dischargingtimechange', 'levelchange'].forEach((name) => manager?.removeEventListener(name, publish)); };
  }, []);
  if (!supported) return <Unsupported>This browser does not expose the Battery Status API. Tiny Tools will not infer battery health from unrelated signals.</Unsupported>;
  return <div className="space-y-4"><section className={panel}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Level" value={battery ? `${Math.round(battery.level * 100)}%` : 'Reading…'} /><Metric label="Charging" value={battery ? (battery.charging ? 'Yes' : 'No') : '—'} /><Metric label="Time to full" value={battery ? formatDurationSeconds(battery.chargingTime) : '—'} /><Metric label="Time remaining" value={battery ? formatDurationSeconds(battery.dischargingTime) : '—'} /></div></section><Unsupported>The web Battery Status API does not expose cycle count, design capacity, wear percentage, temperature, or true battery health. Those values are intentionally not invented here.</Unsupported></div>;
}

function ToneGeneratorDiagnostic() {
  const [frequency, setFrequency] = useState(440);
  const [volume, setVolume] = useState(0.12);
  const [waveform, setWaveform] = useState<OscillatorType>('sine');
  const [active, setActive] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const stop = useCallback(() => {
    try { oscillatorRef.current?.stop(); } catch {}
    oscillatorRef.current = null;
    if (contextRef.current) void contextRef.current.close();
    contextRef.current = null;
    gainRef.current = null;
    setActive(false);
  }, []);
  useEffect(() => stop, [stop]);
  useEffect(() => { if (oscillatorRef.current) oscillatorRef.current.frequency.setTargetAtTime(frequency, contextRef.current?.currentTime ?? 0, 0.01); }, [frequency]);
  useEffect(() => { if (gainRef.current) gainRef.current.gain.setTargetAtTime(volume, contextRef.current?.currentTime ?? 0, 0.01); }, [volume]);
  useEffect(() => { if (oscillatorRef.current) oscillatorRef.current.type = waveform; }, [waveform]);
  const start = () => {
    if (active) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = waveform;
    gain.gain.value = volume;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    contextRef.current = context;
    oscillatorRef.current = oscillator;
    gainRef.current = gain;
    setActive(true);
  };
  return (
    <section className={panel}>
      <div className="grid gap-4 sm:grid-cols-3"><label className="text-xs font-semibold">Frequency<input className="mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-2" type="number" min="20" max="20000" value={frequency} onChange={(event) => setFrequency(Math.min(20000, Math.max(20, Number(event.target.value) || 20)))} /></label><label className="text-xs font-semibold">Waveform<select className="mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-2" value={waveform} onChange={(event) => setWaveform(event.target.value as OscillatorType)}><option value="sine">Sine</option><option value="square">Square</option><option value="triangle">Triangle</option><option value="sawtooth">Sawtooth</option></select></label><label className="text-xs font-semibold">Level: {Math.round(volume * 100)}%<input className="mt-3 w-full" type="range" min="0.01" max="0.4" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label></div>
      <div className="mt-4 flex gap-2"><button className={button} onClick={start} disabled={active}><Play className="h-4 w-4" />Start tone</button><button className={secondaryButton} onClick={stop} disabled={!active}><Square className="h-4 w-4" />Stop</button></div>
      <p className={`mt-3 ${muted}`}>Keep the output level low, especially with headphones and high frequencies. Browser and hardware frequency response may differ from the requested oscillator frequency.</p>
    </section>
  );
}

function TunerDiagnostic() {
  const [active, setActive] = useState(false);
  const [pitch, setPitch] = useState<{ frequency: number; clarity: number; note: string; cents: number } | null>(null);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (contextRef.current) void contextRef.current.close();
    contextRef.current = null;
    setActive(false);
  }, []);
  useEffect(() => stop, [stop]);
  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setError('Microphone capture is unavailable in this browser session.'); return; }
    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      context.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      contextRef.current = context;
      const samples = new Float32Array(analyser.fftSize);
      let lastPublish = 0;
      setActive(true);
      const tick = (time: number) => {
        if (time - lastPublish > 90) {
          analyser.getFloatTimeDomainData(samples);
          const detected = detectPitch(samples, context.sampleRate);
          if (detected) {
            const note = frequencyToNote(detected.frequency);
            if (note) setPitch({ frequency: detected.frequency, clarity: detected.clarity, note: `${note.note}${note.octave}`, cents: note.cents });
          } else setPitch(null);
          lastPublish = time;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Microphone could not be opened.');
      stop();
    }
  };
  const cents = pitch?.cents ?? 0;
  return (
    <div className="space-y-4"><CapabilityNotice>Pitch estimation runs from microphone samples in memory. No tuner audio is uploaded or saved.</CapabilityNotice><section className={panel}><div className="flex gap-2"><button className={button} onClick={start} disabled={active}><Mic className="h-4 w-4" />Start tuner</button><button className={secondaryButton} onClick={stop} disabled={!active}><Square className="h-4 w-4" />Stop</button></div>{error && <div className="mt-3"><Unsupported>{error}</Unsupported></div>}<div className="mt-6 text-center"><div className="text-6xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">{pitch?.note ?? '—'}</div><div className="mt-2 text-sm font-semibold text-neutral-500">{pitch ? `${pitch.frequency.toFixed(2)} Hz · ${cents >= 0 ? '+' : ''}${cents.toFixed(1)} cents · ${Math.round(pitch.clarity * 100)}% confidence` : active ? 'Play a steady note' : 'Microphone stopped'}</div><div className="relative mx-auto mt-5 h-3 max-w-lg rounded-full bg-gradient-to-r from-amber-400 via-emerald-500 to-amber-400"><div className="absolute top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-neutral-900 dark:bg-white" style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%` }} /></div><div className="mx-auto mt-2 flex max-w-lg justify-between text-[10px] text-neutral-500"><span>-50¢</span><span>in tune</span><span>+50¢</span></div></div></section></div>
  );
}

function renderDiagnostic(taskId: string) {
  switch (taskId) {
    case 'microphone-test': return <MicrophoneDiagnostic />;
    case 'webcam-test': return <WebcamDiagnostic />;
    case 'speaker-test': return <SpeakerDiagnostic />;
    case 'keyboard-test': return <KeyboardDiagnostic />;
    case 'mouse-test': return <MouseDiagnostic />;
    case 'dead-pixel-test': return <FullscreenSurface mode="pixel" />;
    case 'display-test': return <FullscreenSurface mode="display" />;
    case 'refresh-rate-test': return <RefreshRateDiagnostic />;
    case 'device-info': return <DeviceInfoDiagnostic />;
    case 'touchscreen-test': return <TouchscreenDiagnostic />;
    case 'gamepad-test': return <GamepadDiagnostic />;
    case 'polling-rate-test': return <PollingRateDiagnostic />;
    case 'keyboard-ghosting-test': return <KeyboardDiagnostic ghosting />;
    case 'battery-status': return <BatteryDiagnostic />;
    case 'tone-generator': return <ToneGeneratorDiagnostic />;
    case 'instrument-tuner': return <TunerDiagnostic />;
    default: return <Unsupported>Unknown diagnostic route.</Unsupported>;
  }
}

const TASK_ICON: Record<string, React.ReactNode> = {
  'microphone-test': <Mic className="h-5 w-5" />, 'webcam-test': <Camera className="h-5 w-5" />, 'speaker-test': <Volume2 className="h-5 w-5" />, 'keyboard-test': <Keyboard className="h-5 w-5" />, 'mouse-test': <MousePointer2 className="h-5 w-5" />, 'dead-pixel-test': <CircleDot className="h-5 w-5" />, 'display-test': <Monitor className="h-5 w-5" />, 'refresh-rate-test': <RefreshCw className="h-5 w-5" />, 'device-info': <Smartphone className="h-5 w-5" />, 'touchscreen-test': <Activity className="h-5 w-5" />, 'gamepad-test': <Gamepad2 className="h-5 w-5" />, 'polling-rate-test': <Gauge className="h-5 w-5" />, 'keyboard-ghosting-test': <Keyboard className="h-5 w-5" />, 'battery-status': <Battery className="h-5 w-5" />, 'tone-generator': <Volume2 className="h-5 w-5" />, 'instrument-tuner': <Music2 className="h-5 w-5" />,
};

export const DeviceDiagnosticsTool: React.FC = () => {
  const task = useMemo(() => {
    const id = typeof window !== 'undefined' ? readTinyToolsDeviceTaskId(window.location.hash) : null;
    return getPublicDeviceTask(id) ?? PUBLIC_DEVICE_TASKS[0];
  }, []);
  return (
    <ToolShell toolId={task.id} title={task.name} description={task.description} category="device" relatedToolIds={['audio-recorder', 'screen-recorder', 'metronome']}>
      <div className="space-y-4">
        <section className="rounded-xl border border-blue-200 dark:border-blue-900/70 bg-blue-50/60 dark:bg-blue-950/20 p-4">
          <div className="flex gap-3"><div className="mt-0.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-white dark:bg-neutral-950 p-2 text-blue-600 shrink-0">{TASK_ICON[task.id] ?? <Monitor className="h-5 w-5" />}</div><div><h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Native browser diagnostic</h2><p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">This test uses browser-exposed hardware or timing APIs directly. Results describe what this browser session can observe; Tiny Tools does not claim access to hidden firmware, USB-controller telemetry, or operating-system diagnostics.</p></div></div>
        </section>
        {renderDiagnostic(task.id)}
      </div>
    </ToolShell>
  );
};

export default DeviceDiagnosticsTool;
