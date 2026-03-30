"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import type { RewardCelebrationData } from "@/components/RewardCelebration";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TalentEffect {
  type: string;
  value: number;
  description: string;
  tradeoff?: boolean;
}

interface TalentNode {
  id: string;
  name: string;
  ring: "inner" | "middle" | "outer";
  path: "blade" | "stars" | "fortune";
  position: { ring: number; segment: number; slot: number };
  cost: number;
  requires: string[];
  effect: TalentEffect;
  icon: string | null;
  flavor: string;
}

interface TalentPath {
  id: string;
  name: string;
  description: string;
  color: string;
  stat: string;
}

interface TalentMeta {
  unlockLevel: number;
  pointsPerLevel: number;
  maxPoints: number;
  rings: number;
}

interface TalentData {
  meta: TalentMeta;
  paths: Record<string, TalentPath>;
  nodes: TalentNode[];
  allocated: Record<string, { allocatedAt: string; effect: TalentEffect }>;
  totalSpent: number;
  availablePoints: number;
  bonusPoints: number;
  playerLevel: number;
  unlocked: boolean;
}

// ─── Path colors ────────────────────────────────────────────────────────────
const PATH_COLORS: Record<string, string> = {
  blade: "#ff4444",
  stars: "#3b82f6",
  fortune: "#22c55e",
};

// ─── Ring radii for SVG layout ──────────────────────────────────────────────
const RING_RADII = [120, 200, 280];
const CENTER = 320;
const SVG_SIZE = 640;

// ─── Component ──────────────────────────────────────────────────────────────

