"use client";

// ─── Sound Engine — File-based with synth fallback ─────────────────────────
// Plays real audio files from /audio/ when available, falls back to Web Audio
// API synthesizer when files are missing. Drop MP3/OGG files into public/audio/
// with the names below to upgrade from synth to real sounds.
//
// SOUND FILE NAMING:
//   public/audio/click.mp3           — UI click
//   public/audio/hover.mp3           — hover tick (optional)
//   public/audio/error.mp3           — error / denied
//   public/audio/quest-complete.mp3  — quest done fanfare
//   public/audio/ritual-complete.mp3 — ritual chime
//   public/audio/level-up.mp3        — level up triumphant fanfare
//   public/audio/coin.mp3            — gold earned
//   public/audio/achievement.mp3     — achievement unlocked
//   public/audio/loot-drop.mp3       — item acquired shimmer
//   public/audio/gacha-pull.mp3      — gacha anticipation tension
//   public/audio/gacha-legendary.mp3 — legendary reveal fanfare
//   public/audio/gacha-epic.mp3      — epic reveal
//   public/audio/gacha-rare.mp3      — rare reveal
//   public/audio/gacha-common.mp3    — common/uncommon blip
//   public/audio/craft-skillup.mp3   — crafting skill-up ping
//   public/audio/companion-pet.mp3   — companion interaction
//   public/audio/streak-milestone.mp3 — streak milestone chime
//   public/audio/navigate.mp3        — tab switch (optional)
//
// RECOMMENDED SOURCES (all free, commercial use, no attribution):
//   1. kenney.nl/assets — CC0 packs: "Interface Sounds", "RPG Audio"
//   2. mixkit.co/free-sound-effects/game/ — royalty-free, high quality
//   3. pixabay.com/sound-effects/ — royalty-free gap filler

// ─── Audio File Player ─────────────────────────────────────────────────────

const audioCache = new Map<string, HTMLAudioElement>();
const failedFiles = new Set<string>(); // Don't retry files that 404'd

function playFile(name: string, volume?: number): boolean {
  if (typeof window === "undefined" || _muted) return false;
  if (failedFiles.has(name)) return false;

  const path = `/audio/${name}.mp3`;

  // Check cache
  let audio = audioCache.get(name);
  if (audio) {
    audio.volume = (volume ?? 1) * _volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return true;
  }

  // Try to load
  audio = new Audio(path);
  audio.volume = (volume ?? 1) * _volume;
  audio.play().then(() => {
    audioCache.set(name, audio!);
  }).catch(() => {
    failedFiles.add(name);
  });

  return true; // Optimistic — synth fallback handled by caller
}

// ─── Web Audio Synth (fallback) ────────────────────────────────────────────

type OscType = OscillatorType;
interface Note { freq: number; duration: number; delay?: number; type?: OscType; volume?: number; }

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) { try { audioCtx = new AudioContext(); } catch { return null; } }
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
    gain.gain.setValueAtTime(n.volume ?? 0.5, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(end + 0.01);
  }
}

// ─── Sound Functions (file first, synth fallback) ──────────────────────────

let _muted = false;
let _volume = 0.3;

function click() {
  if (!playFile("click", 0.6)) playNotes([{ freq: 800, duration: 0.04, type: "square", volume: 0.2 }]);
}

function hover() {
  if (!playFile("hover", 0.3)) playNotes([{ freq: 600, duration: 0.025, type: "square", volume: 0.08 }]);
}

function error() {
  if (!playFile("error", 0.7))
    playNotes([
      { freq: 300, duration: 0.12, type: "square", volume: 0.25 },
      { freq: 200, duration: 0.18, delay: 0.12, type: "square", volume: 0.2 },
    ]);
}

function questComplete() {
  if (!playFile("quest-complete", 0.8))
    playNotes([
      { freq: 523, duration: 0.1, delay: 0, type: "square", volume: 0.35 },
      { freq: 659, duration: 0.1, delay: 0.1, type: "square", volume: 0.35 },
      { freq: 784, duration: 0.1, delay: 0.2, type: "square", volume: 0.4 },
      { freq: 1047, duration: 0.25, delay: 0.3, type: "square", volume: 0.45 },
      { freq: 392, duration: 0.15, delay: 0.2, type: "triangle", volume: 0.2 },
      { freq: 523, duration: 0.3, delay: 0.3, type: "triangle", volume: 0.15 },
    ]);
}

