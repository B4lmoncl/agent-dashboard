"use client";

import { useState, useCallback } from "react";
import { Campaign, CampaignQuest, Quest, QuestsData } from "@/app/types";
import { timeAgo } from "@/app/utils";
import { useModalBehavior } from "@/components/ModalPortal";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip } from "@/components/GameTooltip";

// ─── Campaign Hub ──────────────────────────────────────────────────────────────
const CAMPAIGN_ICONS = ["●","◆","★","◇","■","▲","◉","▣","✦","⬡","◈","▶","◎","△","□","⬢"];

export default function CampaignHub({ campaigns, quests, reviewApiKey, onRefresh }: {
  campaigns: Campaign[];
  quests: QuestsData;
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", icon: "", lore: "", bossQuestId: "", rewardXp: "", rewardGold: "", rewardTitle: "" });
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const closeCreateModal = useCallback(() => setCreateOpen(false), []);
  useModalBehavior(createOpen, closeCreateModal);

  const expandedCampaign = campaigns.find(c => c.id === expandedId);
  const allAvailableQuests = [...quests.open, ...quests.inProgress];

  const getQuestNode = (q: CampaignQuest, isBoss: boolean, isCurrentQuest: boolean, idx: number) => {
    const isDone = q.status === "completed";
    const isDeleted = q.status === "deleted";
    const isUpcoming = !isDone && !isCurrentQuest;
    let nodeColor = isDone ? "#10b981" : isCurrentQuest ? "#a78bfa" : "rgba(255,255,255,0.15)";
    let borderColor = isDone ? "rgba(16,185,129,0.4)" : isCurrentQuest ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)";
    let bg = isDone ? "rgba(16,185,129,0.06)" : isCurrentQuest ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)";
    if (isBoss && !isDone) { nodeColor = "#ef4444"; borderColor = "rgba(239,68,68,0.5)"; bg = "rgba(239,68,68,0.1)"; }

    return (
      <div key={q.id} className="flex gap-3">
        {/* Timeline spine */}
        <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 z-10"
            style={{ background: isDone ? "rgba(16,185,129,0.2)" : isBoss && !isDone ? "rgba(239,68,68,0.2)" : isCurrentQuest ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)", border: `2px solid ${nodeColor}`, color: nodeColor }}>
            {isDone ? "✓" : isBoss ? "★" : isCurrentQuest ? "◆" : String(idx + 1)}
          </div>
          <div className="flex-1 w-px mt-1" style={{ background: "rgba(139,92,246,0.2)", minHeight: 12 }} />
        </div>
        {/* Quest card */}
        <div className="flex-1 mb-2 rounded-xl p-3" style={{ background: bg, border: `1px solid ${borderColor}`, opacity: isUpcoming && !isBoss ? 0.6 : 1, boxShadow: isBoss && !isDone ? "0 0 20px rgba(239,68,68,0.15)" : isCurrentQuest ? "0 0 16px rgba(139,92,246,0.15)" : "none" }}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {isBoss && <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)" }}>BOSS</span>}
                {isCurrentQuest && !isDone && <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(167,139,250,0.2)", color: "#c4b5fd", border: "1px solid rgba(167,139,250,0.4)" }}>CURRENT</span>}
                <p className="text-sm font-semibold" style={{ color: isDone ? "rgba(255,255,255,0.5)" : isBoss ? "#fca5a5" : isCurrentQuest ? "#e9d5ff" : "rgba(255,255,255,0.5)" }}>{q.title}</p>
              </div>
              {q.lore && <p className="text-xs mt-1 italic" style={{ color: "rgba(167,139,250,0.6)" }}>{q.lore}</p>}
              {isDone && q.completedBy && (
                <p className="text-xs mt-1" style={{ color: "rgba(16,185,129,0.7)" }}>Completed by {q.completedBy}{q.completedAt ? ` · ${timeAgo(q.completedAt)}` : ""}</p>
              )}
              {!isDone && q.claimedBy && (
                <p className="text-xs mt-1" style={{ color: "rgba(167,139,250,0.6)" }}>Claimed by {q.claimedBy}</p>
              )}
              {isDeleted && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>(quest deleted)</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !reviewApiKey) return;
    setSubmitting(true);
    setCreateError("");
    try {
      const r = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          icon: form.icon,
          lore: form.lore.trim(),
          questIds: selectedQuestIds,
          bossQuestId: form.bossQuestId || null,
          rewards: { xp: Number(form.rewardXp) || 0, gold: Number(form.rewardGold) || 0, title: form.rewardTitle },
        }),
      });
      if (r.ok) {
        setCreateOpen(false);
        setForm({ title: "", description: "", icon: "", lore: "", bossQuestId: "", rewardXp: "", rewardGold: "", rewardTitle: "" });
        setSelectedQuestIds([]);
        onRefresh();
      } else {
        const d = await r.json().catch(() => ({}));
        setCreateError(d.error || "Failed to create campaign. Try again.");
      }
    } catch (err) {
      console.error("[CampaignHub] Create failed:", err);
      setCreateError("Network error. Try again.");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!reviewApiKey) return;
    setDeleteError("");
    try {
      const r = await fetch(`/api/campaigns/${id}`, { method: "DELETE", headers: { ...getAuthHeaders(reviewApiKey) } });
      if (r.ok) {
        setDeleteConfirm(null);
        if (expandedId === id) setExpandedId(null);
        onRefresh();
      } else {
        const d = await r.json().catch(() => ({}));
        setDeleteError(d.error || "Failed to delete campaign.");
        setDeleteConfirm(null);
      }
    } catch (err) {
      console.error("[CampaignHub] Delete failed:", err);
      setDeleteError("Network error. Could not delete campaign.");
      setDeleteConfirm(null);
    }
  };

  const statusColors: Record<string, { color: string; bg: string; border: string; label: string }> = {
    active:    { color: "#a78bfa", bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.3)", label: "Active" },
    completed: { color: "#34d399", bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", label: "Complete" },
    archived:  { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.2)", label: "Archived" },
  };

  // ── Expanded campaign timeline view ──────────────────────────────────────────
  if (expandedId && expandedCampaign) {
    const cq = [...(expandedCampaign.quests ?? [])].sort((a, b) => (a.chainIndex || 0) - (b.chainIndex || 0));
    const firstIncompleteIdx = cq.findIndex(q => q.status !== "completed");
    const completedCount = expandedCampaign.progress?.completed ?? 0;
    const totalCount = expandedCampaign.progress?.total ?? cq.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isVictory = expandedCampaign.status === "completed" || completedCount === totalCount && totalCount > 0;

    return (
      <div className="space-y-6">
        {/* Back button + header */}
        <div>
          <button onClick={() => setExpandedId(null)} className="flex items-center gap-2 text-xs mb-4 transition-opacity hover:opacity-100" style={{ color: "rgba(167,139,250,0.7)", opacity: 0.8 }}>
            ← Back to Campaigns
          </button>
          <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a0d2e 0%, #0d1017 100%)", border: "1px solid rgba(139,92,246,0.3)", boxShadow: "0 0 40px rgba(139,92,246,0.1)" }}>
            {isVictory && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0.06 }}>
                <span style={{ fontSize: 200 }}>★</span>
              </div>
            )}
            <div className="relative">
              <div className="flex items-start gap-4">
                <span style={{ fontSize: 40 }}>{expandedCampaign.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h2 className="text-xl font-bold" style={{ color: "#e9d5ff" }}>{expandedCampaign.title}</h2>
                    {isVictory && <span className="text-sm px-2 py-0.5 rounded font-bold" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)" }}>★ VICTORY</span>}
                    {!isVictory && <span className="text-xs px-2 py-0.5 rounded" style={statusColors[expandedCampaign.status] ?? statusColors.active}>{statusColors[expandedCampaign.status]?.label ?? expandedCampaign.status}</span>}
                  </div>
                  {expandedCampaign.lore && <p className="text-sm italic mb-2" style={{ color: "rgba(167,139,250,0.7)" }}>&quot;{expandedCampaign.lore}&quot;</p>}
                  {expandedCampaign.description && <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>{expandedCampaign.description}</p>}
                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isVictory ? "linear-gradient(90deg,#fbbf24,#f59e0b)" : "linear-gradient(90deg,#8b5cf6,#a78bfa)" }} />
                    </div>
                    <span className="text-xs font-semibold flex-shrink-0" style={{ color: isVictory ? "#fbbf24" : "#a78bfa" }}>{completedCount}/{totalCount} · {pct}%</span>
                  </div>
                </div>
              </div>
              {/* Rewards */}
              {expandedCampaign.rewards && (expandedCampaign.rewards.xp > 0 || expandedCampaign.rewards.gold > 0 || expandedCampaign.rewards.title) && (
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <span className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>Completion Rewards:</span>
                  {expandedCampaign.rewards.xp > 0 && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}>+{expandedCampaign.rewards.xp} XP</span>}
                  {expandedCampaign.rewards.gold > 0 && <span className="text-xs px-2 py-0.5 rounded inline-flex items-center gap-1" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}><img src="/images/icons/currency-gold.png" alt="" width={14} height={14} style={{ imageRendering: "auto" }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> {expandedCampaign.rewards.gold}</span>}
                  {expandedCampaign.rewards.title && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(232,121,249,0.1)", color: "#e879f9", border: "1px solid rgba(232,121,249,0.25)" }}>★ &quot;{expandedCampaign.rewards.title}&quot;</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quest Chain Timeline */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(167,139,250,0.6)" }}>Quest Chain</h3>
          {cq.length === 0 && <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>No quests in this campaign yet.</p>}
          <div>
            {cq.map((q, idx) => {
              const isBoss = q.id === expandedCampaign.bossQuestId;
              const isCurrentQuest = idx === firstIncompleteIdx;
              return getQuestNode(q, isBoss, isCurrentQuest, idx);
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Campaign cards grid ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6 tab-content-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 28 }}>◆</span>
          <div>
            <Tip k="campaigns" heading accent="#e9d5ff"><h2 className="text-lg font-bold">Campaign Hub</h2></Tip>
            <p className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>Long-form quest chains and story arcs</p>
            <p className="text-xs italic mt-0.5" style={{ color: "rgba(167,139,250,0.3)" }}>Die Sternenwächterin hat dich rufen lassen. Langform-Geschichten. Dein Vermächtnis.</p>
          </div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          style={{ background: "rgba(139,92,246,0.2)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.4)" }}
        >
          + New Campaign
        </button>
      </div>

      {deleteError && (
        <p className="text-xs" style={{ color: "#ef4444" }}>{deleteError}</p>
      )}

      {/* Empty state */}
      {campaigns.length === 0 && (
        <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.2)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>◆</div>
          <p className="text-sm font-semibold mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>No active campaigns</p>
          <p className="text-xs">Start a quest chain to begin your saga!</p>
        </div>
      )}

      {/* Campaign grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {campaigns.map(c => {
          const completed = c.progress?.completed ?? 0;
          const total = c.progress?.total ?? 0;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          const isVictory = c.status === "completed" || (completed === total && total > 0);
          const sc = statusColors[c.status] ?? statusColors.active;
          const bossInChain = c.quests?.find(q => q.id === c.bossQuestId);
          return (
            <div
              key={c.id}
              className={`rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.01]${c.status === "active" ? " crystal-breathe" : ""}`}
              style={{ background: "linear-gradient(135deg, rgba(26,13,46,0.8) 0%, rgba(13,16,23,0.8) 100%)", border: `1px solid ${isVictory ? "rgba(251,191,36,0.35)" : "rgba(139,92,246,0.25)"}`, boxShadow: isVictory ? "0 0 20px rgba(251,191,36,0.1)" : "0 0 20px rgba(139,92,246,0.05)", ...(c.status === "active" ? { ["--glow-color" as string]: isVictory ? "rgba(251,191,36,0.25)" : "rgba(139,92,246,0.25)" } : {}) }}
              onClick={() => setExpandedId(c.id)}
            >
              <div className="flex items-start gap-3 mb-3">
                <span style={{ fontSize: 28, flexShrink: 0 }}>{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-bold truncate" style={{ color: "#e9d5ff" }}>{c.title}</p>
                    {isVictory
                      ? <span className="text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.35)" }}>★</span>
                      : <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={sc}>{sc.label}</span>
                    }
                  </div>
                  {c.description && <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{c.description.slice(0, 80)}{c.description.length > 80 ? "…" : ""}</p>}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <Tip k="campaign_stages"><span className="text-xs" style={{ color: "rgba(167,139,250,0.6)" }}>{completed}/{total} Quests</span></Tip>
                  <span className="text-xs font-semibold" style={{ color: isVictory ? "#fbbf24" : "#a78bfa" }}>{pct}%</span>
                </div>
                <div className="progress-bar-diablo">
                  <div className="progress-bar-diablo-fill" style={{ width: `${pct}%`, background: isVictory ? "linear-gradient(90deg,#fbbf2488,#fbbf24,#f59e0bcc)" : "linear-gradient(90deg,#7c3aed88,#a78bfa,#a78bfacc)" }} />
                </div>
              </div>

              {/* Boss quest teaser */}
              {bossInChain && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-xs" style={{ color: bossInChain.status === "completed" ? "#34d399" : "rgba(239,68,68,0.8)" }}>
                    {bossInChain.status === "completed" ? "✓ Boss slain" : `★ Boss: ${bossInChain.title.slice(0, 30)}${bossInChain.title.length > 30 ? "…" : ""}`}
                  </span>
                </div>
              )}

              {/* Lore snippet */}
              {c.lore && <p className="text-xs mt-2 italic" style={{ color: "rgba(167,139,250,0.4)" }}>&quot;{c.lore.slice(0, 60)}{c.lore.length > 60 ? "…" : ""}&quot;</p>}

              {/* Delete button */}
              {deleteConfirm === c.id ? (
                <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                  <button className="text-xs px-2 py-1 rounded" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }} onClick={() => handleDelete(c.id)}>Confirm delete</button>
                  <button className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                </div>
              ) : (
                reviewApiKey && (
                  <button className="text-xs mt-3 opacity-30 hover:opacity-70 transition-opacity" style={{ color: "#f87171" }}
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(c.id); }}>
                    Delete
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Create Campaign Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setCreateOpen(false)}>
          <div className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: "#0d1017", border: "1px solid rgba(139,92,246,0.4)", boxShadow: "0 0 60px rgba(139,92,246,0.2)", scrollbarWidth: "thin" as const, overscrollBehavior: "contain" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4" style={{ color: "#e9d5ff" }}>New Campaign</h3>
            <div className="space-y-3">
              {/* Icon picker */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: "rgba(167,139,250,0.7)" }}>Icon</p>
                <div className="flex flex-wrap gap-1">
                  {CAMPAIGN_ICONS.map(ic => (
                    <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))} className="w-8 h-8 rounded text-base flex items-center justify-center transition-all"
                      style={{ background: form.icon === ic ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.04)", border: form.icon === ic ? "1px solid rgba(139,92,246,0.6)" : "1px solid rgba(255,255,255,0.06)" }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(167,139,250,0.7)" }}>Title *</p>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Campaign name…"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.25)", color: "#e9d5ff" }} />
              </div>

              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(167,139,250,0.7)" }}>Description</p>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description…"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.25)", color: "#e9d5ff" }} />
              </div>

              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(167,139,250,0.7)" }}>Lore / Flavor Text</p>
                <textarea value={form.lore} onChange={e => setForm(f => ({ ...f, lore: e.target.value }))} placeholder="The ancient scrolls speak of…"
                  rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.25)", color: "#e9d5ff" }} />
              </div>

              {/* Quest selector */}
              {allAvailableQuests.length > 0 && (
                <div>
                  <p className="text-xs mb-1.5" style={{ color: "rgba(167,139,250,0.7)" }}>Add Quests ({selectedQuestIds.length} selected)</p>
                  <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.2)", maxHeight: 160, overflowY: "auto" }}>
                    {allAvailableQuests.map(q => {
                      const sel = selectedQuestIds.includes(q.id);
                      return (
                        <button key={q.id} onClick={() => setSelectedQuestIds(prev => sel ? prev.filter(id => id !== q.id) : [...prev, q.id])}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                          style={{ background: sel ? "rgba(139,92,246,0.12)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span className="text-xs" style={{ color: sel ? "#a78bfa" : "rgba(255,255,255,0.25)" }}>{sel ? "✓" : "○"}</span>
                          <span className="text-xs truncate" style={{ color: sel ? "#e9d5ff" : "rgba(255,255,255,0.5)" }}>{q.title}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedQuestIds.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs mb-1" style={{ color: "rgba(167,139,250,0.6)" }}>Boss Quest (optional)</p>
                      <select value={form.bossQuestId} onChange={e => setForm(f => ({ ...f, bossQuestId: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.25)", color: "#e9d5ff" }}>
                        <option value="">None</option>
                        {selectedQuestIds.map(id => {
                          const q = allAvailableQuests.find(q => q.id === id);
                          return q ? <option key={id} value={id}>{q.title}</option> : null;
                        })}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Rewards */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: "rgba(167,139,250,0.7)" }}>Completion Rewards</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <input type="number" min={0} max={10000} value={form.rewardXp} onChange={e => setForm(f => ({ ...f, rewardXp: e.target.value }))} placeholder="XP"
                    className="rounded-lg px-3 py-2 text-xs input-dark" />
                  <input type="number" min={0} max={100000} value={form.rewardGold} onChange={e => setForm(f => ({ ...f, rewardGold: e.target.value }))} placeholder="Gold"
                    className="rounded-lg px-3 py-2 text-xs input-dark" />
                  <input value={form.rewardTitle} onChange={e => setForm(f => ({ ...f, rewardTitle: e.target.value }))} placeholder="Title"
                    className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.2)", color: "#e9d5ff" }} />
                </div>
              </div>

              {createError && (
                <p className="text-xs" style={{ color: "#ef4444" }}>{createError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={handleCreate} disabled={!form.title.trim() || submitting || !reviewApiKey}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                  title={!reviewApiKey ? "API key required" : !form.title.trim() ? "Enter a campaign title" : submitting ? "Creating…" : ""}
                  style={{ background: form.title.trim() && reviewApiKey ? "rgba(139,92,246,0.4)" : "rgba(139,92,246,0.1)", color: form.title.trim() && reviewApiKey ? "#e9d5ff" : "rgba(167,139,250,0.3)", border: "1px solid rgba(139,92,246,0.4)", cursor: !form.title.trim() || submitting || !reviewApiKey ? "not-allowed" : "pointer" }}>
                  {submitting ? "Creating…" : !reviewApiKey ? "API key required" : "Create Campaign"}
                </button>
                <button onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
