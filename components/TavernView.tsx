"use client";

import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip, TipCustom } from "@/components/GameTooltip";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TavernStatus {
  resting: boolean;
  canRest?: boolean;
  cooldownEndsAt?: string | null;
  startedAt?: string;
  days?: number;
  reason?: string | null;
  expiresAt?: string;
  remainingMs?: number;
  remainingDays?: number;
  streakFrozenAt?: number;
  forgeFrozenAt?: number;
  justExpired?: boolean;
  history?: { startedAt: string; endedAt: string; days: number; reason: string | null }[];
}

function timeLeft(ms: number): string {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TavernView({ onRefresh }: { onRefresh?: () => void }) {
  const { playerName, reviewApiKey } = useDashboard();
  const [status, setStatus] = useState<TavernStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedDays, setSelectedDays] = useState(3);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState("");

  const fetchStatus = useCallback(async () => {
    if (!playerName) return;
    try {
      const r = await fetch(`/api/tavern/status?player=${encodeURIComponent(playerName)}`);
      if (r.ok) setStatus(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [playerName]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Auto-refresh timer for remaining time
  useEffect(() => {
    if (!status?.resting) return;
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [status?.resting, fetchStatus]);

  const enterTavern = async () => {
    if (!reviewApiKey || !playerName || actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/tavern/enter", {
        method: "POST",
        headers: { ...getAuthHeaders(reviewApiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ days: selectedDays, reason: reason.trim() || null }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Failed to enter"); } else {
        setSuccess(d.message);
        setTimeout(() => setSuccess(null), 5000);
        fetchStatus();
        onRefresh?.();
      }
    } catch { setError("Network error"); }
    setActionLoading(false);
  };

  const leaveTavern = async () => {
    if (!reviewApiKey || !playerName || actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/tavern/leave", {
        method: "POST",
        headers: getAuthHeaders(reviewApiKey),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Failed to leave"); } else {
        setSuccess(d.message);
        setTimeout(() => setSuccess(null), 5000);
        fetchStatus();
        onRefresh?.();
      }
    } catch { setError("Network error"); }
    setActionLoading(false);
  };

  if (!playerName || !reviewApiKey) {
    return (
      <div className="rounded-xl px-6 py-12 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <img src="/images/icons/nav-hearth.png" alt="" width={96} height={96} className="mx-auto mb-2 img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} />
        <p className="text-sm font-bold mb-1 text-w25">The Hearth</p>
        <p className="text-xs text-w15">Log in to rest at the Hearth.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="space-y-3 tab-content-enter">
      <div className="skeleton-card h-32" />
      <div className="skeleton-card h-20" />
    </div>
  );

  return (
    <div className="space-y-5 tab-content-enter relative">
      {/* Ember particles — warm fireplace ambiance */}
      {[0,1,2,3,4,5,6,7].map(i => (
        <span
          key={`ember-${i}`}
          className="absolute pointer-events-none"
          style={{
            left: `${12 + i * 11}%`,
            bottom: `${10 + (i % 3) * 8}%`,
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            borderRadius: "50%",
            background: i % 2 === 0 ? "#d97706" : "#f59e0b",
            opacity: 0,
            animation: `ember-float ${3.5 + (i % 4) * 0.7}s ease-in-out ${i * 0.6}s infinite`,
          }}
        />
      ))}
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="relative inline-block">
          <img src="/images/icons/nav-hearth.png" alt="" width={96} height={96} className="img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} />
          {/* Heat wave lines */}
          {[0,1,2].map(i => (
            <div key={`wave-${i}`} className="absolute pointer-events-none" style={{
              width: 12 + i * 4, height: 1, borderRadius: 1,
              background: `rgba(217,119,6,${0.15 - i * 0.03})`,
              top: `${-4 - i * 6}px`, left: "50%", transform: "translateX(-50%)",
              animation: `ambient-wave ${2.5 + i * 0.5}s ease-in-out ${i * 0.4}s infinite`,
            }} />
          ))}
        </div>
        <Tip k="hearth" heading><h2 className="text-lg font-bold" style={{ color: "#d97706", cursor: "help" }}>The Hearth</h2></Tip>
        <p className="text-xs text-w35" style={{ maxWidth: "min(500px, 100%)", margin: "0 auto" }}>
          A place of rest within the tower. Here, weary adventurers can pause their journey without losing their progress. Your streaks and forge temperature will be frozen while you rest.
        </p>
        <p className="text-xs italic" style={{ color: "rgba(217,119,6,0.35)", maxWidth: "min(500px, 100%)", margin: "4px auto 0" }}>Selbst Helden brauchen eine Pause. Die Halle versteht das.</p>
      </div>

      {/* Status messages */}
      {error && <p className="text-xs text-center" style={{ color: "#ef4444" }}>{error}</p>}
      {success && <p className="text-xs text-center tab-content-enter" style={{ color: "#22c55e" }}>{success}</p>}

      {/* Currently resting */}
      {status?.resting && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: "linear-gradient(135deg, rgba(217,119,6,0.08) 0%, rgba(245,158,11,0.04) 100%)", border: "1px solid rgba(217,119,6,0.25)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold" style={{ color: "#d97706" }}>Currently Resting</p>
              <p className="text-xs text-w35">You entered the Hearth {status.startedAt ? timeAgo(status.startedAt) : "recently"}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-mono font-bold" style={{ color: "#fbbf24" }}>
                {timeLeft(status.remainingMs || 0)}
              </p>
              <p className="text-xs text-w25">remaining</p>
            </div>
          </div>

          {/* Rest progress bar */}
          {status.days && status.remainingMs != null && (
            <div className="progress-bar-diablo">
              <div className="progress-bar-diablo-fill" style={{
                width: `${Math.max(0, 100 - ((status.remainingMs / (status.days * 86400000)) * 100))}%`,
                background: "linear-gradient(90deg, #d9770688, #d97706, #fbbf24)",
              }} />
            </div>
          )}

          {status.reason && (
            <p className="text-xs italic text-w40 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", borderLeft: "3px solid rgba(217,119,6,0.3)" }}>
              &ldquo;{status.reason}&rdquo;
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Tip k="streak">
              <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-xs text-w30">Streak Frozen</p>
                <p className="text-lg font-mono font-bold" style={{ color: "#f59e0b" }}>🔥 {status.streakFrozenAt}</p>
              </div>
            </Tip>
            <Tip k="forge_temp">
              <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-xs text-w30">Forge Frozen</p>
                <p className="text-lg font-mono font-bold" style={{ color: "#f97316" }}>⚒ {status.forgeFrozenAt}%</p>
              </div>
            </Tip>
          </div>

          <button
            onClick={() => {
              setConfirmMessage("Leave the Hearth? The 30-day cooldown restarts. Your streak and forge temperature will resume.");
              setConfirmAction(() => () => leaveTavern());
            }}
            disabled={actionLoading}
            className="btn-interactive w-full text-xs font-bold py-2.5 rounded-lg"
            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", opacity: actionLoading ? 0.5 : 1, cursor: actionLoading ? "not-allowed" : "pointer" }}
            title={actionLoading ? "Action in progress..." : "Leave rest mode — your streaks and forge temp will be restored"}
          >
            {actionLoading ? "..." : "Leave the Hearth — Return to Adventure"}
          </button>
        </div>
      )}

      {/* Not resting — can enter */}
      {!status?.resting && status?.canRest && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>Take a Rest</p>
          <p className="text-xs text-w35">Going on vacation? Feeling burned out? Rest at the Hearth to freeze your progress. No quests will be generated, no streaks will decay, and your forge temperature stays locked.</p>

          {/* Duration selector */}
          <div>
            <p className="text-xs font-semibold mb-2 text-w40">Duration</p>
            <div className="flex gap-2">
              {[1, 2, 3, 5, 7].map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDays(d)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: selectedDays === d ? "rgba(217,119,6,0.15)" : "rgba(255,255,255,0.03)",
                    color: selectedDays === d ? "#d97706" : "rgba(255,255,255,0.3)",
                    border: `1px solid ${selectedDays === d ? "rgba(217,119,6,0.4)" : "rgba(255,255,255,0.06)"}`,
                    cursor: "pointer",
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Preview what gets frozen */}
          <div className="rounded-lg px-3 py-2" style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.1)" }}>
            <p className="text-xs text-w30">For {selectedDays} day{selectedDays !== 1 ? "s" : ""}, your <span style={{ color: "#fbbf24" }}>Streak</span> and <span style={{ color: "#f97316" }}>Forge Temp</span> will be frozen. No daily quests needed. 30-day cooldown after leaving.</p>
          </div>

          {/* Reason (optional) */}
          <div>
            <p className="text-xs font-semibold mb-1 text-w40">Reason (optional)</p>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Vacation, sick leave, mental health break..."
              maxLength={200}
              className="input-dark w-full text-xs px-3 py-2 rounded-lg"
            />
          </div>

          {/* What happens */}
          <div className="rounded-lg p-3 space-y-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <Tip k="rest_freeze"><p className="text-xs font-semibold text-w40">While resting:</p></Tip>
            <ul className="text-xs text-w30 space-y-0.5">
              <li>✓ Streaks are frozen (no decay)</li>
              <li>✓ Forge temperature frozen (no decay)</li>
              <li>✓ No quest pool rotation</li>
              <li>✓ No hoarding penalty changes</li>
              <li>⚠ Cannot complete quests or rituals</li>
              <li>⚠ 30-day cooldown after rest ends</li>
              <li>⚠ Auto-expires after {selectedDays} day{selectedDays !== 1 ? "s" : ""}</li>
            </ul>
          </div>

          <button
            onClick={enterTavern}
            disabled={actionLoading}
            className="btn-interactive w-full text-sm font-bold py-3 rounded-xl"
            style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "#000", opacity: actionLoading ? 0.5 : 1, cursor: actionLoading ? "not-allowed" : "pointer" }}
            title={actionLoading ? "Action in progress..." : undefined}
          >
            {actionLoading ? "..." : `Enter the Hearth (${selectedDays} day${selectedDays !== 1 ? "s" : ""})`}
          </button>
        </div>
      )}

      {/* On cooldown */}
      {!status?.resting && !status?.canRest && status?.cooldownEndsAt && (
        <div className="rounded-xl p-5 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-sm font-semibold text-w40 mb-2">Rest on Cooldown</p>
          <p className="text-xs text-w25">You recently rested. Next rest available:</p>
          {status.cooldownEndsAt && (() => {
            const cdEnd = new Date(status.cooldownEndsAt).getTime();
            const ms = cdEnd - Date.now();
            const days = Math.max(0, Math.ceil(ms / 86400000));
            const totalCooldownMs = 30 * 86400000;
            const elapsed = totalCooldownMs - ms;
            const pct = Math.max(0, Math.min(100, (elapsed / totalCooldownMs) * 100));
            return (
              <>
                <p className="text-sm font-mono font-bold mt-1" style={{ color: "#d97706" }}>
                  {days > 0 ? `in ${days} day${days !== 1 ? "s" : ""}` : "Available now"}
                </p>
                {days > 0 && (
                  <div className="mt-3 max-w-xs mx-auto">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(217,119,6,0.08)" }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #d97706, #f59e0b)" }} />
                    </div>
                    <p className="text-xs mt-1 text-w20">{Math.round(pct)}% of 30-day cooldown elapsed</p>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Rest history */}
      {status?.history && status.history.length > 0 && (
        <div className="mx-auto" style={{ maxWidth: 600 }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-w25 mb-2">Rest History</p>
          <div className="space-y-1">
            {status.history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className="text-w35">{h.days}d rest{h.reason ? ` — "${h.reason}"` : ""}</span>
                <span className="text-w20">{timeAgo(h.endedAt)}</span>
              </div>
            ))}
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
            <p className="text-sm mb-4" style={{ color: "#e8e8e8" }}>{confirmMessage}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="text-xs px-4 py-2 rounded-lg font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { confirmAction(); setConfirmAction(null); }}
                className="text-xs px-4 py-2 rounded-lg font-semibold"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
