"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  Quest, QuestsData, Agent, User, ForgeChallengeTemplate, AntiRitual,
  Ritual, Habit, PersonalTemplate, EarnedAchievement, ClassDef, ShopItem, Suggestion,
} from "@/app/types";
import {
  categoryConfig, productConfig, typeConfig, priorityConfig,
} from "@/app/config";
import { timeAgo, getQuestRarity, getAntiRitualMood, getUserLevel, getUserXpProgress, getForgeTempInfo, GUILD_LEVELS } from "@/app/utils";

// ─── Create Quest Modal ──────────────────────────────────────────────────────
export function CreateQuestModal({ quests, users, reviewApiKey, onRefresh, onClose }: {
  quests: QuestsData;
  users: User[];
  reviewApiKey: string;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"personal" | "learning" | "household" | "social" | "coop" | "challenges">("personal");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-2xl overflow-hidden" style={{ background: "linear-gradient(160deg, #221c12 0%, #1a1509 60%, #1e190e 100%)", border: "1px solid rgba(180,140,70,0.35)", boxShadow: "0 0 60px rgba(139,92,246,0.12), 0 0 30px rgba(180,140,70,0.08)", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(180,140,70,0.15)" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#e8d5a3" }}>Quest Board</h2>
            <p className="text-xs" style={{ color: "rgba(200,170,100,0.4)" }}>Choose a template or start from scratch</p>
          </div>
          <button onClick={onClose} style={{ color: "rgba(200,170,100,0.4)", fontSize: 16 }}>✕</button>
        </div>
        <div className="flex border-b overflow-x-auto" style={{ borderColor: "rgba(180,140,70,0.15)" }}>
          {([
            { key: "personal",   label: "Personal",   iconSrc: "/images/icons/cat-personal.png",  fallback: "🏠" },
            { key: "learning",   label: "Learning",   iconSrc: "/images/icons/cat-learning.png",  fallback: "📚" },
            { key: "household",  label: "Household",  iconSrc: "/images/icons/cat-personal.png",  fallback: "🏡" },
            { key: "social",     label: "Social",     iconSrc: "/images/icons/cat-social.png",    fallback: "💛" },
            { key: "coop",       label: "Co-op",      iconSrc: "/images/icons/cat-coop.png",      fallback: "🤝" },
            { key: "challenges", label: "Challenges", iconSrc: "",                                fallback: "⚡" /* TODO: no pixel art icon yet */ },
          ] as { key: typeof tab; label: string; iconSrc: string; fallback: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className="flex-1 py-2.5 text-sm font-semibold transition-all whitespace-nowrap px-2 inline-flex items-center justify-center gap-1"
              style={{
                color: tab === t.key ? "#e8d5a3" : "rgba(200,170,100,0.35)",
                background: tab === t.key ? "linear-gradient(180deg, #2c2318 0%, #231d13 100%)" : "transparent",
                borderBottom: tab === t.key ? "2px solid rgba(180,140,70,0.6)" : "2px solid transparent",
                borderTop: tab === t.key ? "1px solid rgba(180,140,70,0.3)" : "1px solid transparent",
                borderLeft: tab === t.key ? "1px solid rgba(180,140,70,0.2)" : "1px solid transparent",
                borderRight: tab === t.key ? "1px solid rgba(180,140,70,0.2)" : "1px solid transparent",
                marginBottom: tab === t.key ? -1 : 0,
                borderRadius: tab === t.key ? "4px 4px 0 0" : 0,
              }}>
              {t.iconSrc ? (
                <>
                  <img src={t.iconSrc} alt="" width={28} height={28}
                    style={{ imageRendering: "pixelated" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; const next = e.currentTarget.nextElementSibling as HTMLElement; if (next) next.style.display = "inline"; }} />
                  <span style={{ display: "none" }}>{t.fallback}</span>
                </>
              ) : <span>{t.fallback}</span>}
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === "personal" && <PersonalQuestPanel reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
          {tab === "learning" && <LearningQuestPanel quests={quests} reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
          {tab === "household" && <HouseholdQuestBoard quests={quests} users={users} reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
          {tab === "social" && <ThoughtfulHeroPanel quests={quests} reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
          {tab === "coop" && <RelationshipCoopPanel users={users} reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
          {tab === "challenges" && <ForgeChallengesPanel users={users} reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
        </div>
      </div>
    </div>
  );
}

// ─── Personal Quest Panel ────────────────────────────────────────────────────

export function PersonalQuestPanel({ reviewApiKey, onRefresh }: {
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [templates, setTemplates] = useState<PersonalTemplate[]>([]);
  const [spawning, setSpawning] = useState<string | null>(null);
  const [spawned, setSpawned] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch("/api/personal-templates").then(r => r.ok ? r.json() : []).then(setTemplates).catch(() => {});
  }, []);

  const handleSpawn = async (templateId: string) => {
    setSpawning(templateId);
    try {
      const r = await fetch("/api/personal-templates/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({ templateId, createdBy: "leon" }),
      });
      if (r.ok) {
        setSpawned(prev => new Set(prev).add(templateId));
        onRefresh();
      }
    } catch { /* ignore */ } finally {
      setSpawning(null);
    }
  };

  if (templates.length === 0) return null;

  const typeColors: Record<string, { color: string; bg: string; border: string }> = {
    personal:    { color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)"   },
    learning:    { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)"  },
    fitness:     { color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)"  },
    social:      { color: "#ec4899", bg: "rgba(236,72,153,0.1)",  border: "rgba(236,72,153,0.3)"  },
  };
  const typeIcons: Record<string, string> = { personal: "×", learning: "×", fitness: "×", social: "×" };
  const priorityBadge: Record<string, string> = { high: "#ef4444", medium: "#eab308", low: "#22c55e" };

  return (
    <section className="mb-6">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 mb-3 w-full text-left"
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#a78bfa" }}>
          Personal Life Quests
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>
          {templates.length}
        </span>
        <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          {collapsed ? "▸" : "▾"}
        </span>
      </button>
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {templates.map(t => {
            const tc = typeColors[t.type] ?? { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.3)" };
            const isSpawned = spawned.has(t.id);
            const isSpawning = spawning === t.id;
            return (
              <div
                key={t.id}
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{ background: isSpawned ? tc.bg : "#252525", border: `1px solid ${isSpawned ? tc.border : "rgba(255,255,255,0.07)"}` }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-2xl flex-shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold leading-tight" style={{ color: "#f0f0f0" }}>{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                        {typeIcons[t.type]} {t.type}
                      </span>
                      {t.recurrence && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          {t.recurrence}
                        </span>
                      )}
                      <span className="text-xs px-1 py-0.5 rounded font-mono" style={{ color: priorityBadge[t.priority], background: `${priorityBadge[t.priority]}18` }}>
                        {t.priority}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>{t.desc}</p>
                {t.checklist && (
                  <ul className="space-y-0.5">
                    {t.checklist.slice(0, 3).map((item, i) => (
                      <li key={i} className="text-xs flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                        <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: tc.color }} />
                        {item.text}
                      </li>
                    ))}
                    {t.checklist.length > 3 && (
                      <li className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>+{t.checklist.length - 3} more steps</li>
                    )}
                  </ul>
                )}
                <button
                  onClick={() => handleSpawn(t.id)}
                  disabled={isSpawned || isSpawning}
                  className="mt-auto w-full text-xs py-1.5 rounded-lg font-semibold"
                  style={{
                    background: isSpawned ? `${tc.color}20` : isSpawning ? "rgba(255,255,255,0.04)" : "rgba(167,139,250,0.15)",
                    color: isSpawned ? tc.color : isSpawning ? "rgba(255,255,255,0.3)" : "#a78bfa",
                    border: `1px solid ${isSpawned ? tc.border : "rgba(167,139,250,0.35)"}`,
                    cursor: isSpawned ? "default" : "pointer",
                  }}
                >
                  {isSpawned ? "✓ Quest Added" : isSpawning ? "Adding…" : "＋ Add to Quest Board"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Forge Challenges Panel ──────────────────────────────────────────────────

export function ForgeChallengesPanel({ users, reviewApiKey, onRefresh }: {
  users: User[];
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [challenges, setChallenges] = useState<ForgeChallengeTemplate[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [joinUserId, setJoinUserId] = useState<string>(() => users[0]?.id ?? "");

  useEffect(() => {
    fetch("/api/challenges").then(r => r.ok ? r.json() : []).then(setChallenges).catch(() => {});
  }, [users]);

  const handleJoin = async (challengeId: string) => {
    if (!joinUserId) return;
    setJoining(challengeId);
    try {
      await fetch("/api/challenges/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({ userId: joinUserId, challengeId }),
      });
      const updated = await fetch("/api/challenges").then(r => r.ok ? r.json() : challenges);
      setChallenges(updated);
      onRefresh();
    } catch { /* ignore */ } finally {
      setJoining(null);
    }
  };

  if (challenges.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#f97316" }}>
          Forge Challenges
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
          {challenges.length}
        </span>
        {users.length > 1 && (
          <select
            value={joinUserId}
            onChange={e => setJoinUserId(e.target.value)}
            className="ml-auto text-xs px-2 py-0.5 rounded"
            style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8e8", outline: "none" }}
          >
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {challenges.map(c => {
          const joined = users.find(u => u.id === joinUserId) && c.participants.some(p => p.id === joinUserId);
          return (
            <div
              key={c.id}
              className="rounded-xl p-4"
              style={{ background: joined ? "rgba(249,115,22,0.08)" : "#252525", border: `1px solid ${joined ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.07)"}` }}
            >
              <div className="flex items-start gap-3 mb-2">
                <span className="text-2xl flex-shrink-0">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold" style={{ color: "#f0f0f0" }}>{c.name}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{c.desc}</p>
                </div>
              </div>
              {c.participants.length > 0 && (
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                  {c.participants.map(p => (
                    <span key={p.id} className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}40` }}>
                      {p.name}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => handleJoin(c.id)}
                disabled={!!joined || joining === c.id}
                className="w-full text-xs py-1.5 rounded-lg font-semibold"
                style={{
                  background: joined ? "rgba(34,197,94,0.12)" : joining === c.id ? "rgba(255,255,255,0.04)" : "rgba(249,115,22,0.15)",
                  color: joined ? "#22c55e" : joining === c.id ? "rgba(255,255,255,0.3)" : "#f97316",
                  border: `1px solid ${joined ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.35)"}`,
                  cursor: joined ? "default" : "pointer",
                }}
              >
                {joined ? "✓ Joined" : joining === c.id ? "Joining…" : "Join Challenge"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Anti-Rituale Panel ───────────────────────────────────────────────────────

const COMMITMENT_TIERS_VOW = [
  { id: "none",     label: "None",     days: 0,   color: "rgba(255,255,255,0.25)", bonusGold: 0,  bonusXp: 0,  flavorShort: "Kein Versprechen" },
  { id: "spark",    label: "Spark",    days: 7,   color: "#94a3b8",                bonusGold: 3,  bonusXp: 5,  flavorShort: "Erster Funken" },
  { id: "flame",    label: "Flame",    days: 21,  color: "#6366f1",                bonusGold: 7,  bonusXp: 10, flavorShort: "Entsagung formt sich" },
  { id: "ember",    label: "Ember",    days: 60,  color: "#818cf8",                bonusGold: 13, bonusXp: 20, flavorShort: "Tief verwurzelt" },
  { id: "crucible", label: "Crucible", days: 180, color: "#c7d2fe",                bonusGold: 20, bonusXp: 35, flavorShort: "Stahl der Seele" },
  { id: "eternity", label: "Eternity", days: 365, color: "#e0e7ff",                bonusGold: 30, bonusXp: 50, flavorShort: "Ewige Entsagung" },
];

function getVaelSpeech(commitment: string, bloodPact: boolean): string {
  if (bloodPact) return "Blut. So sei es.";
  if (commitment === "eternity") return "Ein Jahr Entsagung. Wenige bestehen.";
  if (commitment === "none") return "";
  return "...Sprich deinen Schwur.";
}

const ANTI_RITUAL_MILESTONES = [
  { days: 7,   badge: "×", label: "1 Woche clean!" },
  { days: 14,  badge: "×", label: "2 Wochen stark!" },
  { days: 21,  badge: "×", label: "21 Tage — The Habit Breaks!" },
  { days: 30,  badge: "×", label: "1 Monat stark!" },
  { days: 60,  badge: "×", label: "60 Tage — Diamond Will!" },
  { days: 90,  badge: "×", label: "90 Tage — Unbreakable!" },
];

export function AntiRitualePanel({ playerName, reviewApiKey }: { playerName: string; reviewApiKey: string }) {
  const [antiRituals, setAntiRituals] = useState<AntiRitual[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newVowCategory, setNewVowCategory] = useState("personal");
  const [newVowCommitment, setNewVowCommitment] = useState("none");
  const [newVowBloodPact, setNewVowBloodPact] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadAntiRituals = useCallback(async () => {
    if (!playerName) return;
    try {
      const r = await fetch(`/api/rituals?player=${encodeURIComponent(playerName)}&type=anti`);
      if (r.ok) {
        const all = await r.json() as (Ritual & { isAntiRitual?: boolean; cleanDays?: number; lastViolated?: string | null })[];
        setAntiRituals(all.filter(r => r.isAntiRitual).map(r => ({
          id: r.id, title: r.title, isAntiRitual: true,
          cleanDays: r.cleanDays ?? r.streak ?? 0,
          lastViolated: r.lastViolated ?? null,
          playerId: r.playerId,
          createdAt: r.lastCompleted ?? new Date().toISOString(),
        })));
      }
    } catch { /* ignore */ }
  }, [playerName]);

  useEffect(() => { loadAntiRituals(); }, [loadAntiRituals]);

  const markViolated = async (id: string) => {
    if (!reviewApiKey || !playerName) return;
    try {
      await fetch(`/api/rituals/${id}/violate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
        body: JSON.stringify({ playerId: playerName }),
      });
      loadAntiRituals();
    } catch { /* ignore */ }
  };

  const createAntiRitual = async () => {
    if (!newTitle.trim() || !reviewApiKey || !playerName) return;
    try {
      const tier = COMMITMENT_TIERS_VOW.find(t => t.id === newVowCommitment)!;
      await fetch("/api/rituals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
        body: JSON.stringify({
          title: newTitle.trim(),
          schedule: { type: "daily" },
          playerId: playerName,
          createdBy: playerName,
          isAntiRitual: true,
          category: newVowCategory,
          commitment: newVowCommitment,
          commitmentDays: tier.days,
          bloodPact: newVowBloodPact,
        }),
      });
      setNewTitle("");
      setNewVowCommitment("none");
      setNewVowBloodPact(false);
      setCreateOpen(false);
      loadAntiRituals();
    } catch { /* ignore */ }
  };

  const getStreakBadge = (days: number) =>
    [...ANTI_RITUAL_MILESTONES].reverse().find(m => days >= m.days) ?? null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <img src="/images/portraits/npc-vael.png" alt="" width={28} height={42} style={{ imageRendering: "pixelated", borderRadius: 4, border: "1px solid rgba(99,102,241,0.35)", flexShrink: 0 }} />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#818cf8" }}>
              Vow Shrine
              <span className="text-xs font-normal normal-case ml-2" style={{ color: "rgba(165,180,252,0.35)" }}>— track what you don&apos;t do</span>
            </h3>
            <p className="text-xs" style={{ color: "rgba(99,102,241,0.45)", fontSize: "0.6rem" }}>Vael the Silent</p>
          </div>
        </div>
        {playerName && reviewApiKey && (
          <button onClick={() => setCreateOpen(true)} className="action-btn text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: "rgba(99,102,241,0.14)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.35)", boxShadow: "0 0 10px rgba(99,102,241,0.08)" }}>
            ＋ Vow ablegen
          </button>
        )}
      </div>

      {antiRituals.length === 0 ? (
        <div className="rounded-xl p-5 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-2xl mb-2">×</p>
          <p className="text-xs font-semibold mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>No vows sworn yet</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Track how long you avoid a bad habit. Days clean = streak power.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {antiRituals.map(ar => {
            const days = ar.cleanDays;
            const mood = getAntiRitualMood(days);
            const badge = getStreakBadge(days);
            const nextMilestone = ANTI_RITUAL_MILESTONES.find(m => days < m.days);
            const streakBorderColor = days >= 90 ? "#f59e0b" : days >= 30 ? "#a78bfa" : days >= 7 ? "#22c55e" : "rgba(255,255,255,0.1)";
            const streakGlow = days >= 30 ? `0 0 12px ${streakBorderColor}30` : "none";
            return (
              <div key={ar.id} className="rounded-xl p-3" style={{
                background: "#252525",
                border: `1px solid ${streakBorderColor}`,
                boxShadow: streakGlow,
              }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>{ar.title}</span>
                      {badge && <span className="text-sm" title={badge.label}>{badge.badge}</span>}
                    </div>
                    <p className="text-xs mb-1.5" style={{ color: mood.color }}>{mood.msg}</p>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      <span className="font-bold" style={{ color: mood.color }}>{days} days clean</span>
                      {nextMilestone && <span>→ {nextMilestone.badge} in {nextMilestone.days - days}d</span>}
                    </div>
                    {nextMilestone && (
                      <div className="mt-2">
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${(days / nextMilestone.days) * 100}%`,
                            background: `linear-gradient(90deg, ${mood.color}80, ${mood.color})`,
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => markViolated(ar.id)}
                      disabled={!reviewApiKey}
                      className="text-xs px-2 py-1 rounded transition-all"
                      style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.5)", border: "1px solid rgba(239,68,68,0.2)" }}
                      title="Ich hab's gemacht... Streak reset."
                    >
                      Slip
                    </button>
                    {reviewApiKey && (
                      <button
                        onClick={() => setDeleteConfirmId(ar.id)}
                        className="text-xs px-2 py-1 rounded transition-all"
                        style={{ background: "rgba(239,68,68,0.06)", color: "rgba(239,68,68,0.4)", border: "1px solid rgba(239,68,68,0.12)", cursor: 'pointer' }}
                        title="Vow löschen"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (() => {
        const closeVowModal = () => { setCreateOpen(false); setNewTitle(""); setNewVowCommitment("none"); setNewVowBloodPact(false); };
        const vaelSpeech = getVaelSpeech(newVowCommitment, newVowBloodPact);
        const tierData = COMMITMENT_TIERS_VOW.find(t => t.id === newVowCommitment)!;
        const bonusGold = tierData.bonusGold * (newVowBloodPact ? 3 : 1);
        const bonusXp = tierData.bonusXp * (newVowBloodPact ? 3 : 1);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.88)" }} onClick={closeVowModal}>
            {/* Outer wrapper: flex so portrait overlaps right edge */}
            <div className="relative flex items-end" style={{ maxWidth: 820, width: "100%" }} onClick={e => e.stopPropagation()}>

              {/* ── Modal Panel (65% width) ── */}
              <div style={{ flex: "0 0 65%", minWidth: 0, borderRadius: "1rem", overflow: "hidden", maxHeight: "80vh", overflowY: "auto", background: newVowBloodPact ? "linear-gradient(160deg, #1a1a2e 0%, #0f0f1e 100%)" : "linear-gradient(160deg, #1e1c2c 0%, #141220 100%)", border: `1px solid ${newVowBloodPact ? "rgba(99,102,241,0.6)" : "rgba(99,102,241,0.3)"}`, boxShadow: newVowBloodPact ? "0 0 60px rgba(99,102,241,0.14)" : "0 0 40px rgba(99,102,241,0.07)", transition: "all 0.4s ease" }}>

                {/* NPC Speech */}
                <div style={{ background: "rgba(99,102,241,0.06)", borderBottom: "1px solid rgba(99,102,241,0.12)", padding: "16px 20px", minHeight: 52 }}>
                  {vaelSpeech ? (
                    <p className="npc-speech-text text-xs italic" key={`vael-${newVowBloodPact}-${newVowCommitment}`} style={{ color: "#a5b4fc", lineHeight: 1.7, fontSize: "0.7rem" }}>
                      „{vaelSpeech}"
                    </p>
                  ) : (
                    <p className="text-xs italic" style={{ color: "rgba(165,180,252,0.25)", fontSize: "0.7rem" }}>...</p>
                  )}
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b" style={{ borderColor: "rgba(99,102,241,0.12)" }}>
                  <img src="/images/icons/ui-vow-sword.png" alt="" width={28} height={28} style={{ imageRendering: "pixelated" }} onError={e => (e.currentTarget.style.display = "none")} />
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>Schwur ablegen</h3>
                    <p className="text-xs" style={{ color: "rgba(165,180,252,0.4)" }}>Vael the Silent — Vow Shrine</p>
                  </div>
                </div>

                {/* Form */}
                <div className="p-5 space-y-4" style={{ maxHeight: "58vh", overflowY: "auto" }}>

                  {/* Name */}
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(165,180,252,0.55)" }}>Was schwörst du ab?</label>
                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="z.B. Kein Social Media vor dem Mittag..." className="w-full text-sm px-3 py-2.5 rounded-lg" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(99,102,241,0.3)", color: "#e2e8f0", outline: "none" }} onKeyDown={e => e.key === "Enter" && createAntiRitual()} autoFocus />
                  </div>

                  {/* Category + Frequency */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(165,180,252,0.55)" }}>Kategorie</label>
                      <select value={newVowCategory} onChange={e => setNewVowCategory(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(99,102,241,0.2)", color: "#e2e8f0", outline: "none" }}>
                        <option value="fitness">Fitness</option>
                        <option value="learning">Learning</option>
                        <option value="personal">Personal</option>
                        <option value="social">Social</option>
                        <option value="creative">Creative</option>
                        <option value="wellness">Wellness</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(165,180,252,0.55)" }}>Frequenz</label>
                      <div className="flex gap-1.5">
                        {[{ v: "daily", label: "Täglich" }, { v: "triggered", label: "Bei Reiz" }].map(({ v, label }) => (
                          <button key={v} onClick={() => {}} className="flex-1 text-xs py-2 rounded-lg font-medium" style={{ background: v === "daily" ? "rgba(99,102,241,0.18)" : "rgba(0,0,0,0.25)", color: v === "daily" ? "#818cf8" : "rgba(165,180,252,0.35)", border: `1px solid ${v === "daily" ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.1)"}` }}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Aetherbond Commitment */}
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: "rgba(165,180,252,0.55)" }}>Aetherbond</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {COMMITMENT_TIERS_VOW.map(tier => (
                        <button key={tier.id} onClick={() => setNewVowCommitment(tier.id)} className="ritual-tier-btn text-left p-2 rounded-lg" style={{ background: newVowCommitment === tier.id ? `${tier.color}1a` : "rgba(0,0,0,0.2)", border: `1px solid ${newVowCommitment === tier.id ? tier.color : "rgba(255,255,255,0.07)"}`, boxShadow: newVowCommitment === tier.id ? `0 0 12px ${tier.color}55` : "none" }}>
                          <div className="text-xs font-bold" style={{ color: newVowCommitment === tier.id ? tier.color : "rgba(255,255,255,0.5)" }}>{tier.label}</div>
                          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{tier.days > 0 ? `${tier.days}d` : "—"}</div>
                          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.2)", lineHeight: 1.3 }}>{tier.flavorShort}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Blood Pact Toggle */}
                  <div>
                    <button onClick={() => setNewVowBloodPact(p => !p)} className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-all ${newVowBloodPact ? "blood-pact-active-indigo" : ""}`} style={{ background: newVowBloodPact ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)", color: newVowBloodPact ? "#818cf8" : "rgba(255,255,255,0.25)", border: `1px solid ${newVowBloodPact ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`, transition: "color 0.3s, background 0.3s, border 0.3s" }}>
                      {newVowBloodPact ? "Blutpakt besiegelt" : "Blutpakt besiegeln"}
                    </button>
                    {newVowBloodPact && <p className="text-xs mt-1.5 text-center" style={{ color: "rgba(99,102,241,0.8)" }}>! Blutpakt: Scheitern = alle Belohnungen verfallen.</p>}
                  </div>

                  {/* Reward Preview */}
                  <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(99,102,241,0.12)" }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(165,180,252,0.4)" }}>Vorschau Belohnungen</p>
                    <p className="text-xs" style={{ color: "rgba(165,180,252,0.65)" }}>Täglich: <span style={{ color: "#818cf8" }}>5 <img src="/images/icons/reward-gold.png" width={14} height={14} style={{ imageRendering: "pixelated", verticalAlign: "middle" }} /></span> · <span style={{ color: "#a78bfa" }}>10 XP</span></p>
                    {tierData.id !== "none" && <p className="text-xs mt-0.5" style={{ color: "rgba(165,180,252,0.65)" }}>Bindungsbonus: <span style={{ color: "#818cf8" }}>+{bonusGold} <img src="/images/icons/reward-gold.png" width={14} height={14} style={{ imageRendering: "pixelated", verticalAlign: "middle" }} /></span> · <span style={{ color: "#a78bfa" }}>+{bonusXp} XP</span>{newVowBloodPact && <span style={{ color: "#6366f1", fontWeight: "bold" }}> ×3</span>}</p>}
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={closeVowModal} className="action-btn text-sm py-2.5 px-5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(165,180,252,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>Zurücktreten</button>
                    <button onClick={createAntiRitual} className="action-btn flex-1 text-sm py-2.5 rounded-xl font-bold" style={{ background: "rgba(67,56,202,0.32)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.6)", boxShadow: "0 0 16px rgba(99,102,241,0.12)" }}>Schwur leisten</button>
                  </div>
                </div>
              </div>

              {/* ── Vael Portrait (hidden on small screens) ── */}
              <div className="hidden md:block" style={{ position: "absolute", right: -160, top: "50%", transform: "translateY(-50%)", width: 180, pointerEvents: "none", zIndex: 10 }}>
                <img src="/images/portraits/npc-vael.png" alt="Vael the Silent" width={256} height={384} style={{ imageRendering: "pixelated", width: "100%", height: "auto", display: "block", filter: newVowBloodPact ? "drop-shadow(0 0 22px rgba(99,102,241,0.8))" : "drop-shadow(0 0 18px rgba(99,102,241,0.45))", transition: "filter 0.5s ease" }} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => setDeleteConfirmId(null)}>
          <div className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ background: "linear-gradient(160deg, #2c2318 0%, #1e1912 100%)", border: "1px solid rgba(239,68,68,0.35)", boxShadow: "0 0 40px rgba(239,68,68,0.1)" }} onClick={e => e.stopPropagation()}>
            <div className="p-5 text-center">
              <p className="text-2xl mb-3">×</p>
              <p className="text-sm font-bold mb-1" style={{ color: "#e8d5a3" }}>Abandon this Vow?</p>
              <p className="text-xs mb-5" style={{ color: "rgba(200,170,100,0.45)" }}>Are you sure you want to forsake this sworn vow?</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 text-sm py-2 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(200,170,100,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>Keep It</button>
                <button
                  onClick={async () => {
                    const id = deleteConfirmId;
                    setDeleteConfirmId(null);
                    try {
                      await fetch(`/api/rituals/${id}`, { method: "DELETE", headers: { "x-api-key": reviewApiKey } });
                      loadAntiRituals();
                    } catch { /* ignore */ }
                  }}
                  className="flex-1 text-sm py-2 rounded-lg font-semibold"
                  style={{ background: "rgba(239,68,68,0.18)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }}
                >
                  Abandon Vow
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Smart Suggestions Panel ──────────────────────────────────────────────────

function buildSuggestions(quests: QuestsData, agents: Agent[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const now = Date.now();
  const DAY = 86_400_000;

  // 1. Stale epic quests — parent open but no child activity for 7+ days
  const epics = quests.open.filter(q => q.children && q.children.length > 0);
  for (const epic of epics) {
    const lastActivity = Math.max(
      new Date(epic.createdAt).getTime(),
      ...(epic.children ?? []).map(c => new Date(c.createdAt).getTime()),
    );
    const staleDays = Math.floor((now - lastActivity) / DAY);
    if (staleDays >= 7) {
      suggestions.push({
        id: `stale-${epic.id}`,
        icon: "🕸",
        title: `Epic "${epic.title}" is stale`,
        body: `No sub-quest activity for ${staleDays} days. Consider breaking it down or reassigning.`,
        accent: "#f59e0b",
        accentBg: "rgba(245,158,11,0.08)",
      });
    }
  }

  // 2. Recurring quests not recently completed (no completion in last recurrence window)
  const recurringOpen = quests.open.filter(q => q.recurrence);
  for (const q of recurringOpen) {
    const windowDays = q.recurrence === "daily" ? 1 : q.recurrence === "weekly" ? 7 : 30;
    const age = (now - new Date(q.createdAt).getTime()) / DAY;
    if (age >= windowDays) {
      suggestions.push({
        id: `recurring-${q.id}`,
        icon: "🔁",
        title: `Recurring quest overdue: "${q.title}"`,
        body: `Scheduled ${q.recurrence} — created ${Math.floor(age)}d ago with no completion recorded.`,
        accent: "#6366f1",
        accentBg: "rgba(99,102,241,0.08)",
      });
    }
  }

  // 3. High-priority pile — 3+ high-priority open quests unclaimed
  const highOpen = quests.open.filter(q => q.priority === "high" && !q.claimedBy);
  if (highOpen.length >= 3) {
    suggestions.push({
      id: "high-pile",
      icon: "🔥",
      title: `${highOpen.length} high-priority quests unclaimed`,
      body: `High-value work is piling up: ${highOpen.slice(0, 2).map(q => `"${q.title}"`).join(", ")}${highOpen.length > 2 ? ` +${highOpen.length - 2} more` : ""}. Consider assigning them.`,
      accent: "#ef4444",
      accentBg: "rgba(239,68,68,0.08)",
    });
  }

  // 4. Quest type imbalance — one type dominates > 70% of open quests
  if (quests.open.length >= 5) {
    const typeCounts: Record<string, number> = {};
    for (const q of quests.open) {
      const t = q.type ?? "development";
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] / quests.open.length > 0.7) {
      const cfg = typeConfig[dominant[0]];
      suggestions.push({
        id: "type-imbalance",
        icon: "⚖",
        title: `Quest type imbalance: ${Math.round((dominant[1] / quests.open.length) * 100)}% ${cfg?.label ?? dominant[0]}`,
        body: `${dominant[1]} of ${quests.open.length} open quests are ${dominant[0]}. Consider diversifying with personal, learning, or social quests.`,
        accent: cfg?.color ?? "#9ca3af",
        accentBg: cfg?.bg ?? "rgba(156,163,175,0.08)",
      });
    }
  }

  // 5. Idle agents with open quests available
  const idleAgents = agents.filter(a => a.status === "idle");
  if (idleAgents.length > 0 && quests.open.length > 0) {
    suggestions.push({
      id: "idle-agents",
      icon: "💤",
      title: `${idleAgents.length} agent${idleAgents.length > 1 ? "s" : ""} idle with ${quests.open.length} open quest${quests.open.length > 1 ? "s" : ""}`,
      body: `${idleAgents.map(a => a.name).join(", ")} ${idleAgents.length > 1 ? "are" : "is"} idle. There are open quests waiting to be claimed.`,
      accent: "#22c55e",
      accentBg: "rgba(34,197,94,0.08)",
    });
  }

  // 6. No learning quests — encourage knowledge capture
  const hasLearning = [...quests.open, ...quests.inProgress].some(q => q.type === "learning");
  if (!hasLearning && quests.open.length >= 3) {
    suggestions.push({
      id: "no-learning",
      icon: "📚",
      title: "No learning quests active",
      body: "Knowledge capture is missing from the queue. Consider adding a learning quest to build team knowledge.",
      accent: "#3b82f6",
      accentBg: "rgba(59,130,246,0.08)",
    });
  }

  return suggestions;
}

// ─── Relationship Co-op Panel ─────────────────────────────────────────────────

const COOP_TEMPLATES = [
  { id: "weekend_trip", title: "Plan Weekend Trip Together", description: "Research destinations, agree on dates, book accommodation.", icon: "✈️" },
  { id: "cook_dinner", title: "Cook Dinner as a Team", description: "Choose a recipe together, shop ingredients, cook and enjoy.", icon: "🍳" },
  { id: "watch_movie", title: "Movie Night Both Wanted", description: "Pick a movie you've both been wanting to watch, make popcorn.", icon: "🎬" },
  { id: "workout_together", title: "Workout Session Together", description: "Go for a run, gym session, or home workout — both complete it.", icon: "💪" },
  { id: "digital_detox", title: "1-Hour Digital Detox Together", description: "Both put phones away, spend quality time without screens.", icon: "🌿" },
];

export function RelationshipCoopPanel({ users, reviewApiKey, onRefresh }: {
  users: User[];
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [partner1, setPartner1] = useState("");
  const [partner2, setPartner2] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userIds = users.map(u => u.id);

  const createCoopQuest = async (template: (typeof COOP_TEMPLATES)[0]) => {
    if (!reviewApiKey || !partner1 || !partner2) return;
    setCreating(template.id);
    try {
      const res = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: template.title,
          description: template.description,
          priority: "medium",
          type: "relationship-coop",
          createdBy: "leon",
          coopPartners: [partner1.toLowerCase(), partner2.toLowerCase()],
        }),
      });
      if (res.ok) {
        setSuccess(template.id);
        setTimeout(() => setSuccess(null), 3000);
        onRefresh();
      }
    } catch { /* ignore */ } finally { setCreating(null); }
  };

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#f43f5e" }}>
          Relationship Raid Boss
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(244,63,94,0.12)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.3)" }}>
          Co-op Quests
        </span>
      </div>
      <div className="rounded-xl p-4 mb-3" style={{ background: "#252525", border: "1px solid rgba(244,63,94,0.2)" }}>
        <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
          Co-op quests require both partners to complete their part. Shared XP reward on success!
        </p>
        <div className="flex gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Partner 1</label>
            <select value={partner1} onChange={e => setPartner1(e.target.value)} className="text-xs px-2 py-1.5 rounded" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8e8" }}>
              <option value="">Select player…</option>
              {userIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Partner 2</label>
            <select value={partner2} onChange={e => setPartner2(e.target.value)} className="text-xs px-2 py-1.5 rounded" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8e8" }}>
              <option value="">Select player…</option>
              {userIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {COOP_TEMPLATES.map(t => {
          const isCreating = creating === t.id;
          const isDone = success === t.id;
          const canCreate = !!(partner1 && partner2 && partner1 !== partner2);
          return (
            <div key={t.id} className="rounded-xl p-4" style={{ background: "#252525", border: "1px solid rgba(244,63,94,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl flex-shrink-0">{t.icon}</span>
                <p className="text-xs font-bold" style={{ color: "#f0f0f0" }}>{t.title}</p>
              </div>
              <p className="text-xs mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{t.description}</p>
              {reviewApiKey ? (
                <button
                  onClick={() => createCoopQuest(t)}
                  disabled={!canCreate || !!creating}
                  className="action-btn w-full text-xs py-1.5 rounded-lg font-semibold"
                  style={{ background: isDone ? "rgba(34,197,94,0.15)" : canCreate ? "rgba(244,63,94,0.15)" : "rgba(255,255,255,0.04)", color: isDone ? "#22c55e" : canCreate ? "#f43f5e" : "rgba(255,255,255,0.2)", border: `1px solid ${isDone ? "rgba(34,197,94,0.3)" : "rgba(244,63,94,0.3)"}`, cursor: canCreate ? "pointer" : "not-allowed" }}
                >
                  {isDone ? "✓ Co-op Quest Created!" : isCreating ? "Creating…" : canCreate ? "Create Co-op Quest" : "Select both partners first"}
                </button>
              ) : (
                <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>Login to create</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Klassenquests Panel — moved to components/CVBuilderPanel.tsx ─────────────

// ─── Dobbie's Demands — NPC Quest Panel ──────────────────────────────────────

const DOBBIE_QUESTS = [
  { id: "feed_dobbie", title: "Feed Dobbie Before 18:00", description: "His Highness demands his meal on time. No excuses.", icon: "🥫", priority: "high" as const },
  { id: "clean_litter", title: "Clean the Litter Box", description: "The sacred ritual must be performed. Dobbie demands cleanliness.", icon: "🧹", priority: "medium" as const },
  { id: "pet_dobbie", title: "Pet Dobbie for 5 Minutes", description: "Five minutes of undivided attention. The minimum acceptable tribute.", icon: "😸", priority: "low" as const },
  { id: "play_time", title: "Interactive Play Session", description: "10 minutes with the wand toy. Dobbie requires stimulation.", icon: "🎾", priority: "low" as const },
  { id: "window_watch", title: "Open Window for Bird Watching", description: "Allow access to the window ledge for prime bird surveillance.", icon: "🐦", priority: "low" as const },
];

const DOBBIE_MOODS = [
  { mood: "😸 Content", color: "#22c55e", quote: "You may proceed. I am… temporarily satisfied." },
  { mood: "😾 Demanding", color: "#f59e0b", quote: "This is taking far too long. My patience wears thin, human." },
  { mood: "😤 Annoyed", color: "#ef4444", quote: "UNACCEPTABLE. The litter box remains unattended. Consequences incoming." },
  { mood: "😻 Affectionate", color: "#ff6b9d", quote: "Fine. You may pet me. BRIEFLY. Do not read into this." },
  { mood: "🙄 Unimpressed", color: "#a78bfa", quote: "You call that a play session? I've seen dust motes with more energy." },
];

export function DobbieQuestPanel({ reviewApiKey, onRefresh }: { reviewApiKey: string; onRefresh: () => void }) {
  const [creating, setCreating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const dobbieMood = DOBBIE_MOODS[Math.floor(Date.now() / (1000 * 60 * 60 * 4)) % DOBBIE_MOODS.length];

  const createDobbieQuest = async (q: (typeof DOBBIE_QUESTS)[0]) => {
    if (!reviewApiKey) return;
    setCreating(q.id);
    try {
      const res = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: q.title,
          description: q.description,
          priority: q.priority,
          type: "personal",
          createdBy: "dobbie",
          recurrence: "daily",
        }),
      });
      if (res.ok) {
        setSuccess(q.id);
        setTimeout(() => setSuccess(null), 3000);
        onRefresh();
      }
    } catch { /* ignore */ } finally { setCreating(null); }
  };

  return (
    <section className="mb-6">
      <div className="rounded-xl p-3 mb-3 flex items-center gap-3" style={{ background: "rgba(255,107,157,0.06)", border: "1px solid rgba(255,107,157,0.2)" }}>
        <span className="text-3xl flex-shrink-0">🐱</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold" style={{ color: "#ff6b9d" }}>Dobbie — Cat Overlord</p>
            <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: dobbieMood.color, background: `${dobbieMood.color}18`, border: `1px solid ${dobbieMood.color}40` }}>{dobbieMood.mood}</span>
          </div>
          <p className="text-xs mt-0.5 italic" style={{ color: "rgba(255,255,255,0.35)" }}>&ldquo;{dobbieMood.quote}&rdquo;</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ alignItems: "stretch" }}>
        {DOBBIE_QUESTS.map(q => {
          const isCreating = creating === q.id;
          const isDone = success === q.id;
          return (
            <div key={q.id} className="rounded-xl p-4 flex flex-col" style={{ background: "#252525", border: "1px solid rgba(255,107,157,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl flex-shrink-0">{q.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "#f0f0f0" }}>{q.title}</p>
                  <span className="text-xs" style={{ color: q.priority === "high" ? "#ef4444" : q.priority === "medium" ? "#f59e0b" : "#22c55e" }}>{q.priority}</span>
                </div>
              </div>
              <p className="text-xs mb-3 leading-relaxed flex-1" style={{ color: "rgba(255,255,255,0.35)" }}>{q.description}</p>
              <button
                onClick={() => createDobbieQuest(q)}
                disabled={!!creating}
                className="action-btn w-full text-xs py-1.5 rounded-lg font-semibold"
                style={{ background: isDone ? "rgba(34,197,94,0.15)" : "rgba(255,107,157,0.15)", color: isDone ? "#22c55e" : "#ff6b9d", border: `1px solid ${isDone ? "rgba(34,197,94,0.3)" : "rgba(255,107,157,0.3)"}` }}
              >
                {isDone ? "✓ Accepted!" : isCreating ? "Accepting…" : "🐱 Accept Quest"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SmartSuggestionsPanel({ quests, agents }: { quests: QuestsData; agents: Agent[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dismissed_suggestions") ?? "[]")); } catch { return new Set(); }
  });
  const [open, setOpen] = useState(true);

  const allSuggestions = buildSuggestions(quests, agents);
  const visible = allSuggestions.filter(s => !dismissed.has(s.id));

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    try { localStorage.setItem("dismissed_suggestions", JSON.stringify([...next])); } catch { /* ignore */ }
  };

  if (visible.length === 0) return null;

  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 mb-3 w-full text-left"
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#a855f7" }}>
          Smart Suggestions
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}>
          {visible.length}
        </span>
        <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="space-y-2">
          {visible.map(s => (
            <div
              key={s.id}
              className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: s.accentBg, border: `1px solid ${s.accent}30` }}
            >
              <span className="text-lg flex-shrink-0 leading-none mt-0.5">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: s.accent }}>{s.title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{s.body}</p>
              </div>
              <button
                onClick={() => dismiss(s.id)}
                className="flex-shrink-0 text-xs px-2 py-1 rounded transition-all"
                style={{ color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)" }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Learning Quest Panel ──────────────────────────────────────────────────────

const LEARNING_TEMPLATES = [
  {
    id: "js_mastery",
    name: "JavaScript Mastery",
    icon: "💛",
    steps: ["Read MDN fundamentals", "Complete 5 coding exercises", "Build a mini project", "Write what you learned (proof)"],
  },
  {
    id: "design_system",
    name: "Design System Study",
    icon: "🎨",
    steps: ["Study color theory & typography", "Analyze 3 design systems", "Create a component sketch", "Document findings (proof)"],
  },
  {
    id: "habit_reading",
    name: "Daily 10-Page Reading",
    icon: "📖",
    steps: ["Choose your book", "Read 10 pages", "Take margin notes", "Share 1 key insight (proof)"],
  },
  {
    id: "language",
    name: "Language Practice",
    icon: "🌍",
    steps: ["30 min Duolingo/Anki", "Learn 5 new vocab words", "Practice 1 conversation", "Journal in target language (proof)"],
  },
];

export function LearningQuestPanel({ quests, reviewApiKey, onRefresh }: {
  quests: QuestsData;
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [creating, setCreating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const learningActive = [...quests.open, ...quests.inProgress].filter(q => q.type === "learning");
  const learningDone = quests.completed.filter(q => q.type === "learning").length;

  const createChain = async (template: (typeof LEARNING_TEMPLATES)[0]) => {
    if (!reviewApiKey) return;
    setCreating(template.id);
    try {
      const res = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: template.name,
          description: `Learning quest chain: ${template.name}`,
          priority: "medium",
          type: "learning",
          createdBy: "leon",
        }),
      });
      if (!res.ok) return;
      const { quest: parent } = await res.json();
      for (const step of template.steps) {
        await fetch("/api/quest", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
          body: JSON.stringify({
            title: step,
            priority: "low",
            type: "learning",
            parentQuestId: parent.id,
            createdBy: "leon",
          }),
        });
      }
      setSuccess(template.id);
      setTimeout(() => setSuccess(null), 3000);
      onRefresh();
    } catch { /* ignore */ } finally {
      setCreating(null);
    }
  };

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#3b82f6" }}>
          Learning Workshop
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)" }}>
          {learningActive.length} active · {learningDone} done
        </span>
      </div>

      {learningActive.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {learningActive.slice(0, 4).map(q => (
            <div key={q.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <span className="text-xs" style={{ color: "rgba(59,130,246,0.7)" }}>·</span>
              <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>{q.title}</span>
              {q.progress && (
                <span className="text-xs font-mono" style={{ color: "#3b82f6" }}>{q.progress.completed}/{q.progress.total}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {LEARNING_TEMPLATES.map(t => {
          const isCreating = creating === t.id;
          const isDone = success === t.id;
          return (
            <div key={t.id} className="rounded-xl p-4" style={{ background: "#252525", border: "1px solid rgba(59,130,246,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl flex-shrink-0">{t.icon}</span>
                <p className="text-xs font-bold" style={{ color: "#f0f0f0" }}>{t.name}</p>
              </div>
              <div className="space-y-1 mb-3">
                {t.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: "rgba(59,130,246,0.5)" }}>◦</span>
                    <span className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.4)" }}>{step}</span>
                  </div>
                ))}
              </div>
              {reviewApiKey ? (
                <button
                  onClick={() => createChain(t)}
                  disabled={!!creating}
                  className="action-btn btn-primary w-full text-xs py-1.5 rounded-lg font-semibold"
                  style={{
                    background: isDone ? "rgba(34,197,94,0.15)" : isCreating ? "rgba(255,255,255,0.04)" : "rgba(59,130,246,0.15)",
                    color: isDone ? "#22c55e" : isCreating ? "rgba(255,255,255,0.3)" : "#3b82f6",
                    border: `1px solid ${isDone ? "rgba(34,197,94,0.3)" : "rgba(59,130,246,0.3)"}`,
                  }}
                >
                  {isDone ? "✓ Quest Chain Created!" : isCreating ? "Creating…" : "Start Quest Chain"}
                </button>
              ) : (
                <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>Login to create</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Household Quest Board ────────────────────────────────────────────────────

const CHORE_TEMPLATES = [
  { title: "Vacuum the apartment", recurrence: "weekly", priority: "low"    as Quest["priority"] },
  { title: "Clean bathroom",       recurrence: "weekly", priority: "medium" as Quest["priority"] },
  { title: "Do laundry",           recurrence: "weekly", priority: "medium" as Quest["priority"] },
  { title: "Wash dishes",          recurrence: "daily",  priority: "low"    as Quest["priority"] },
  { title: "Take out trash",       recurrence: "weekly", priority: "low"    as Quest["priority"] },
  { title: "Grocery shopping",     recurrence: "weekly", priority: "medium" as Quest["priority"] },
];

export function HouseholdQuestBoard({ quests, users, reviewApiKey, onRefresh }: {
  quests: QuestsData;
  users: User[];
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [rotating, setRotating] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const householdQuests = [...quests.open, ...quests.inProgress].filter(
    q => q.type === "personal" && q.recurrence
  );

  const rotate = async () => {
    if (!reviewApiKey || users.length === 0 || householdQuests.length === 0) return;
    setRotating(true);
    try {
      await fetch("/api/quests/household-rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({ assignees: users.map(u => u.id) }),
      });
      onRefresh();
    } catch { /* ignore */ } finally {
      setRotating(false);
    }
  };

  const addChore = async (chore: (typeof CHORE_TEMPLATES)[0]) => {
    if (!reviewApiKey) return;
    setAdding(chore.title);
    try {
      await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: chore.title,
          type: "personal",
          priority: chore.priority,
          recurrence: chore.recurrence,
          createdBy: "leon",
        }),
      });
      onRefresh();
    } catch { /* ignore */ } finally {
      setAdding(null);
    }
  };

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#22c55e" }}>
          Household Board
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
          {householdQuests.length} chores
        </span>
        {reviewApiKey && users.length > 0 && (
          <button
            onClick={rotate}
            disabled={rotating || householdQuests.length === 0}
            className="action-btn btn-approve ml-auto text-xs px-3 py-1 rounded-lg"
            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            {rotating ? "Rotating…" : "↻ Rotate Assignments"}
          </button>
        )}
      </div>

      {householdQuests.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
          {householdQuests.map(q => (
            <div key={q.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: "#252525", border: "1px solid rgba(34,197,94,0.15)" }}>
              <span className="text-base flex-shrink-0" style={{ color: "#22c55e" }}>·</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "#e8e8e8" }}>{q.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {q.recurrence && <RecurringBadge recurrence={q.recurrence} />}
                  {q.claimedBy && (
                    <span className="text-xs" style={{ color: "rgba(34,197,94,0.7)" }}>→ {q.claimedBy}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl p-3 mb-3" style={{ background: "#252525", border: "1px solid rgba(34,197,94,0.1)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No recurring household chores yet. Add some below.</p>
        </div>
      )}

      {reviewApiKey && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {CHORE_TEMPLATES.map(c => (
            <button
              key={c.title}
              onClick={() => addChore(c)}
              disabled={!!adding}
              className="action-btn text-xs px-2 py-1.5 rounded-lg text-left truncate"
              style={{
                background: adding === c.title ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              + {c.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Thoughtful Hero Panel ─────────────────────────────────────────────────────

const THOUGHTFUL_PROMPTS = [
  { icon: "🎁", title: "Gift Idea Reminder",  desc: "Note a gift idea for someone special",                 priority: "low"    as Quest["priority"] },
  { icon: "📞", title: "Call Reminder",        desc: "Schedule a call with someone you care about",          priority: "medium" as Quest["priority"] },
  { icon: "🌹", title: "Plan Date Night",      desc: "Plan a special date or quality time together",         priority: "high"   as Quest["priority"] },
  { icon: "💌", title: "Send a Kind Message",  desc: "Reach out and say something thoughtful",               priority: "low"    as Quest["priority"] },
  { icon: "🥂", title: "Celebrate Someone",    desc: "Celebrate an achievement or milestone in their life",  priority: "medium" as Quest["priority"] },
  { icon: "🤝", title: "Check In",             desc: "Check in on a friend or family member",                priority: "low"    as Quest["priority"] },
];

export function ThoughtfulHeroPanel({ quests, reviewApiKey, onRefresh }: {
  quests: QuestsData;
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [creating, setCreating] = useState<string | null>(null);

  const socialActive = [...quests.open, ...quests.inProgress].filter(q => q.type === "social");

  const createPrompt = async (prompt: (typeof THOUGHTFUL_PROMPTS)[0]) => {
    if (!reviewApiKey) return;
    setCreating(prompt.title);
    try {
      await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: prompt.title,
          description: prompt.desc,
          type: "social",
          priority: prompt.priority,
          createdBy: "leon",
        }),
      });
      onRefresh();
    } catch { /* ignore */ } finally {
      setCreating(null);
    }
  };

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#ec4899" }}>
          Thoughtful Hero
        </h2>
        {socialActive.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(236,72,153,0.12)", color: "#ec4899", border: "1px solid rgba(236,72,153,0.3)" }}>
            {socialActive.length} active
          </span>
        )}
      </div>

      {socialActive.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {socialActive.slice(0, 5).map(q => (
            <span
              key={q.id}
              className="text-xs px-2 py-1 rounded-lg"
              style={{ background: "rgba(236,72,153,0.08)", color: "rgba(236,72,153,0.8)", border: "1px solid rgba(236,72,153,0.2)" }}
            >
              {q.title}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {THOUGHTFUL_PROMPTS.map(p => (
          <button
            key={p.title}
            onClick={() => createPrompt(p)}
            disabled={!reviewApiKey || !!creating}
            title={p.desc}
            className="action-btn btn-social rounded-xl p-3 flex flex-col items-center gap-1.5"
            style={{
              background: creating === p.title ? "rgba(236,72,153,0.15)" : "#252525",
              border: `1px solid ${creating === p.title ? "rgba(236,72,153,0.45)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <span className="text-xl">{p.icon}</span>
            <p className="text-xs font-medium leading-tight text-center" style={{ color: "#e8e8e8" }}>{p.title}</p>
          </button>
        ))}
      </div>
      {!reviewApiKey && (
        <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>Log in to create social quests</p>
      )}
    </section>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const cfg = categoryConfig[category] ?? { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)" };
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
    >
      {category}
    </span>
  );
}

export function ProductBadge({ product }: { product: string }) {
  const cfg = productConfig[product] ?? { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)" };
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, fontStyle: "italic" }}
    >
      {product}
    </span>
  );
}

export function HumanInputBadge() {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
      style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}
    >
      Needs Leon
    </span>
  );
}

export function TypeBadge({ type }: { type?: string }) {
  const cfg = typeConfig[type ?? "development"] ?? typeConfig.development;
  if (!type || type === "development") return null;
  const iconSrc = `/images/icons/cat-${type}.png`;
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 inline-flex items-center gap-1"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <img
        src={iconSrc}
        alt=""
        width={18}
        height={18}
        style={{ imageRendering: "pixelated", display: "inline", verticalAlign: "middle" }}
        onError={(e) => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement | null)?.style && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = "inline"); }}
      />
      <span style={{ display: "none" }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

const NPC_CONFIG: Record<string, { avatar: string; color: string; label?: string }> = {
  dobbie:       { avatar: "🐱", color: "#ff6b9d" },
  "npc-dobbie": { avatar: "🐱", color: "#ff6b9d" },
  system:       { avatar: "📋", color: "#94a3b8", label: "Gefunden am schwarzen Brett" },
  lyra:         { avatar: "✨", color: "#e879f9", label: "Von der Sternenwächterin" },
};

export function CreatorBadge({ name }: { name: string }) {
  const npc = NPC_CONFIG[name.toLowerCase()];
  if (npc) {
    return (
      <span
        className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ color: npc.color, background: `${npc.color}18`, border: `1px solid ${npc.color}50` }}
        title={`Quest from ${name}`}
      >
        {npc.avatar} {npc.label ?? (name.charAt(0).toUpperCase() + name.slice(1))}
      </span>
    );
  }
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}
    >
      🤖 {name.charAt(0).toUpperCase() + name.slice(1)}
    </span>
  );
}

export function AgentBadge({ name }: { name: string }) {
  return <CreatorBadge name={name} />;
}

export function RecurringBadge({ recurrence }: { recurrence: string }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: "#6366f1", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)" }}
      title={`Recurring: ${recurrence}`}
    >
      🔁 {recurrence}
    </span>
  );
}

export function CompletedQuestRow({ quest, isLast }: { quest: Quest; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cats = quest.categories?.length ? quest.categories : (quest.category ? [quest.category] : []);
  return (
    <div
      style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)" }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-xs font-mono flex-shrink-0" style={{ color: "rgba(34,197,94,0.6)" }}>✓</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{quest.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              by <span style={{ color: "rgba(255,255,255,0.35)" }}>{quest.completedBy}</span>
            </span>
            {quest.humanInputRequired && (
              <span className="text-xs" style={{ color: "rgba(245,158,11,0.6)" }}>👤</span>
            )}
          </div>
        </div>
        <PriorityBadge priority={quest.priority} />
        <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
          {quest.completedAt ? timeAgo(quest.completedAt) : "—"}
        </span>
        <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
          {quest.description && (
            <p className="text-xs leading-relaxed pt-2" style={{ color: "rgba(255,255,255,0.4)" }}>{quest.description}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {cats.map(c => <CategoryBadge key={c} category={c} />)}
            {quest.product && <ProductBadge product={quest.product} />}
          </div>
          {quest.proof && (
            <div className="mt-2 p-2 rounded" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "rgba(59,130,246,0.7)" }}>📖 Learning Proof</p>
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.4)" }}>
                {quest.proof.length > 300 ? quest.proof.slice(0, 297) + "…" : quest.proof}
              </p>
            </div>
          )}
          {quest.lore && (
            <p className="text-xs italic" style={{ color: "rgba(167,139,250,0.5)", borderLeft: "2px solid rgba(139,92,246,0.2)", paddingLeft: "8px" }}>
              ✨ {quest.lore}
            </p>
          )}
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            Completed {quest.completedAt ? timeAgo(quest.completedAt) : "—"} · by {quest.completedBy}
          </p>
        </div>
      )}
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: Quest["priority"] }) {
  const cfg = priorityConfig[priority] ?? priorityConfig.medium;
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

export function ClickablePriorityBadge({ priority, onClick }: { priority: Quest["priority"]; onClick: () => void }) {
  const cfg = priorityConfig[priority] ?? priorityConfig.medium;
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title="Click to cycle priority"
      className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, cursor: "pointer" }}
    >
      {cfg.label} ↑
    </button>
  );
}

const QUEST_BOARD_FLAVORS = [
  "Gefunden am schwarzen Brett",
  "Ein Flüstern im Wind",
  "Die Gilde bittet um Hilfe",
  "Eine alte Schriftrolle",
  "Ein dringender Auftrag",
  "Vom Schicksal bestimmt",
];

export const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#FFD700",
};

export function QuestCard({ quest, selected, onToggle, onClaim, onUnclaim, onComplete, onCoopClaim, onCoopComplete, playerName, gridMode, onDetails }: {
  quest: Quest;
  selected?: boolean;
  onToggle?: (id: string) => void;
  onClaim?: (id: string) => void;
  onUnclaim?: (id: string) => void;
  onComplete?: (id: string, title: string) => void;
  onCoopClaim?: (id: string) => void;
  onCoopComplete?: (id: string) => void;
  playerName?: string;
  gridMode?: boolean;
  onDetails?: (quest: Quest) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isInProgress = quest.status === "in_progress";
  const cats = quest.categories?.length ? quest.categories : (quest.category ? [quest.category] : []);
  const isClaimedByMe = playerName && quest.claimedBy?.toLowerCase() === playerName.toLowerCase();
  const isCoop = quest.type === "relationship-coop";
  const flavorText = QUEST_BOARD_FLAVORS[
    Math.abs((quest.id.charCodeAt(0) ?? 0) + (quest.id.charCodeAt(quest.id.length - 1) ?? 0)) % QUEST_BOARD_FLAVORS.length
  ];
  const coopPartners = quest.coopPartners ?? [];
  const coopClaimed = quest.coopClaimed ?? [];
  const coopCompletions = quest.coopCompletions ?? [];
  const isCoopPartner = playerName ? coopPartners.includes(playerName.toLowerCase()) : false;
  const hasCoopClaimed = playerName ? coopClaimed.includes(playerName.toLowerCase()) : false;
  const hasCoopCompleted = playerName ? coopCompletions.includes(playerName.toLowerCase()) : false;
  const rarity = getQuestRarity(quest);
  const rarityColor = RARITY_COLORS[rarity] ?? "#9ca3af";
  const isLegendary = rarity === "legendary";

  if (gridMode) {
    const typeCfg = typeConfig[quest.type ?? "personal"] ?? typeConfig.personal;
    return (
      <div
        data-feedback-id={`quest-board.quest-card.${quest.id}`}
        className="rounded-xl flex flex-col cursor-pointer relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #2c2318 0%, #1e1912 55%, #241e16 100%)",
          border: `2px solid ${rarityColor}88`,
          boxShadow: `0 0 ${isLegendary ? 16 : 6}px ${rarityColor}${isLegendary ? "44" : "1a"}`,
          transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
          transform: "translateY(0)",
          minHeight: 110,
        }}
        onClick={() => onDetails ? onDetails(quest) : undefined}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = `${rarityColor}cc`;
          el.style.boxShadow = `0 6px 20px ${rarityColor}40, 0 0 ${isLegendary ? 24 : 12}px ${rarityColor}30`;
          el.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = `${rarityColor}88`;
          el.style.boxShadow = `0 0 ${isLegendary ? 16 : 6}px ${rarityColor}${isLegendary ? "44" : "1a"}`;
          el.style.transform = "translateY(0)";
        }}
      >
        {/* Rarity top strip */}
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${rarityColor}bb, transparent)`, borderRadius: "10px 10px 0 0" }} />
        {/* Rarity gem — top right corner */}
        <div style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: rarityColor, boxShadow: `0 0 7px ${rarityColor}`, opacity: 0.88 }} />
        {/* Card body */}
        <div className="p-3 flex-1">
          <div className="flex items-start gap-2 mb-1.5">
            <span className="flex-shrink-0 inline-flex" style={{ lineHeight: 1.2 }}>
              <img
                src={`/images/icons/cat-${quest.type === "relationship-coop" ? "coop" : quest.type}.png`}
                alt=""
                width={18}
                height={18}
                style={{ imageRendering: "pixelated" }}
                onError={(e) => { e.currentTarget.style.display = "none"; const next = e.currentTarget.nextElementSibling as HTMLElement; if (next) next.style.display = "inline"; }}
              />
              <span style={{ display: "none" }}>{typeCfg.icon}</span>
            </span>
            <p className="text-sm font-semibold leading-snug" style={{ color: isInProgress ? "#c4b5fd" : "#e8d5a3" }}>{quest.title}</p>
          </div>
          <p className="text-xs italic" style={{ color: "rgba(220,185,120,0.35)" }}>{flavorText}</p>
        </div>
        {/* Card footer — rewards */}
        <div className="px-3 pb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {(quest.rewards?.xp ?? 0) > 0 && (
              <span className="text-xs font-mono" style={{ color: "#b39ddb" }}>{quest.rewards!.xp} XP</span>
            )}
            {(quest.rewards?.gold ?? 0) > 0 && (
              <span className="text-xs font-mono" style={{ color: "#fbbf24" }}>🪙 {quest.rewards!.gold}</span>
            )}
          </div>
          <span className="text-xs uppercase font-mono" style={{ color: `${rarityColor}aa`, fontSize: 9, letterSpacing: "0.06em" }}>{rarity}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-feedback-id={`quest-board.quest-card.${quest.id}`}
      className="rounded-lg p-3 cursor-pointer relative overflow-hidden"
      style={{
        background: selected ? "linear-gradient(160deg, #2e2010 0%, #1e1a10 100%)" : "linear-gradient(160deg, #2a2016 0%, #1c1810 60%, #221d14 100%)",
        border: `1px solid ${selected ? "rgba(255,102,51,0.6)" : isInProgress ? `${rarityColor}55` : `${rarityColor}44`}`,
        boxShadow: isInProgress ? `0 0 10px ${rarityColor}22` : isLegendary ? `0 0 12px ${rarityColor}30` : "none",
        transform: "translateY(0)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
      }}
      onClick={() => setExpanded(v => !v)}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = selected ? "rgba(255,102,51,0.8)" : `${rarityColor}88`;
        el.style.boxShadow = `0 6px 18px ${rarityColor}30`;
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = selected ? "rgba(255,102,51,0.6)" : isInProgress ? `${rarityColor}55` : `${rarityColor}44`;
        el.style.boxShadow = isInProgress ? `0 0 10px ${rarityColor}22` : isLegendary ? `0 0 12px ${rarityColor}30` : "none";
        el.style.transform = "translateY(0)";
      }}
    >
      {/* Rarity left accent line */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg, ${rarityColor}cc, ${rarityColor}44)`, borderRadius: "8px 0 0 8px" }} />
      <div className="flex items-start gap-2">
        {onToggle && (
          <button
            onClick={e => { e.stopPropagation(); onToggle(quest.id); }}
            className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center"
            style={{
              background: selected ? "rgba(255,102,51,0.8)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${selected ? "rgba(255,102,51,0.9)" : "rgba(255,255,255,0.15)"}`,
            }}
          >
            {selected && <span style={{ color: "#fff", fontSize: "8px", lineHeight: 1 }}>✓</span>}
          </button>
        )}
        {!onToggle && isInProgress && (
          <span
            className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "#8b5cf6", boxShadow: "0 0 6px #8b5cf6", animation: "pulse 1.5s ease-in-out infinite" }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium truncate flex-1" style={{ color: "#e8d5a3" }}>{quest.title}</p>
            {quest.humanInputRequired && <HumanInputBadge />}
            {quest.createdBy && quest.createdBy !== "leon" && quest.createdBy !== "unknown" && (
              <AgentBadge name={quest.createdBy} />
            )}
            <PriorityBadge priority={quest.priority} />
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <TypeBadge type={quest.type} />
            {quest.recurrence && <RecurringBadge recurrence={quest.recurrence} />}
            {cats.map(c => <CategoryBadge key={c} category={c} />)}
            {quest.product && <ProductBadge product={quest.product} />}
            {isInProgress && quest.claimedBy && !isCoop && (
              <span className="text-xs" style={{ color: "rgba(139,92,246,0.7)" }}>→ {quest.claimedBy}</span>
            )}
          </div>
          {isCoop && coopPartners.length > 0 && (
            <div className="mt-2">
              {/* Raid HP bar — decreases as partners complete */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold" style={{ color: "#f43f5e" }}>💞 Raid HP</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(0, 100 - (coopCompletions.length / coopPartners.length) * 100)}%`,
                      background: coopCompletions.length === coopPartners.length
                        ? "rgba(34,197,94,0.5)"
                        : "linear-gradient(90deg, #f43f5e, #fb7185)",
                      boxShadow: coopCompletions.length < coopPartners.length ? "0 0 6px rgba(244,63,94,0.5)" : "none",
                    }}
                  />
                </div>
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{coopCompletions.length}/{coopPartners.length}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {coopPartners.map(p => {
                  const done = coopCompletions.includes(p);
                  const claimed = coopClaimed.includes(p);
                  return (
                    <span key={p} className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                      style={{ background: done ? "rgba(34,197,94,0.1)" : claimed ? "rgba(244,63,94,0.1)" : "rgba(255,255,255,0.05)", color: done ? "#22c55e" : claimed ? "#f43f5e" : "rgba(255,255,255,0.3)", border: `1px solid ${done ? "rgba(34,197,94,0.3)" : claimed ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.1)"}` }}
                    >
                      {done ? "✓" : claimed ? "⚔" : "○"} {p}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {!expanded && <p className="text-xs mt-0.5 italic truncate" style={{ color: "rgba(220,185,120,0.28)" }}>{flavorText}</p>}
          {expanded && quest.description && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "rgba(220,195,140,0.6)", fontStyle: "italic", borderLeft: `2px solid ${rarityColor}44`, paddingLeft: 8 }}>{quest.description}</p>
          )}
          {expanded && quest.lore && (
            <p className="text-xs mt-1.5 leading-relaxed italic" style={{ color: "rgba(167,139,250,0.6)", borderLeft: "2px solid rgba(139,92,246,0.25)", paddingLeft: "8px" }}>
              ✨ {quest.lore}
            </p>
          )}
          {expanded && quest.chapter && (
            <span className="inline-flex text-xs mt-1 px-1.5 py-0.5 rounded" style={{ color: "rgba(251,191,36,0.7)", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
              📖 {quest.chapter}
            </span>
          )}
          {expanded && quest.checklist && quest.checklist.length > 0 && (
            <div className="mt-2 space-y-1">
              {quest.checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span style={{ color: item.done ? "#22c55e" : "rgba(255,255,255,0.25)" }}>{item.done ? "☑" : "☐"}</span>
                  <span style={{ color: item.done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)", textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{timeAgo(quest.createdAt)}</p>
            <div className="flex items-center gap-1.5">
              {!isCoop && onClaim && quest.status === "open" && (
                <button onClick={e => { e.stopPropagation(); onClaim(quest.id); }} className="text-xs font-bold" style={{ background: "radial-gradient(circle at 40% 35%, #c0392b, #7b1a10)", color: "#ffd6a5", border: "2px solid #8b2010", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,180,100,0.2)", flexShrink: 0, padding: 0 }} title="Claim quest">⚔</button>
              )}
              {!isCoop && onUnclaim && isClaimedByMe && (
                <button onClick={e => { e.stopPropagation(); onUnclaim(quest.id); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>✕ Unclaim</button>
              )}
              {!isCoop && onComplete && isClaimedByMe && (
                <button onClick={e => { e.stopPropagation(); onComplete(quest.id, quest.title); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>✓ Done</button>
              )}
              {isCoop && isCoopPartner && !hasCoopClaimed && quest.status !== "completed" && onCoopClaim && (
                <button onClick={e => { e.stopPropagation(); onCoopClaim(quest.id); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(244,63,94,0.12)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.3)" }}>💞 Join</button>
              )}
              {isCoop && isCoopPartner && hasCoopClaimed && !hasCoopCompleted && quest.status !== "completed" && onCoopComplete && (
                <button onClick={e => { e.stopPropagation(); onCoopComplete(quest.id); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>✓ My Part Done</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EpicQuestCard({ quest, selected, onToggle }: { quest: Quest; selected?: boolean; onToggle?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isInProgress = quest.status === "in_progress";
  const cats = quest.categories?.length ? quest.categories : (quest.category ? [quest.category] : []);
  const progress = quest.progress;
  const children = quest.children ?? [];
  const progressPct = progress && progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div
      className="rounded-lg cursor-pointer"
      style={{
        background: selected ? "rgba(255,102,51,0.06)" : "#252525",
        border: `1px solid ${selected ? "rgba(255,102,51,0.4)" : "rgba(255,165,0,0.3)"}`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(255,165,0,0.15)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      {/* Header row */}
      <div className="p-3" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start gap-2">
          {onToggle && (
            <button
              onClick={e => { e.stopPropagation(); onToggle(quest.id); }}
              className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center"
              style={{
                background: selected ? "rgba(255,102,51,0.8)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${selected ? "rgba(255,102,51,0.9)" : "rgba(255,255,255,0.15)"}`,
              }}
            >
              {selected && <span style={{ color: "#fff", fontSize: "8px", lineHeight: 1 }}>✓</span>}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,165,0,0.7)" }}>◆</span>
              <p className="text-xs font-semibold truncate flex-1" style={{ color: "#e8e8e8" }}>{quest.title}</p>
              {quest.humanInputRequired && <HumanInputBadge />}
              <PriorityBadge priority={quest.priority} />
              <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
                {expanded ? "▲" : "▼"}
              </span>
            </div>
            {/* Progress bar / Boss HP bar */}
            {progress && progress.total > 0 && (
              <div className="mt-2">
                {quest.type === "boss" ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                        🐉 Boss HP
                      </span>
                      <span className="text-xs font-mono" style={{ color: progressPct === 100 ? "#22c55e" : "#ef4444" }}>
                        {progressPct === 100 ? "DEFEATED!" : `${Math.round(100 - progressPct)}% HP`}
                      </span>
                    </div>
                    <div className="w-full rounded-full" style={{ height: 6, background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="rounded-full transition-all duration-700"
                        style={{
                          height: 6,
                          width: `${Math.max(0, 100 - progressPct)}%`,
                          background: progressPct >= 70 ? "#22c55e" : progressPct >= 40 ? "#f59e0b" : "linear-gradient(90deg, #ef4444, #ff6b00)",
                          boxShadow: progressPct < 40 ? "0 0 8px rgba(239,68,68,0.6)" : "none",
                        }}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{progress.completed}/{progress.total} sub-quests dealt damage</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {progress.completed}/{progress.total} sub-quests
                      </span>
                      <span className="text-xs font-mono" style={{ color: progressPct === 100 ? "#22c55e" : "rgba(255,165,0,0.7)" }}>
                        {Math.round(progressPct)}%
                      </span>
                    </div>
                    <div className="w-full rounded-full" style={{ height: 4, background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="rounded-full"
                        style={{
                          height: 4,
                          width: `${progressPct}%`,
                          background: progressPct === 0
                            ? "#ef4444"
                            : progressPct === 100
                              ? "#22c55e"
                              : `linear-gradient(90deg, #ef4444 0%, #f59e0b ${Math.round(progressPct * 0.8)}%, #22c55e 100%)`,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <TypeBadge type={quest.type} />
              {quest.recurrence && <RecurringBadge recurrence={quest.recurrence} />}
              {cats.map(c => <CategoryBadge key={c} category={c} />)}
              {quest.product && <ProductBadge product={quest.product} />}
              {isInProgress && quest.claimedBy && (
                <span className="text-xs" style={{ color: "rgba(139,92,246,0.7)" }}>→ {quest.claimedBy}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Sub-quests */}
      {expanded && children.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {children.map((child, i) => (
            <div
              key={child.id}
              className="flex items-center gap-2 px-3 py-2"
              style={{
                borderBottom: i === children.length - 1 ? "none" : "1px solid rgba(255,255,255,0.03)",
                background: "rgba(0,0,0,0.15)",
              }}
            >
              <span className="text-xs flex-shrink-0" style={{ color: child.status === "completed" ? "#22c55e" : "rgba(255,255,255,0.2)", marginLeft: 12 }}>
                {child.status === "completed" ? "✓" : "◦"}
              </span>
              <p
                className="text-xs flex-1 truncate"
                style={{ color: child.status === "completed" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.65)", textDecoration: child.status === "completed" ? "line-through" : "none" }}
              >
                {child.title}
              </p>
              <PriorityBadge priority={child.priority} />
              {child.claimedBy && (
                <span className="text-xs flex-shrink-0" style={{ color: "rgba(139,92,246,0.6)" }}>{child.claimedBy}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function UserCard({ user, classes = [] }: { user: User; classes?: ClassDef[] }) {
  const xp = user.xp ?? 0;
  const lvl = getUserLevel(xp);
  const progress = getUserXpProgress(xp);
  const nextLvlEntry = GUILD_LEVELS[lvl.level]; // level is 1-based, array idx = level
  const isMilestoneLevel = lvl.level === 10 || lvl.level === 20 || lvl.level === 30;
  const streak = user.streakDays ?? 0;
  const temp = Math.min(user.forgeTemp ?? 0, 100);
  const gold = user.gold ?? 0;
  const achs = user.earnedAchievements ?? [];
  const tempIcon = temp <= 33 ? "🔴" : temp <= 66 ? "🟠" : "🔵";
  const tempColor = temp <= 33 ? "#ef4444" : temp <= 66 ? "#f97316" : "#60a5fa";
  const goldMultiplier = (1 + (temp / 100) * 0.5).toFixed(1);
  const xpMalus = temp === 0;
  const forgeInfo = getForgeTempInfo(temp);

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "#252525",
        border: `1px solid ${isMilestoneLevel ? lvl.color : lvl.color + "30"}`,
        boxShadow: isMilestoneLevel ? `0 0 20px ${lvl.color}30` : `0 0 16px ${lvl.color}10`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${user.color}, ${user.color}99)`, boxShadow: `0 4px 14px ${user.color}50`, color: "#fff" }}
        >
          {user.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{user.name}</p>
            {streak > 0 && (
              <span
                className="text-xs font-bold flex items-center gap-0.5"
                style={{ color: streak >= 30 ? "#ef4444" : streak >= 7 ? "#f59e0b" : "#fb923c" }}
                title={`${streak} day streak!`}
              >
                🔥{streak}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold" style={{ color: lvl.color }}>
            {isMilestoneLevel && "✦ "}Lv {lvl.level}: {lvl.title}
          </p>
        </div>
        {/* Gold */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-mono font-bold" style={{ color: "#f59e0b" }} title="Gold">🪙 {gold}</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Quests</span>
          <span className="text-xs font-mono font-medium" style={{ color: "#8b5cf6" }}>{user.questsCompleted ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>XP{xpMalus ? " ⚠ −50%" : ""}</span>
          <span className="text-xs font-mono font-medium" style={{ color: xpMalus ? "#ef4444" : lvl.color }}>{xp}{nextLvlEntry ? ` / ${nextLvlEntry.xpRequired}` : " MAX"}</span>
        </div>
      </div>

      {/* XP Bar */}
      <div className="rounded-full overflow-hidden mb-2" style={{ height: 4, background: "rgba(255,255,255,0.07)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.round(progress * 100)}%`, background: `linear-gradient(90deg, ${lvl.color}99, ${lvl.color})`, boxShadow: `0 0 6px ${lvl.color}80` }}
        />
      </div>

      {/* Forge Temperature */}
      <div className="mb-2" title={forgeInfo.tooltipText}>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: tempColor }}>
            {tempIcon} {temp}% <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>|</span> <span style={{ color: "#f59e0b" }}>💰 {goldMultiplier}x</span>
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Forge Temp</span>
        </div>
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{forgeInfo.actionSuggestion}</p>
        <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${temp}%`, background: `linear-gradient(90deg, ${tempColor}99, ${tempColor})`, boxShadow: `0 0 5px ${tempColor}60` }}
          />
        </div>
      </div>

      {/* Gear badge */}
      {user.gear && user.gear !== "worn" && (() => {
        const GEAR_ICONS: Record<string, { icon: string; name: string; bonus: number }> = {
          sturdy:     { icon: "⚒",  name: "Sturdy Tools",     bonus: 5  },
          masterwork: { icon: "🛠",  name: "Masterwork Tools", bonus: 10 },
          legendary:  { icon: "⚙",  name: "Legendary Tools",  bonus: 15 },
          mythic:     { icon: "🔱", name: "Mythic Forge",     bonus: 25 },
        };
        const g = GEAR_ICONS[user.gear];
        if (!g) return null;
        return (
          <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <span className="text-sm">{g.icon}</span>
            <span className="text-xs font-semibold" style={{ color: "#818cf8" }}>{g.name}</span>
            <span className="text-xs ml-auto" style={{ color: "rgba(99,102,241,0.6)" }}>+{g.bonus}% XP</span>
          </div>
        );
      })()}

      {/* Class Badge */}
      {user.classId && (() => {
        const cls = classes.find(c => c.id === user.classId);
        if (user.classPending && !cls) {
          // Class is pending (not yet active)
          return (
            <div
              className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              <span className="text-sm" style={{ animation: "pulse-online 1.5s ease-in-out infinite" }}>⚒️</span>
              <span className="text-xs font-semibold" style={{ color: "rgba(245,158,11,0.7)" }}>Klasse wird geschmiedet...</span>
            </div>
          );
        }
        if (cls) {
          const tier = cls.tiers ? [...cls.tiers].reverse().find(t => (user.xp ?? 0) >= t.minXp) : null;
          return (
            <div
              className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg"
              style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)" }}
            >
              <span className="text-sm">{cls.icon}</span>
              <span className="text-xs font-semibold" style={{ color: "#a78bfa" }}>{cls.fantasy}</span>
              {tier && <span className="text-xs ml-auto" style={{ color: "rgba(167,139,250,0.55)" }}>{tier.title}</span>}
            </div>
          );
        }
        return null;
      })()}

      {/* Companion Badge */}
      {user.companion && (() => {
        const c = user.companion!;
        return (
          <div
            className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-sm">{c.emoji}</span>
            <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{c.name}</span>
            {c.isReal && <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.25)" }}>🐾 Haustier</span>}
          </div>
        );
      })()}

      {/* Companions with Moods */}
      {(() => {
        const COMPANION_IDS = ["ember_sprite", "lore_owl", "gear_golem"];
        const COMPANION_META: Record<string, { icon: string; name: string }> = {
          ember_sprite: { icon: "🔮", name: "Ember Sprite" },
          lore_owl:     { icon: "🦉", name: "Lore Owl" },
          gear_golem:   { icon: "🤖", name: "Gear Golem" },
        };
        const companions = achs.filter(a => COMPANION_IDS.includes(a.id));
        if (companions.length === 0) return null;
        // Companion mood based on streak
        const mood = streak >= 7 ? { emoji: "😊", label: "happy", anim: "animate-bounce", tip: "Happy! Keep the streak going!" }
                   : streak >= 3 ? { emoji: "😐", label: "neutral", anim: "", tip: "Neutral. Complete quests to cheer them up!" }
                   : { emoji: "😔", label: "sad", anim: "animate-pulse", tip: "Sad. No recent quests — your companions miss you!" };
        return (
          <div className="mt-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Companions:</span>
              {companions.map(c => (
                <span
                  key={c.id}
                  className={"text-sm " + mood.anim}
                  title={`${COMPANION_META[c.id]?.name ?? c.name} (+2% XP) — ${mood.tip}`}
                  style={{ cursor: "default" }}
                >
                  {COMPANION_META[c.id]?.icon ?? c.icon}
                </span>
              ))}
              <span className="text-xs ml-auto" style={{ color: "rgba(99,102,241,0.5)" }}>+{companions.length * 2}% XP</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs" title={mood.tip}>{mood.emoji}</span>
              <span className="text-xs" style={{ color: mood.label === "happy" ? "#22c55e" : mood.label === "sad" ? "#ef4444" : "rgba(255,255,255,0.25)" }}>
                {mood.label === "happy" ? "Companions are happy!" : mood.label === "sad" ? "Companions need attention" : "Companions are fine"}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Achievement badges */}
      {achs.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {achs.filter(a => !["ember_sprite","lore_owl","gear_golem"].includes(a.id)).slice(-6).map(a => (
            <span
              key={a.id}
              className="text-sm"
              title={`${a.name}: ${a.desc}`}
              style={{ cursor: "default" }}
            >
              {a.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shop Modal ───────────────────────────────────────────────────────────────
const GEAR_TIERS_CLIENT = [
  { id: "worn",       name: "Worn Tools",       cost: 0,    tier: 0, xpBonus: 0,  icon: "🔨", desc: "Starting gear. No bonus." },
  { id: "sturdy",     name: "Sturdy Tools",     cost: 100,  tier: 1, xpBonus: 5,  icon: "⚒",  desc: "+5% XP on all quests" },
  { id: "masterwork", name: "Masterwork Tools", cost: 300,  tier: 2, xpBonus: 10, icon: "🛠",  desc: "+10% XP on all quests" },
  { id: "legendary",  name: "Legendary Tools",  cost: 700,  tier: 3, xpBonus: 15, icon: "⚙",  desc: "+15% XP on all quests" },
  { id: "mythic",     name: "Mythic Forge",     cost: 1500, tier: 4, xpBonus: 25, icon: "🔱", desc: "+25% XP on all quests" },
];

export function ShopModal({ userId, userName, gold, currentGear, onClose, onBuy, onGearBuy }: {
  userId: string;
  userName: string;
  gold: number;
  currentGear?: string;
  onClose: () => void;
  onBuy: (itemId: string) => void;
  onGearBuy?: (gearId: string) => void;
}) {
  const ITEMS: ShopItem[] = [
    { id: "gaming_1h",   name: "1h Gaming",    cost: 100, icon: "🎮", desc: "1 hour of guilt-free gaming" },
    { id: "snack_break", name: "Snack Break",   cost: 25,  icon: "🍕", desc: "Treat yourself to a snack" },
    { id: "day_off",     name: "Day Off Quest", cost: 500, icon: "🏖", desc: "Skip one day of recurring quests" },
    { id: "movie_night", name: "Movie Night",   cost: 150, icon: "🎬", desc: "Evening off for a movie" },
    { id: "sleep_in",    name: "Sleep In",      cost: 75,  icon: "😴", desc: "Extra hour of sleep, guilt-free" },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-5 w-full max-w-sm"
        style={{ background: "#1e1e1e", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 0 40px rgba(245,158,11,0.1)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>⚒ Forge Shop</h3>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{userName} · 🪙 {gold} gold</p>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {ITEMS.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{item.name}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{item.desc}</p>
              </div>
              <button
                onClick={() => onBuy(item.id)}
                disabled={gold < item.cost}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                style={{
                  background: gold >= item.cost ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                  color: gold >= item.cost ? "#f59e0b" : "rgba(255,255,255,0.2)",
                  border: `1px solid ${gold >= item.cost ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`,
                  cursor: gold >= item.cost ? "pointer" : "not-allowed",
                }}
              >
                🪙 {item.cost}
              </button>
            </div>
          ))}

          {/* Gear upgrade section */}
          {onGearBuy && (
            <>
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(99,102,241,0.7)" }}>⚒ Workshop Tools</p>
              </div>
              {GEAR_TIERS_CLIENT.filter(g => g.tier > 0).map(gear => {
                const currentTier = GEAR_TIERS_CLIENT.find(g => g.id === (currentGear || "worn"))?.tier ?? 0;
                const owned = gear.tier <= currentTier;
                const canBuy = !owned && gear.tier === currentTier + 1 && gold >= gear.cost;
                return (
                  <div
                    key={gear.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: owned ? "rgba(99,102,241,0.1)" : "#252525",
                      border: `1px solid ${owned ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.07)"}`,
                      opacity: owned || canBuy || gear.tier === currentTier + 1 ? 1 : 0.4,
                    }}
                  >
                    <span className="text-xl flex-shrink-0">{gear.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: owned ? "#818cf8" : "#f0f0f0" }}>
                        {gear.name} {owned ? "✓" : ""}
                      </p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{gear.desc}</p>
                    </div>
                    {!owned && (
                      <button
                        onClick={() => onGearBuy(gear.id)}
                        disabled={!canBuy}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                        style={{
                          background: canBuy ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                          color: canBuy ? "#818cf8" : "rgba(255,255,255,0.2)",
                          border: `1px solid ${canBuy ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                          cursor: canBuy ? "pointer" : "not-allowed",
                        }}
                      >
                        🪙 {gear.cost}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Achievement Toast ────────────────────────────────────────────────────────
export function ChainQuestToast({ parentTitle, template, onAccept, onDismiss }: {
  parentTitle: string;
  template: { title: string; description?: string | null; type?: string; priority?: string };
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const typeCfg = template.type ? (typeConfig[template.type] ?? null) : null;
  return (
    <div
      className="fixed bottom-36 right-6 z-50 rounded-xl px-4 py-3 shadow-2xl"
      style={{ background: "#252525", border: "1px solid rgba(139,92,246,0.5)", boxShadow: "0 8px 32px rgba(139,92,246,0.2)", maxWidth: 320 }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">⛓</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold mb-0.5" style={{ color: "#a78bfa" }}>Quest Chain Available!</p>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Completed: <span style={{ color: "rgba(255,255,255,0.6)" }}>{parentTitle}</span>
          </p>
          <p className="text-sm font-semibold mb-1" style={{ color: "#e8e8e8" }}>{template.title}</p>
          {template.description && (
            <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>{template.description}</p>
          )}
          <div className="flex items-center gap-1 mb-3">
            {typeCfg && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: typeCfg.bg, color: typeCfg.color, border: `1px solid ${typeCfg.border}` }}>
                {typeCfg.icon} {typeCfg.label}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAccept}
              className="flex-1 text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}
            >
              ⚔ Accept Quest
            </button>
            <button
              onClick={onDismiss}
              className="text-xs px-2 py-1.5 rounded"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Skip
            </button>
          </div>
        </div>
        <button onClick={onDismiss} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>✕</button>
      </div>
    </div>
  );
}

export function AchievementToast({ achievement, onClose }: { achievement: EarnedAchievement; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", pointerEvents: "auto" }} onClick={onClose}>
    <div
      className="rounded-xl px-6 py-5 flex items-center gap-4 shadow-2xl"
      style={{ background: "#252525", border: "1px solid rgba(245,158,11,0.5)", boxShadow: "0 8px 48px rgba(245,158,11,0.3)", maxWidth: 360, pointerEvents: "auto" }}
      onClick={e => e.stopPropagation()}
    >
      <span className="text-2xl flex-shrink-0">{achievement.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: "#f59e0b" }}>Achievement Unlocked!</p>
        <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{achievement.name}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{achievement.desc}</p>
      </div>
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
    </div>
    </div>
  );
}

// ─── Flavor Toast ─────────────────────────────────────────────────────────────
export function FlavorToast({ toast, onClose }: { toast: { message: string; icon: string; sub?: string }; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className="fixed bottom-6 right-6 z-[110] rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl"
      style={{ background: "#1e2a1e", border: "1px solid rgba(34,197,94,0.4)", boxShadow: "0 8px 32px rgba(34,197,94,0.15)", maxWidth: 280 }}
    >
      <span className="text-2xl flex-shrink-0">{toast.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: "#22c55e" }}>{toast.message}</p>
        {toast.sub && <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{toast.sub}</p>}
      </div>
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>✕</button>
    </div>
  );
}

export function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>{message}</p>
      {sub && <p className="text-xs mt-2 font-mono" style={{ color: "rgba(255,68,68,0.3)" }}>{sub}</p>}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div
      className="rounded-xl animate-pulse"
      style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.05)", height: 260 }}
    />
  );
}