function ritualComplete() {
  if (!playFile("ritual-complete", 0.7))
    playNotes([
      { freq: 880, duration: 0.12, delay: 0, type: "sine", volume: 0.3 },
      { freq: 1109, duration: 0.12, delay: 0.1, type: "sine", volume: 0.3 },
      { freq: 1319, duration: 0.2, delay: 0.2, type: "sine", volume: 0.35 },
      { freq: 1760, duration: 0.3, delay: 0.3, type: "triangle", volume: 0.2 },
    ]);
}

function levelUp() {
  if (!playFile("level-up", 1.0))
    playNotes([
      { freq: 523, duration: 0.08, delay: 0, type: "square", volume: 0.35 },
      { freq: 659, duration: 0.08, delay: 0.08, type: "square", volume: 0.35 },
      { freq: 784, duration: 0.08, delay: 0.16, type: "square", volume: 0.4 },
      { freq: 1047, duration: 0.08, delay: 0.24, type: "square", volume: 0.4 },
      { freq: 1319, duration: 0.08, delay: 0.32, type: "square", volume: 0.45 },
      { freq: 1568, duration: 0.3, delay: 0.4, type: "square", volume: 0.5 },
      { freq: 262, duration: 0.15, delay: 0.24, type: "triangle", volume: 0.2 },
      { freq: 392, duration: 0.35, delay: 0.4, type: "triangle", volume: 0.2 },
    ]);
}

function coin() {
  if (!playFile("coin", 0.5))
    playNotes([
      { freq: 1200, duration: 0.05, delay: 0, type: "square", volume: 0.2 },
      { freq: 1800, duration: 0.08, delay: 0.06, type: "square", volume: 0.25 },
    ]);
}

function xpTick() {
  playNotes([{ freq: 1400, duration: 0.03, type: "square", volume: 0.12 }]);
}

function achievement() {
  if (!playFile("achievement", 0.9))
    playNotes([
      { freq: 784, duration: 0.08, delay: 0, type: "square", volume: 0.35 },
      { freq: 988, duration: 0.08, delay: 0.08, type: "square", volume: 0.35 },
      { freq: 1175, duration: 0.08, delay: 0.16, type: "square", volume: 0.4 },
      { freq: 1568, duration: 0.35, delay: 0.28, type: "square", volume: 0.45 },
      { freq: 2637, duration: 0.15, delay: 0.35, type: "sine", volume: 0.1 },
      { freq: 3136, duration: 0.2, delay: 0.45, type: "sine", volume: 0.08 },
    ]);
}

function lootDrop() {
  if (!playFile("loot-drop", 0.8))
    playNotes([
      { freq: 440, duration: 0.1, delay: 0, type: "triangle", volume: 0.25 },
      { freq: 554, duration: 0.1, delay: 0.08, type: "triangle", volume: 0.3 },
      { freq: 659, duration: 0.1, delay: 0.16, type: "triangle", volume: 0.35 },
      { freq: 880, duration: 0.25, delay: 0.26, type: "square", volume: 0.4 },
    ]);
}

function gachaPull() {
  if (!playFile("gacha-pull", 0.7)) {
    const notes: Note[] = [];
    for (let i = 0; i < 12; i++) {
      notes.push({ freq: 200 + i * 50, duration: 0.08, delay: i * 0.07, type: "square", volume: 0.15 + i * 0.02 });
    }
    playNotes(notes);
  }
}

