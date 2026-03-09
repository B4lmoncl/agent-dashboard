// ─── Sound Effects via Web Audio API (synthetic — no sound files needed) ──────

let audioCtx = null;
let soundEnabled = true;

function getCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/**
 * Amboss-Schlag — metallic hammer impact sound for quest created.
 * Two oscillators: sawtooth (body) + white noise burst (attack transient).
 */
function playForgeHammer() {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  const t = ctx.currentTime;

  // Metallic body — sawtooth with pitch drop
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(280, t);
  osc1.frequency.exponentialRampToValueAtTime(55, t + 0.25);
  gain1.gain.setValueAtTime(0.28, t);
  gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(t);
  osc1.stop(t + 0.3);

  // High-pitched clang overtone
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(560, t);
  osc2.frequency.exponentialRampToValueAtTime(110, t + 0.12);
  gain2.gain.setValueAtTime(0.15, t);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t);
  osc2.stop(t + 0.18);

  // Attack noise burst
  const bufSize = ctx.sampleRate * 0.04;
  const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.25, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(t);
}

/**
 * Erfolgs-Fanfare — ascending C major arpeggio for quest completed.
 */
function playSuccessFanfare() {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  const t = ctx.currentTime;
  const notes = [261.63, 329.63, 392.0, 523.25]; // C4 E4 G4 C5

  notes.forEach((freq, i) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = t + i * 0.11;

    osc.type = 'triangle';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
    gain.gain.setValueAtTime(0.22, start + 0.08);
    gain.gain.linearRampToValueAtTime(0, start + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });

  // Sparkle overtone on last note
  const osc2 = ctx.createOscillator();
  const g2   = ctx.createGain();
  const sparkStart = t + 3 * 0.11;
  osc2.type = 'sine';
  osc2.frequency.value = 1046.5; // C6
  g2.gain.setValueAtTime(0.12, sparkStart);
  g2.gain.exponentialRampToValueAtTime(0.001, sparkStart + 0.3);
  osc2.connect(g2);
  g2.connect(ctx.destination);
  osc2.start(sparkStart);
  osc2.stop(sparkStart + 0.35);
}

function setSoundEnabled(enabled) {
  soundEnabled = !!enabled;
}

function isSoundEnabled() {
  return soundEnabled;
}

module.exports = { playForgeHammer, playSuccessFanfare, setSoundEnabled, isSoundEnabled };
