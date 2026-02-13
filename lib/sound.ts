/**
 * 游戏音效（Web Audio + 语音）
 * 需在用户交互后首次调用才会生效（浏览器策略）
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    const Ctor = typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (Ctor) ctx = new Ctor();
  }
  return ctx!;
}

function playTone(
  freq: number,
  type: OscillatorType,
  duration: number,
  vol = 0.1
): void {
  if (typeof window === 'undefined') return;
  try {
    const context = getContext();
    if (!context) return;
    if (context.state === 'suspended') context.resume();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, context.currentTime);
    gain.gain.setValueAtTime(vol, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(context.currentTime);
    osc.stop(context.currentTime + duration);
  } catch {
    // ignore
  }
}

export function initSound(): void {
  if (typeof window === 'undefined') return;
  getContext();
}

export function playMove(): void {
  playTone(300, 'sine', 0.15, 0.2);
  setTimeout(() => playTone(100, 'square', 0.2, 0.1), 100);
}

export function playCollect(): void {
  playTone(880, 'sine', 0.08, 0.2);
}

export function playVictory(): void {
  if (typeof window === 'undefined') return;
  try {
    const context = getContext();
    if (!context) return;
    if (context.state === 'suspended') context.resume();
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 'triangle', 0.4, 0.2), i * 150);
    });
  } catch {
    // ignore
  }
}

export function playBurn(): void {
  speak('You are cooked');
  playTone(100, 'sawtooth', 0.5, 0.2);
}

export function speak(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.rate = 1.2;
    msg.pitch = 1.0;
    window.speechSynthesis.speak(msg);
  } catch {
    // ignore
  }
}

export function cancelSpeak(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
}
