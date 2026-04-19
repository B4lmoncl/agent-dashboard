"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { TutorialMomentBanner } from "@/components/ContextualTutorial";
import { getAuthHeaders } from "@/lib/auth-client";
import { useDashboard } from "@/app/DashboardContext";
import { useModalBehavior } from "@/components/ModalPortal";
import { TipCustom } from "@/components/GameTooltip";
import { SFX } from "@/lib/sounds";
import type { RewardCelebrationData } from "@/components/RewardCelebration";
import type { ToastInput } from "@/components/ToastStack";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TalentEffect {
  type: string;
  value?: number;
  valuePerRank?: number[];
  chancePerRank?: number[];
  bonus?: { stat: string; modifier: number };
  penalty?: { stat: string; modifier?: number; override?: number };
  maxTotal?: number;
  [key: string]: unknown;
}

interface TalentNode {
  id: string;
  ring: "inner" | "middle" | "outer";
  name: string;
  icon: string;
  desc: string;
  flavor: string;
  maxRank: number;
  reqPoints: number;
  requires: string[];
  excludes: string[];
  effect: TalentEffect;
}

interface TalentTheme {
  color: string;
  label: string;
  desc: string;
  nodeIds: string[];
}

interface TalentMeta {
  maxPoints: number;
  pointsPerLevel: number;
  firstPointLevel: number;
  respecCost: { gold: number; essenz: number };
  rings: Record<string, { label: string; desc: string; reqPoints: number; nodeCount: number }>;
  themes?: Record<string, TalentTheme>;
  [key: string]: unknown;
}

interface TalentData {
  meta: TalentMeta;
  nodes: TalentNode[];
  connections: { from: string; to: string; type: string }[];
  choiceGroups: { id: string; label: string; desc: string; nodes: string[]; maxPicks: number }[];
  buildArchetypes: { id: string; name: string; desc: string; suggestedNodes: string[] }[];
  allocated: Record<string, { rank: number; allocatedAt: string; effect: TalentEffect }>;
  totalSpent: number;
  availablePoints: number;
  bonusPoints: number;
  playerLevel: number;
  unlocked: boolean;
}

// ─── Ring colors ────────────────────────────────────────────────────────────
const RING_COLORS: Record<string, string> = {
  inner: "#60a5fa",
  middle: "#a855f7",
  outer: "#f97316",
};

// ─── Ring radii for SVG layout ──────────────────────────────────────────────
const RING_RADII = [120, 200, 280];
const CENTER = 320;
const SVG_SIZE = 640;

