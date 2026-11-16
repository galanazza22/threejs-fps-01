// Emberline — procedural sound effects. No audio assets: every sound is
// synthesised with the Web Audio API (noise bursts, oscillators, filters).
// The context is created lazily on the first user gesture, as browsers require.
let ctx = null;
let master = null;
let noiseBuf = null;

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
}

function noise(dur, filterFreq, gain, when = 0, type = 'lowpass') {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function tone(freq, dur, gain, when = 0, type = 'square', slideTo = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  shot(id) {
    if (id === 'sg12') { noise(0.22, 900, 0.9); tone(120, 0.12, 0.5, 0, 'sine', 40); }
    else if (id === 'ar77') { noise(0.12, 1800, 0.7); tone(180, 0.07, 0.35, 0, 'square', 70); }
    else if (id === 'vk9') { noise(0.09, 2400, 0.5); tone(220, 0.05, 0.25, 0, 'square', 90); }
    else { noise(0.1, 1500, 0.6); tone(200, 0.06, 0.3, 0, 'square', 80); }
  },
  enemyShot(dist) {
    const g = Math.max(0.12, 0.55 - dist * 0.012);
    noise(0.1, 1200, g);
  },
  dry() { tone(1400, 0.04, 0.2, 0, 'square'); },
  reload() { tone(900, 0.05, 0.18, 0, 'square'); tone(600, 0.05, 0.18, 0.35, 'square'); tone(1100, 0.05, 0.22, 0.7, 'square'); },
  hit() { tone(2400, 0.05, 0.3, 0, 'sine'); },
  kill() { tone(1800, 0.07, 0.3, 0, 'sine'); tone(2600, 0.09, 0.3, 0.07, 'sine'); },
  hurt() { noise(0.18, 300, 0.6); tone(90, 0.18, 0.4, 0, 'sine', 45); },
  step() { noise(0.05, 500, 0.08); },
  beep(final) { tone(final ? 1600 : 1100, 0.06, 0.25, 0, 'sine'); },
  explosion() {
    noise(0.7, 400, 1.0);
    tone(70, 0.6, 0.8, 0, 'sine', 28);
    noise(0.4, 2500, 0.4, 0.02, 'highpass');
  },
  plant() { tone(700, 0.1, 0.25, 0, 'sine'); tone(700, 0.1, 0.25, 0.2, 'sine'); },
  defuse() { tone(500, 0.1, 0.25, 0, 'sine'); tone(400, 0.12, 0.25, 0.2, 'sine'); },
  buy() { tone(880, 0.07, 0.25, 0, 'sine'); tone(1320, 0.1, 0.25, 0.07, 'sine'); },
  denied() { tone(220, 0.15, 0.3, 0, 'square'); },
  win() { [523, 659, 784].forEach((f, i) => tone(f, 0.18, 0.3, i * 0.12, 'sine')); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.22, 0.3, i * 0.14, 'sine')); },
  click() { tone(1200, 0.03, 0.15, 0, 'square'); },
};
