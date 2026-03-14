"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  Quest, QuestsData, User, ForgeChallengeTemplate, PersonalTemplate,
} from "@/app/types";
import { timeAgo } from "@/app/utils";
import { RecurringBadge } from "./QuestBadges";

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
          <button onClick={onClose} style={{ color: "rgba(200,170,100,0.4)", fontSize: 16 }}>×</button>
        </div>
        <div className="flex border-b overflow-x-auto" style={{ borderColor: "rgba(180,140,70,0.15)" }}>
          {([
            { key: "personal",   label: "Personal",   iconSrc: "/images/icons/cat-personal.png",  fallback: "" },
            { key: "learning",   label: "Learning",   iconSrc: "/images/icons/cat-learning.png",  fallback: "" },
            { key: "household",  label: "Household",  iconSrc: "/images/icons/cat-personal.png",  fallback: "" },
            { key: "social",     label: "Social",     iconSrc: "/images/icons/cat-social.png",    fallback: "" },
            { key: "coop",       label: "Co-op",      iconSrc: "/images/icons/cat-coop.png",      fallback: "" },
            { key: "challenges", label: "Challenges", iconSrc: "",                                fallback: "" /* TODO: no pixel art icon yet */ },
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
  const typeIcons: Record<string, string> = { personal: "·", learning: "·", fitness: "·", social: "·" };
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

// ─── Relationship Co-op Panel ─────────────────────────────────────────────────

const COOP_TEMPLATES = [
  { id: "weekend_trip", title: "Plan Weekend Trip Together", description: "Research destinations, agree on dates, book accommodation.", icon: "/images/icons/cat-coop.png" },
  { id: "cook_dinner", title: "Cook Dinner as a Team", description: "Choose a recipe together, shop ingredients, cook and enjoy.", icon: "/images/icons/cat-coop.png" },
  { id: "watch_movie", title: "Movie Night Both Wanted", description: "Pick a movie you've both been wanting to watch, make popcorn.", icon: "/images/icons/cat-coop.png" },
  { id: "workout_together", title: "Workout Session Together", description: "Go for a run, gym session, or home workout — both complete it.", icon: "/images/icons/cat-coop.png" },
  { id: "digital_detox", title: "1-Hour Digital Detox Together", description: "Both put phones away, spend quality time without screens.", icon: "/images/icons/cat-coop.png" },
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

// ─── Learning Quest Panel ──────────────────────────────────────────────────────

const LEARNING_TEMPLATES = [
  {
    id: "js_mastery",
    name: "JavaScript Mastery",
    icon: "/images/icons/cat-learning.png",
    steps: ["Read MDN fundamentals", "Complete 5 coding exercises", "Build a mini project", "Write what you learned (proof)"],
  },
  {
    id: "design_system",
    name: "Design System Study",
    icon: "/images/icons/cat-learning.png",
    steps: ["Study color theory & typography", "Analyze 3 design systems", "Create a component sketch", "Document findings (proof)"],
  },
  {
    id: "habit_reading",
    name: "Daily 10-Page Reading",
    icon: "/images/icons/cat-learning.png",
    steps: ["Choose your book", "Read 10 pages", "Take margin notes", "Share 1 key insight (proof)"],
  },
  {
    id: "language",
    name: "Language Practice",
    icon: "/images/icons/cat-learning.png",
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
  { icon: "/images/icons/cat-social.png", title: "Gift Idea Reminder",  desc: "Note a gift idea for someone special",                 priority: "low"    as Quest["priority"] },
  { icon: "/images/icons/cat-social.png", title: "Call Reminder",        desc: "Schedule a call with someone you care about",          priority: "medium" as Quest["priority"] },
  { icon: "/images/icons/cat-social.png", title: "Plan Date Night",      desc: "Plan a special date or quality time together",         priority: "high"   as Quest["priority"] },
  { icon: "/images/icons/cat-social.png", title: "Send a Kind Message",  desc: "Reach out and say something thoughtful",               priority: "low"    as Quest["priority"] },
  { icon: "/images/icons/cat-social.png", title: "Celebrate Someone",    desc: "Celebrate an achievement or milestone in their life",  priority: "medium" as Quest["priority"] },
  { icon: "/images/icons/cat-social.png", title: "Check In",             desc: "Check in on a friend or family member",                priority: "low"    as Quest["priority"] },
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