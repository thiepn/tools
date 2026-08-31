let timerAudioContext: AudioContext | null = null;

function getTimerAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!timerAudioContext || timerAudioContext.state === 'closed') timerAudioContext = new AudioContextClass();
    return timerAudioContext;
  } catch { return null; }
}

/** Call from a user gesture (Start/Resume) so later timer chimes are not blocked by autoplay policy. */
export function primeTimerAudio(): void {
  const ctx = getTimerAudioContext();
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
}

export function playChimeSound(): void {
  try {
    const ctx = getTimerAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const now = ctx.currentTime + 0.01;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + index * 0.12;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(start); osc.stop(start + 0.65);
    });
  } catch (error) {
    console.warn('Audio playback not allowed or failed:', error);
  }
}
