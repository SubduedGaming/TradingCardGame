/**
 * Sound effects synthesised with the Web Audio API, so the game ships no audio files.
 * The audio context starts on the first click or key press, as browsers require.
 */
type Effect = 'deploy' | 'construct' | 'order' | 'attack' | 'hit' | 'hqHit' | 'destroy' | 'tenacity' | 'turn' | 'draw' | 'win' | 'lose' | 'click' | 'coin' | 'pack';

const MUTE_KEY = 'frontline.muted';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* storage unavailable: sound stays on */
}

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(c: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), at + dur);
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(c: AudioContext, at: number, dur: number, vol: number, lowpass: number): void {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master!);
  src.start(at);
}

const RECIPES: Record<Effect, (c: AudioContext, t: number) => void> = {
  deploy: (c, t) => { tone(c, t, 140, 0.18, 'triangle', 0.5, 70); noise(c, t, 0.08, 0.15, 800); },
  construct: (c, t) => { tone(c, t, 220, 0.1, 'square', 0.18, 110); tone(c, t + 0.1, 330, 0.12, 'square', 0.15, 165); },
  order: (c, t) => { noise(c, t, 0.3, 0.2, 3000); tone(c, t, 500, 0.3, 'sawtooth', 0.08, 900); },
  attack: (c, t) => { noise(c, t, 0.12, 0.22, 2500); tone(c, t, 300, 0.12, 'sawtooth', 0.1, 120); },
  hit: (c, t) => { noise(c, t, 0.14, 0.35, 1500); tone(c, t, 160, 0.14, 'sine', 0.4, 60); },
  hqHit: (c, t) => { noise(c, t, 0.4, 0.5, 600); tone(c, t, 90, 0.4, 'sine', 0.6, 35); },
  destroy: (c, t) => { noise(c, t, 0.5, 0.5, 900); tone(c, t, 110, 0.5, 'sawtooth', 0.25, 30); },
  tenacity: (c, t) => { tone(c, t, 660, 0.25, 'sine', 0.25); tone(c, t + 0.08, 990, 0.25, 'sine', 0.18); },
  turn: (c, t) => { tone(c, t, 523, 0.18, 'sine', 0.22); tone(c, t + 0.12, 784, 0.25, 'sine', 0.22); },
  draw: (c, t) => { noise(c, t, 0.06, 0.12, 6000); },
  win: (c, t) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.14, f, 0.4, 'triangle', 0.3)); },
  lose: (c, t) => { [392, 349, 311, 262].forEach((f, i) => tone(c, t + i * 0.2, f, 0.5, 'triangle', 0.3)); },
  click: (c, t) => { tone(c, t, 700, 0.04, 'square', 0.08); },
  coin: (c, t) => { tone(c, t, 988, 0.08, 'square', 0.15); tone(c, t + 0.07, 1319, 0.25, 'square', 0.15); },
  pack: (c, t) => { noise(c, t, 0.35, 0.3, 5000); [440, 554, 659, 880].forEach((f, i) => tone(c, t + 0.15 + i * 0.07, f, 0.3, 'triangle', 0.2)); },
};

export const sound = {
  get muted(): boolean {
    return muted;
  },
  setMuted(value: boolean): void {
    muted = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  },
  /** Plays an effect now, or after `delayMs`. */
  play(effect: Effect, delayMs = 0): void {
    if (muted) return;
    const c = context();
    if (!c) return;
    RECIPES[effect](c, c.currentTime + delayMs / 1000);
  },
};

// Unlock audio on the first interaction.
if (typeof window !== 'undefined') {
  const unlock = () => {
    context();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}
