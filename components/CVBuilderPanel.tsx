"use client";

import { useState } from "react";
import type { QuestsData, User, CVData } from "@/app/types";
import { getAuthHeaders } from "@/lib/auth-client";

export default function CVBuilderPanel({ quests, users, playerName, reviewApiKey }: { quests: QuestsData; users: User[]; playerName: string; reviewApiKey?: string }) {
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeUser, setActiveUser] = useState(playerName || "");

  const loadCV = async (userId: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/cv-export?userId=${encodeURIComponent(userId)}`, { headers: getAuthHeaders(reviewApiKey) });
      if (r.ok) {
        const data = await r.json();
        setCvData(data);
        setOpen(true);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const isPlayerQuest = (q: QuestsData["open"][number]) => !q.npcGiverId && !q.npcName;
  const completedLearning = quests.completed.filter(q => q.type === "learning" && isPlayerQuest(q)).length;
  const allLearning = [...quests.open, ...quests.inProgress, ...quests.completed].filter(q => q.type === "learning" && isPlayerQuest(q)).length;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#60a5fa" }}>Klassenquests</h2>
          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }}>
            {completedLearning} skills tracked
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{open ? "▲" : "▼"}</span>
        </button>
        <div className="ml-auto flex items-center gap-2">
        </div>
      </div>
      {open && cvData && (
        <div className="rounded-xl p-4" style={{ background: "#252525", border: "1px solid rgba(96,165,250,0.2)" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{activeUser ? `${activeUser}'s Skill Profile` : "All Players Skill Profile"}</p>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{cvData.totalLearningQuests} learning quests completed</span>
          </div>
          {cvData.skills.length === 0 ? (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>No completed learning quests yet. Start a quest chain in the Learning Workshop!</p>
          ) : (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(96,165,250,0.7)" }}>Skill Tree</h3>
              <div className="space-y-2 mb-4">
                {cvData.skills.map(skill => {
                  const tiers = [
                    { label: "Novice",     icon: "", min: 1,  max: 2,  color: "#22c55e" },
                    { label: "Apprentice", icon: "", min: 3,  max: 5,  color: "#60a5fa" },
                    { label: "Skilled",    icon: "",  min: 6,  max: 9,  color: "#a78bfa" },
                    { label: "Expert",     icon: "", min: 10, max: 999, color: "#fbbf24" },
                  ];
                  const tier = tiers.findLast(t => skill.count >= t.min) ?? tiers[0];
                  const nextTier = tiers[tiers.indexOf(tier) + 1];
                  const progressInTier = nextTier
                    ? ((skill.count - tier.min) / (nextTier.min - tier.min)) * 100
                    : 100;
                  return (
                    <div key={skill.name} className="rounded-lg px-3 py-2" style={{ background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.12)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{tier.icon}</span>
                          <span className="text-xs font-medium" style={{ color: "#e8e8e8" }}>{skill.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold" style={{ color: tier.color }}>{tier.label}</span>
                          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>×{skill.count}</span>
                        </div>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${progressInTier}%`, background: tier.color, opacity: 0.7 }}
                        />
                      </div>
                      {nextTier && (
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {nextTier.min - skill.count} more to {nextTier.label}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {cvData.certifications.length > 0 && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(251,191,36,0.7)" }}>Certifications</h3>
              <div className="space-y-1">
                {cvData.certifications.map((cert, i) => {
                  const earnedDate = cert.earnedAt ? new Date(cert.earnedAt) : null;
                  const earnedValid = earnedDate && Number.isFinite(earnedDate.getTime());
                  return (
                    <div key={`${cert.title}-${cert.earnedAt || i}`} className="flex items-center gap-2 text-xs">
                      <span style={{ color: "#fbbf24" }}>★</span>
                      <span style={{ color: "#e8e8e8" }}>{cert.title}</span>
                      {earnedValid && <span style={{ color: "rgba(255,255,255,0.45)" }}>{earnedDate!.toLocaleDateString()}</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
      {!open && allLearning > 0 && (
        <div className="flex gap-2 flex-wrap">
          {quests.completed.filter(q => q.type === "learning" && !q.npcGiverId && !q.npcName).slice(0, 6).map(q => (
            <div key={q.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
              <span className="text-xs" style={{ color: "rgba(96,165,250,0.6)" }}>·</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{q.title}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