export default function TalentTreeView({
  onCelebration,
}: {
  onCelebration?: (d: RewardCelebrationData) => void;
}) {
  const { addToast } = useDashboard();
  const [data, setData] = useState<TalentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────
  const fetchTalents = useCallback(async () => {
    try {
      const r = await fetch("/api/talents", { headers: getAuthHeaders() });
      if (r.ok) {
        const d = await r.json();
        setData(d);
      }
    } catch (e) {
      console.error("[talents] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTalents(); }, [fetchTalents]);

  // ─── Allocate ───────────────────────────────────────────────────────────
  const handleAllocate = useCallback(async (nodeId: string) => {
    if (!data || allocating) return;
    setAllocating(true);
    try {
      const r = await fetch("/api/talents/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ nodeId }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        addToast({ type: "success", message: `${d.node.name} freigeschaltet!` });
        fetchTalents();
      } else {
        addToast({ type: "error", message: d.error || "Fehler" });
      }
    } catch (e) {
      addToast({ type: "error", message: "Netzwerkfehler" });
    } finally {
      setAllocating(false);
    }
  }, [data, allocating, addToast, fetchTalents]);

  // ─── Deallocate ─────────────────────────────────────────────────────────
  const handleDeallocate = useCallback(async (nodeId: string) => {
    if (!data || allocating) return;
    setAllocating(true);
    try {
      const r = await fetch("/api/talents/deallocate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ nodeId }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        addToast({ type: "success", message: "Talent entfernt" });
        fetchTalents();
      } else {
        addToast({ type: "error", message: d.error || "Fehler" });
      }
    } catch (e) {
      addToast({ type: "error", message: "Netzwerkfehler" });
    } finally {
      setAllocating(false);
    }
  }, [data, allocating, addToast, fetchTalents]);

  // ─── Reset ──────────────────────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    if (!data || resetting) return;
    setResetting(true);
    try {
      const r = await fetch("/api/talents/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const d = await r.json();
      if (r.ok && d.success) {
        addToast({ type: "success", message: `Alle Talente zurückgesetzt! ${d.goldSpent}g bezahlt.` });
        setConfirmReset(false);
        fetchTalents();
      } else {
        addToast({ type: "error", message: d.error || "Fehler" });
      }
    } catch (e) {
      addToast({ type: "error", message: "Netzwerkfehler" });
    } finally {
      setResetting(false);
    }
  }, [data, resetting, addToast, fetchTalents]);

  // ─── Compute node positions on circle ───────────────────────────────────
  const nodePositions = useMemo(() => {
    if (!data) return new Map<string, { x: number; y: number }>();
    const map = new Map<string, { x: number; y: number }>();

    // Group nodes by ring
    const byRing: Record<string, TalentNode[]> = { inner: [], middle: [], outer: [] };
    for (const n of data.nodes) byRing[n.ring].push(n);

    for (const ring of ["inner", "middle", "outer"] as const) {
      const nodes = byRing[ring];
      const radius = RING_RADII[ring === "inner" ? 0 : ring === "middle" ? 1 : 2];
      const count = nodes.length;
      // Sort by segment + slot for consistent positioning
      nodes.sort((a, b) => {
        if (a.position.segment !== b.position.segment) return a.position.segment - b.position.segment;
        return a.position.slot - b.position.slot;
      });
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2; // Start at top
        const x = CENTER + Math.cos(angle) * radius;
        const y = CENTER + Math.sin(angle) * radius;
        map.set(nodes[i].id, { x, y });
      }
    }
    return map;
  }, [data]);

  // ─── Compute which nodes are available to allocate ──────────────────────
  const nodeStates = useMemo(() => {
    if (!data) return new Map<string, "allocated" | "available" | "locked">();
    const map = new Map<string, "allocated" | "available" | "locked">();
    for (const n of data.nodes) {
      if (data.allocated[n.id]) {
        map.set(n.id, "allocated");
      } else if (
        data.availablePoints >= n.cost &&
        (!n.requires.length || n.requires.every(r => !!data.allocated[r]))
      ) {
        map.set(n.id, "available");
      } else {
        map.set(n.id, "locked");
      }
    }
    return map;
  }, [data]);

  const selected = data?.nodes.find(n => n.id === selectedNode) || null;

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="tab-content-enter flex items-center justify-center py-20">
        <div className="text-sm text-w30">Lade Talent-Baum...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="tab-content-enter flex items-center justify-center py-20">
        <div className="text-sm text-w30">Talent-System nicht verfügbar</div>
      </div>
    );
  }

  if (!data.unlocked) {
    return (
      <div className="tab-content-enter flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-4xl opacity-20">◇</div>
        <p className="text-sm text-w30">Talent-Baum wird bei Level {data.meta.unlockLevel} freigeschaltet</p>
        <p className="text-xs text-w20">Dein Level: {data.playerLevel}</p>
      </div>
    );
  }

  return (
    <div className="tab-content-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-w70">Schicksalsbaum</h2>
          <p className="text-xs text-w25 mt-0.5">Wähle deinen Pfad. Jede Entscheidung formt dein Schicksal.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs px-3 py-1.5 rounded-lg font-mono font-bold"
            style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
            {data.availablePoints} Punkte
          </div>
          <div className="text-xs text-w25">
            {data.totalSpent} / {data.meta.maxPoints + (data.bonusPoints || 0)} vergeben
          </div>
          {data.totalSpent > 0 && (
            <button
              onClick={() => setConfirmReset(true)}
              className="text-xs px-2 py-1 rounded font-medium"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Path legend */}
      <div className="flex gap-4 mb-4">
        {Object.values(data.paths).map(p => (
          <div key={p.id} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-xs text-w40">{p.name}</span>
          </div>
        ))}
      </div>

      {/* SVG Tree + Detail panel */}
      <div className="flex gap-4">
        {/* Circular tree */}
        <div className="flex-shrink-0 relative" style={{ width: SVG_SIZE, height: SVG_SIZE }}>
          <svg
            width={SVG_SIZE} height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="select-none"
          >
            {/* Ring circles */}
            {RING_RADII.map((r, i) => (
              <circle
                key={i}
                cx={CENTER} cy={CENTER} r={r}
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={i === 2 ? 2 : 1}
                strokeDasharray={i === 2 ? "4 4" : undefined}
              />
            ))}

            {/* Connection lines */}
            {data.nodes.map(n => {
              const pos = nodePositions.get(n.id);
              if (!pos || !n.requires.length) return null;
              return n.requires.map(reqId => {
                const reqPos = nodePositions.get(reqId);
                if (!reqPos) return null;
                const isActive = !!data.allocated[n.id] && !!data.allocated[reqId];
                const isAvailable = nodeStates.get(n.id) === "available" && !!data.allocated[reqId];
                return (
                  <line
                    key={`${n.id}-${reqId}`}
                    x1={reqPos.x} y1={reqPos.y}
                    x2={pos.x} y2={pos.y}
                    stroke={isActive ? PATH_COLORS[n.path] : isAvailable ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)"}
                    strokeWidth={isActive ? 2 : 1}
                    opacity={isActive ? 0.8 : 0.5}
                  />
                );
              });
            })}

            {/* Nodes */}
            {data.nodes.map(n => {
              const pos = nodePositions.get(n.id);
              if (!pos) return null;
              const state = nodeStates.get(n.id) || "locked";
              const isSelected = selectedNode === n.id;
              const pathColor = PATH_COLORS[n.path];
              const isTradeoff = n.effect.tradeoff;
              const radius = n.ring === "outer" ? 16 : n.ring === "middle" ? 13 : 11;

              let fill = "rgba(255,255,255,0.03)";
              let stroke = "rgba(255,255,255,0.1)";
              let strokeW = 1;
              let opacity = 0.4;

              if (state === "allocated") {
                fill = pathColor;
                stroke = pathColor;
                strokeW = 2;
                opacity = 1;
              } else if (state === "available") {
                fill = "rgba(255,255,255,0.08)";
                stroke = pathColor;
                strokeW = 1.5;
                opacity = 0.9;
              }

              return (
                <g
                  key={n.id}
                  onClick={() => setSelectedNode(n.id === selectedNode ? null : n.id)}
                  style={{ cursor: "pointer" }}
                  opacity={opacity}
                >
                  {/* Glow for allocated */}
                  {state === "allocated" && (
                    <circle
                      cx={pos.x} cy={pos.y} r={radius + 6}
                      fill="none"
                      stroke={pathColor}
                      strokeWidth={1}
                      opacity={0.3}
                    />
                  )}
                  {/* Selection ring */}
                  {isSelected && (
                    <circle
                      cx={pos.x} cy={pos.y} r={radius + 4}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      opacity={0.8}
                    />
                  )}
                  {/* Node shape: diamond for tradeoff, circle for normal */}
                  {isTradeoff ? (
                    <rect
                      x={pos.x - radius * 0.75}
                      y={pos.y - radius * 0.75}
                      width={radius * 1.5}
                      height={radius * 1.5}
                      transform={`rotate(45 ${pos.x} ${pos.y})`}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeW}
                      rx={2}
                    />
                  ) : (
                    <circle
                      cx={pos.x} cy={pos.y} r={radius}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeW}
                    />
                  )}
                  {/* Cost indicator for outer ring */}
                  {n.cost > 1 && (
                    <text
                      x={pos.x} y={pos.y + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={state === "allocated" ? "#000" : "rgba(255,255,255,0.5)"}
                      fontSize={9}
                      fontWeight="bold"
                    >
                      {n.cost}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Center label */}
            <text x={CENTER} y={CENTER - 8} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={11} fontWeight="bold">
              SCHICKSALSBAUM
            </text>
            <text x={CENTER} y={CENTER + 8} textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize={9}>
              Level {data.playerLevel}
            </text>
          </svg>
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${PATH_COLORS[selected.path]}22`,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold" style={{ color: PATH_COLORS[selected.path] }}>
                    {selected.name}
                  </h3>
                  <p className="text-xs text-w25 mt-0.5">
                    {data.paths[selected.path]?.name} · {selected.ring === "inner" ? "Innerer Ring" : selected.ring === "middle" ? "Mittlerer Ring" : "Äußerer Ring"}
                  </p>
                </div>
                <div className="text-xs px-2 py-0.5 rounded font-mono"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#fbbf24" }}>
                  {selected.cost} {selected.cost === 1 ? "Punkt" : "Punkte"}
                </div>
              </div>

              {/* Effect */}
              <div className="rounded-lg p-3 mb-3" style={{ background: "rgba(0,0,0,0.3)" }}>
                <p className="text-xs text-w60" style={{ lineHeight: "1.5" }}>
                  {selected.effect.description}
                </p>
                {selected.effect.tradeoff && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                      TRADEOFF
                    </span>
                    <span className="text-xs text-w20">Hat Vor- und Nachteile</span>
                  </div>
                )}
              </div>

              {/* Flavor */}
              <p className="text-xs text-w20 italic mb-4" style={{ lineHeight: "1.4" }}>
                &ldquo;{selected.flavor}&rdquo;
              </p>

              {/* Prerequisites */}
              {selected.requires.length > 0 && (
                <div className="text-xs text-w25 mb-3">
                  Benötigt: {selected.requires.map(r => {
                    const reqNode = data.nodes.find(n => n.id === r);
                    const isAllocated = !!data.allocated[r];
                    return (
                      <span key={r} className="inline-block px-1.5 py-0.5 rounded mr-1"
                        style={{
                          background: isAllocated ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                          color: isAllocated ? "#22c55e" : "rgba(255,255,255,0.3)",
                          border: `1px solid ${isAllocated ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
                        }}>
                        {reqNode?.name || r}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {nodeStates.get(selected.id) === "available" && (
                  <button
                    onClick={() => handleAllocate(selected.id)}
                    disabled={allocating}
                    className="text-xs px-4 py-2 rounded-lg font-semibold"
                    style={{
                      background: `${PATH_COLORS[selected.path]}22`,
                      color: PATH_COLORS[selected.path],
                      border: `1px solid ${PATH_COLORS[selected.path]}44`,
                      cursor: allocating ? "not-allowed" : "pointer",
                      opacity: allocating ? 0.5 : 1,
                    }}
                  >
                    {allocating ? "..." : "Talent freischalten"}
                  </button>
                )}
                {nodeStates.get(selected.id) === "allocated" && (
                  <button
                    onClick={() => handleDeallocate(selected.id)}
                    disabled={allocating}
                    className="text-xs px-4 py-2 rounded-lg font-semibold"
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      color: "#ef4444",
                      border: "1px solid rgba(239,68,68,0.2)",
                      cursor: allocating ? "not-allowed" : "pointer",
                      opacity: allocating ? 0.5 : 1,
                    }}
                  >
                    {allocating ? "..." : "Entfernen"}
                  </button>
                )}
                {nodeStates.get(selected.id) === "locked" && (
                  <div className="text-xs text-w20 py-2">
                    {data.availablePoints < selected.cost
                      ? "Nicht genug Talentpunkte"
                      : "Voraussetzungen nicht erfüllt"}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-xs text-w20">Wähle einen Knoten im Baum, um Details zu sehen</p>
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex items-center gap-2 text-xs text-w25">
                  <div className="w-3 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)" }} />
                  <span>Verfügbar</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-w25">
                  <div className="w-3 h-3 rounded-full" style={{ background: "#ff4444" }} />
                  <span>Freigeschaltet</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-w25">
                  <div className="w-3 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }} />
                  <span>Gesperrt</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-w25">
                  <div className="w-3 h-3 rounded" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(239,68,68,0.3)", transform: "rotate(45deg)" }} />
                  <span>Tradeoff-Talent</span>
                </div>
              </div>
            </div>
          )}

          {/* Allocated talents summary */}
          {data.totalSpent > 0 && (
            <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-xs font-semibold text-w30 uppercase tracking-widest mb-2">Aktive Talente</p>
              <div className="flex flex-wrap gap-1.5">
                {data.nodes.filter(n => !!data.allocated[n.id]).map(n => (
                  <button
                    key={n.id}
                    onClick={() => setSelectedNode(n.id)}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: `${PATH_COLORS[n.path]}15`,
                      color: PATH_COLORS[n.path],
                      border: `1px solid ${PATH_COLORS[n.path]}30`,
                      cursor: "pointer",
                    }}
                  >
                    {n.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reset confirmation */}
      {confirmReset && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmReset(false); }}
        >
          <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 className="text-sm font-bold text-w70 mb-2">Talente zurücksetzen?</h3>
            <p className="text-xs text-w40 mb-4">
              Kosten: <span className="font-bold text-yellow-400">{data.totalSpent * 50}g</span> ({data.totalSpent} Knoten x 50g)
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 text-xs px-4 py-2 rounded-lg font-semibold"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", cursor: resetting ? "not-allowed" : "pointer" }}
              >
                {resetting ? "..." : "Zurücksetzen"}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 text-xs px-4 py-2 rounded-lg font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
