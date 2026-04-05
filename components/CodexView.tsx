"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useModalBehavior } from "@/components/ModalPortal";
import { getAuthHeaders } from "@/lib/auth-client";
import { useDashboard } from "@/app/DashboardContext";
import { TipCustom } from "@/components/GameTooltip";

interface CodexEntry {
  id: string;
  category: string;
  title: string;
  text: string | null;
  discovered: boolean;
}

interface CodexCategory {
  id: string;
  name: string;
  color: string;
}

export default function CodexView() {
  const [categories, setCategories] = useState<CodexCategory[]>([]);
  const [entries, setEntries] = useState<CodexEntry[]>([]);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { playerName, reviewApiKey } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("all");
  const [selectedEntry, setSelectedEntry] = useState<CodexEntry | null>(null);
  useModalBehavior(!!selectedEntry, () => setSelectedEntry(null));
  const [readEntries, setReadEntries] = useState<Set<string>>(new Set());

  const fetchCodex = useCallback(async () => {
    try {
      const [codexR, seenR] = await Promise.all([
        fetch("/api/codex", { headers: getAuthHeaders() }),
        playerName ? fetch(`/api/player/${encodeURIComponent(playerName)}/seen`, { headers: getAuthHeaders() }) : null,
      ]);
      if (codexR.ok) {
        const data = await codexR.json();
        setCategories(data.categories || []);
        setEntries(data.entries || []);
        setDiscoveredCount(data.discoveredCount || 0);
        setTotalCount(data.totalCount || 0);
      }
      if (seenR?.ok) {
        const seenData = await seenR.json();
        if (seenData.codex) setReadEntries(new Set(seenData.codex));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [playerName]);

  const markRead = (id: string) => {
    setReadEntries(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      if (playerName) {
        fetch(`/api/player/${encodeURIComponent(playerName)}/seen`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ category: "codex", ids: [id] }),
        }).catch(() => {});
      }
      return next;
    });
  };

  const openEntry = (entry: CodexEntry) => {
    setSelectedEntry(entry);
    markRead(entry.id);
  };

  useEffect(() => { fetchCodex(); }, [fetchCodex]);

  const filtered = activeCat === "all" ? entries : entries.filter(e => e.category === activeCat);
  const discoveredFiltered = filtered.filter(e => e.discovered);
  const undiscoveredFiltered = filtered.filter(e => !e.discovered);

  if (loading) return <div className="space-y-3 tab-content-enter"><div className="skeleton-card h-10" /><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="skeleton-card h-16 rounded-lg" />)}</div></div>;

  return (
    <div className="tab-content-enter space-y-4 relative">
      {/* Ambient lore dust particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={`lore-dust-${i}`} className="absolute rounded-full" style={{
            width: 2 + (i % 2),
            height: 2 + (i % 2),
            left: `${12 + (i * 19) % 70}%`,
            top: `${15 + (i * 23) % 60}%`,
            background: i % 2 === 0 ? "rgba(147,197,253,0.6)" : "rgba(196,181,253,0.5)",
            boxShadow: `0 0 ${3 + i % 2}px ${i % 2 === 0 ? "rgba(147,197,253,0.4)" : "rgba(196,181,253,0.35)"}`,
            animation: `ember-float ${3.5 + (i % 3) * 0.8}s ease-in-out ${i * 0.7}s infinite`,
            opacity: 0,
          }} />
        ))}
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <TipCustom title="Living Codex" icon="◆" accent="#fbbf24" heading body={<p>Sammlung aller entdeckten Lore-Eintr&auml;ge. Neue Eintr&auml;ge werden durch Quests, Events und Erkundung freigeschaltet.</p>}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#fbbf24" }}>Living Codex</h2>
        </TipCustom>
        <TipCustom title="Fortschritt" icon="◆" accent="#fbbf24" body={<p>Anteil der entdeckten Lore-Eintr&auml;ge. Neue Eintr&auml;ge werden durch Quests, NPCs und besondere Events freigeschaltet.</p>}>
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)", cursor: "help" }}>
            {discoveredCount}/{totalCount} discovered
          </span>
        </TipCustom>
      </div>

      {/* Progress bar */}
      <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full" style={{ width: `${totalCount > 0 ? (discoveredCount / totalCount) * 100 : 0}%`, background: "linear-gradient(90deg, #ca8a04, #fbbf24)", transition: "width 0.5s" }} />
      </div>

      {/* Category filter */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setActiveCat("all")}
          className="text-xs px-2.5 py-1 rounded-lg"
          style={{
            background: activeCat === "all" ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.03)",
            color: activeCat === "all" ? "#fbbf24" : "rgba(255,255,255,0.3)",
            border: `1px solid ${activeCat === "all" ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.06)"}`,
            cursor: "pointer",
          }}
        >All ({entries.filter(e => e.discovered).length})</button>
        {categories.map(cat => {
          const catCount = entries.filter(e => e.category === cat.id && e.discovered).length;
          const catTotal = entries.filter(e => e.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className="text-xs px-2.5 py-1 rounded-lg"
              style={{
                background: activeCat === cat.id ? `${cat.color}15` : "rgba(255,255,255,0.03)",
                color: activeCat === cat.id ? cat.color : "rgba(255,255,255,0.3)",
                border: `1px solid ${activeCat === cat.id ? `${cat.color}30` : "rgba(255,255,255,0.06)"}`,
                cursor: "pointer",
              }}
            >
              <TipCustom title={cat.name} icon="◆" accent={cat.color} body={<p>Lore-Kategorie mit {catTotal} Eintr&auml;gen. {catCount} davon entdeckt.</p>}>
                <span>{cat.name} ({catCount}/{catTotal})</span>
              </TipCustom>
            </button>
          );
        })}
      </div>

      {/* Entries grouped by category — visual variety */}
      {activeCat === "all" ? (
        <div className="space-y-6">
          {categories.map(cat => {
            const catDiscovered = entries.filter(e => e.category === cat.id && e.discovered);
            const catTotal = entries.filter(e => e.category === cat.id).length;
            if (catDiscovered.length === 0) return null;
            return (
              <div key={cat.id}>
                {/* Category section header */}
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-1 h-6 rounded-full" style={{ background: cat.color }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cat.color }}>{cat.name}</span>
                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>{catDiscovered.length}/{catTotal}</span>
                  <div className="flex-1 h-px" style={{ background: `${cat.color}15` }} />
                </div>
                {/* Mixed layout: first entry larger, rest compact */}
                <div className="grid grid-cols-3 gap-2">
                  {catDiscovered.map((entry, idx) => {
                    const isUnread = !readEntries.has(entry.id);
                    const isFeatured = idx === 0 && catDiscovered.length >= 3;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => openEntry(entry)}
                        className={`text-left rounded-lg relative transition-all${isFeatured ? " col-span-2 row-span-2" : ""}`}
                        style={{
                          padding: isFeatured ? "16px" : "8px 12px",
                          background: isFeatured ? `${cat.color}08` : "rgba(255,255,255,0.02)",
                          border: `1px solid ${cat.color}${isFeatured ? "25" : "12"}`,
                          borderLeft: `3px solid ${cat.color}${isFeatured ? "" : "80"}`,
                          cursor: "pointer",
                          boxShadow: isFeatured ? `inset 0 1px 0 ${cat.color}10, 0 2px 8px rgba(0,0,0,0.15)` : undefined,
                        }}
                      >
                        {isUnread && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: "#fbbf24", boxShadow: "0 0 4px rgba(251,191,36,0.6)" }} />
                        )}
                        <p className={`font-semibold line-clamp-2 ${isFeatured ? "text-sm mb-1" : "text-xs"}`} style={{ color: cat.color }}>{entry.title}</p>
                        {isFeatured && entry.text && (
                          <p className="text-xs line-clamp-3 mt-1" style={{ color: "rgba(255,255,255,0.25)", lineHeight: "1.5" }}>
                            {entry.text.slice(0, 120)}{entry.text.length > 120 ? "..." : ""}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Single category view — standard grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {discoveredFiltered.map(entry => {
            const cat = categories.find(c => c.id === entry.category);
            const isUnread = !readEntries.has(entry.id);
            return (
              <button
                key={entry.id}
                onClick={() => openEntry(entry)}
                className="text-left rounded-lg px-3 py-2.5 relative transition-all"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: `1px solid ${cat ? `${cat.color}18` : "rgba(251,191,36,0.1)"}`,
                  borderLeft: `3px solid ${cat?.color || "#fbbf24"}`,
                  cursor: "pointer",
                }}
              >
                {isUnread && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: "#fbbf24", boxShadow: "0 0 4px rgba(251,191,36,0.6)" }} />
                )}
                <p className="text-xs font-semibold line-clamp-2" style={{ color: cat?.color || "#fbbf24" }}>{entry.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>{cat?.name}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Entry detail modal — portaled to body for correct viewport centering */}
      {selectedEntry && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="rounded-xl overflow-hidden w-full max-w-lg max-h-[80vh] overflow-y-auto discovery-reveal"
            style={{
              background: "#111318",
              border: `1px solid ${categories.find(c => c.id === selectedEntry.category)?.color || "#fbbf24"}30`,
              boxShadow: `0 20px 60px rgba(0,0,0,0.7)`,
              overscrollBehavior: "contain",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", borderLeft: `4px solid ${categories.find(c => c.id === selectedEntry.category)?.color || "#fbbf24"}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold" style={{ color: categories.find(c => c.id === selectedEntry.category)?.color || "#fbbf24" }}>{selectedEntry.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{categories.find(c => c.id === selectedEntry.category)?.name}</p>
                </div>
                <button onClick={() => setSelectedEntry(null)} aria-label="Schließen" className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer", background: "rgba(255,255,255,0.04)" }}>×</button>
              </div>
            </div>
            {selectedEntry.text && (
              <div className="px-5 py-4">
                <p className="text-sm leading-relaxed italic" style={{ color: "rgba(255,255,255,0.6)" }}>
                  &ldquo;{selectedEntry.text}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Undiscovered entries */}
      {undiscoveredFiltered.length > 0 && (
        <div className="space-y-1 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <TipCustom title="Unentdeckt" icon="?" accent="#6b7280" body={<p>Noch nicht freigeschaltete Eintr&auml;ge. Schlie&szlig;e Quests ab und erkunde die Welt, um sie zu entdecken.</p>}>
            <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.15)", cursor: "help" }}>
              Undiscovered ({undiscoveredFiltered.length})
            </p>
          </TipCustom>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
            {undiscoveredFiltered.map(entry => (
              <div key={entry.id} className="rounded-lg px-3 py-2 text-center crystal-breathe" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", ["--glow-color" as string]: "rgba(107,114,128,0.15)" }}>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.12)" }}>???</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ─── Companion Gallery ─── */}
      <CompanionGallery />

      {/* ─── World Stats ─── */}
      <WorldStats />
    </div>
  );
}

function CompanionGallery() {
  const [open, setOpen] = useState(false);
  const companions = [
    { id: "dragon", emoji: "🐉", name: "Ember", personality: "Fierce", desc: "Ein feuriger Drache der dich antreibt. Bevorzugt Fitness-Quests.", color: "#ef4444", ultimate: "Instant Complete — sofort eine Quest abschließen" },
    { id: "owl", emoji: "🦉", name: "Sage", personality: "Wise", desc: "Eine weise Eule die dich beim Lernen begleitet. Bevorzugt Learning-Quests.", color: "#3b82f6", ultimate: "Double Reward — doppelte Belohnung auf nächste Quest" },
    { id: "phoenix", emoji: "🔥", name: "Blaze", personality: "Resilient", desc: "Ein Phoenix der aus jeder Niederlage stärker aufsteht. Schützt Streaks.", color: "#f97316", ultimate: "Streak Shield — Streak 1x vor Verlust schützen" },
    { id: "wolf", emoji: "🐺", name: "Shadow", personality: "Loyal", desc: "Ein treuer Wolf der immer an deiner Seite steht. Bonus auf Social-Quests.", color: "#6b7280", ultimate: "Pack Hunt — +50% XP für 3 Quests" },
    { id: "fox", emoji: "🦊", name: "Trick", personality: "Clever", desc: "Ein schlauer Fuchs der kreative Lösungen findet. Bonus auf Development-Quests.", color: "#f59e0b", ultimate: "Lucky Find — garantierter Item-Drop" },
    { id: "bear", emoji: "🐻", name: "Bjorn", personality: "Strong", desc: "Ein starker Bär der dich durch harte Zeiten trägt. Bonus auf Personal-Quests.", color: "#92400e", ultimate: "Fortify — Forge Temp kann 24h nicht fallen" },
  ];

  return (
    <div className="mt-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full" style={{ cursor: "pointer" }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>Companion Gallery</span>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 tab-content-enter stagger-list">
          {companions.map(c => (
            <div key={c.id} className="rounded-xl p-3 text-center crystal-breathe" style={{ background: `${c.color}08`, border: `1px solid ${c.color}20`, ["--glow-color" as string]: `${c.color}15` }}>
              <span className="text-3xl block mb-1">{c.emoji}</span>
              <p className="text-sm font-bold" style={{ color: c.color }}>{c.name}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{c.personality}</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>{c.desc}</p>
              <p className="text-xs mt-2 font-semibold" style={{ color: `${c.color}aa` }}>Ultimate (Bond 5):</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{c.ultimate}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorldStats() {
  const [stats, setStats] = useState<{ totalQuests: number; byType: Record<string, number>; totalPlayers: number; totalCampaigns: number; catalogTemplates: number } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || stats) return;
    (async () => {
      try {
        const r = await fetch("/api/stats/content");
        if (r.ok) setStats(await r.json());
      } catch { /* ignore */ }
    })();
  }, [open, stats]);

  return (
    <div className="mt-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full" style={{ cursor: "pointer" }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>World Statistics</span>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 tab-content-enter">
          {[
            { label: "Total Quests", value: stats.totalQuests, color: "#22c55e" },
            { label: "Players", value: stats.totalPlayers, color: "#3b82f6" },
            { label: "Campaigns", value: stats.totalCampaigns, color: "#a855f7" },
            { label: "Quest Templates", value: stats.catalogTemplates, color: "#f59e0b" },
            ...Object.entries(stats.byType).map(([type, count]) => ({ label: type, value: count, color: "rgba(255,255,255,0.4)" })),
          ].map(s => (
            <div key={s.label} className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-xs text-w25 capitalize">{s.label}</p>
              <p className="text-lg font-mono font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
      {open && !stats && <p className="text-xs text-w20 mt-2">Loading...</p>}
    </div>
  );
}
