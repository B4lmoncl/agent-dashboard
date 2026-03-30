"use client";

import { useState, useEffect } from "react";
import type { RoadmapItem } from "@/app/types";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";

const ROADMAP_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  done:        { label: "Done",        color: "#22c55e", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)",   dot: "●" },
  in_progress: { label: "In Progress", color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)",  dot: "◐" },
  planned:     { label: "Planned",     color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.2)", dot: "○" },
};

export function RoadmapView() {
  const { isAdmin, reviewApiKey } = useDashboard();
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStatus, setNewStatus] = useState("planned");
  const [newEta, setNewEta] = useState("");
  const [newCategory, setNewCategory] = useState("feature");

  useEffect(() => {
    fetch("/api/roadmap", { signal: AbortSignal.timeout(2000) })
      .then(r => r.ok ? r.json() : [])
      .then(setItems)
      .catch((err) => { console.error('Failed to fetch roadmap:', err); });
  }, []);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const r = await fetch("/api/roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
      body: JSON.stringify({ title: newTitle, desc: newDesc, status: newStatus, eta: newEta, category: newCategory }),
    });
    if (r.ok) {
      const data = await r.json();
      setItems(prev => [...prev, data.item]);
      setAddOpen(false);
      setNewTitle(""); setNewDesc(""); setNewEta("");
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const r = await fetch(`/api/roadmap/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: status as RoadmapItem["status"] } : i));
    }
  };

  const byCategory = items.reduce((acc, item) => {
    const cat = item.category || "feature";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, RoadmapItem[]>);

  const categoryOrder = ["core", "infrastructure", "feature"];
  const sortedCategories = [...new Set([...categoryOrder, ...Object.keys(byCategory)])].filter(c => byCategory[c]);

  return (
    <div className="space-y-4 tab-content-enter">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Roadmap</span>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setStatusFilter(null)}
            className="text-xs px-2 py-0.5 rounded"
            style={{
              color: statusFilter === null ? "#FFD700" : "rgba(255,255,255,0.35)",
              background: statusFilter === null ? "rgba(255,215,0,0.08)" : "transparent",
              border: `1px solid ${statusFilter === null ? "rgba(255,215,0,0.5)" : "transparent"}`,
            }}
          >
            All
          </button>
          {Object.entries(ROADMAP_STATUS_CONFIG).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setStatusFilter(statusFilter === k ? null : k)}
              className="text-xs px-2 py-0.5 rounded"
              style={{
                color: statusFilter === k ? "#FFD700" : "rgba(255,255,255,0.35)",
                background: statusFilter === k ? "rgba(255,215,0,0.08)" : "transparent",
                border: `1px solid ${statusFilter === k ? "rgba(255,215,0,0.5)" : "transparent"}`,
              }}
            >
              {v.dot} {v.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button
            onClick={() => setAddOpen(v => !v)}
            className="ml-auto text-xs px-2 py-0.5 rounded"
            style={{ background: "rgba(99,102,241,0.12)", color: "#a78bfa", border: "1px solid rgba(99,102,241,0.3)" }}
          >
            + Add Item
          </button>
        )}
      </div>

      {isAdmin && addOpen && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: "#1e1e1e", border: "1px solid rgba(99,102,241,0.3)" }}>
          <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>New Roadmap Item</p>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" className="w-full text-xs px-2 py-1 rounded" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }} />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description" className="w-full text-xs px-2 py-1 rounded" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }} />
          <div className="flex gap-2">
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="text-xs px-2 py-1 rounded flex-1" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}>
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="text-xs px-2 py-1 rounded flex-1" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}>
              <option value="core">Core</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="feature">Feature</option>
            </select>
            <input value={newEta} onChange={e => setNewEta(e.target.value)} placeholder="ETA (z.B. März 2026)" className="text-xs px-2 py-1 rounded flex-1" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="text-xs px-3 py-1 rounded font-semibold" style={{ background: "rgba(99,102,241,0.2)", color: "#a78bfa", border: "1px solid rgba(99,102,241,0.4)" }}>Add</button>
            <button onClick={() => setAddOpen(false)} className="text-xs px-3 py-1 rounded" style={{ color: "rgba(255,255,255,0.3)" }}>Cancel</button>
          </div>
        </div>
      )}

      {sortedCategories.map(cat => {
        const catItems = statusFilter ? byCategory[cat].filter(i => i.status === statusFilter) : byCategory[cat];
        if (catItems.length === 0) return null;
        return (
        <div key={cat}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>{cat}</p>
          <div className="space-y-2">
            {catItems.map(item => {
              const cfg = ROADMAP_STATUS_CONFIG[item.status] ?? ROADMAP_STATUS_CONFIG.planned;
              const isOpen = expanded === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-xl overflow-hidden"
                  style={{ background: "#1e1e1e", border: `1px solid ${cfg.border}` }}
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : item.id)}
                    className="flex items-center gap-3 w-full text-left px-4 py-3"
                  >
                    <span className="text-sm">{cfg.dot}</span>
                    <span className="text-sm font-semibold flex-1" style={{ color: "#f0f0f0" }}>{item.title}</span>
                    {item.eta && <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{item.eta}</span>}
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.2)" }}>{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 space-y-2">
                      {item.desc && <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{item.desc}</p>}
                      {isAdmin && (
                        <div className="flex gap-1 pt-1">
                          {Object.entries(ROADMAP_STATUS_CONFIG).map(([k, v]) => (
                            <button
                              key={k}
                              onClick={() => handleStatusChange(item.id, k)}
                              className="text-xs px-2 py-0.5 rounded"
                              style={{
                                background: item.status === k ? v.bg : "rgba(255,255,255,0.04)",
                                color: item.status === k ? v.color : "rgba(255,255,255,0.3)",
                                border: `1px solid ${item.status === k ? v.border : "rgba(255,255,255,0.08)"}`,
                              }}
                            >
                              {v.dot} {v.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}

      {items.length === 0 && (
        <div className="flex flex-col items-center py-12" style={{ color: "rgba(255,255,255,0.3)" }}>
          <span className="text-3xl mb-2" style={{ color: "rgba(255,255,255,0.15)" }}>◇</span>
          <p className="text-sm font-medium mb-1">The road ahead is uncharted</p>
          <p className="text-xs">No roadmap items yet. Check back soon for upcoming features.</p>
        </div>
      )}
    </div>
  );
}

