/**
 * 游戏音效（Web Audio + 语音）
 * 需在用户交互后首次调用才会生效（浏览器策略）
 */

let ctx: AudioContext | null = null;
let soundEnabled = true;
const activeTones = new Set<OscillatorNode>();
const previewTones = new Set<OscillatorNode>();

function getContext(): AudioContext | null {
  if (!ctx) {
    const Ctor = typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (Ctor) ctx = new Ctor();
  }
  return ctx;
}

function playTone(
  freq: number,
  type: OscillatorType,
  duration: number,
  vol = 0.1,
  delay = 0,
  tones = activeTones,
): void {
  if ((!soundEnabled && tones === activeTones) || typeof window === 'undefined' || vol <= 0) return;
  try {
    const context = getContext();
    if (!context) return;
    if (context.state === 'suspended') context.resume();
    const startsAt = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startsAt);
    gain.gain.setValueAtTime(vol, startsAt);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.01, vol), startsAt + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(startsAt);
    tones.add(osc);
    osc.addEventListener('ended', () => tones.delete(osc), { once: true });
    osc.stop(startsAt + duration);
  } catch {
    // ignore
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (soundEnabled === enabled) return;
  soundEnabled = enabled;
  if (enabled) return;
  cancelSpeak();
  for (const tone of activeTones) tone.stop();
  activeTones.clear();
}

export function initSound(): void {
  if (typeof window === 'undefined') return;
  getContext();
}

export function playMove(volume = 1): void {
  if (volume <= 0) return;
  playTone(300, 'sine', 0.15, 0.2 * volume);
  playTone(100, 'square', 0.2, 0.1 * volume, 0.1);
}

export function playCollect(): void {
  playTone(880, 'sine', 0.08, 0.2);
}

function playVictoryTones(volume: number, tones: Set<OscillatorNode>): void {
  const freqs = [523.25, 659.25, 783.99, 1046.5];
  freqs.forEach((freq, index) => playTone(freq, 'triangle', 0.4, 0.2 * volume, index * 0.15, tones));
}

export function playVictory(volume = 1): void {
  playVictoryTones(volume, activeTones);
}

export function stopVolumePreview(): void {
  for (const tone of previewTones) tone.stop();
  previewTones.clear();
}

export function previewVolume(volume: number): void {
  stopVolumePreview();
  playVictoryTones(volume, previewTones);
}

export function playBurn(): void {
  speak('You are cooked');
  playTone(100, 'sawtooth', 0.5, 0.2);
}

export function speak(text: string): void {
  if (!soundEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'en-US';
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => /^en[-_]US$/i.test(voice.lang))
      ?? voices.find(voice => /^en(?:[-_]|$)/i.test(voice.lang));
    if (englishVoice) msg.voice = englishVoice;
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
