"use client";

// ─── 8-Bit Sound Engine (Web Audio API) ──────────────────────────────────────
// Synthesizes retro chiptune sound effects in the browser. No external files needed.

type OscType = OscillatorType;

interface Note {
  freq: number;
  duration: number;
  delay?: number;
  type?: OscType;
  volume?: number;
}

let audioCtx: AudioContext | null = null;
let _muted = false;
let _volume = 0.3; // master volume (0–1)

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playNotes(notes: Note[]) {
  if (_muted) return;
  const ctx = getCtx();
  if (!ctx) return;

  const master = ctx.createGain();
  master.gain.value = _volume;
  master.connect(ctx.destination);

  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = n.type || "square";
    osc.frequency.value = n.freq;
    gain.gain.value = n.volume ?? 0.5;

    const start = ctx.currentTime + (n.delay || 0);
    const end = start + n.duration;

    // Fade out to avoid clicks
    gain.gain.setValueAtTime(n.volume ?? 0.5, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);

    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(end + 0.01);
  }
}

// ─── Sound Definitions ───────────────────────────────────────────────────────

/** Subtle UI click */
function click() {
  playNotes([
    { freq: 800, duration: 0.04, type: "square", volume: 0.2 },
  ]);
}

/** Hover / soft tick */
function hover() {
  playNotes([
    { freq: 600, duration: 0.025, type: "square", volume: 0.08 },
  ]);
}

/** Error / denied */
function error() {
  playNotes([
    { freq: 300, duration: 0.12, type: "square", volume: 0.25 },
    { freq: 200, duration: 0.18, delay: 0.12, type: "square", volume: 0.2 },
  ]);
}

/** Quest complete / reward fanfare */
function questComplete() {
  playNotes([
    { freq: 523, duration: 0.1, delay: 0, type: "square", volume: 0.35 },     // C5
    { freq: 659, duration: 0.1, delay: 0.1, type: "square", volume: 0.35 },   // E5
    { freq: 784, duration: 0.1, delay: 0.2, type: "square", volume: 0.4 },    // G5
    { freq: 1047, duration: 0.25, delay: 0.3, type: "square", volume: 0.45 }, // C6
    // Harmony
    { freq: 392, duration: 0.15, delay: 0.2, type: "triangle", volume: 0.2 }, // G4
    { freq: 523, duration: 0.3, delay: 0.3, type: "triangle", volume: 0.15 }, // C5
  ]);
}

/** Ritual fulfilled — mystical chime */
function ritualComplete() {
  playNotes([
    { freq: 880, duration: 0.12, delay: 0, type: "sine", volume: 0.3 },
    { freq: 1109, duration: 0.12, delay: 0.1, type: "sine", volume: 0.3 },
    { freq: 1319, duration: 0.2, delay: 0.2, type: "sine", volume: 0.35 },
    { freq: 1760, duration: 0.3, delay: 0.3, type: "triangle", volume: 0.2 },
  ]);
}

/** Level up — triumphant ascending fanfare */
function levelUp() {
  playNotes([
    { freq: 523, duration: 0.08, delay: 0, type: "square", volume: 0.35 },
    { freq: 659, duration: 0.08, delay: 0.08, type: "square", volume: 0.35 },
    { freq: 784, duration: 0.08, delay: 0.16, type: "square", volume: 0.4 },
    { freq: 1047, duration: 0.08, delay: 0.24, type: "square", volume: 0.4 },
    { freq: 1319, duration: 0.08, delay: 0.32, type: "square", volume: 0.45 },
    { freq: 1568, duration: 0.3, delay: 0.4, type: "square", volume: 0.5 },
    // Bass support
    { freq: 262, duration: 0.15, delay: 0.24, type: "triangle", volume: 0.2 },
    { freq: 392, duration: 0.35, delay: 0.4, type: "triangle", volume: 0.2 },
  ]);
}

/** Coin/gold earned */
function coin() {
  playNotes([
    { freq: 1200, duration: 0.05, delay: 0, type: "square", volume: 0.2 },
    { freq: 1800, duration: 0.08, delay: 0.06, type: "square", volume: 0.25 },
  ]);
}

/** XP tick — subtle */
function xpTick() {
  playNotes([
    { freq: 1400, duration: 0.03, type: "square", volume: 0.12 },
  ]);
}

/** Achievement unlocked */
function achievement() {
  playNotes([
    { freq: 784, duration: 0.08, delay: 0, type: "square", volume: 0.35 },
    { freq: 988, duration: 0.08, delay: 0.08, type: "square", volume: 0.35 },
    { freq: 1175, duration: 0.08, delay: 0.16, type: "square", volume: 0.4 },
    { freq: 1568, duration: 0.35, delay: 0.28, type: "square", volume: 0.45 },
    // Shimmer
    { freq: 2637, duration: 0.15, delay: 0.35, type: "sine", volume: 0.1 },
    { freq: 3136, duration: 0.2, delay: 0.45, type: "sine", volume: 0.08 },
  ]);
}

/** Loot drop — mysterious reveal */
function lootDrop() {
  playNotes([
    { freq: 440, duration: 0.1, delay: 0, type: "triangle", volume: 0.25 },
    { freq: 554, duration: 0.1, delay: 0.08, type: "triangle", volume: 0.3 },
    { freq: 659, duration: 0.1, delay: 0.16, type: "triangle", volume: 0.35 },
    { freq: 880, duration: 0.25, delay: 0.26, type: "square", volume: 0.4 },
  ]);
}

