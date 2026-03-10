// ─── Sound Effects via Web Audio API (synthetic — no sound files needed) ──────

let audioCtx = null;
let soundEnabled = true;
let volume = 1.0;

function getCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/**
 * Amboss-Schlag — short metallic hammer strike for quest submit.
 * Noise burst → low-pass filter → quick decay = clean metallic "clang".
 */
function playForgeHammer() {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  const t = ctx.currentTime;

  // Primary strike: noise burst through low-pass → sharp metallic transient
  const bufSize = ctx.sampleRate * 0.06;
  const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(2800, t);
  lpf.frequency.exponentialRampToValueAtTime(300, t + 0.05);
  lpf.Q.value = 4;

  const strikeGain = ctx.createGain();
  strikeGain.gain.setValueAtTime(0.5 * volume, t);
  strikeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

  noise.connect(lpf);
  lpf.connect(strikeGain);
  strikeGain.connect(ctx.destination);
  noise.start(t);

  // Ring-out: short sine tone for metallic resonance
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.18);
  oscGain.gain.setValueAtTime(0.18 * volume, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.22);
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

/**
 * Zischen — soft high-frequency hiss for sync/save events.
 */
function playSyncZisch() {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  const bufSize = ctx.sampleRate * 0.18;
  const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  // High-pass filter for hiss character
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 3000;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0, t);
  gain.gain.linearRampToValueAtTime(0.08 * volume, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

  noise.connect(hpf);
  hpf.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
}

/**
 * Glocke — clear bell tone for notifications.
 */
function playNotificationBell() {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  // Two sine waves for bell body
  [[880, 0.18], [1320, 0.10]].forEach(([freq, amp]) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(amp * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.75);
  });
}

/**
 * Kratzen — scratchy low noise burst for errors.
 */
function playErrorScratch() {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  // Low-pitched saw dropout
  const osc = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.linearRampToValueAtTime(40, t + 0.15);
  gain1.gain.setValueAtTime(0.22 * volume, t);
  gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(gain1);
  gain1.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.18);

  // Scratch noise
  const bufSize = ctx.sampleRate * 0.12;
  const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 600;
  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0.15 * volume, t);
  noise.connect(lpf);
  lpf.connect(gain2);
  gain2.connect(ctx.destination);
  noise.start(t);
}

function setSoundEnabled(enabled) {
  soundEnabled = !!enabled;
}

function isSoundEnabled() {
  return soundEnabled;
}

function setVolume(v) {
  volume = Math.max(0, Math.min(1, parseFloat(v) || 0));
}

function getVolume() {
  return volume;
}

module.exports = {
  playForgeHammer,
  playSuccessFanfare,
  playSyncZisch,
  playNotificationBell,
  playErrorScratch,
  setSoundEnabled,
  isSoundEnabled,
  setVolume,
  getVolume,
};