// ─── Node color by theme ────────────────────────────────────────────────────
function getNodeThemeColor(nodeId: string, themes: Record<string, TalentTheme> | undefined): string {
  if (!themes) return RING_COLORS.inner;
  for (const theme of Object.values(themes)) {
    if (theme.nodeIds?.includes(nodeId)) return theme.color;
  }
  return RING_COLORS.inner;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TalentTreeView({
  onRewardCelebration,
  addToast,
}: {
  onRewardCelebration?: (d: RewardCelebrationData) => void;
  addToast?: (t: ToastInput) => void;
}) {
  const _toast = addToast || (() => {});
  const { playerName, reviewApiKey } = useDashboard();
  const [data, setData] = useState<TalentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState("");
  useModalBehavior(confirmReset, () => setConfirmReset(false));

  // ─── Fetch ──────────────────────────────────────────────────────────────
  const fetchTalents = useCallback(async () => {
    try {
      const r = await fetch("/api/talents", { headers: getAuthHeaders(reviewApiKey) });
      if (r.ok) {
        const d = await r.json();
        setData(d);
      }
    } catch (e) {
      console.error("[talents] fetch error:", e);
      setLoadError(true);
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ nodeId }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        SFX.craftSkillUp(); // ascending ping for talent unlock
        _toast({ type: "flavor", icon: "/images/icons/nav-character.png", message: `Talent: ${d.node.name}`, sub: d.node.effectDesc || "Freigeschaltet." });
        fetchTalents();
      } else {
        _toast({ type: "error", message: d.error || "Action failed" });
      }
    } catch (e) {
      _toast({ type: "error", message: "Network error" });
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ nodeId }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        _toast({ type: "flavor", icon: "◆", message: "Talent entfernt" });
        fetchTalents();
      } else {
        _toast({ type: "error", message: d.error || "Action failed" });
      }
    } catch (e) {
      _toast({ type: "error", message: "Network error" });
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
      });
      const d = await r.json();
      if (r.ok && d.success) {
        _toast({ type: "flavor", icon: "◆", message: `Alle Talente zurückgesetzt. ${d.goldSpent}g bezahlt.` });
        setConfirmReset(false);
        fetchTalents();
      } else {
        _toast({ type: "error", message: d.error || "Action failed" });
      }
    } catch (e) {
      _toast({ type: "error", message: "Network error" });
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
      // Sort by id suffix for consistent positioning (inner-1, inner-2, etc.)
      nodes.sort((a, b) => {
        const aNum = parseInt(a.id.split("-").pop() || "0", 10);
        const bNum = parseInt(b.id.split("-").pop() || "0", 10);
        return aNum - bNum;
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
    const totalAllocated = Object.values(data.allocated).reduce((s, a) => s + (a.rank || 1), 0);
    for (const n of data.nodes) {
      const currentRank = data.allocated[n.id]?.rank || 0;
      if (currentRank >= n.maxRank) {
        map.set(n.id, "allocated");
      } else if (currentRank > 0 && currentRank < n.maxRank) {
        // Partially allocated multi-rank — show as available for next rank
        map.set(n.id, data.availablePoints >= 1 ? "available" : "locked");
      } else if (
        data.availablePoints >= 1 &&
        totalAllocated >= n.reqPoints &&
        (!n.requires.length || n.requires.every(r => !!data.allocated[r])) &&
        (!n.excludes.length || !n.excludes.some(ex => !!data.allocated[ex]))
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
      <div className="tab-content-enter p-4 space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-2">
          <div className="skeleton-pulse h-5 w-36 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="skeleton-pulse h-4 w-24 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
        </div>
        {/* SVG circle skeleton */}
        <div className="flex justify-center">
          <div className="skeleton-pulse rounded-full" style={{ width: 320, height: 320, background: "rgba(255,255,255,0.04)" }} />
        </div>
        {/* Node detail panel skeleton */}
        <div className="skeleton-pulse rounded-lg h-24" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="tab-content-enter flex flex-col items-center justify-center py-20 gap-2">
        <div className="text-sm" style={{ color: loadError ? "#ef4444" : "rgba(255,255,255,0.3)" }}>{loadError ? "Failed to load Talent Tree" : "Talent-System nicht verfügbar"}</div>
        {loadError && <button onClick={() => { setLoadError(false); setLoading(true); fetchTalents(); }} className="text-xs px-3 py-1 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>Retry</button>}
      </div>
    );
  }

  if (!data.unlocked) {
    return (
      <div className="tab-content-enter flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-4xl opacity-20">◇</div>
        <p className="text-sm text-w30">Talent-Baum wird bei Level {data.meta.firstPointLevel} freigeschaltet</p>
        <p className="text-xs text-w20">Dein Level: {data.playerLevel}</p>
      </div>
    );
  }

  return (
    <div className="tab-content-enter">
      <TutorialMomentBanner viewId="talents" playerLevel={1} />
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

      {/* Theme legend (Wolcen-style path colors) with tooltips */}
      <div className="flex gap-4 mb-4">
        {data.meta.themes && Object.entries(data.meta.themes).map(([key, theme]) => {
          const nodesInTheme = data.nodes.filter(n => theme.nodeIds.includes(n.id));
          const allocatedCount = nodesInTheme.filter(n => !!data.allocated[n.id]).length;
          return (
            <TipCustom
              key={key}
              title={theme.label}
              accent={theme.color}
              body={
                <div className="text-xs space-y-1">
                  <div className="text-w40">{theme.desc}</div>
                  <div className="text-w25 mt-1">{allocatedCount} / {nodesInTheme.length} Nodes aktiv</div>
                  <div className="text-w20 mt-1 space-y-0.5">
                    {nodesInTheme.slice(0, 6).map(n => (
                      <div key={n.id} className="flex items-center gap-1">
                        <span style={{ color: data.allocated[n.id] ? theme.color : "rgba(255,255,255,0.2)" }}>
                          {data.allocated[n.id] ? "◆" : "◇"}
                        </span>
                        <span>{n.name}</span>
                      </div>
                    ))}
                    {nodesInTheme.length > 6 && <div className="text-w15">+{nodesInTheme.length - 6} weitere</div>}
                  </div>
                </div>
              }
            >
              <div className="flex items-center gap-1.5 cursor-default" style={{ borderBottom: `1px dotted ${theme.color}44` }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: theme.color }} />
                <span className="text-xs text-w40">{theme.label}</span>
                <span className="text-xs text-w20 ml-0.5">{allocatedCount}/{nodesInTheme.length}</span>
              </div>
            </TipCustom>
          );
        })}
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
            {/* Theme sector backgrounds (Wolcen-style colored segments) */}
            {data.meta.themes && Object.entries(data.meta.themes).map(([key, theme], i) => {
              const startAngle = (i * 120 - 90) * Math.PI / 180;
              const endAngle = ((i + 1) * 120 - 90) * Math.PI / 180;
              const outerR = RING_RADII[2] + 30;
              const x1 = CENTER + Math.cos(startAngle) * outerR;
              const y1 = CENTER + Math.sin(startAngle) * outerR;
              const x2 = CENTER + Math.cos(endAngle) * outerR;
              const y2 = CENTER + Math.sin(endAngle) * outerR;
              return (
                <path
                  key={key}
                  d={`M ${CENTER} ${CENTER} L ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} Z`}
                  fill={theme.color}
                  opacity={0.02}
                  stroke={theme.color}
                  strokeWidth={0.5}
                  strokeOpacity={0.06}
                />
              );
            })}

            {/* Ring circles with slow SMIL rotation */}
            {RING_RADII.map((r, i) => (
              <circle
                key={i}
                cx={CENTER} cy={CENTER} r={r}
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={i === 2 ? 2 : 1}
                strokeDasharray={i === 2 ? "4 4" : i === 1 ? "8 12" : undefined}
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${i % 2 === 1 ? 360 : 0} ${CENTER} ${CENTER}`}
                  to={`${i % 2 === 1 ? 0 : 360} ${CENTER} ${CENTER}`}
                  dur={`${120 + i * 60}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}

            {/* SVG Defs for glow + pulse animations */}
            <defs>
              <filter id="node-glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="line-glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Connection lines — active ones pulse slowly via SMIL */}
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
                    stroke={isActive ? getNodeThemeColor(n.id, data.meta.themes) : isAvailable ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)"}
                    strokeWidth={isActive ? 2.5 : 1}
                    opacity={isActive ? 0.8 : 0.5}
                    filter={isActive ? "url(#line-glow)" : undefined}
                  >
                    {isActive && (
                      <animate attributeName="opacity" values="0.5;0.9;0.5" dur="3s" repeatCount="indefinite" />
                    )}
                  </line>
                );
              });
            })}

            {/* Particle effects on allocated nodes — slow rising sparkles via SMIL */}
            {data.nodes.filter(n => !!data.allocated[n.id]).map(n => {
              const pos = nodePositions.get(n.id);
              if (!pos) return null;
              const color = getNodeThemeColor(n.id, data.meta.themes);
              return Array.from({ length: 3 }).map((_, i) => {
                const cx = pos.x + (i - 1) * 6;
                const dur = `${3 + i * 0.7}s`;
                const begin = `${i * 1.2}s`;
                return (
                  <circle
                    key={`particle-${n.id}-${i}`}
                    cx={cx}
                    cy={pos.y}
                    r={1.5}
                    fill={color}
                    opacity={0}
                  >
                    <animate attributeName="cy" values={`${pos.y};${pos.y - 25};${pos.y - 40}`} dur={dur} begin={begin} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;0.7;0" dur={dur} begin={begin} repeatCount="indefinite" />
                    <animate attributeName="r" values="1.5;1;0.5" dur={dur} begin={begin} repeatCount="indefinite" />
                  </circle>
                );
              });
            })}

            {/* Nodes */}
            {data.nodes.map(n => {
              const pos = nodePositions.get(n.id);
              if (!pos) return null;
              const state = nodeStates.get(n.id) || "locked";
              const isSelected = selectedNode === n.id;
              const pathColor = getNodeThemeColor(n.id, data.meta.themes);
              const isTradeoff = n.excludes && n.excludes.length > 0;
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
                  filter={state === "allocated" ? "url(#node-glow)" : undefined}
                >
                  {/* Breathing glow halo for allocated nodes */}
                  {state === "allocated" && (
                    <circle
                      cx={pos.x} cy={pos.y} r={radius + 6}
                      fill="none"
                      stroke={pathColor}
                      strokeWidth={1}
                      opacity={0.2}
                    >
                      <animate attributeName="opacity" values="0.15;0.45;0.15" dur="4s" repeatCount="indefinite" />
                      <animate attributeName="r" values={`${radius + 5};${radius + 8};${radius + 5}`} dur="4s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {/* Selection ring with SMIL pulse */}
                  {isSelected && (
                    <circle
                      cx={pos.x} cy={pos.y} r={radius + 5}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      opacity={0.8}
                    >
                      <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="stroke-width" values="1.5;2.5;1.5" dur="2s" repeatCount="indefinite" />
                    </circle>
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
                  {n.maxRank > 1 && (
                    <text
                      x={pos.x} y={pos.y + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={state === "allocated" ? "#000" : "rgba(255,255,255,0.7)"}
                      fontSize={11}
                      fontWeight="bold"
                    >
                      {data.allocated[n.id]?.rank || 0}/{n.maxRank}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Center label */}
            <text x={CENTER} y={CENTER - 8} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={11} fontWeight="bold">
              SCHICKSALSBAUM
            </text>
            <text x={CENTER} y={CENTER + 8} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={11}>
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
                border: `1px solid ${getNodeThemeColor(selected.id, data.meta.themes)}22`,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold" style={{ color: getNodeThemeColor(selected.id, data.meta.themes) }}>
                    {selected.name}
                  </h3>
                  <p className="text-xs text-w25 mt-0.5">
                    {(data.meta.rings as Record<string, { label: string }>)?.[selected.ring]?.label || selected.ring} · {selected.ring === "inner" ? "Innerer Ring" : selected.ring === "middle" ? "Mittlerer Ring" : "Äußerer Ring"}
                  </p>
                </div>
                <div className="text-xs px-2 py-0.5 rounded font-mono"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#fbbf24" }}>
                  {selected.maxRank > 1 ? `Rang ${data.allocated[selected.id]?.rank || 0}/${selected.maxRank}` : "1 Punkt"}
                </div>
              </div>

              {/* Effect description + structured details */}
              <div className="rounded-lg p-3 mb-3" style={{ background: "rgba(0,0,0,0.3)" }}>
                <p className="text-xs text-w60" style={{ lineHeight: "1.5" }}>
                  {selected.desc}
                </p>
                {/* Structured effect values */}
                {selected.effect && (
                  <div className="mt-2 space-y-1">
                    {selected.effect.type === "tradeoff" && selected.effect.bonus && selected.effect.penalty && (
                      <div className="flex gap-3 text-xs">
                        <span style={{ color: "#22c55e" }}>+{selected.effect.bonus.stat}: {typeof selected.effect.bonus.modifier === "number" ? `${(selected.effect.bonus.modifier * 100).toFixed(0)}%` : selected.effect.bonus.modifier}</span>
                        <span style={{ color: "#ef4444" }}>-{selected.effect.penalty.stat}: {typeof selected.effect.penalty.modifier === "number" ? `${(selected.effect.penalty.modifier * 100).toFixed(0)}%` : (selected.effect.penalty.override !== undefined ? `→ ${selected.effect.penalty.override}` : "")}</span>
                      </div>
                    )}
                    {selected.effect.valuePerRank && Array.isArray(selected.effect.valuePerRank) && (
                      <div className="text-xs text-w30">
                        Rang-Werte: {selected.effect.valuePerRank.map((v: number, i: number) => (
                          <span key={i} className="inline-block mr-1.5" style={{ color: (data.allocated[selected.id]?.rank || 0) > i ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>
                            {typeof v === "number" ? (v < 1 ? `${(v * 100).toFixed(0)}%` : v) : v}
                          </span>
                        ))}
                      </div>
                    )}
                    {selected.effect.chancePerRank && Array.isArray(selected.effect.chancePerRank) && (
                      <div className="text-xs text-w30">
                        Chance pro Rang: {selected.effect.chancePerRank.map((v: number, i: number) => (
                          <span key={i} className="inline-block mr-1.5" style={{ color: (data.allocated[selected.id]?.rank || 0) > i ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>
                            {typeof v === "number" ? `${(v * 100).toFixed(0)}%` : v}
                          </span>
                        ))}
                      </div>
                    )}
                    {selected.effect.value !== undefined && !selected.effect.valuePerRank && !selected.effect.chancePerRank && selected.effect.type !== "tradeoff" && (
                      <div className="text-xs text-w30">
                        Effekt: <span style={{ color: "#fbbf24" }}>
                          {typeof selected.effect.value === "number" ? (selected.effect.value < 1 && selected.effect.value > 0 ? `${(selected.effect.value * 100).toFixed(0)}%` : selected.effect.value) : String(selected.effect.value)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {selected.excludes && selected.excludes.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                      TRADEOFF
                    </span>
                    <span className="text-xs text-w20">Hat Vor- und Nachteile</span>
                  </div>
                )}
                {selected.effect?.type === "tradeoff" && !selected.excludes?.length && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                      TRADEOFF
                    </span>
                    <span className="text-xs text-w20">Bonus + Malus</span>
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
                    title={allocating ? "Talent wird zugewiesen..." : undefined}
                    className="text-xs px-4 py-2 rounded-lg font-semibold"
                    style={{
                      background: `${getNodeThemeColor(selected.id, data.meta.themes)}22`,
                      color: getNodeThemeColor(selected.id, data.meta.themes),
                      border: `1px solid ${getNodeThemeColor(selected.id, data.meta.themes)}44`,
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
                    title={allocating ? "Talent wird entfernt..." : undefined}
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
                    {data.availablePoints < 1
                      ? "Nicht genug Talentpunkte"
                      : "Voraussetzungen nicht erfüllt"}
                  </div>
                )}
              </div>

              {/* Sacrifice UI for Opfergabe talent */}
              {nodeStates.get(selected.id) === "allocated" && selected.effect?.type === "sacrifice_legendary_for_talent_point" && (
                <div className="mt-3 rounded-lg p-3" style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.15)" }}>
                  <p className="text-xs font-bold mb-2" style={{ color: "#f97316" }}>Opfergabe</p>
                  <p className="text-xs text-w30 mb-2">
                    Bonus-Talentpunkte: <span style={{ color: "#fbbf24" }}>{data.bonusPoints || 0}</span> / {selected.effect.maxTotal || 3}
                  </p>
                  {(data.bonusPoints || 0) < (selected.effect.maxTotal || 3) ? (
                    <button
                      onClick={() => {
                        setConfirmMessage("Ein Legendary Item aus deinem Inventar opfern für +1 Talentpunkt?\n\nDas erste nicht-ausgerüstete, nicht-gesperrte Legendary wird geopfert.");
                        setConfirmAction(() => async () => {
                          try {
                            // Fetch inventory to find a legendary
                            const invR = await fetch(`/api/player/${encodeURIComponent(playerName || "")}/character`, { headers: getAuthHeaders(reviewApiKey) });
                            const invD = await invR.json();
                            const legendaries = (invD.items || invD.inventory || []).filter((i: { rarity?: string; locked?: boolean }) => i.rarity === "legendary" && !i.locked);
                            if (legendaries.length === 0) {
                              _toast({ type: "error", message: "No legendary item in inventory." });
                              return;
                            }
                            const item = legendaries[0];
                            const r = await fetch("/api/talents/sacrifice", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
                              body: JSON.stringify({ instanceId: item.instanceId || item.id }),
                            });
                            const d = await r.json();
                            if (!r.ok) _toast({ type: "error", message: d.error || "Opfergabe fehlgeschlagen" });
                            else {
                              _toast({ type: "purchase", message: `${d.sacrificedItem} geopfert. +1 Talentpunkt.` });
                              fetchTalents();
                            }
                          } catch { _toast({ type: "error", message: "Network error" }); }
                        });
                      }}
                      className="text-xs px-3 py-1.5 rounded font-semibold"
                      style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", cursor: "pointer" }}
                    >
                      Legendary opfern
                    </button>
                  ) : (
                    <p className="text-xs text-w20">Maximum erreicht</p>
                  )}
                </div>
              )}
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
                      background: `${getNodeThemeColor(n.id, data?.meta?.themes)}15`,
                      color: getNodeThemeColor(n.id, data?.meta?.themes),
                      border: `1px solid ${getNodeThemeColor(n.id, data?.meta?.themes)}30`,
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

      {/* ── Confirmation Modal ── */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="rounded-xl p-5 max-w-sm w-full mx-4"
            style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm mb-4 whitespace-pre-line" style={{ color: "#e8e8e8" }}>{confirmMessage}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="text-xs px-4 py-2 rounded-lg font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => { confirmAction(); setConfirmAction(null); }}
                className="text-xs px-4 py-2 rounded-lg font-semibold"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
              >
                Opfern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