/** Gacha pull anticipation — building tension */
function gachaPull() {
  const notes: Note[] = [];
  for (let i = 0; i < 12; i++) {
    notes.push({
      freq: 200 + i * 50,
      duration: 0.08,
      delay: i * 0.07,
      type: "square",
      volume: 0.15 + i * 0.02,
    });
  }
  playNotes(notes);
}

/** Gacha reveal — rarity-dependent fanfare */
function gachaReveal(rarity: string) {
  if (rarity === "legendary") {
    playNotes([
      { freq: 523, duration: 0.1, delay: 0, type: "square", volume: 0.45 },
      { freq: 659, duration: 0.1, delay: 0.1, type: "square", volume: 0.45 },
      { freq: 784, duration: 0.1, delay: 0.2, type: "square", volume: 0.5 },
      { freq: 1047, duration: 0.1, delay: 0.3, type: "square", volume: 0.5 },
      { freq: 1319, duration: 0.1, delay: 0.4, type: "square", volume: 0.55 },
      { freq: 1568, duration: 0.4, delay: 0.5, type: "square", volume: 0.6 },
      { freq: 784, duration: 0.5, delay: 0.5, type: "triangle", volume: 0.25 },
      // Shimmering top
      { freq: 3136, duration: 0.3, delay: 0.6, type: "sine", volume: 0.12 },
      { freq: 2637, duration: 0.4, delay: 0.7, type: "sine", volume: 0.08 },
    ]);
  } else if (rarity === "epic") {
    playNotes([
      { freq: 523, duration: 0.1, delay: 0, type: "square", volume: 0.4 },
      { freq: 784, duration: 0.1, delay: 0.1, type: "square", volume: 0.4 },
      { freq: 1047, duration: 0.25, delay: 0.2, type: "square", volume: 0.45 },
      { freq: 523, duration: 0.3, delay: 0.2, type: "triangle", volume: 0.2 },
    ]);
  } else if (rarity === "rare") {
    playNotes([
      { freq: 659, duration: 0.1, delay: 0, type: "square", volume: 0.3 },
      { freq: 880, duration: 0.2, delay: 0.1, type: "square", volume: 0.35 },
    ]);
  } else {
    // common / uncommon — simple blip
    playNotes([
      { freq: 600, duration: 0.08, delay: 0, type: "square", volume: 0.2 },
      { freq: 800, duration: 0.1, delay: 0.08, type: "square", volume: 0.2 },
    ]);
  }
}

/** Crafting skill-up — bright ascending WoW-style ping */
function craftSkillUp() {
  playNotes([
    { freq: 880,  duration: 0.06, delay: 0,    type: "square",   volume: 0.3  },
    { freq: 1109, duration: 0.06, delay: 0.07, type: "square",   volume: 0.32 },
    { freq: 1319, duration: 0.06, delay: 0.14, type: "square",   volume: 0.35 },
    { freq: 1760, duration: 0.18, delay: 0.22, type: "square",   volume: 0.4  },
    // Soft shimmer tail
    { freq: 2637, duration: 0.12, delay: 0.28, type: "sine",     volume: 0.1  },
  ]);
}

/** Companion pet / interact */
function companionPet() {
  playNotes([
    { freq: 880, duration: 0.06, delay: 0, type: "sine", volume: 0.2 },
    { freq: 1100, duration: 0.08, delay: 0.08, type: "sine", volume: 0.25 },
    { freq: 1320, duration: 0.1, delay: 0.18, type: "sine", volume: 0.2 },
  ]);
}

/** Streak milestone */
function streakMilestone() {
  playNotes([
    { freq: 784, duration: 0.08, delay: 0, type: "square", volume: 0.3 },
    { freq: 988, duration: 0.08, delay: 0.08, type: "square", volume: 0.3 },
    { freq: 1175, duration: 0.08, delay: 0.16, type: "square", volume: 0.35 },
    { freq: 1568, duration: 0.2, delay: 0.24, type: "square", volume: 0.4 },
  ]);
}

/** Navigate / tab switch */
function navigate() {
  playNotes([
    { freq: 700, duration: 0.04, type: "square", volume: 0.12 },
    { freq: 900, duration: 0.04, delay: 0.04, type: "square", volume: 0.1 },
  ]);
}

/** Modal open */
function modalOpen() {
  playNotes([
    { freq: 500, duration: 0.06, delay: 0, type: "triangle", volume: 0.15 },
    { freq: 700, duration: 0.06, delay: 0.05, type: "triangle", volume: 0.15 },
  ]);
}

/** Modal close */
function modalClose() {
  playNotes([
    { freq: 700, duration: 0.05, delay: 0, type: "triangle", volume: 0.12 },
    { freq: 500, duration: 0.06, delay: 0.04, type: "triangle", volume: 0.1 },
  ]);
}

// ─── Mute / Volume Controls ─────────────────────────────────────────────────

function setMuted(muted: boolean) {
  _muted = muted;
  if (typeof window !== "undefined") {
    try { localStorage.setItem("qh_sound_muted", muted ? "1" : "0"); } catch { /* private browsing */ }
  }
}

function isMuted(): boolean {
  return _muted;
}

function initFromStorage() {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem("qh_sound_muted");
  if (stored === "1") _muted = true;
}

function setVolume(v: number) {
  _volume = Math.max(0, Math.min(1, v));
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const SFX = {
  click,
  hover,
  error,
  questComplete,
  ritualComplete,
  levelUp,
  coin,
  xpTick,
  achievement,
  lootDrop,
  gachaPull,
  gachaReveal,
  companionPet,
  streakMilestone,
  navigate,
  modalOpen,
  modalClose,
  craftSkillUp,
  setMuted,
  isMuted,
  setVolume,
  initFromStorage,
};
