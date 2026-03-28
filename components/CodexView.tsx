"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth-client";

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
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("all");

  const fetchCodex = useCallback(async () => {
    try {
      const r = await fetch("/api/codex", { headers: getAuthHeaders() });
      if (r.ok) {
        const data = await r.json();
        setCategories(data.categories || []);
        setEntries(data.entries || []);
        setDiscoveredCount(data.discoveredCount || 0);
        setTotalCount(data.totalCount || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCodex(); }, [fetchCodex]);

  const filtered = activeCat === "all" ? entries : entries.filter(e => e.category === activeCat);
  const discoveredFiltered = filtered.filter(e => e.discovered);
  const undiscoveredFiltered = filtered.filter(e => !e.discovered);

  if (loading) return <div className="text-xs text-center py-16 text-w20">Loading codex...</div>;

  return (
    <div className="tab-content-enter space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#fbbf24" }}>Living Codex</h2>
        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
          {discoveredCount}/{totalCount} discovered
        </span>
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
              {cat.name} ({catCount}/{catTotal})
            </button>
          );
        })}
      </div>

      {/* Discovered entries */}
      <div className="space-y-2">
        {discoveredFiltered.map(entry => {
          const cat = categories.find(c => c.id === entry.category);
          return (
            <div
              key={entry.id}
              className="rounded-lg px-4 py-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${cat ? `${cat.color}15` : "rgba(251,191,36,0.12)"}`,
                borderLeft: `3px solid ${cat?.color || "#fbbf24"}`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold" style={{ color: cat?.color || "#fbbf24" }}>{entry.title}</p>
                {cat && <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>{cat.name}</span>}
              </div>
              {entry.text && (
                <p className="text-xs leading-relaxed italic" style={{ color: "rgba(255,255,255,0.45)" }}>
                  &ldquo;{entry.text}&rdquo;
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Undiscovered entries */}
      {undiscoveredFiltered.length > 0 && (
        <div className="space-y-1 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.15)" }}>
            Undiscovered ({undiscoveredFiltered.length})
          </p>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
            {undiscoveredFiltered.map(entry => (
              <div key={entry.id} className="rounded-lg px-3 py-2 text-center" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.12)" }}>???</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