function gachaReveal(rarity: string) {
  const fileMap: Record<string, string> = { legendary: "gacha-legendary", epic: "gacha-epic", rare: "gacha-rare" };
  const fileName = fileMap[rarity] || "gacha-common";
  if (playFile(fileName, rarity === "legendary" ? 1.0 : 0.8)) return;

  // Synth fallback
  if (rarity === "legendary") {
    playNotes([
      { freq: 523, duration: 0.1, delay: 0, type: "square", volume: 0.45 },
      { freq: 659, duration: 0.1, delay: 0.1, type: "square", volume: 0.45 },
      { freq: 784, duration: 0.1, delay: 0.2, type: "square", volume: 0.5 },
      { freq: 1047, duration: 0.1, delay: 0.3, type: "square", volume: 0.5 },
      { freq: 1319, duration: 0.1, delay: 0.4, type: "square", volume: 0.55 },
      { freq: 1568, duration: 0.4, delay: 0.5, type: "square", volume: 0.6 },
      { freq: 784, duration: 0.5, delay: 0.5, type: "triangle", volume: 0.25 },
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
    playNotes([
      { freq: 600, duration: 0.08, delay: 0, type: "square", volume: 0.2 },
      { freq: 800, duration: 0.1, delay: 0.08, type: "square", volume: 0.2 },
    ]);
  }
}

function craftSkillUp() {
  if (!playFile("craft-skillup", 0.7))
    playNotes([
      { freq: 880, duration: 0.06, delay: 0, type: "square", volume: 0.3 },
      { freq: 1109, duration: 0.06, delay: 0.07, type: "square", volume: 0.32 },
      { freq: 1319, duration: 0.06, delay: 0.14, type: "square", volume: 0.35 },
      { freq: 1760, duration: 0.18, delay: 0.22, type: "square", volume: 0.4 },
      { freq: 2637, duration: 0.12, delay: 0.28, type: "sine", volume: 0.1 },
    ]);
}

function companionPet() {
  if (!playFile("companion-pet", 0.5))
    playNotes([
      { freq: 880, duration: 0.06, delay: 0, type: "sine", volume: 0.2 },
      { freq: 1100, duration: 0.08, delay: 0.08, type: "sine", volume: 0.25 },
      { freq: 1320, duration: 0.1, delay: 0.18, type: "sine", volume: 0.2 },
    ]);
}

function streakMilestone() {
  if (!playFile("streak-milestone", 0.9))
    playNotes([
      { freq: 784, duration: 0.08, delay: 0, type: "square", volume: 0.3 },
      { freq: 988, duration: 0.08, delay: 0.08, type: "square", volume: 0.3 },
      { freq: 1175, duration: 0.08, delay: 0.16, type: "square", volume: 0.35 },
      { freq: 1568, duration: 0.2, delay: 0.24, type: "square", volume: 0.4 },
    ]);
}

function navigate() {
  if (!playFile("navigate", 0.3))
    playNotes([
      { freq: 700, duration: 0.04, type: "square", volume: 0.12 },
      { freq: 900, duration: 0.04, delay: 0.04, type: "square", volume: 0.1 },
    ]);
}

function modalOpen() {
  playNotes([
    { freq: 500, duration: 0.06, delay: 0, type: "triangle", volume: 0.15 },
    { freq: 700, duration: 0.06, delay: 0.05, type: "triangle", volume: 0.15 },
  ]);
}

function modalClose() {
  playNotes([
    { freq: 700, duration: 0.05, delay: 0, type: "triangle", volume: 0.12 },
    { freq: 500, duration: 0.06, delay: 0.04, type: "triangle", volume: 0.1 },
  ]);
}

// ─── Preload — warm the cache for common sounds ────────────────────────────

function preload() {
  if (typeof window === "undefined") return;
  const common = ["click", "quest-complete", "level-up", "achievement", "coin", "error"];
  for (const name of common) {
    if (failedFiles.has(name)) continue;
    const audio = new Audio(`/audio/${name}.mp3`);
    audio.preload = "auto";
    audio.addEventListener("canplaythrough", () => { audioCache.set(name, audio); }, { once: true });
    audio.addEventListener("error", () => { failedFiles.add(name); }, { once: true });
  }
}

// ─── Controls ──────────────────────────────────────────────────────────────

function setMuted(muted: boolean) {
  _muted = muted;
  if (typeof window !== "undefined") {
    try { localStorage.setItem("qh_sound_muted", muted ? "1" : "0"); } catch { /* private browsing */ }
  }
}

function isMuted(): boolean { return _muted; }

function initFromStorage() {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem("qh_sound_muted");
  if (stored === "1") _muted = true;
  // Preload audio files after init
  setTimeout(preload, 2000);
}

function setVolume(v: number) { _volume = Math.max(0, Math.min(1, v)); }

// ─── Export ────────────────────────────────────────────────────────────────

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
